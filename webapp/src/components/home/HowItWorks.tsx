const steps = [
  {
    num: "01",
    title: "Register Your API",
    desc: "Submit your HTTP endpoint URL and set your price in USD. Provide your wallet address for direct payment settlement. No SDK integration, no code changes to your existing service.",
    code: `POST /api/submissions
{
  "name": "My Token Scanner",
  "endpointUrl": "https://api.yours.com/scan",
  "pricePerQuery": 0.01,
  "paymentAddress": "0x...",
  "solanaAddress": "So1..."
}`,
  },
  {
    num: "02",
    title: "MPP32 Proxies Every Request",
    desc: "When an agent calls your API through MPP32, we verify their payment across all 5 protocols automatically. We enforce rate limits, handle retries, and log everything. Your server only sees clean, verified requests.",
    code: `Agent → MPP32 Proxy → Your API

← 402 Payment Required
  (5 protocol challenges returned)
→ Payment verified (any protocol)
← 200 + your data returned to agent`,
  },
  {
    num: "03",
    title: "You Get Paid Directly",
    desc: "Revenue settles directly to your wallet in the currency of whichever protocol the agent used. Tempo, x402, AP2, ACP, and AGTP are all supported. Track everything in real time through your provider dashboard. No invoices, no billing code, no delays.",
    code: `Revenue: 127 queries × $0.01 = $1.27
Settlement: Direct to wallet
Protocols used:
  Tempo: 45 queries
  x402: 52 queries
  ACP: 30 queries`,
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
          Three steps. Five minutes. Every protocol.
        </h2>
      </div>

      <div className="space-y-4 max-w-3xl">
        {steps.map((step) => (
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
    </section>
  );
}
