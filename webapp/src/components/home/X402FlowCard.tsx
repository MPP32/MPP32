import {
  Shield,
  Check,
  CircleDollarSign,
  Send,
  Gauge,
  Route,
  BarChart3,
  Wallet,
} from "lucide-react";

const pipelineSteps = [
  {
    icon: Send,
    label: "Agent Request",
    detail: "Endpoint discovery + price lookup",
    accent: "border-mpp-muted/40",
    iconColor: "text-mpp-muted",
  },
  {
    icon: Shield,
    label: "MPP32 Gateway",
    detail: "Auth · rate limits · schema validation",
    accent: "border-mpp-amber/60",
    iconColor: "text-mpp-amber",
  },
  {
    icon: CircleDollarSign,
    label: "Payment Gate",
    detail: "x402 (USDC/Solana) or Tempo (pathUSD)",
    accent: "border-mpp-amber/60",
    iconColor: "text-mpp-amber",
  },
  {
    icon: Route,
    label: "Proxy & Execute",
    detail: "Route to builder service endpoint",
    accent: "border-mpp-muted/40",
    iconColor: "text-mpp-muted",
  },
  {
    icon: Wallet,
    label: "Settle & Deliver",
    detail: "Response + revenue to builder wallet",
    accent: "border-mpp-success/60",
    iconColor: "text-mpp-success",
  },
];

const checksGrid = [
  { icon: Shield, label: "Payment\nVerification" },
  { icon: Gauge, label: "Rate\nLimiting" },
  { icon: BarChart3, label: "Usage\nAnalytics" },
  { icon: Check, label: "0% Platform\nFee" },
];

export function X402FlowCard() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-mpp-amber" />
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          MPP + x402 Hybrid · Payment Pipeline
        </p>
      </div>

      <div className="card-surface rounded border-l-2 border-l-mpp-amber p-5 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-mpp-border">
          <div>
            <p className="text-foreground font-semibold text-sm">
              How MPP32 Processes a Query
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              Full payment pipeline, either protocol
            </p>
          </div>
          <div className="flex gap-1.5">
            <span className="font-mono text-[9px] text-mpp-amber border border-mpp-amber/30 px-1.5 py-0.5 rounded">
              MPP
            </span>
            <span className="font-mono text-[9px] text-mpp-amber border border-mpp-amber/30 px-1.5 py-0.5 rounded">
              x402
            </span>
          </div>
        </div>

        {/* Pipeline Steps */}
        <div className="flex-1 space-y-0">
          {pipelineSteps.map((step, i) => (
            <div key={step.label}>
              <div className="flex items-start gap-3 py-2">
                <div
                  className={`w-6 h-6 rounded-md bg-mpp-surface border ${step.accent} flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  <step.icon className={`w-3 h-3 ${step.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-medium text-foreground leading-none">
                    {step.label}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    {step.detail}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-mpp-muted mt-0.5 flex-shrink-0 tabular-nums">
                  0{i + 1}
                </span>
              </div>
              {i < pipelineSteps.length - 1 ? (
                <div className="ml-3 h-2 border-l border-dashed border-mpp-border" />
              ) : null}
            </div>
          ))}
        </div>

        {/* What MPP32 Handles */}
        <div className="mt-auto pt-3 border-t border-mpp-border">
          <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2.5">
            Built-in at every step
          </p>
          <div className="grid grid-cols-4 gap-2">
            {checksGrid.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 text-center"
              >
                <div className="w-6 h-6 rounded-full bg-mpp-amber/10 border border-mpp-amber/20 flex items-center justify-center">
                  <item.icon className="w-3 h-3 text-mpp-amber" />
                </div>
                <span className="font-mono text-[8px] text-muted-foreground leading-tight whitespace-pre-line">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
