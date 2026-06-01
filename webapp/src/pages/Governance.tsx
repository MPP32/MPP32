import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Shield, TrendingDown, Vote, Users } from "lucide-react";

interface Proposal {
  name: string;
  url: string;
  status: "passing" | "failing";
  funded: boolean;
  netYesPercent: number;
  yesVotes: number;
  noVotes: number;
  monthlyPaymentPiv: number;
  monthlyPaymentUsd: number;
  totalPaymentPiv: number;
  installmentsRemaining: number;
  totalInstallments: number;
  budgetPercent: number;
}

interface NetworkStats {
  masternodeCount: number;
  passingThreshold: number;
  monthlyBudgetPiv: number;
  monthlyBudgetUsd: number;
  budgetAllocatedPiv: number;
  budgetAllocatedUsd: number;
  budgetAllocatedPercent: number;
  blockHeight: number;
  totalSupply: number;
  circulatingSupply: number;
}

interface DeflationStats {
  unallocatedPivPerCycle: number;
  unallocatedPercent: number;
  annualUnallocatedPiv: number;
  proposalFeeBurnPiv: number;
  effectiveInflationReduction: string;
}

interface GovernanceData {
  proposals: Proposal[];
  network: NetworkStats;
  deflation: DeflationStats;
  meta: {
    source: string;
    timestamp: string;
    cacheHit: boolean;
    proposalCount: number;
    passingCount: number;
    failingCount: number;
  };
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-6 py-4 flex flex-col gap-1">
      <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className="font-mono text-mpp-amber font-semibold text-lg leading-none">{value}</span>
      {sub && <span className="font-mono text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function VoteBar({ yes, no, threshold }: { yes: number; no: number; threshold: number }) {
  const total = yes + no || 1;
  const yesPct = (yes / total) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="text-emerald-400">{yes} Yes</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-red-400">{no} No</span>
        <span className="text-muted-foreground ml-auto">{threshold} needed</span>
      </div>
      <div className="h-2 bg-mpp-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${yesPct}%`,
            background: yesPct > 50 ? "linear-gradient(90deg, #10b981, #34d399)" : "linear-gradient(90deg, #ef4444, #f87171)",
          }}
        />
      </div>
    </div>
  );
}

function ProposalCard({ proposal, threshold }: { proposal: Proposal; threshold: number }) {
  const isPassing = proposal.status === "passing";
  return (
    <div className="bg-mpp-surface border border-mpp-border rounded-lg p-5 hover:border-mpp-amber/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
              isPassing
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {isPassing ? "PASSING" : "FAILING"}
            {proposal.funded && " (Funded)"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {proposal.netYesPercent > 0 ? "+" : ""}{proposal.netYesPercent}% net
          </span>
        </div>
        {proposal.url && (
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-mpp-amber transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      <h3 className="font-display text-base font-semibold text-foreground mb-3">{proposal.name}</h3>

      <VoteBar yes={proposal.yesVotes} no={proposal.noVotes} threshold={threshold} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <span className="text-muted-foreground">Monthly: </span>
          <span className="text-foreground">{proposal.monthlyPaymentPiv.toLocaleString()} PIV</span>
        </div>
        <div>
          <span className="text-muted-foreground">~$</span>
          <span className="text-foreground">{proposal.monthlyPaymentUsd.toLocaleString()}</span>
        </div>
        {proposal.totalPaymentPiv > proposal.monthlyPaymentPiv && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Total: </span>
            <span className="text-foreground">{proposal.totalPaymentPiv.toLocaleString()} PIV</span>
            {proposal.installmentsRemaining > 0 && (
              <span className="text-muted-foreground"> ({proposal.installmentsRemaining} installments left)</span>
            )}
          </div>
        )}
        {proposal.budgetPercent > 0 && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Budget usage: </span>
            <span className="text-foreground">{proposal.budgetPercent}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-mpp-surface border border-mpp-border rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-mpp-surface border border-mpp-border rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function Governance() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["pivx-governance"],
    queryFn: () => api.get<GovernanceData>("/api/governance"),
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    staleTime: 4 * 60 * 1000,
  });

  const passingProposals = data?.proposals.filter((p) => p.status === "passing") ?? [];
  const failingProposals = data?.proposals.filter((p) => p.status === "failing") ?? [];

  return (
    <div className="bg-mpp-bg min-h-screen">
      {/* Hero — text left, partnership image right */}
      <section className="border-b border-mpp-border py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 blur-[140px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left: copy */}
            <div className="lg:col-span-5">
              <div className="flex items-center gap-3 mb-5">
                <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest animate-fade-in-up">
                  PIVX DAO Governance
                </p>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-fade-in-up"
                  style={{ animationDelay: "0.05s", animationFillMode: "both" }}
                >
                  LIVE
                </span>
              </div>

              <h1
                className="font-display text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-semibold text-foreground mb-5 leading-[1.08] animate-fade-in-up"
                style={{ animationDelay: "0.1s", animationFillMode: "both" }}
              >
                Autonomous DAO Tracker
              </h1>

              <p
                className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-8 animate-fade-in-up"
                style={{ animationDelay: "0.2s", animationFillMode: "both" }}
              >
                Real-time intelligence on PIVX's decentralized governance. Track active budget proposals,
                masternode voting tallies, treasury allocation, and network deflation metrics. Powered by
                MPP32's free governance oracle.
              </p>

              <div
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5 animate-fade-in-up"
                style={{ animationDelay: "0.3s", animationFillMode: "both" }}
              >
                <Link to="/docs">
                  <button className="btn-amber inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold">
                    API Documentation
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>

                <a
                  href="https://pivx.org/proposals"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold border border-mpp-border text-foreground hover:border-mpp-amber/30 transition-colors"
                >
                  PIVX Proposals
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div
                className="flex items-center gap-2 animate-fade-in-up"
                style={{ animationDelay: "0.35s", animationFillMode: "both" }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mpp-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-mpp-success" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  Free &middot; No API key required
                </span>
              </div>
            </div>

            {/* Right: partnership image */}
            <div
              className="lg:col-span-7 animate-fade-in"
              style={{ animationDelay: "0.2s", animationFillMode: "both" }}
            >
              <img
                src="/m32-x-pivx.png"
                alt="MPP32 x PIVX — Building the Future of Decentralized Payments"
                className="w-full rounded-xl border border-purple-500/20 shadow-2xl shadow-purple-900/10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      {data && (
        <div className="bg-mpp-surface border-b border-mpp-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-0 divide-x divide-mpp-border">
              <StatCard
                label="Masternodes"
                value={data.network.masternodeCount.toLocaleString()}
                sub={`${data.network.passingThreshold} votes to pass`}
              />
              <StatCard
                label="Monthly Budget"
                value={`${data.network.monthlyBudgetPiv.toLocaleString()} PIV`}
                sub={`~$${data.network.monthlyBudgetUsd.toLocaleString()}`}
              />
              <StatCard
                label="Budget Allocated"
                value={`${data.network.budgetAllocatedPercent}%`}
                sub={`${data.network.budgetAllocatedPiv.toLocaleString()} PIV`}
              />
              <StatCard
                label="Active Proposals"
                value={String(data.meta.proposalCount)}
                sub={`${data.meta.passingCount} passing, ${data.meta.failingCount} failing`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading && <LoadingSkeleton />}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
            <p className="text-red-400 font-mono text-sm mb-4">Failed to load governance data. The PIVX network source may be temporarily unavailable.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded text-sm font-semibold bg-mpp-amber text-black hover:bg-mpp-amber/90 transition-colors"
            >
              Retry
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-12">
            {/* Deflation Metrics */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <TrendingDown className="w-5 h-5 text-mpp-amber" />
                <h2 className="font-display text-2xl font-semibold text-foreground">Deflation & Fee Burn Metrics</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-mpp-surface border border-mpp-border rounded-lg p-5">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Unallocated This Cycle</p>
                  <p className="font-mono text-xl text-mpp-amber font-semibold">{data.deflation.unallocatedPivPerCycle.toLocaleString()} PIV</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">Never minted</p>
                </div>
                <div className="bg-mpp-surface border border-mpp-border rounded-lg p-5">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Annual Unallocated (est.)</p>
                  <p className="font-mono text-xl text-mpp-amber font-semibold">{data.deflation.annualUnallocatedPiv.toLocaleString()} PIV</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">~12 budget cycles/year</p>
                </div>
                <div className="bg-mpp-surface border border-mpp-border rounded-lg p-5">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Inflation Reduction</p>
                  <p className="font-mono text-xl text-mpp-amber font-semibold">{data.deflation.effectiveInflationReduction}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">Effective reduction from unspent treasury</p>
                </div>
                <div className="bg-mpp-surface border border-mpp-border rounded-lg p-5">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Proposal Fee</p>
                  <p className="font-mono text-xl text-mpp-amber font-semibold">{data.deflation.proposalFeeBurnPiv} PIV</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">Burned per submission</p>
                </div>
              </div>
            </section>

            {/* Passing Proposals */}
            {passingProposals.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Vote className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    Passing Proposals ({passingProposals.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {passingProposals.map((p) => (
                    <ProposalCard key={p.name} proposal={p} threshold={data.network.passingThreshold} />
                  ))}
                </div>
              </section>
            )}

            {/* Failing Proposals */}
            {failingProposals.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="w-5 h-5 text-red-400" />
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    Failing Proposals ({failingProposals.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {failingProposals.map((p) => (
                    <ProposalCard key={p.name} proposal={p} threshold={data.network.passingThreshold} />
                  ))}
                </div>
              </section>
            )}

            {data.proposals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground font-mono">No active proposals found in the current budget cycle.</p>
              </div>
            )}

            {/* How It Works */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-mpp-amber" />
                <h2 className="font-display text-2xl font-semibold text-foreground">How PIVX Governance Works</h2>
              </div>
              <div className="bg-mpp-surface border border-mpp-border rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground mb-2">1. Proposal Submission</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Anyone can submit a budget proposal by burning 50 PIV as an anti-spam fee. Proposals specify
                      a payment amount, number of monthly installments, and a PIVX address.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground mb-2">2. Masternode Voting</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Each Masternode (10,000 PIV collateral) gets one vote per proposal. A proposal passes when
                      net yes votes exceed 10% of active masternodes ({data.network.passingThreshold} votes currently).
                    </p>
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground mb-2">3. Superblock Payout</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Every ~30 days (43,200 blocks), passing proposals are funded in a superblock. Max budget is
                      432,000 PIV. Unspent funds are never minted, making PIVX effectively deflationary.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Source Attribution */}
            <div className="text-center">
              <p className="font-mono text-xs text-muted-foreground">
                Data sourced from {data.meta.source} &middot; Updated {new Date(data.meta.timestamp).toLocaleString()}
                {data.meta.cacheHit && " (cached)"} &middot; Refreshes every 5 minutes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
