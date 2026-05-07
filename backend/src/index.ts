import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { env } from "./env";
import { sampleRouter } from "./routes/sample";
import intelligence from "./routes/intelligence";
import { submissionsRouter } from "./routes/submissions";
import { proxyRouter } from "./routes/proxy";
import { contactRouter } from "./routes/contact";
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
            ...(isACPEnabled() ? [{ acp: { version: "2026-04-17", checkoutEndpoint: "/checkout_sessions", header: "X-ACP-Session", capabilities: ["checkout", "cart", "payment"] } }] : []),
            ...(isAGTPEnabled() ? [{ agtp: { version: "draft-hood-independent-agtp-01", methods: ["QUERY", "SUMMARIZE", "BOOK", "SCHEDULE", "DELEGATE", "COLLABORATE"], headers: { required: ["Agent-ID"], optional: ["Principal-ID", "Authority-Scope", "AGTP-Session-ID"] } } }] : []),
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
      "x-guidance": "All paid endpoints return HTTP 402 with payment challenge headers for all active protocols. Tempo clients: use WWW-Authenticate header, reply with Authorization: Payment <receipt>. x402 clients: use Payment-Required header (base64 JSON), reply with X-Payment header. ACP clients: use X-ACP-Requirements header, reply with X-ACP-Session header containing session ID or base64 credential. AP2 clients: include X-AP2-Mandate header with base64-encoded W3C Verifiable Credential (ECDSA P-256 signed). AGTP clients: include Agent-ID header for agent identity tracking and priority routing. AP2 and AGTP are authorization/identity layers that complement payment protocols. All protocols accepted on all endpoints. Prices are in USD — payable via any supported protocol.",
    },
    "x-service-info": {
      categories: ["data", "crypto", "intelligence", "proxy"],
      documentation: "https://mpp32.org/api/submissions",
    },
    servers: [{ url: serverUrl }],
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
              ...(isACPEnabled() ? [{ acp: { version: "2026-04-17", checkoutEndpoint: "/checkout_sessions", header: "X-ACP-Session", capabilities: ["checkout", "cart", "payment"] } }] : []),
              ...(isAGTPEnabled() ? [{ agtp: { version: "draft-hood-independent-agtp-01", methods: ["QUERY", "SUMMARIZE", "BOOK", "SCHEDULE", "DELEGATE", "COLLABORATE"], headers: { required: ["Agent-ID"], optional: ["Principal-ID", "Authority-Scope"] } } }] : []),
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
    },
  };

  return c.json(spec);
}
app.get("/openapi.json", openApiHandler);
app.get("/api/openapi.json", openApiHandler);
app.get("/api/openapi", openApiHandler);
app.get("/api/discovery", openApiHandler);

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
      claude_desktop_config: {
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
      ],
      paymentMethods: [
        { protocol: "tempo", type: "payment", currency: "pathUSD", network: "Tempo (Ethereum L2)", keyEnvVar: "MPP32_PRIVATE_KEY", description: "EVM-based micropayments via Tempo L2. Instant settlement, sub-cent fees." },
        { protocol: "x402", type: "payment", currency: "USDC", network: "Solana Mainnet", keyEnvVar: "MPP32_SOLANA_PRIVATE_KEY", description: "Native Solana USDC payments via HTTP 402 protocol. Fast finality." },
        { protocol: "acp", type: "payment", version: "2026-04-17", header: "X-ACP-Session", description: "Agent Commerce Protocol. Checkout session based payments for agent-to-agent commerce." },
        { protocol: "ap2", type: "authorization", version: "2025.0", header: "X-AP2-Mandate", credentialFormat: "W3C Verifiable Credential", signatureAlgorithm: "ECDSA P-256", description: "W3C Verifiable Credential authorization. Agents present signed mandates to authorize spending." },
        { protocol: "agtp", type: "identity", version: "draft-hood-independent-agtp-01", headers: ["Agent-ID", "Principal-ID", "Authority-Scope"], description: "Agent Transfer Protocol. Identity tracking, intent declaration, and priority routing for autonomous agents." },
      ],
      endpoints: {
        openapi: "/openapi.json",
        discovery: "/api/discovery",
        mcpConfig: "/api/mcp-config",
        services: "/api/submissions",
        intelligence: "/api/intelligence",
        proxy: "/api/proxy/{slug}",
        health: "/health",
      },
      install: "npx mpp32-mcp-server",
      package: "mpp32-mcp-server",
    },
  });
});

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/intelligence", intelligence);
app.route("/api/submissions", submissionsRouter);
app.route("/api/proxy", proxyRouter);
app.route("/api/contact", contactRouter);

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

// ---- Auto-seed MPP32 listing if database is empty ----
import { randomBytes, createHash } from 'crypto'

async function seedMPP32IfEmpty() {
  try {
    const count = await prisma.submission.count()
    if (count > 0) return

    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const verificationToken = randomBytes(32).toString('hex')

    await prisma.submission.create({
      data: {
        name: 'MPP32 Solana Intelligence Oracle',
        slug: 'mpp32-intelligence',
        shortDescription: 'Real-time Solana token intelligence with alpha scores, rug risk, whale tracking, and market data from DexScreener, Jupiter, and CoinGecko.',
        fullDescription: 'The MPP32 Intelligence Oracle provides comprehensive on-chain analysis for any Solana token. Submit a token address or ticker and receive alpha score (0-100), rug risk assessment, whale activity tracking, smart money signals, 24h pump probability, projected ROI ranges, and full market data. Data sourced in real-time from DexScreener, Jupiter Price API, and CoinGecko. Accepts all 5 payment protocols: Tempo, x402, ACP, AP2, and AGTP. M32 token holders receive up to 40% discount.',
        category: 'token-scanner',
        websiteUrl: 'https://mpp32.org',
        endpointUrl: 'https://mpp32.org/api/intelligence',
        pricePerQuery: 0.008,
        paymentAddress: '0x2a87Da867d725aA8853dc88548Ad6C64bBb456c1',
        solanaAddress: '9Pa8yUe8k1aRAoS1J8T5d4Mc4zXH2QTKiHE7wibowt6S',
        creatorName: 'MPP32',
        creatorEmail: 'admin@mpp32.org',
        logoUrl: '/logo-mpp32.jpg',
        twitterHandle: 'MPP32_dev',
        githubUrl: 'https://github.com/MPP32/MPP32',
        status: 'featured',
        managementToken: tokenHash,
        verificationToken,
        isVerified: true,
        verifyFailCount: 0,
        lastVerifiedAt: new Date(),
      },
    })

    logEntry('info', 'Auto-seeded MPP32 Intelligence Oracle listing')
  } catch (err) {
    logEntry('error', 'Auto-seed failed', { error: err instanceof Error ? err.message : String(err) })
  }
}
seedMPP32IfEmpty()

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
