#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.MPP32_API_URL?.replace(/\/$/, "") || "https://api.mpp32.org";
const PRIVATE_KEY = process.env.MPP32_PRIVATE_KEY;
const SOLANA_PRIVATE_KEY = process.env.MPP32_SOLANA_PRIVATE_KEY;

interface Service {
  name: string;
  slug: string;
  shortDescription: string;
  category: string;
  pricePerQuery: number;
  paymentAddress: string;
  creatorName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  queryCount: number;
  status: string;
}

interface SubmissionsResponse {
  data: Service[];
}

interface ProxyInfoResponse {
  data: {
    name: string;
    slug: string;
    shortDescription: string;
    category: string;
    pricePerQuery: number;
    paymentAddress: string;
  };
}

const server = new McpServer({
  name: "mpp32",
  version: "1.0.0",
});

// ── Tool 1: list_mpp32_services ──

server.tool(
  "list_mpp32_services",
  "Browse the MPP32 ecosystem of machine-payable APIs. Returns all available services with their names, descriptions, categories, prices, and proxy URLs. Optionally filter by category.",
  {
    category: z
      .string()
      .optional()
      .describe(
        "Filter by category slug (e.g. 'ai-inference', 'token-scanner', 'price-oracle', 'web-search'). Omit to list all services."
      ),
  },
  async ({ category }) => {
    try {
      const url = new URL("/api/submissions", API_URL);
      const res = await fetch(url.toString());

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

      const json = (await res.json()) as SubmissionsResponse;
      let services = json.data;

      if (category) {
        services = services.filter(
          (s) => s.category.toLowerCase() === category.toLowerCase()
        );
      }

      if (services.length === 0) {
        const msg = category
          ? `No services found in category "${category}". Try listing all services to see available categories.`
          : "No services are currently listed in the MPP32 ecosystem.";
        return { content: [{ type: "text" as const, text: msg }] };
      }

      const lines = services.map((s) => {
        const price = s.pricePerQuery
          ? `$${s.pricePerQuery} USD (pathUSD or USDC)`
          : "Free";
        return [
          `## ${s.name}`,
          `- **Slug:** \`${s.slug}\``,
          `- **Category:** ${s.category}`,
          `- **Price:** ${price} per query`,
          `- **Description:** ${s.shortDescription}`,
          `- **Proxy URL:** \`${API_URL}/api/proxy/${s.slug}\``,
          `- **Queries served:** ${s.queryCount.toLocaleString()}`,
          s.creatorName ? `- **Creator:** ${s.creatorName}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });

      const header = `# MPP32 Ecosystem — ${services.length} service${services.length !== 1 ? "s" : ""}${category ? ` in "${category}"` : ""}\n\nTo call any service, use the \`call_mpp32_endpoint\` tool with the service slug.\n`;

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
  }
);

// ── Tool 2: call_mpp32_endpoint ──

server.tool(
  "call_mpp32_endpoint",
  "Call a machine-payable API endpoint on MPP32. Handles the full HTTP 402 payment flow automatically via Tempo (pathUSD) or x402 (USDC on Solana). Requires MPP32_PRIVATE_KEY (Tempo) or MPP32_SOLANA_PRIVATE_KEY (x402) environment variable.",
  {
    slug: z
      .string()
      .describe(
        "The service slug to call (e.g. 'solana-token-intelligence'). Use list_mpp32_services to discover available slugs."
      ),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE"])
      .default("GET")
      .describe("HTTP method for the request"),
    body: z
      .string()
      .optional()
      .describe("JSON request body (for POST/PUT requests)"),
    query: z
      .record(z.string())
      .optional()
      .describe("URL query parameters as key-value pairs"),
  },
  async ({ slug, method, body, query }) => {
    if (!PRIVATE_KEY && !SOLANA_PRIVATE_KEY) {
      return {
        content: [
          {
            type: "text" as const,
            text: [
              "**No payment key configured.**",
              "",
              "To make paid API calls, set at least one payment key in your MCP server configuration:",
              "",
              "```json",
              '{',
              '  "mcpServers": {',
              '    "mpp32": {',
              '      "command": "npx",',
              '      "args": ["mpp32-mcp-server"],',
              '      "env": {',
              '        "MPP32_PRIVATE_KEY": "your-evm-private-key (for Tempo/pathUSD)",',
              '        "MPP32_SOLANA_PRIVATE_KEY": "your-solana-private-key (for x402/USDC)"',
              "      }",
              "    }",
              "  }",
              "}",
              "```",
              "",
              "Provide either key — or both for maximum compatibility.",
              "- **MPP32_PRIVATE_KEY**: EVM key for a wallet funded with pathUSD on Tempo.",
              "- **MPP32_SOLANA_PRIVATE_KEY**: Solana key for a wallet funded with USDC.",
            ].join("\n"),
          },
        ],
      };
    }

    try {
      // First, get service info to confirm it exists and show the price
      const infoUrl = new URL(`/api/proxy/${encodeURIComponent(slug)}/info`, API_URL);
      const infoRes = await fetch(infoUrl.toString());

      if (!infoRes.ok) {
        if (infoRes.status === 404) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Service "${slug}" not found. Use list_mpp32_services to see available services.`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Error checking service: HTTP ${infoRes.status}`,
            },
          ],
        };
      }

      const info = (await infoRes.json()) as ProxyInfoResponse;
      const price = info.data.pricePerQuery ?? 0.001;

      // Build the proxy request URL
      const proxyUrl = new URL(`/api/proxy/${encodeURIComponent(slug)}`, API_URL);
      if (query) {
        for (const [key, value] of Object.entries(query)) {
          proxyUrl.searchParams.set(key, value);
        }
      }

      // Step 1: Initial request to get the 402 payment challenge
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (body) {
        headers["Content-Type"] = "application/json";
      }

      const challengeRes = await fetch(proxyUrl.toString(), {
        method,
        headers,
        body: method !== "GET" ? body : undefined,
      });

      // If we get a non-402 response, the endpoint might not require payment
      if (challengeRes.status !== 402) {
        const responseText = await challengeRes.text();
        let formatted: string;
        try {
          formatted = JSON.stringify(JSON.parse(responseText), null, 2);
        } catch {
          formatted = responseText;
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `**${info.data.name}** responded with HTTP ${challengeRes.status}:\n\n\`\`\`json\n${formatted}\n\`\`\``,
            },
          ],
        };
      }

      // Step 2: Parse the 402 challenge — detect available protocols
      const wwwAuth = challengeRes.headers.get("www-authenticate");
      const paymentRequiredHeader = challengeRes.headers.get("payment-required");

      if (!wwwAuth && !paymentRequiredHeader) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Received 402 but no payment challenge headers. The payment protocol may have changed.",
            },
          ],
        };
      }

      // Step 3: Choose protocol and complete payment
      let paymentAuthHeader: string;
      let paymentAuthKey: string;
      let usedProtocol: string;

      // Prefer x402 if Solana key is available and server supports it
      if (paymentRequiredHeader && SOLANA_PRIVATE_KEY) {
        try {
          const x402Token = await completeX402Payment(paymentRequiredHeader, SOLANA_PRIVATE_KEY);
          paymentAuthHeader = x402Token;
          paymentAuthKey = "X-Payment";
          usedProtocol = "USDC (x402)";
        } catch (err) {
          // Fall back to Tempo if x402 fails and Tempo key is available
          if (wwwAuth && PRIVATE_KEY) {
            const challengeParams = parseWwwAuthenticate(wwwAuth);
            if (!challengeParams.scheme) {
              return { content: [{ type: "text" as const, text: `x402 payment failed and could not parse Tempo challenge.` }] };
            }
            paymentAuthHeader = await completeTempoPayment(challengeParams.params, PRIVATE_KEY);
            paymentAuthKey = "Authorization";
            paymentAuthHeader = `Payment ${paymentAuthHeader}`;
            usedProtocol = "pathUSD (Tempo)";
          } else {
            return {
              content: [
                {
                  type: "text" as const,
                  text: [
                    `**x402 payment failed** for ${info.data.name} ($${price}):`,
                    "",
                    err instanceof Error ? err.message : String(err),
                    "",
                    "Ensure your Solana wallet has sufficient USDC balance.",
                  ].join("\n"),
                },
              ],
            };
          }
        }
      } else if (wwwAuth && PRIVATE_KEY) {
        const challengeParams = parseWwwAuthenticate(wwwAuth);
        if (!challengeParams.scheme || !challengeParams.params) {
          return { content: [{ type: "text" as const, text: `Could not parse payment challenge. WWW-Authenticate: ${wwwAuth}` }] };
        }
        try {
          const token = await completeTempoPayment(challengeParams.params, PRIVATE_KEY);
          paymentAuthHeader = `Payment ${token}`;
          paymentAuthKey = "Authorization";
          usedProtocol = "pathUSD (Tempo)";
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: [
                  `**Tempo payment failed** for ${info.data.name} ($${price}):`,
                  "",
                  err instanceof Error ? err.message : String(err),
                  "",
                  "Ensure your wallet has sufficient pathUSD balance on Tempo.",
                ].join("\n"),
              },
            ],
          };
        }
      } else {
        const available = [wwwAuth ? "Tempo (pathUSD)" : null, paymentRequiredHeader ? "x402 (USDC)" : null].filter(Boolean).join(", ");
        const configured = [PRIVATE_KEY ? "Tempo" : null, SOLANA_PRIVATE_KEY ? "x402" : null].filter(Boolean).join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `No compatible payment method. Server offers: ${available}. You have keys for: ${configured || "none"}.`,
            },
          ],
        };
      }

      // Step 4: Retry with payment receipt
      const authedRes = await fetch(proxyUrl.toString(), {
        method,
        headers: {
          ...headers,
          [paymentAuthKey]: paymentAuthHeader,
        },
        body: method !== "GET" ? body : undefined,
      });

      const responseText = await authedRes.text();
      let formatted: string;
      try {
        formatted = JSON.stringify(JSON.parse(responseText), null, 2);
      } catch {
        formatted = responseText;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `**${info.data.name}** — HTTP ${authedRes.status} (paid $${price} via ${usedProtocol})`,
              "",
              "```json",
              formatted,
              "```",
            ].join("\n"),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  }
);

// ── Helpers ──

interface ChallengeParams {
  scheme: string | null;
  params: Record<string, string>;
}

function parseWwwAuthenticate(header: string): ChallengeParams {
  const match = header.match(/^(\w+)\s+(.+)$/);
  if (!match) return { scheme: null, params: {} };

  const scheme = match[1];
  const rest = match[2];
  const params: Record<string, string> = {};

  const paramRegex = /(\w+)=(?:"([^"]*)"|([\w.+/=-]+))/g;
  let m: RegExpExecArray | null;
  while ((m = paramRegex.exec(rest)) !== null) {
    params[m[1]] = m[2] ?? m[3];
  }

  return { scheme, params };
}

async function completeTempoPayment(
  challengeParams: Record<string, string>,
  privateKey: string
): Promise<string> {
  // The Tempo payment flow:
  // 1. Parse amount, currency, recipient, nonce from challenge
  // 2. Sign a payment authorization with the private key
  // 3. Return the signed token for the Authorization header

  // Dynamic import — mppx and viem are optional peer dependencies
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
      "Payment client not available. Install mppx and viem as peer dependencies:\n  npm install mppx viem"
    );
  }

  try {
    const account = viemAccounts.privateKeyToAccount(
      privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
    );

    const client = mppxClient.Mppx.create({
      methods: [mppxClient.tempo({ account })],
    });

    const token = await client.pay(challengeParams);
    return token;
  } catch (payErr) {
    throw new Error(
      `Payment failed: ${payErr instanceof Error ? payErr.message : String(payErr)}`
    );
  }
}

async function completeX402Payment(
  paymentRequiredHeader: string,
  solanaPrivateKey: string
): Promise<string> {
  let requirements: Record<string, any>;
  try {
    requirements = JSON.parse(
      Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
    );
  } catch {
    throw new Error("Could not decode Payment-Required header");
  }

  // Build x402 payment payload with the Solana key
  // Dynamic import for optional dependency
  let solanaWeb3: any;
  try {
    const pkg = "@solana/web3.js";
    solanaWeb3 = await import(pkg);
  } catch {
    throw new Error(
      "x402 payment requires @solana/web3.js:\n  npm install @solana/web3.js"
    );
  }

  let keypair: any;
  try {
    if (solanaPrivateKey.startsWith("[")) {
      keypair = solanaWeb3.Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(solanaPrivateKey))
      );
    } else if (/^[0-9a-fA-F]+$/.test(solanaPrivateKey)) {
      keypair = solanaWeb3.Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(solanaPrivateKey, "hex"))
      );
    } else {
      const bs58Pkg = "bs58";
      const bs58 = await import(bs58Pkg);
      keypair = solanaWeb3.Keypair.fromSecretKey(bs58.default.decode(solanaPrivateKey));
    }
  } catch (err) {
    throw new Error(
      `Could not decode Solana private key: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const payload = {
    x402Version: 1,
    scheme: requirements.scheme ?? "exact",
    network: requirements.network ?? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
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
  const signed = require("tweetnacl").sign.detached(
    messageBytes,
    keypair.secretKey
  );
  payload.payload.signature = Buffer.from(signed).toString("base64");

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MPP32 MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
