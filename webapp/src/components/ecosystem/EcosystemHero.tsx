import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function EcosystemHero() {
  return (
    <section className="border-b border-mpp-border py-20 lg:py-28 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-mpp-amber/5 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-5 animate-fade-in-up">
          Ecosystem
        </p>

        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold text-foreground mb-5 leading-tight max-w-3xl animate-fade-in-up" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
          Built with MPP32
        </h1>

        <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
          The growing directory of services using MPP32's payment infrastructure. Token scanners, price oracles, trading signals, and more — all powered by the Machine Payments Protocol.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
          <Link to="/build#submit">
            <button className="btn-amber inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold">
              Submit Your Project
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mpp-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-mpp-success" />
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Growing ecosystem of MPP-native services
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
