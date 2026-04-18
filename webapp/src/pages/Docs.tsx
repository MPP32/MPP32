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
# WWW-Authenticate: Payment amount=0.008 currency=pathUSD ...

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

const docSections = ["API Reference", "Provider Integration Guide"] as const;
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
          <p className="text-muted-foreground text-lg">Everything you need to integrate with MPP32 — as a caller or as a provider.</p>
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
              { step: "2", label: "Callers install the mppx SDK — providers install nothing", desc: "If you are CALLING a paid API (e.g. as an agent or client), install the mppx package (npm install mppx or pip install pympp) to handle the MPP payment flow automatically. If you are PROVIDING an API, you install nothing at all — just expose a normal HTTP endpoint and the MPP32 proxy verifies payments server-side before forwarding requests to you." },
              { step: "3", label: "Fund a wallet with pathUSD", desc: "pathUSD is a stablecoin pegged 1:1 to USD, settled on Ethereum L2 via the Tempo protocol. Acquire pathUSD through the Tempo app and fund an EVM wallet you control." },
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
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Authentication</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            MPP32 uses the <strong className="text-foreground">Machine Payments Protocol (MPP)</strong> for authentication. There are no API keys. Instead, you authenticate by proving you have paid for the specific request you are making.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            The flow works in three steps:
          </p>
          <div className="space-y-3 mb-6">
            {[
              { step: "1", label: "Initial request", desc: "POST to /api/intelligence without any credential. The server returns HTTP 402 with a WWW-Authenticate header containing the payment challenge." },
              { step: "2", label: "Pay", desc: "Your MPP client (mppx SDK or pympp) reads the challenge, constructs and broadcasts a payment of 0.008 pathUSD via Tempo, and receives a signed payment receipt." },
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
          <div className="card-surface rounded p-4">
            <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">{`← 402 WWW-Authenticate: Payment amount=0.008 currency=pathUSD recipient=<wallet> nonce=<nonce> expires=<ts>
→ Authorization: Payment token=<signed-receipt-jwt>
← 200 Payment-Receipt: verified`}</pre>
          </div>
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
          <div className="grid sm:grid-cols-2 gap-4">
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
              The MPP32 proxy sits between callers and your API. When a user queries your slug, the proxy verifies their Tempo micropayment, forwards the request to your endpoint, and returns your response. You never handle payments directly — they are deposited to your configured wallet address automatically.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              <strong className="text-foreground">You do not need to install an SDK or add middleware to your code.</strong>{" "}
              You just host a plain HTTP endpoint — in any language, any framework — and our hosted proxy handles MPP payment verification server-side. Your endpoint only receives a normal HTTP request after payment has already been verified.
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
                { req: "No CORS required", desc: "The proxy handles all CORS — your endpoint only needs to respond to the proxy server." },
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
                { step: "1", label: "User sends request", desc: "The caller submits a request to /api/proxy/your-slug with a Tempo payment credential in the Authorization header." },
                { step: "2", label: "MPP32 verifies payment", desc: "The proxy checks the payment credential against the Tempo network. Invalid or missing credentials receive a 402 Payment Required response." },
                { step: "3", label: "Request forwarded", desc: "Once payment is verified, the request is forwarded to your configured endpoint URL." },
                { step: "4", label: "Payment settled", desc: "The payment amount (your configured price per query) is sent to your wallet address on the Tempo network." },
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
                Payments settle on the Tempo network (Ethereum L2) in{" "}
                <strong className="text-foreground">pathUSD</strong>, a USD-pegged stablecoin. Payouts arrive at your configured wallet with no additional claim step.
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
                  fix: "Verify your wallet address is correctly set in /manage. Ensure it's a valid EVM address (0x...). Payments are sent to this address on the Tempo network.",
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

    </div>
  );
}
