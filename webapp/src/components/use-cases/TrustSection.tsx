const pillars = [
  {
    number: "01",
    title: "Multi-Source Cross-Validation",
    description:
      "DexScreener, Jupiter, and CoinGecko are pulled simultaneously. If sources diverge beyond tolerance, the discrepancy surfaces rather than hides. You see the conflict — not a smoothed-over average.",
  },
  {
    number: "02",
    title: "Deterministic Scoring",
    description:
      "Same token, same moment, same score. Every time. No ML black box. The Alpha Score formula and 7-factor Rug Risk model are fully documented and verifiable — every component maps to a specific on-chain measurement.",
  },
  {
    number: "03",
    title: "Zero Subscription Bias",
    description:
      "Traditional analytics platforms need you to renew. MPP32 charges per query. No subscription to retain means zero incentive to skew results favorable. We make money when you query, not when you stay.",
  },
  {
    number: "04",
    title: "Raw On-Chain Facts",
    description:
      "Pair age is a timestamp. Liquidity is a USD value. Transaction counts are immutable blockchain records. The score is a deterministic function of verifiable facts — not sentiment, not community votes.",
  },
  {
    number: "05",
    title: "Timestamped to the Second",
    description:
      "Every response carries an ISO timestamp. You know exactly when data was pulled. No stale cache disguised as live data — if the timestamp is 30 minutes old, you know to requiry.",
  },
];

export function TrustSection() {
  return (
    <section className="py-20 border-b border-mpp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl mb-14">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            Data Integrity
          </p>
          <h2 className="font-display text-4xl lg:text-5xl font-semibold text-foreground leading-tight mb-4">
            Why trust our data
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Intelligence is only as useful as it is accurate. Here's exactly how MPP32 ensures the data you act on is the data that exists on-chain.
          </p>
        </div>

        {/* Pillar grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pillars.map((pillar) => (
            <div
              key={pillar.number}
              className="bg-mpp-card border border-mpp-border rounded-xl p-6 hover:border-mpp-border/80 transition-colors duration-200 group"
            >
              <div className="flex items-start gap-4">
                <span className="font-mono text-xs text-mpp-amber/50 mt-0.5 flex-shrink-0 group-hover:text-mpp-amber transition-colors duration-200">
                  {pillar.number}
                </span>
                <div className="space-y-2">
                  <h3 className="font-sans text-sm font-semibold text-foreground leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Final CTA card */}
          <div className="bg-mpp-surface border border-mpp-amber/20 rounded-xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-2">
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest">
                Verify it yourself
              </p>
              <p className="text-foreground text-sm leading-relaxed">
                Run any token through the Playground and compare what you see against DexScreener. The numbers will match — because that's where we got them.
              </p>
            </div>
            <a
              href="/playground"
              className="btn-amber inline-flex items-center justify-center text-sm px-4 py-2 rounded font-semibold"
            >
              Open Playground
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
