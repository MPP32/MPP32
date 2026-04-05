# Architecture

A high-level overview of how MPP32 is built and how data flows through the system.

---

## Overview

MPP32 has two main components:

1. **Webapp** — React frontend handling the user-facing UI
2. **Backend** — Hono API server running the oracle, managing submissions, and enforcing payments

Both run on Bun for consistent performance across environments.

```
Browser
  │
  ▼
Webapp (React + Vite, port 8000)
  │  HTTP — relative URLs in prod, localhost:3000 in dev
  ▼
Backend (Hono + Bun, port 3000)
  ├── /api/intelligence    → Oracle pipeline
  ├── /api/submissions     → Ecosystem directory
  └── /api/proxy           → Hosted proxy gateway
```

---

## Oracle pipeline

When a query hits `/api/intelligence`, the backend runs this sequence:

```
Input (address or ticker)
  │
  ├─ 1. Resolve token
  │     └── DexScreener search → contract address + pair data
  │
  ├─ 2. Fetch price data
  │     ├── Jupiter Price API (primary)
  │     └── DexScreener pair price (fallback)
  │
  ├─ 3. CoinGecko enrichment (optional)
  │     └── Merge global volume, market cap, Twitter followers when available
  │
  ├─ 4. Score computation
  │     ├── Alpha score — weighted composite of momentum, volume, wallet signals
  │     ├── Rug risk — liquidity depth, pair age, ownership patterns
  │     ├── Whale activity — large wallet buy/sell events
  │     └── Pump probability — short-term momentum model
  │
  └─ 5. Format and return
        └── Standard envelope: { data: IntelligenceResponse }
```

The full pipeline completes in under 2 seconds under normal conditions. Upstream calls run in parallel where data dependencies allow.

---

## Payment layer

Paid queries go through `mppx` middleware before the route handler runs:

1. Reads the MPP session from the request
2. Validates the session against the MPP network
3. Deducts 0.008 pathUSD from the caller's balance
4. Routes payment to the configured Solana wallet
5. Passes the request through (or returns HTTP 402 if payment fails)

The demo endpoint (`/api/intelligence/demo`) bypasses payment middleware entirely and is rate-limited by IP instead.

---

## Data model

### Intelligence response

Defined as a Zod schema in `backend/src/types.ts`. This file is the single source of truth — the frontend imports from it to validate parsed API responses. No type drift between client and server.

### Ecosystem submissions

Stored in SQLite via Prisma in development; Postgres in production. See the schema in `backend/prisma/schema.prisma`.

---

## API contracts

All request/response shapes are Zod schemas in `backend/src/types.ts`. The frontend imports these directly, meaning every data shape has exactly one definition.

---

## Frontend state

| Concern | Approach |
|---------|----------|
| Server state | TanStack Query (caching, background refetch, loading states) |
| UI state | React `useState` |
| Persistence | `localStorage` for Dashboard query history |

---

## CORS

The backend uses a strict string-based origin allowlist. In development this includes `localhost:*`. In production it covers `mpp32.org`, `*.mpp32.org`, and the Vibecode preview domains. Credentials are included with requests, so the CORS response echoes the specific request origin — wildcard (`*`) is never used.

---

## Deployment

Two services behind a reverse proxy:

- **Frontend** — Static Vite build, served from a CDN-backed host
- **Backend** — Long-lived Bun process, auto-restarts on crash

Both services share environment variables defined at deploy time. The backend runs `prisma generate` and `prisma db push` automatically on startup.