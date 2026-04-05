import { Link } from "react-router-dom";

const values = [
  {
    label: "Signal over noise",
    desc: "We return 8 dimensions of signal, not 80 metrics that confuse you. Every field in the payload is there because it has demonstrated predictive value.",
  },
  {
    label: "Pay-as-you-go",
    desc: "No subscriptions. No minimum spend. Query when you need to. The economics only make sense if you only pay for what you use.",
  },
  {
    label: "Machine-native",
    desc: "MPP32 is built for AI agents, not just human developers. Autonomous systems should be able to acquire data on-demand without human-managed billing.",
  },
  {
    label: "Open platform",
    desc: "MPP32 isn't just a product — it's infrastructure. Any developer can deploy an MPP service, set their own rates, and get listed in the Built with MPP32 ecosystem. The rails are open.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">About</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">
            Built to see what others miss.
          </h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">

        {/* Mission */}
        <section>
          <p className="text-muted-foreground text-base leading-relaxed mb-4">
            On-chain intelligence has historically been a privilege of scale. Bloomberg terminals cost thousands of dollars a month. Nansen Pro is priced for funds. Discord alpha groups are noisy, unverifiable, and often deliberately misleading. The result is a market where information advantage is reserved for institutions with the budget to access it.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed mb-4">
            MPP32 exists to change that. We believe precision signal should be accessible at the moment of decision, for the cost of less than one cent per query. The Machine Payments Protocol makes that model economically viable — no recurring billing, no minimums, no accounts. You pay for the value you receive, at the instant you receive it.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            We've since opened the same infrastructure to any builder. If you want to offer token scanning, price oracles, sentiment feeds, or any on-chain intelligence service — you can launch on MPP32, set your own pricing, and route payments directly to your wallet. The protocol handles the billing rails. You handle the signal.
          </p>
        </section>

        {/* Values */}
        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-6">Values</h2>
          <div className="space-y-4">
            {values.map((v) => (
              <div key={v.label} className="flex items-start gap-4">
                <span className="text-mpp-amber text-sm flex-shrink-0 mt-0.5">■</span>
                <div>
                  <p className="text-foreground font-semibold text-sm mb-1">{v.label}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Two ways to use MPP32 */}
        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-6">Two ways to use MPP32</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-surface border border-mpp-border rounded-lg p-6">
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">Intelligence Oracle</p>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">Query any token</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                POST to /api/intelligence and receive 8-point on-chain analysis in under 2 seconds. Pay 0.008 pathUSD per query. No account required.
              </p>
              <Link to="/playground" className="font-mono text-mpp-amber text-sm hover:opacity-80 transition-opacity">
                Try the Oracle →
              </Link>
            </div>
            <div className="card-surface border border-mpp-border rounded-lg p-6">
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">Builder Platform</p>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">Build your own service</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Use mppx to deploy any data service on MPP rails. Set your price. Route payments to your wallet. Get listed in the ecosystem.
              </p>
              <Link to="/build" className="font-mono text-mpp-amber text-sm hover:opacity-80 transition-opacity">
                Start Building →
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-mpp-border pt-8">
          <p className="text-muted-foreground text-sm mb-4">Questions or partnership inquiries?</p>
          <Link to="/contact">
            <button className="btn-amber inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold">
              Get in touch
            </button>
          </Link>
        </section>
      </div>
    </div>
  );
}
