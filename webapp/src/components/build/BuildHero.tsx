import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const stats = [
  { value: "0.008 pathUSD", label: "per query" },
  { value: "< 200ms", label: "settlement" },
  { value: "100% to you", label: "No custody" },
  { value: "Live instantly", label: "no approval" },
];

export function BuildHero() {
  return (
    <section className="relative border-b border-mpp-border pt-24 pb-20 overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(245,176,50,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Amber glow top-left */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-mpp-amber/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p
          className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-5 animate-fade-in-up"
        >
          For Builders
        </p>

        <h1
          className="font-display text-5xl md:text-6xl font-semibold text-foreground leading-tight max-w-3xl mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.05s", animationFillMode: "both" }}
        >
          Monetize Any Solana Tool. Instantly.
        </h1>

        <p
          className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-10 animate-fade-in-up"
          style={{ animationDelay: "0.1s", animationFillMode: "both" }}
        >
          You built the sniper bot. The wallet tracker. The liquidation alert.
          Now charge for it — per query, direct to your wallet, no middleman.
          We handle the payment rails.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-3 mb-16 animate-fade-in-up"
          style={{ animationDelay: "0.15s", animationFillMode: "both" }}
        >
          <a href="#submit">
            <button className="btn-amber flex items-center gap-2 text-sm px-6 py-2.5 rounded font-semibold w-full sm:w-auto justify-center">
              Connect Your API
              <ArrowRight className="w-4 h-4" />
            </button>
          </a>
          <Link
            to="/ecosystem"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-6 py-2.5"
          >
            View Ecosystem →
          </Link>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up"
          style={{ animationDelay: "0.2s", animationFillMode: "both" }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-mpp-card border border-mpp-border rounded-lg px-5 py-4"
            >
              <p className="font-mono text-foreground text-sm font-semibold mb-0.5">{stat.value}</p>
              <p className="text-muted-foreground text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
