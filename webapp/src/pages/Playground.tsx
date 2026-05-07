import { useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, ArrowRight, TrendingUp, TrendingDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  priceUsd: string;
}

interface MarketData {
  priceChange24h: number;
  priceChange1h: number | null;
  priceChange7d: number | null;
  volume24h: number;
  liquidity: number;
  marketCap: number | null;
  fdv: number | null;
  pairAge: string;
  dexId: string;
  twitterFollowers?: number | null;
}

interface WhaleActivity {
  level: "low" | "moderate" | "high" | "extreme";
  recentBuys: number;
  recentSells: number;
  dominanceScore: number;
}

interface RugRisk {
  score: number;
  level: "minimal" | "low" | "moderate" | "elevated" | "high" | "critical";
  factors: string[];
}

interface ProjectedROI {
  low: string;
  high: string;
  timeframe: string;
}

interface IntelligenceResult {
  token: TokenInfo;
  alphaScore: number;
  riskRewardRatio: string;
  smartMoneySignals: string[];
  pumpProbability24h: number;
  projectedROI: ProjectedROI;
  whaleActivity: WhaleActivity;
  rugRisk: RugRisk;
  marketData: MarketData;
  summary: string;
  coingeckoEnriched?: boolean;
  timestamp: string;
  dataSource: string;
}

const LOADING_STEPS = [
  "Fetching on-chain data...",
  "Processing intelligence engine...",
  "Aggregating signals...",
  "Complete",
];

function ScoreBar({ value, max = 100, color = "amber" }: { value: number; max?: number; color?: "amber" | "success" | "danger" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor = color === "success" ? "bg-mpp-success" : color === "danger" ? "bg-mpp-danger" : "bg-mpp-amber";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-mpp-border rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-mpp-amber w-14 text-right">{value}/{max}</span>
    </div>
  );
}

function PctChange({ val }: { val: number | null | undefined }) {
  if (val == null) return <span className="font-mono text-foreground">—</span>;
  const pos = val >= 0;
  return (
    <span className={cn("font-mono flex items-center gap-0.5 text-sm", pos ? "text-mpp-success" : "text-mpp-danger")}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{val.toFixed(2)}%
    </span>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function rugColorClass(level: string): string {
  if (level === "minimal" || level === "low") return "text-mpp-success border-mpp-success/30";
  if (level === "moderate") return "text-mpp-amber border-mpp-amber/30";
  return "text-mpp-danger border-mpp-danger/30";
}

function whaleColorClass(level: string): string {
  if (level === "low") return "text-muted-foreground";
  if (level === "moderate") return "text-mpp-amber";
  return "text-mpp-danger";
}

function ResultCard({ result }: { result: IntelligenceResult }) {
  const [copied, setCopied] = useState(false);
  const { token, alphaScore, riskRewardRatio, smartMoneySignals, pumpProbability24h,
    projectedROI, whaleActivity, rugRisk, marketData, summary, coingeckoEnriched } = result;

  const price = parseFloat(token.priceUsd);
  const priceDisplay = price < 0.001 ? price.toFixed(8) : price < 1 ? price.toFixed(5) : price.toFixed(3);
  const rugBarColor = rugRisk.score <= 2 ? "success" : rugRisk.score <= 5 ? "amber" : "danger";

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="card-surface rounded overflow-hidden border border-mpp-border">
      {/* Token header */}
      <div className="px-5 py-4 border-b border-mpp-border flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-foreground font-semibold text-lg">{token.symbol}</span>
            <span className="text-muted-foreground text-sm">{token.name}</span>
            <span className="font-mono text-foreground">${priceDisplay}</span>
            <span className="text-muted-foreground text-xs">· Solana</span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground mt-1 break-all">{token.address}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={copyJson}
              className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy result as JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-mpp-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "copied" : "copy json"}
            </button>
            <div className="flex items-center gap-1.5 text-mpp-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">live data</span>
            </div>
          </div>
          {coingeckoEnriched ? (
            <span className="text-[10px] font-mono text-muted-foreground">CoinGecko enriched</span>
          ) : null}
        </div>
      </div>

      {/* Alpha score */}
      <div className="px-5 py-4 border-b border-mpp-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Alpha Score™</span>
          <span className="font-mono text-xs text-muted-foreground">composite signal 0–100</span>
        </div>
        <ScoreBar value={alphaScore} />
      </div>

      {/* Market data */}
      <div className="px-5 py-4 border-b border-mpp-border">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Market Data</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-sm">
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Vol 24h</span><span className="font-mono text-foreground">{fmt(marketData.volume24h)}</span></div>
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Liquidity</span><span className="font-mono text-foreground">{fmt(marketData.liquidity)}</span></div>
          {marketData.marketCap != null && (
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Market Cap</span><span className="font-mono text-foreground">{fmt(marketData.marketCap)}</span></div>
          )}
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">1h</span><PctChange val={marketData.priceChange1h} /></div>
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">24h</span><PctChange val={marketData.priceChange24h} /></div>
          {marketData.priceChange7d != null && (
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">7d</span><PctChange val={marketData.priceChange7d} /></div>
          )}
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Pair Age</span><span className="font-mono text-foreground">{marketData.pairAge}</span></div>
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">DEX</span><span className="font-mono text-foreground capitalize">{marketData.dexId}</span></div>
        </div>
      </div>

      {/* Rug risk */}
      <div className="px-5 py-4 border-b border-mpp-border">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Rug Risk</p>
        <div className="flex items-center gap-3 mb-3">
          <span className={cn("px-2 py-0.5 rounded border font-mono text-xs capitalize", rugColorClass(rugRisk.level))}>
            {rugRisk.level} ({rugRisk.score}/10)
          </span>
          <div className="flex-1"><ScoreBar value={rugRisk.score} max={10} color={rugBarColor as "amber" | "success" | "danger"} /></div>
        </div>
        <ul className="space-y-1">
          {rugRisk.factors.map((f) => (
            <li key={f} className="text-xs text-muted-foreground font-mono">· {f}</li>
          ))}
        </ul>
      </div>

      {/* Smart money */}
      <div className="px-5 py-4 border-b border-mpp-border">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Smart Money Signals</p>
        <ul className="space-y-1">
          {smartMoneySignals.map((s) => (
            <li key={s} className="text-xs text-muted-foreground font-mono">· {s}</li>
          ))}
        </ul>
      </div>

      {/* Whale activity */}
      <div className="px-5 py-4 border-b border-mpp-border">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Whale Activity</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground text-xs mb-0.5">Level</p><p className={cn("font-mono font-medium capitalize", whaleColorClass(whaleActivity.level))}>{whaleActivity.level}</p></div>
          <div><p className="text-muted-foreground text-xs mb-0.5">Buys (1h)</p><p className="font-mono text-mpp-success">{whaleActivity.recentBuys}</p></div>
          <div><p className="text-muted-foreground text-xs mb-0.5">Sells (1h)</p><p className="font-mono text-mpp-danger">{whaleActivity.recentSells}</p></div>
          <div><p className="text-muted-foreground text-xs mb-0.5">Buy Dominance</p><p className="font-mono text-foreground">{whaleActivity.dominanceScore}%</p></div>
        </div>
      </div>

      {/* Projections */}
      <div className="px-5 py-4 border-b border-mpp-border">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Projections ({projectedROI.timeframe})</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-sm">
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Pump Prob</span><span className="font-mono text-foreground">{pumpProbability24h}%</span></div>
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Risk-Reward</span><span className="font-mono text-foreground">{riskRewardRatio}</span></div>
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">ROI Range</span><span className="font-mono text-foreground">{projectedROI.low} → {projectedROI.high}</span></div>
        </div>
      </div>

      {/* Summary */}
      <div className="px-5 py-4">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Summary</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        <p className="font-mono text-[10px] text-muted-foreground mt-3">
          Source: DexScreener{coingeckoEnriched ? " + CoinGecko" : ""} · {new Date(result.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

export default function Playground() {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    const t = tokenInput.trim();
    if (!t || loading) return;
    setResult(null);
    setError(null);
    setLoading(true);
    setStepIndex(0);

    const stepTimer = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 2));
    }, 700);

    try {
      const base = import.meta.env.VITE_BACKEND_URL ?? "";
      const resp = await fetch(`${base}/api/intelligence/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });

      clearInterval(stepTimer);
      setStepIndex(LOADING_STEPS.length - 1);

      if (resp.ok) {
        const json = await resp.json();
        const data: IntelligenceResult = json.data;
        const existing: Array<IntelligenceResult & { queriedAt: string; inputToken: string }> =
          JSON.parse(localStorage.getItem("mpp32_queries") ?? "[]");
        existing.unshift({ ...data, queriedAt: new Date().toISOString(), inputToken: t });
        localStorage.setItem("mpp32_queries", JSON.stringify(existing.slice(0, 50)));
        setResult(data);
      } else if (resp.status === 429) {
        setError("Rate limit reached. Please wait a minute before trying again.");
      } else {
        const errJson = await resp.json().catch(() => null);
        const msg = errJson?.error?.message ?? "Token not found or upstream data unavailable.";
        setError(msg + " Try a well-known ticker (BONK, JUP) or paste a full Solana token address.");
      }
    } catch {
      clearInterval(stepTimer);
      setStepIndex(LOADING_STEPS.length - 1);
      setError("Unable to reach the API. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-mpp-bg">
      <div className="border-b border-mpp-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="font-display text-3xl font-semibold text-foreground mb-2">Live Query Terminal</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Submit any Solana token address or ticker to run a live intelligence analysis.
            This endpoint returns real on-chain data and is unmetered for evaluation.
            The production endpoint at{" "}
            <span className="font-mono text-foreground">/api/intelligence</span>{" "}
            is MPP-gated at $0.008 per query, payable via any of 5 supported protocols (Tempo, x402, AP2, ACP, AGTP).
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runAnalysis(); }}
            placeholder="Token address or ticker, e.g. BONK, JUP, WIF, or paste an address"
            disabled={loading}
            className="w-full bg-mpp-card border border-mpp-border rounded px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors font-mono text-sm disabled:opacity-50"
          />
          <button
            onClick={runAnalysis}
            disabled={!tokenInput.trim() || loading}
            className={cn(
              "mt-4 flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-all",
              tokenInput.trim() && !loading
                ? "btn-amber"
                : "bg-mpp-card border border-mpp-border text-muted-foreground cursor-not-allowed opacity-50"
            )}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</>
              : <>Analyze Token<ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>

        {loading && (
          <div className="card-surface rounded p-6 mb-6">
            <div className="space-y-3">
              {LOADING_STEPS.map((step, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0",
                      done ? "border-mpp-success bg-mpp-success/10" : active ? "border-mpp-amber" : "border-mpp-border"
                    )}>
                      {done
                        ? <CheckCircle2 className="w-3 h-3 text-mpp-success" />
                        : active
                        ? <Loader2 className="w-2.5 h-2.5 text-mpp-amber animate-spin" />
                        : null}
                    </div>
                    <span className={cn("text-sm font-mono", done ? "text-mpp-success" : active ? "text-foreground" : "text-muted-foreground")}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="card-surface rounded p-5 flex items-start gap-3 mb-6 border-mpp-danger/20">
            <AlertCircle className="w-5 h-5 text-mpp-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {result && !loading && <ResultCard result={result} />}

        {!loading && !result && !error && (
          <div className="card-surface rounded p-12 text-center">
            <p className="text-muted-foreground text-sm">Enter a token above to run your first analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
