import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

type SnapshotRow = { label: string; value: string; highlight: boolean };

type Snapshot = {
  rows: SnapshotRow[];
  responseTime: string;
};

const snapshots: Snapshot[] = [
  {
    rows: [
      { label: "Alpha Score", value: "91/100", highlight: true },
      { label: "Risk-Reward", value: "14.2:1", highlight: false },
      { label: "Rug Risk", value: "Medium (4/10)", highlight: false },
      { label: "Pump Probability", value: "78%", highlight: false },
      { label: "Whale Activity", value: "Heavy", highlight: false },
      { label: "24h Volume", value: "$2,840,000", highlight: false },
      { label: "Smart Money", value: "↑ Strong Buy", highlight: false },
      { label: "Confidence", value: "High", highlight: false },
    ],
    responseTime: "1.24s",
  },
  {
    rows: [
      { label: "Alpha Score", value: "88/100", highlight: true },
      { label: "Risk-Reward", value: "12.7:1", highlight: false },
      { label: "Rug Risk", value: "Medium (4/10)", highlight: false },
      { label: "Pump Probability", value: "74%", highlight: false },
      { label: "Whale Activity", value: "Elevated", highlight: false },
      { label: "24h Volume", value: "$3,120,000", highlight: false },
      { label: "Smart Money", value: "↑ Strong Buy", highlight: false },
      { label: "Confidence", value: "High", highlight: false },
    ],
    responseTime: "0.97s",
  },
  {
    rows: [
      { label: "Alpha Score", value: "93/100", highlight: true },
      { label: "Risk-Reward", value: "15.8:1", highlight: false },
      { label: "Rug Risk", value: "Low-Med (3/10)", highlight: false },
      { label: "Pump Probability", value: "82%", highlight: false },
      { label: "Whale Activity", value: "Very Heavy", highlight: false },
      { label: "24h Volume", value: "$4,560,000", highlight: false },
      { label: "Smart Money", value: "↑↑ Accumulating", highlight: false },
      { label: "Confidence", value: "Very High", highlight: false },
    ],
    responseTime: "1.61s",
  },
  {
    rows: [
      { label: "Alpha Score", value: "86/100", highlight: true },
      { label: "Risk-Reward", value: "11.4:1", highlight: false },
      { label: "Rug Risk", value: "Medium (5/10)", highlight: false },
      { label: "Pump Probability", value: "71%", highlight: false },
      { label: "Whale Activity", value: "Moderate", highlight: false },
      { label: "24h Volume", value: "$2,190,000", highlight: false },
      { label: "Smart Money", value: "↑ Buy", highlight: false },
      { label: "Confidence", value: "High", highlight: false },
    ],
    responseTime: "1.88s",
  },
  {
    rows: [
      { label: "Alpha Score", value: "90/100", highlight: true },
      { label: "Risk-Reward", value: "13.5:1", highlight: false },
      { label: "Rug Risk", value: "Medium (4/10)", highlight: false },
      { label: "Pump Probability", value: "76%", highlight: false },
      { label: "Whale Activity", value: "Heavy", highlight: false },
      { label: "24h Volume", value: "$3,780,000", highlight: false },
      { label: "Smart Money", value: "↑ Strong Buy", highlight: false },
      { label: "Confidence", value: "High", highlight: false },
    ],
    responseTime: "1.12s",
  },
];

function formatMinutesAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff === 1) return "1 min ago";
  return `${diff} mins ago`;
}

export function HeroSection() {
  const [snapshotIndex, setSnapshotIndex] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [minutesAgo, setMinutesAgo] = useState<string>("just now");

  // Auto-refresh every 20 minutes
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      setRefreshing(true);
      setTimeout(() => {
        setSnapshotIndex((prev) => (prev + 1) % snapshots.length);
        setLastUpdated(new Date());
        setRefreshing(false);
      }, 1200);
    }, 1_200_000);

    return () => clearInterval(refreshInterval);
  }, []);

  // Update "X mins ago" label every minute
  useEffect(() => {
    setMinutesAgo(formatMinutesAgo(lastUpdated));
    const tick = setInterval(() => {
      setMinutesAgo(formatMinutesAgo(lastUpdated));
    }, 60000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const current = snapshots[snapshotIndex];

  return (
    <section className="min-h-screen flex items-center pt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-24">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          {/* Left: text (3/5 width) */}
          <div className="lg:col-span-3 animate-fade-in-up">
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-6">
              Machine Payments Protocol Platform
            </p>
            <h1 className="font-display text-5xl lg:text-7xl leading-[1.05] font-semibold text-foreground mb-6">
              Build On-Chain<br />Services. Get Paid<br className="hidden lg:block" /> Per Query.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mb-8">
              MPP32 runs its own Solana token intelligence oracle on this exact infrastructure — 8-dimensional on-chain analysis, 0.008&nbsp;pathUSD per query, under 2 seconds. We proved it works. Now build yours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link to="/build">
                <button className="btn-amber flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold w-full sm:w-auto justify-center">
                  Build with MPP
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/playground">
                <button className="border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm w-full sm:w-auto justify-center">
                  Try MPP32 Oracle
                </button>
              </Link>
            </div>
            <p className="font-mono text-muted-foreground text-xs">
              MPP32 Oracle: POST /api/intelligence · 0.008 pathUSD · &lt; 2s
            </p>
          </div>

          {/* Right: sample output card (2/5 width) */}
          <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
            {/* Label above card */}
            <div className="flex items-center gap-2 mb-3">
              {refreshing ? (
                <Loader2 className="w-3 h-3 text-mpp-amber animate-spin" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-mpp-success animate-pulse" />
              )}
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">MPP32 Oracle · Live Example</p>
            </div>
            <div className={`card-surface rounded border-l-2 border-l-mpp-amber p-5 transition-opacity duration-500 ${refreshing ? "opacity-40" : "opacity-100"}`}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-mpp-border">
                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Sample Response</p>
                  <p className="text-foreground font-semibold text-sm">PUNCH / Solana</p>
                </div>
                <span className="font-mono text-xs text-mpp-success border border-mpp-success/30 px-2 py-0.5 rounded">
                  verified
                </span>
              </div>
              <div className="divide-y divide-mpp-border/50">
                {current.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-muted-foreground text-xs font-mono">{row.label}</span>
                    <span className={`text-xs font-mono font-medium ${row.highlight ? "text-mpp-amber" : "text-foreground"}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-mpp-border flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Response time</span>
                <span className="font-mono text-xs text-mpp-success">{current.responseTime}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Last updated</span>
                <span className="font-mono text-[10px] text-muted-foreground">{minutesAgo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
