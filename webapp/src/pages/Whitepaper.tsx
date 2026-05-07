import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check } from "lucide-react";

const CA = "6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump";

const tocSections = [
  { id: "abstract", label: "Abstract" },
  { id: "problem", label: "The Problem" },
  { id: "architecture", label: "Protocol Architecture" },
  { id: "payment-rails", label: "Universal Payment Rails" },
  { id: "provider-infra", label: "Provider Infrastructure" },
  { id: "intelligence", label: "Intelligence Engine" },
  { id: "agent-discovery", label: "Agent Discovery Layer" },
  { id: "token", label: "Token Utility" },
  { id: "security", label: "Security Model" },
  { id: "ecosystem", label: "Ecosystem" },
  { id: "roadmap", label: "Roadmap" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="font-display text-2xl font-semibold text-foreground mb-4">{title}</h2>
      <div className="text-muted-foreground text-sm leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-mpp-card border border-mpp-border rounded-lg p-4 font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap overflow-x-auto">
      {children}
    </pre>
  );
}

export default function Whitepaper() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(CA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-mpp-bg">
      {/* Hero */}
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Technical Paper</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-3">
            MPP32 Protocol
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-2xl mb-4">
            Universal payment proxy for the machine economy. A technical overview of the 5-protocol architecture, universal payment rails, provider platform, and intelligence engine.
          </p>
          <p className="font-mono text-muted-foreground/60 text-xs">Version 2.0 · May 2026</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-4 gap-12">

          {/* Table of Contents — sticky sidebar on desktop */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              <p className="font-mono text-mpp-amber text-[10px] uppercase tracking-widest mb-4">Contents</p>
              <nav className="space-y-1.5">
                {tocSections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block font-mono text-xs text-muted-foreground hover:text-mpp-amber transition-colors py-0.5"
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-3 space-y-16">

            {/* 1. Abstract */}
            <Section id="abstract" title="1. Abstract">
              <p>
                MPP32 is a universal payment proxy that enables any HTTP API to accept per-request payments from developers and autonomous AI agents. The platform implements the HTTP 402 Payment Required standard with support for 5 protocols: Tempo (pathUSD on Ethereum L2), x402 (USDC on Solana), ACP (Agent Commerce Protocol for checkout-session-based payments), AP2 (cryptographic authorization proofs via verifiable credentials), and AGTP (Agent Transfer Protocol for agent identity and intent routing). Payments are verified before requests reach the provider's server. Revenue settles directly to the provider's wallet with no intermediary custody and no platform fees.
              </p>
              <p>
                The platform operates at three layers: a payment proxy that wraps any HTTP endpoint in protocol level billing, an intelligence oracle that demonstrates the infrastructure on production traffic, and an ecosystem marketplace where registered services are discoverable by human developers and AI agents through the Model Context Protocol (MCP).
              </p>
            </Section>

            {/* 2. The Problem */}
            <Section id="problem" title="2. The Problem">
              <p>
                API monetization today relies on mechanisms designed for human operators: account registration, API key management, subscription tiers, invoice cycles, and manual payment collection. These systems assume a human will sign up, enter billing details, and manage their usage over time.
              </p>
              <p>
                Autonomous AI agents do not operate this way. An agent running on any AI framework cannot register for accounts, manage API keys across services, or negotiate enterprise contracts. When an agent needs data, it needs to pay for it at the protocol level, in the same HTTP request that fetches the data.
              </p>
              <p>
                The HTTP specification already defines a mechanism for this: status code 402 Payment Required. The specification was reserved decades ago but lacked a practical implementation until the emergence of on chain stablecoins and payment protocols capable of settling micropayments in under one second.
              </p>
              <p>
                MPP32 implements the full 402 payment cycle for any HTTP API, on two settlement networks, with production infrastructure that handles verification, rate limiting, retries, and analytics. The provider submits an endpoint URL and a wallet address. The protocol handles everything else.
              </p>
            </Section>

            {/* 3. Protocol Architecture */}
            <Section id="architecture" title="3. Protocol Architecture">
              <p>
                Every request to an MPP32 protected endpoint follows the same cycle. The client sends a standard HTTP request. If no payment credential is present, the server responds with HTTP 402 and includes payment challenge headers for all 5 supported protocols. The client's SDK reads the challenge, constructs a payment using whichever protocol they support, and retries the request with proof of payment attached.
              </p>
              <p>
                The 402 response includes multiple headers simultaneously:
              </p>
              <CodeBlock>{`HTTP/1.1 402 Payment Required
WWW-Authenticate: Payment amount=0.008 currency=pathUSD ...
Payment-Required: eyJzY2hlbWUiOiJleGFjdCIsIm5ldH... (base64)
X-ACP-Requirements: eyJwcm90b2NvbCI6ImFjcCIs... (base64)
X-AP2-Requirements: eyJhcDJWZXJzaW9uIjoiMjAy... (base64)
X-AGTP-Requirements: eyJwcm90b2NvbCI6ImFndHAi... (base64)
X-Payment-Methods: tempo, x402, acp
X-AP2-Supported: true
X-AGTP-Supported: true`}</CodeBlock>
              <p>
                <strong className="text-foreground">WWW-Authenticate</strong> carries the Tempo protocol challenge. Clients with an EVM wallet and pathUSD balance read this header, broadcast a payment to the Tempo network, and retry with <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">Authorization: Payment [receipt]</code>.
              </p>
              <p>
                <strong className="text-foreground">Payment-Required</strong> carries the x402 protocol challenge as a base64 encoded JSON payload. Clients with a Solana wallet and USDC balance decode the requirements, sign a payment transaction, and retry with the <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">X-Payment</code> header containing the signed proof.
              </p>
              <p>
                <strong className="text-foreground">X-Payment-Methods</strong> lists the available protocols so clients can determine which rail to use before parsing individual challenge headers.
              </p>
              <p>
                All 5 protocols coexist on every 402 response. Each client reads only the challenge headers for the protocol they support and ignores the rest. Tempo clients use WWW-Authenticate. x402 clients use Payment-Required. ACP clients use X-ACP-Requirements. AP2 clients include X-AP2-Mandate for authorization proofs. AGTP clients include Agent-ID for identity tracking. The architecture is additive. New protocols can be added without breaking existing clients.
              </p>
            </Section>

            {/* 4. Dual Payment Rails */}
            <Section id="payment-rails" title="4. Universal Payment Rails">
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest">Tempo (pathUSD on Ethereum L2)</p>
              <p>
                Tempo is an Ethereum L2 settlement network. Payments use pathUSD, a stablecoin pegged 1:1 to USD. The mppx SDK handles the full payment cycle client side: reading the WWW-Authenticate challenge, broadcasting the payment transaction, and attaching the signed receipt to the retry request. Settlement is sub-second. The recipient address is a standard EVM address (0x format).
              </p>

              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest pt-4">x402 (USDC on Solana)</p>
              <p>
                x402 is a payment protocol using USDC on Solana mainnet. The USDC mint address is <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</code>. The network identifier follows the CAIP-2 standard: <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp</code>. Payment verification and settlement are handled by the x402 facilitator service. The MPP32 server submits the client's payment proof to the facilitator's verify endpoint, and on success, calls the settle endpoint to finalize the transaction.
              </p>

              <p>
                The x402 challenge payload contains the exact payment requirements:
              </p>
              <CodeBlock>{`{
  "scheme": "exact",
  "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "maxAmountRequired": "8000",
  "resource": "/api/intelligence",
  "description": "MPP32 API access",
  "mimeType": "application/json",
  "payTo": "[recipient_solana_address]",
  "maxTimeoutSeconds": 60,
  "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
}`}</CodeBlock>
              <p>
                Amounts are denominated in USDC base units (6 decimal places). A price of $0.008 USD is represented as 8000 base units. The maxTimeoutSeconds field gives the client 60 seconds to complete the payment before the challenge expires.
              </p>
              <p>
                MPP32 supports 5 protocols in total. Tempo and x402 handle direct payments. The remaining three handle commerce sessions, authorization, and agent identity:
              </p>
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest pt-4">ACP (Agent Commerce Protocol)</p>
              <p>
                ACP enables checkout-session-based payments. Agents create a checkout session with cart and payment details, and include the session ID in the X-ACP-Session header. MPP32 verifies the session status, expiry, and amount authorization before forwarding the request. This protocol supports structured commerce flows including cart management and multi-item transactions.
              </p>
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest pt-4">AP2 (Agent Payments Protocol)</p>
              <p>
                AP2 is an authorization layer using verifiable credentials with ECDSA P-256 signatures. An agent includes a base64-encoded credential in the X-AP2-Mandate header. MPP32 validates the credential structure, checks expiration dates, verifies amount constraints and resource scope, and validates the cryptographic signature. AP2 complements payment protocols by proving that the user or principal authorized the transaction. It does not replace payment but adds a compliance and audit layer.
              </p>
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest pt-4">AGTP (Agent Transfer Protocol)</p>
              <p>
                AGTP provides agent identity and intent routing. Agents include an Agent-ID header along with optional Principal-ID and Authority-Scope headers. MPP32 verifies the agent identity, validates authority scope against the requested resource, and checks budget limits. AGTP enables enhanced tracking, priority routing, and delegation chain verification for multi-agent workflows. Like AP2, it is an identity layer that complements rather than replaces payment.
              </p>
              <p>
                Universal rail support means any agent, regardless of which payment protocol, authorization framework, or identity system they use, can interact with MPP32 services. This removes protocol dependency and ensures providers never need to choose which standard to support.
              </p>
            </Section>

            {/* 5. Provider Infrastructure */}
            <Section id="provider-infra" title="5. Provider Infrastructure">
              <p>
                Any HTTP endpoint that accepts requests and returns responses can be registered on MPP32. The provider submits their endpoint URL, sets a price per request in USD, and provides a wallet address for payment settlement. MPP32 operates as a reverse proxy: all traffic flows through the MPP32 server, which handles payment verification before forwarding the request to the provider's upstream server.
              </p>
              <p>
                The proxy layer provides the following on every request:
              </p>
              <div className="space-y-3">
                {[
                  ["Payment gating", "Every request is verified for valid payment before it reaches the provider's server. Unpaid requests never touch the upstream endpoint."],
                  ["5-protocol verification", "All 5 protocols (Tempo, x402, ACP, AP2, AGTP) are verified through their respective methods. The provider's endpoint receives only authenticated, paid traffic regardless of which protocol the caller used."],
                  ["Rate limiting", "Per endpoint and per IP rate limiting protects upstream services from excessive request volume. Default limits are 60 requests per minute and 10,000 requests per day per IP."],
                  ["Idempotency", "Idempotency keys prevent double charging on retried requests. If a client retries a request that was already paid for, the proxy recognizes the duplicate and forwards without requiring a second payment."],
                  ["Upstream retries", "Transient failures from the provider's server trigger automatic retries with backoff. The caller sees a clean response or a clear error, not an intermittent failure."],
                  ["Body size limits", "Request and response body sizes are bounded to protect both the proxy infrastructure and the provider's server from oversized payloads."],
                  ["Analytics", "Query counts, success rates, latency percentiles, revenue totals, and error breakdowns are available in real time through the provider management dashboard."],
                  ["Structured logging", "Every request is logged with timestamps, payment method, response status, and latency. Providers can audit their traffic at any time."],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-mpp-amber" />
                    <p><strong className="text-foreground">{title}:</strong> {desc}</p>
                  </div>
                ))}
              </div>
              <p>
                Providers retain 100% of their revenue. MPP32 charges no commission, no transaction fees, and no platform fees. Payments settle directly from the caller's wallet to the provider's wallet address. MPP32 does not custody funds at any point in the transaction.
              </p>
              <p>
                No code changes are required on the provider's side. The provider's server continues to serve requests exactly as it does today. The only difference is that every request arriving at their endpoint has already been paid for.
              </p>
            </Section>

            {/* 6. Intelligence Engine */}
            <Section id="intelligence" title="6. Intelligence Engine">
              <p>
                The MPP32 Intelligence Oracle is a production service running on the same proxy and payment infrastructure available to all providers. It serves as both a revenue generating product and a reference implementation of the protocol.
              </p>
              <p>
                The Oracle accepts a Solana token address or ticker symbol and returns an 8 dimension intelligence payload derived from on chain data. The production endpoint is <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">POST /api/intelligence</code> at $0.008 per query. A free demo endpoint is available for evaluation at <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">POST /api/intelligence/demo</code> with a rate limit of 10 requests per minute.
              </p>

              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest pt-2">Data Sources</p>
              <p>
                The Oracle aggregates data from three external sources. <strong className="text-foreground">On-chain DEX aggregator</strong> provides on chain trading pair data including volume (24h, 6h, 1h, 5m windows), liquidity, transaction counts (buy/sell breakdown), price changes, pair age, and social/website metadata. <strong className="text-foreground">Global market data provider</strong> enriches the response with global market data including total volume, market capitalization, 7 day price history, and Twitter follower counts where available. <strong className="text-foreground">Solana price oracle</strong> provides backup price validation for Solana tokens.
              </p>
              <p>
                When global market data is available, it takes priority for global metrics (volume, market cap, price changes) because it aggregates across all exchanges rather than a single trading pair. The response includes an <code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">enriched</code> boolean so callers know which data source informed the result.
              </p>

              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest pt-2">Scoring Dimensions</p>
              <div className="space-y-3">
                {[
                  ["Alpha Score (0 to 100)", "Composite signal derived from six weighted components: volume momentum (current 1h volume vs 24h average, max 20 points), buy pressure (1h buy/sell ratio, max 15 points), price momentum (weighted 1h and 6h price change, max 15 points), liquidity depth (logarithmic scale, max 10 points), social presence (website and social accounts detected, max 5 points), and pair age (penalty for tokens under 24 hours, bonus for tokens over 30 days). Baseline is 50. Final score is clamped to 0 to 100."],
                  ["Rug Risk (0 to 10)", "Cumulative risk score based on seven on chain factors: pair age under 24 hours (+3), pair age under 7 days (+1), liquidity under $10K (+3), under $50K (+2), under $100K (+1), no website detected (+1), no social accounts (+1), liquidity to market cap ratio below 3% (+2), and heavy sell pressure where 24h sells exceed buys by 1.5x (+1). Levels: minimal (0 to 1), low (2), moderate (3 to 4), elevated (5 to 6), high (7 to 8), critical (9 to 10)."],
                  ["Whale Activity", "Volume to liquidity ratio in the 1 hour window determines activity level. Ratio above 2.0 is extreme, above 1.0 is high, above 0.3 is moderate, below is low. The response includes 1h buy count, 1h sell count, and a dominance score (buy percentage of total transactions)."],
                  ["Smart Money Signals", "Array of detected patterns including: 5 minute volume spike (5m volume exceeds 1/12 of 1h volume), buy side dominance (over 65% buy transactions in 1h), volume 2x above 24h average, momentum breakout (1h price surge over 5%), high liquidity accumulation (over $1M liquidity with positive price movement), 5 minute candle imbalance (1.5x buy/sell ratio), and active DEX boost detection."],
                  ["Pump Probability (5% to 95%)", "Statistical estimate starting from a 40% baseline, adjusted by volume momentum, buy ratio, 1h price change, and token age. New tokens (under 7 days) receive a volatility bonus. The result is clamped between 5% and 95%."],
                  ["Projected ROI", "Derived from pump probability. Base ROI equals pump probability multiplied by 0.3. Low estimate is base multiplied by 0.5, high estimate is base multiplied by 2.5. Timeframe is 24 hours."],
                  ["Risk Reward Ratio", "Upside calculated from price momentum and volume momentum. Downside calculated from a base of 10 minus liquidity buffers (high liquidity reduces downside by up to 5 points). Clamped between 0.1:1 and 20:1."],
                  ["Market Data", "Raw metrics including price changes (1h, 24h, 7d), 24h volume, liquidity in USD, market cap, fully diluted valuation, pair age, DEX identifier, and Twitter follower count where available from global market data providers."],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-mpp-amber" />
                    <p><strong className="text-foreground">{title}:</strong> {desc}</p>
                  </div>
                ))}
              </div>
              <p>
                All scoring is deterministic. The same token queried at the same moment produces the same scores every time. There is no machine learning model, no randomness, and no subjective input. Every component maps to a specific on chain measurement with documented weights and thresholds.
              </p>
            </Section>

            {/* 7. Agent Discovery Layer */}
            <Section id="agent-discovery" title="7. Agent Discovery Layer">
              <p>
                MPP32 publishes an MCP (Model Context Protocol) server that gives AI agents direct access to the ecosystem. The server exposes tools that allow agents to list available services by category, query the intelligence oracle, and call any registered provider endpoint with automatic payment handling.
              </p>
              <p>
                An agent configured with the MPP32 MCP server and a funded wallet (EVM for Tempo or Solana for x402) can discover, evaluate, and pay for any service in the ecosystem without human intervention. The agent's wallet serves as its identity. No API keys are issued, no accounts are created, and no credentials are stored.
              </p>
              <p>
                The MCP server is available as an npm package. Configuration requires adding the server to the agent's MCP configuration with the appropriate private key environment variable:
              </p>
              <CodeBlock>{`{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_PRIVATE_KEY": "your_evm_private_key",
        "MPP32_SOLANA_PRIVATE_KEY": "your_solana_private_key"
      }
    }
  }
}`}</CodeBlock>
              <p>
                Either key is sufficient. If both are provided, the server selects the appropriate protocol based on the 402 response headers from each service.
              </p>
            </Section>

            {/* 8. Token Utility */}
            <Section id="token" title="8. Token Utility">
              <p>
                The MPP32 token is the protocol's fee reduction and governance layer. Holding M32 tokens reduces the per query cost on the MPP32 Intelligence Oracle. Callers pass their Solana wallet address via the <code className="font-mono text-xs text-mpp-amber">X-Wallet-Address</code> header and the protocol verifies the on chain M32 balance in real time before constructing the payment challenge. Discounts apply automatically with no registration required.
              </p>
              <div className="space-y-2">
                {[
                  { tier: "Standard (no tokens)", rate: "0.008 USD / query", note: "Base rate" },
                  { tier: "Hold 250,000+ M32", rate: "0.0064 USD / query", note: "20% reduction" },
                  { tier: "Hold 1,000,000+ M32", rate: "0.0048 USD / query", note: "40% reduction" },
                ].map((t) => (
                  <div
                    key={t.tier}
                    className="rounded p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-mpp-bg border border-mpp-border"
                  >
                    <span className="text-foreground text-sm">{t.tier}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-mpp-amber text-sm">{t.rate}</span>
                      <span className="text-muted-foreground text-xs">{t.note}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p>
                Fee reduction applies to the MPP32 Oracle. Third party providers set their own pricing independently. Balances are cached for five minutes per wallet to minimize RPC overhead while keeping discount eligibility responsive to token purchases.
              </p>
              <p>
                Future phases include staking for API credits (stake 1,000,000 M32 to earn 1,000 free queries per month) and DAO governance where token holders vote on scoring weight adjustments and protocol parameters.
              </p>

              <div className="mt-4">
                <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-2">Contract Address</p>
                <div className="flex items-center gap-2 bg-mpp-bg border border-mpp-border rounded px-3 py-2">
                  <code className="font-mono text-xs text-foreground break-all flex-1">{CA}</code>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 text-muted-foreground hover:text-mpp-amber transition-colors p-1 rounded"
                    aria-label="Copy contract address"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-mpp-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {copied ? <p className="font-mono text-mpp-success text-xs mt-1">Copied</p> : null}
              </div>
            </Section>

            {/* 9. Security Model */}
            <Section id="security" title="9. Security Model">
              <p>
                MPP32 operates as a stateless payment verification proxy. The platform does not custody user funds, store private keys, or hold balances on behalf of any party.
              </p>
              <div className="space-y-3">
                {[
                  ["Payment before execution", "Every request is verified for valid payment before it is forwarded to the upstream provider. The provider's server never receives an unpaid request."],
                  ["Facilitator based settlement (x402)", "x402 payments are verified through the facilitator service at x402.org. The verify endpoint validates the payment proof. The settle endpoint finalizes the transaction. Both calls use timeouts (10 seconds for verify, 15 seconds for settle) to prevent hanging connections."],
                  ["Cryptographic validation (Tempo)", "Tempo payments use timing safe comparison for receipt validation via the mppx library, preventing timing attacks on payment verification."],
                  ["Input validation", "All request inputs are validated through Zod schemas before processing. Malformed requests are rejected before reaching any business logic."],
                  ["Environment isolation", "Secret keys, recipient addresses, and facilitator URLs are validated at startup through a Zod environment schema. Missing or malformed configuration prevents the server from starting."],
                  ["Rate limiting", "Per endpoint rate limiting with configurable windows. The demo endpoint is limited to 10 requests per minute. Production endpoints enforce per IP limits."],
                  ["No credential storage", "The platform stores no API keys, no passwords, and no private keys for any user or provider. The caller's wallet signature is the only authentication mechanism."],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-mpp-amber" />
                    <p><strong className="text-foreground">{title}:</strong> {desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* 10. Ecosystem */}
            <Section id="ecosystem" title="10. Ecosystem">
              <p>
                The MPP32 Ecosystem is a registry of services that accept payments through the protocol. Providers register through the Build page or the management API. Each service entry includes the endpoint URL, price per request, category, description, and the provider's payment address.
              </p>
              <p>
                Services are indexed by category and browsable through the web marketplace, the REST API (<code className="font-mono text-xs bg-mpp-border px-1 py-0.5 rounded">GET /api/submissions</code>), and the MCP server. AI agents can query the ecosystem programmatically to find services matching specific criteria and pay for them in the same session.
              </p>
              <p>
                The ecosystem creates a network effect: more providers attract more callers because there is more to discover and use. More callers attract more providers because there is a ready audience that can pay on the first request without onboarding friction.
              </p>
              <p>
                Providers retain full control of their listings. Pricing, endpoint URLs, and descriptions can be updated at any time through the management dashboard using the management token issued at registration.
              </p>
            </Section>

            {/* 11. Roadmap */}
            <Section id="roadmap" title="11. Roadmap">
              <div className="space-y-4">
                {[
                  {
                    phase: "Phase 01",
                    status: "LIVE",
                    items: "8 dimension intelligence oracle, 5-protocol payment support (Tempo, x402, ACP, AP2, AGTP), provider proxy infrastructure, management dashboard, mppx and pympp SDKs, MCP server, free evaluation endpoint.",
                  },
                  {
                    phase: "Phase 02",
                    status: "In Progress",
                    items: "Token gated fee reduction (LIVE), API key system for high volume providers, provider revenue dashboards with export, webhook notifications, additional payment protocol integration as new standards emerge, provider SDK improvements.",
                  },
                  {
                    phase: "Phase 03",
                    status: "Upcoming",
                    items: "Token staking for API credits, provider tiers with verified status and priority listing, multi chain proxy support (Solana, Base, Arbitrum), provider onboarding API for programmatic management, public ecosystem analytics.",
                  },
                  {
                    phase: "Phase 04",
                    status: "Planned",
                    items: "DAO governance with token weighted voting, protocol fee revenue distribution to stakers, additional fiat and cryptocurrency payment options, enterprise SLA tier, full TypeScript, Python, and Rust SDK releases.",
                  },
                ].map((p) => (
                  <div key={p.phase} className="bg-mpp-card border border-mpp-border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-mpp-amber text-xs">{p.phase}</span>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                        p.status === "LIVE"
                          ? "bg-mpp-success/10 text-mpp-success border border-mpp-success/20"
                          : "bg-mpp-border/40 text-muted-foreground border border-mpp-border"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    <p>{p.items}</p>
                  </div>
                ))}
              </div>
              <p>
                The full interactive roadmap is available at <Link to="/roadmap" className="text-mpp-amber hover:opacity-80 transition-opacity">/roadmap</Link>.
              </p>
            </Section>

            {/* Footer links */}
            <div className="pt-8 border-t border-mpp-border">
              <p className="text-muted-foreground text-xs mb-4">
                This document describes the MPP32 protocol as implemented and deployed. All technical claims can be verified against the live API and open source SDKs.
              </p>
              <div className="flex flex-wrap gap-4 text-xs font-mono">
                <Link to="/docs" className="text-mpp-amber hover:underline">API Documentation</Link>
                <Link to="/build" className="text-mpp-amber hover:underline">Register a Service</Link>
                <Link to="/playground" className="text-mpp-amber hover:underline">Try the Oracle</Link>
                <Link to="/ecosystem" className="text-mpp-amber hover:underline">Browse Ecosystem</Link>
                <Link to="/contact" className="text-mpp-amber hover:underline">Contact Us</Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
