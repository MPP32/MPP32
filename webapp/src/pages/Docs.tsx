import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = ["cURL", "JavaScript", "Python"] as const;
type Tab = (typeof tabs)[number];

const curlExample = `# Step 1: Make the initial request — you'll get 402
curl -X POST https://api.mpp32.org/api/intelligence \\
  -H "Content-Type: application/json" \\
  -d '{"token":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"}'
# <- HTTP 402 Payment Required
# Tempo: WWW-Authenticate: Payment amount=0.008 currency=pathUSD ...
# x402:  X-Payment header with USDC on Solana

# Step 2: Pay using mppx CLI and retry automatically
npx mppx https://api.mpp32.org/api/intelligence \\
  --method POST \\
  --body '{"token":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"}' \\
  --private-key $PRIVATE_KEY
# <- HTTP 200 OK — intelligence payload returned`;

const jsExample = `import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

// Configure MPP payment client once at startup
Mppx.create({
  methods: [tempo({ account: privateKeyToAccount(process.env.PRIVATE_KEY) })]
})

// Make the request — mppx intercepts the 402 and pays automatically
const res = await fetch('https://api.mpp32.org/api/intelligence', {
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
    "https://api.mpp32.org/api/intelligence",
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
              { step: "2", label: "Callers install the mppx SDK. Providers install nothing.", desc: "If you are CALLING a paid API (e.g. as an agent or client), install the mppx package (npm install mppx or pip install pympp) to handle the MPP payment flow automatically. If you are PROVIDING an API, you install nothing at all. Just expose a normal HTTP endpoint and the MPP32 proxy verifies payments server-side before forwarding requests to you." },
              { step: "3", label: "Fund a wallet", desc: "MPP32 accepts payments across all 5 supported protocols: Tempo, x402, ACP, AP2, and AGTP. Fund an EVM wallet with pathUSD for Tempo, a Solana wallet with USDC for x402, or configure credentials for ACP, AP2, and AGTP. See the Supported Protocols table below for details." },
              { step: "4", label: "Configure mppx and start querying", desc: "Initialize mppx with your wallet's private key. From that point on, every POST to /api/intelligence automatically handles the 402 payment and returns intelligence data." },
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
            MPP32 uses the <strong className="text-foreground">Machine Payments Protocol (MPP)</strong> for authentication. There are no API keys. Instead, you authenticate by proving you have paid for, or are authorized to make, the specific request. MPP32 supports all 5 protocols. Callers can pay or authenticate with whichever one they prefer.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            The flow works in three steps:
          </p>
          <div className="space-y-3 mb-6">
            {[
              { step: "1", label: "Initial request", desc: "POST to /api/intelligence without any credential. The server returns HTTP 402 with a WWW-Authenticate header containing the payment challenge." },
              { step: "2", label: "Pay", desc: "Your MPP client (mppx SDK or pympp) reads the challenge and pays automatically using whichever protocol is available. The SDK selects the correct protocol, constructs the payment or credential, and attaches proof to the retry request." },
              { step: "3", label: "Authenticated request", desc: "Re-submit the original request with the Authorization: Payment token=... header. The server verifies the receipt on-chain and returns the intelligence payload." },
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
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Tempo flow</p>
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`← 402 WWW-Authenticate: Payment amount=0.008 currency=pathUSD recipient=<wallet> nonce=<nonce> expires=<ts>
→ Authorization: Payment token=<signed-receipt-jwt>
← 200 Payment-Receipt: verified`}</pre>
          </div>
          <div className="card-surface rounded p-4 mb-4">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">x402 flow (alternative)</p>
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`← 402 X-Payment: {"scheme":"exact","network":"solana","maxAmountRequired":"8000","resource":"...","description":"..."}
→ X-Payment: <base64-encoded-payment-proof>
← 200 Payment verified`}</pre>
          </div>
          <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-mpp-amber font-mono uppercase tracking-wider">Note:</span>{" "}
              All payment and authorization flows are handled automatically by the mppx and pympp SDKs. You do not need to implement any protocol manually.
            </p>
          </div>

          {/* Supported Protocols */}
          <h3 className="text-foreground font-semibold text-sm mt-8 mb-3">Supported Protocols</h3>
          <p className="text-muted-foreground text-sm mb-4">
            MPP32 acts as a universal proxy across 5 protocols. Callers use whichever protocol fits their stack. The provider receives a plain HTTP request after MPP32 verifies the credential.
          </p>
          <div className="card-surface rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mpp-border">
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Protocol</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Settlement / Mechanism</th>
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Header</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mpp-border">
                {[
                  { protocol: "Tempo", type: "Payment", mechanism: "pathUSD on Ethereum L2", header: "Authorization: Payment" },
                  { protocol: "x402", type: "Payment", mechanism: "USDC on Solana", header: "X-Payment" },
                  { protocol: "ACP", type: "Payment", mechanism: "Checkout sessions", header: "X-ACP-Session" },
                  { protocol: "AP2", type: "Authorization", mechanism: "Verifiable credentials", header: "X-AP2-Mandate" },
                  { protocol: "AGTP", type: "Identity", mechanism: "Agent identification", header: "Agent-ID" },
                ].map((row) => (
                  <tr key={row.protocol}>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">{row.protocol}</td>
                    <td className="px-5 py-3 text-foreground text-xs">{row.type}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{row.mechanism}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground text-xs">{row.header}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* M32 Token Discount */}
        <section id="token-discount">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">M32 Token Holder Discounts</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            Hold M32 tokens in your Solana wallet to receive automatic fee reductions on the Intelligence Oracle. Pass your wallet address via the <code className="font-mono text-xs text-mpp-amber">X-Wallet-Address</code> header and the protocol verifies your on chain balance before constructing the 402 challenge.
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
curl -X POST https://api.mpp32.org/api/intelligence \\
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
            <span className="font-mono text-sm text-foreground">https://api.mpp32.org/api/intelligence</span>
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
              <p className="text-foreground font-semibold text-sm mb-1">mppx</p>
              <p className="font-mono text-xs text-mpp-amber mb-2">npm install mppx</p>
              <p className="text-muted-foreground text-xs">JavaScript/TypeScript SDK for Node.js and browsers. Handles the full 402 payment flow automatically.</p>
            </div>
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-1">pympp</p>
              <p className="font-mono text-xs text-mpp-amber mb-2">pip install pympp</p>
              <p className="text-muted-foreground text-xs">Python SDK for scripting, data pipelines, and agent integrations. Wraps the requests library.</p>
            </div>
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-1">mpp32</p>
              <p className="font-mono text-xs text-mpp-amber mb-2">npm install mpp32</p>
              <p className="text-muted-foreground text-xs">High-level SDK for MPP32 platform. Handles all 5 supported protocol flows. One-line token analysis.</p>
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
              The MPP32 proxy sits between callers and your API. When a user queries your slug, the proxy verifies their payment or credential across any of the 5 supported protocols, forwards the request to your endpoint, and returns your response. You never handle payments directly. They are deposited to your configured wallet address automatically.
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
                { step: "2", label: "Serve the token", desc: "Configure your server to respond to GET requests at /.well-known/mpp32-verify with HTTP 200 and the token as the plain-text body." },
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
                <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`app.get('/.well-known/mpp32-verify', (req, res) => {
  res.type('text/plain').send(process.env.MPP32_VERIFY_TOKEN);
});`}</pre>
              </div>
              <div className="card-surface rounded p-4">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Python (Flask)</p>
                <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`@app.route('/.well-known/mpp32-verify')
def mpp32_verify():
    return os.environ['MPP32_VERIFY_TOKEN'], 200, {'Content-Type': 'text/plain'}`}</pre>
              </div>
              <div className="card-surface rounded p-4">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Static file</p>
                <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`# Create the file at .well-known/mpp32-verify in your web root
# Contents: your verification token (plain text, no newline)
echo -n "YOUR_TOKEN_HERE" > .well-known/mpp32-verify`}</pre>
              </div>
            </div>

            <h3 className="text-foreground font-semibold text-sm mb-3">Re-verification</h3>
            <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-amber font-mono uppercase tracking-wider">Automatic checks:</span>{" "}
                The proxy re-verifies your endpoint every 24 hours. If verification fails 3 consecutive times, proxy traffic is suspended until you re-verify manually from the management dashboard. Keep the /.well-known/mpp32-verify route live at all times.
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
curl https://api.mpp32.org/api/proxy/your-slug`}</pre>
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
                { step: "1", label: "User sends request", desc: "The caller submits a request to /api/proxy/your-slug with a payment or authorization credential using any of the 5 supported protocols." },
                { step: "2", label: "MPP32 verifies credential", desc: "The proxy verifies the credential against the appropriate protocol. Invalid or missing credentials receive a 402 Payment Required response with challenge headers." },
                { step: "3", label: "Request forwarded", desc: "Once payment or authorization is verified, the request is forwarded to your configured endpoint URL." },
                { step: "4", label: "Payment settled", desc: "The payment amount (your configured price per query) is settled to your wallet via the protocol the caller used." },
                { step: "5", label: "Response returned", desc: "Your endpoint's response is passed back to the caller. The entire round-trip is transparent to the end user." },
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
            <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-amber font-mono uppercase tracking-wider">Settlement:</span>{" "}
                Payments settle via the protocol the caller used. Tempo settles in pathUSD to your EVM address, x402 settles in USDC to your Solana address, and ACP, AP2, and AGTP each follow their own settlement or authorization flow. Payouts arrive at your configured wallet with no additional claim step.
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
                  fix: "Verify your wallet addresses are correctly set in /manage. Tempo payments go to your EVM address, x402 payments go to your Solana address. Make sure the correct addresses are configured for each protocol you want to accept.",
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

          {/* Overview */}
          <section id="agent-overview">
            <h2 className="font-display text-2xl font-semibold text-foreground mb-4">MCP Server for AI Agents</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              The MPP32 MCP (<strong className="text-foreground">Model Context Protocol</strong>) server lets autonomous AI agents and any MCP-compatible runtime discover and call machine-payable APIs autonomously. Drop it into your agent configuration and it handles service discovery, payment negotiation, and response delivery. No custom code required.
            </p>
            <div className="card-surface border-l-2 border-mpp-amber/60 rounded p-4 bg-mpp-amber/5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-mpp-amber font-mono uppercase tracking-wider">One command:</span>{" "}
                Install with <span className="font-mono text-foreground">npx mpp32-mcp-server</span>. No global install, no API keys. Just a funded wallet and your agent is ready to pay for intelligence.
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
                  desc: "The MCP server runs directly via npx. No global installation required. It connects to MPP32's API and exposes two tools for your agent.",
                  code: "npx mpp32-mcp-server",
                },
                {
                  step: "2",
                  label: "Configure your agent",
                  desc: "Add the server to your MCP-compatible agent configuration. Provide an EVM private key (for Tempo) and/or a Solana private key (for x402). Additional protocols like ACP, AP2, and AGTP are configured via environment variables. The MCP server selects the best available protocol automatically.",
                },
                {
                  step: "3",
                  label: "Start using",
                  desc: "Ask your agent to browse MPP32 services or call a specific endpoint. The MCP server handles service discovery and the full HTTP 402 payment flow automatically.",
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
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_PRIVATE_KEY": "your-tempo-private-key",
        "MPP32_SOLANA_PRIVATE_KEY": "your-solana-private-key"
      }
    }
  }
}`}</pre>
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
                  Calls a machine-payable API endpoint. Handles the full 402 payment flow across all 5 supported protocols (Tempo, x402, ACP, AP2, AGTP): sends initial request, receives payment challenge, completes the payment or authorization, and retries with proof.
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
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_PRIVATE_KEY</td>
                    <td className="px-5 py-3 text-foreground text-sm">One required</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">EVM-compatible private key for Tempo payments (pathUSD). At least one private key is required across the supported protocols.</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_SOLANA_PRIVATE_KEY</td>
                    <td className="px-5 py-3 text-foreground text-sm">One required</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">Solana wallet private key for x402 USDC payments. Required if using x402 instead of or alongside Tempo.</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-xs">MPP32_API_URL</td>
                    <td className="px-5 py-3 text-muted-foreground text-sm">No</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">Override the MPP32 API base URL (default: https://api.mpp32.org)</td>
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
              <p className="font-mono text-xs text-mpp-amber mb-2">npm install -g mpp32-mcp-server</p>
              <p className="text-muted-foreground text-xs mb-4">MIT-licensed. Contributions welcome. The MCP server is a thin wrapper around MPP32's public API with no proprietary dependencies.</p>
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
