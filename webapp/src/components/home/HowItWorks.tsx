const oracleSteps = [
  {
    num: "01",
    title: "Submit",
    desc: 'POST your token address or ticker to /api/intelligence',
    code: `POST /api/intelligence
{ "token": "BONK" }`,
  },
  {
    num: "02",
    title: "Pay",
    desc: "The endpoint returns HTTP 402. Your MPP client pays 0.008 pathUSD via Tempo.",
    code: `← 402 WWW-Authenticate: Payment
  amount=0.008 currency=pathUSD
→ Authorization: Payment token=...`,
  },
  {
    num: "03",
    title: "Receive",
    desc: "The credential is verified. Your intelligence report is returned instantly.",
    code: `← 200 Payment-Receipt: verified
{ "alphaScore": 82,
  "rugRisk": "Low", ... }`,
  },
];

const builderSteps = [
  {
    num: "01",
    title: "Build Your Endpoint",
    desc: "Create any data service — token scanning, price feeds, sentiment analysis — anything that returns JSON.",
    code: `// Any HTTP endpoint
POST /your-service
{ "token": "BONK" }
→ { "score": 87, ... }`,
  },
  {
    num: "02",
    title: "Add mppx Middleware",
    desc: "Integrate the mppx SDK in minutes. It handles the 402 payment challenge, wallet verification, and settlement.",
    code: `import { mppx } from 'mppx'
const mpp = mppx({
  price: 0.008,
  wallet: 'YOUR_WALLET',
})
app.post('/api/query',
  mpp.middleware(), handler)`,
  },
  {
    num: "03",
    title: "List & Earn",
    desc: "Submit your service to the Built with MPP32 ecosystem. It goes live immediately — no review queue. Payments flow directly to your wallet.",
    code: `← 402 Payment required
→ Authorization: Payment ...
← 200 + data + receipt
// You receive pathUSD directly`,
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-12">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
          How It Works
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">
          Two ways to use MPP32.
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Use the Oracle column */}
        <div>
          <div className="flex items-start gap-3 mb-6">
            <span className="text-mpp-amber text-lg leading-none mt-0.5">■</span>
            <div>
              <p className="text-foreground font-semibold">Use the Oracle</p>
              <p className="text-muted-foreground text-xs">Query any Solana token via MPP</p>
            </div>
          </div>
          <div className="space-y-4">
            {oracleSteps.map((step) => (
              <div key={step.num} className="card-surface rounded p-6">
                <p className="font-mono text-mpp-amber text-xs mb-4">{step.num}</p>
                <h3 className="text-foreground font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">{step.desc}</p>
                <pre className="card-surface-2 rounded p-3 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap overflow-x-auto scrollbar-thin">
                  {step.code}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Build on the Platform column */}
        <div>
          <div className="flex items-start gap-3 mb-6">
            <span className="text-mpp-amber text-lg leading-none mt-0.5">■</span>
            <div>
              <p className="text-foreground font-semibold">Build on the Platform</p>
              <p className="text-muted-foreground text-xs">Deploy your own MPP service</p>
            </div>
          </div>
          <div className="space-y-4">
            {builderSteps.map((step) => (
              <div key={step.num} className="card-surface rounded p-6">
                <p className="font-mono text-mpp-amber text-xs mb-4">{step.num}</p>
                <h3 className="text-foreground font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">{step.desc}</p>
                <pre className="card-surface-2 rounded p-3 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap overflow-x-auto scrollbar-thin">
                  {step.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
