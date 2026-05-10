<p align="center">
  <h1 align="center">MPP32</h1>
  <p align="center"><strong>The API marketplace for AI agents</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/mpp32-mcp-server"><img src="https://img.shields.io/npm/v/mpp32-mcp-server.svg?style=flat-square&color=0052FF" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/mpp32-mcp-server"><img src="https://img.shields.io/npm/dm/mpp32-mcp-server.svg?style=flat-square&color=0052FF" alt="npm downloads"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-0052FF.svg?style=flat-square" alt="License: MIT"></a>
    <a href="https://mpp32.org"><img src="https://img.shields.io/badge/Website-mpp32.org-0052FF?style=flat-square" alt="Website"></a>
  </p>
</p>

One MCP server. Five payment protocols. An indexed catalog of thousands of machine payable services. Install once and your agent can discover, pay for, and call APIs across the ecosystem with no accounts and no manual key juggling.

## What it does

Agents need to pay for premium data and services. Today that requires a human to set up accounts, store keys, and wire up billing for every provider. MPP32 replaces that with a single proxy.

```
   AI Agent  ──>  MPP32  ──>  API Provider
              402         pay
              retry       data
```

Five payment protocols are negotiated automatically. Settlement is instant. The provider gets paid in their preferred asset.

## Payment protocols

| Protocol | Settlement | Network |
|:---------|:-----------|:--------|
| x402 | USDC | Solana |
| Tempo | pathUSD | Ethereum L2 |
| ACP | Checkout sessions | Multi chain |
| AP2 | W3C Verifiable Credentials | Chain agnostic |
| AGTP | HMAC signed agent certs | Chain agnostic |

Every native endpoint accepts all five. Your agent picks whichever it has a key for.

## Install

```bash
npx mpp32-mcp-server
```

### Claude Desktop and Claude Code

```json
{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_SOLANA_PRIVATE_KEY": "your_solana_private_key_for_usdc"
      }
    }
  }
}
```

### Cursor, Windsurf, and other MCP clients

Same config shape. Add `mpp32` to your MCP server list with at least one payment key.

## Tools

Three tools any MCP compatible agent can call.

### `list_mpp32_services`

Browse the marketplace. Returns names, categories, pricing, and proxy URLs for services registered through MPP32.

```typescript
{ category: "token-scanner" }
```

Categories include ai inference, token scanner, price oracle, web search, trading signal, defi analytics, wallet intelligence, on chain data, market data, image generation, embeddings, and more.

### `get_solana_token_intelligence`

Real time analysis of any Solana token. Pulls from DexScreener, Jupiter, and CoinGecko and returns a single report.

```typescript
{ token: "BONK" }
```

Returns alpha score (0 to 100), rug risk, whale activity, smart money signals, 24h pump probability, projected ROI ranges, and full market data. Costs $0.008 per call. Paid automatically through x402 or Tempo.

M32 token holders are eligible for tiered discounts (20 percent at 250k, 40 percent at 1M) once the wallet is verified through the [agent console](https://mpp32.org/agent-console).

### `call_mpp32_endpoint`

Call any service registered with MPP32. The tool handles the full HTTP 402 flow.

```typescript
{
  slug: "mpp32-intelligence",
  method: "POST",
  body: "{\"token\": \"SOL\"}"
}
```

What happens under the hood:

1. Send the request to the proxy
2. Receive the 402 with payment challenge headers
3. Pick the best protocol your wallet can satisfy
4. Sign the transaction locally
5. Retry with the receipt attached
6. Hand the response back to the agent

No payment logic in your code. No API keys. No accounts.

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `MPP32_SOLANA_PRIVATE_KEY` | Recommended | Solana key for x402 payments in USDC. Fastest settlement. |
| `MPP32_PRIVATE_KEY` | Alternative | EVM key for Tempo payments in pathUSD on Ethereum L2. |
| `MPP32_API_URL` | No | Override the API base URL. Defaults to `https://mpp32.org`. |

Private keys stay on your machine. They are used to sign payments locally and are never sent to MPP32 servers. Provide one or both. If both are set, the server falls back automatically when one fails.

## Catalog and discovery

MPP32 keeps a federated catalog of machine payable services so agents can find what is available without crawling every provider individually. Four sources feed it.

| Source | What it is | How it gets in |
|:-------|:-----------|:---------------|
| MPP32 native | APIs registered through `/build`. Payable end to end via the MCP server with all five protocols. | Provider submits, ownership is verified by domain challenge, re checked every 24 hours. |
| x402 Bazaar | Resources discovered through the Coinbase x402 facilitator. Listing only. Pay providers directly via x402. | Crawled from the Coinbase CDP discovery API. |
| MCP Registry | Servers from the official Model Context Protocol registry. Listing only. Install via npx and standard MCP transports. | Crawled from `registry.modelcontextprotocol.io`. |
| Curated | Hand verified providers including Firecrawl, OpenAI, Anthropic, Alchemy, CoinGecko, Exa, official MCP servers, and free test endpoints. | Maintained in repo, refreshed each catalog run. |

Each entry tracks its source, supported protocols, network, base price, category, and a verification flag.

Discovery endpoints any agent framework can read.

| Standard | Endpoint | Purpose |
|:---------|:---------|:--------|
| OpenAPI 3.1 | [`/openapi.json`](https://mpp32.org/openapi.json) | Full API specification with payment metadata |
| A2A Agent Card | [`/.well-known/agent.json`](https://mpp32.org/.well-known/agent.json) | Agent to agent capability discovery |
| MCP Config | [`/api/mcp-config`](https://mpp32.org/api/mcp-config) | Model Context Protocol server configuration |
| Service directory | [`/api/submissions`](https://mpp32.org/api/submissions) | Native MPP32 registered services |
| Federated catalog | [`/api/agent/services`](https://mpp32.org/api/agent/services) | Native, curated, and crawled services with filters |
| Catalog stats | [`/api/catalog/stats`](https://mpp32.org/api/catalog/stats) | Source breakdown and last refresh timestamps |

## Agent sessions

For longer running workflows, MPP32 supports server issued API keys with a budget cap and a preferred protocol. Sessions let an agent run autonomously inside a spend limit instead of negotiating payment on every call.

1. Create a session at [mpp32.org/agent-console](https://mpp32.org/agent-console) or via `POST /api/agent/sessions`
2. Get back an API key in the form `mpp32_agent_*`
3. Pass it as `X-Agent-Key` on subsequent requests
4. Track spend, transactions, and remaining budget from the dashboard

Sessions are scoped, revocable, and expire after 30 days. The MCP server works fine without one. Sessions are an optional layer for scripted or long lived agent runs.

## How payment verification actually works

x402 payments are verified on chain through the Solana facilitator. Tempo payments are verified cryptographically through the mppx SDK. ACP sessions are database backed with a checkout flow. AP2 mandates use ECDSA P 256 signature verification. AGTP requires HMAC SHA 256 signed agent certificates.

Each protocol has its own verification path. None of them are stubbed.

## For API providers

List your endpoint once and get paid through every protocol automatically. MPP32 handles:

- Payment negotiation and verification across all five protocols
- Endpoint health monitoring with 24 hour re verification
- Discovery listing via OpenAPI, A2A, and MCP standards
- Analytics dashboard with query counts, revenue, and latency metrics
- USDC and pathUSD settlement directly to your wallet

Register at [mpp32.org/build](https://mpp32.org/build).

## Links

| Resource | URL |
|:---------|:----|
| Website | [mpp32.org](https://mpp32.org) |
| Documentation | [mpp32.org/docs](https://mpp32.org/docs) |
| API Playground | [mpp32.org/playground](https://mpp32.org/playground) |
| Ecosystem | [mpp32.org/ecosystem](https://mpp32.org/ecosystem) |
| Agent Console | [mpp32.org/agent-console](https://mpp32.org/agent-console) |
| GitHub | [github.com/MPP32/MPP32](https://github.com/MPP32/MPP32) |

## License

MIT
