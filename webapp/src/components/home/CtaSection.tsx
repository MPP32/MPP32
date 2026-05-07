import { Link } from "react-router-dom";

export function CtaSection() {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
          Get Started
        </p>
        <h2 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">
          Connect your API. Let agents pay.
        </h2>
        <p className="text-muted-foreground text-base mb-10">
          Register your HTTP endpoint. Set your price. MPP32 handles everything between your API and the agents that need it.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Provider card (primary) */}
          <div className="card-surface border border-mpp-border rounded-lg p-8 text-center">
            <p className="font-mono text-mpp-amber text-xs uppercase mb-3">For API Providers</p>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Connect your API</h3>
            <p className="text-muted-foreground text-sm mb-5">Register your endpoint. Set your price. Accept payments across 5 protocols with zero code changes.</p>
            <Link to="/build" className="block">
              <button className="btn-amber w-full py-2.5 rounded text-sm font-semibold">
                Get Started
              </button>
            </Link>
          </div>

          {/* Oracle card (secondary) */}
          <div className="card-surface border border-mpp-border rounded-lg p-8 text-center">
            <p className="font-mono text-mpp-amber text-xs uppercase mb-3">MPP32 Oracle</p>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Try the Oracle</h3>
            <p className="text-muted-foreground text-sm mb-5">See MPP32 in action. Query any Solana token through our own payment-gated intelligence API.</p>
            <Link to="/playground" className="block">
              <button className="border border-mpp-border hover:border-mpp-amber/40 w-full py-2.5 rounded text-sm text-foreground transition-colors">
                Open Playground
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
