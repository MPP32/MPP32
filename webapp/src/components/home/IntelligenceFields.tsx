import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const fields = [
  {
    num: "01",
    name: "Alpha Score™",
    desc: "Proprietary composite score 0–100",
    example: "82 / 100",
  },
  {
    num: "02",
    name: "Risk-Reward Ratio",
    desc: "Upside vs downside relative to liquidity",
    example: "8.4:1",
  },
  {
    num: "03",
    name: "Smart Money Signals",
    desc: "Pattern detection across recent transactions",
    example: "↑ Accumulating",
  },
  {
    num: "04",
    name: "Pump Probability",
    desc: "24h momentum-adjusted probability estimate",
    example: "67%",
  },
  {
    num: "05",
    name: "Projected ROI Range",
    desc: "Conservative and aggressive scenarios",
    example: "+12% to +54%",
  },
  {
    num: "06",
    name: "Whale Activity",
    desc: "Large wallet concentration and directional bias",
    example: "Moderate",
  },
  {
    num: "07",
    name: "Rug Risk",
    desc: "7-factor risk model with factor breakdown",
    example: "Low (2/10)",
  },
  {
    num: "08",
    name: "Market Intelligence",
    desc: "Price, volume, liquidity, pair age, DEX context",
    example: "$124,000 vol",
  },
];

export function IntelligenceFields() {
  return (
    <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Oracle identity strip */}
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-mpp-border">
        <span className="font-mono text-xs text-mpp-amber bg-mpp-amber/10 border border-mpp-amber/20 rounded px-3 py-1 uppercase tracking-widest">MPP32 Oracle</span>
        <span className="text-muted-foreground text-xs">Built on MPP32's own infrastructure. Serving as proof of concept for the platform.</span>
      </div>

      <div className="mb-12">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
          Intelligence Fields
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-3">
          Eight dimensions of on-chain signal.
        </h2>
        <p className="text-muted-foreground text-base max-w-2xl">
          Every query to the MPP32 Oracle returns a structured report across 8 intelligence axes — the same architecture you can deploy for your own service.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {fields.map((field) => (
          <div
            key={field.num}
            className="card-surface rounded p-5 hover:border-mpp-amber/25 transition-colors"
          >
            <p className="font-mono text-mpp-amber text-xs mb-3">{field.num}</p>
            <p className="text-foreground font-semibold text-sm mb-1">{field.name}</p>
            <p className="text-muted-foreground text-xs leading-relaxed mb-4">{field.desc}</p>
            <p className="font-mono text-xs text-muted-foreground border-t border-mpp-border pt-3">
              e.g. <span className="text-foreground">{field.example}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 pt-8 border-t border-mpp-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Link to="/playground">
          <button className="btn-amber flex items-center gap-2 text-sm px-5 py-2 rounded">
            Try the Oracle
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
        <Link to="/use-cases" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
          See how it's used →
        </Link>
        <Link to="/build" className="text-muted-foreground hover:text-foreground transition-colors text-sm sm:ml-auto">
          Build something similar →
        </Link>
      </div>
    </section>
  );
}
