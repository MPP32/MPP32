# mpp32

TypeScript SDK for **MPP32** — the universal payment proxy for machine-payable APIs. Handles the full HTTP 402 payment flow so your agent can call paid APIs with one function call.

## Install

```bash
npm install mpp32
```

### Payment dependencies

The signing libraries are **optional** — free-tier and read-only calls
(`listServices`, agent-key'd `analyze`) need none of them. Install only the peer
dependencies for the protocol you actually pay with. If they are missing when a
payment is attempted, the SDK throws a clear error naming the exact package to
install (it never silently sends a broken or unsigned envelope):

```bash
# Tempo (pathUSD on Ethereum L2)
npm install mppx viem

# x402 (USDC on Base / Ethereum)
npm install viem

# x402 (USDC on Solana) — requires Node 20.18+
npm install @solana/kit @solana-program/token @solana-program/compute-budget @scure/base
```

### Free tier / no wallet

You can construct the client with just an agent key (no private key) to use the
free tier, dashboard usage tracking, and `listServices`:

```ts
const client = new MPP32({ agentKey: process.env.MPP32_AGENT_KEY })
```

## Quick Start

```ts
import { MPP32 } from 'mpp32'

const client = new MPP32({
  tempoPrivateKey: process.env.TEMPO_PRIVATE_KEY,
  // or solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY,
})

// Get Solana token intelligence
const intel = await client.analyze('SOL')
console.log(intel.alphaScore, intel.rugRisk.level)

// List all available services
const services = await client.listServices()

// Call any registered service
const result = await client.callService('some-service-slug', {
  method: 'POST',
  body: JSON.stringify({ query: 'example' }),
})
```

## Configuration

```ts
const client = new MPP32({
  tempoPrivateKey: '0x...',       // EVM key for pathUSD payments
  solanaPrivateKey: '[...]',      // Solana key for USDC payments
  preferredMethod: 'auto',        // 'tempo' | 'x402' | 'auto'
  apiUrl: 'https://mpp32.org',   // Override API base URL
  retry: true,                    // Enable retry with exponential backoff
  headers: { 'X-Custom': 'val' }, // Default headers for all requests
})
```

No key is required to construct the client — free-tier and read-only calls work with just an `agentKey` (or nothing). A private key is only required when a real 402 challenge must be signed. When `preferredMethod` is `'auto'` (the default), the SDK prefers x402 if a Solana key is provided.

## API

### `client.analyze(token: string)`

Returns intelligence data for a Solana token — alpha score, rug risk, whale activity, smart money signals, market data, and more.

### `client.listServices(category?: string)`

Lists all approved services on MPP32. Optionally filter by category.

### `client.callService(slug, options?)`

Calls any registered service through the MPP32 proxy. Handles 402 payment automatically.

### `client.paidFetch(url, init?)`

Low-level method. Works like `fetch()` but automatically handles HTTP 402 challenges and completes payment.

## License

MIT
