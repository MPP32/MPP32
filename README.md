# MPP32

Universal payment proxy for API providers and AI agents.

API providers register once, set a price, and start earning from every AI agent that calls their API. MPP32 handles the hard part: verifying payments across 5 different protocols, translating between them, and routing revenue directly to the provider's wallet. The provider's real endpoint URL stays private behind the proxy.

No payment SDKs to integrate. No protocol-specific code. One registration, every protocol works automatically.

## Five Protocols, One Integration

MPP32 verifies and routes payments across all five major agent payment protocols in production today:

| Protocol | What it does | Standard |
|----------|-------------|----------|
| **Tempo** | Micropayments in pathUSD on Ethereum L2. HTTP 402 challenge/response via `WWW-Authenticate` header. | [Tempo](https://tempo.xyz) |
| **x402** | USDC payments on Solana. Agent sends a signed transaction via the `X-Payment` header. | [x402](https://www.x402.org) |
| **AP2** | Authorization through W3C Verifiable Credentials. Agents present signed mandates (intent, cart, or payment) via `X-AP2-Mandate`. ECDSA P-256 signature validation. | Agent Pay Protocol v2 |
| **ACP** | Session-based checkout. Agent opens a session, commits payment, passes the session ID via `X-ACP-Session`. | [Agent Commerce Protocol](https://www.agentcommerce.org) |
| **AGTP** | Agent identity and intent declaration. Agents identify themselves via `Agent-ID` header with principal, authority scope, and budget constraints. | [AGTP IETF Draft](https://datatracker.ietf.org/doc/draft-hood-independent-agtp/) |

When an agent calls a proxy endpoint without a payment header, MPP32 returns HTTP 402 with challenge headers for every active protocol. The agent picks whichever protocol it supports, attaches payment, and retries. One round trip, done.

## How It Works for Providers

**1. Register your API** at [mpp32.org/build](https://mpp32.org/build). Provide your endpoint URL, price per query in USD, EVM wallet address, optional Solana address, and basic metadata (name, category, description).

**2. Get your proxy URL.** MPP32 assigns a public URL at `api.mpp32.org/api/proxy/{your-slug}`. Your real endpoint is never exposed. Agents only see the proxy.

**3. Verify you own the endpoint.** Serve a challenge token at `/.well-known/mpp32-verify` on your domain. MPP32 re-checks every 24 hours. Three consecutive failures suspend the listing until you fix it.

**4. Agents find you** through the OpenAPI spec at `/openapi.json`, the A2A agent card at `/.well-known/agent.json`, or the MCP config at `/api/mcp-config`. Your API shows up with full protocol and pricing details.

**5. Get paid per query.** When agents call your proxy URL, MPP32 verifies their payment, forwards the request to your endpoint, and routes revenue to your wallet. You earn 100% of the query price.

## Provider Dashboard

Every registered provider gets a management dashboard at `/manage`:

- Query volume, estimated revenue, success rate, and average response latency
- Update pricing, wallet addresses, descriptions, and social links at any time
- Endpoint verification status and health monitoring
- Full credential recovery via email verification

## Verify the Protocols Yourself

These are not marketing claims. All five protocols are running in production and you can verify them with a single curl command:

**Hit any proxy endpoint without payment to see the 402 challenge:**
```
curl -i https://api.mpp32.org/api/proxy/mpp32-intelligence
```

The response headers include:
- `WWW-Authenticate` — Tempo challenge
- `Payment-Required` — x402 challenge (USDC on Solana)
- `X-ACP-Requirements` + `X-ACP-Supported` — ACP session details
- `X-AP2-Requirements` + `X-AP2-Supported` — AP2 credential requirements
- `X-AGTP-Requirements` — AGTP agent identity spec
- `X-Payment-Methods` — comma-separated list of accepted protocols

**Read the full OpenAPI spec with per-endpoint protocol details:**
```
curl https://api.mpp32.org/openapi.json
```
Every registered provider appears with exact protocol parameters, pricing, and network details in the `x-payment-info` field.

**Agent discovery (A2A format):**
```
curl https://api.mpp32.org/.well-known/agent.json
```

**Browse all registered APIs:**
```
curl https://api.mpp32.org/api/submissions
```

## Discovery and Integration

Agents and agent frameworks can discover MPP32 providers through standard protocols:

| Endpoint | Format | What it provides |
|----------|--------|-----------------|
| `/openapi.json` | OpenAPI 3.1 | Full spec with per-endpoint protocol parameters and pricing |
| `/.well-known/agent.json` | A2A Agent Card | Agent-to-agent discovery with skills and supported auth schemes |
| `/api/mcp-config` | MCP Config | Claude Desktop and MCP server integration config |
| `/api/submissions` | JSON | Public directory of all verified API providers |

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│  AI Agent    │── ① ──▶│     MPP32        │── ③ ──▶│  Provider    │
│              │         │                  │         │  Endpoint    │
│  Pays via    │◀─ 402 ─│  Verify payment  │◀─ ④ ──│              │
│  any of 5    │── ② ──▶│  Forward request │         │  (private)   │
│  protocols   │         │  Route revenue   │         │              │
└─────────────┘         └──────────────────┘         └──────────────┘

① Agent requests data → no payment header → 402 with challenge headers
② Agent retries with payment in the protocol of its choice
③ MPP32 verifies payment, forwards to real endpoint
④ Response returns through proxy to agent. Revenue settles to provider wallet.
```

The proxy model means:
- Provider endpoints stay private. Agents never see the real URL.
- Providers write zero payment code. MPP32 handles all 5 protocols.
- Every request is logged with protocol used, latency, status, and payment verification.
- Automatic retry with backoff for transient upstream failures.
- Idempotency enforcement on paid requests (10 minute window).
- Endpoint ownership re-verified every 24 hours.

## What Providers Get

| Capability | Details |
|-----------|---------|
| **5 payment protocols** | Tempo, x402, AP2, ACP, AGTP. All active by default on every endpoint. |
| **Endpoint privacy** | Your real URL is never exposed. Agents only interact with the proxy. |
| **Ownership verification** | HTTP challenge-response at `/.well-known/mpp32-verify`. Auto-reverified daily. |
| **Management dashboard** | Real-time stats, settings, verification status. Token-based auth. |
| **Credential recovery** | Email-based OTP flow. New management token issued, old one invalidated. |
| **70+ categories** | From AI inference and DeFi analytics to weather APIs and OCR services. |
| **OpenAPI discovery** | Every provider appears in the spec with full protocol and pricing metadata. |
| **Automatic retries** | Transient upstream failures (5xx) retried automatically with backoff. |
| **Request logging** | Full audit trail: protocol, latency, status code, payment verification. |

## Stack

- **Runtime:** Bun
- **Backend:** Hono, Zod, Prisma ORM
- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui
- **Protocols:** Mppx SDK (Tempo), custom verification libraries (x402, AP2, ACP, AGTP)
