import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = ["cURL", "JavaScript", "Python"] as const;
type Tab = (typeof tabs)[number];

const curlExample = `# Step 1: Make the initial request — you'll get 402
curl -i -X POST https://mpp32.org/api/intelligence \\
  -H "Content-Type: application/json" \\
  -d '{"token":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"}'
# <- HTTP 402 Payment Required
# x402: Payment-Required envelope advertises USDC on Solana (and Base)

# Step 2: Easiest path — call through the MPP32 MCP server from your agent
#   npx -y mpp32-mcp-server@latest
# The MCP signs the x402 challenge locally using MPP32_SOLANA_PRIVATE_KEY
# (or MPP32_PRIVATE_KEY for Base) and retries with the payment receipt.
# <- HTTP 200 OK — intelligence payload returned`;

const jsExample = `// Easiest path: let the MPP32 MCP server handle x402 from your agent.
// For a hand-rolled client, sign the x402 challenge with @solana/web3.js and
// retry with the base64 X-Payment header. The server verifies on-chain.

const res = await fetch('https://mpp32.org/api/intelligence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
  })
})

const { data } = await res.json()
console.log(data.alphaScore)           // 82
console.log(data.rugRisk.level)        // "low"
console.log(data.pumpProbability24h)   // 67
console.log(data.whaleActivity.level)  // "moderate"`;

const pyExample = `from pympp import MPPClient

# Initialize with your wallet private key
client = MPPClient(private_key=os.environ["PRIVATE_KEY"])

# POST request — pympp handles the 402/payment flow
response = client.post(
    "https://mpp32.org/api/intelligence",
    json={"token": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"}
)

data = response.json()["data"]
print(data["alphaScore"])            # 82
print(data["rugRisk"]["level"])      # "low"
print(data["pumpProbability24h"])    # 67
print(data["whaleActivity"]["level"]) # "moderate"`;

const codeMap: Record<Tab, string> = {
  cURL: curlExample,
  JavaScript: jsExample,
  Python: pyExample,
};

const errors = [
  { code: "402", title: "Payment Required", desc: "No valid payment credential. Follow the WWW-Authenticate challenge to pay and retry." },
  { code: "404", title: "Token Not Found", desc: "The token address or ticker was not found on Solana mainnet or has insufficient liquidity data." },
  { code: "422", title: "Invalid Input", desc: "The token field is missing, malformed, or not a valid base58 address or known ticker." },
  { code: "429", title: "Rate Limited", desc: "You have exceeded 60 requests/minute or 10,000 requests/day per IP." },
  { code: "502", title: "Upstream Data Error", desc: "DexScreener or Jupiter Price API returned an error. Retry after a brief delay." },
];

const docSections = ["API Reference", "Provider Integration Guide", "Agent Integration"] as const;
type DocSection = (typeof docSections)[number];

export default function Docs() {
  const [activeTab, setActiveTab] = useState<Tab>("cURL");
  const [activeSection, setActiveSection] = useState<DocSection>("API Reference");

  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Documentation</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">Documentation</h1>
          <p className="text-muted-foreground text-lg">Everything you need to integrate with MPP32, whether you are a caller or a provider.</p>
        </div>
        {/* Section tabs */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex gap-0 border border-mpp-border rounded overflow-hidden w-fit">
            {docSections.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={cn(
                  "px-5 py-2.5 text-sm transition-colors",
                  activeSection === s
                    ? "bg-mpp-card text-foreground font-medium"
                    : "bg-mpp-surface text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── API Reference ── */}
      {activeSection === "API Reference" ? (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">

        {/* Getting Started */}
        <section id="getting-started">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Getting Started</h2>
          <div className="space-y-3 mb-6">
            {[
              { step: "1", label: "Try the Playground for free", desc: "The /api/intelligence/demo endpoint is unmetered. Go to the Playground, enter any Solana token address or ticker (e.g. BONK, JUP, WIF), and run a live query. No wallet or setup required." },
              { step: "2", label: "Callers install the MPP32 MCP server. Providers install nothing.", desc: "If you are CALLING a paid API as an agent, drop the MPP32 MCP server into your MCP client (Claude Desktop, Claude Code, Cursor, Windsurf, Continue, Cline) and the x402 payment flow happens locally on your machine. If you are PROVIDING an API, you install nothing at all. Just expose a normal HTTP endpoint and the MPP32 proxy verifies payments server-side before forwarding requests to you." },
              { step: "3", label: "Fund a wallet with USDC plus a little SOL", desc: "Paid services settle in USDC. x402 on Solana and x402 on Base are live in production today. Fund a Solana wallet with USDC and roughly 0.001 SOL for network fees, or a Base wallet with USDC. Tempo, ACP, AP2, and AGTP envelopes are wired into the proxy but stay disabled in production until each protocol's client signer ships." },
              { step: "4", label: "Configure the MCP server and start querying", desc: "Drop the MCP config block into your client, paste in MPP32_AGENT_KEY from /agent-console, and add MPP32_SOLANA_PRIVATE_KEY (base58 Solana secret key) or MPP32_PRIVATE_KEY (0x-prefixed EVM key for Base). From that point on, every call to a paid service is signed automatically and the intelligence payload is returned." },
            ].map((s) => (
              <div key={s.step} className="card-surface rounded p-4 flex items-start gap-4">
                <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0">0{s.step}</span>
                <div>
                  <p className="text-foreground font-semibold text-sm mb-1">{s.label}</p>
                  <p className="text-muted-foreground text-sm">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Authentication */}
        <section id="authentication">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Authentication &amp; Payments</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            MPP32 uses the <strong className="text-foreground">Machine Payments Protocol (MPP)</strong> for authentication. There are no shared API keys against a paid service. Instead, you authenticate by proving you paid for the specific request. The proxy ships every protocol envelope below; only x402 has a verified end-to-end client flow in production today, on both Solana (USDC) and Base (USDC).
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            The flow works in three steps:
          </p>
          <div className="space-y-3 mb-6">
            {[
              { step: "1", label: "Initial request", desc: "POST to /api/intelligence without any payment header. The server returns HTTP 402 with the x402 Payment-Required envelope and an X-Payment-Methods advertisement." },
              { step: "2", label: "Pay", desc: "Your client reads the x402 challenge and signs a USDC transfer locally with your Solana or Base wallet. The MPP32 MCP server does this automatically; a hand-rolled client builds the base64 X-Payment header and retries." },
              { step: "3", label: "Authenticated request", desc: "Re-submit the original request with the X-Payment header. The Solana or Base x402 facilitator verifies the on-chain settlement and returns the intelligence payload." },
            ].map((s) => (
              <div key={s.step} className="card-surface rounded p-4 flex items-start gap-4">
                <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0">0{s.step}</span>
                <div>
                  <p className="text-foreground font-semibold text-sm mb-1">{s.label}</p>
                  <p className="text-muted-foreground text-sm">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="card-surface rounded p-4 mb-4">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">x402 flow (production)</p>
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`← 402 Payment-Required: {"x402Version":1,"accepts":[{"scheme":"exact","network":"solana","maxAmountRequired":"8000","resource":"...","payTo":"<wallet>","asset":"USDC"}]}
   X-Payment-Methods: x402
→ X-Payment: <base64-encoded-payment-proof>
← 200 OK + X-Payment-Response: {"settlementTxSignature":"...","network":"solana"}`}</pre>
          </div>
          <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-mpp-amber font-mono uppercase tracking-wider">Note:</span>{" "}
              The MPP32 MCP server handles every step of the x402 flow automatically. The Tempo, ACP, AP2, and AGTP envelopes ship in the proxy and are exercised in tests, but stay disabled in production until each protocol's client signer is verified end-to-end.
            </p>
          </div>

          {/* Supported Protocols */}
          <h3 className="text-foreground font-semibold text-sm mt-8 mb-3">Supported Protocols</h3>
          <p className="text-muted-foreground text-sm mb-4">
            The MPP32 proxy ships every protocol envelope below. Only x402 has a tested end-to-end client flow in production today; the others are gated off until each protocol's client signer is verified.
          </p>
          <div className="card-surface rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mpp-border">
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Protocol</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Settlement / Mechanism</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Header</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mpp-border">
                {[
                  { protocol: "x402 (Solana)", status: "Production", mechanism: "USDC on Solana mainnet", header: "X-Payment" },
                  { protocol: "x402 (Base)", status: "Production", mechanism: "USDC on Base", header: "X-Payment" },
                  { protocol: "Tempo", status: "Gated off in production", mechanism: "pathUSD on Ethereum L2", header: "Authorization: Payment" },
                  { protocol: "ACP", status: "Gated off in production", mechanism: "Checkout sessions", header: "X-ACP-Session" },
                  { protocol: "AP2", status: "Gated off in production", mechanism: "Verifiable credentials", header: "X-AP2-Mandate" },
                  { protocol: "AGTP", status: "Gated off in production", mechanism: "HMAC-signed agent certificates", header: "Agent-ID" },
                ].map((row) => (
                  <tr key={row.protocol}>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">{row.protocol}</td>
                    <td className="px-5 py-3 text-foreground text-xs">{row.status}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{row.mechanism}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground text-xs">{row.header}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Escrow-402 */}
        <section id="escrow-402">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Escrow-402: Payment Protection</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            Every x402 payment on MPP32 is protected by <strong className="text-foreground">Escrow-402</strong> — a hold-then-release mechanism that ensures agents only pay for data that's actually useful. The payment is cryptographically verified <em>before</em> the upstream request, but settlement is deferred until the response passes a quality check. If the upstream returns garbage, the payment is never settled and no USDC leaves your wallet.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Escrow-402 is automatic. No opt-in, no configuration, no SDK changes. It works with any x402 client — the MCP server, x402-fetch, or a hand-rolled signer.
          </p>

          <h3 className="text-foreground font-semibold text-sm mb-3">How it works</h3>
          <div className="space-y-3 mb-6">
            {[
              { step: "1", label: "Verify (hold)", desc: "The proxy receives your signed X-Payment header and calls the x402 facilitator's /verify endpoint. This confirms your payment envelope is cryptographically valid and the USDC transfer is authorized — but no funds move yet." },
              { step: "2", label: "Fetch upstream", desc: "With the payment verified in escrow, the proxy forwards your request to the upstream provider and waits for the response." },
              { step: "3", label: "Quality check", desc: "The proxy evaluates the upstream response. It checks for server errors (5xx), unreachable endpoints, and empty response bodies on 200 OK." },
              { step: "4a", label: "Settle (good response)", desc: "If the quality check passes, the proxy calls the facilitator's /settle endpoint. USDC moves on-chain from your wallet to the provider. You receive the data plus a settlement transaction signature." },
              { step: "4b", label: "Skip (bad response)", desc: "If the quality check fails, settlement is skipped entirely. No USDC leaves your wallet. You still get the upstream response (so your agent can handle the error), plus headers explaining why payment was skipped." },
            ].map((s) => (
              <div key={s.step} className="card-surface rounded p-4 flex items-start gap-4">
                <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0">{s.step.length === 1 ? `0${s.step}` : s.step}</span>
                <div>
                  <p className="text-foreground font-semibold text-sm mb-1">{s.label}</p>
                  <p className="text-muted-foreground text-sm">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card-surface rounded p-4 mb-6">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Escrow flow</p>
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`→ X-Payment: <signed-envelope>
  ┌─ facilitator /verify ✓ (funds held, not settled)
  ├─ proxy forwards request to upstream provider
  ├─ upstream responds (200 OK, 5xx, timeout, etc.)
  ├─ quality check: is this response worth paying for?
  │
  ├── YES → facilitator /settle → USDC moves on-chain
  │   ← 200 OK + X-Escrow-Status: settled
  │              X-Payment-Settled: true
  │              X-Settlement-Tx: <solana-tx-signature>
  │
  └── NO  → settlement skipped, no funds move
      ← 200/5xx + X-Escrow-Status: skipped
                  X-Payment-Settled: false
                  X-Escrow-Skip-Reason: upstream-server-error-503`}</pre>
          </div>

          <h3 className="text-foreground font-semibold text-sm mb-3">Response Headers</h3>
          <div className="card-surface rounded overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mpp-border">
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Header</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Values</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mpp-border">
                {[
                  { header: "X-Escrow-Status", values: "settled | skipped | settle-failed", desc: "Outcome of the escrow quality gate." },
                  { header: "X-Payment-Settled", values: "true | false", desc: "Whether USDC actually moved on-chain for this request." },
                  { header: "X-Settlement-Tx", values: "<tx-signature>", desc: "Solana transaction signature. Present only when settled." },
                  { header: "X-Settlement-Method", values: "x402", desc: "Protocol used for settlement. Present only when settled." },
                  { header: "X-Escrow-Skip-Reason", values: "upstream-server-error-5xx | upstream-unreachable | empty-response-body", desc: "Why payment was skipped. Present only when skipped." },
                ].map((row) => (
                  <tr key={row.header}>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">{row.header}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground text-xs">{row.values}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-mpp-amber font-mono uppercase tracking-wider">Non-custodial:</span>{" "}
              Escrow-402 works by deferring the facilitator's /settle call — not by holding USDC in an MPP32 wallet. At no point does MPP32 take custody of your funds. The x402 facilitator is the only entity that can settle the on-chain transfer, and it only does so when MPP32 explicitly calls /settle after the quality check passes.
            </p>
          </div>
        </section>

        {/* M32 Token Discount */}
        <section id="token-discount">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">M32 Token Holder Discounts</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            Hold M32 tokens in a verified Solana wallet to receive automatic fee reductions on the Intelligence Oracle. The discount path is gated off in production until SIWS (Sign-In With Solana) wallet ownership verification ships, so a header alone cannot claim the rate. Once SIWS is live, a verified wallet's M32 balance is checked on-chain before the 402 challenge is constructed.
          </p>
          <div className="space-y-2 mb-4">
            {[
              { tier: "No tokens", rate: "0.008 USD", note: "Standard rate" },
              { tier: "250K+ M32", rate: "0.0064 USD", note: "20% reduction" },
              { tier: "1M+ M32", rate: "0.0048 USD", note: "40% reduction" },
            ].map((t) => (
              <div key={t.tier} className="rounded p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-mpp-bg border border-mpp-border">
                <span className="text-foreground text-sm font-medium">{t.tier}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-mpp-amber text-sm">{t.rate}</span>
                  <span className="text-muted-foreground text-xs">{t.note}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="card-surface rounded p-4 mb-4">
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre">{`# Include your wallet for a discounted 402 challenge
curl -X POST https://mpp32.org/api/intelligence \\
  -H "Content-Type: application/json" \\
  -H "X-Wallet-Address: <your-solana-wallet>" \\
  -d '{"token": "BONK"}'

# Response includes discount info
← X-M32-Discount: 20`}</pre>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Balances are cached for 5 minutes per wallet. Discounts apply to the MPP32 Oracle only. Third party provider pricing is set independently.
          </p>
        </section>

        {/* Endpoint */}
        <section id="endpoint">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Endpoint</h2>
          <div className="card-surface rounded p-4 mb-6 flex items-center gap-3">
            <span className="font-mono text-xs text-mpp-amber border border-mpp-amber/30 px-2 py-1 rounded">POST</span>
            <span className="font-mono text-sm text-foreground">https://mpp32.org/api/intelligence</span>
          </div>

          <h3 className="text-foreground font-semibold text-sm mb-3">Request Body</h3>
          <div className="card-surface rounded p-4 mb-6">
            <pre className="font-mono text-xs text-foreground leading-relaxed">{`{
  "token": string  // Solana token address (base58) or ticker symbol (e.g. "BONK")
}`}</pre>
          </div>

          <h3 className="text-foreground font-semibold text-sm mb-3">Response Schema</h3>
          <div className="card-surface rounded p-4 mb-6">
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre">{`{
  "data": {
    "token": {
      "address":        string,   // Solana base58 address
      "name":           string,
      "symbol":         string,
      "priceUsd":       string    // stringified float
    },
    "alphaScore":         number,   // 0–100
    "riskRewardRatio":    string,   // e.g. "8.4:1"
    "smartMoneySignals":  string[], // array of signal strings
    "pumpProbability24h": number,   // 0–100 (percent)
    "projectedROI": {
      "low":            string,   // e.g. "+12%"
      "high":           string,   // e.g. "+54%"
      "timeframe":      string    // e.g. "24h"
    },
    "whaleActivity": {
      "level":          string,   // "low" | "moderate" | "high" | "extreme"
      "recentBuys":     number,
      "recentSells":    number,
      "dominanceScore": number    // percent buy dominance
    },
    "rugRisk": {
      "score":          number,   // 0–10
      "level":          string,   // "minimal" | "low" | "moderate" | "elevated" | "high" | "critical"
      "factors":        string[]  // list of risk factors
    },
    "marketData": {
      "priceChange24h": number,
      "priceChange1h":  number | null,
      "priceChange7d":  number | null,
      "volume24h":      number,
      "liquidity":      number,
      "marketCap":      number | null,
      "fdv":            number | null,
      "pairAge":        string,   // e.g. "14mo"
      "dexId":          string    // e.g. "raydium"
    },
    "summary":            string,   // 2–3 sentence intelligence summary
    "jupiterPrice":       number | null,
    "priceConfidence":    string | null,  // "high" | "medium" | "low"
    "coingeckoEnriched":  boolean,
    "timestamp":          string,   // ISO 8601
    "dataSource":         "DexScreener"
  }
}`}</pre>
          </div>
        </section>

        {/* Code examples */}
        <section id="examples">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Code Examples</h2>
          <div className="flex gap-0 border border-mpp-border rounded overflow-hidden w-fit mb-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 text-xs font-mono transition-colors",
                  activeTab === tab
                    ? "bg-mpp-card text-foreground"
                    : "bg-mpp-surface text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="card-surface rounded-b rounded-tr p-5 border-t-0">
            <pre className="text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">
              {codeMap[activeTab]}
            </pre>
          </div>
        </section>

        {/* Error reference */}
        <section id="errors">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Error Reference</h2>
          <div className="card-surface rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mpp-border">
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Code</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mpp-border">
                {errors.map((e) => (
                  <tr key={e.code}>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">{e.code}</td>
                    <td className="px-5 py-3 text-foreground text-sm">{e.title}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SDKs */}
        <section id="sdks">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">SDKs</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-1">mpp32-mcp-server</p>
              <p className="font-mono text-xs text-mpp-amber mb-2">npx -y mpp32-mcp-server@latest</p>
              <p className="text-muted-foreground text-xs">MCP server. Drop into Claude Desktop, Claude Code, Cursor, Windsurf, Continue, or Cline. Signs x402 payments locally on Solana or Base. The fastest path to a paying agent.</p>
            </div>
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-1">Direct REST</p>
              <p className="font-mono text-xs text-mpp-amber mb-2">POST /api/agent/execute</p>
              <p className="text-muted-foreground text-xs">Skip the MCP entirely. Call /api/agent/execute with an X-Agent-Key and your client signs the x402 challenge from any language with a Solana or Base SDK.</p>
            </div>
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-1">x402-axios / x402-fetch</p>
              <p className="font-mono text-xs text-mpp-amber mb-2">npm install x402-fetch</p>
              <p className="text-muted-foreground text-xs">Use Coinbase's reference x402 clients directly against any MPP32 endpoint. The proxy speaks standard x402, so off-the-shelf clients work.</p>
            </div>
          </div>
        </section>

        {/* Rate limits */}
        <section id="rate-limits">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Rate Limits</h2>
          <div className="card-surface rounded p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per minute</span>
                <span className="font-mono text-foreground">60 requests</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per day</span>
                <span className="font-mono text-foreground">10,000 requests</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs mt-4">Limits are per IP address. Contact us for volume agreements above these limits.</p>
          </div>
        </section>

      </div>
      ) : null}

      {/* ── Provider Integration Guide ── */}
      {activeSection === "Provider Integration Guide" ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">

          {/* Overview */}
          <section id="provider-overview">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Overview</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              The MPP32 proxy sits between callers and your API. When a user queries your slug, the proxy verifies their x402 payment on Solana or Base, forwards the request to your endpoint, and returns your response. You never handle payments directly. USDC settles straight to your configured payout wallet. Tempo, ACP, AP2, and AGTP envelopes are wired into the proxy but gated off in production until each protocol's client signer ships.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              <strong className="text-foreground">You do not need to install an SDK or add middleware to your code.</strong>{" "}
              You just host a plain HTTP endpoint in any language, any framework. Our hosted proxy handles MPP payment verification server-side. Your endpoint only receives a normal HTTP request after payment has already been verified.
            </p>
            <div className="card-surface rounded p-5 mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm font-mono text-muted-foreground">
                <span className="text-foreground">Caller</span>
                <span className="text-mpp-amber">→</span>
                <span>MPP32 proxy (payment verified)</span>
                <span className="text-mpp-amber">→</span>
                <span className="text-foreground">Your endpoint</span>
                <span className="text-mpp-amber">→</span>
                <span>Response returned</span>
              </div>
            </div>
            <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-amber font-mono uppercase tracking-wider">Getting started:</span>{" "}
                Your slug is generated from your project name at submission and{" "}
                <strong className="text-foreground">cannot be changed later</strong>. Choose your name carefully.
              </p>
            </div>
          </section>

          {/* Endpoint Requirements */}
          <section id="provider-requirements">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Endpoint Requirements</h2>
            <div className="space-y-3">
              {[
                { req: "HTTPS", desc: "Your endpoint must be publicly accessible over HTTPS. Plain HTTP is not accepted." },
                { req: "JSON responses", desc: "Return standard JSON with appropriate Content-Type: application/json headers." },
                { req: "HTTP status codes", desc: "Use standard codes: 200 for success, 4xx for client errors, 5xx for server errors." },
                { req: "No auth required", desc: "The proxy does not send authentication headers to your endpoint. Your endpoint should accept unauthenticated requests." },
                { req: "No CORS required", desc: "The proxy handles all CORS. Your endpoint only needs to respond to the proxy server." },
                { req: "Under 10 seconds", desc: "The proxy times out after 10 seconds. Optimize your endpoint to respond within this window." },
              ].map((item) => (
                <div key={item.req} className="card-surface rounded p-4 flex items-start gap-4">
                  <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0 border border-mpp-amber/30 px-2 py-0.5 rounded">
                    {item.req}
                  </span>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Endpoint Verification */}
          <section id="provider-verification">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Endpoint Verification</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              Endpoint verification prevents unauthorized registration. Before the proxy routes live traffic to your endpoint, you must prove you control it by serving a verification token at a well-known URL.
            </p>

            <h3 className="text-foreground font-semibold text-sm mb-3">How it works</h3>
            <div className="space-y-3 mb-6">
              {[
                { step: "1", label: "Submit your endpoint", desc: "Register your API on the Build page. You receive a unique verification token in the response." },
                { step: "2", label: "Serve the token", desc: "Configure your server to respond to GET requests at /api/mpp32-verify with HTTP 200 and the token as the plain-text body." },
                { step: "3", label: "Click Verify", desc: "Open the management dashboard and click Verify Now. The proxy fetches your well-known URL and checks that the response body matches your token." },
                { step: "4", label: "Traffic flows", desc: "Once verified, the proxy begins routing paid requests to your endpoint. Your listing shows a green Verified badge in the ecosystem." },
              ].map((s) => (
                <div key={s.step} className="card-surface rounded p-4 flex items-start gap-4">
                  <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0">0{s.step}</span>
                  <div>
                    <p className="text-foreground font-semibold text-sm mb-1">{s.label}</p>
                    <p className="text-muted-foreground text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">Code examples</h3>
            <div className="space-y-4 mb-6">
              <div className="card-surface rounded p-4">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Express.js</p>
                <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`app.get('/api/mpp32-verify', (req, res) => {
  res.type('text/plain').send(process.env.MPP32_VERIFY_TOKEN);
});`}</pre>
              </div>
              <div className="card-surface rounded p-4">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Python (Flask)</p>
                <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`@app.route('/api/mpp32-verify')
def mpp32_verify():
    return os.environ['MPP32_VERIFY_TOKEN'], 200, {'Content-Type': 'text/plain'}`}</pre>
              </div>
              <div className="card-surface rounded p-4">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Static file</p>
                <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`# Nginx: serve the token at /api/mpp32-verify
location = /api/mpp32-verify {
  default_type text/plain;
  return 200 'YOUR_TOKEN_HERE';
}`}</pre>
              </div>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">Re-verification</h3>
            <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-amber font-mono uppercase tracking-wider">Automatic checks:</span>{" "}
                The proxy re-verifies your endpoint every 24 hours. If verification fails 3 consecutive times, proxy traffic is suspended until you re-verify manually from the management dashboard. Keep the /api/mpp32-verify route live at all times.
              </p>
            </div>
          </section>

          {/* What Gets Forwarded */}
          <section id="provider-forwarded">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">What Gets Forwarded</h2>
            <p className="text-muted-foreground text-sm mb-4">The proxy forwards the following from the original caller request to your endpoint:</p>
            <div className="card-surface rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mpp-border">
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Item</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mpp-border">
                  {[
                    { item: "Request method", detail: "GET, POST, PUT, DELETE, etc." },
                    { item: "Request body", detail: "Full body for POST/PUT requests (JSON or other content types)" },
                    { item: "Query parameters", detail: "All URL query string parameters are passed through" },
                    { item: "Content-Type header", detail: "The caller's content type is forwarded to your endpoint" },
                  ].map((row) => (
                    <tr key={row.item}>
                      <td className="px-5 py-3 font-mono text-mpp-amber text-xs">{row.item}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Testing */}
          <section id="provider-testing">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Testing Your Integration</h2>
            <p className="text-muted-foreground text-sm mb-4">Test your endpoint directly first, then verify it works through the MPP32 proxy.</p>
            <div className="card-surface rounded p-5">
              <pre className="text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">{`# Test your endpoint directly
curl https://your-api.com/endpoint

# Test through the MPP32 proxy (requires MPP payment client)
curl https://mpp32.org/api/proxy/your-slug`}</pre>
            </div>
            <p className="text-muted-foreground text-xs mt-3">
              You can also use the{" "}
              <span className="text-mpp-amber font-mono">Test</span>{" "}
              button next to the Endpoint URL field on the{" "}
              <Link to="/build" className="text-mpp-amber hover:underline">Build page</Link>{" "}
              to validate reachability before submitting.
            </p>
          </section>

          {/* Payment Flow */}
          <section id="provider-payment">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Payment Flow</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">When a user queries your API through the proxy, the payment flow is fully automatic:</p>
            <div className="space-y-3 mb-4">
              {[
                { step: "1", label: "User sends request", desc: "The caller submits a request to /api/proxy/your-slug. If a payment is required and missing, the proxy responds with an x402 Payment-Required envelope describing your payTo address, amount, and network." },
                { step: "2", label: "MPP32 verifies the x402 payment (escrow hold)", desc: "The caller signs locally and retries with the base64 X-Payment header. The proxy calls the facilitator's /verify endpoint to confirm the payment is valid — but does not settle yet. Funds are held in escrow." },
                { step: "3", label: "Request forwarded", desc: "With the payment held in escrow, the request is forwarded to your configured endpoint URL." },
                { step: "4", label: "Escrow quality check", desc: "The proxy evaluates your response. If you return a valid response (2xx with a body), the escrow releases and USDC settles on-chain to your payout wallet. If your endpoint returns a 5xx error, is unreachable, or returns an empty body, settlement is skipped and the caller keeps their USDC." },
                { step: "5", label: "Response returned", desc: "Your endpoint's response is passed back to the caller with escrow headers (X-Escrow-Status, X-Payment-Settled) indicating the payment outcome." },
              ].map((s) => (
                <div key={s.step} className="card-surface rounded p-4 flex items-start gap-4">
                  <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0">0{s.step}</span>
                  <div>
                    <p className="text-foreground font-semibold text-sm mb-1">{s.label}</p>
                    <p className="text-muted-foreground text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5 mb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-amber font-mono uppercase tracking-wider">Settlement:</span>{" "}
                x402 payments settle in USDC straight to your payout wallet — on Solana mainnet via the Solana facilitator and on Base via the Base facilitator. No claim step. Tempo, ACP, AP2, and AGTP envelopes are wired but disabled in production until their client signers ship.
              </p>
            </div>
            <div className="card-surface border-l-2 border-mpp-success/60 rounded p-4 bg-mpp-success/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-success font-mono uppercase tracking-wider">Escrow-402:</span>{" "}
                All x402 payments go through Escrow-402 automatically. The payment is verified before your endpoint is called, but USDC only settles to your wallet if your endpoint returns a valid response. If your endpoint is down or returns a server error, the caller keeps their USDC. This means callers trust that your service is worth paying for — and you get paid every time you deliver.
              </p>
            </div>
          </section>

          {/* Managing Your API */}
          <section id="provider-manage">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Managing Your API</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              After submission you can update your endpoint URL, pricing, payment address, and profile information at any time. You'll need the management token that was shown once at submission time.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">
              Lost your token? Use{" "}
              <span className="text-mpp-amber font-mono">"Forgot your token?"</span>{" "}
              on the Manage page to recover via your creator email. A new token will be issued and the old one immediately invalidated.
            </p>
            <Link to="/manage">
              <button className="btn-amber inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold">
                Open Management Dashboard
              </button>
            </Link>
          </section>

          {/* Troubleshooting */}
          <section id="provider-troubleshooting">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Troubleshooting</h2>
            <div className="space-y-4">
              {[
                {
                  issue: "Endpoint not reachable",
                  fix: "Ensure your endpoint is accessible over HTTPS from the public internet. Private/local URLs won't work. Use the Test button on the Build page to verify.",
                },
                {
                  issue: "Response timeout",
                  fix: "The proxy enforces a 10-second timeout. Profile your endpoint and optimize any slow queries, external API calls, or computation to respond faster.",
                },
                {
                  issue: "No payments received",
                  fix: "Verify your payout wallets are correctly set in /manage. x402 settles in USDC to your Solana address (Solana mainnet) or to your Base address (Base mainnet). Make sure the network you want to receive on has the matching address configured.",
                },
                {
                  issue: "Callers getting 404",
                  fix: "Check that your slug is correct. Slugs are lowercase, hyphen-separated versions of your API name. Confirm your submission is listed in the Ecosystem.",
                },
              ].map((item) => (
                <div key={item.issue} className="card-surface rounded p-5">
                  <p className="text-foreground font-semibold text-sm mb-2">{item.issue}</p>
                  <p className="text-muted-foreground text-sm">{item.fix}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      ) : null}

      {/* ── Agent Integration ── */}
      {activeSection === "Agent Integration" ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">

          {/* REST Agent API */}
          <section id="agent-rest-api">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">REST Agent API</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              The fastest way to give an existing agent the ability to call paid services without picking up an MCP client. Create a session, get a rate-limited API key, and call <code className="font-mono text-mpp-amber text-xs">/api/agent/execute</code> with any service slug. The proxy forwards 402 challenges from upstream services back to your agent — your wallet signs and retries.
            </p>
            <div className="rounded p-3 border-l-2 border-mpp-success/60 bg-mpp-success/5 mb-6">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-success font-mono uppercase tracking-wider">Non-custodial:</span>{" "}
                MPP32 NEVER spends USDC or any other asset on your behalf. Every paid call is settled by the caller's own wallet via the x402 facilitator on Solana or Base. MPP32 verifies and forwards on-chain receipts; it never holds funds.
              </p>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Manage sessions visually at the{" "}
              <Link to="/agent-console" className="text-mpp-amber hover:underline">Agent Console</Link>{" "}
              or hit the endpoints directly from your stack.
            </p>

            <h3 className="text-foreground font-semibold text-sm mb-3">Endpoints</h3>
            <div className="card-surface rounded overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mpp-border">
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Method</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Path</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mpp-border">
                  {[
                    { method: "GET", path: "/api/agent/protocols", desc: "List protocol statuses (enabled/disabled, network, settlement speed)." },
                    { method: "POST", path: "/api/agent/sessions", desc: "Create a non-custodial session. Returns an API key to use as X-Agent-Key. Rate-limited to 240 calls/min." },
                    { method: "GET", path: "/api/agent/sessions/:id", desc: "Session detail: total + settled call counts, on-chain settled volume, success rate, recent transactions with settlement signatures." },
                    { method: "POST", path: "/api/agent/quote", desc: "Get a cross-protocol price quote. Quotes are informational; payment is signed by the caller's wallet." },
                    { method: "POST", path: "/api/agent/execute", desc: "Call a service (Auth: X-Agent-Key). Forwards 402 challenges; passes through X-Payment / Authorization headers to upstream for facilitator-verified settlement." },
                    { method: "GET", path: "/api/agent/services", desc: "Discover all active machine-payable services. Pricing is for caller-signed payment (not custodial debit)." },
                    { method: "GET", path: "/api/agent/stats", desc: "Aggregate stats: active sessions, total + settled requests, on-chain settled volume." },
                  ].map((row) => (
                    <tr key={row.path}>
                      <td className="px-5 py-3 font-mono text-mpp-amber text-xs">{row.method}</td>
                      <td className="px-5 py-3 font-mono text-foreground text-xs">{row.path}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">Create a session</h3>
            <div className="card-surface rounded p-4 mb-6">
              <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`curl -X POST https://mpp32.org/api/agent/sessions \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId":           "my-trading-bot",
    "agentName":         "Trading Bot",
    "walletAddress":     "9Pa8yUe...",
    "preferredProtocol": "x402"
  }'

# 201 Created
# {
#   "data": {
#     "sessionId":              "clxyz...",
#     "apiKey":                 "mpp32_agent_<32-hex>",
#     "walletVerified":         false,
#     "m32BalanceSnapshot":     1250000,
#     "projectedDiscountPercent": 40,
#     "discountActive":         false,
#     "verificationNotice":     "Wallet stored but ownership is NOT verified. SIWS sign-in coming soon — discounts only apply once verified.",
#     "custodyDisclosure":      "MPP32 never holds custody of your funds...",
#     "protocols":              ["x402"]   // production-enabled rails today
#   }
# }`}</pre>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">Execute a paid call (sign with your own wallet)</h3>
            <p className="text-muted-foreground text-xs leading-relaxed mb-3">
              The first call returns 402 with the x402 challenge. Sign with your own wallet (the MPP32 MCP server does this automatically; a hand-rolled client uses <code className="font-mono text-foreground">@solana/web3.js</code> or an EVM SDK plus a Coinbase x402 reference client) and retry with the <code className="font-mono text-foreground">X-Payment</code> header. The facilitator verifies and settles on-chain — MPP32 never spends on your behalf.
            </p>
            <div className="card-surface rounded p-4 mb-6">
              <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`# Step 1: First call returns 402 with the challenge
curl -X POST https://mpp32.org/api/agent/execute \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Key: mpp32_agent_abc123..." \\
  -d '{ "service": "intelligence", "body": { "token": "BONK" } }'

# 200 OK with error body — caller must sign and retry
# {
#   "data": {
#     "result": {
#       "error": {
#         "code":    "PAYMENT_REQUIRED",
#         "message": "Payment required. Sign with your own wallet...",
#         "challenge": {
#           "statusCode": 402,
#           "headers":    { "payment-required": "<base64-x402-challenge>" },
#           "priceQuoted": 0.008
#         },
#         "custody": "MPP32 cannot pay upstream services on your behalf."
#       }
#     },
#     "meta": { "paymentMethod": "passthrough_402", "settled": false }
#   }
# }

# Step 2: Sign challenge with mppx SDK and retry with X-Payment header
curl -X POST https://mpp32.org/api/agent/execute \\
  -H "X-Agent-Key: mpp32_agent_abc123..." \\
  -H "X-Payment: <base64-signed-payment>" \\
  -d '{ "service": "intelligence", "body": { "token": "BONK" } }'

# 200 OK
# {
#   "data": {
#     "result": { ...intelligence payload... },
#     "meta": {
#       "protocol":              "x402",
#       "priceQuoted":           0.008,
#       "priceSettled":          0.0048,
#       "discountPercent":       40,
#       "paymentMethod":         "x402",
#       "settled":               true,
#       "settlementTxSignature": "5q...solana_tx",
#       "settlementExplorerUrl": "https://solscan.io/tx/5q...",
#       "latencyMs":             312,
#       "escrow": {
#         "status":      "settled",
#         "skipReason":  null,
#         "description": "Payment settled on-chain after upstream quality check passed"
#       }
#     }
#   }
# }`}</pre>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">Test with a free service first (no payment)</h3>
            <p className="text-muted-foreground text-xs leading-relaxed mb-3">
              Free public services run without payment — perfect for verifying your API key end-to-end before signing USDC payments.
              Pass <code className="font-mono text-foreground">"method": "GET"</code> for query-string services.
            </p>
            <div className="card-surface rounded p-4 mb-6">
              <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`curl -X POST https://mpp32.org/api/agent/execute \\
  -H "X-Agent-Key: mpp32_agent_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "free:dexscreener-search",
    "method":  "GET",
    "query":   { "q": "BONK" }
  }'

# Free service. Returns DexScreener pairs. paymentMethod: 'free', settled: false.
# Same pattern works for: free:jupiter-price, free:coingecko-ping, free:httpbin`}</pre>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">Python</h3>
            <div className="card-surface rounded p-4 mb-6">
              <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`import requests

BASE = "https://mpp32.org/api/agent"

# 1. Create a session (returns rate-limited API key — non-custodial)
session = requests.post(f"{BASE}/sessions", json={
    "agentId": "my-bot",
}).json()["data"]
key = session["apiKey"]

# 2. Call any service — Oracle, free, or external — through one endpoint
resp = requests.post(f"{BASE}/execute",
    headers={"X-Agent-Key": key},
    json={"service": "intelligence", "body": {"token": "BONK"}},
).json()

intel = resp["data"]["result"]["data"]
print(f"{intel['token']['symbol']}: alpha={intel['alphaScore']}, "
      f"rug={intel['rugRisk']['level']}, "
      f"vol24h=\${intel['marketData']['volume24h']:,.0f}")
print(f"Routed via {resp['data']['meta']['protocol']} "
      f"in {resp['data']['meta']['latencyMs']}ms")`}</pre>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">TypeScript / LangChain Tool</h3>
            <div className="card-surface rounded p-4 mb-6">
              <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`import { tool } from "@langchain/core/tools";
import { z } from "zod";

const MPP32_KEY = process.env.MPP32_AGENT_KEY!;

export const tokenIntelligenceTool = tool(
  async ({ token }) => {
    const res = await fetch("https://mpp32.org/api/agent/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Key": MPP32_KEY,
      },
      body: JSON.stringify({ service: "intelligence", body: { token } }),
    });
    const json = await res.json();
    return JSON.stringify(json.data.result.data);
  },
  {
    name: "token_intelligence",
    description: "Get real-time alpha score, rug risk, whale activity, and market data for any Solana token. Input: token symbol or address.",
    schema: z.object({ token: z.string() }),
  }
);`}</pre>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">M32 Discounts on Agent Sessions</h3>
            <div className="space-y-2 mb-4">
              {[
                { tier: "No M32 / Unverified wallet", price: "$0.008", note: "Standard" },
                { tier: "250K+ M32 (verified)", price: "$0.0064", note: "20% off" },
                { tier: "1M+ M32 (verified)", price: "$0.0048", note: "40% off" },
              ].map((t) => (
                <div key={t.tier} className="rounded p-3 flex items-center justify-between bg-mpp-bg border border-mpp-border">
                  <span className="text-foreground text-sm">{t.tier}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-mpp-amber text-sm">{t.price}</span>
                    <span className="text-muted-foreground text-xs">{t.note}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Discounts apply only to <strong className="text-foreground">verified</strong> wallets. Submitting an address alone does not authorize spending — wallet ownership must be proven via SIWS (Sign-In With Solana, ed25519 signature). The verified discount is applied to the real on-chain payment your wallet signs; MPP32 never spends or rebates funds on your behalf.
            </p>
          </section>

          {/* Escrow-402 for Agents */}
          <section id="agent-escrow">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Escrow-402: Automatic Payment Protection</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              Every x402 payment through MPP32 is protected by <strong className="text-foreground">Escrow-402</strong>. When your agent signs an x402 payment, the proxy verifies the payment but holds settlement until the upstream provider actually delivers a valid response. If the provider is down, returns a server error, or sends an empty body — your agent keeps its USDC.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Escrow is fully automatic. No configuration needed. Your agent can read the escrow outcome from response headers or the <code className="font-mono text-foreground text-xs">meta.escrow</code> object in the execute response.
            </p>

            <h3 className="text-foreground font-semibold text-sm mb-3">Reading escrow status</h3>
            <div className="card-surface rounded p-4 mb-6">
              <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`# In the /api/agent/execute response:
{
  "data": {
    "result": { ... },
    "meta": {
      "settled": true,
      "escrow": {
        "status": "settled",         // "settled" | "skipped" | "settle-failed"
        "skipReason": null,          // null when settled
        "description": "Payment settled on-chain after upstream quality check passed"
      }
    }
  }
}

# When upstream fails:
{
  "data": {
    "result": { ... },
    "meta": {
      "settled": false,
      "escrow": {
        "status": "skipped",
        "skipReason": "upstream-server-error-503",
        "description": "Settlement skipped — upstream-server-error-503"
      }
    }
  }
}

# Response headers (also available):
# X-Escrow-Status: settled | skipped | settle-failed
# X-Payment-Settled: true | false
# X-Escrow-Skip-Reason: upstream-server-error-503 (when skipped)`}</pre>
            </div>

            <div className="card-surface border-l-2 border-mpp-success/60 rounded p-4 bg-mpp-success/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-success font-mono uppercase tracking-wider">Agent safety:</span>{" "}
                Escrow-402 means your autonomous agent can call paid services without risk of paying for garbage. If a provider's endpoint goes down mid-operation, your agent's USDC stays in its wallet. This makes it safe to let agents operate with real budgets on real services.
              </p>
            </div>
          </section>

          {/* What MPP32 does NOT do — trust differentiator */}
          <section id="agent-not-custodial">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">What MPP32 does NOT do</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              MPP32 is a <strong className="text-foreground">non-custodial settlement router</strong>. We are deliberate about what we will and will not do — because the alternative would make us a money transmitter and would put your funds at risk.
            </p>
            <div className="card-surface rounded p-5 space-y-3 mb-4">
              {[
                {
                  title: "We do NOT custody funds",
                  body: "No MPP32 wallet holds your USDC or any other asset. Every paid call is signed by your own wallet using the standard x402 challenge-response flow on Solana or Base.",
                },
                {
                  title: "We do NOT pre-fund or extend credit",
                  body: "There is no MPP32-managed balance you top up and draw down against. The 'session' is a rate-limited API key plus analytics — not a wallet.",
                },
                {
                  title: "We do NOT spend on your behalf",
                  body: "When an upstream returns 402, we forward the challenge to your agent. Your agent's wallet signs and retries. We verify the receipt; we never construct or sign the payment.",
                },
                {
                  title: "We do NOT commingle funds",
                  body: "Settlement transactions move USDC directly from the caller's address to the provider's payTo address, on-chain. No funds ever touch an MPP32-controlled account.",
                },
                {
                  title: "We do NOT refund or chargeback",
                  body: "Because we never received your money. If a service does not deliver, dispute it on-chain or with the provider directly.",
                },
              ].map((item) => (
                <div key={item.title} className="border-l-2 border-mpp-success/60 pl-3">
                  <p className="text-foreground text-sm font-semibold mb-0.5">{item.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Self-custody is a feature, not a limitation. It means MPP32 cannot lose your money because it never has it — and it keeps the integration outside the scope of money-transmitter regulations (FinCEN MSB and equivalents). We pass on that compliance posture to you.
            </p>
          </section>

          {/* Overview */}
          <section id="agent-overview">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">MCP Server for AI Agents</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              The MPP32 MCP (<strong className="text-foreground">Model Context Protocol</strong>) server lets autonomous AI agents and any MCP-compatible runtime discover and call machine-payable APIs autonomously. Drop it into your agent configuration and it handles service discovery, payment negotiation, and response delivery. No custom code required.
            </p>
            <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-amber font-mono uppercase tracking-wider">One command:</span>{" "}
                Install with <span className="font-mono text-foreground">npx -y mpp32-mcp-server@latest</span>. No global install. Grab an <span className="font-mono text-foreground">MPP32_AGENT_KEY</span> at <Link to="/agent-console" className="text-mpp-amber hover:underline">mpp32.org/agent-console</Link>, paste in a Solana or Base private key for paid services, and your agent is ready.
              </p>
            </div>
          </section>

          {/* Quick Start */}
          <section id="agent-quickstart">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Quick Start</h2>
            <div className="space-y-3 mb-6">
              {[
                {
                  step: "1",
                  label: "Install",
                  desc: "The MCP server runs directly via npx. No global installation required. It connects to MPP32's API and exposes four tools for your agent: list_mpp32_services, call_mpp32_endpoint, get_solana_token_intelligence, and get_mpp32_diagnostics.",
                  code: "npx -y mpp32-mcp-server@latest",
                },
                {
                  step: "2",
                  label: "Configure your agent",
                  desc: "Add the server to your MCP client config (Claude Desktop, Claude Code, Cursor, Windsurf). Provide MPP32_AGENT_KEY (from /agent-console), and either MPP32_SOLANA_PRIVATE_KEY (base58 secret key for x402 on Solana) or MPP32_PRIVATE_KEY (0x-prefixed EVM key for x402 on Base). Set MPP32_PREFERRED_NETWORK if both are configured and you want to pin a network. Free services work without any payment key.",
                },
                {
                  step: "3",
                  label: "Start using",
                  desc: "Ask your agent to browse MPP32 services or call a specific endpoint. The MCP server handles service discovery and the full x402 payment flow automatically. Call get_mpp32_diagnostics first if anything misbehaves — it confirms which env vars actually reached the child process and prints Ready to pay: YES when the wallet is wired correctly.",
                },
              ].map((s) => (
                <div key={s.step} className="card-surface rounded p-4 flex items-start gap-4">
                  <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0">0{s.step}</span>
                  <div className="w-full">
                    <p className="text-foreground font-semibold text-sm mb-1">{s.label}</p>
                    <p className="text-muted-foreground text-sm mb-2">{s.desc}</p>
                    {"code" in s && s.code ? (
                      <div className="bg-mpp-bg rounded p-3 border border-mpp-border">
                        <pre className="font-mono text-xs text-mpp-amber">{s.code}</pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">MCP Agent Configuration</h3>
            <div className="card-surface rounded p-5">
              <pre className="text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">{`{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["-y", "mpp32-mcp-server@latest"],
      "env": {
        "MPP32_AGENT_KEY": "mpp32_agent_…",
        "MPP32_SOLANA_PRIVATE_KEY": "<base58 64-byte Solana secret key, optional>",
        "MPP32_PRIVATE_KEY": "<0x-prefixed EVM key for x402 on Base, optional>"
      }
    }
  }
}
// MPP32_SOLANA_PRIVATE_KEY is the base58-encoded 64-byte secret key
// (what Phantom shows under "show private key"), NOT the seed phrase.
// From a keypair.json file, convert it once with:
//   node -e "console.log(require('bs58').encode(Buffer.from(JSON.parse(require('fs').readFileSync('keypair.json')))))"
//
// Fund the wallet with USDC plus a small amount of native SOL for
// transaction fees (about 0.001 SOL covers many calls). A USDC-only
// wallet returns "insufficient funds for rent".
//
// Get MPP32_AGENT_KEY at mpp32.org/agent-console. Free curated services
// (DexScreener, Jupiter price, CoinGecko ping, httpbin) work without
// any payment key.`}</pre>
            </div>
          </section>

          {/* Available Tools */}
          <section id="agent-tools">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Available Tools</h2>
            <div className="space-y-6">
              <div className="card-surface rounded p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-xs text-mpp-amber border border-mpp-amber/30 px-2 py-1 rounded">TOOL</span>
                  <span className="font-mono text-sm text-foreground">list_mpp32_services</span>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Returns all available services in the MPP32 ecosystem with names, categories, prices, and proxy URLs. Use this to discover what APIs are available before making paid calls.
                </p>
                <div className="card-surface rounded overflow-hidden border border-mpp-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mpp-border">
                        <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Parameter</th>
                        <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-2 font-mono text-mpp-amber text-xs">category</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">string (optional)</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">Filter by category slug (e.g. "ai-inference", "token-scanner")</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card-surface rounded p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-xs text-mpp-amber border border-mpp-amber/30 px-2 py-1 rounded">TOOL</span>
                  <span className="font-mono text-sm text-foreground">call_mpp32_endpoint</span>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Calls a machine-payable API endpoint. Handles the full x402 payment flow end-to-end: sends the initial request, reads the 402 challenge, signs a USDC payment on Solana or Base with the configured private key, retries with the X-Payment header, and returns the data plus the on-chain settlement signature.
                </p>
                <div className="card-surface rounded overflow-hidden border border-mpp-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mpp-border">
                        <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Parameter</th>
                        <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mpp-border">
                      {[
                        { param: "slug", type: "string (required)", desc: "Service slug to call (e.g. \"solana-token-intelligence\")" },
                        { param: "method", type: "string (default: GET)", desc: "HTTP method: GET, POST, PUT, or DELETE" },
                        { param: "body", type: "string (optional)", desc: "JSON request body for POST/PUT requests" },
                        { param: "query", type: "object (optional)", desc: "URL query parameters as key-value pairs" },
                      ].map((row) => (
                        <tr key={row.param}>
                          <td className="px-4 py-2 font-mono text-mpp-amber text-xs">{row.param}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{row.type}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Example Conversation */}
          <section id="agent-example">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Example Agent Conversation</h2>
            <p className="text-muted-foreground text-sm mb-4">Here's what it looks like when an AI agent uses the MPP32 MCP server:</p>
            <div className="card-surface rounded p-5">
              <pre className="text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">{`User: What Solana intelligence APIs are available on MPP32?

Agent: Let me check the MPP32 ecosystem for you.
       [Uses list_mpp32_services with category "token-scanner"]

       I found the Solana Token Intelligence service:
       - Price: $0.008 per query
       - Returns alpha scores, rug risk, whale activity, and market data
         for any Solana token.

       Would you like me to analyze a specific token?

User: Yes, check BONK for me.

Agent: I'll query the intelligence endpoint for BONK.
       [Uses call_mpp32_endpoint with slug "solana-token-intelligence",
        method "POST", body '{"token":"BONK"}']

       Here's the analysis for BONK:
       - Alpha Score: 74/100
       - Rug Risk: 2.1/10 (low)
       - 24h Pump Probability: 42%
       - Whale Activity: moderate (58% buy dominance)
       - Market Cap: $1.8B
       - 24h Volume: $284M

       The token shows strong fundamentals with low rug risk.`}</pre>
            </div>
          </section>

          {/* Environment Variables */}
          <section id="agent-env">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Environment Variables</h2>
            <div className="card-surface rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mpp-border">
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Variable</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Required</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mpp-border">
                  <tr>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_AGENT_KEY</td>
                    <td className="px-5 py-3 text-foreground text-sm">Recommended</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">Session API key (mpp32_agent_*) generated at mpp32.org/agent-console. Attributes every call to your dashboard for spend, success rate, and protocol breakdown. Without it the MCP still works but calls are anonymous and only native services are reachable. Also accepted as MPP32_API_KEY.</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_SOLANA_PRIVATE_KEY</td>
                    <td className="px-5 py-3 text-foreground text-sm">For paid x402 on Solana</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">Base58-encoded 64-byte Solana secret key (the value Phantom exports under "show private key", not the seed phrase). Used to sign USDC payments locally. Never leaves your machine. The wallet also needs roughly 0.001 SOL on hand to cover network fees.</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_PRIVATE_KEY</td>
                    <td className="px-5 py-3 text-foreground text-sm">For paid x402 on Base</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">0x-prefixed EVM private key for x402 USDC payments on Base. Used when a service only advertises an EVM payment network.</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_PREFERRED_NETWORK</td>
                    <td className="px-5 py-3 text-muted-foreground text-sm">No</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">When both signing keys are present and a challenge advertises multiple networks, force one. Accepts <code className="font-mono text-foreground">solana</code>, <code className="font-mono text-foreground">base</code>, <code className="font-mono text-foreground">evm</code>, or a full CAIP-2 string.</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_API_URL</td>
                    <td className="px-5 py-3 text-muted-foreground text-sm">No</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">Override the MPP32 API base URL (default: https://mpp32.org)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Compatible Runtimes */}
          <section id="agent-runtimes">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Compatible Runtimes</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="card-surface rounded p-5">
                <p className="text-foreground font-semibold text-sm mb-1">MCP Desktop Agents</p>
                <p className="font-mono text-xs text-mpp-amber mb-2">mcp_config.json</p>
                <p className="text-muted-foreground text-xs">Add the MCP server to your desktop agent's configuration file and restart.</p>
              </div>
              <div className="card-surface rounded p-5">
                <p className="text-foreground font-semibold text-sm mb-1">MCP Code Agents</p>
                <p className="font-mono text-xs text-mpp-amber mb-2">settings.json</p>
                <p className="text-muted-foreground text-xs">Add to the mcpServers section in your agent's project or global settings.</p>
              </div>
              <div className="card-surface rounded p-5">
                <p className="text-foreground font-semibold text-sm mb-1">Any MCP Client</p>
                <p className="font-mono text-xs text-mpp-amber mb-2">stdio transport</p>
                <p className="text-muted-foreground text-xs">Works with any runtime supporting the Model Context Protocol via stdio.</p>
              </div>
            </div>
          </section>

          {/* npm Package */}
          <section id="agent-package">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Open Source</h2>
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-1">mpp32-mcp-server</p>
              <p className="font-mono text-xs text-mpp-amber mb-2">npx -y mpp32-mcp-server@latest</p>
              <p className="text-muted-foreground text-xs mb-4">MIT-licensed. Listed in the official Model Context Protocol registry. The MCP server is a thin wrapper around MPP32's public API with no proprietary dependencies.</p>
              <div className="flex gap-3">
                <a
                  href="https://www.npmjs.com/package/mpp32-mcp-server"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-mono text-mpp-amber hover:text-mpp-amber-bright transition-colors"
                >
                  npm &rarr;
                </a>
                <a
                  href="https://github.com/mpp32/mcp-server"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-mono text-mpp-amber hover:text-mpp-amber-bright transition-colors"
                >
                  GitHub &rarr;
                </a>
              </div>
            </div>
          </section>

        </div>
      ) : null}

    </div>
  );
}
