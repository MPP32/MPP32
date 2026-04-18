import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check } from "lucide-react";

const CA = "6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump";

const tokenTiers = [
  {
    label: "No tokens",
    rate: "0.008 pathUSD / query",
    note: "Standard rate",
    highlight: false,
  },
  {
    label: "Hold 250K+ MPP32",
    rate: "0.0064 pathUSD / query",
    note: "20% fee reduction",
    highlight: false,
  },
  {
    label: "Hold 1M+ MPP32",
    rate: "0.0048 pathUSD / query",
    note: "40% fee reduction + early access to new features",
    highlight: true,
  },
];

type PhaseStatus = "LIVE" | "IN PROGRESS" | "UPCOMING" | "PLANNED";

interface Phase {
  num: string;
  status: PhaseStatus;
  date: string;
  title: string;
  milestones: string[];
}

const phases: Phase[] = [
  {
    num: "01",
    status: "LIVE",
    date: "Now",
    title: "Core Infrastructure",
    milestones: [
      "Alpha Score™ engine — 6-signal composite scoring",
      "8-dimension intelligence payloads (Whale Activity, Rug Risk, Smart Money, etc.)",
      "DexScreener + Jupiter Price API integration",
      "Pay-per-query via pathUSD (Tempo protocol)",
      "Live playground endpoint for evaluation",
      "Builder SDK support (mppx, pympp)",
      "Provider management dashboard (live stats, settings, token recovery, deprecation)",
    ],
  },
  {
    num: "02",
    status: "IN PROGRESS",
    date: "Month 1–2 · targeting Q2 2026",
    title: "Token Utility & Developer Tools",
    milestones: [
      "Token-gated fee reduction (250K / 1M tiers)",
      "API key system for high-volume builders",
      "Telegram intelligence bot (query MPP32 from any chat)",
      "Expanded smart money wallet registry (top 500 Solana wallets tracked)",
      "WebSocket streaming endpoint (real-time push instead of polling)",
      "Discord integration + alert webhooks",
    ],
  },
  {
    num: "03",
    status: "UPCOMING",
    date: "Month 3–4 · targeting Q3 2026",
    title: "Staking, Portfolio & Expansion",
    milestones: [
      "Token staking → earn API credits (stake 1M MPP32 = 1,000 free queries/month)",
      "Portfolio mode: track up to 20 tokens in a single intelligence sweep",
      "Birdeye + Helius RPC as supplemental data sources",
      "Multi-chain: Base and Arbitrum token scoring",
      "Backtesting interface — test Alpha Score™ against historical data",
    ],
  },
  {
    num: "04",
    status: "PLANNED",
    date: "Month 5–6 · targeting Q4 2026",
    title: "Governance & Scale",
    milestones: [
      "DAO governance: token-weighted voting on scoring weight adjustments",
      "Protocol fee revenue distribution to stakers",
      "Stripe + Lightning Network payment options (alongside pathUSD)",
      "Enterprise SLA tier with dedicated infrastructure",
      "MPP32 mobile companion app (iOS + Android)",
      "Full TypeScript, Python, and Rust SDK releases",
    ],
  },
];

const statusBadge: Record<PhaseStatus, string> = {
  LIVE: "bg-mpp-success/10 text-mpp-success border border-mpp-success/20 font-mono text-xs px-2 py-0.5 rounded",
  "IN PROGRESS": "bg-mpp-amber/10 text-mpp-amber border border-mpp-amber/20 font-mono text-xs px-2 py-0.5 rounded",
  UPCOMING: "bg-mpp-border/40 text-muted-foreground border border-mpp-border font-mono text-xs px-2 py-0.5 rounded",
  PLANNED: "bg-mpp-border/20 text-muted-foreground/60 border border-mpp-border/40 font-mono text-xs px-2 py-0.5 rounded",
};

function MilestoneLine({ text, status }: { text: string; status: PhaseStatus }) {
  const isLive = status === "LIVE";
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={isLive ? "text-mpp-success mt-0.5 flex-shrink-0" : "text-mpp-amber mt-0.5 flex-shrink-0"}>
        {isLive ? "✓" : "·"}
      </span>
      <span className={isLive ? "text-foreground" : "text-muted-foreground"}>{text}</span>
    </li>
  );
}

export default function Roadmap() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(CA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-mpp-bg">
      {/* Hero */}
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Roadmap</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">
            What's being built.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            MPP32 is protocol infrastructure. This is where we are, and where we're going.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">

        {/* Token Utility card */}
        <section>
          <div className="card-surface rounded p-5 border-l-2 border-l-mpp-amber">
            <div className="flex items-start gap-4">
              <span className="text-mpp-amber text-base flex-shrink-0 mt-0.5">■</span>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-semibold text-sm mb-1">MPP32 Token — Protocol Utility</p>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  The MPP32 token is not speculative — it is the fee reduction and governance layer of the protocol.
                  Holding MPP32 reduces your per-query cost and grants early access to new features as the protocol expands.
                </p>

                {/* Tiers */}
                <div className="space-y-2 mb-5">
                  {tokenTiers.map((tier) => (
                    <div
                      key={tier.label}
                      className={`rounded p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 ${
                        tier.highlight
                          ? "bg-mpp-amber/5 border border-mpp-amber/20"
                          : "bg-mpp-bg border border-mpp-border"
                      }`}
                    >
                      <span className="text-foreground text-sm font-medium">{tier.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-mpp-amber text-sm">{tier.rate}</span>
                        <span className="text-muted-foreground text-xs">{tier.note}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CA */}
                <div className="mb-4">
                  <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-2">Contract Address</p>
                  <div className="flex items-center gap-2 bg-mpp-bg border border-mpp-border rounded px-3 py-2">
                    <code className="font-mono text-xs text-foreground break-all flex-1">{CA}</code>
                    <button
                      onClick={handleCopy}
                      className="flex-shrink-0 text-muted-foreground hover:text-mpp-amber transition-colors p-1 rounded"
                      aria-label="Copy contract address"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-mpp-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {copied && (
                    <p className="font-mono text-mpp-success text-xs mt-1">Copied!</p>
                  )}
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Token utility activates with the API key system rollout — see{" "}
                  <span className="font-mono text-mpp-amber">Phase 02</span> below (Month 1–2 milestone).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-8">Timeline</h2>
          <div className="space-y-6">
            {phases.map((phase) => (
              <div key={phase.num} className="card-surface rounded p-5">
                {/* Phase header */}
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <span className="font-mono text-mpp-amber text-xs uppercase tracking-widest">
                    Phase {phase.num}
                  </span>
                  <span className={statusBadge[phase.status]}>{phase.status}</span>
                </div>
                <p className="font-mono text-muted-foreground/60 text-xs mb-3">{phase.date}</p>
                <h3 className="text-foreground font-semibold text-base mb-4">{phase.title}</h3>

                {/* Milestones */}
                <ul className="space-y-2">
                  {phase.milestones.map((m) => (
                    <MilestoneLine key={m} text={m} status={phase.status} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-mpp-border pt-8 text-center">
          <p className="text-muted-foreground text-sm mb-4">Questions about the roadmap or token?</p>
          <Link to="/contact">
            <button className="btn-amber inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold">
              Get in Touch
            </button>
          </Link>
        </section>
      </div>
    </div>
  );
}
