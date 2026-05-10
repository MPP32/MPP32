<p align="center">
  <h1 align="center">MPP32</h1>
  <p align="center"><strong>The payment layer for AI agents</strong></p>
  <p align="center">
    <a href="https://www.npmjs.com/package/mpp32-mcp-server"><img src="https://img.shields.io/npm/v/mpp32-mcp-server.svg?style=flat-square&color=0052FF" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/mpp32-mcp-server"><img src="https://img.shields.io/npm/dm/mpp32-mcp-server.svg?style=flat-square&color=0052FF" alt="npm downloads"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-0052FF.svg?style=flat-square" alt="License: MIT"></a>
    <a href="https://mpp32.org"><img src="https://img.shields.io/badge/Website-mpp32.org-0052FF?style=flat-square" alt="Website"></a>
  </p>
</p>

One install. Five payment rails. Thousands of paid APIs your agent can reach without you setting up a single account.

## Why this beats running your own integrations

Most agent stacks stop at "the model can call a function." That works until the function costs money. The moment your agent needs premium data, a paid model, a trading signal, or a token analytics call, you are back to building accounts, storing API keys, watching budgets, and writing custom 402 handlers for every provider.

MPP32 replaces all of that with one MCP server. Your agent asks for a service by name. The server finds it in a federated catalog of thousands of machine payable APIs, negotiates the cheapest protocol, signs payment from a key on your own machine, and returns the data. You write zero billing code. You manage zero provider accounts. Your agent gets faster, cheaper, and reaches services other agents cannot touch.

## What your agent can do once this is installed

* Browse a live catalog of over 4,500 paid and free APIs across categories like token intelligence, market data, web search, image generation, embeddings, DeFi analytics, wallet scoring, on chain queries, and trading signals.
* Pay any provider in the catalog using whichever protocol fits, with settlement that lands in seconds.
* Run real time Solana token intelligence with alpha scoring, rug risk, whale flow, and 24 hour pump probability.
* Track every call, every dollar settled, and every protocol used from a dashboard at mpp32.org.
* Get an automatic 20 percent or 40 percent discount on native services for holding M32 once your wallet is verified.

## Payment rails it speaks natively

| Rail | Settles in | Network |
|:-----|:-----------|:--------|
| x402 | USDC | Solana |
| Tempo | pathUSD | Ethereum L2 |
| ACP | Checkout session | Multi chain |
| AP2 | W3C verifiable credentials | Chain agnostic |
| AGTP | HMAC signed agent certificates | Chain agnostic |

Every native endpoint accepts all five. The server picks whichever your wallet is funded for and falls back gracefully if the first attempt fails.

## Install

```bash
npx mpp32-mcp-server
```

### Claude Desktop, Claude Code, Cursor, Windsurf

Drop this into the MCP servers section of your client config.

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

Get an `MPP32_AGENT_KEY` at [mpp32.org/agent-console](https://mpp32.org/agent-console). No signup, no email, just a session form. With an agent key every call is attributed to your dashboard so you can see spend, success rate, and protocol breakdown. Without it the server still works but you only see native services and the calls stay anonymous.

`MPP32_SOLANA_PRIVATE_KEY` and `MPP32_PRIVATE_KEY` are only needed for paid services. Free services in the catalog work without any key.

## Configuration

| Variable | When you need it | What it does |
|:---------|:-----------------|:-------------|
| `MPP32_AGENT_KEY` | Recommended | Session key from mpp32.org/agent-console. Unlocks the full federated catalog and dashboard tracking. Also accepted as `MPP32_API_KEY`. |
| `MPP32_SOLANA_PRIVATE_KEY` | Paid x402 calls | Solana key used to sign USDC payments locally. |
| `MPP32_PRIVATE_KEY` | Paid Tempo calls | EVM key used to sign pathUSD payments locally on Ethereum L2. |
| `MPP32_API_URL` | Custom deployments | Override the API base URL. Defaults to `https://mpp32.org`. |

Private keys stay on your machine. They sign payments locally and never travel to MPP32 servers. Provide one or both for paid calls. If both are present, x402 is tried first and Tempo is used as a fallback.

## Tools your agent will see

### `list_mpp32_services`

Browse the federated catalog. Returns native, curated free, x402 bazaar, and MCP registry entries with pricing, supported protocols, and a clear flag on every row that tells the agent whether it can actually call the service through this MCP or whether the entry is for discovery only.

```json
{ "category": "token-scanner", "q": "solana", "source": "native" }
```

### `call_mpp32_endpoint`

Call any HTTP callable service in the catalog. Free services return immediately. Paid services return a 402 challenge that this tool signs and retries automatically when a payment key is configured.

```json
{
  "slug": "mpp32-intelligence",
  "method": "POST",
  "body": { "token": "SOL" }
}
```

Under the hood:

1. Send the request to `/api/agent/execute`.
2. If the service is free, hand the response back.
3. If the service is paid, read the 402 challenge.
4. Pick the protocol your wallet can satisfy.
5. Sign the transaction locally.
6. Retry with the receipt attached.
7. Return the data with the settled amount, the protocol used, and the on chain settlement signature.

No payment logic in your code. No per provider keys to juggle.

### `get_solana_token_intelligence`

Real time analysis of any Solana token. Pulls live data from DexScreener, Jupiter, and CoinGecko and merges it into one report. Returns an alpha score from 0 to 100, rug risk, whale activity, smart money signals, 24 hour pump probability, projected ROI ranges, and full market data. Costs $0.008 per call, paid automatically through x402 or Tempo when a key is set.

```json
{ "token": "BONK" }
```

M32 holders get tiered discounts (20 percent at 250k, 40 percent at 1M) the moment their wallet is verified at the agent console.

## How discovery works

MPP32 keeps a federated index of machine payable services so your agent can find what is out there without crawling every provider on its own. Four sources feed it.

| Source | What it is | Callable through this MCP |
|:-------|:-----------|:--------------------------|
| MPP32 native | APIs registered through mpp32.org/build. Verified, payable end to end. | Yes |
| Curated free | Hand maintained list of DexScreener, Jupiter, CoinGecko, OpenAI, and similar public APIs. | Yes when `MPP32_AGENT_KEY` is set |
| x402 Bazaar | Resources discovered through the Coinbase x402 facilitator. | Listing only. Pay providers directly via x402. |
| MCP Registry | Servers from the official Model Context Protocol registry. | No. Install via npx and run them as a separate stdio server. |

Every row in `list_mpp32_services` carries a callable flag so it stays obvious which slugs can be passed to `call_mpp32_endpoint`.

## Sessions for autonomous agents

For longer running workflows, MPP32 issues server side session keys with a 30 day expiry and full per call accounting. Sessions let an agent run inside a budget instead of negotiating payment every single call.

1. Create a session at [mpp32.org/agent-console](https://mpp32.org/agent-console) or by posting to `/api/agent/sessions`.
2. Get a key in the form `mpp32_agent_*`.
3. Put it in `MPP32_AGENT_KEY` in your MCP config, or send it as `X-Agent-Key` on direct API calls.
4. Watch spend, latency, and protocol mix live in the dashboard.

Sessions are scoped, revocable, and rotate cleanly. The key is hashed at rest on the server, so a database leak does not surrender live credentials.

## How payment verification actually works

x402 payments are verified on chain through the Solana facilitator. Tempo payments are verified cryptographically through the mppx SDK. ACP sessions are database backed with a real checkout flow. AP2 mandates use ECDSA P-256 signature verification. AGTP uses HMAC SHA256 signed agent certificates with a server held salt so signatures cannot be forged from a public agent id alone.

Every protocol has its own verification path. None of them are stubbed. MPP32 never holds custody of funds. Every paid call settles directly from the caller's wallet to the provider's wallet.

## For API providers

List your endpoint once and get paid through every protocol automatically. MPP32 handles the payment negotiation, the on chain verification, the discovery listings via OpenAPI and A2A and MCP standards, the 24 hour health re check, and the analytics dashboard. Settlement lands in USDC or pathUSD straight to your wallet.

Register at [mpp32.org/build](https://mpp32.org/build).

## Links

| Resource | URL |
|:---------|:----|
| Website | [mpp32.org](https://mpp32.org) |
| Documentation | [mpp32.org/docs](https://mpp32.org/docs) |
| Playground | [mpp32.org/playground](https://mpp32.org/playground) |
| Ecosystem | [mpp32.org/ecosystem](https://mpp32.org/ecosystem) |
| Agent Console | [mpp32.org/agent-console](https://mpp32.org/agent-console) |
| GitHub | [github.com/MPP32/MPP32](https://github.com/MPP32/MPP32) |

## License

MIT
