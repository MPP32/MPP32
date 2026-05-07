#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const API_URL = process.env.MPP32_API_URL?.replace(/\/$/, "") || "https://mpp32.org";
const PRIVATE_KEY = process.env.MPP32_PRIVATE_KEY;
const server = new McpServer({
    name: "mpp32",
    version: "1.0.0",
});
// ── Tool 1: list_mpp32_services ──
server.tool("list_mpp32_services", "Browse the MPP32 ecosystem of machine-payable APIs. Returns all available services with their names, descriptions, categories, prices, and proxy URLs. Optionally filter by category.", {
    category: z
        .string()
        .optional()
        .describe("Filter by category slug (e.g. 'ai-inference', 'token-scanner', 'price-oracle', 'web-search'). Omit to list all services."),
}, async ({ category }) => {
    try {
        const url = new URL("/api/submissions", API_URL);
        const res = await fetch(url.toString());
        if (!res.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching services: HTTP ${res.status} ${res.statusText}`,
                    },
                ],
            };
        }
        const json = (await res.json());
        let services = json.data;
        if (category) {
            services = services.filter((s) => s.category.toLowerCase() === category.toLowerCase());
        }
        if (services.length === 0) {
            const msg = category
                ? `No services found in category "${category}". Try listing all services to see available categories.`
                : "No services are currently listed in the MPP32 ecosystem.";
            return { content: [{ type: "text", text: msg }] };
        }
        const lines = services.map((s) => {
            const price = s.pricePerQuery
                ? `$${s.pricePerQuery} pathUSD`
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
            content: [{ type: "text", text: header + "\n" + lines.join("\n\n") }],
        };
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to fetch MPP32 services: ${err instanceof Error ? err.message : String(err)}`,
                },
            ],
        };
    }
});
// ── Tool 2: call_mpp32_endpoint ──
server.tool("call_mpp32_endpoint", "Call a machine-payable API endpoint on MPP32. Handles the full HTTP 402 payment flow automatically — sends the initial request, receives the payment challenge, completes a Tempo micropayment in pathUSD, and retries with the payment receipt. Requires MPP32_PRIVATE_KEY environment variable to be set with a funded wallet.", {
    slug: z
        .string()
        .describe("The service slug to call (e.g. 'solana-token-intelligence'). Use list_mpp32_services to discover available slugs."),
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
}, async ({ slug, method, body, query }) => {
    if (!PRIVATE_KEY) {
        return {
            content: [
                {
                    type: "text",
                    text: [
                        "**MPP32_PRIVATE_KEY not configured.**",
                        "",
                        "To make paid API calls, set the MPP32_PRIVATE_KEY environment variable in your MCP server configuration:",
                        "",
                        "```json",
                        '{',
                        '  "mcpServers": {',
                        '    "mpp32": {',
                        '      "command": "npx",',
                        '      "args": ["mpp32-mcp-server"],',
                        '      "env": {',
                        '        "MPP32_PRIVATE_KEY": "your-private-key-here"',
                        "      }",
                        "    }",
                        "  }",
                        "}",
                        "```",
                        "",
                        "The key should be an EVM-compatible private key for a wallet funded with pathUSD on the Tempo network.",
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
                            type: "text",
                            text: `Service "${slug}" not found. Use list_mpp32_services to see available services.`,
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `Error checking service: HTTP ${infoRes.status}`,
                    },
                ],
            };
        }
        const info = (await infoRes.json());
        const price = info.data.pricePerQuery ?? 0.001;
        // Build the proxy request URL
        const proxyUrl = new URL(`/api/proxy/${encodeURIComponent(slug)}`, API_URL);
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                proxyUrl.searchParams.set(key, value);
            }
        }
        // Step 1: Initial request to get the 402 payment challenge
        const headers = {
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
            let formatted;
            try {
                formatted = JSON.stringify(JSON.parse(responseText), null, 2);
            }
            catch {
                formatted = responseText;
            }
            return {
                content: [
                    {
                        type: "text",
                        text: `**${info.data.name}** responded with HTTP ${challengeRes.status}:\n\n\`\`\`json\n${formatted}\n\`\`\``,
                    },
                ],
            };
        }
        // Step 2: Parse the 402 challenge
        const wwwAuth = challengeRes.headers.get("www-authenticate");
        if (!wwwAuth) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Received 402 but no WWW-Authenticate header. The payment challenge format may have changed.",
                    },
                ],
            };
        }
        // Step 3: Complete the Tempo payment
        // Parse challenge parameters from WWW-Authenticate header
        const challengeParams = parseWwwAuthenticate(wwwAuth);
        if (!challengeParams.scheme || !challengeParams.params) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Could not parse payment challenge. WWW-Authenticate: ${wwwAuth}`,
                    },
                ],
            };
        }
        // Use the mppx client-side payment flow
        // Dynamic import so the server still starts without mppx installed
        let paymentToken;
        try {
            paymentToken = await completeTempoPayment(challengeParams.params, PRIVATE_KEY);
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: [
                            `**Payment failed** for ${info.data.name} ($${price} pathUSD):`,
                            "",
                            err instanceof Error ? err.message : String(err),
                            "",
                            "Ensure your wallet has sufficient pathUSD balance on the Tempo network.",
                        ].join("\n"),
                    },
                ],
            };
        }
        // Step 4: Retry with payment receipt
        const authedRes = await fetch(proxyUrl.toString(), {
            method,
            headers: {
                ...headers,
                Authorization: `Payment ${paymentToken}`,
            },
            body: method !== "GET" ? body : undefined,
        });
        const responseText = await authedRes.text();
        let formatted;
        try {
            formatted = JSON.stringify(JSON.parse(responseText), null, 2);
        }
        catch {
            formatted = responseText;
        }
        const statusEmoji = authedRes.ok ? "+" : "!";
        return {
            content: [
                {
                    type: "text",
                    text: [
                        `**${info.data.name}** — HTTP ${authedRes.status} (paid $${price} pathUSD)`,
                        "",
                        "```json",
                        formatted,
                        "```",
                    ].join("\n"),
                },
            ],
        };
    }
    catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
                },
            ],
        };
    }
});
function parseWwwAuthenticate(header) {
    const match = header.match(/^(\w+)\s+(.+)$/);
    if (!match)
        return { scheme: null, params: {} };
    const scheme = match[1];
    const rest = match[2];
    const params = {};
    const paramRegex = /(\w+)=(?:"([^"]*)"|([\w.+/=-]+))/g;
    let m;
    while ((m = paramRegex.exec(rest)) !== null) {
        params[m[1]] = m[2] ?? m[3];
    }
    return { scheme, params };
}
async function completeTempoPayment(challengeParams, privateKey) {
    // The Tempo payment flow:
    // 1. Parse amount, currency, recipient, nonce from challenge
    // 2. Sign a payment authorization with the private key
    // 3. Return the signed token for the Authorization header
    // Dynamic import — mppx and viem are optional peer dependencies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mppxClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viemAccounts;
    try {
        const mppxPkg = "mppx/client";
        const viemPkg = "viem/accounts";
        mppxClient = await import(mppxPkg);
        viemAccounts = await import(viemPkg);
    }
    catch {
        throw new Error("Payment client not available. Install mppx and viem as peer dependencies:\n  npm install mppx viem");
    }
    try {
        const account = viemAccounts.privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
        const client = mppxClient.Mppx.create({
            methods: [mppxClient.tempo({ account })],
        });
        const token = await client.pay(challengeParams);
        return token;
    }
    catch (payErr) {
        throw new Error(`Payment failed: ${payErr instanceof Error ? payErr.message : String(payErr)}`);
    }
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
//# sourceMappingURL=index.js.map