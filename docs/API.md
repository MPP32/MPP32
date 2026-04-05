# API Reference

Base URL: `https://mpp32.org`

All application endpoints return a JSON envelope:

```json
{ "data": <value> }
```

Errors return:

```json
{ "error": { "message": "...", "code": "..." } }
```

---

## Health check

### `GET /health`

Returns server status. No authentication required.

**Response `200`**
```json
{ "status": "ok" }
```

---

## Intelligence

### `POST /api/intelligence/demo`

Free demo endpoint. Returns a full intelligence response for any Solana token. Rate limited per IP.

**Request body**
```json
{ "token": "SOL" }
```

`token` accepts a Solana contract address (base58) or ticker symbol (case-insensitive).

**Response `200`**
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
      "Accumulation from 3 tracked wallets",
      "Net positive flow over 6h"
    ],
    "pumpProbability24h": 61,
    "projectedROI": { "low": "12%", "high": "34%", "timeframe": "24-72h" },
    "whaleActivity": {
      "level": "Moderate",
      "recentBuys": 4,
      "recentSells": 1,
      "dominanceScore": 0.62
    },
    "rugRisk": { "score": 1, "level": "Very Low", "factors": [] },
    "marketData": {
      "priceChange24h": 3.8,
      "priceChange1h": 0.4,
      "priceChange7d": 11.2,
      "volume24h": 1840000000,
      "liquidity": 920000000,
      "marketCap": 81000000000,
      "fdv": 84000000000,
      "pairAge": 1420,
      "dexId": "raydium",
      "twitterFollowers": null
    },
    "summary": "Strong fundamentals with elevated buy-side pressure. Short-term momentum building.",
    "jupiterPrice": 172.38,
    "priceConfidence": "high",
    "coingeckoEnriched": true,
    "timestamp": "2026-04-01T14:22:00Z",
    "dataSource": "DexScreener"
  }
}
```

---

### `POST /api/intelligence`

Paid endpoint. Identical shape to the demo endpoint, but requires an active MPP session. Cost: **0.008 pathUSD per query**.

**Authentication**

Requests must include a valid MPP payment header. See [mpp32.org/docs](https://mpp32.org/docs) for session setup.

**Errors**

| Status | Code | Description |
|--------|------|-------------|
| `400` | `INVALID_TOKEN` | Token address or ticker could not be resolved |
| `402` | `PAYMENT_REQUIRED` | No valid MPP session or insufficient balance |
| `404` | `TOKEN_NOT_FOUND` | Token exists but has no tradeable pairs on supported DEXes |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `UPSTREAM_ERROR` | Upstream data source temporarily unavailable |

---

## Ecosystem Submissions

### `GET /api/submissions`

Returns all approved and featured ecosystem submissions.

**Response `200`**
```json
{
  "data": [
    {
      "id": "clz...",
      "name": "SolSentinel",
      "slug": "solsentinel",
      "shortDescription": "Real-time sentiment scoring for Solana tokens",
      "category": "sentiment-analysis",
      "websiteUrl": "https://solsentinel.xyz",
      "pricePerQuery": "0.002",
      "status": "approved",
      "queryCount": 1420,
      "createdAt": "2026-01-10T00:00:00Z"
    }
  ]
}
```

---

### `POST /api/submissions`

Submit a new service for listing in the ecosystem directory. Submissions are reviewed before appearing publicly.

**Request body**
```json
{
  "name": "My Service",
  "slug": "my-service",
  "shortDescription": "What your service does in one sentence",
  "fullDescription": "Detailed description of your service...",
  "category": "token-scanner",
  "websiteUrl": "https://myservice.xyz",
  "endpointUrl": "https://myservice.xyz/api/query",
  "pricePerQuery": "0.005",
  "paymentAddress": "YourSolanaWalletAddress",
  "creatorName": "Your Name",
  "creatorEmail": "you@example.com"
}
```

**Available categories:** `token-scanner`, `price-oracle`, `sentiment-analysis`, `data-feed`, `trading-signal`, `nft-intelligence`, `defi-analytics`, `other`

**Response `201`**
```json
{
  "data": {
    "id": "clz...",
    "status": "pending",
    "createdAt": "2026-04-01T00:00:00Z"
  }
}
```

---

### `GET /api/submissions/:id`

Returns a single submission by ID.

---

## Intelligence response field reference

| Field | Type | Description |
|---|---|---|
| `token.address` | `string` | Solana contract address |
| `token.name` | `string` | Token name |
| `token.symbol` | `string` | Ticker symbol |
| `token.priceUsd` | `number` | Current price in USD |
| `alphaScore` | `0–100` | Composite signal strength |
| `riskRewardRatio` | `string` | e.g. `"14.2:1"` |
| `smartMoneySignals` | `string[]` | On-chain behavioral signals |
| `pumpProbability24h` | `0–100` | % chance of notable price move in 24h |
| `projectedROI.low` | `string` | Conservative ROI estimate |
| `projectedROI.high` | `string` | Optimistic ROI estimate |
| `projectedROI.timeframe` | `string` | Estimated timeframe |
| `whaleActivity.level` | `string` | `Low` / `Moderate` / `High` |
| `whaleActivity.recentBuys` | `number` | Whale buy events in recent window |
| `whaleActivity.recentSells` | `number` | Whale sell events in recent window |
| `whaleActivity.dominanceScore` | `0–1` | Whale share of recent volume |
| `rugRisk.score` | `0–10` | Risk score (10 = highest risk) |
| `rugRisk.level` | `string` | Human-readable risk level |
| `rugRisk.factors` | `string[]` | Identified risk factors |
| `marketData.priceChange24h` | `number` | 24h price change % |
| `marketData.volume24h` | `number` | 24h trading volume in USD |
| `marketData.liquidity` | `number` | Pool liquidity in USD |
| `marketData.pairAge` | `number` | Trading pair age in days |
| `priceConfidence` | `string` | `high` / `medium` / `low` |
| `coingeckoEnriched` | `boolean` | Whether CoinGecko data was merged |
| `timestamp` | `ISO string` | Time the query was executed |
| `dataSource` | `string` | Primary data source used |