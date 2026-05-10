import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { env } from "./env";
import intelligence from "./routes/intelligence";
import { submissionsRouter } from "./routes/submissions";
import { proxyRouter } from "./routes/proxy";
import { contactRouter } from "./routes/contact";
import { checkoutRouter } from "./routes/checkout";
import { agentRouter } from "./routes/agent";
import { catalogRouter } from "./routes/catalog";
import { logger as honoLogger } from "hono/logger";
import { prisma } from "./lib/db.js";
import { isX402Enabled, SOLANA_NETWORK, USDC_MINT } from "./lib/x402.js";
import { isAP2Enabled } from "./lib/ap2.js";
import { isACPEnabled } from "./lib/acp.js";
import { isAGTPEnabled } from "./lib/agtp.js";

// Inline logger to avoid new-file module resolution issues with bun --hot
function logEntry(level: string, message: string, meta?: Record<string, unknown>) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...meta });
  if (level === "error") console.error(entry);
  else console.log(entry);
}

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    ap2MandateVerified: boolean;
    ap2MandateType: string;
    ap2AgentId: string;
    acpSessionId: string;
    acpVerified: boolean;
    agtpVerified: boolean;
    agtpAgentId: string;
    agtpIntentMethod: string;
    agtpPrincipalId: string;
    paymentMethod: string;
    protocolUsed: string;
  }
}

const app = new Hono();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/mpp32\.org$/,
  /^https:\/\/www\.mpp32\.org$/,
  /^https:\/\/[a-z0-9-]+\.mpp32\.org$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Request ID middleware — inline to avoid new-file import issues
app.use(
  "*",
  createMiddleware(async (c, next) => {
    const id = c.req.header("x-request-id") ?? crypto.randomUUID();
    c.set("requestId", id);
    c.header("X-Request-ID", id);
    await next();
  })
);

// HTTP logging
app.use("*", honoLogger());

// Global error handler — catches unhandled exceptions
app.onError((err, c) => {
  const rid = c.get("requestId") ?? "unknown";
  logEntry("error", "Unhandled error", {
    requestId: rid,
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });
  return c.json(
    { error: { message: "An unexpected error occurred", code: "INTERNAL_ERROR" } },
    500
  );
});

// Health check with database connectivity
const startTime = Date.now();
app.get("/health", async (c) => {
  let dbStatus = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "unreachable";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  const statusCode = dbStatus === "ok" ? 200 : 503;

  return c.json(
    {
      status,
      database: dbStatus,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    },
    statusCode
  );
});

// MPP OpenAPI discovery document — required for MPPScan registration
async function openApiHandler(c: any) {
  const proto = c.req.header("x-forwarded-proto") || "https";
  const host = c.req.header("x-forwarded-host") || c.req.header("host") || "mpp32.org";
  const serverUrl = `${proto}://${host}`;

  const submissions = await prisma.submission.findMany({
    where: { status: { in: ["approved", "featured"] }, isDeprecated: false, endpointUrl: { not: null } },
    select: { slug: true, name: true, shortDescription: true, pricePerQuery: true, category: true },
  });

  const proxyPaths: Record<string, unknown> = {};
  for (const s of submissions) {
    const price = s.pricePerQuery ?? 0.001;
    proxyPaths[`/api/proxy/${s.slug}`] = {
      post: {
        operationId: `proxy-${s.slug}`,
        summary: s.name,
        description: s.shortDescription,
        tags: [s.category ?? "proxy"],
        "x-payment-info": {
          protocols: [
            { mpp: { method: "tempo", intent: "charge", currency: env.TEMPO_CURRENCY_ADDRESS } },
            ...(isX402Enabled() ? [{ x402: { method: "exact", network: SOLANA_NETWORK, asset: USDC_MINT, payTo: env.X402_RECIPIENT_ADDRESS } }] : []),
            ...(isAP2Enabled() ? [{ ap2: { version: "2025.0", mandateTypes: ["intent", "cart", "payment"], signatureAlgorithm: "ECDSA P-256", header: "X-AP2-Mandate" } }] : []),
            ...(isACPEnabled() ? [{ acp: { version: "2026-04-17", checkoutEndpoint: "/api/checkout/sessions", header: "X-ACP-Session", flow: "1. POST /api/checkout/sessions with {resource, amount} to get sessionId. 2. POST /api/checkout/sessions/{id}/complete with {paymentProof}. 3. Include sessionId in X-ACP-Session header.", capabilities: ["checkout", "cart", "payment"] } }] : []),
            ...(isAGTPEnabled() ? [{ agtp: { version: "draft-hood-independent-agtp-01", methods: ["QUERY", "SUMMARIZE", "BOOK", "SCHEDULE", "DELEGATE", "COLLABORATE"], headers: { required: ["Agent-ID", "Agent-Signature", "Agent-Timestamp"], optional: ["Principal-ID", "Authority-Scope", "AGTP-Session-ID"] }, signatureFormat: "HMAC-SHA256(agentId:METHOD:path:timestamp) base64-encoded" } }] : []),
          ],
          price: { mode: "fixed", amount: String(price), currency: "USD" },
        },
        responses: {
          "200": { description: "Successful response from upstream service" },
          "402": { description: "Payment Required — accepts 5 protocols: Tempo (pathUSD), x402 (USDC on Solana), ACP (Agent Commerce), AP2 (W3C Verifiable Credentials), AGTP (Agent Transfer Protocol)" },
          "502": { description: "Upstream service error" },
        },
      },
    };
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "MPP32 — Universal Agent Payment Proxy",
      version: "2.0.0",
      description: "Universal payment proxy for machine-payable APIs. All endpoints accept 5 protocols: Tempo (pathUSD), x402 (USDC on Solana), ACP (Agent Commerce Protocol), AP2 (W3C Verifiable Credentials), and AGTP (Agent Transfer Protocol). Providers register once — MPP32 handles protocol translation, payment verification, and settlement automatically.",
      "x-guidance": "All paid endpoints return HTTP 402 with payment challenge headers for all active protocols. Tempo clients: use WWW-Authenticate header, reply with Authorization: Payment <receipt>. x402 clients: use Payment-Required header (base64 JSON), reply with X-Payment header containing signed Solana USDC transaction. ACP clients: 1) POST /api/checkout/sessions with {resource, amount} to create a session, 2) POST /api/checkout/sessions/{id}/complete with {paymentProof} to confirm payment, 3) include the sessionId in X-ACP-Session header on the paid request. AP2 clients: include X-AP2-Mandate header with base64-encoded W3C Verifiable Credential (ECDSA P-256 signed). AGTP clients: include Agent-ID, Agent-Signature (HMAC-SHA256 of agentId:METHOD:path:timestamp, base64-encoded), and Agent-Timestamp (Unix epoch seconds) headers. AP2 and AGTP are authorization/identity layers that complement payment protocols. All protocols accepted on all endpoints. Prices are in USD.",
    },
    "x-service-info": {
      categories: ["data", "crypto", "intelligence", "proxy"],
      documentation: "https://mpp32.org/api/submissions",
    },
    servers: [
      { url: serverUrl, description: "Current server" },
      { url: "https://mpp32.org", description: "Primary domain" },
    ],
    paths: {
      "/api/intelligence": {
        post: {
          operationId: "solana-token-intelligence",
          summary: "Solana Token Intelligence",
          description: "Returns alpha score, rug risk, whale activity, and market data for any Solana token. Data sourced from DexScreener, Jupiter, and CoinGecko in real-time.",
          tags: ["intelligence", "solana", "crypto"],
          "x-payment-info": {
            protocols: [
              { mpp: { method: "tempo", intent: "charge", currency: env.TEMPO_CURRENCY_ADDRESS } },
              ...(isX402Enabled() ? [{ x402: { method: "exact", network: SOLANA_NETWORK, asset: USDC_MINT, payTo: env.X402_RECIPIENT_ADDRESS } }] : []),
              ...(isAP2Enabled() ? [{ ap2: { version: "2025.0", mandateTypes: ["intent", "cart", "payment"], signatureAlgorithm: "ECDSA P-256", header: "X-AP2-Mandate" } }] : []),
              ...(isACPEnabled() ? [{ acp: { version: "2026-04-17", checkoutEndpoint: "/api/checkout/sessions", header: "X-ACP-Session", flow: "1. POST /api/checkout/sessions with {resource, amount}. 2. POST /api/checkout/sessions/{id}/complete with {paymentProof}. 3. Include sessionId in X-ACP-Session header.", capabilities: ["checkout", "cart", "payment"] } }] : []),
              ...(isAGTPEnabled() ? [{ agtp: { version: "draft-hood-independent-agtp-01", methods: ["QUERY", "SUMMARIZE", "BOOK", "SCHEDULE", "DELEGATE", "COLLABORATE"], headers: { required: ["Agent-ID", "Agent-Signature", "Agent-Timestamp"], optional: ["Principal-ID", "Authority-Scope"] }, signatureFormat: "HMAC-SHA256(agentId:METHOD:path:timestamp) base64-encoded" } }] : []),
            ],
            price: { mode: "fixed", amount: env.MPP_PRICE, currency: "USD" },
            "x-discount-info": {
              header: "X-Wallet-Address",
              description: "Pass your Solana wallet address to receive M32 token holder discounts. Response includes X-M32-Discount header with applied discount percentage.",
              tiers: [
                { minBalance: 250000, token: "M32", discountPercent: 20, effectivePrice: "0.0064" },
                { minBalance: 1000000, token: "M32", discountPercent: 40, effectivePrice: "0.0048" },
              ],
            },
          },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["token"],
                  properties: {
                    token: { type: "string", description: "Solana token address or ticker symbol" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Token intelligence data" },
            "402": { description: "Payment Required — accepts 5 protocols: Tempo (pathUSD), x402 (USDC on Solana), ACP (Agent Commerce), AP2 (W3C Verifiable Credentials), AGTP (Agent Transfer Protocol)" },
            "404": { description: "No trading pairs found for the given token" },
            "502": { description: "Data fetch error from upstream sources" },
          },
        },
      },
      ...proxyPaths,
      "/api/agent/protocols": {
        get: {
          operationId: "agent-protocols",
          summary: "List all 5 payment protocols and their status",
          description: "Returns real-time status of Tempo, x402, ACP, AP2, and AGTP protocols with capabilities, settlement speeds, and recommendations.",
          tags: ["agent", "protocols"],
          responses: { "200": { description: "Protocol status list" } },
        },
      },
      "/api/agent/sessions": {
        post: {
          operationId: "agent-create-session",
          summary: "Create a non-custodial agent session",
          description: "Create an agent session that issues an API key for rate-limited access. MPP32 never holds custody of funds — paid services are settled by the caller's wallet via x402 (Solana USDC), Tempo (Eth L2 pathUSD), or ACP. M32 holder discounts require wallet-signature verification (coming soon).",
          tags: ["agent", "sessions"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["agentId"],
                  properties: {
                    agentId: { type: "string" },
                    agentName: { type: "string" },
                    walletAddress: { type: "string", description: "Solana wallet (stored unverified — discount applies only after signature verification)" },
                    preferredProtocol: { type: "string", enum: ["tempo", "x402", "acp", "ap2", "agtp"] },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Session created with API key" },
            "400": { description: "Validation error" },
          },
        },
      },
      "/api/agent/quote": {
        post: {
          operationId: "agent-quote",
          summary: "Get cross-protocol pricing quote",
          description: "Compare pricing across all 5 protocols for any service. Includes M32 holder discounts, estimated settlement times, and protocol recommendation.",
          tags: ["agent", "pricing"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["service"],
                  properties: {
                    service: { type: "string" },
                    walletAddress: { type: "string" },
                    capabilities: { type: "array", items: { type: "string" } },
                    preferredProtocol: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Cross-protocol quote with recommendation" },
            "404": { description: "Service not found" },
          },
        },
      },
      "/api/agent/execute": {
        post: {
          operationId: "agent-execute",
          summary: "Execute cross-protocol smart buy",
          description: "Execute a purchase through the optimal protocol with M32 discounts applied. Requires X-Agent-Key header from session creation. Auto-selects protocol, tracks spending, enforces budgets.",
          tags: ["agent", "execute"],
          "x-payment-info": { note: "Payment handled via agent session — no per-request payment headers needed" },
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["service"],
                  properties: {
                    service: { type: "string" },
                    method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
                    body: { type: "object" },
                    query: { type: "object" },
                    protocol: { type: "string", enum: ["tempo", "x402", "acp", "ap2", "agtp"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Execution result with protocol metadata and spending tracking" },
            "401": { description: "Missing or invalid agent session" },
            "402": { description: "Budget exceeded" },
          },
        },
      },
      "/api/agent/services": {
        get: {
          operationId: "agent-services",
          summary: "Discover services with cross-protocol pricing",
          description: "List all available services with pricing across all 5 protocols and M32 discount calculations.",
          tags: ["agent", "discovery"],
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "wallet", in: "query", schema: { type: "string" }, description: "Solana wallet for discount calc" },
          ],
          responses: { "200": { description: "Services with cross-protocol pricing" } },
        },
      },
      "/api/agent/stats": {
        get: {
          operationId: "agent-stats",
          summary: "Agent platform analytics",
          description: "Aggregate stats: active sessions, transaction volume, protocol breakdown, and average latencies.",
          tags: ["agent", "analytics"],
          responses: { "200": { description: "Platform-wide agent analytics" } },
        },
      },
    },
  };

  return c.json(spec);
}
app.get("/openapi.json", openApiHandler);
app.get("/api/openapi.json", openApiHandler);
app.get("/api/openapi", openApiHandler);
app.get("/api/discovery", openApiHandler);

// Endpoint verification — returns the verification token for the submission whose endpointUrl matches this server
async function handleVerifyEndpoint(c: any) {
  const submission = await prisma.submission.findFirst({
    where: { verificationToken: { not: null } },
    orderBy: { createdAt: 'desc' },
  })
  if (!submission?.verificationToken) {
    return c.text("No verification token found", 404)
  }
  return c.text(submission.verificationToken)
}
app.get("/.well-known/mpp32-verify", handleVerifyEndpoint)
app.get("/api/mpp32-verify", handleVerifyEndpoint)

// A2A Agent Card — standard agent-to-agent discovery format
app.get("/.well-known/agent.json", (c) => {
  const proto = c.req.header("x-forwarded-proto") || "https";
  const host = c.req.header("x-forwarded-host") || c.req.header("host") || "mpp32.org";
  const serverUrl = `${proto}://${host}`;

  return c.json({
    name: "MPP32",
    description: "Universal payment proxy for machine-payable APIs. Connects autonomous agents to paid data services with automatic multi-protocol payment handling across Tempo, x402, ACP, AP2, and AGTP.",
    url: serverUrl,
    version: "2.0.0",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    skills: [
      {
        id: "solana-token-intelligence",
        name: "Solana Token Intelligence",
        description: "Real-time alpha score, rug risk, whale activity, smart money signals, and market data for any Solana token. Sources: DexScreener, Jupiter, CoinGecko.",
        tags: ["solana", "crypto", "defi", "intelligence", "token", "whale", "rug-risk", "alpha"],
        examples: [
          "Analyze SOL token for rug risk and whale activity",
          "Get alpha score and pump probability for BONK",
          "What is the smart money signal for JUP token",
        ],
      },
      {
        id: "api-proxy",
        name: "Universal API Proxy",
        description: "Route requests to any registered machine-payable API provider. Automatic payment handling, endpoint verification, and protocol translation.",
        tags: ["proxy", "api", "marketplace", "payments", "agent-commerce"],
        examples: [
          "List all available API services on MPP32",
          "Call the weather API through MPP32 proxy",
          "Find crypto data providers on the marketplace",
        ],
      },
      {
        id: "cross-protocol-agent",
        name: "Cross-Protocol Agent Commerce",
        description: "Unified agent plugin for buying across all 5 payment protocols (Tempo, x402, ACP, AP2, AGTP). Smart protocol selection, M32 token holder discounts up to 40%, budget management, spending analytics, and transaction tracking. The only AI agent plugin that routes payments through 5 protocols with native token utility.",
        tags: ["agent", "cross-protocol", "commerce", "defi", "payments", "m32", "token-utility", "smart-routing"],
        examples: [
          "Create an agent session with $10 budget and M32 discount",
          "Get a cross-protocol quote for token intelligence",
          "Execute a smart buy with automatic protocol selection",
          "Check my agent session spending and protocol breakdown",
        ],
      },
    ],
    authentication: {
      schemes: ["x402", "tempo", "acp", "ap2", "agtp"],
      description: "All endpoints accept 5 payment and authorization protocols. HTTP 402 challenge-response for Tempo and x402. Header-based for ACP, AP2, and AGTP.",
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    provider: {
      organization: "MPP32",
      url: "https://mpp32.org",
    },
    documentationUrl: `${serverUrl}/api/discovery`,
    openApiUrl: `${serverUrl}/openapi.json`,
    mcpConfigUrl: `${serverUrl}/api/mcp-config`,
  });
});

// MCP server configuration endpoint
app.get("/api/mcp-config", (c) => {
  return c.json({
    data: {
      name: "mpp32",
      displayName: "MPP32 Universal Agent Payment Proxy",
      description: "Universal payment proxy for machine-payable APIs. Connects autonomous agents to paid data services across 5 payment protocols. Submit any Solana token for real-time intelligence, or proxy requests to any registered API provider with automatic payment handling.",
      version: "2.0.0",
      capabilities: [
        "solana-token-intelligence",
        "on-chain-analysis",
        "real-time-market-data",
        "universal-payment-proxy",
        "multi-protocol-payments",
        "agent-to-agent-commerce",
        "api-marketplace",
        "whale-tracking",
        "rug-risk-detection",
        "defi-analytics",
      ],
      keywords: [
        "solana", "token", "intelligence", "crypto", "defi", "payments",
        "agent", "autonomous", "mcp", "proxy", "api", "marketplace",
        "whale", "rug", "alpha", "on-chain", "dexscreener", "jupiter",
        "coingecko", "market-data", "price", "oracle", "x402", "tempo",
        "acp", "ap2", "agtp", "machine-payable", "mpp32",
      ],
      categories: ["finance", "crypto", "data", "intelligence", "payments", "agent-commerce"],
      mcpConfig: {
        mcpServers: {
          mpp32: {
            command: "npx",
            args: ["mpp32-mcp-server"],
            env: {
              MPP32_PRIVATE_KEY: "your-tempo-private-key",
              MPP32_SOLANA_PRIVATE_KEY: "your-solana-private-key-for-x402",
            },
          },
        },
      },
      tools: [
        {
          name: "list_mpp32_services",
          description: "List all machine-payable API services available through the MPP32 universal proxy. Returns service names, categories, pricing, payment protocols, and endpoint status for every registered provider. Use this to discover what data sources and APIs are available for autonomous agent consumption.",
          inputSchema: {
            type: "object",
            properties: {
              category: { type: "string", description: "Filter by category: ai-inference, token-scanner, price-oracle, trading-signal, defi-analytics, wallet-intelligence, on-chain-data, market-data, web-search, and more" },
              verifiedOnly: { type: "boolean", description: "Only return verified providers (endpoint ownership confirmed via HTTP challenge)", default: true },
            },
          },
          annotations: {
            title: "Browse MPP32 API Marketplace",
            readOnlyHint: true,
            openWorldHint: true,
          },
        },
        {
          name: "get_solana_token_intelligence",
          description: "Get comprehensive Solana token intelligence including alpha score (0-100), rug risk assessment, whale activity tracking, smart money signals, 24h pump probability, projected ROI ranges, and real-time market data from DexScreener, Jupiter, and CoinGecko. Accepts any token address or ticker symbol. M32 token holders receive up to 40% discount.",
          inputSchema: {
            type: "object",
            required: ["token"],
            properties: {
              token: { type: "string", description: "Solana token mint address or ticker symbol (e.g. SOL, BONK, JUP, or full base58 address)" },
              walletAddress: { type: "string", description: "Optional Solana wallet address for M32 token holder discount verification" },
            },
          },
          annotations: {
            title: "Solana Token Intelligence",
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
          },
        },
        {
          name: "call_mpp32_endpoint",
          description: "Call any registered MPP32 proxy endpoint with automatic multi-protocol payment handling. Supports 5 payment and authorization protocols: Tempo (pathUSD on Ethereum L2), x402 (USDC on Solana), ACP (Agent Commerce Protocol for checkout sessions), AP2 (W3C Verifiable Credential authorization), and AGTP (Agent Transfer Protocol for agent identity). The proxy handles HTTP 402 challenge-response, payment verification, and request forwarding automatically.",
          inputSchema: {
            type: "object",
            required: ["service", "payload"],
            properties: {
              service: { type: "string", description: "Service slug from list_mpp32_services" },
              payload: { type: "object", description: "Request body to forward to the upstream service" },
              preferredProtocol: { type: "string", enum: ["tempo", "x402", "acp", "ap2", "agtp"], description: "Preferred payment protocol (all are accepted on all endpoints)" },
            },
          },
          annotations: {
            title: "Call Paid API via MPP32 Proxy",
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
          },
        },
        {
          name: "smart_buy",
          description: "Non-custodial cross-protocol service call. Creates or reuses an agent session and forwards a request to the chosen service. MPP32 NEVER spends funds on your behalf — when the upstream returns 402, the challenge is forwarded back so the caller's own wallet can sign with x402 (Solana USDC) or Tempo (Eth L2 pathUSD). M32 holder discounts apply once wallet ownership is signature-verified.",
          inputSchema: {
            type: "object",
            required: ["service"],
            properties: {
              service: { type: "string", description: "Service slug (e.g. 'mpp32-intelligence') or 'intelligence' for the oracle, or 'free:dexscreener-search' for free testing" },
              payload: { type: "object", description: "Request body to forward to the service" },
              walletAddress: { type: "string", description: "Solana wallet (stored unverified; discount only applies after signature verification)" },
              preferredProtocol: { type: "string", enum: ["tempo", "x402", "acp", "ap2", "agtp"], description: "Override protocol selection (default: auto-optimized)" },
            },
          },
          annotations: {
            title: "Non-Custodial Service Call",
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
          },
        },
        {
          name: "get_cross_protocol_quote",
          description: "Compare pricing across all 5 payment protocols before buying. Returns real-time quotes with M32 holder discounts, protocol fees, settlement speeds, and a recommendation for the optimal protocol. Use this to show users the best deal or to let agents make informed decisions.",
          inputSchema: {
            type: "object",
            required: ["service"],
            properties: {
              service: { type: "string", description: "Service slug to get quotes for" },
              walletAddress: { type: "string", description: "Solana wallet for M32 discount calculation" },
              capabilities: {
                type: "array",
                items: { type: "string", enum: ["tempo", "x402", "acp", "ap2", "agtp"] },
                description: "Protocols this agent supports (narrows recommendations)",
              },
            },
          },
          annotations: {
            title: "Cross-Protocol Price Quote",
            readOnlyHint: true,
            openWorldHint: true,
          },
        },
        {
          name: "create_agent_session",
          description: "Create a non-custodial agent session for cross-protocol service discovery and call routing. Returns a rate-limited API key. MPP32 NEVER spends funds on your behalf — every paid call is settled by the caller's own wallet, verified on-chain via the appropriate facilitator (x402 for USDC on Solana, Tempo for pathUSD on L2). Wallet address is recorded for M32 discount tier lookup but ownership is not authenticated until SIWS sign-in (coming soon).",
          inputSchema: {
            type: "object",
            required: ["agentId"],
            properties: {
              agentId: { type: "string", description: "Unique identifier for this agent" },
              agentName: { type: "string", description: "Human-readable agent name" },
              walletAddress: { type: "string", description: "Optional Solana wallet for M32 discount tier lookup. Address ownership is NOT verified until SIWS — discounts only apply once verified." },
              preferredProtocol: { type: "string", enum: ["tempo", "x402", "acp", "ap2", "agtp"], description: "Routing preference. Final settlement happens via whatever protocol the called service supports." },
            },
          },
          annotations: {
            title: "Create Agent Session (Non-Custodial)",
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
          },
        },
      ],
      paymentMethods: [
        { protocol: "tempo", type: "payment", currency: "pathUSD", network: "Tempo (Ethereum L2)", keyEnvVar: "MPP32_PRIVATE_KEY", description: "EVM-based micropayments via Tempo L2. Instant settlement, sub-cent fees." },
        { protocol: "x402", type: "payment", currency: "USDC", network: "Solana Mainnet", keyEnvVar: "MPP32_SOLANA_PRIVATE_KEY", description: "Native Solana USDC payments via HTTP 402 protocol. Fast finality." },
        { protocol: "acp", type: "payment", version: "2026-04-17", header: "X-ACP-Session", checkoutEndpoint: "/api/checkout/sessions", flow: "1. POST /api/checkout/sessions {resource, amount} → sessionId. 2. POST /api/checkout/sessions/{id}/complete {paymentProof}. 3. Include sessionId in X-ACP-Session header.", description: "Agent Commerce Protocol. Database-backed checkout sessions with payment verification." },
        { protocol: "ap2", type: "authorization", version: "2025.0", header: "X-AP2-Mandate", credentialFormat: "W3C Verifiable Credential", signatureAlgorithm: "ECDSA P-256", description: "W3C Verifiable Credential authorization. Agents present ECDSA P-256 signed mandates to authorize spending." },
        { protocol: "agtp", type: "identity", version: "draft-hood-independent-agtp-01", headers: ["Agent-ID", "Agent-Signature", "Agent-Timestamp", "Principal-ID", "Authority-Scope"], signatureFormat: "HMAC-SHA256(agentId:METHOD:path:timestamp) base64-encoded", description: "Agent Transfer Protocol. Cryptographically signed agent identity for tracking, intent declaration, and priority routing." },
      ],
      endpoints: {
        openapi: "/openapi.json",
        discovery: "/api/discovery",
        mcpConfig: "/api/mcp-config",
        services: "/api/submissions",
        intelligence: "/api/intelligence",
        proxy: "/api/proxy/{slug}",
        checkout: "/api/checkout/sessions",
        health: "/health",
        agent: {
          protocols: "/api/agent/protocols",
          sessions: "/api/agent/sessions",
          quote: "/api/agent/quote",
          execute: "/api/agent/execute",
          services: "/api/agent/services",
          stats: "/api/agent/stats",
        },
      },
      install: "npx mpp32-mcp-server",
      package: "mpp32-mcp-server",
    },
  });
});

// Routes
app.route("/api/intelligence", intelligence);
app.route("/api/submissions", submissionsRouter);
app.route("/api/proxy", proxyRouter);
app.route("/api/contact", contactRouter);
app.route("/api/checkout", checkoutRouter);
app.route("/api/agent", agentRouter);
app.route("/api/catalog", catalogRouter);

// Metrics route — dynamically loaded to work with bun --hot when file is new
async function mountMetrics() {
  try {
    const { metricsRouter } = await import("./routes/metrics");
    app.route("/api/metrics", metricsRouter);
  } catch {
    logEntry("warn", "Metrics route not available — will load on next restart");
  }
}
mountMetrics();

// ---- Background re-verification of endpoints (every 24h) ----
import { checkVerificationToken } from './lib/verification.js'

const REVERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_FAIL_COUNT = 3

async function reverifyEndpoints() {
  logEntry('info', 'Starting background endpoint re-verification')
  try {
    const submissions = await prisma.submission.findMany({
      where: {
        isVerified: true,
        isDeprecated: false,
        endpointUrl: { not: null },
        verificationToken: { not: null },
      },
    })

    let successCount = 0
    let failCount = 0
    let suspendedCount = 0

    for (const submission of submissions) {
      const result = await checkVerificationToken(
        submission.endpointUrl!,
        submission.verificationToken!
      )

      if (result.ok) {
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            verifyFailCount: 0,
            lastVerifiedAt: new Date(),
          },
        })
        successCount++
      } else {
        const newFailCount = submission.verifyFailCount + 1
        const suspended = newFailCount >= MAX_FAIL_COUNT

        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            verifyFailCount: newFailCount,
            ...(suspended ? { isVerified: false } : {}),
          },
        })

        if (suspended) {
          logEntry('warn', 'Endpoint verification suspended', {
            slug: submission.slug,
            failCount: newFailCount,
            reason: result.message,
          })
          suspendedCount++
        } else {
          logEntry('warn', 'Endpoint re-verification failed', {
            slug: submission.slug,
            failCount: newFailCount,
            reason: result.message,
          })
        }
        failCount++
      }
    }

    logEntry('info', 'Background re-verification complete', {
      total: submissions.length,
      success: successCount,
      failed: failCount,
      suspended: suspendedCount,
    })
  } catch (err) {
    logEntry('error', 'Background re-verification error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

setInterval(reverifyEndpoints, REVERIFY_INTERVAL_MS)


// ---- Catalog seeding & periodic refresh ----
import { runAllCrawlers } from './lib/catalog/runner.js'

const CATALOG_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function refreshCatalog(reason: string) {
  logEntry('info', 'Starting catalog crawl', { reason })
  try {
    const runs = await runAllCrawlers()
    const summary = runs.map((r) => ({
      source: r.source,
      status: r.status,
      itemsFound: r.itemsFound,
      itemsAdded: r.itemsAdded,
      itemsUpdated: r.itemsUpdated,
      durationMs: r.durationMs,
      error: r.errorMessage ?? null,
    }))
    logEntry('info', 'Catalog crawl complete', { reason, summary })
  } catch (err) {
    logEntry('error', 'Catalog crawl failed', {
      reason,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function seedCatalogIfEmpty() {
  try {
    const count = await prisma.externalService.count({ where: { active: true } })
    if (count === 0) {
      logEntry('info', 'Catalog empty — seeding from crawlers')
      await refreshCatalog('initial-seed')
    } else {
      logEntry('info', 'Catalog already populated', { count })
    }
  } catch (err) {
    logEntry('error', 'Failed to check/seed catalog', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// Fire and forget — don't block server boot on crawl
seedCatalogIfEmpty()
setInterval(() => {
  refreshCatalog('scheduled-refresh')
}, CATALOG_REFRESH_INTERVAL_MS)


async function seedOracleSubmission() {
  const slug = 'mpp32-intelligence'
  const backendUrl = env.BACKEND_URL || 'https://mpp32.org'
  const endpointUrl = `${backendUrl}/api/intelligence`

  const fields = {
    name: 'MPP32 Intelligence Oracle',
    shortDescription:
      'Real-time Solana token intelligence — alpha scores, rug risk, whale tracking, smart money signals, pump probability, and market data from DexScreener, Jupiter & CoinGecko.',
    fullDescription:
      'The MPP32 Intelligence Oracle analyzes any Solana token across 8 dimensions: Alpha Score (composite 0-100), Risk-Reward Ratio, Smart Money Signals, 24h Pump Probability, Projected ROI Range, Whale Activity, Rug Risk (7-factor model), and full Market Intelligence. Data sourced in real-time from DexScreener, Jupiter Price API, and CoinGecko. Response time under 2 seconds. M32 token holders receive up to 40% discount.',
    category: 'token-scanner',
    websiteUrl: 'https://mpp32.org/oracle',
    endpointUrl,
    pricePerQuery: parseFloat(env.MPP_PRICE),
    paymentAddress: env.TEMPO_RECIPIENT_ADDRESS,
    solanaAddress: env.X402_RECIPIENT_ADDRESS,
    creatorName: 'MPP32',
    creatorEmail: 'team@mpp32.org',
    twitterHandle: 'maboroshi32',
    status: 'featured' as const,
    isVerified: true,
    lastVerifiedAt: new Date(),
    verifyFailCount: 0,
  }

  await prisma.submission.upsert({
    where: { slug },
    create: { slug, ...fields },
    update: { endpointUrl, pricePerQuery: fields.pricePerQuery, paymentAddress: fields.paymentAddress, solanaAddress: fields.solanaAddress },
  })

  logEntry('info', 'MPP32 Intelligence Oracle submission ready', { endpointUrl })
}

seedOracleSubmission().catch((err) =>
  logEntry('error', 'Failed to seed Oracle submission', { error: String(err) })
)

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
