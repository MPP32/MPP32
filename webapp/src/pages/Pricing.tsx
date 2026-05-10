import { Link } from "react-router-dom";

const rows = [
  { queries: "100 queries", cost: "$0.80" },
  { queries: "1,000 queries", cost: "$8.00" },
  { queries: "10,000 queries", cost: "$80.00" },
  { queries: "100,000 queries", cost: "$800.00" },
];

const faqs = [
  {
    q: "What payment methods does MPP32 support?",
    a: "MPP32 supports 5 protocols: Tempo (pathUSD on Ethereum L2), x402 (USDC on Solana), ACP (checkout sessions), AP2 (verifiable credentials), and AGTP (agent identification). All are accepted on all endpoints at the same price. Callers use whichever protocol fits their stack.",
  },
  {
    q: "Do I need an account?",
    a: "No. MPP is wallet-based. There is no registration, no email, and no API key. Your funded wallet is your identity. Queries are paid atomically per request.",
  },
  {
    q: "Is there a free tier?",
    a: "The playground endpoint at /playground is unmetered for evaluation purposes. The production endpoint at /api/intelligence charges $0.008 USD per query, payable via any of the 5 supported protocols.",
  },
  {
    q: "How does the payment work exactly?",
    a: "Your client makes a POST request. The server returns HTTP 402 with a payment challenge. Your MPP client (mppx or pympp SDK) detects which protocol to use, completes the payment or authorization, and re-submits the request with proof. All 5 protocol flows are handled automatically by the SDKs. No manual implementation needed.",
  },
  {
    q: "Can I get volume discounts?",
    a: "For enterprise agreements above 100,000 queries per month, reach out via our contact page.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Pricing</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">
            Pay per query. Nothing else.
          </h1>
          <p className="text-muted-foreground text-lg">No subscriptions, no tiers, no commitments.</p>
          <p className="font-mono text-xs text-muted-foreground mt-3">
            This is the price for the MPP32 Intelligence Oracle API. If you're building your own service, you set your own pricing.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">

        {/* Price card */}
        <div className="card-surface rounded p-10 text-center border-mpp-amber/20">
          <p className="font-display text-6xl font-semibold text-mpp-amber mb-2">0.008</p>
          <p className="font-mono text-foreground text-xl mb-1">USD</p>
          <p className="text-muted-foreground text-xs mb-4">Accepted via all 5 protocols: Tempo, x402, ACP, AP2, and AGTP</p>
          <p className="text-muted-foreground text-base">per intelligence query</p>
          <div className="mt-6 pt-6 border-t border-mpp-border">
            <p className="text-muted-foreground text-xs leading-relaxed max-w-md mx-auto">
              MPP32 accepts payments across 5 protocols: <strong className="text-foreground">Tempo</strong> (pathUSD on Ethereum L2), <strong className="text-foreground">x402</strong> (USDC on Solana), <strong className="text-foreground">ACP</strong> (checkout sessions), <strong className="text-foreground">AP2</strong> (verifiable credentials), and <strong className="text-foreground">AGTP</strong> (agent identity). All prices are denominated in USD. 0.008 USD = less than one US cent per query.
            </p>
          </div>
        </div>

        {/* Builder callout */}
        <div className="card-surface rounded p-5 border-l-2 border-l-mpp-amber flex items-start gap-4">
          <span className="text-mpp-amber text-base flex-shrink-0 mt-0.5">■</span>
          <div>
            <p className="text-foreground font-semibold text-sm mb-1">Building your own MPP service?</p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-2">
              You set your price in USD. MPP32 handles verification across all 5 protocols. No protocol engineering costs on your side. Use our infrastructure, keep 100% of your revenue. Payments route directly to your wallet.
            </p>
            <Link to="/build" className="font-mono text-mpp-amber text-sm hover:opacity-80 transition-opacity">
              Learn more about building →
            </Link>
          </div>
        </div>

        {/* Scale reference */}
        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">At scale</h2>
          <div className="card-surface rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mpp-border">
                  <th className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Volume</th>
                  <th className="text-right px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mpp-border">
                {rows.map((r) => (
                  <tr key={r.queries}>
                    <td className="px-5 py-3 text-foreground">{r.queries}</td>
                    <td className="px-5 py-3 font-mono text-mpp-amber text-right">{r.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-6">FAQ</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="card-surface rounded p-5">
                <p className="text-foreground font-semibold text-sm mb-2">{faq.q}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-mpp-border pt-8 text-center">
          <p className="text-muted-foreground text-sm mb-4">Ready to start?</p>
          <Link to="/playground">
            <button className="btn-amber inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold">
              Open the Playground
            </button>
          </Link>
        </section>
      </div>
    </div>
  );
}
