# MPP32

Universal payment proxy for API providers and AI agents.

API providers register once. AI agents pay using any of 5 protocols. MPP32 sits in between: it verifies payments, translates between protocols, and routes revenue directly to the provider's wallet. The provider's real endpoint stays private behind the proxy.

## Protocols

MPP32 verifies and routes payments across all five major agent payment protocols:

| Protocol | What it does | Standard |
|----------|-------------|----------|
| **Tempo** | Micropayments in pathUSD on Ethereum L2. HTTP 402 challenge/response with `WWW-Authenticate` header. | [Mppx](https://tempo.xyz) |
| **x402** | USDC payments on Solana. The agent sends a signed transaction in the `X-Payment` header. | [x402](https://www.x402.org) |
| **AP2** | Authorization via W3C Verifiable Credentials. Agents present signed mandates (intent, cart, or payment) in `X-AP2-Mandate`. ECDSA P-256 signature validation. | Agent Pay Protocol v2 |
| **ACP** | Session-based checkout flow. Agent opens a session, commits payment, and passes the session ID in `X-ACP-Session`. | [Agent Commerce Protocol](https://www.agentcommerce.org) |
| **AGTP** | Agent identity and intent tracking. Agents declare themselves via `Agent-ID` header with principal, scope, and budget constraints. | [AGTP draft spec](https://datatracker.ietf.org/doc/draft-hood-independent-agtp/) |

All five are active on every registered endpoint. When an agent hits a proxy endpoint without payment, MPP32 returns HTTP 402 with challenge headers for each protocol so the agent can choose how to pay.

## How it works

1. **Provider registers** their API on `/build`. They provide: endpoint URL, price per query (USD), EVM wallet address, optional Solana address, and metadata (description, logo, category).

2. **MPP32 assigns a proxy URL** at `/api/proxy/{slug}`. The real endpoint URL is never exposed to agents.

3. **Provider verifies ownership** by serving a challenge token at `/.well-known/mpp32-verify` on their domain. MPP32 re-verifies every 24 hours. Three consecutive failures suspend the listing.

4. **Agents discover APIs** via the OpenAPI spec at `/openapi.json`, the agent card at `/.well-known/agent.json`, or the MCP config at `/api/mcp-config`.

5. **Agent sends a request** to the proxy URL. If no payment header is present, MPP32 returns 402 with protocol-specific challenge headers. The agent picks a protocol, attaches payment, and retries.

6. **MPP32 verifies payment** using the relevant protocol library, then forwards the request to the provider's real endpoint. Response goes back to the agent. Revenue settles to the provider's wallet.

## Verify it yourself

The protocol integrations are not marketing claims. They are running in production. You can verify them against any registered endpoint:

**See the 402 challenge with all protocol headers:**
```
curl -i https://mpp32.org/api/proxy/mpp32-intelligence
```

The response headers will include:
- `WWW-Authenticate` (Tempo)
- `Payment-Required` (x402)
- `X-ACP-Requirements` + `X-ACP-Supported` (ACP)
- `X-AP2-Requirements` + `X-AP2-Supported` (AP2)
- `X-AGTP-Requirements` (AGTP)
- `X-Payment-Methods: tempo, x402, acp, ap2, agtp`

**Read the OpenAPI spec listing every registered provider with protocol details:**
```
curl https://mpp32.org/openapi.json
```

Each endpoint in the spec includes an `x-payment-info` object with the exact protocol parameters, pricing, and network details.

**Agent discovery card (A2A format):**
```
curl https://mpp32.org/.well-known/agent.json
```

**List all registered APIs:**
```
curl https://mpp32.org/api/submissions
```

## Provider management

Providers get a management dashboard at `/manage` where they can:

- View query count, estimated revenue, success rate, and average latency
- Update pricing, wallet addresses, descriptions, and social links
- Monitor endpoint verification status
- Deprecate their listing if needed
- Recover their management credentials via email verification

## Built-in intelligence oracle

MPP32 runs its own API on the same infrastructure to prove the system works end to end.

`POST /api/intelligence` accepts any Solana token address or ticker and returns 8 fields: alpha score, risk-reward ratio, smart money signals, 24h pump probability, projected ROI, whale activity, rug risk score, and live market data. Sources: DexScreener, Jupiter Price API, CoinGecko. Response time under 2 seconds.

This endpoint accepts all 5 protocols like any other provider on the platform.

## Discovery endpoints

| Endpoint | Format | Purpose |
|----------|--------|---------|
| `/openapi.json` | OpenAPI 3.1 | Full API spec with per-endpoint protocol and pricing info |
| `/.well-known/agent.json` | A2A Agent Card | Agent-to-agent discovery with skills and auth schemes |
| `/api/mcp-config` | MCP Config | MCP-compatible agent integration |
| `/api/submissions` | JSON | Public directory of all registered API providers |

## Stack

- **Frontend:** React 18, Vite, React Router v6, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** Hono on Bun, Zod validation, Prisma ORM, SQLite
- **Protocols:** Mppx SDK (Tempo), custom verification libraries (x402, AP2, ACP, AGTP)
