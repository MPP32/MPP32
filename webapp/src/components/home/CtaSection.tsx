import { Link } from "react-router-dom";

export function CtaSection() {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
          Get Started
        </p>
        <h2 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">
          Use it. Build with it.
        </h2>
        <p className="text-muted-foreground text-base mb-10">
          Query any Solana token. Or deploy your own MPP service and monetize your data on the same rails.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Oracle card */}
          <div className="card-surface border border-mpp-border rounded-lg p-8 text-center">
            <p className="font-mono text-mpp-amber text-xs uppercase mb-3">Intelligence Oracle</p>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Query any token</h3>
            <p className="text-muted-foreground text-sm mb-5">8-dimensional on-chain analysis. No account. Pay per query.</p>
            <Link to="/playground" className="block">
              <button className="btn-amber w-full py-2.5 rounded text-sm font-semibold">
                Open Playground
              </button>
            </Link>
          </div>

          {/* Builder card */}
          <div className="card-surface border border-mpp-border rounded-lg p-8 text-center">
            <p className="font-mono text-mpp-amber text-xs uppercase mb-3">Builder Platform</p>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Build your service</h3>
            <p className="text-muted-foreground text-sm mb-5">Deploy on MPP rails. Set your price. Direct payments to your wallet.</p>
            <Link to="/build" className="block">
              <button className="border border-mpp-border hover:border-mpp-amber/40 w-full py-2.5 rounded text-sm text-foreground transition-colors">
                Build Your Service
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
