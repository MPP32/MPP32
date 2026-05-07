import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

type SnapshotRow = { label: string; value: string; highlight: boolean };

type Snapshot = {
  rows: SnapshotRow[];
  responseTime: string;
};

const snapshots: Snapshot[] = [
  {
    rows: [
      { label: "Alpha Score", value: "91 / 100", highlight: true },
      { label: "Risk-Reward", value: "14.2 : 1", highlight: false },
      { label: "Rug Risk", value: "Medium (4/10)", highlight: false },
      { label: "Pump Prob.", value: "78%", highlight: false },
      { label: "Whale Activity", value: "Heavy", highlight: false },
      { label: "Smart Money", value: "↑ Strong Buy", highlight: false },
    ],
    responseTime: "1.24s",
  },
  {
    rows: [
      { label: "Alpha Score", value: "88 / 100", highlight: true },
      { label: "Risk-Reward", value: "12.7 : 1", highlight: false },
      { label: "Rug Risk", value: "Medium (4/10)", highlight: false },
      { label: "Pump Prob.", value: "74%", highlight: false },
      { label: "Whale Activity", value: "Elevated", highlight: false },
      { label: "Smart Money", value: "↑ Strong Buy", highlight: false },
    ],
    responseTime: "0.97s",
  },
  {
    rows: [
      { label: "Alpha Score", value: "93 / 100", highlight: true },
      { label: "Risk-Reward", value: "15.8 : 1", highlight: false },
      { label: "Rug Risk", value: "Low-Med (3/10)", highlight: false },
      { label: "Pump Prob.", value: "82%", highlight: false },
      { label: "Whale Activity", value: "Very Heavy", highlight: false },
      { label: "Smart Money", value: "↑↑ Accumulate", highlight: false },
    ],
    responseTime: "1.61s",
  },
  {
    rows: [
      { label: "Alpha Score", value: "90 / 100", highlight: true },
      { label: "Risk-Reward", value: "13.5 : 1", highlight: false },
      { label: "Rug Risk", value: "Medium (4/10)", highlight: false },
      { label: "Pump Prob.", value: "76%", highlight: false },
      { label: "Whale Activity", value: "Heavy", highlight: false },
      { label: "Smart Money", value: "↑ Strong Buy", highlight: false },
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

export function OraclePreviewCard() {
  const [snapshotIndex, setSnapshotIndex] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [minutesAgo, setMinutesAgo] = useState<string>("just now");

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

  useEffect(() => {
    setMinutesAgo(formatMinutesAgo(lastUpdated));
    const tick = setInterval(() => {
      setMinutesAgo(formatMinutesAgo(lastUpdated));
    }, 60000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const current = snapshots[snapshotIndex];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        {refreshing ? (
          <Loader2 className="w-3 h-3 text-mpp-amber animate-spin" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-mpp-success animate-pulse" />
        )}
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          MPP32 Oracle · Live Example
        </p>
      </div>

      <div
        className={`card-surface rounded border-l-2 border-l-mpp-amber p-5 flex-1 flex flex-col transition-opacity duration-500 ${
          refreshing ? "opacity-40" : "opacity-100"
        }`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-mpp-border">
          <div>
            <p className="text-foreground font-semibold text-sm">PUNCH / Solana</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              Token intelligence response
            </p>
          </div>
          <span className="font-mono text-[10px] text-mpp-success border border-mpp-success/30 px-1.5 py-0.5 rounded">
            verified
          </span>
        </div>

        <div className="divide-y divide-mpp-border/50 flex-1">
          {current.rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2">
              <span className="text-muted-foreground text-xs font-mono">{row.label}</span>
              <span
                className={`text-xs font-mono font-medium ${
                  row.highlight ? "text-mpp-amber" : "text-foreground"
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-3 border-t border-mpp-border">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
              Response time
            </span>
            <span className="font-mono text-xs text-mpp-success">{current.responseTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
              Last updated
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{minutesAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
