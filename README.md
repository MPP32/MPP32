<div align="center">

<br />

# MPP32

**Real-time Solana token intelligence, built on the Machine Payments Protocol.**

[![CI](https://github.com/MPP32/MPP32/actions/workflows/ci.yml/badge.svg)](https://github.com/MPP32/MPP32/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/MPP32/MPP32?color=orange)](https://github.com/MPP32/MPP32/releases)
[![Platform](https://img.shields.io/badge/Platform-Live-brightgreen)](https://mpp32.org)
[![Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Follow on X](https://img.shields.io/badge/Follow-%40MPP32__-black?logo=x)](https://x.com/MPP32_)

[**mpp32.org**](https://mpp32.org) &nbsp;·&nbsp; [Playground](https://mpp32.org/playground) &nbsp;·&nbsp; [Docs](https://mpp32.org/docs) &nbsp;·&nbsp; [Build on MPP32](https://mpp32.org/build) &nbsp;·&nbsp; [Roadmap](docs/ROADMAP.md)

</div>

---

**MPP32** is an open infrastructure layer for Solana token data, starting with a built-in intelligence oracle. Query any token by contract address or ticker and receive an 8-dimensional on-chain analysis in under two seconds — no API keys, no subscriptions. Callers pay per query through the [Machine Payments Protocol (HTTP 402)](https://mpp32.org/docs).

For builders, MPP32 doubles as a deployment platform: register any existing API endpoint, set a per-query price, and MPP32 wraps it with a full payment layer. Your service appears in the open [ecosystem directory](https://mpp32.org/ecosystem) and earns revenue from day one.

---

## What the Oracle returns

| Field | Description |
|---|---|
| `alphaScore` | 0–100 composite signal strength |
| `riskRewardRatio` | Potential upside vs downside at current price |
| `smartMoneySignals` | On-chain behavioral patterns from significant wallets |
| `pumpProbability24h` | Estimated probability of a notable price move in 24h |
| `projectedROI` | Low/high ROI range with estimated timeframe |
| `whaleActivity` | Recent buy/sell pressure from large holders |
| `rugRisk` | 0–10 score with specific risk factors identified |
| `marketData` | Price changes, volume, liquidity, pair age, FDV |

All 8 dimensions are returned in a single response. Data is sourced live from DexScreener, Jupiter, and CoinGecko and scored in real time — no cached responses, no stale data.

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
- Payments route directly to your Solana wallet
- Your service gets listed in the public ecosystem directory

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

**Data sources**
- [DexScreener](https://dexscreener.com) — DEX pair data and on-chain metrics
- [Jupiter Price API](https://jup.ag) — Aggregated Solana token prices
- [CoinGecko](https://coingecko.com) — Global market data and enriched metadata

---

## Running locally

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Steps

```bash
# Clone the repo
git clone https://github.com/MPP32/MPP32.git
cd MPP32

# Backend
cd backend
bun install
cp .env.example .env
bun run dev        # starts on http://localhost:3000

# Frontend (new terminal)
cd webapp
bun install
bun run dev        # starts on http://localhost:8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

All required environment variables are documented in [`.env.example`](.env.example).

---

## Project structure

```
MPP32/
├── webapp/                 # React frontend (Vite + Tailwind)
│   └── src/
│       ├── pages/          # Route-level page components
│       ├── components/     # Shared UI components
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities, API client
│
├── backend/                # Hono API server (Bun runtime)
│   └── src/
│       ├── routes/         # API route handlers
│       ├── types.ts        # Shared Zod schemas — single source of truth
│       └── index.ts        # App entry + middleware
│
└── docs/                   # Extended documentation
    ├── API.md
    ├── ARCHITECTURE.md
    ├── QUICKSTART.md
    └── ROADMAP.md
```

---

## Documentation

- [API Reference](docs/API.md) — Endpoints, request/response shapes, authentication, error codes
- [Architecture](docs/ARCHITECTURE.md) — How the oracle works, data pipeline, scoring model overview
- [Quickstart](docs/QUICKSTART.md) — From zero to first query in five minutes
- [Roadmap](docs/ROADMAP.md) — What's shipping next and what's planned through end of 2026

---

## Contributing

Bug reports, feature requests, and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
  <sub>
    Built by the MPP32 team &nbsp;·&nbsp;
    <a href="https://x.com/MPP32_">@MPP32_ on X</a> &nbsp;·&nbsp;
    <a href="https://mpp32.org">mpp32.org</a>
  </sub>
</div>
