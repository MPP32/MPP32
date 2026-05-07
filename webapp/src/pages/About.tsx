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
    label: "Protocol-agnostic",
    desc: "MPP32 supports 5 payment and identity protocols so you never have to choose. One proxy handles Tempo, x402, ACP, AP2, and AGTP. No protocol engineering on your side.",
  },
  {
    label: "Machine-native",
    desc: "MPP32 is built for AI agents, not just human developers. Autonomous systems should be able to acquire data on-demand without human-managed billing.",
  },
  {
    label: "Zero integration burden",
    desc: "Providers set a price in USD and expose a plain HTTP endpoint. MPP32 handles payment verification across all protocols. No SDKs, no middleware, no per-protocol code.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">About</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">
            The universal proxy for agent payments.
          </h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">

        {/* Mission */}
        <section>
          <p className="text-muted-foreground text-base leading-relaxed mb-4">
            AI agents need to pay for services on the internet, but every payment protocol works differently. Each one has its own headers, its own verification flow, its own settlement network. Building support for even one is a real engineering project. Building support for all of them is impractical for most teams.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed mb-4">
            MPP32 is a universal proxy that sits between the caller and the provider. It accepts payments across 5 protocols (Tempo, x402, ACP, AP2, and AGTP) so providers never have to implement any of them. You set your price in USD, expose a plain HTTP endpoint, and MPP32 handles verification, settlement, and forwarding. No recurring billing, no minimums, no accounts. Callers pay per request, providers get paid instantly.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            We also run our own Intelligence Oracle on the same infrastructure, an on-chain analysis service that demonstrates what you can build on MPP32 rails. But the core mission is the proxy itself: making machine-to-machine payments work across every protocol, for every builder, at any scale.
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
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">Universal Payment Proxy</p>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">Accept payments across all 5 protocols</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Deploy any API behind the MPP32 proxy. Set your price in USD. MPP32 verifies payments from Tempo, x402, ACP, AP2, and AGTP. You never touch protocol code.
              </p>
              <Link to="/build" className="font-mono text-mpp-amber text-sm hover:opacity-80 transition-opacity">
                Start Building →
              </Link>
            </div>
            <div className="card-surface border border-mpp-border rounded-lg p-6">
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">Intelligence Oracle</p>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">Query any token</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Built on our own infrastructure. POST to /api/intelligence and receive 8-point on-chain analysis in under 2 seconds. Pay $0.008 per query across all 5 supported protocols.
              </p>
              <Link to="/playground" className="font-mono text-mpp-amber text-sm hover:opacity-80 transition-opacity">
                Try the Oracle →
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
