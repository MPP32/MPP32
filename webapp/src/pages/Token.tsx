import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  GitCompare,
  Briefcase,
  Lock,
  Unlock,
  Search,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { api } from "../lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CA = "6hKtz8FV7cAQMrbjcBZeTQAcrYep3WCM83164JpJpump";
const RAYDIUM_URL = `https://raydium.io/swap/?inputMint=sol&outputMint=${CA}`;
const DEXSCREENER_URL =
  "https://dexscreener.com/solana/5hcopuqeoyairegeqvm9hdkgxyhwute8d1vhahvcltxs";
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/tokens/${CA}`;

const EXCLUSIVE_APIS = [
  {
    name: "Whale Tracker API",
    required: 1_000_000,
    icon: Activity,
    description:
      "Real-time large-wallet movement detection for any Solana token. Top 20 holder analysis, concentration risk scoring, buy/sell pressure tracking across time windows, volume spike detection, and whale accumulation signals.",
    features: [
      "Top 20 holder concentration analysis",
      "Buy/sell pressure across 5m, 1h, 6h, 24h windows",
      "Volume spike and anomaly detection",
      "Whale accumulation vs distribution signals",
      "0-100 composite whale score",
    ],
    endpoint: "POST /api/m32/whale-tracker",
    status: "LIVE" as const,
    glowIntensity: "shadow-[0_0_30px_-8px_rgba(212,132,10,0.12)]",
    borderClass: "border-mpp-amber/20",
  },
  {
    name: "Token Comparison API",
    required: 2_500_000,
    icon: GitCompare,
    description:
      "Head-to-head intelligence battle between any two Solana tokens. Compare alpha scores, rug risk, whale activity, volume, liquidity, and pump probability with a clear winner verdict.",
    features: [
      "Side-by-side alpha score comparison",
      "Rug risk face-off",
      "Volume and liquidity matchup",
      "Pump probability comparison",
      "Overall winner verdict with reasoning",
    ],
    endpoint: "POST /api/m32/compare",
    status: "LIVE" as const,
    glowIntensity: "shadow-[0_0_40px_-8px_rgba(212,132,10,0.18)]",
    borderClass: "border-mpp-amber/30",
  },
  {
    name: "Portfolio Scanner API",
    required: 5_000_000,
    icon: Briefcase,
    description:
      "Paste any Solana wallet. Get full intelligence on every token holding — risk analysis, alpha scores, estimated values, and portfolio-level health metrics.",
    features: [
      "Automatic SPL token detection",
      "Per-token intelligence analysis",
      "Portfolio risk aggregation",
      "Highest risk & best alpha identification",
      "Diversification scoring",
    ],
    endpoint: "POST /api/m32/portfolio",
    status: "LIVE" as const,
    glowIntensity: "shadow-[0_0_50px_-8px_rgba(212,132,10,0.25)]",
    borderClass: "border-mpp-amber/40",
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtTokens(n: number) {
  return n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-mpp-border/60 ${className}`}
    />
  );
}

function MetricCard({
  label,
  value,
  changePercent,
  loading,
  index,
}: {
  label: string;
  value: string;
  changePercent?: number | null;
  loading: boolean;
  index: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className="card-surface rounded-lg p-5 border border-mpp-border/50"
    >
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <div className="flex items-end gap-2">
          <span className="font-mono text-xl text-foreground">{value}</span>
          {changePercent != null && (
            <span
              className={`flex items-center gap-0.5 font-mono text-xs ${
                changePercent >= 0 ? "text-mpp-success" : "text-mpp-danger"
              }`}
            >
              {changePercent >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {changePercent >= 0 ? "+" : ""}
              {changePercent.toFixed(2)}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// DexScreener hook
// ---------------------------------------------------------------------------

interface DexPair {
  priceUsd: string;
  priceChange: { h24: number };
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  marketCap: number;
}

function useDexData() {
  return useQuery<DexPair>({
    queryKey: ["dexscreener-token"],
    queryFn: async () => {
      const res = await fetch(DEXSCREENER_API);
      if (!res.ok) throw new Error("DexScreener fetch failed");
      const data = await res.json();
      const pairs = data.pairs;
      if (!pairs || pairs.length === 0) throw new Error("No pairs found");
      return pairs.sort(
        (a: DexPair, b: DexPair) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0] as DexPair;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Access Check hook
// ---------------------------------------------------------------------------

interface WalletBalanceResponse {
  wallet: string;
  m32Balance: number;
  lookupFailed: boolean;
}

function useWalletBalance(wallet: string, enabled: boolean) {
  return useQuery<WalletBalanceResponse>({
    queryKey: ["wallet-balance", wallet],
    queryFn: async () => {
      const res = await api.get<WalletBalanceResponse>(
        `/api/agent/wallet-balance?wallet=${encodeURIComponent(wallet)}`
      );
      return res;
    },
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Token() {
  const [copied, setCopied] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [checkedWallet, setCheckedWallet] = useState("");
  const { data: dex, isLoading: dexLoading } = useDexData();
  const {
    data: walletData,
    isLoading: walletLoading,
    isError: walletError,
  } = useWalletBalance(checkedWallet, checkedWallet.length > 0);

  function handleCopy() {
    navigator.clipboard.writeText(CA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCheckAccess() {
    const trimmed = walletInput.trim();
    if (trimmed.length >= 32 && trimmed.length <= 44) {
      setCheckedWallet(trimmed);
    }
  }

  const balance = walletData?.m32Balance ?? 0;
  const showResults = checkedWallet.length > 0 && !walletLoading && !walletError && walletData;

  return (
    <div className="min-h-screen bg-mpp-bg">
      {/* ------------------------------------------------------------------ */}
      {/* HERO */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-mpp-border py-16 sm:py-20 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,132,10,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4"
          >
            M32 Token Utility
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl font-semibold text-foreground mb-4"
          >
            Exclusive APIs. Holders Only.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto mb-8"
          >
            Hold M32 to unlock premium intelligence APIs that non-holders can't
            access. Not discounts — entire products, gated by your M32 balance.
          </motion.p>

          {/* Contract address */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="inline-flex items-center gap-2 bg-mpp-card border border-mpp-border rounded-lg px-4 py-2.5 mb-8"
          >
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mr-1">
              CA
            </span>
            <code className="font-mono text-xs text-foreground break-all">
              {CA}
            </code>
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
          </motion.div>
          {copied && (
            <p className="font-mono text-mpp-success text-xs -mt-6 mb-6">
              Copied to clipboard
            </p>
          )}

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <a
              href={RAYDIUM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-amber inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold"
            >
              Buy on Raydium
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={DEXSCREENER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors"
            >
              View on DexScreener
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* LIVE TOKEN DATA */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
              Live Data
            </p>
            <h2 className="font-display text-3xl font-semibold text-foreground">
              Market Overview
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              Real-time data from DexScreener. Refreshes every 60 seconds.
            </p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
          >
            <MetricCard
              label="Price USD"
              value={dex ? `$${parseFloat(dex.priceUsd).toPrecision(4)}` : "--"}
              loading={dexLoading}
              index={0}
            />
            <MetricCard
              label="24h Change"
              value={
                dex
                  ? `${dex.priceChange.h24 >= 0 ? "+" : ""}${dex.priceChange.h24.toFixed(2)}%`
                  : "--"
              }
              changePercent={dex ? dex.priceChange.h24 : null}
              loading={dexLoading}
              index={1}
            />
            <MetricCard
              label="Market Cap"
              value={dex ? fmt(dex.marketCap) : "--"}
              loading={dexLoading}
              index={2}
            />
            <MetricCard
              label="24h Volume"
              value={dex ? fmt(dex.volume.h24) : "--"}
              loading={dexLoading}
              index={3}
            />
            <MetricCard
              label="Liquidity"
              value={dex ? fmt(dex.liquidity.usd) : "--"}
              loading={dexLoading}
              index={4}
            />
            <MetricCard
              label="FDV"
              value={dex ? fmt(dex.fdv) : "--"}
              loading={dexLoading}
              index={5}
            />
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3 EXCLUSIVE API CARDS */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
              Holder-Gated Products
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-3">
              3 APIs. M32 Holders Only.
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              Each API requires holding a minimum M32 balance. Non-holders
              receive a 403. No exceptions.
            </p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid gap-6"
          >
            {EXCLUSIVE_APIS.map((apiItem, i) => {
              const Icon = apiItem.icon;
              return (
                <motion.div
                  key={apiItem.name}
                  custom={i}
                  variants={fadeUp}
                  className={`relative rounded-lg border ${apiItem.borderClass} bg-gradient-to-b from-mpp-amber/[0.03] to-mpp-card ${apiItem.glowIntensity} overflow-hidden`}
                >
                  {/* Top accent line */}
                  <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-mpp-amber/40 to-transparent" />

                  <div className="p-6 sm:p-8">
                    {/* Header row */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-mpp-amber/10 border border-mpp-amber/20 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-mpp-amber" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-display text-xl font-semibold text-foreground">
                              {apiItem.name}
                            </h3>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-mpp-success/10 text-mpp-success border border-mpp-success/20">
                              {apiItem.status}
                            </span>
                          </div>
                          <p className="font-mono text-sm text-mpp-amber font-semibold">
                            {fmtTokens(apiItem.required)} M32 required
                          </p>
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <code className="font-mono text-xs text-muted-foreground bg-mpp-bg border border-mpp-border rounded px-3 py-1.5 inline-block">
                          {apiItem.endpoint}
                        </code>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      {apiItem.description}
                    </p>

                    {/* Features checklist */}
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                      {apiItem.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-start gap-2.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-mpp-amber mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-foreground">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* HOW IT WORKS */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
              Simple Access
            </p>
            <h2 className="font-display text-3xl font-semibold text-foreground mb-3">
              How M32 Gating Works
            </h2>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid sm:grid-cols-3 gap-6"
          >
            {[
              {
                step: "01",
                title: "Hold",
                desc: "Buy and hold M32 tokens in your Solana wallet. No staking, no locking — just hold.",
              },
              {
                step: "02",
                title: "Authenticate",
                desc: "Include your wallet address in the X-Wallet-Address header on API requests.",
              },
              {
                step: "03",
                title: "Access",
                desc: "Your M32 balance is checked on-chain in real-time. Meet the threshold, get access.",
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                custom={i}
                variants={fadeUp}
                className="card-surface rounded-lg p-6 border border-mpp-border/50 relative"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-mpp-amber/10 border border-mpp-amber/20 flex items-center justify-center">
                    <span className="font-mono text-sm text-mpp-amber font-semibold">
                      {s.step}
                    </span>
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {s.desc}
                </p>
                {i < 2 && (
                  <ArrowRight className="hidden sm:block absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mpp-border z-10" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* ACCESS CHECK */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-mpp-border py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
              <Search className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Eligibility
            </p>
            <h2 className="font-display text-3xl font-semibold text-foreground mb-3">
              Check Your Access
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Paste your Solana wallet address to see which exclusive APIs you
              qualify for.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="card-surface rounded-lg p-6 sm:p-8 border border-mpp-border/50"
          >
            {/* Input */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="text"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCheckAccess();
                }}
                placeholder="Enter your Solana wallet address..."
                className="flex-1 bg-mpp-bg border border-mpp-border rounded px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-mpp-amber/40 transition-colors"
              />
              <button
                onClick={handleCheckAccess}
                disabled={walletInput.trim().length < 32 || walletLoading}
                className="btn-amber inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {walletLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    Check Access
                    <Search className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Error state */}
            {walletError && checkedWallet && (
              <div className="rounded bg-mpp-danger/10 border border-mpp-danger/20 px-4 py-3 text-center">
                <p className="text-mpp-danger text-sm">
                  Failed to look up wallet balance. Please check the address and
                  try again.
                </p>
              </div>
            )}

            {/* Results */}
            {showResults && (
              <div className="space-y-4">
                {/* Balance display */}
                <div className="bg-mpp-bg border border-mpp-border rounded-lg p-4 text-center">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                    Your M32 Balance
                  </p>
                  <p className="font-mono text-2xl text-mpp-amber font-semibold">
                    {fmtTokens(balance)}
                  </p>
                </div>

                {/* API access results */}
                <div className="space-y-3">
                  {EXCLUSIVE_APIS.map((apiItem) => {
                    const hasAccess = balance >= apiItem.required;
                    const needed = apiItem.required - balance;
                    return (
                      <div
                        key={apiItem.name}
                        className={`rounded-lg border p-4 flex items-center gap-4 ${
                          hasAccess
                            ? "border-mpp-success/30 bg-mpp-success/[0.04]"
                            : "border-mpp-border bg-mpp-bg"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            hasAccess
                              ? "bg-mpp-success/10 border border-mpp-success/20"
                              : "bg-mpp-border/30 border border-mpp-border"
                          }`}
                        >
                          {hasAccess ? (
                            <Unlock className="w-4 h-4 text-mpp-success" />
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-display text-sm font-semibold text-foreground">
                              {apiItem.name}
                            </p>
                            {hasAccess && (
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-mpp-success/10 text-mpp-success border border-mpp-success/20">
                                UNLOCKED
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">
                            Requires {fmtTokens(apiItem.required)} M32
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {hasAccess ? (
                            <p className="font-mono text-xs text-mpp-success">
                              Access granted
                            </p>
                          ) : (
                            <p className="font-mono text-xs text-mpp-danger">
                              Need {fmtTokens(needed)} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM CTA */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(212,132,10,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Get M32. Get Access.
            </h2>
            <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto">
              Three exclusive APIs. Three balance thresholds. Hold the tokens,
              unlock the intelligence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={RAYDIUM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-amber inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold"
              >
                Buy M32 on Raydium
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <Link to="/agent-console">
                <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors">
                  Open Agent Console
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
