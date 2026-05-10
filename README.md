# MPP32

**The payment layer for AI agents.** One install. Five payment rails. Thousands of paid APIs your agent can reach without you setting up a single account.

[![npm version](https://img.shields.io/npm/v/mpp32-mcp-server.svg?style=flat-square&color=0052FF)](https://www.npmjs.com/package/mpp32-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-0052FF.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-mpp32.org-0052FF?style=flat-square)](https://mpp32.org)

## Why this exists

Most agent stacks stop at "the model can call a function." That works until the function costs money. The moment your agent needs premium data, a paid model, a trading signal, or a token analytics call, you are back to building accounts, storing API keys, watching budgets, and writing custom 402 handlers for every provider.

MPP32 replaces all of that. Your agent asks for a service by name. The proxy finds it in a federated catalog of thousands of machine payable APIs, negotiates the cheapest protocol, signs payment from a key on your own machine, and returns the data. You write zero billing code. You manage zero provider accounts. Settlement lands on chain in seconds. MPP32 never touches the money.

## What an agent gains the moment it connects

* A live catalog of over 4,500 paid and free APIs across token intelligence, market data, web search, image generation, embeddings, DeFi analytics, wallet scoring, on chain queries, trading signals, and more.
* Automatic payment across five protocols, picked per call based on which wallet you have funded.
* Real time Solana token intelligence with alpha scoring, rug risk, whale flow, smart money signals, and 24 hour pump probability.
* A dashboard at mpp32.org that tracks every call, every dollar settled, every protocol used, every latency reading.
* Tiered discounts for M32 holders (20 percent at 250k, 40 percent at 1M) the moment a wallet is verified.
* End to end audit. Every settlement comes back with an on chain signature you can verify on Solscan.

## Payment rails

| Rail | Settles in | Network | Verification |
|:-----|:-----------|:--------|:-------------|
| x402 | USDC | Solana | On chain through the Solana facilitator |
| Tempo | pathUSD | Ethereum L2 | Cryptographic via the mppx SDK |
| ACP | Checkout session | Multi chain | Database backed checkout flow |
| AP2 | W3C verifiable credentials | Chain agnostic | ECDSA P-256 signature |
| AGTP | HMAC signed agent certificates | Chain agnostic | HMAC SHA256 with server held salt |

Every native endpoint accepts all five. None are stubbed. The server picks the rail your wallet is funded for and falls back gracefully if the first attempt does not settle.

## Install

The MCP server is on npm and listed in the [official Model Context Protocol registry](https://registry.modelcontextprotocol.io).

```bash
npx mpp32-mcp-server
```

Drop this into the MCP servers section of Claude Desktop, Claude Code, Cursor, Windsurf, or any MCP compatible client.

```json
{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_AGENT_KEY": "mpp32_agent_…",
        "MPP32_SOLANA_PRIVATE_KEY": "your_solana_private_key_for_usdc"
      }
    }
  }
}
```

Get an `MPP32_AGENT_KEY` at [mpp32.org/agent-console](https://mpp32.org/agent-console). No signup, no email, just a session form. With an agent key every call is attributed to your dashboard. Without it the server still works but you only see native services and the calls stay anonymous. Private keys never leave your machine.

## What the tools do

Three tools any MCP compatible agent can call.

* `list_mpp32_services` browses the federated catalog. Returns native, curated free, x402 bazaar, and MCP registry entries with pricing, supported protocols, and a clear flag on every row that tells the agent whether it can actually call the service through this MCP or whether the entry is for discovery only.
* `call_mpp32_endpoint` invokes any HTTP callable service. Free services return immediately. Paid services return a 402 challenge that this tool signs locally and retries automatically when a payment key is configured.
* `get_solana_token_intelligence` runs the MPP32 native oracle. Pulls live data from DexScreener, Jupiter, and CoinGecko, merges it into one report, returns alpha score, rug risk, whale activity, smart money signals, 24 hour pump probability, projected ROI, and full market data. Costs $0.008 per call, paid automatically when a key is set.

## Verify it without trusting us

The protocol integrations are running in production. You can confirm them against any registered endpoint without writing code.

See the 402 challenge with every protocol header:

```bash
curl -i https://mpp32.org/api/proxy/mpp32-intelligence
```

The response will include `WWW-Authenticate`, `Payment-Required`, `X-ACP-Requirements`, `X-AP2-Requirements`, `X-AGTP-Requirements`, and `X-Payment-Methods: tempo, x402, acp, ap2, agtp`.

Read the full OpenAPI spec with per endpoint protocol and pricing detail:

```bash
curl https://mpp32.org/openapi.json
```

Read the federated catalog directly:

```bash
curl https://mpp32.org/api/agent/services
```

Use the single execute endpoint that wraps every protocol:

```bash
curl -X POST https://mpp32.org/api/agent/execute \
  -H 'X-Agent-Key: mpp32_agent_…' \
  -H 'Content-Type: application/json' \
  -d '{"service":"mpp32-intelligence","method":"POST","body":{"token":"SOL"}}'
```

## For API providers

List your endpoint once and start receiving payment across every protocol automatically. MPP32 handles payment negotiation, on chain verification, discovery listings via OpenAPI and A2A and MCP standards, 24 hour health re checks, and a full analytics dashboard. Settlement lands in USDC or pathUSD directly to your wallet. Three consecutive verification failures suspend the listing so dead endpoints do not pollute the catalog.

Register at [mpp32.org/build](https://mpp32.org/build). Manage your listing at [mpp32.org/manage](https://mpp32.org/manage) using a recovery code delivered to your email.

## Security posture

MPP32 was built with the assumption that everything will eventually be probed.

* Production environment refuses to boot if the signing secret is missing or matches a known committed default.
* All outbound URLs from user submissions and agent execute calls run through an SSRF guard that blocks private, loopback, link local, IPv6 unique local, and cloud metadata addresses.
* Agent session API keys are hashed at rest using SHA256. A database leak does not surrender live credentials.
* AGTP agent identity uses HMAC SHA256 with a server held salt so signatures cannot be forged from a public agent id.
* Recovery one time codes refuse to issue in production when the email channel is not configured. Codes are never logged in plaintext when the system is configured correctly.
* The idempotency cache is bounded with LRU eviction. Admin endpoints are rate limited per IP on top of the secret check.

## Discovery endpoints

| Endpoint | Format | Purpose |
|:---------|:-------|:--------|
| `/openapi.json` | OpenAPI 3.1 | Full API spec with per endpoint protocol and pricing info |
| `/.well-known/agent.json` | A2A Agent Card | Agent to agent discovery with skills and auth schemes |
| `/api/mcp-config` | MCP Config | MCP compatible agent integration |
| `/api/submissions` | JSON | Public directory of all registered API providers |
| `/api/agent/services` | JSON | Federated catalog including native, curated, x402 bazaar, MCP registry |

## Stack

* Frontend: React 18, Vite, React Router v6, Tailwind, shadcn/ui, Framer Motion
* Backend: Hono on Bun, Zod validation, Prisma, SQLite
* Protocols: Mppx SDK (Tempo), in house verification (x402, AP2, ACP, AGTP)
* Distribution: npm (mpp32-mcp-server), official MCP registry, published agent card

## Links

| Resource | URL |
|:---------|:----|
| Website | [mpp32.org](https://mpp32.org) |
| Docs | [mpp32.org/docs](https://mpp32.org/docs) |
| Playground | [mpp32.org/playground](https://mpp32.org/playground) |
| Ecosystem | [mpp32.org/ecosystem](https://mpp32.org/ecosystem) |
| Agent Console | [mpp32.org/agent-console](https://mpp32.org/agent-console) |
| MCP package | [npmjs.com/package/mpp32-mcp-server](https://www.npmjs.com/package/mpp32-mcp-server) |
| MCP registry | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) |

## License

MIT
