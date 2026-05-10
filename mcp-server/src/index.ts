#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SERVER_VERSION = "1.1.2";

// ── Env loading: trim and sanitize aggressively ─────────────────────────────
// Copy-paste from Claude Desktop / Cursor / Windsurf JSON config UIs frequently
// adds trailing \n, \r, NBSP, BOM, or wraps the value in literal quotes. Any
// non-ASCII byte (including a stray newline) in a value that ends up in an
// HTTP header makes Node's undici fetch throw ERR_INVALID_CHAR, which used to
// surface as a confusing "invalid byte character" error on every catalog call.
function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  let v = raw;
  if (v.charCodeAt(0) === 0xfeff) v = v.slice(1);
  v = v.trim();
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'")))
  ) {
    v = v.slice(1, -1).trim();
  }
  if (v.length === 0) return undefined;
  return v;
}

function isPrintableAscii(v: string): boolean {
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

function safeHeaderValue(name: string, value: string): string {
  if (!isPrintableAscii(value)) {
    throw new Error(
      `Environment variable contains non-printable or non-ASCII characters that cannot be sent as an HTTP header (${name}). ` +
        `Re-copy the value from https://mpp32.org/agent-console without any surrounding whitespace, quotes, or newlines.`,
    );
  }
  return value;
}

function describeEnvProblem(name: string, raw: string, expected: string): string {
  const hex = Array.from(raw.slice(0, 4))
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join(" ");
  return `${name} looks malformed. Expected ${expected}. First bytes: 0x${hex}. Re-copy from ${API_URL}/agent-console.`;
}

const RAW_API_URL = readEnv("MPP32_API_URL") ?? "https://mpp32.org";
const API_URL = (() => {
  try {
    const u = new URL(RAW_API_URL.replace(/\/+$/, ""));
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new Error(`MPP32_API_URL must be http(s), got ${u.protocol}`);
    }
    return u.toString().replace(/\/+$/, "");
  } catch (err) {
    console.error(
      `[mpp32] MPP32_API_URL is not a valid URL: ${err instanceof Error ? err.message : String(err)}. ` +
        `Falling back to https://mpp32.org.`,
    );
    return "https://mpp32.org";
  }
})();

// Default request timeout. Configurable via MPP32_TIMEOUT_MS.
const TIMEOUT_MS = (() => {
  const raw = readEnv("MPP32_TIMEOUT_MS");
  if (!raw) return 30_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1_000 || n > 300_000) {
    console.error(`[mpp32] MPP32_TIMEOUT_MS=${raw} out of range. Using 30000ms.`);
    return 30_000;
  }
  return n;
})();

// MPP32_AGENT_KEY is canonical; MPP32_API_KEY is an accepted alias from older docs.
const AGENT_KEY: string | undefined = (() => {
  const v = readEnv("MPP32_AGENT_KEY") ?? readEnv("MPP32_API_KEY");
  if (!v) return undefined;
  if (!isPrintableAscii(v)) {
    console.error(
      `[mpp32] MPP32_AGENT_KEY contains non-ASCII characters and will be ignored. ` +
        `Re-copy the key from ${API_URL}/agent-console.`,
    );
    return undefined;
  }
  if (!/^mpp32_agent_[A-Za-z0-9_-]+$/.test(v)) {
    console.error(
      `[mpp32] ${describeEnvProblem("MPP32_AGENT_KEY", v, "a value starting with 'mpp32_agent_'")}`,
    );
  }
  return v;
})();

const PRIVATE_KEY: string | undefined = (() => {
  const v = readEnv("MPP32_PRIVATE_KEY");
  if (!v) return undefined;
  if (!isPrintableAscii(v)) {
    console.error(
      `[mpp32] MPP32_PRIVATE_KEY contains non-ASCII characters and will be ignored. ` +
        `Re-paste the hex key (0x-prefixed or 64 hex chars).`,
    );
    return undefined;
  }
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(v)) {
    console.error(
      `[mpp32] ${describeEnvProblem("MPP32_PRIVATE_KEY", v, "0x-prefixed 64-hex-char EVM private key")}`,
    );
  }
  return v;
})();

const SOLANA_PRIVATE_KEY: string | undefined = (() => {
  const v = readEnv("MPP32_SOLANA_PRIVATE_KEY");
  if (!v) return undefined;
  if (!isPrintableAscii(v)) {
    console.error(
      `[mpp32] MPP32_SOLANA_PRIVATE_KEY contains non-ASCII characters and will be ignored. ` +
        `Re-paste the base58 (or [byte,byte,...] array, or hex) key.`,
    );
    return undefined;
  }
  const looksValid =
    v.startsWith("[") ||
    /^[0-9a-fA-F]+$/.test(v) ||
    /^[1-9A-HJ-NP-Za-km-z]{43,90}$/.test(v); // base58
  if (!looksValid) {
    console.error(
      `[mpp32] ${describeEnvProblem("MPP32_SOLANA_PRIVATE_KEY", v, "base58 string, hex string, or [byte,byte,...] array")}`,
    );
  }
  return v;
})();

// Wrap fetch with a default timeout. AbortSignal.timeout exists in Node 20+,
// but we ship for Node 18+, so we build the signal ourselves.
async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Request to ${url} timed out after ${init?.timeoutMs ?? TIMEOUT_MS}ms. ` +
          `Set MPP32_TIMEOUT_MS in your MCP config to extend.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Lowercase all keys in a headers-like object. The backend may emit
// "Payment-Required" or "payment-required"; downstream code must not care.
function lowercaseHeaderKeys(obj: Record<string, string> | undefined): Record<string, string> {
  if (!obj) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) out[k.toLowerCase()] = v;
  return out;
}

interface FederatedService {
  slug: string;
  source: string;
  name: string;
  description: string | null;
  category: string | null;
  basePrice: number | null;
  effectivePrice: number | null;
  verified: boolean;
  popularity: number;
  protocols: string[];
  endpointUrl?: string | null;
  websiteUrl?: string | null;
  primaryProtocol?: string;
  network?: string | null;
  tags?: string[];
}

interface FederatedServicesResponse {
  data: {
    services: FederatedService[];
    total: number;
    counts: { native: number; external: number };
    protocols: string[];
  };
}

interface ExecuteResponse {
  data: {
    result: unknown;
    meta: {
      service: string;
      slug: string;
      sourceKind: "native" | "external";
      isFree: boolean;
      protocol: string;
      priceQuoted: number;
      priceSettled: number;
      discountPercent: number;
      paymentMethod: string | null;
      settled: boolean;
      settlementTxSignature: string | null;
      settlementExplorerUrl: string | null;
      latencyMs: number;
      statusCode: number;
      success: boolean;
    };
  };
  error?: { message: string; code: string; hint?: string; installCommand?: string };
}

const server = new McpServer({
  name: "mpp32",
  version: SERVER_VERSION,
});

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    headers[k] = safeHeaderValue(k, v);
  }
  if (AGENT_KEY) {
    headers["X-Agent-Key"] = safeHeaderValue("MPP32_AGENT_KEY", AGENT_KEY);
  }
  return headers;
}

function isHttpCallable(svc: FederatedService): boolean {
  if (svc.source === "native") return true;
  const url = svc.endpointUrl ?? "";
  if (!url) return false;
  if (url.startsWith("npx://") || url.startsWith("stdio://")) return false;
  return /^https?:\/\//.test(url);
}

// ── Tool 1: list_mpp32_services ─────────────────────────────────────────────

server.tool(
  "list_mpp32_services",
  "Browse the MPP32 federated catalog of machine-payable APIs and data services. Includes native MPP32 services (callable end-to-end through this MCP), the x402 Bazaar (USDC on Solana), curated free APIs (DexScreener, Jupiter, CoinGecko health, httpbin, etc.), and the public MCP Registry (npx-installable servers; listing-only). Each result indicates whether it is callable through `call_mpp32_endpoint` or listing-only. Use the `category`, `q`, or `source` filters to narrow down.",
  {
    category: z
      .string()
      .optional()
      .describe(
        "Filter by category slug (e.g. 'ai-inference', 'token-scanner', 'price-oracle', 'web-search', 'defi-analytics')."
      ),
    q: z
      .string()
      .optional()
      .describe("Free-text search across name, description, tags, and category."),
    source: z
      .enum(["native", "x402-bazaar", "mcp-registry", "curated", "free"])
      .optional()
      .describe(
        "Filter by catalog source. 'native' = callable end-to-end; 'curated'/'free' = often callable; 'x402-bazaar'/'mcp-registry' = mostly listing-only."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("Max results (default 100, max 500)."),
  },
  async ({ category, q, source, limit }) => {
    try {
      const url = new URL("/api/agent/services", API_URL);
      if (category) url.searchParams.set("category", category);
      if (q) url.searchParams.set("q", q);
      if (source) url.searchParams.set("source", source);
      url.searchParams.set("limit", String(limit ?? 100));

      const res = await fetchWithTimeout(url.toString(), { headers: buildHeaders() });
      if (!res.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching services: HTTP ${res.status} ${res.statusText}`,
            },
          ],
        };
      }

      const json = (await res.json()) as FederatedServicesResponse;
      const services = json.data.services ?? [];

      if (services.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No services matched. Filters: category=${category ?? "any"}, q=${q ?? "any"}, source=${source ?? "any"}.`,
            },
          ],
        };
      }

      const lines = services.map((s) => {
        const callable = isHttpCallable(s);
        const priceLabel =
          s.basePrice === null
            ? "Pay provider directly"
            : s.basePrice === 0
              ? "Free"
              : `$${s.basePrice} per query`;
        const protos = s.protocols?.length ? s.protocols.join(", ") : (s.primaryProtocol ?? "—");
        return [
          `## ${s.name}${s.verified ? " ✓" : ""}`,
          `- **Slug:** \`${s.slug}\``,
          `- **Source:** ${s.source}`,
          `- **Category:** ${s.category ?? "—"}`,
          `- **Price:** ${priceLabel}`,
          `- **Protocols:** ${protos}`,
          `- **Callable via this MCP:** ${callable ? "Yes — use `call_mpp32_endpoint`" : "No — listing only"}`,
          s.description ? `- **Description:** ${s.description}` : null,
          s.endpointUrl && !callable ? `- **Install / direct URL:** \`${s.endpointUrl}\`` : null,
          s.websiteUrl ? `- **Website:** ${s.websiteUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });

      const counts = json.data.counts;
      const callableCount = services.filter(isHttpCallable).length;
      const header = [
        `# MPP32 Federated Catalog — ${services.length} result${services.length !== 1 ? "s" : ""}`,
        ``,
        `**Sources:** ${counts.native} native + ${counts.external} external. **Callable through this MCP:** ${callableCount}.`,
        ``,
        AGENT_KEY
          ? `Calls through \`call_mpp32_endpoint\` are tracked in your dashboard at ${API_URL}/agent-console (your X-Agent-Key is set).`
          : `**Tip:** set \`MPP32_AGENT_KEY\` in your MCP config to track usage at ${API_URL}/agent-console. Get a key at ${API_URL}/agent-console.`,
        ``,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: header + "\n" + lines.join("\n\n") }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to fetch MPP32 services: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ── Tool 2: call_mpp32_endpoint ─────────────────────────────────────────────

server.tool(
  "call_mpp32_endpoint",
  "Call any HTTP-callable service in the MPP32 federated catalog. Free services return immediately. Paid services return a 402 challenge that this tool will sign and retry automatically when a payment key (MPP32_SOLANA_PRIVATE_KEY for x402/USDC, MPP32_PRIVATE_KEY for Tempo/pathUSD) is configured. Set MPP32_AGENT_KEY for dashboard tracking. Use `list_mpp32_services` first to find a slug. Listing-only entries (npx-installable MCP servers, x402 Bazaar non-mirrored items) cannot be called through this tool — install them directly per the catalog instructions.",
  {
    slug: z
      .string()
      .describe("Service slug from `list_mpp32_services` (e.g. 'mpp32-intelligence')."),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE"])
      .default("POST")
      .describe("HTTP method."),
    body: z
      .union([z.string(), z.record(z.unknown())])
      .optional()
      .describe("JSON body (object or stringified) for POST/PUT/DELETE."),
    query: z
      .record(z.string())
      .optional()
      .describe("URL query parameters as key-value pairs."),
  },
  async ({ slug, method, body, query }) => {
    // Normalize body to an object so it can be JSON.stringified by the upstream call
    let parsedBody: unknown = body;
    if (typeof body === "string") {
      try {
        parsedBody = body.length > 0 ? JSON.parse(body) : undefined;
      } catch {
        parsedBody = body;
      }
    }

    if (AGENT_KEY) {
      return await callViaAgentExecute(slug, method, parsedBody, query);
    }
    // Legacy path — only works for native services with payment keys
    return await callViaLegacyProxy(slug, method, parsedBody, query);
  },
);

// ── Tool 3: get_solana_token_intelligence ───────────────────────────────────

server.tool(
  "get_solana_token_intelligence",
  "Get real-time Solana token intelligence from the MPP32 Intelligence Oracle. Returns alpha score (0-100), rug risk assessment, whale activity, smart money signals, 24h pump probability, projected ROI ranges, and aggregated DexScreener/Jupiter/CoinGecko market data. Costs $0.008 per query, paid automatically via x402 (USDC on Solana) or Tempo (pathUSD on Eth L2). M32 token holders receive up to 40% discount once their wallet is signature-verified. Set MPP32_AGENT_KEY in config to attribute calls to your dashboard.",
  {
    token: z
      .string()
      .describe(
        "Solana token mint address or ticker symbol (e.g. SOL, BONK, JUP, M32, or full base58 address).",
      ),
    walletAddress: z
      .string()
      .optional()
      .describe(
        "Optional Solana wallet address. Used for M32-holder discount preview; discount only applies after SIWS wallet-signature verification.",
      ),
  },
  async ({ token, walletAddress }) => {
    if (AGENT_KEY) {
      // Route through /api/agent/execute so the call shows up in the user's dashboard.
      return await callViaAgentExecute(
        "intelligence",
        "POST",
        { token, ...(walletAddress ? { walletAddress } : {}) },
        undefined,
      );
    }
    // Legacy path — direct call to /api/intelligence with manual 402 handling.
    return await legacyIntelligenceCall(token, walletAddress);
  },
);

// ── Core: agent/execute path with 402 sign-and-retry ────────────────────────

async function callViaAgentExecute(
  service: string,
  method: string,
  body: unknown,
  query: Record<string, string> | undefined,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const execUrl = new URL("/api/agent/execute", API_URL).toString();
    const reqBody = JSON.stringify({
      service,
      method,
      ...(body !== undefined ? { body } : {}),
      ...(query ? { query } : {}),
    });

    // Round 1: no payment headers
    const firstRes = await fetchWithTimeout(execUrl, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: reqBody,
    });

    // Hard errors from /execute (auth, validation, not-callable)
    if (!firstRes.ok) {
      const errJson = (await firstRes.json().catch(() => null)) as ExecuteResponse | null;
      return formatExecuteHardError(firstRes.status, errJson);
    }

    const firstJson = (await firstRes.json()) as ExecuteResponse;

    // Wrapped 402 — sign and retry if we have keys
    const paymentRequired = detectPaymentRequired(firstJson);
    if (paymentRequired) {
      if (!PRIVATE_KEY && !SOLANA_PRIVATE_KEY) {
        return paymentKeyMissingMessage(firstJson, paymentRequired);
      }
      return await signAndRetry(execUrl, reqBody, paymentRequired);
    }

    // Free or otherwise-successful call
    return formatExecuteSuccess(firstJson);
  } catch (err) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Network error reaching ${API_URL}: ${err instanceof Error ? err.message : String(err)}. Check connectivity and that MPP32_API_URL (if set) is correct.`,
        },
      ],
    };
  }
}

interface PaymentChallenge {
  wwwAuthenticate?: string;
  paymentRequired?: string;
  rawHeaders: Record<string, string>;
  priceQuoted: number;
  serviceName: string;
}

function detectPaymentRequired(resp: ExecuteResponse): PaymentChallenge | null {
  const result = resp?.data?.result as
    | { error?: { code?: string; challenge?: { headers?: Record<string, string>; priceQuoted?: number } } }
    | undefined;
  if (!result?.error || result.error.code !== "PAYMENT_REQUIRED") return null;
  const headers = lowercaseHeaderKeys(result.error.challenge?.headers);
  return {
    wwwAuthenticate: headers["www-authenticate"],
    paymentRequired: headers["payment-required"],
    rawHeaders: headers,
    priceQuoted: result.error.challenge?.priceQuoted ?? resp.data.meta?.priceQuoted ?? 0,
    serviceName: resp.data.meta?.service ?? "service",
  };
}

async function signAndRetry(
  execUrl: string,
  reqBody: string,
  challenge: PaymentChallenge,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const paymentHeaders: Record<string, string> = {};
  let usedProtocol = "";

  // Prefer x402 if Solana key present and server offered Payment-Required
  if (challenge.paymentRequired && SOLANA_PRIVATE_KEY) {
    try {
      paymentHeaders["X-Payment"] = await completeX402Payment(
        challenge.paymentRequired,
        SOLANA_PRIVATE_KEY,
      );
      usedProtocol = "USDC (x402)";
    } catch (err) {
      // Fall through to Tempo if available
      if (challenge.wwwAuthenticate && PRIVATE_KEY) {
        const parsed = parseWwwAuthenticate(challenge.wwwAuthenticate);
        try {
          const token = await completeTempoPayment(parsed.params, PRIVATE_KEY);
          paymentHeaders["Authorization"] = `Payment ${token}`;
          usedProtocol = "pathUSD (Tempo)";
        } catch (tempoErr) {
          return paymentFailedMessage(challenge, "x402+tempo", `${err}; ${tempoErr}`);
        }
      } else {
        return paymentFailedMessage(challenge, "x402", err);
      }
    }
  } else if (challenge.wwwAuthenticate && PRIVATE_KEY) {
    const parsed = parseWwwAuthenticate(challenge.wwwAuthenticate);
    if (!parsed.scheme || !parsed.params) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Could not parse Tempo challenge. WWW-Authenticate: ${challenge.wwwAuthenticate}`,
          },
        ],
      };
    }
    try {
      const token = await completeTempoPayment(parsed.params, PRIVATE_KEY);
      paymentHeaders["Authorization"] = `Payment ${token}`;
      usedProtocol = "pathUSD (Tempo)";
    } catch (err) {
      return paymentFailedMessage(challenge, "tempo", err);
    }
  } else {
    const offered = [
      challenge.wwwAuthenticate ? "Tempo (pathUSD)" : null,
      challenge.paymentRequired ? "x402 (USDC)" : null,
    ]
      .filter(Boolean)
      .join(", ");
    const have = [PRIVATE_KEY ? "Tempo" : null, SOLANA_PRIVATE_KEY ? "x402" : null]
      .filter(Boolean)
      .join(", ") || "none";
    return {
      content: [
        {
          type: "text" as const,
          text: `No compatible payment method. Server offers: ${offered}. You have keys for: ${have}.`,
        },
      ],
    };
  }

  // Round 2: with payment headers
  const secondRes = await fetchWithTimeout(execUrl, {
    method: "POST",
    headers: buildHeaders({ "Content-Type": "application/json", ...paymentHeaders }),
    body: reqBody,
  });

  if (!secondRes.ok) {
    const errJson = (await secondRes.json().catch(() => null)) as ExecuteResponse | null;
    return formatExecuteHardError(secondRes.status, errJson);
  }
  const secondJson = (await secondRes.json()) as ExecuteResponse;
  return formatExecuteSuccess(secondJson, usedProtocol);
}

function formatExecuteSuccess(
  resp: ExecuteResponse,
  protoOverride?: string,
): { content: Array<{ type: "text"; text: string }> } {
  const meta = resp.data.meta;
  const result = resp.data.result;
  const formatted = (() => {
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  })();

  const lines: string[] = [];
  const safeStatus = meta?.statusCode ?? 0;
  const safeLatency = meta?.latencyMs ?? 0;
  lines.push(`**${meta?.service ?? "service"}** — HTTP ${safeStatus} (${safeLatency}ms)`);
  if (meta?.isFree) {
    lines.push(`Free service. No payment.`);
  } else if (meta?.settled) {
    const proto = protoOverride ?? meta.paymentMethod ?? "—";
    const txLine = meta.settlementTxSignature
      ? `Settlement tx: ${meta.settlementExplorerUrl ?? meta.settlementTxSignature}`
      : "Settled by upstream facilitator.";
    const settled = typeof meta.priceSettled === "number" ? meta.priceSettled.toFixed(6) : "—";
    lines.push(`Paid $${settled} via ${proto}. ${txLine}`);
    if ((meta.discountPercent ?? 0) > 0) {
      lines.push(`M32 holder discount applied: ${meta.discountPercent}%.`);
    }
  } else if (meta?.paymentMethod === "unsettled") {
    lines.push(`Service responded but no payment was verified. This should not happen for paid services.`);
  }
  lines.push("");
  lines.push("```json");
  lines.push(formatted);
  lines.push("```");

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function formatExecuteHardError(
  status: number,
  body: ExecuteResponse | null,
): { content: Array<{ type: "text"; text: string }> } {
  const code = body?.error?.code;
  if (code === "NOT_HTTP_CALLABLE") {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `**Not callable through HTTP.**`,
            ``,
            body?.error?.message ?? "This service is a stdio MCP server.",
            body?.error?.installCommand ? `\nInstall: \`${body.error.installCommand}\`` : "",
            body?.error?.hint ? `\nHint: ${body.error.hint}` : "",
          ].join("\n"),
        },
      ],
    };
  }
  if (code === "AUTH_REQUIRED" || status === 401) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `**Agent session is missing or invalid.**`,
            ``,
            `Set \`MPP32_AGENT_KEY\` in your MCP config (the value of \`apiKey\` from POST /api/agent/sessions).`,
            `Get one at ${API_URL}/agent-console.`,
            body?.error?.message ? `\nServer said: ${body.error.message}` : "",
          ].join("\n"),
        },
      ],
    };
  }
  if (code === "SERVICE_NOT_FOUND") {
    return {
      content: [
        {
          type: "text" as const,
          text: `Service not found. Use \`list_mpp32_services\` to discover valid slugs.`,
        },
      ],
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `MPP32 returned HTTP ${status}: ${body?.error?.message ?? "unknown error"}`,
      },
    ],
  };
}

function paymentKeyMissingMessage(
  resp: ExecuteResponse,
  challenge: PaymentChallenge,
): { content: Array<{ type: "text"; text: string }> } {
  const offered = [
    challenge.wwwAuthenticate ? "Tempo (pathUSD on Ethereum L2)" : null,
    challenge.paymentRequired ? "x402 (USDC on Solana)" : null,
  ]
    .filter(Boolean)
    .join(" or ");
  const price = challenge.priceQuoted ?? resp.data.meta.priceQuoted;
  return {
    content: [
      {
        type: "text" as const,
        text: [
          `**${resp.data.meta.service} requires payment** (~$${price}).`,
          ``,
          `The provider accepts: ${offered || "(unknown)"}.`,
          ``,
          `To enable automatic payment, add a private key to your MCP config:`,
          ``,
          "```json",
          "{",
          '  "mcpServers": {',
          '    "mpp32": {',
          '      "command": "npx",',
          '      "args": ["mpp32-mcp-server"],',
          '      "env": {',
          AGENT_KEY
            ? `        "MPP32_AGENT_KEY": "${AGENT_KEY.slice(0, 12).replace(/[^A-Za-z0-9_-]/g, "?")}…",`
            : "",
          '        "MPP32_SOLANA_PRIVATE_KEY": "<solana-base58-key for USDC>",',
          '        "MPP32_PRIVATE_KEY": "<EVM-hex-key for pathUSD>"',
          "      }",
          "    }",
          "  }",
          "}",
          "```",
          ``,
          `Free services (DexScreener, Jupiter price, CoinGecko ping, httpbin) work without any private key.`,
        ]
          .filter((l) => l !== "")
          .join("\n"),
      },
    ],
  };
}

function paymentFailedMessage(
  challenge: PaymentChallenge,
  proto: string,
  err: unknown,
): { content: Array<{ type: "text"; text: string }> } {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    content: [
      {
        type: "text" as const,
        text: [
          `**Payment failed (${proto})** for ${challenge.serviceName} ($${challenge.priceQuoted}).`,
          ``,
          msg,
          ``,
          `Common causes: insufficient balance, malformed key, or expired challenge nonce.`,
        ].join("\n"),
      },
    ],
  };
}

// ── Legacy path (no MPP32_AGENT_KEY) ────────────────────────────────────────

async function callViaLegacyProxy(
  slug: string,
  method: string,
  body: unknown,
  query: Record<string, string> | undefined,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
 try {
  // Without an agent key, only native /api/proxy/<slug> is reachable.
  // We fetch /info first to detect that the slug exists as a native service.
  const infoUrl = new URL(`/api/proxy/${encodeURIComponent(slug)}/info`, API_URL).toString();
  const infoRes = await fetchWithTimeout(infoUrl);
  if (!infoRes.ok) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Service "${slug}" is not a native MPP32 service.`,
            ``,
            `Without \`MPP32_AGENT_KEY\` set, only native services are callable. To call federated catalog entries (free curated APIs, x402 Bazaar mirrors, etc.), add \`MPP32_AGENT_KEY\` to your MCP config — get one at ${API_URL}/agent-console.`,
          ].join("\n"),
        },
      ],
    };
  }

  const info = (await infoRes.json()) as { data: { name: string; pricePerQuery: number } };
  const proxyUrl = new URL(`/api/proxy/${encodeURIComponent(slug)}`, API_URL);
  if (query) for (const [k, v] of Object.entries(query)) proxyUrl.searchParams.set(k, v);

  const baseHeaders: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) baseHeaders["Content-Type"] = "application/json";

  const challengeRes = await fetchWithTimeout(proxyUrl.toString(), {
    method,
    headers: baseHeaders,
    body: method !== "GET" && body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (challengeRes.status !== 402) {
    const text = await challengeRes.text();
    let formatted: string;
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      formatted = text;
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `**${info.data.name}** — HTTP ${challengeRes.status}\n\n\`\`\`json\n${formatted}\n\`\`\``,
        },
      ],
    };
  }

  // Got 402 — sign with available keys
  const wwwAuth = challengeRes.headers.get("www-authenticate") ?? undefined;
  const paymentRequired = challengeRes.headers.get("payment-required") ?? undefined;
  const challenge: PaymentChallenge = {
    wwwAuthenticate: wwwAuth,
    paymentRequired,
    rawHeaders: {},
    priceQuoted: info.data.pricePerQuery ?? 0,
    serviceName: info.data.name,
  };

  if (!PRIVATE_KEY && !SOLANA_PRIVATE_KEY) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `**${info.data.name}** requires payment ($${info.data.pricePerQuery}).`,
            ``,
            `Add a payment key to your MCP config (\`MPP32_SOLANA_PRIVATE_KEY\` for USDC or \`MPP32_PRIVATE_KEY\` for pathUSD), or set \`MPP32_AGENT_KEY\` to use the agent execute path.`,
          ].join("\n"),
        },
      ],
    };
  }

  const paymentHeaders: Record<string, string> = {};
  let usedProtocol = "";
  if (paymentRequired && SOLANA_PRIVATE_KEY) {
    try {
      paymentHeaders["X-Payment"] = await completeX402Payment(paymentRequired, SOLANA_PRIVATE_KEY);
      usedProtocol = "USDC (x402)";
    } catch (err) {
      if (wwwAuth && PRIVATE_KEY) {
        const parsed = parseWwwAuthenticate(wwwAuth);
        try {
          const token = await completeTempoPayment(parsed.params, PRIVATE_KEY);
          paymentHeaders["Authorization"] = `Payment ${token}`;
          usedProtocol = "pathUSD (Tempo)";
        } catch (te) {
          return paymentFailedMessage(challenge, "x402+tempo", `${err}; ${te}`);
        }
      } else {
        return paymentFailedMessage(challenge, "x402", err);
      }
    }
  } else if (wwwAuth && PRIVATE_KEY) {
    const parsed = parseWwwAuthenticate(wwwAuth);
    try {
      const token = await completeTempoPayment(parsed.params, PRIVATE_KEY);
      paymentHeaders["Authorization"] = `Payment ${token}`;
      usedProtocol = "pathUSD (Tempo)";
    } catch (err) {
      return paymentFailedMessage(challenge, "tempo", err);
    }
  } else {
    return {
      content: [
        {
          type: "text" as const,
          text: `No compatible payment method.`,
        },
      ],
    };
  }

  const paidRes = await fetchWithTimeout(proxyUrl.toString(), {
    method,
    headers: { ...baseHeaders, ...paymentHeaders },
    body: method !== "GET" && body !== undefined ? JSON.stringify(body) : undefined,
  });
  const paidText = await paidRes.text();
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(paidText), null, 2);
  } catch {
    formatted = paidText;
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `**${info.data.name}** — HTTP ${paidRes.status} (paid $${info.data.pricePerQuery} via ${usedProtocol})\n\n\`\`\`json\n${formatted}\n\`\`\``,
      },
    ],
  };
 } catch (err) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Network error reaching ${API_URL}: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
  };
 }
}

async function legacyIntelligenceCall(
  token: string,
  walletAddress: string | undefined,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
 try {
  const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (walletAddress) {
    const trimmed = walletAddress.trim();
    if (!isPrintableAscii(trimmed)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `walletAddress contains non-ASCII characters. Pass a Solana base58 address only.`,
          },
        ],
      };
    }
    reqHeaders["X-Wallet-Address"] = trimmed;
  }

  const res = await fetchWithTimeout(`${API_URL}/api/intelligence`, {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify({ token }),
  });

  if (res.status !== 402) {
    const text = await res.text();
    let formatted: string;
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      formatted = text;
    }
    if (res.ok) {
      return {
        content: [
          {
            type: "text" as const,
            text: `**Solana Token Intelligence** — \`${token}\`\n\n\`\`\`json\n${formatted}\n\`\`\``,
          },
        ],
      };
    }
    return {
      content: [{ type: "text" as const, text: `Error: HTTP ${res.status}\n\n${formatted}` }],
    };
  }

  if (!PRIVATE_KEY && !SOLANA_PRIVATE_KEY) {
    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Intelligence Oracle requires payment ($0.008 per query).",
            "",
            "Set `MPP32_AGENT_KEY` (recommended — also gives dashboard tracking) and/or `MPP32_SOLANA_PRIVATE_KEY` / `MPP32_PRIVATE_KEY` in your MCP config.",
            "",
            `Create a session at ${API_URL}/agent-console.`,
          ].join("\n"),
        },
      ],
    };
  }

  const wwwAuth = res.headers.get("www-authenticate") ?? undefined;
  const paymentRequired = res.headers.get("payment-required") ?? undefined;
  const paymentHeaders: Record<string, string> = {};
  let usedProtocol = "";

  if (paymentRequired && SOLANA_PRIVATE_KEY) {
    try {
      paymentHeaders["X-Payment"] = await completeX402Payment(paymentRequired, SOLANA_PRIVATE_KEY);
      usedProtocol = "USDC (x402)";
    } catch (x402Err) {
      if (wwwAuth && PRIVATE_KEY) {
        try {
          const parsed = parseWwwAuthenticate(wwwAuth);
          const tempoToken = await completeTempoPayment(parsed.params, PRIVATE_KEY);
          paymentHeaders["Authorization"] = `Payment ${tempoToken}`;
          usedProtocol = "pathUSD (Tempo)";
        } catch (tempoErr) {
          return {
            content: [
              { type: "text" as const, text: `Payment failed (x402: ${x402Err instanceof Error ? x402Err.message : String(x402Err)}; tempo: ${tempoErr instanceof Error ? tempoErr.message : String(tempoErr)}). Check wallet balance and key format.` },
            ],
          };
        }
      } else {
        return {
          content: [
            { type: "text" as const, text: `x402 payment failed: ${x402Err instanceof Error ? x402Err.message : String(x402Err)}. Check Solana wallet balance.` },
          ],
        };
      }
    }
  } else if (wwwAuth && PRIVATE_KEY) {
    try {
      const parsed = parseWwwAuthenticate(wwwAuth);
      const tempoToken = await completeTempoPayment(parsed.params, PRIVATE_KEY);
      paymentHeaders["Authorization"] = `Payment ${tempoToken}`;
      usedProtocol = "pathUSD (Tempo)";
    } catch (tempoErr) {
      return {
        content: [
          { type: "text" as const, text: `Tempo payment failed: ${tempoErr instanceof Error ? tempoErr.message : String(tempoErr)}` },
        ],
      };
    }
  }

  const paidRes = await fetchWithTimeout(`${API_URL}/api/intelligence`, {
    method: "POST",
    headers: { ...reqHeaders, ...paymentHeaders },
    body: JSON.stringify({ token }),
  });
  const paidText = await paidRes.text();
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(paidText), null, 2);
  } catch {
    formatted = paidText;
  }
  const discount = paidRes.headers.get("X-M32-Discount");
  const discountNote = discount && discount !== "0" ? ` (${discount}% M32 discount)` : "";
  return {
    content: [
      {
        type: "text" as const,
        text: `**Solana Token Intelligence** — \`${token}\` via ${usedProtocol}${discountNote}\n\n\`\`\`json\n${formatted}\n\`\`\``,
      },
    ],
  };
 } catch (err) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Network error reaching ${API_URL}: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
  };
 }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ChallengeParams {
  scheme: string | null;
  params: Record<string, string>;
}

function parseWwwAuthenticate(header: string): ChallengeParams {
  const match = header.match(/^(\w+)\s+(.+)$/);
  if (!match) return { scheme: null, params: {} };
  const scheme = match[1] ?? null;
  const rest = match[2] ?? "";
  const params: Record<string, string> = {};
  // Tokens per RFC 7235: quoted-string OR a token68-ish value covering all
  // base64url, base58, hex, JSON-pointers, etc. Liberal on purpose so we do
  // not silently drop valid challenges.
  const paramRegex = /([A-Za-z0-9_-]+)=(?:"((?:[^"\\]|\\.)*)"|([^\s,]+))/g;
  let m: RegExpExecArray | null;
  while ((m = paramRegex.exec(rest)) !== null) {
    const key = m[1];
    const val = m[2] ?? m[3];
    if (key && val !== undefined) params[key] = val;
  }
  return { scheme, params };
}

async function completeTempoPayment(
  challengeParams: Record<string, string>,
  privateKey: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mppxClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let viemAccounts: any;
  try {
    const mppxPkg = "mppx/client";
    const viemPkg = "viem/accounts";
    mppxClient = await import(mppxPkg);
    viemAccounts = await import(viemPkg);
  } catch {
    throw new Error(
      "Tempo payment client not available. Install: npm install mppx viem",
    );
  }
  try {
    const account = viemAccounts.privateKeyToAccount(
      privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
    );
    const client = mppxClient.Mppx.create({
      methods: [mppxClient.tempo({ account })],
    });
    return (await client.pay(challengeParams)) as string;
  } catch (payErr) {
    throw new Error(
      `Tempo payment failed: ${payErr instanceof Error ? payErr.message : String(payErr)}`,
    );
  }
}

async function completeX402Payment(
  paymentRequiredHeader: string,
  solanaPrivateKey: string,
): Promise<string> {
  let requirements: Record<string, unknown>;
  try {
    requirements = JSON.parse(
      Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"),
    );
  } catch {
    throw new Error("Could not decode Payment-Required header");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let solanaWeb3: any;
  try {
    const pkg = "@solana/web3.js";
    solanaWeb3 = await import(pkg);
  } catch {
    throw new Error("x402 payment requires @solana/web3.js: npm install @solana/web3.js");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let keypair: any;
  try {
    if (solanaPrivateKey.startsWith("[")) {
      keypair = solanaWeb3.Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(solanaPrivateKey)),
      );
    } else if (/^[0-9a-fA-F]+$/.test(solanaPrivateKey) && solanaPrivateKey.length % 2 === 0) {
      keypair = solanaWeb3.Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(solanaPrivateKey, "hex")),
      );
    } else {
      const bs58Pkg = "bs58";
      const bs58 = await import(bs58Pkg);
      keypair = solanaWeb3.Keypair.fromSecretKey(bs58.default.decode(solanaPrivateKey));
    }
  } catch (err) {
    throw new Error(
      `Could not decode Solana private key: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const payload = {
    x402Version: 1,
    scheme: (requirements.scheme as string) ?? "exact",
    network:
      (requirements.network as string) ?? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    payload: {
      signature: "",
      from: keypair.publicKey.toBase58(),
      amount: requirements.maxAmountRequired,
      asset: requirements.asset,
      payTo: requirements.payTo,
      nonce: Date.now().toString(),
    },
  };

  const message = JSON.stringify(payload.payload);
  const messageBytes = new TextEncoder().encode(message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tweetnacl: any;
  try {
    const pkg = "tweetnacl";
    tweetnacl = await import(pkg);
  } catch {
    throw new Error("x402 signing requires tweetnacl: npm install tweetnacl");
  }
  const naclSign = tweetnacl.default?.sign ?? tweetnacl.sign;
  const signed = naclSign.detached(messageBytes, keypair.secretKey);
  payload.payload.signature = Buffer.from(signed).toString("base64");

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// ── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const features = [
    AGENT_KEY ? "agent-key" : null,
    SOLANA_PRIVATE_KEY ? "x402-key" : null,
    PRIVATE_KEY ? "tempo-key" : null,
  ]
    .filter(Boolean)
    .join(", ") || "no keys (catalog-only legacy mode)";
  console.error(
    `[mpp32] MCP server v${SERVER_VERSION} on stdio. API ${API_URL}. Configured: ${features}. Timeout ${TIMEOUT_MS}ms.`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
