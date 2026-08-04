#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { signX402Payment } from "./x402-signers.js";

const SERVER_VERSION = "1.8.0";

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

// Optional override: when both an EVM and a Solana key are configured, this
// decides which network to use for mixed challenges. Accepts:
//   "solana" (or any "solana:*" CAIP-2), "base", "evm", "ethereum".
// Defaults to undefined — pickRequirements then falls back to its own rules.
const PREFERRED_NETWORK: string | undefined = (() => {
  const v = readEnv("MPP32_PREFERRED_NETWORK");
  if (!v) return undefined;
  const lower = v.toLowerCase();
  const allowed = ["solana", "base", "evm", "ethereum"];
  if (!allowed.some((a) => lower === a || lower.startsWith(a))) {
    console.error(
      `[mpp32] MPP32_PREFERRED_NETWORK="${v}" not recognized. Allowed: ${allowed.join(", ")} (or full CAIP-2 like solana:5eykt...). Ignoring.`,
    );
    return undefined;
  }
  return lower;
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
  // Server-authoritative callability. When present, this reflects whether the
  // service can actually be reached through call_mpp32_endpoint right now
  // (e.g. native services pending endpoint verification are NOT callable, even
  // though they are "native"). Falls back to the URL heuristic when absent.
  callable?: boolean;
  callableReason?: string | null;
  note?: string | null;
  m32Required?: number;
}

interface FederatedServicesResponse {
  data: {
    services: FederatedService[];
    total: number;
    counts: { native: number; external: number };
    totalAvailable?: { native: number; external: number; combined: number };
    limit?: number;
    truncated?: boolean;
    hint?: string;
    protocols: string[];
  };
}

interface RouteIntentResponse {
  data: {
    intent: string;
    keywordsExtracted: string[];
    totalConsidered: number;
    candidates: Array<{
      slug: string;
      source: string;
      name: string;
      description: string | null;
      category: string | null;
      price: number | null;
      verified: boolean;
      healthStatus: string;
      callable: boolean;
      callableReason: string | null;
      protocols: string[];
      matchedKeywords: string[];
      overBudget: boolean;
      score: number;
    }>;
    hint: string;
  };
  error?: { message: string; code: string };
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
      budget?: {
        budgetLimitUsd: number | null;
        velocityLimitUsd: number | null;
        totalSpentUsd: number;
        remainingBudgetUsd: number | null;
        hourlySpendUsd: number;
        budgetUtilizationPercent: number | null;
      } | null;
    };
  };
  error?: { message: string; code: string; hint?: string; installCommand?: string; budgetStatus?: Record<string, unknown> };
}

const server = new McpServer({
  name: "mpp32",
  version: SERVER_VERSION,
});

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    // Identifies this surface to the backend's usage tracking so MCP traffic
    // can be measured separately from web/SDK/direct-API traffic.
    "X-MPP32-Client": `mcp-server/${SERVER_VERSION}`,
  };
  for (const [k, v] of Object.entries(extra)) {
    headers[k] = safeHeaderValue(k, v);
  }
  if (AGENT_KEY) {
    headers["X-Agent-Key"] = safeHeaderValue("MPP32_AGENT_KEY", AGENT_KEY);
  }
  return headers;
}

function isHttpCallable(svc: FederatedService): boolean {
  // Prefer the server's authoritative `callable` flag when provided. The server
  // knows things the URL cannot tell us — e.g. a native service that hasn't
  // completed endpoint verification (the proxy will 403 it) or an M32
  // token-gated service that needs an on-chain balance proof.
  if (typeof svc.callable === "boolean") return svc.callable;
  if (svc.source === "native") return true;
  const url = svc.endpointUrl ?? "";
  if (!url) return false;
  if (url.startsWith("npx://") || url.startsWith("stdio://")) return false;
  return /^https?:\/\//.test(url);
}

// Human-readable explanation for why a service is not callable through this MCP.
function notCallableLabel(svc: FederatedService): string {
  switch (svc.callableReason) {
    case "pending_verification":
      return "No — provider hasn't completed endpoint verification yet";
    case "m32_token_gated":
      return svc.m32Required
        ? `Token-gated — hold ${svc.m32Required.toLocaleString()}+ M32 and use the dedicated tool`
        : "Token-gated — requires M32 holdings via the dedicated tool";
    case "listing_only":
      return "No — listing only";
    default:
      return "No — listing only";
  }
}

// ── Tool 0: get_mpp32_diagnostics ───────────────────────────────────────────
// Lets the user (and Claude) see exactly what the MCP process detected at
// startup. The single most common failure mode is "I set the env var but it
// didn't reach the server" — wrong claude_desktop_config.json file edited,
// `env` block at the wrong level, typo in the variable name, stale process
// from an incomplete restart. This tool answers all of those without
// asking the user to dig through MCP log files.

function describeEnvVarStatus(name: string, value: string | undefined): string {
  const raw = process.env[name];
  if (raw === undefined) return `${name}: NOT SET (variable absent from MCP process env)`;
  if (raw.length === 0) return `${name}: EMPTY (set but blank)`;
  if (value === undefined) {
    return `${name}: REJECTED (raw length ${raw.length}, but failed validation — check startup log for reason)`;
  }
  // Show a short, non-secret fingerprint so the user can confirm it's the
  // right value without us exfiltrating the key.
  const fingerprint =
    value.length <= 12
      ? `${value.length} chars`
      : `${value.slice(0, 6)}…${value.slice(-4)} (${value.length} chars)`;
  return `${name}: SET (${fingerprint})`;
}

server.tool(
  "get_mpp32_diagnostics",
  "Report what the mpp32-mcp-server detected at startup: version, API URL, env vars (MPP32_AGENT_KEY, MPP32_SOLANA_PRIVATE_KEY, MPP32_PRIVATE_KEY, MPP32_PREFERRED_NETWORK), and a live API connectivity check. Use this FIRST if payments fail with 'no key configured' even though you set one in claude_desktop_config.json.",
  {},
  async () => {
    // Live connectivity probe so the user knows whether the *backend* is
    // reachable too — not just whether their env loaded.
    let apiReachable: string;
    try {
      const probe = await fetchWithTimeout(`${API_URL}/api/agent/protocols`, {
        timeoutMs: 5_000,
      });
      apiReachable = probe.ok
        ? `OK (${probe.status})`
        : `Reachable but returned ${probe.status}`;
    } catch (err) {
      apiReachable = `UNREACHABLE: ${err instanceof Error ? err.message : String(err)}`;
    }

    const haveAnyKey = !!(SOLANA_PRIVATE_KEY || PRIVATE_KEY);
    const readyToPay = !!AGENT_KEY && haveAnyKey;

    const lines = [
      `**mpp32-mcp-server diagnostics**`,
      ``,
      `Version: ${SERVER_VERSION}`,
      `API URL: ${API_URL}`,
      `API reachable: ${apiReachable}`,
      `Timeout: ${TIMEOUT_MS}ms`,
      `Node: ${process.version} on ${process.platform}/${process.arch}`,
      ``,
      `**Environment variable detection** (values are fingerprinted, never returned in full):`,
      ``,
      describeEnvVarStatus("MPP32_AGENT_KEY", AGENT_KEY),
      describeEnvVarStatus("MPP32_SOLANA_PRIVATE_KEY", SOLANA_PRIVATE_KEY),
      describeEnvVarStatus("MPP32_PRIVATE_KEY", PRIVATE_KEY),
      `MPP32_PREFERRED_NETWORK: ${PREFERRED_NETWORK ?? "not set (auto: prefer the only key you have)"}`,
      ``,
      `**Capabilities:**`,
      `- Catalog browsing: yes (always available)`,
      `- Federated service execution: ${AGENT_KEY ? "yes" : "no — set MPP32_AGENT_KEY"}`,
      `- x402 (USDC on Solana) payment: ${SOLANA_PRIVATE_KEY ? "yes" : "no — set MPP32_SOLANA_PRIVATE_KEY"}`,
      `- x402 (USDC on Base/EVM) payment: ${PRIVATE_KEY ? "yes" : "no — set MPP32_PRIVATE_KEY"}`,
      `- M32 holder pricing (SIWS verified): ${siwsVerifiedAddress ? `yes — ${siwsTier} tier, ${siwsDiscountPercent}% off every paid query` : (AGENT_KEY && SOLANA_PRIVATE_KEY ? "pending — auto verification runs once at startup" : "no — set MPP32_AGENT_KEY + MPP32_SOLANA_PRIVATE_KEY")}`,
      ``,
      `**Ready to use:** ${AGENT_KEY ? "YES — you have 10 FREE Intelligence Oracle calls/day. Try `get_solana_token_intelligence` with token=\"M32\" now." : "SET MPP32_AGENT_KEY to get 10 FREE calls/day. Get one at " + API_URL + "/agent-console."}`,
      `**Ready to pay (after free tier):** ${readyToPay ? "YES — x402 signing configured." : "NO — set MPP32_SOLANA_PRIVATE_KEY (or MPP32_PRIVATE_KEY for EVM) to pay after free tier exhausted."}`,
      ``,
      `**If a variable shows NOT SET but you set it in claude_desktop_config.json:**`,
      `1. Confirm the file path Claude Desktop actually reads:`,
      `   - macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json`,
      `   - Windows: %APPDATA%\\Claude\\claude_desktop_config.json`,
      `2. The 'env' block must sit INSIDE the server entry, beside 'command' and 'args' — not at the top level.`,
      `3. Validate the JSON: a single missing comma silently throws the whole file out.`,
      `4. Fully quit Claude Desktop:`,
      `   - macOS: Cmd+Q (or Claude menu → Quit)`,
      `   - Windows: right-click the system-tray icon → Quit (closing the window is NOT enough)`,
      `5. Re-open Claude Desktop. The new MCP child process inherits env from the JSON.`,
      `6. Call get_mpp32_diagnostics again. If it STILL shows NOT SET, the JSON did not load — check the Claude Desktop log for a parse error.`,
      ``,
      `**On Windows specifically:** the value must NOT include surrounding quotes inside the JSON string. Bad: "\\"mpp32_agent_abc...\\"". Good: "mpp32_agent_abc...".`,
    ];
    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

// Back-compat alias. Older docs and skills say `debug_mpp32`.
server.tool(
  "debug_mpp32",
  "Alias for get_mpp32_diagnostics. Reports env-var detection, API connectivity, and ready-to-pay status.",
  {},
  async () => {
    let apiReachable: string;
    try {
      const probe = await fetchWithTimeout(`${API_URL}/api/agent/protocols`, { timeoutMs: 5_000 });
      apiReachable = probe.ok ? `OK (${probe.status})` : `Reachable but returned ${probe.status}`;
    } catch (err) {
      apiReachable = `UNREACHABLE: ${err instanceof Error ? err.message : String(err)}`;
    }
    const readyToPay = !!AGENT_KEY && !!(SOLANA_PRIVATE_KEY || PRIVATE_KEY);
    const lines = [
      `mpp32-mcp-server v${SERVER_VERSION} (${process.platform}/${process.arch}, Node ${process.version})`,
      `API: ${API_URL} — ${apiReachable}`,
      describeEnvVarStatus("MPP32_AGENT_KEY", AGENT_KEY),
      describeEnvVarStatus("MPP32_SOLANA_PRIVATE_KEY", SOLANA_PRIVATE_KEY),
      describeEnvVarStatus("MPP32_PRIVATE_KEY", PRIVATE_KEY),
      `MPP32_PREFERRED_NETWORK: ${PREFERRED_NETWORK ?? "not set"}`,
      `Ready to pay: ${readyToPay ? "YES" : "NO"}`,
    ];
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
);

// ── Tool 1: list_mpp32_services ─────────────────────────────────────────────

server.tool(
  "list_mpp32_services",
  "Browse the MPP32 federated catalog of 4,500+ machine-payable APIs and data services. Includes native MPP32 services (callable end-to-end through this MCP), the x402 Bazaar (USDC on Solana), curated free APIs (DexScreener, Jupiter, CoinGecko health, httpbin, etc.), and the public MCP Registry (npx-installable servers; listing-only). Each result indicates whether it is callable through `call_mpp32_endpoint` or listing-only. The catalog is large (~4,500 entries) — by default a single call returns up to 100 results and the response will tell you the true total and whether the page was truncated. Use `q` (free-text search), `category`, `source`, or `protocol` to narrow down, or raise `limit` (max 500) for broader pages.",
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
    protocol: z
      .enum(["x402", "tempo", "acp", "ap2", "agtp"])
      .optional()
      .describe("Filter by payment protocol (e.g. 'x402' for USDC-settled services)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe("Max results (default 100, max 500)."),
  },
  async ({ category, q, source, protocol, limit }) => {
    try {
      const url = new URL("/api/agent/services", API_URL);
      if (category) url.searchParams.set("category", category);
      if (q) url.searchParams.set("q", q);
      if (source) url.searchParams.set("source", source);
      if (protocol) url.searchParams.set("protocol", protocol);
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
          `- **Callable via this MCP:** ${callable ? "Yes — use `call_mpp32_endpoint`" : notCallableLabel(s)}`,
          s.description ? `- **Description:** ${s.description}` : null,
          s.endpointUrl && !callable ? `- **Install / direct URL:** \`${s.endpointUrl}\`` : null,
          s.websiteUrl ? `- **Website:** ${s.websiteUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });

      const counts = json.data.counts;
      const totalAvailable = json.data.totalAvailable;
      const callableCount = services.filter(isHttpCallable).length;
      const sourcesLine = totalAvailable
        ? `**Sources:** ${counts.native} native + ${counts.external} external (of ${totalAvailable.combined} total available in catalog). **Callable through this MCP:** ${callableCount}.`
        : `**Sources:** ${counts.native} native + ${counts.external} external. **Callable through this MCP:** ${callableCount}.`;
      const header = [
        `# MPP32 Federated Catalog — ${services.length} result${services.length !== 1 ? "s" : ""}`,
        ``,
        sourcesLine,
        json.data.truncated && json.data.hint ? `\n> ⚠️ ${json.data.hint}` : ``,
        ``,
        AGENT_KEY
          ? `Calls through \`call_mpp32_endpoint\` are tracked in your dashboard at ${API_URL}/agent-console (your X-Agent-Key is set).`
          : `**Tip:** set \`MPP32_AGENT_KEY\` in your MCP config to track usage at ${API_URL}/agent-console. Get a key at ${API_URL}/agent-console.`,
        ``,
      ]
        .filter((l) => l !== ``)
        .join("\n");

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

server.tool(
  "find_mpp32_service",
  "Describe what you need in plain language instead of browsing the 4,500+ entry catalog yourself. Returns a ranked shortlist — ranked by keyword relevance, catalog health status (broken listings are excluded automatically), verification, and whether the price actually fits your stated budget. Use this before `list_mpp32_services` when you have a task in mind ('check if this wallet is a rug', 'generate a product image', 'get real-time SOL price') rather than a category to browse. The top result's slug is ready to pass straight to `call_mpp32_endpoint`.",
  {
    intent: z
      .string()
      .min(3)
      .describe("What you're trying to do, in plain language, e.g. 'check if this wallet is a rug pull risk'."),
    budgetUsd: z
      .number()
      .nonnegative()
      .optional()
      .describe("Max price per call you're willing to pay. Candidates over budget are demoted or excluded."),
    category: z
      .string()
      .optional()
      .describe("Optionally narrow to a known category slug (e.g. 'token-intelligence', 'image-generation')."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Max candidates to return (default 5, max 20)."),
  },
  async ({ intent, budgetUsd, category, limit }) => {
    try {
      const url = new URL("/api/agent/route", API_URL);
      url.searchParams.set("intent", intent);
      if (budgetUsd !== undefined) url.searchParams.set("maxPrice", String(budgetUsd));
      if (category) url.searchParams.set("category", category);
      url.searchParams.set("limit", String(limit ?? 5));

      const res = await fetchWithTimeout(url.toString(), { headers: buildHeaders() });
      const json = (await res.json()) as RouteIntentResponse;
      if (!res.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error routing intent: HTTP ${res.status} ${json.error?.message ?? res.statusText}`,
            },
          ],
        };
      }

      const { candidates, keywordsExtracted, totalConsidered, hint } = json.data;
      if (candidates.length === 0) {
        return { content: [{ type: "text" as const, text: hint }] };
      }

      const lines = candidates.map((cand, i) => {
        const priceLabel = cand.price === null ? "Pay provider directly" : cand.price === 0 ? "Free" : `$${cand.price} per query`;
        return [
          `## ${i + 1}. ${cand.name}${cand.verified ? " ✓" : ""} — score ${cand.score.toFixed(1)}`,
          `- **Slug:** \`${cand.slug}\``,
          `- **Source:** ${cand.source} | **Health:** ${cand.healthStatus}${cand.overBudget ? " ⚠️ over budget" : ""}`,
          `- **Price:** ${priceLabel}`,
          `- **Matched on:** ${cand.matchedKeywords.length > 0 ? cand.matchedKeywords.join(", ") : "(no keyword match — ranked by health/verification/popularity only)"}`,
          `- **Callable via this MCP:** ${cand.callable ? "Yes — use `call_mpp32_endpoint`" : (cand.callableReason ?? "listing only")}`,
          cand.description ? `- **Description:** ${cand.description}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });

      const header = [
        `# Intent: "${intent}" — ${candidates.length} ranked match${candidates.length !== 1 ? "es" : ""} (of ${totalConsidered} considered)`,
        keywordsExtracted.length > 0 ? `**Keywords used:** ${keywordsExtracted.join(", ")}` : `**No keywords extracted from intent — ranked by health/verification/popularity only.**`,
        ``,
        `> ${hint}`,
        ``,
      ].join("\n");

      return { content: [{ type: "text" as const, text: header + "\n" + lines.join("\n\n") }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to route intent: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ── Tool 2: call_mpp32_endpoint ─────────────────────────────────────────────

server.tool(
  "call_mpp32_endpoint",
  "Call any HTTP-callable service in the MPP32 federated catalog. Free services return immediately. Paid services return a 402 challenge that this tool will sign and retry automatically when a payment key (MPP32_SOLANA_PRIVATE_KEY for x402-on-Solana, MPP32_PRIVATE_KEY for x402-on-Base/Ethereum and Tempo pathUSD) is configured. Set MPP32_AGENT_KEY for dashboard tracking. Use `list_mpp32_services` first to find a slug. Many catalog entries store only the upstream BASE URL (e.g. `https://api.exa.ai`) — pass the upstream path (e.g. `/search`) via the `path` argument when calling those. Listing-only entries (npx-installable MCP servers, etc.) cannot be called through this tool.",
  {
    slug: z
      .string()
      .describe("Service slug from `list_mpp32_services` (e.g. 'curated:exa', 'mpp32-intelligence')."),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE"])
      .default("POST")
      .describe("HTTP method."),
    path: z
      .string()
      .optional()
      .describe(
        "Upstream path appended to the service's base URL (e.g. '/search' for Exa, '/v1/chat/completions' for OpenAI). Leave empty for catalog entries that already store a full path, or for native MPP32 services. Always begins with '/'.",
      ),
    body: z
      .union([z.string(), z.record(z.unknown())])
      .optional()
      .describe("JSON body (object or stringified) for POST/PUT/DELETE."),
    query: z
      .record(z.string())
      .optional()
      .describe("URL query parameters as key-value pairs."),
  },
  async ({ slug, method, path, body, query }) => {
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
      return await callViaAgentExecute(slug, method, parsedBody, query, path);
    }
    // Legacy path — only works for native services with payment keys
    return await callViaLegacyProxy(slug, method, parsedBody, query, path);
  },
);

// ── Tool 3: get_solana_token_intelligence ───────────────────────────────────

server.tool(
  "get_solana_token_intelligence",
  "Get real-time Solana token intelligence from the MPP32 Intelligence Oracle. Returns alpha score (0-100), rug risk assessment, whale activity, smart money signals, 24h pump probability, projected ROI ranges, and aggregated DexScreener/Jupiter/CoinGecko market data. **FREE TIER: Every agent session gets 10 free calls per day — no wallet, no USDC, no payment setup required.** Just set MPP32_AGENT_KEY. After free tier: $0.008/query paid via x402 (USDC on Solana). M32 token holders receive up to 40% discount.",
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

// ── Tool 3b: Free Intelligence Demo ────────────────────────────────────────
// No payment, no key. Hits /api/intelligence/demo, which is rate-limited per
// IP. Intended as the first call new users (and Claude itself) make when
// trying MPP32 — they see real alpha scores and signals BEFORE encountering
// any payment wall. This is the conversion funnel fix: agents today bounce
// off the 402, so we let them taste the product first.

server.tool(
  "try_solana_token_intelligence_free",
  "FREE preview of the MPP32 Intelligence Oracle — quick anonymous test, no keys required. Rate-limited to 10 calls/minute per IP. Returns the same payload as the paid endpoint. **Better option: get an MPP32_AGENT_KEY from mpp32.org/agent-console and call `get_solana_token_intelligence` instead — you get 10 FREE attributed calls per day, plus dashboard tracking, before any payment is needed.**",
  {
    token: z
      .string()
      .describe(
        "Solana token mint address or ticker symbol (e.g. SOL, BONK, JUP, M32, or full base58 address).",
      ),
  },
  async ({ token }: { token: string }) => {
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/intelligence/demo`, {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ token }),
      });
      const text = await res.text();
      let formatted: string;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { formatted = text; }
      if (res.status === 429) {
        return {
          content: [{
            type: "text" as const,
            text: `Demo rate limit reached (10 calls/minute per IP). **Better option:** Get a free agent key at ${API_URL}/agent-console → 10 FREE attributed calls/day with dashboard tracking, no payment setup required. After free tier, $0.008/query.`,
          }],
        };
      }
      if (!res.ok) {
        return {
          content: [{
            type: "text" as const,
            text: `Demo returned HTTP ${res.status}:\n\n\`\`\`json\n${formatted}\n\`\`\``,
          }],
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: `**MPP32 Intelligence Oracle (FREE DEMO)** — \`${token}\`\n\n${formatted}\n\n---\n_Demo result. Same payload as the paid endpoint. Rate-limited to 10/min/IP. For unlimited usage and dashboard attribution, set MPP32_AGENT_KEY (get one at ${API_URL}/agent-console) and use \`get_solana_token_intelligence\`._`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Network error reaching ${API_URL}: ${err instanceof Error ? err.message : String(err)}`,
        }],
      };
    }
  },
);

// ── Tool 4: M32-gated Whale Tracker ───────────────────────────────────────

server.tool(
  "get_m32_whale_tracker",
  "M32-gated whale analysis for any Solana token. Returns top 20 holders, concentration risk, holder distribution, and buy/sell pressure. Requires the caller to hold 1,000,000+ M32 tokens (balance verified on-chain via X-Wallet-Address header). Free for qualifying holders — no payment required. Returns 403 if the wallet holds insufficient M32.",
  {
    token: z
      .string()
      .describe("Solana token mint address to analyze for whale activity."),
    walletAddress: z
      .string()
      .describe("Your Solana wallet address. M32 balance is checked on-chain to verify you hold 1M+ M32."),
  },
  async ({ token, walletAddress }: { token: string; walletAddress: string }) => {
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/m32/whale-tracker`, {
        method: "POST",
        headers: buildHeaders({
          "Content-Type": "application/json",
          "X-Wallet-Address": safeHeaderValue("walletAddress", walletAddress),
        }),
        body: JSON.stringify({ token }),
      });
      const text = await res.text();
      let formatted: string;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { formatted = text; }
      if (res.status === 403) {
        return { content: [{ type: "text" as const, text: `**Access denied.** Whale Tracker requires holding 1,000,000+ M32 tokens. Your wallet does not meet the threshold.\n\nBuy M32: https://raydium.io/swap/?inputMint=sol&outputMint=6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump` }] };
      }
      return { content: [{ type: "text" as const, text: `**Whale Tracker** — \`${token}\`\n\n\`\`\`json\n${formatted}\n\`\`\`` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  },
);

// ── Tool 5: M32-gated Token Comparison ────────────────────────────────────

server.tool(
  "compare_tokens_m32",
  "M32-gated head-to-head intelligence comparison of two Solana tokens. Returns side-by-side alpha scores, rug risk, whale activity, volume, liquidity, market data, and a winner verdict. Requires the caller to hold 2,500,000+ M32 tokens (balance verified on-chain via X-Wallet-Address header). Free for qualifying holders. Returns 403 if insufficient M32.",
  {
    tokenA: z
      .string()
      .describe("First Solana token mint address."),
    tokenB: z
      .string()
      .describe("Second Solana token mint address."),
    walletAddress: z
      .string()
      .describe("Your Solana wallet address. M32 balance is checked on-chain to verify you hold 2.5M+ M32."),
  },
  async ({ tokenA, tokenB, walletAddress }: { tokenA: string; tokenB: string; walletAddress: string }) => {
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/m32/compare`, {
        method: "POST",
        headers: buildHeaders({
          "Content-Type": "application/json",
          "X-Wallet-Address": safeHeaderValue("walletAddress", walletAddress),
        }),
        body: JSON.stringify({ tokenA, tokenB }),
      });
      const text = await res.text();
      let formatted: string;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { formatted = text; }
      if (res.status === 403) {
        return { content: [{ type: "text" as const, text: `**Access denied.** Token Comparison requires holding 2,500,000+ M32 tokens. Your wallet does not meet the threshold.\n\nBuy M32: https://raydium.io/swap/?inputMint=sol&outputMint=6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump` }] };
      }
      return { content: [{ type: "text" as const, text: `**Token Comparison** — \`${tokenA}\` vs \`${tokenB}\`\n\n\`\`\`json\n${formatted}\n\`\`\`` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  },
);

// ── Tool 6: M32-gated Portfolio Scanner ───────────────────────────────────

server.tool(
  "scan_portfolio_m32",
  "M32-gated full wallet portfolio scan. Discovers all SPL tokens in a Solana wallet, runs intelligence on top holdings, and returns per-token analysis with aggregate portfolio risk metrics. Requires the caller to hold 5,000,000+ M32 tokens (balance verified on-chain via X-Wallet-Address header). Free for qualifying holders. Returns 403 if insufficient M32.",
  {
    wallet: z
      .string()
      .describe("Solana wallet address to scan for token holdings."),
    walletAddress: z
      .string()
      .describe("Your Solana wallet address. M32 balance is checked on-chain to verify you hold 5M+ M32."),
  },
  async ({ wallet, walletAddress }: { wallet: string; walletAddress: string }) => {
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/m32/portfolio`, {
        method: "POST",
        headers: buildHeaders({
          "Content-Type": "application/json",
          "X-Wallet-Address": safeHeaderValue("walletAddress", walletAddress),
        }),
        body: JSON.stringify({ wallet }),
      });
      const text = await res.text();
      let formatted: string;
      try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { formatted = text; }
      if (res.status === 403) {
        return { content: [{ type: "text" as const, text: `**Access denied.** Portfolio Scanner requires holding 5,000,000+ M32 tokens. Your wallet does not meet the threshold.\n\nBuy M32: https://raydium.io/swap/?inputMint=sol&outputMint=6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump` }] };
      }
      return { content: [{ type: "text" as const, text: `**Portfolio Scanner** — wallet \`${wallet}\`\n\n\`\`\`json\n${formatted}\n\`\`\`` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  },
);

// ── Tool 7: get_pivx_dao_intelligence ─────────────────────────────────────
// Calls the MPP32 backend's `/api/governance` endpoint, which scrapes
// pivx.org/proposals + Chainz CryptoID server-side and caches for 5 minutes.
// Pre-1.7 versions of the MCP did the scrape client-side via cheerio; that
// pulled 21 transitive packages (including a deprecated whatwg-encoding) into
// every install for one read-only tool. The backend has served the same
// payload at /api/governance since 1.4.0 — this just routes through it.

interface PivxProposal {
  name: string;
  url: string;
  status: "passing" | "failing";
  funded: boolean;
  netYesPercent: number;
  yesVotes: number;
  noVotes: number;
  monthlyPaymentPiv: number;
  monthlyPaymentUsd: number;
  totalPaymentPiv: number;
  installmentsRemaining: number;
  totalInstallments: number;
  budgetPercent: number;
}

interface PivxNetworkStats {
  masternodeCount: number;
  passingThreshold: number;
  monthlyBudgetPiv: number;
  monthlyBudgetUsd: number;
  budgetAllocatedPiv: number;
  budgetAllocatedUsd: number;
  budgetAllocatedPercent: number;
  blockHeight: number;
  totalSupply: number;
  circulatingSupply: number;
}

interface PivxGovernanceData {
  proposals: PivxProposal[];
  network: PivxNetworkStats;
  deflation: {
    unallocatedPivPerCycle: number;
    unallocatedPercent: number;
    annualUnallocatedPiv: number;
    proposalFeeBurnPiv: number;
    effectiveInflationReduction: string;
  };
  timestamp: string;
  source: string;
  cacheHit: boolean;
}

interface PivxGovernanceResponse {
  data: {
    proposals: PivxProposal[];
    network: PivxNetworkStats;
    deflation: PivxGovernanceData["deflation"];
    meta: {
      source: string;
      timestamp: string;
      cacheHit: boolean;
    };
  };
}

async function fetchPivxGovernance(): Promise<PivxGovernanceData> {
  const res = await fetchWithTimeout(`${API_URL}/api/governance`, {
    timeoutMs: 15_000,
    headers: buildHeaders({ Accept: "application/json" }),
  });
  if (!res.ok) {
    throw new Error(`MPP32 governance endpoint returned HTTP ${res.status}`);
  }
  const { data } = (await res.json()) as PivxGovernanceResponse;
  return {
    proposals: data.proposals,
    network: data.network,
    deflation: data.deflation,
    timestamp: data.meta.timestamp,
    source: data.meta.source,
    cacheHit: data.meta.cacheHit,
  };
}

server.tool(
  "get_pivx_dao_intelligence",
  "Get real-time PIVX DAO governance intelligence. Returns active budget proposals with masternode voting tallies (Yes/No counts, net yes percentages), budget allocation status, network deflation metrics (unallocated treasury PIV that are never minted), and masternode network health. PIVX is a fully community-governed cryptocurrency where Masternode owners vote on budget proposals every ~30 days (43,200 blocks per superblock cycle, 432,000 PIV max monthly budget). Data is served by the MPP32 backend, which aggregates pivx.org/proposals and the PIVX blockchain via Chainz CryptoID, and caches for 5 minutes. Free — no payment or API key required.",
  {
    filter: z
      .enum(["all", "passing", "failing"])
      .default("all")
      .optional()
      .describe("Filter proposals by status: 'all' (default), 'passing' (funded proposals), or 'failing' (below threshold)."),
    includeStats: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include network stats and deflation metrics (default: true)."),
  },
  async ({ filter, includeStats }) => {
    try {
      const gov: PivxGovernanceData = await fetchPivxGovernance();

      const lines: string[] = [];
      lines.push("# PIVX DAO Governance Intelligence");
      lines.push("");

      if (includeStats !== false) {
        const n = gov.network;
        lines.push("## Network Overview");
        lines.push(`- **Masternodes Online:** ${n.masternodeCount.toLocaleString()}`);
        lines.push(`- **Passing Threshold:** ${n.passingThreshold} votes (10% of masternodes)`);
        lines.push(`- **Monthly Budget:** ${n.monthlyBudgetPiv.toLocaleString()} PIV (~$${n.monthlyBudgetUsd.toLocaleString()})`);
        lines.push(`- **Budget Allocated:** ${n.budgetAllocatedPiv.toLocaleString()} PIV (${n.budgetAllocatedPercent}%)`);
        if (n.blockHeight) lines.push(`- **Block Height:** ${n.blockHeight.toLocaleString()}`);
        if (n.totalSupply) lines.push(`- **Total Supply:** ${Math.round(n.totalSupply).toLocaleString()} PIV`);
        lines.push("");

        const d = gov.deflation;
        lines.push("## Deflation / Fee Burn Metrics");
        lines.push(`- **Unallocated PIV This Cycle:** ${d.unallocatedPivPerCycle.toLocaleString()} PIV (never minted)`);
        lines.push(`- **Annual Unallocated (est.):** ${d.annualUnallocatedPiv.toLocaleString()} PIV`);
        lines.push(`- **Effective Inflation Reduction:** ${d.effectiveInflationReduction}`);
        lines.push(`- **Proposal Submission Fee:** ${d.proposalFeeBurnPiv} PIV (burned/destroyed)`);
        lines.push("");
      }

      let proposals = gov.proposals;
      if (filter === "passing") proposals = proposals.filter((p) => p.status === "passing");
      else if (filter === "failing") proposals = proposals.filter((p) => p.status === "failing");

      if (proposals.length > 0) {
        lines.push(`## Active Proposals (${proposals.length})`);
        lines.push("");

        for (const p of proposals) {
          const status = p.status === "passing" ? "PASSING" : "FAILING";
          const fundedTag = p.funded ? " (Funded)" : "";
          lines.push(`### ${p.name} — ${status}${fundedTag}`);
          lines.push(`- **Votes:** ${p.yesVotes} Yes / ${p.noVotes} No (${p.netYesPercent}% net yes)`);
          lines.push(`- **Monthly Payment:** ${p.monthlyPaymentPiv.toLocaleString()} PIV (~$${p.monthlyPaymentUsd.toLocaleString()})`);
          if (p.totalPaymentPiv > p.monthlyPaymentPiv) {
            lines.push(`- **Total Budget:** ${p.totalPaymentPiv.toLocaleString()} PIV`);
          }
          if (p.installmentsRemaining > 0) {
            lines.push(`- **Installments Remaining:** ${p.installmentsRemaining}`);
          }
          if (p.budgetPercent) lines.push(`- **Budget Usage:** ${p.budgetPercent}%`);
          if (p.url) lines.push(`- **Details:** ${p.url}`);
          lines.push("");
        }
      } else {
        lines.push("No proposals found matching the filter.");
      }

      lines.push("---");
      lines.push(`Source: ${gov.source} | ${gov.timestamp}${gov.cacheHit ? " (cached)" : ""}`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to fetch PIVX governance data: ${err instanceof Error ? err.message : String(err)}. The tool calls ${API_URL}/api/governance — the MPP32 backend or its upstream sources (pivx.org, chainz.cryptoid.info) may be temporarily unreachable.`,
        }],
      };
    }
  },
);

// ── Tool 8: manage_agent_budget ────────────────────────────────────────────

server.tool(
  "manage_agent_budget",
  "View, set, or reset the spending circuit breaker for your MPP32 agent session. Use 'get' to check current budget status (remaining budget, hourly velocity, circuit breaker state). Use 'set' to configure spending limits (budget cap in USD, hourly velocity limit, alert threshold percentage). Use 'reset' to manually reset a tripped circuit breaker so the session can resume spending. Circuit breakers trip automatically when budget or velocity limits are exceeded, preventing runaway agent spending.",
  {
    action: z.enum(["get", "set", "reset"]).describe("Action: 'get' = view budget status, 'set' = update limits, 'reset' = clear tripped circuit breaker"),
    budgetLimitUsd: z.number().positive().max(1_000_000).optional().describe("Maximum total session spend in USD. Only used with action='set'."),
    velocityLimitUsd: z.number().positive().max(1_000_000).optional().describe("Maximum spend per hour in USD. Only used with action='set'."),
    alertThresholdPercent: z.number().int().min(1).max(100).optional().describe("Budget percentage at which to warn (e.g. 80 = warn at 80% spent). Only used with action='set'."),
  },
  async ({ action, budgetLimitUsd, velocityLimitUsd, alertThresholdPercent }) => {
    if (!AGENT_KEY) {
      return {
        content: [{ type: "text" as const, text: "**MPP32_AGENT_KEY not configured.** Set it in your MCP config to manage budgets." }],
      };
    }

    try {
      if (action === "get") {
        const res = await fetchWithTimeout(
          new URL("/api/agent/spending", API_URL).toString(),
          { headers: buildHeaders() },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null) as { error?: { message?: string } } | null;
          return { content: [{ type: "text" as const, text: `Error fetching budget: ${err?.error?.message ?? res.statusText}` }] };
        }
        const data = (await res.json() as { data: Record<string, unknown> }).data;
        const lines: string[] = [
          `**MPP32 Session Budget Status**`,
          ``,
        ];
        if (data.budgetLimitUsd != null) {
          lines.push(`Budget: $${(data.totalSpentUsd as number).toFixed(4)} spent of $${(data.budgetLimitUsd as number).toFixed(4)} ($${(data.remainingBudgetUsd as number).toFixed(4)} remaining, ${data.budgetUtilizationPercent}% used)`);
        } else {
          lines.push(`Budget: unlimited (no cap set)`);
          lines.push(`Total spent: $${(data.totalSpentUsd as number).toFixed(4)} across ${data.totalSettledCalls} settled calls`);
        }
        if (data.velocityLimitUsd != null) {
          lines.push(`Velocity: $${(data.hourlySpendUsd as number).toFixed(4)}/hr of $${(data.velocityLimitUsd as number).toFixed(4)}/hr limit (${data.hourlySettledCalls} calls this hour)`);
        }
        if (data.circuitBreakerTripped) {
          lines.push(``);
          lines.push(`**CIRCUIT BREAKER TRIPPED** — ${data.circuitBreakerReason}`);
          lines.push(`Tripped at: ${data.circuitBreakerTrippedAt}`);
          lines.push(`Use action="reset" to resume spending.`);
        }
        if ((data.byService as unknown[])?.length) {
          lines.push(``);
          lines.push(`**Spending by service:**`);
          for (const s of data.byService as Array<{ service: string; totalSpentUsd: number; count: number }>) {
            lines.push(`- ${s.service}: $${s.totalSpentUsd.toFixed(4)} (${s.count} calls)`);
          }
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (action === "set") {
        const payload: Record<string, unknown> = {};
        if (budgetLimitUsd !== undefined) payload.budgetLimitUsd = budgetLimitUsd;
        if (velocityLimitUsd !== undefined) payload.velocityLimitUsd = velocityLimitUsd;
        if (alertThresholdPercent !== undefined) payload.alertThresholdPercent = alertThresholdPercent;
        if (Object.keys(payload).length === 0) {
          return { content: [{ type: "text" as const, text: "Provide at least one of: budgetLimitUsd, velocityLimitUsd, alertThresholdPercent." }] };
        }
        const res = await fetchWithTimeout(
          new URL("/api/agent/budget", API_URL).toString(),
          {
            method: "PATCH",
            headers: buildHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null) as { error?: { message?: string } } | null;
          return { content: [{ type: "text" as const, text: `Error updating budget: ${err?.error?.message ?? res.statusText}` }] };
        }
        const data = (await res.json() as { data: Record<string, unknown> }).data;
        const lines: string[] = [
          `**Budget updated successfully.**`,
          ``,
          data.budgetLimitUsd != null ? `Budget limit: $${(data.budgetLimitUsd as number).toFixed(4)}` : `Budget limit: unlimited`,
          data.velocityLimitUsd != null ? `Velocity limit: $${(data.velocityLimitUsd as number).toFixed(4)}/hr` : `Velocity limit: unlimited`,
          `Total spent: $${(data.totalSpentUsd as number).toFixed(4)}`,
          data.remainingBudgetUsd != null ? `Remaining: $${(data.remainingBudgetUsd as number).toFixed(4)}` : ``,
          data.circuitBreakerTripped ? `\n**Note:** Circuit breaker is still tripped. Use action="reset" to resume.` : ``,
        ].filter(Boolean);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      if (action === "reset") {
        const res = await fetchWithTimeout(
          new URL("/api/agent/circuit-breaker/reset", API_URL).toString(),
          {
            method: "POST",
            headers: buildHeaders({ "Content-Type": "application/json" }),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null) as { error?: { message?: string } } | null;
          return { content: [{ type: "text" as const, text: `Error resetting circuit breaker: ${err?.error?.message ?? res.statusText}` }] };
        }
        const data = (await res.json() as { data: Record<string, unknown> }).data;
        const lines: string[] = [
          data.previousReason
            ? `**Circuit breaker reset.** Previous reason: ${data.previousReason}.`
            : `**Circuit breaker was not tripped.** No action needed.`,
          ``,
          data.budgetLimitUsd != null ? `Budget: $${(data.totalSpentUsd as number).toFixed(4)} / $${(data.budgetLimitUsd as number).toFixed(4)} ($${(data.remainingBudgetUsd as number).toFixed(4)} remaining)` : ``,
          `Session can resume spending.`,
        ].filter(Boolean);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      return { content: [{ type: "text" as const, text: "Unknown action. Use 'get', 'set', or 'reset'." }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  },
);

// ── Core: agent/execute path with 402 sign-and-retry ────────────────────────

async function callViaAgentExecute(
  service: string,
  method: string,
  body: unknown,
  query: Record<string, string> | undefined,
  path?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    const execUrl = new URL("/api/agent/execute", API_URL).toString();
    const reqBody = JSON.stringify({
      service,
      method,
      ...(body !== undefined ? { body } : {}),
      ...(query ? { query } : {}),
      ...(path ? { path } : {}),
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

  // Prefer x402 if a payment-required challenge is present AND we hold a key
  // for *either* the SVM or EVM side. The signer module inspects the
  // challenge's `network` field and routes to the right signer; we just need
  // to pass it whichever keys we have.
  if (challenge.paymentRequired && (SOLANA_PRIVATE_KEY || PRIVATE_KEY)) {
    try {
      const completed = await completeX402Payment(challenge.paymentRequired, {
        solana: SOLANA_PRIVATE_KEY,
        evm: PRIVATE_KEY,
      });
      paymentHeaders["X-Payment"] = completed.xPaymentHeader;
      usedProtocol = completed.protocolUsed === "x402-evm" ? "USDC (x402, Base)" : "USDC (x402, Solana)";
    } catch (err) {
      // Fall through to Tempo if available
      if (challenge.wwwAuthenticate && PRIVATE_KEY) {
        try {
          const token = await completeTempoPayment(challenge.wwwAuthenticate, PRIVATE_KEY);
          paymentHeaders["Authorization"] = token;
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
      const token = await completeTempoPayment(challenge.wwwAuthenticate, PRIVATE_KEY);
      paymentHeaders["Authorization"] = token;
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
  if (meta?.budget && meta.budget.budgetLimitUsd != null) {
    const b = meta.budget as { budgetLimitUsd: number; totalSpentUsd: number; remainingBudgetUsd: number; budgetUtilizationPercent: number };
    lines.push(`Budget: $${b.remainingBudgetUsd.toFixed(4)} remaining (${b.budgetUtilizationPercent}% of $${b.budgetLimitUsd.toFixed(4)} used)`);
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
  if (code === "MPP32_CIRCUIT_BREAKER_TRIPPED" || (status === 429 && (body?.error as any)?.budgetStatus)) {
    const bs = (body?.error as any)?.budgetStatus;
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `**Circuit breaker tripped** — spending limit reached.`,
            ``,
            body?.error?.message ?? "Session budget exhausted.",
            bs?.budgetLimitUsd != null ? `Budget: $${bs.totalSpentUsd?.toFixed(4) ?? "?"} / $${bs.budgetLimitUsd.toFixed(4)}` : "",
            bs?.velocityLimitUsd != null ? `Velocity: $${bs.hourlySpendUsd?.toFixed(4) ?? "?"}/hr of $${bs.velocityLimitUsd.toFixed(4)}/hr limit` : "",
            ``,
            `To resume: use \`manage_agent_budget\` with action="reset", or increase the budget with action="set".`,
          ].filter(Boolean).join("\n"),
        },
      ],
    };
  }
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
  path?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
 try {
  // Without an agent key, only native /api/proxy/<slug> is reachable.
  // Native services do not need a `path` argument; if one is passed, we
  // ignore it here. (The agent-execute path forwards it for external entries.)
  void path;
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
  if (paymentRequired && (SOLANA_PRIVATE_KEY || PRIVATE_KEY)) {
    try {
      const completed = await completeX402Payment(paymentRequired, {
        solana: SOLANA_PRIVATE_KEY,
        evm: PRIVATE_KEY,
      });
      paymentHeaders["X-Payment"] = completed.xPaymentHeader;
      usedProtocol = completed.protocolUsed === "x402-evm" ? "USDC (x402, Base)" : "USDC (x402, Solana)";
    } catch (err) {
      if (wwwAuth && PRIVATE_KEY) {
        try {
          const token = await completeTempoPayment(wwwAuth, PRIVATE_KEY);
          paymentHeaders["Authorization"] = token;
          usedProtocol = "pathUSD (Tempo)";
        } catch (te) {
          return paymentFailedMessage(challenge, "x402+tempo", `${err}; ${te}`);
        }
      } else {
        return paymentFailedMessage(challenge, "x402", err);
      }
    }
  } else if (wwwAuth && PRIVATE_KEY) {
    try {
      const token = await completeTempoPayment(wwwAuth, PRIVATE_KEY);
      paymentHeaders["Authorization"] = token;
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

  if (paymentRequired && (SOLANA_PRIVATE_KEY || PRIVATE_KEY)) {
    try {
      const completed = await completeX402Payment(paymentRequired, {
        solana: SOLANA_PRIVATE_KEY,
        evm: PRIVATE_KEY,
      });
      paymentHeaders["X-Payment"] = completed.xPaymentHeader;
      usedProtocol = completed.protocolUsed === "x402-evm" ? "USDC (x402, Base)" : "USDC (x402, Solana)";
    } catch (x402Err) {
      if (wwwAuth && PRIVATE_KEY) {
        try {
          const tempoToken = await completeTempoPayment(wwwAuth, PRIVATE_KEY);
          paymentHeaders["Authorization"] = tempoToken;
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
            { type: "text" as const, text: `x402 payment failed: ${x402Err instanceof Error ? x402Err.message : String(x402Err)}. Check that the wallet for the challenge network has sufficient USDC balance.` },
          ],
        };
      }
    }
  } else if (wwwAuth && PRIVATE_KEY) {
    try {
      const tempoToken = await completeTempoPayment(wwwAuth, PRIVATE_KEY);
      paymentHeaders["Authorization"] = tempoToken;
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

// Signs a Tempo TIP-20 transfer for the challenge carried in a 402 response's
// raw WWW-Authenticate header and returns the FULL Authorization header value
// ("Payment <b64>", mppx Credential.serialize format) — callers must set it
// verbatim, never re-prefix with "Payment ".
async function completeTempoPayment(
  wwwAuthenticateHeader: string,
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
    // polyfill: false — never clobber the host process's globalThis.fetch.
    const client = mppxClient.Mppx.create({
      methods: [mppxClient.tempo({ account })],
      polyfill: false,
    });
    const challengeResponse = new Response(null, {
      status: 402,
      headers: { "WWW-Authenticate": wwwAuthenticateHeader },
    });
    return (await client.createCredential(challengeResponse)) as string;
  } catch (payErr) {
    throw new Error(
      `Tempo payment failed: ${payErr instanceof Error ? payErr.message : String(payErr)}`,
    );
  }
}

interface CompletedX402Payment {
  xPaymentHeader: string;
  network: string;
  protocolUsed: "x402-svm" | "x402-evm";
}

// Build a real, x402-spec-compliant payment payload from the server's
// Payment-Required challenge. For Solana-family networks, this produces a
// base64 partially-signed VersionedTransaction (3 instructions, fee-payer
// slot reserved for the facilitator). For Base/Base-Sepolia/Ethereum, it
// produces an EIP-3009 transferWithAuthorization signature. Returns the
// envelope ready to drop into the `X-Payment` HTTP header.
async function completeX402Payment(
  paymentRequiredHeader: string,
  keys: { solana?: string; evm?: string },
): Promise<CompletedX402Payment> {
  const solanaRpcUrl = readEnv("MPP32_SOLANA_RPC_URL");
  const result = await signX402Payment({
    paymentRequiredHeader,
    solanaKey: keys.solana,
    evmKey: keys.evm,
    solanaRpcUrl,
    preferredNetwork: PREFERRED_NETWORK,
  });
  return {
    xPaymentHeader: result.xPaymentHeader,
    network: result.network,
    protocolUsed: result.protocolUsed,
  };
}

// ── Auto SIWS bootstrap ─────────────────────────────────────────────────────
// When both MPP32_AGENT_KEY and MPP32_SOLANA_PRIVATE_KEY are configured the
// MCP server proves wallet ownership to the MPP32 backend at startup, which
// activates M32 holder pricing on every subsequent paid query for the rest of
// the process lifetime. No user action required.

let siwsVerifiedAddress: string | null = null;
let siwsTier: string | null = null;
let siwsDiscountPercent = 0;

async function tryAutoSiws(): Promise<void> {
  if (!AGENT_KEY || !SOLANA_PRIVATE_KEY) return;
  try {
    // Lazy import to keep startup fast when only catalog browsing is needed.
    const [kitMod, scureBase] = await Promise.all([
      import("@solana/kit"),
      import("@scure/base"),
    ]);
    const { base58 } = scureBase;
    const {
      createKeyPairFromBytes,
      createKeyPairFromPrivateKeyBytes,
      getAddressFromPublicKey,
      signBytes,
    } = kitMod;

    // Decode the private key. Supports JSON byte array, hex, and base58.
    let bytes: Uint8Array;
    if (SOLANA_PRIVATE_KEY.startsWith("[")) {
      bytes = new Uint8Array(JSON.parse(SOLANA_PRIVATE_KEY));
    } else if (/^[0-9a-fA-F]+$/.test(SOLANA_PRIVATE_KEY) && SOLANA_PRIVATE_KEY.length % 2 === 0) {
      bytes = new Uint8Array(Buffer.from(SOLANA_PRIVATE_KEY, "hex"));
    } else {
      bytes = base58.decode(SOLANA_PRIVATE_KEY);
    }
    let keyPair: CryptoKeyPair;
    if (bytes.length === 32) {
      keyPair = await createKeyPairFromPrivateKeyBytes(bytes);
    } else if (bytes.length === 64) {
      keyPair = await createKeyPairFromBytes(bytes);
    } else {
      console.error(`[mpp32] SIWS skipped: Solana key has unexpected length ${bytes.length}`);
      return;
    }
    const walletAddress = await getAddressFromPublicKey(keyPair.publicKey);

    // Step 1: request a nonce bound to our existing agent session.
    const nonceRes = await fetchWithTimeout(`${API_URL}/api/auth/siws/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, agentKey: AGENT_KEY }),
      timeoutMs: 8_000,
    });
    if (!nonceRes.ok) {
      const text = await nonceRes.text().catch(() => "");
      console.error(`[mpp32] SIWS nonce request failed: HTTP ${nonceRes.status} ${text.slice(0, 200)}`);
      return;
    }
    const nonceBody = (await nonceRes.json()) as { data?: { message?: string } };
    const message = nonceBody.data?.message;
    if (!message) {
      console.error("[mpp32] SIWS nonce response missing message");
      return;
    }

    // Step 2: sign the canonical message bytes via WebCrypto Ed25519.
    const signatureBytes = await signBytes(keyPair.privateKey, new TextEncoder().encode(message));
    const signature = base58.encode(signatureBytes);

    // Step 3: verify with the backend. Backend marks session walletVerified=true.
    const verifyRes = await fetchWithTimeout(`${API_URL}/api/auth/siws/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, signature, agentKey: AGENT_KEY }),
      timeoutMs: 8_000,
    });
    if (!verifyRes.ok) {
      const text = await verifyRes.text().catch(() => "");
      console.error(`[mpp32] SIWS verify failed: HTTP ${verifyRes.status} ${text.slice(0, 200)}`);
      return;
    }
    const verifyBody = (await verifyRes.json()) as {
      data?: { walletAddress?: string; tier?: string; discountPercent?: number }
    };
    siwsVerifiedAddress = verifyBody.data?.walletAddress ?? walletAddress;
    siwsTier = verifyBody.data?.tier ?? "none";
    siwsDiscountPercent = verifyBody.data?.discountPercent ?? 0;
    const tierLabel = siwsDiscountPercent > 0
      ? `${siwsTier} tier (${siwsDiscountPercent}% off every paid query)`
      : "no holder tier (wallet holds zero M32, verification still active)";
    const shortAddr = `${siwsVerifiedAddress.slice(0, 6)}…${siwsVerifiedAddress.slice(-4)}`;
    console.error(`[mpp32] SIWS verified for ${shortAddr}: ${tierLabel}`);
  } catch (err) {
    console.error(`[mpp32] SIWS bootstrap error: ${err instanceof Error ? err.message : String(err)}`);
  }
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

  // Auto SIWS in the background. Does not block startup — if it fails the user
  // simply pays the standard rate instead of the holder rate.
  void tryAutoSiws();
  // Per-variable status so a user staring at this log can immediately see
  // whether their env vars made it through. Values are fingerprinted.
  const fp = (v: string | undefined): string =>
    !v ? "NOT SET" : v.length <= 12 ? `SET (${v.length}c)` : `SET (${v.slice(0, 6)}…${v.slice(-4)}, ${v.length}c)`;
  console.error(`[mpp32]   MPP32_AGENT_KEY: ${fp(AGENT_KEY)}`);
  console.error(`[mpp32]   MPP32_SOLANA_PRIVATE_KEY: ${fp(SOLANA_PRIVATE_KEY)}`);
  console.error(`[mpp32]   MPP32_PRIVATE_KEY: ${fp(PRIVATE_KEY)}`);
  console.error(`[mpp32] If a key shows NOT SET but you set it in claude_desktop_config.json, call the get_mpp32_diagnostics tool for help, or fully quit Claude Desktop and reopen.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
