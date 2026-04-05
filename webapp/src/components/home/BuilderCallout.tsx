import { Link } from "react-router-dom";

export function BuilderCallout() {
  return (
    <section className="border-y border-mpp-border bg-mpp-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">

        {/* Header row with proof badge */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
              Builder Platform
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Build your own MPP service.
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              Any data service with an HTTP endpoint can be monetized through MPP. Token scanners, price oracles, sentiment feeds, trading signals — deploy on MPP rails, set your price, get paid directly to your wallet.
            </p>
          </div>
          {/* "Proven by us" badge */}
          <div className="shrink-0 card-surface border border-mpp-amber/20 rounded-lg px-5 py-4 bg-mpp-amber/5 max-w-[240px]">
            <p className="font-mono text-mpp-amber text-[10px] uppercase tracking-widest mb-1">Proven by MPP32</p>
            <p className="text-foreground text-sm font-semibold mb-1">We built our Oracle on this.</p>
            <p className="text-muted-foreground text-xs leading-relaxed">The same infrastructure powers MPP32's own intelligence API.</p>
          </div>
        </div>

        {/* 3-col feature cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card-surface border border-mpp-border rounded-lg p-6">
            <p className="font-mono text-mpp-amber text-xs mb-4">01</p>
            <p className="text-foreground font-semibold text-sm mb-2">Your price, your revenue</p>
            <p className="text-muted-foreground text-sm leading-relaxed">Set any price in pathUSD. All payments route directly to your wallet — zero platform cut, no delays.</p>
          </div>
          <div className="card-surface border border-mpp-border rounded-lg p-6">
            <p className="font-mono text-mpp-amber text-xs mb-4">02</p>
            <p className="text-foreground font-semibold text-sm mb-2">Instant global listing</p>
            <p className="text-muted-foreground text-sm leading-relaxed">Submit your service and go live immediately in the Built with MPP32 ecosystem. Discoverable by traders, bots, and AI agents worldwide.</p>
          </div>
          <div className="card-surface border border-mpp-border rounded-lg p-6">
            <p className="font-mono text-mpp-amber text-xs mb-4">03</p>
            <p className="text-foreground font-semibold text-sm mb-2">One SDK, any stack</p>
            <p className="text-muted-foreground text-sm leading-relaxed">The mppx SDK works with any JS or Python framework. Add MPP payments to any HTTP endpoint in under 10 lines of code.</p>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Link to="/build">
            <button className="btn-amber px-6 py-2.5 rounded text-sm font-semibold">
              Start Building
            </button>
          </Link>
          <Link to="/ecosystem" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            Browse ecosystem →
          </Link>
        </div>
      </div>
    </section>
  );
}
