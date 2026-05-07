import { Link } from "react-router-dom";

const sampleJson = `{
  "token": {
    "address": "NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump",
    "name": "Punch",
    "symbol": "PUNCH",
    "priceUsd": "0.00004817"
  },
  "alphaScore": 91,
  "riskRewardRatio": "14.2:1",
  "smartMoneySignals": [
    "Heavy wallet accumulation detected (last 2h)",
    "Buy/sell ratio above 2.4 threshold",
    "Volume spike 8.7x 7d average",
    "New wallet cohort entering, early accumulation pattern"
  ],
  "pumpProbability24h": 78,
  "projectedROI": { "low": "+28%", "high": "+140%", "timeframe": "24h" },
  "whaleActivity": {
    "level": "high",
    "recentBuys": 31,
    "recentSells": 7,
    "dominanceScore": 88
  },
  "rugRisk": {
    "score": 4,
    "level": "medium",
    "factors": [
      "Pair age < 30 days. Monitor closely.",
      "Liquidity depth growing but not deep",
      "No freeze authority detected",
      "Dev wallet inactive since launch"
    ]
  },
  "marketData": {
    "priceChange1h": 6.3,
    "priceChange24h": 41.2,
    "priceChange7d": 182.4,
    "volume24h": 2840000,
    "liquidity": 1200000,
    "marketCap": 48170000,
    "fdv": null,
    "pairAge": "18d",
    "dexId": "raydium"
  },
  "summary": "PUNCH is showing strong breakout momentum with aggressive smart money accumulation and an 8.7x volume surge versus baseline. High whale dominance on the buy side. Medium rug risk due to young pair age, so position sizing is recommended.",
  "jupiterPrice": 0.00004817,
  "priceConfidence": "high",
  "coingeckoEnriched": false,
  "timestamp": "2026-04-04T09:14:37.000Z",
  "dataSource": "DexScreener"
}`;

const dimensions = [
  { num: "01", name: "Alpha Score™", type: "number (0–100)", desc: "Composite proprietary score. Weighted combination of volume momentum (20%), buy/sell ratio (20%), price momentum (15%), liquidity depth (15%), smart money signals (20%), and pair age (10%)." },
  { num: "02", name: "Risk-Reward Ratio", type: "number", desc: "Ratio of estimated upside to downside, normalized against current liquidity depth. Higher values indicate more favorable risk-adjusted potential." },
  { num: "03", name: "Smart Money Signals", type: "string[]", desc: "Array of detected signal strings describing smart money wallet activity, e.g. large wallet accumulation, elevated buy/sell ratios, volume anomalies relative to the 7-day baseline." },
  { num: "04", name: "Pump Probability", type: "number (0–100, %)", desc: "24-hour probability estimate for a 20%+ price increase, adjusted for momentum, volume anomaly, and buy-side dominance. Returned as pumpProbability24h." },
  { num: "05", name: "Projected ROI Range", type: '{ low: string, high: string, timeframe: string }', desc: "Conservative and aggressive upside scenario estimates as percentage strings (e.g. \"+12%\", \"+54%\"). Based on historical patterns for tokens with similar profiles." },
  { num: "06", name: "Whale Activity", type: '{ level, recentBuys, recentSells, dominanceScore }', desc: "Object classifying large wallet behavior. level is one of: low, moderate, high, extreme. Includes raw buy/sell counts in the last hour and a dominanceScore (% of volume from buy side)." },
  { num: "07", name: "Rug Risk", type: '{ score: number, level: string, factors: string[] }', desc: "7-factor risk model returning a 0–10 score, a categorical level (minimal/low/moderate/elevated/high/critical), and a factors array listing the specific risk signals detected." },
  { num: "08", name: "Market Intelligence", type: "multiple fields", desc: "Price (Jupiter cross-validated), 1h and 24h price changes, 24h volume, liquidity depth, pair age, and DEX source. Data from DexScreener and Jupiter Price API." },
];

export default function Oracle() {
  return (
    <div className="min-h-screen bg-mpp-bg">
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">Intelligence Engine</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-4">
            The Intelligence Engine
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            How MPP32 transforms raw on-chain data into actionable signal.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        <section>
          <p className="text-muted-foreground text-base leading-relaxed mb-4">
            Every MPP32 intelligence report is generated in real time from two primary data sources:{" "}
            <strong className="text-foreground">DexScreener</strong> for DEX pair data (volume, liquidity, price history, pair age) and the{" "}
            <strong className="text-foreground">Jupiter Price API</strong> for cross-validated spot prices with confidence scoring. No data is cached beyond the API response latency window. Every query reflects the current state of the chain.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            On top of these raw feeds, the intelligence engine applies a scoring layer across eight dimensions. Each dimension is computed independently, then assembled into a single structured payload returned to the caller.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-6">The 8 Dimensions</h2>
          <div className="space-y-4">
            {dimensions.map((d) => (
              <div key={d.num} className="card-surface rounded p-5">
                <div className="flex items-start gap-4">
                  <span className="font-mono text-mpp-amber text-xs mt-0.5 flex-shrink-0">{d.num}</span>
                  <div>
                    <div className="flex items-center flex-wrap gap-3 mb-1">
                      <span className="text-foreground font-semibold text-sm">{d.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground border border-mpp-border px-2 py-0.5 rounded">{d.type}</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{d.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Sample API Response</h2>
          <p className="text-muted-foreground text-sm mb-4">
            All fields are returned under a <span className="font-mono text-foreground">data</span> envelope.
          </p>
          <div className="card-surface rounded p-5">
            <pre className="text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">
{`{ "data": ${sampleJson} }`}
            </pre>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Scoring Methodology</h2>
          <div className="space-y-6 text-muted-foreground text-sm leading-relaxed">
            <div>
              <p className="text-foreground font-semibold mb-2">Alpha Score</p>
              <p>Composite of six sub-signals, each normalized 0–100 before weighting:</p>
              <ul className="mt-2 space-y-1 font-mono text-xs ml-4">
                <li>· Volume momentum vs 7d average (20%)</li>
                <li>· Buy/sell transaction ratio, last 1h (20%)</li>
                <li>· Price momentum over 1h and 4h (15%)</li>
                <li>· Liquidity depth relative to market cap (15%)</li>
                <li>· Smart money wallet activity signal (20%)</li>
                <li>· Pair age stability factor (10%)</li>
              </ul>
            </div>
            <div>
              <p className="text-foreground font-semibold mb-2">Rug Risk</p>
              <p>7-factor rule-based model, each factor scored independently:</p>
              <ul className="mt-2 space-y-1 font-mono text-xs ml-4">
                <li>· Pair age (very new = higher risk)</li>
                <li>· Liquidity depth (thin pools = higher risk)</li>
                <li>· Social presence verification</li>
                <li>· Liquidity / market cap ratio</li>
                <li>· Sell pressure patterns in recent blocks</li>
                <li>· Developer wallet transaction history</li>
                <li>· Token contract flags (mint authority, freeze, etc.)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-4">Data Sources</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-2">DexScreener</p>
              <p className="text-muted-foreground text-sm">DEX pair data, including volume, liquidity, price history, pair age, and DEX context for all major Solana trading pairs.</p>
            </div>
            <div className="card-surface rounded p-5">
              <p className="text-foreground font-semibold text-sm mb-2">Jupiter Price API</p>
              <p className="text-muted-foreground text-sm">Cross-validated spot prices with confidence scoring. Verifies price data against multiple liquidity sources simultaneously.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-mpp-border pt-8">
          <p className="text-muted-foreground text-sm mb-4">Ready to integrate?</p>
          <Link to="/docs">
            <button className="btn-amber inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold">
              View API Reference
            </button>
          </Link>
        </section>
      </div>
    </div>
  );
}
