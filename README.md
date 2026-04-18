<div align="center">

<br />

# MPP32

**Real-time Solana token intelligence, built on the Machine Payments Protocol.**

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen)](https://mpp32.org)
[![Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Follow on X](https://img.shields.io/badge/Follow-%40MPP32__dev-black?logo=x)](https://x.com/MPP32_dev)

[**mpp32.org**](https://mpp32.org) &nbsp;&middot;&nbsp; [Playground](https://mpp32.org/playground) &nbsp;&middot;&nbsp; [Docs](https://mpp32.org/docs) &nbsp;&middot;&nbsp; [Build on MPP32](https://mpp32.org/build)

</div>

---

**MPP32** is an open infrastructure layer for Solana token data, starting with a built-in intelligence oracle. Query any token by contract address or ticker and receive an 8-dimensional on-chain analysis in under two seconds — no API keys, no subscriptions. Callers pay per query through the [Machine Payments Protocol (HTTP 402)](https://mpp32.org/docs).

For builders, MPP32 doubles as a deployment platform: register any existing API endpoint, set a per-query price, and MPP32 wraps it with a full payment layer. Your service appears in the open [ecosystem directory](https://mpp32.org/ecosystem) and earns revenue from day one.

---

## What the Oracle returns

| Field | Description |
|---|---|
| `alphaScore` | 0-100 composite signal strength |
| `riskRewardRatio` | Potential upside vs downside at current price |
| `smartMoneySignals` | On-chain behavioral patterns from significant wallets |
| `pumpProbability24h` | Estimated probability of a notable price move in 24h |
| `projectedROI` | Low/high ROI range with estimated timeframe |
| `whaleActivity` | Recent buy/sell pressure from large holders |
| `rugRisk` | 0-10 score with specific risk factors identified |
| `marketData` | Price changes, volume, liquidity, pair age, FDV |

All 8 dimensions are returned in a single response. Data is sourced from multiple on-chain and market feeds and scored in real time — no cached responses, no stale data.

---

## Quick start

### Try the Playground

The fastest path: head to [mpp32.org/playground](https://mpp32.org/playground), paste any Solana contract address or ticker, and hit **Run Query**. No wallet needed for the demo.

### Call the demo endpoint

```bash
curl -X POST https://mpp32.org/api/intelligence/demo \
  -H "Content-Type: application/json" \
  -d '{ "token": "SOL" }'
```

**Example response:**

```json
{
  "data": {
    "token": {
      "address": "So11111111111111111111111111111111111111112",
      "name": "Wrapped SOL",
      "symbol": "SOL",
      "priceUsd": 172.43
    },
    "alphaScore": 74,
    "riskRewardRatio": "8.2:1",
    "smartMoneySignals": [
      "Accumulation detected from 3 tracked wallets",
      "Net positive flow over last 6h"
    ],
    "pumpProbability24h": 61,
    "projectedROI": { "low": "12%", "high": "34%", "timeframe": "24-72h" },
    "rugRisk": { "score": 1, "level": "Very Low", "factors": [] },
    "summary": "Strong fundamentals with elevated buy-side pressure. Short-term momentum building.",
    "timestamp": "2026-04-01T14:22:00Z"
  }
}
```

For paid queries with full data depth, see the [API reference](docs/API.md).

---

## Building on MPP32

Anyone can list a service in the MPP32 ecosystem. If you have a data API — token scanners, sentiment feeds, wallet scoring, NFT analytics — register it at [mpp32.org/build](https://mpp32.org/build) and start monetizing immediately.

- Zero infrastructure changes — MPP32 wraps your existing endpoint
- You set the price per query in pathUSD
- Payments route directly to your wallet
- Your service gets listed in the public ecosystem directory
- Endpoint is validated on submission — only working APIs get listed

---

## Tech stack

**Frontend**
- React 18 + Vite
- TypeScript
- Tailwind CSS + shadcn/ui
- Framer Motion
- TanStack Query (React Query)

**Backend**
- [Hono](https://hono.dev) on Bun
- Prisma ORM
- Zod schema validation
- `mppx` — Machine Payments Protocol middleware

**Intelligence**
- Proprietary multi-source scoring engine
- Real-time on-chain data aggregation
- Sub-2-second response time

---

## Repository structure

```
backend/
  src/
    index.ts            # Hono app entry, middleware, CORS, route mounting
    types.ts            # Zod schemas — shared API contracts
    routes/
      submissions.ts    # Provider registration + management endpoints
      proxy.ts          # MPP payment-gated proxy layer
    lib/
      mpp.ts            # mppx middleware integration
      validator.ts      # Endpoint validation (reachability + API check)
      fetch.ts          # HTTP client utilities
  prisma/
    schema.prisma       # Database schema (submissions, providers)

webapp/
  src/
    pages/              # React Router pages
    components/         # UI components (build, ecosystem, home, layout)
    lib/
      api.ts            # Typed API client with auto-unwrap
      categories.ts     # 47-category taxonomy for the ecosystem
    hooks/              # Custom React hooks
```

---

## Contributing

Bug reports, feature requests, and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

If you discover a vulnerability, please report it responsibly. See [SECURITY.md](SECURITY.md).

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
  <sub>
    Built by the MPP32 team &nbsp;&middot;&nbsp;
    <a href="https://x.com/MPP32_dev">@MPP32_dev on X</a> &nbsp;&middot;&nbsp;
    <a href="https://mpp32.org">mpp32.org</a>
  </sub>
</div>
