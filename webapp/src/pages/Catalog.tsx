import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search,
  Sparkles,
  Filter,
  ExternalLink,
  Globe,
  Database,
  Cpu,
  Wallet,
  CheckCircle2,
  ArrowRight,
  Layers,
  Tag,
  Clock,
  Copy,
  Check,
} from "lucide-react";

interface CatalogService {
  id: string;
  slug: string;
  source: string;
  name: string;
  description: string | null;
  category: string | null;
  endpointUrl: string | null;
  websiteUrl: string | null;
  protocol: string;
  protocols: string[];
  network: string | null;
  chain: string;
  chainLabel: string;
  testnet: boolean;
  asset: string | null;
  basePrice: number | null;
  effectivePrice: number | null;
  priceCurrency: string;
  tags: string[];
  popularity: number;
  verified: boolean;
  healthStatus: "unknown" | "reachable" | "challenge_valid" | "payment_verified" | "broken";
  healthCheckedAt: string | null;
  healthError: string | null;
}

interface CatalogResponse {
  services: CatalogService[];
  total: number;
  limit: number;
  offset: number;
  filters: { protocol?: string; category?: string; source?: string; network?: string; chain?: string; q?: string };
  discountPercent: number;
}

interface CatalogStats {
  total: number;
  byProtocol: { protocol: string; count: number }[];
  byCategory: { category: string; count: number }[];
  bySource: { source: string; count: number }[];
  byChain: { chain: string; label: string; testnet: boolean; count: number }[];
  byHealth: { status: string; count: number }[];
  recentCrawls: {
    id: string;
    source: string;
    status: string;
    itemsFound: number;
    itemsAdded: number;
    itemsUpdated: number;
    durationMs: number;
    startedAt: string;
    finishedAt: string | null;
  }[];
}

function formatLastCrawl(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatPrice(s: CatalogService): string {
  const p = s.effectivePrice ?? s.basePrice;
  if (p === null || p === undefined) return "Free";
  if (p === 0) return "Free";
  if (p < 0.001) return `$${p.toFixed(6)}`;
  if (p < 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(2)}`;
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const styles: Record<string, string> = {
    x402: "border-blue-400/30 text-blue-400 bg-blue-400/5",
    tempo: "border-mpp-amber/30 text-mpp-amber bg-mpp-amber/5",
    acp: "border-purple-400/30 text-purple-400 bg-purple-400/5",
    ap2: "border-pink-400/30 text-pink-400 bg-pink-400/5",
    agtp: "border-emerald-400/30 text-emerald-400 bg-emerald-400/5",
    mcp: "border-cyan-400/30 text-cyan-400 bg-cyan-400/5",
    http: "border-mpp-border text-muted-foreground bg-white/5",
  };
  const cls = styles[protocol] ?? styles.http;
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {protocol}
    </span>
  );
}

function HealthBadge({ status, error }: { status: string; error: string | null }) {
  const config: Record<string, { label: string; cls: string; title: string }> = {
    payment_verified: {
      label: "Pmt-Verified",
      cls: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
      title: "Confirmed: at least one payment has settled on-chain via MPP32",
    },
    challenge_valid: {
      label: "Verified",
      cls: "border-green-400/40 text-green-300 bg-green-400/10",
      title: "Confirmed: provider returns a valid x402 payment challenge",
    },
    reachable: {
      label: "Reachable",
      cls: "border-mpp-amber/30 text-mpp-amber bg-mpp-amber/5",
      title: "Endpoint responds but no payment gate observed (likely free or auth-walled)",
    },
    broken: {
      label: "Broken",
      cls: "border-red-400/40 text-red-300 bg-red-400/10",
      title: error ?? "Health check failed",
    },
    unknown: {
      label: "Unchecked",
      cls: "border-mpp-border text-muted-foreground bg-white/5",
      title: "Health not yet verified",
    },
  };
  const cfg = config[status] ?? config.unknown;
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.cls}`}
      title={cfg.title}
    >
      {cfg.label}
    </span>
  );
}

function NetworkBadge({ chain, label, testnet }: { chain: string; label: string; testnet: boolean }) {
  if (chain === "unknown") return null;
  const styles: Record<string, string> = {
    solana: "border-violet-400/40 text-violet-300 bg-violet-400/5",
    base: "border-sky-400/30 text-sky-300 bg-sky-400/5",
    ethereum: "border-indigo-400/30 text-indigo-300 bg-indigo-400/5",
    optimism: "border-red-400/30 text-red-300 bg-red-400/5",
    polygon: "border-purple-400/30 text-purple-300 bg-purple-400/5",
    arbitrum: "border-blue-400/30 text-blue-300 bg-blue-400/5",
    stellar: "border-yellow-400/30 text-yellow-300 bg-yellow-400/5",
  };
  const root = chain.replace(/-(sepolia|testnet|devnet)$/, "");
  const cls = styles[root] ?? "border-mpp-border text-muted-foreground bg-white/5";
  return (
    <span
      className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}
      title={testnet ? `${label} (testnet)` : label}
    >
      {label}
      {testnet && <span className="ml-1 opacity-60">·test</span>}
    </span>
  );
}

function CategoryIcon({ category }: { category: string | null }) {
  switch (category) {
    case "ai-inference":
      return <Cpu className="w-3.5 h-3.5 text-mpp-amber" />;
    case "crypto":
      return <Wallet className="w-3.5 h-3.5 text-mpp-amber" />;
    case "web-search":
      return <Globe className="w-3.5 h-3.5 text-mpp-amber" />;
    case "mcp-tool":
      return <Layers className="w-3.5 h-3.5 text-mpp-amber" />;
    case "media":
      return <Sparkles className="w-3.5 h-3.5 text-mpp-amber" />;
    default:
      return <Database className="w-3.5 h-3.5 text-mpp-amber" />;
  }
}

export default function Catalog() {
  const [q, setQ] = useState("");
  const [protocol, setProtocol] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [chain, setChain] = useState<string>("");
  // Default to "working" — only verified-reachable or challenge-valid services.
  const [offset, setOffset] = useState(0);
  const PAGE = 50;

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (protocol) p.set("protocol", protocol);
    if (category) p.set("category", category);
    if (source) p.set("source", source);
    if (chain) p.set("chain", chain);
    p.set("limit", String(PAGE));
    p.set("offset", String(offset));
    return p.toString();
  }, [q, protocol, category, source, chain, offset]);

  const { data: stats } = useQuery<CatalogStats>({
    queryKey: ["catalog", "stats"],
    queryFn: async () => {
      const r = await api.get<CatalogStats>("/api/catalog/stats");
      return r;
    },
    staleTime: 60_000,
  });

  const { data, isLoading, isError } = useQuery<CatalogResponse>({
    queryKey: ["catalog", "list", params],
    queryFn: async () => {
      const r = await api.get<CatalogResponse>(`/api/catalog?${params}`);
      return r;
    },
    placeholderData: (prev) => prev,
  });

  const total = data?.total ?? 0;
  const services = data?.services ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  const currentPage = Math.floor(offset / PAGE) + 1;

  const resetFilters = () => {
    setQ("");
    setProtocol("");
    setCategory("");
    setSource("");
    setChain("");
    setOffset(0);
  };

  return (
    <div className="bg-mpp-bg min-h-screen pb-24">
      {/* Hero */}
      <div className="border-b border-mpp-border bg-gradient-to-b from-mpp-amber/5 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            Universal Service Catalog
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4">
            {stats ? `${stats.total.toLocaleString()}` : "—"} services your agent can call
            <span className="block text-mpp-amber">in one integration.</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl mb-6 leading-relaxed">
            Federated index of every machine-payable API and MCP server we've crawled.
            Paid services settle through the caller's own wallet — MPP32 forwards 402 challenges
            and verifies on-chain receipts, never holding custody.
            Sources: x402 Bazaar, MCP Registry, hand-curated.
          </p>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-3xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={stats ? `Search ${stats.total.toLocaleString()} services — try 'token', 'search', 'image', 'github'…` : "Search services…"}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
                className="w-full bg-mpp-surface border border-mpp-border rounded pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-mpp-amber/50"
              />
            </div>
            <Link to="/agent-console">
              <button className="btn-amber flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold whitespace-nowrap w-full sm:w-auto justify-center">
                Launch an Agent
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {/* Stat strip */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-8">
              <StatTile label="Total Services" value={stats.total.toLocaleString()} icon={<Database className="w-4 h-4" />} />
              <StatTile label="x402 Resources" value={(stats.byProtocol.find(p => p.protocol === 'x402')?.count ?? 0).toLocaleString()} icon={<Globe className="w-4 h-4" />} />
              <StatTile
                label="On Solana"
                value={(stats.byChain.find(c => c.chain === 'solana')?.count ?? 0).toLocaleString()}
                icon={<Wallet className="w-4 h-4" />}
                onClick={() => { setChain('solana'); setOffset(0); }}
                active={chain === 'solana'}
              />
              <StatTile label="MCP Tools" value={(stats.byProtocol.find(p => p.protocol === 'mcp')?.count ?? 0).toLocaleString()} icon={<Layers className="w-4 h-4" />} />
              <StatTile label="Last Crawled" value={formatLastCrawl(stats.recentCrawls[0]?.finishedAt ?? stats.recentCrawls[0]?.startedAt ?? null)} icon={<Clock className="w-4 h-4" />} />
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-mpp-border bg-mpp-surface/30 sticky top-14 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </div>

            <FilterSelect
              label="Network"
              value={chain}
              onChange={(v) => { setChain(v); setOffset(0); }}
              options={[
                { value: "", label: "All networks" },
                ...(stats?.byChain
                  .filter((c) => c.chain !== "unknown")
                  .map((c) => ({
                    value: c.chain,
                    label: `${c.label} (${c.count.toLocaleString()})`,
                  })) ?? []),
              ]}
            />

            <FilterSelect
              label="Protocol"
              value={protocol}
              onChange={(v) => { setProtocol(v); setOffset(0); }}
              options={[
                { value: "", label: "All protocols" },
                ...(stats?.byProtocol.map((p) => ({
                  value: p.protocol,
                  label: `${p.protocol.toUpperCase()} (${p.count.toLocaleString()})`,
                })) ?? []),
              ]}
            />

            <FilterSelect
              label="Category"
              value={category}
              onChange={(v) => { setCategory(v); setOffset(0); }}
              options={[
                { value: "", label: "All categories" },
                ...(stats?.byCategory.map((c) => ({
                  value: c.category,
                  label: `${c.category} (${c.count.toLocaleString()})`,
                })) ?? []),
              ]}
            />

            <FilterSelect
              label="Source"
              value={source}
              onChange={(v) => { setSource(v); setOffset(0); }}
              options={[
                { value: "", label: "All sources" },
                ...(stats?.bySource.map((s) => ({
                  value: s.source,
                  label: `${s.source} (${s.count.toLocaleString()})`,
                })) ?? []),
              ]}
            />

            {(q || protocol || category || source || chain) && (
              <button
                onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Clear
              </button>
            )}

            <div className="ml-auto text-xs font-mono text-muted-foreground">
              {isLoading ? "…" : `${total.toLocaleString()} results`}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isError ? (
          <div className="border border-red-500/30 bg-red-500/5 rounded p-6 text-center">
            <p className="text-red-400 text-sm">Failed to load catalog. Try again.</p>
          </div>
        ) : services.length === 0 && !isLoading ? (
          <div className="border border-mpp-border rounded p-10 text-center">
            <p className="text-muted-foreground text-sm">
              No services match your filters. <button onClick={resetFilters} className="text-mpp-amber hover:underline">Clear filters</button>
            </p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE))}
                  className="px-3 py-1.5 text-xs border border-mpp-border rounded hover:border-mpp-amber/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-xs font-mono text-muted-foreground">
                  Page {currentPage} of {totalPages.toLocaleString()}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setOffset(offset + PAGE)}
                  className="px-3 py-1.5 text-xs border border-mpp-border rounded hover:border-mpp-amber/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* Last crawl footer */}
        {stats && stats.recentCrawls.length > 0 && (
          <div className="mt-12 pt-6 border-t border-mpp-border">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">
              Recent crawls
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {stats.recentCrawls.slice(0, 3).map((r) => (
                <div key={r.id} className="text-xs font-mono text-muted-foreground bg-mpp-surface/50 border border-mpp-border/50 rounded px-3 py-2">
                  <span className="text-foreground">{r.source}</span>
                  {" "}·{" "}
                  <span className={r.status === "success" ? "text-green-500" : r.status === "partial" ? "text-mpp-amber" : "text-red-400"}>
                    {r.status}
                  </span>
                  {" "}·{" "}
                  {r.itemsFound.toLocaleString()} found
                  {" "}·{" "}
                  {(r.durationMs / 1000).toFixed(1)}s
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const cls = `border rounded p-3 text-left transition-colors ${
    active
      ? "border-mpp-amber/60 bg-mpp-amber/10"
      : onClick
        ? "border-mpp-border bg-mpp-surface hover:border-mpp-amber/40 cursor-pointer"
        : "border-mpp-border bg-mpp-surface"
  }`;
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-mono uppercase tracking-widest mb-1">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-mpp-surface border border-mpp-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-mpp-amber/40 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function isStdio(endpoint: string | null) {
  return !!endpoint && (endpoint.startsWith("npx://") || endpoint.startsWith("stdio://"));
}

function installCommand(endpoint: string) {
  if (endpoint.startsWith("npx://")) return `npx -y ${endpoint.slice("npx://".length)}`;
  if (endpoint.startsWith("stdio://")) return endpoint.slice("stdio://".length);
  return endpoint;
}

function InstallSnippet({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-mpp-bg border border-cyan-400/20 rounded px-2 py-1.5 mb-2">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <p className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-wider">Install</p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(command).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          aria-label="Copy install command"
          className="text-muted-foreground hover:text-cyan-400 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <code className="font-mono text-[11px] text-foreground/90 select-all break-all">{command}</code>
    </div>
  );
}

function ServiceCard({ service }: { service: CatalogService }) {
  const protocols = service.protocols && service.protocols.length > 0 ? service.protocols : [service.protocol];
  const stdio = isStdio(service.endpointUrl);
  const isFree = (service.effectivePrice ?? service.basePrice ?? null) === 0;

  return (
    <div className="border border-mpp-border bg-mpp-surface rounded p-4 hover:border-mpp-amber/30 transition-colors group flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <CategoryIcon category={service.category} />
          <h3 className="font-medium text-foreground text-sm truncate" title={service.name}>
            {service.name}
          </h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <HealthBadge status={service.healthStatus} error={service.healthError} />
          {isFree && !stdio && (
            <span className="text-[9px] font-mono text-green-500 bg-green-500/10 border border-green-500/30 rounded px-1 py-0.5 uppercase tracking-wider">
              Free
            </span>
          )}
          {stdio && (
            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 rounded px-1 py-0.5 uppercase tracking-wider" title="Stdio MCP server — install locally">
              Local
            </span>
          )}
          {service.verified && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" aria-label="Verified" />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3 flex-1">
        {service.description ?? "—"}
      </p>

      <div className="flex flex-wrap items-center gap-1 mb-3">
        {protocols.slice(0, 3).map((p) => <ProtocolBadge key={p} protocol={p} />)}
        {service.chain && service.chain !== "unknown" && (
          <NetworkBadge chain={service.chain} label={service.chainLabel} testnet={service.testnet} />
        )}
        {service.category && (
          <span className="text-[10px] font-mono text-muted-foreground bg-white/5 border border-mpp-border/50 rounded px-1.5 py-0.5">
            {service.category}
          </span>
        )}
      </div>

      {stdio && service.endpointUrl ? (
        <InstallSnippet command={installCommand(service.endpointUrl)} />
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-mpp-border/50">
        <div className="flex items-center gap-1.5">
          <span className="text-mpp-amber font-mono text-sm font-semibold">{formatPrice(service)}</span>
          {(service.basePrice ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground">/ call</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {service.websiteUrl && (
            <a
              href={service.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-mpp-amber transition-colors"
              title="Visit website"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {stdio ? (
            <span className="text-[10px] font-mono text-muted-foreground" title="Stdio MCP servers run locally with your AI client (Claude Desktop, Cursor)">
              Local install
            </span>
          ) : (
            <Link
              to={`/agent-console?service=${encodeURIComponent(service.slug)}`}
              className="text-[10px] font-mono text-mpp-amber hover:underline flex items-center gap-1"
            >
              Use it →
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <Tag className="w-2.5 h-2.5 text-muted-foreground/60" />
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          via {service.source}
        </span>
      </div>
    </div>
  );
}
