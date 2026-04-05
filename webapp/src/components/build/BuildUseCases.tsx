import { useEffect, useRef, useState } from "react";

const useCases = [
  {
    id: "sniper",
    tag: "SNIPER_BOT",
    title: "Sniper Bots",
    price: "0.005",
    unit: "/ trigger",
    description: "Entry signal for token launches, new pools, and mints. Fires before the crowd.",
    payload: `{
  "signal": "BUY",
  "mint": "7xKXtg2CW87...",
  "confidence": 0.94,
  "latency_ms": 47
}`,
    featured: true,
    horizontal: false,
  },
  {
    id: "wallet",
    tag: "WALLET_TRACK",
    title: "Wallet Trackers",
    price: "0.002",
    unit: "/ query",
    description: "Follow whale movements and smart money across Solana in real time.",
    payload: `{
  "wallet": "DRpb...kLm",
  "net_flow_24h": "+$2.1M",
  "top_hold": "WIF"
}`,
    featured: false,
    horizontal: false,
  },
  {
    id: "liq",
    tag: "LIQUIDATION",
    title: "Liquidation Alerts",
    price: "0.003",
    unit: "/ query",
    description: "DeFi position health across Drift, Mango, Marginfi. Catch it before it cascades.",
    payload: `{
  "protocol": "drift",
  "health": 0.08,
  "at_risk": "$340K"
}`,
    featured: false,
    horizontal: false,
  },
  {
    id: "copy",
    tag: "COPY_TRADE",
    title: "Copy Trade Signals",
    price: "0.010",
    unit: "/ signal",
    description: "Execution-ready payloads mirroring the top 0.1% of traders. Every position. Instant.",
    payload: `{
  "action": "OPEN_LONG",
  "token": "JUP",
  "size_usd": 5000,
  "entry": 0.782,
  "tp": 0.91
}`,
    featured: true,
    horizontal: false,
  },
  {
    id: "oracle",
    tag: "PRICE_ORACLE",
    title: "Price Oracles",
    price: "0.001",
    unit: "/ query",
    description: "On-chain and CEX price feeds with sub-second latency.",
    payload: `{
  "token": "SOL",
  "price": 142.37,
  "source": "pyth"
}`,
    featured: false,
    horizontal: false,
  },
  {
    id: "onchain",
    tag: "ON_CHAIN_DATA",
    title: "On-Chain Data Feeds",
    price: "0.004",
    unit: "/ query",
    description: "Token metadata, holder counts, LP depth, top traders, volume velocity — raw chain intelligence.",
    payload: `{
  "mint": "BONK",
  "holders": 842304,
  "lp_depth_usd": "$18.4M",
  "vol_1h": "$3.2M"
}`,
    featured: false,
    horizontal: true,
  },
];

function LiveDot() {
  return (
    <span className="relative inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="font-mono text-[10px] text-emerald-400 tracking-widest">LIVE</span>
    </span>
  );
}

function PayloadBlock({ code }: { code: string }) {
  return (
    <div className="mt-auto pt-4">
      <div className="rounded border border-mpp-border bg-mpp-bg/60 px-3 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground/70 whitespace-pre overflow-hidden">
        {code}
      </div>
    </div>
  );
}

function AnimatedCard({
  children,
  delay,
  className,
}: {
  children: React.ReactNode;
  delay: number;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "-40px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function BuildUseCases() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
              Use Cases
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground leading-tight">
              What Can You Monetize?
            </h2>
          </div>
          <p className="text-muted-foreground text-sm font-mono md:pb-1.5 tracking-wide">
            if it runs — it can earn.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-mpp-border border border-mpp-border rounded-xl overflow-hidden">
          {useCases.map((uc, i) => (
            <AnimatedCard
              key={uc.id}
              delay={i * 70}
              className={[
                "group relative bg-mpp-card p-6 flex flex-col gap-3 transition-colors duration-300",
                "hover:bg-mpp-amber/[0.025]",
                uc.featured ? "lg:col-span-2" : "",
                uc.horizontal ? "sm:col-span-2 lg:col-span-3" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.12)" }}
              />

              <div
                className={[
                  "flex gap-3 items-start",
                  uc.horizontal
                    ? "flex-row flex-wrap items-center"
                    : "flex-col sm:flex-row sm:items-center sm:justify-between",
                ].join(" ")}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LiveDot />
                  <span className="font-mono text-[10px] text-muted-foreground/50 tracking-widest truncate">
                    {uc.tag}
                  </span>
                </div>
                <div className="flex items-baseline gap-0.5 shrink-0">
                  <span className="font-mono text-xl font-semibold text-mpp-amber tabular-nums">
                    {uc.price}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground/60 ml-0.5">
                    pathUSD{uc.unit}
                  </span>
                </div>
              </div>

              <div className="h-px bg-mpp-border" />

              <div
                className={
                  uc.horizontal
                    ? "flex flex-col lg:flex-row lg:items-end gap-4 flex-1"
                    : "flex flex-col flex-1"
                }
              >
                <div className="flex-1">
                  <h3 className="font-display text-base font-semibold text-foreground mb-1.5">
                    {uc.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {uc.description}
                  </p>
                </div>
                <div className={uc.horizontal ? "lg:min-w-[280px] lg:max-w-[320px]" : ""}>
                  <PayloadBlock code={uc.payload} />
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>

        <p className="mt-6 text-center font-mono text-xs text-muted-foreground/40 tracking-widest uppercase">
          These are examples — any HTTP endpoint is monetizable
        </p>
      </div>
    </section>
  );
}
