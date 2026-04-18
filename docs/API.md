# MPP32 API Reference

Base URL: `https://mpp32.org`

All endpoints return JSON. Authenticated endpoints use the Machine Payments Protocol (HTTP 402).

---

## Intelligence Oracle

### `POST /api/intelligence/demo`

Free demo endpoint. Returns intelligence data with limited depth.

**Request:**

```json
{
  "token": "SOL"
}
```

The `token` field accepts either a Solana contract address or ticker symbol.

**Response:**

```json
{
  "data": {
    "token": {
      "address": "So11111111111111111111111111111111111111112",
      "name": "Wrapped SOL",
      "symbol": "SOL",
      "priceUsd": "172.43"
    },
    "alphaScore": 74,
    "riskRewardRatio": "8.2:1",
    "smartMoneySignals": [
      "Accumulation detected from 3 tracked wallets",
      "Net positive flow over last 6h"
    ],
    "pumpProbability24h": 61,
    "projectedROI": {
      "low": "12%",
      "high": "34%",
      "timeframe": "24-72h"
    },
    "whaleActivity": {
      "level": "moderate",
      "recentBuys": 12,
      "recentSells": 4,
      "dominanceScore": 68
    },
    "rugRisk": {
      "score": 1,
      "level": "minimal",
      "factors": []
    },
    "marketData": {
      "priceChange24h": 5.2,
      "priceChange1h": 0.8,
      "priceChange7d": 12.1,
      "volume24h": 2400000000,
      "liquidity": 85000000,
      "marketCap": 78000000000,
      "fdv": 78000000000,
      "pairAge": "1095d",
      "dexId": "raydium"
    },
    "summary": "Strong fundamentals with elevated buy-side pressure. Short-term momentum building.",
    "timestamp": "2026-04-01T14:22:00Z",
    "dataSource": "multi-source"
  }
}
```

### `POST /api/intelligence`

Full-depth intelligence query. Requires MPP payment (0.008 pathUSD per query).

Same request/response format as the demo endpoint, but with higher data resolution and real-time scoring.

**Payment flow:**

1. Client sends request without payment header
2. Server responds with `402 Payment Required` and an `mpp-payment` header containing payment instructions
3. Client completes payment via the `mppx` SDK
4. Client retries the request with the payment receipt in the `mpp-payment` header
5. Server validates receipt and returns full intelligence data

```typescript
import { MppClient } from 'mppx';

const client = new MppClient({ walletPrivateKey: '...' });
const response = await client.request('https://mpp32.org/api/intelligence', {
  method: 'POST',
  body: JSON.stringify({ token: 'SOL' }),
});
```

---

## Provider Ecosystem

### `GET /api/submissions`

List all approved providers in the ecosystem.

**Query parameters:**
- `category` (optional) — Filter by category slug
- `search` (optional) — Search by name or description

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "My Token Scanner",
      "slug": "my-token-scanner",
      "shortDescription": "Real-time token analysis for Solana",
      "category": "token-scanner",
      "websiteUrl": "https://example.com",
      "pricePerQuery": 0.01,
      "creatorName": "Builder",
      "status": "approved",
      "queryCount": 1240
    }
  ]
}
```

### `POST /api/submissions`

Register a new provider service. The endpoint URL is validated on submission — only reachable API endpoints are accepted.

**Request:**

```json
{
  "name": "My Token Scanner",
  "shortDescription": "Real-time token analysis for Solana",
  "category": "token-scanner",
  "websiteUrl": "https://example.com",
  "endpointUrl": "https://api.example.com/scan",
  "pricePerQuery": 0.01,
  "paymentAddress": "0x1234...abcd",
  "creatorName": "Builder",
  "creatorEmail": "builder@example.com"
}
```

**Response:**

Returns the created submission with a one-time `managementToken`. Store this token — it's the only way to manage your listing.

### `GET /api/submissions/:slug`

Get a single provider by slug.

### `PATCH /api/submissions/:slug`

Update your provider listing. Requires `Authorization: Bearer <managementToken>` header.

### `GET /api/submissions/:slug/stats`

Get query stats for your provider. Requires management token.

### `POST /api/submissions/:slug/validate`

Re-validate your endpoint. Returns reachability status and response time.

### `POST /api/submissions/recover`

Recover a lost management token by email.

---

## Categories

Providers can register under any of 47 categories across 8 groups:

| Group | Categories |
|---|---|
| AI & Machine Learning | ai-inference, image-generation, image-analysis, speech-tts, speech-stt, translation, embeddings, summarization, sentiment-analysis |
| Data & Intelligence | web-search, web-scraping, news-feed, social-data, financial-data, market-data, sports-data, weather, geolocation, real-estate |
| Crypto / Web3 | token-scanner, price-oracle, trading-signal, nft-intelligence, defi-analytics, wallet-intelligence, on-chain-data, risk-compliance |
| Utility | ocr, document-parsing, email-verification, phone-verification, identity-kyc, fraud-detection, sms-messaging |
| Business | data-enrichment, crm-lookup, analytics, seo-tools, advertising-data |
| Developer Tools | code-intelligence, security-scanning, uptime-monitoring |
| Media & Entertainment | gaming-data, music-media, sports-odds |
| Other | data-feed, other |

---

## Error format

All errors follow the same envelope:

```json
{
  "error": {
    "message": "Human-readable error description",
    "code": "MACHINE_READABLE_CODE"
  }
}
```

Common error codes:
- `VALIDATION_ERROR` — Request body failed schema validation
- `NOT_FOUND` — Resource not found
- `UNAUTHORIZED` — Missing or invalid management token
- `ENDPOINT_UNREACHABLE` — Provider endpoint failed validation
- `ENDPOINT_NOT_API` — Endpoint returned HTML instead of an API response
