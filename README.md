# MPP32

**The payment layer for AI agents.** One install. Pay any x402 endpoint on Solana or Base from your agent. Browse a federated index of thousands of machine payable APIs without a single provider account.

[![npm version](https://img.shields.io/npm/v/mpp32-mcp-server.svg?style=flat-square&color=0052FF)](https://www.npmjs.com/package/mpp32-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-0052FF.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-mpp32.org-0052FF?style=flat-square)](https://mpp32.org)

> Built and maintained by a small team using AI-augmented development. See [AUTHORS.md](./AUTHORS.md) · [SECURITY.md](./SECURITY.md) · [CONTRIBUTING.md](./CONTRIBUTING.md).

## Repository scope

This repository contains the full source for the four MPP32 components:

- `backend/` — Hono on Bun, Prisma, SQLite. Federated catalog, agent execute, payment proxies for all five protocols.
- `mcp-server/` — the `mpp32-mcp-server` package published to npm.
- `sdk/` — client SDK.
- `webapp/` — React + Vite frontend served at [mpp32.org](https://mpp32.org).

The hosted deployment at `mpp32.org` runs this source plus operational
infrastructure (TLS termination, CDN, managed database, monitoring,
hosted analytics, and provider API keys for third-party data sources)
that is configuration, not source.

## Why this exists

Most agent stacks stop at "the model can call a function." That works until the function costs money. The moment your agent needs premium data, a paid model, a trading signal, or a token analytics call, you are back to building accounts, storing API keys, watching budgets, and writing custom 402 handlers for every provider.

MPP32 replaces all of that. Your agent asks for a service by name. The proxy finds it in a federated catalog of thousands of machine payable APIs, signs payment with a key on your own machine, and returns the data. You write zero billing code. You manage zero provider accounts. Settlement lands on chain in seconds. MPP32 never touches the money.

## Free Tier: 10 calls/day, no wallet required

Every agent session gets **10 free Intelligence Oracle calls per day** — no wallet, no USDC, no payment setup. Just set `MPP32_AGENT_KEY` (free instant signup at [mpp32.org/agent-console](https://mpp32.org/agent-console)) and call `get_solana_token_intelligence`. Resets at midnight UTC.

Test your full MCP integration end-to-end before committing any crypto. Build working prototypes, evaluate the data quality, and ship to production — the free tier covers typical development and light usage indefinitely.

## What an agent gains the moment it connects

* **10 free Intelligence Oracle calls per day** — no wallet, no USDC, no payment setup needed.
* A live catalog of over 4,500 paid and free APIs across token intelligence, market data, web search, image generation, embeddings, DeFi analytics, wallet scoring, on chain queries, trading signals, and more.
* Automatic x402 payment on Solana (USDC) and Base (USDC), picked per call based on which signing key you configured.
* Real time Solana token intelligence with alpha scoring, rug risk, whale flow, smart money signals, and 24 hour pump probability.
* A dashboard at mpp32.org that tracks every call, every dollar settled, every protocol used, every latency reading.
* End to end audit. Every settlement comes back with an on chain signature you can verify on Solscan or Basescan.
* **Delegated Spend Keys** — mint scoped, capped, revocable child keys so one agent can safely pay another. See below.

## Delegated Spend Keys — the payment primitive for agents hiring agents

Everyone talks about "the agent economy where agents hire other agents." Almost nobody ships the payment rails for it. MPP32 does.

A parent agent session can mint a **Delegated Spend Key** — a scoped, capped, revocable child key — and hand it to a sub-agent it spawns or a third-party agent it hires. The child pays through MPP32 exactly like any session, but inside a hard boundary the parent defines:

* **Scoped.** The child may only pay for services on an allowlist you set. A key issued for image generation can't be turned into a trading-signal spender. Scopes only narrow down the chain — a child can never widen what its parent allowed.
* **Capped.** Each key gets its own budget, hourly velocity limit, and per-call ceiling. A single call quoted above the ceiling is refused before any money moves.
* **Rolled up.** Every dollar a child settles counts against the parent's budget. An ancestor's budget is enforced against the settled spend of its *entire* delegation subtree, so a runaway sub-agent can never push a parent past its cap. Exhaust the parent and every key beneath it is suspended at once.
* **Revocable.** Kill a key and its whole subtree stops spending immediately — cascading to every key it minted. Pause an ancestor and everything below it pauses too.
* **Auditable.** Every delegated settlement still lands on chain with a signature, and every child traces back to the parent that authorized it.

MPP32 never holds custody. A delegated key only scopes and caps *which* paid calls a sub-agent can make — settlement is still signed by the wallet the agent controls.

```
# Parent mints a $3, image-only child key with a 2¢ per-call ceiling
POST /api/agent/sessions/:id/delegate
  X-Agent-Key: <parent key>
  { "label": "image-subtask", "budgetLimitUsd": 3, "maxPricePerCallUsd": 0.02, "allowedServices": ["replicate-flux"] }
→ 201 { "apiKey": "mpp32_agent_…", "childSessionId": "…", "delegationDepth": 1 }

# List what a session has delegated, with spend rolled up per key
GET  /api/agent/sessions/:id/delegations

# Revoke a key (and everything it minted) instantly
POST /api/agent/delegations/:childId/revoke   { "reason": "task complete" }
```

Manage it all visually in the [Agent Console](https://mpp32.org/agent-console).

## Payment rails

| Rail | Status | Settles in | Network | Verification |
|:-----|:-------|:-----------|:--------|:-------------|
| x402 | Production | USDC | Solana mainnet | Solana facilitator |
| x402 | Production | USDC | Base | Base facilitator |
| Tempo | Production | pathUSD | Tempo | mppx on chain verification, signers in the MPP32 SDK and MCP server |
| AGTP | Production (identity layer) | Agent certificates | Chain agnostic | HMAC SHA256 |
| AP2 | Envelope wired, disabled in production | Verifiable credentials | Chain agnostic | ECDSA P-256 |
| ACP | Envelope wired, disabled in production | Checkout session | Multi chain | Database backed flow |

x402 on Solana and Base, Tempo, and AGTP are live in production. Tempo payments are signed client side by the MPP32 SDK (`tempoPrivateKey`) or the MCP server (`MPP32_PRIVATE_KEY`) and verified on chain by mppx. AP2 stays gated off until a trusted-issuer allowlist (`AP2_TRUSTED_ISSUERS`) is configured — without it, mandate verification fails closed and every request would be rejected. ACP stays gated off until its checkout session client flow is verified end to end.

## Install

The MCP server is on npm and listed in the [official Model Context Protocol registry](https://registry.modelcontextprotocol.io).

```bash
npx -y mpp32-mcp-server@latest
```

Drop this into the MCP servers section of Claude Desktop, Claude Code, Cursor, Windsurf, or any MCP compatible client.

```json
{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["-y", "mpp32-mcp-server@latest"],
      "env": {
        "MPP32_AGENT_KEY": "mpp32_agent_…",
        "MPP32_SOLANA_PRIVATE_KEY": "<your base58 Solana secret key>"
      }
    }
  }
}
```

`MPP32_SOLANA_PRIVATE_KEY` is the **base58 encoded 64 byte Solana secret key** — the value Phantom exports under **show private key**, not the seed phrase. From a `keypair.json` file run `node -e "console.log(require('bs58').encode(Buffer.from(JSON.parse(require('fs').readFileSync('keypair.json')))))"` once and paste the result.

The wallet needs both USDC (for the payment) and a small amount of native SOL (for transaction fees). About `0.001 SOL` covers many calls. A USDC only wallet returns `insufficient funds for rent`.

Get an `MPP32_AGENT_KEY` at [mpp32.org/agent-console](https://mpp32.org/agent-console). The form returns the key and a ready to paste config snippet. With an agent key every call is attributed to your dashboard. Without it the server still works but only on free services. Private keys never leave your machine.

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

The response includes the x402 `Payment-Required` envelope, the Tempo `WWW-Authenticate` challenge, and an `X-Payment-Methods` advertisement listing every enabled rail (`tempo, x402, agtp`). AP2 and ACP stay gated off in production; flip the matching `*_ENABLED` env var in `backend/.env` to test them locally.

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

List your endpoint once and start receiving x402 payment automatically. MPP32 handles the payment negotiation, on chain verification, discovery listings via OpenAPI and A2A and MCP standards, periodic health re checks, and a full analytics dashboard. Settlement lands in USDC on Solana or Base directly to your wallet. Three consecutive verification failures suspend the listing so dead endpoints do not pollute the catalog.

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
