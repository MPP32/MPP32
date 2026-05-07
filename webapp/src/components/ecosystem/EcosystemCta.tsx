import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function EcosystemCta() {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
          Build
        </p>
        <h2 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4 leading-tight">
          Ready to build?
        </h2>
        <p className="text-muted-foreground text-base leading-relaxed max-w-xl mx-auto mb-8">
          Launch your MPP service and join the ecosystem. No gatekeeping, no approval delays for integration. Just submit and ship.
        </p>
        <Link to="/build">
          <button className="btn-amber inline-flex items-center gap-2 px-8 py-3 rounded text-sm font-semibold">
            Build Your MPP Service
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </section>
  );
}
