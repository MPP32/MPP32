import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowRight,
  Wallet,
  Key,
  Copy,
  CheckCircle2,
  Plus,
  Trash2,
  Activity,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Network,
  Eye,
  EyeOff,
  AlertCircle,
  Terminal,
} from "lucide-react";

const MPPX_SDK_URL = "https://github.com/wevm/mppx";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CreatedSession {
  sessionId: string;
  apiKey: string;
  agentId: string;
  agentName?: string;
  walletAddress?: string;
  walletVerified: boolean;
  m32BalanceSnapshot: number;
  projectedDiscountPercent: number;
  discountActive: boolean;
  expiresAt: string;
  protocols: string[];
  verificationNotice?: string | null;
  custodyDisclosure?: string;
  createdAt: string;
}

interface SessionDetail {
  session: {
    id: string;
    agentId: string;
    agentName: string | null;
    walletAddress: string | null;
    walletVerified: boolean;
    preferredProtocol: string | null;
    totalRequests: number;
    successfulRequests: number;
    successRate: string;
    callsLastHour: number;
    rateLimit: { max: number; windowMs: number };
    settledCalls: number;
    settledVolumeUsd: number;
    isActive: boolean;
    lastActivityAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  };
  protocolBreakdown: Array<{
    protocol: string;
    requests: number;
    settledVolumeUsd: number;
  }>;
  recentTransactions: Array<{
    id: string;
    service: string;
    protocolUsed: string;
    paymentMethod: string | null;
    priceQuoted: number;
    discountPercent: number;
    priceSettled: number;
    settled: boolean;
    settlementTxSignature: string | null;
    success: boolean;
    latencyMs: number | null;
    statusCode: number;
    createdAt: string;
  }>;
  custodyDisclosure?: string;
}

interface ProtocolStatusEntry {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  network: string;
  currency: string;
  settlementSpeed: string;
  fees: string;
  bestFor: string;
}

interface ProtocolsResponse {
  protocols: ProtocolStatusEntry[];
  enabledCount: number;
  totalCount: number;
  recommendation: string;
}

interface AgentStats {
  activeSessions: number;
  totalRequests: number;
  settledRequests: number;
  settledVolumeUsd: number;
  supportedProtocols: number;
}

/* ------------------------------------------------------------------ */
/*  LocalStorage helpers                                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "mpp32_agent_sessions_v1";

function loadStoredSessions(): CreatedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Coerce stale (pre-honest-payments) entries to the new shape so the UI
    // never reads removed fields like budgetUsd/spentUsd/discountTier.
    return parsed
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        sessionId: String(s.sessionId ?? ""),
        apiKey: String(s.apiKey ?? ""),
        agentId: String(s.agentId ?? ""),
        agentName: typeof s.agentName === "string" ? s.agentName : undefined,
        walletAddress: typeof s.walletAddress === "string" ? s.walletAddress : undefined,
        walletVerified: typeof s.walletVerified === "boolean" ? s.walletVerified : false,
        m32BalanceSnapshot:
          typeof s.m32BalanceSnapshot === "number"
            ? s.m32BalanceSnapshot
            : typeof s.m32Balance === "number"
              ? s.m32Balance
              : 0,
        projectedDiscountPercent:
          typeof s.projectedDiscountPercent === "number"
            ? s.projectedDiscountPercent
            : typeof s.discountPercent === "number"
              ? s.discountPercent
              : 0,
        discountActive: typeof s.discountActive === "boolean" ? s.discountActive : false,
        expiresAt: String(s.expiresAt ?? ""),
        protocols: Array.isArray(s.protocols) ? (s.protocols as string[]) : [],
        verificationNotice:
          typeof s.verificationNotice === "string" ? s.verificationNotice : null,
        custodyDisclosure:
          typeof s.custodyDisclosure === "string" ? s.custodyDisclosure : undefined,
        createdAt: String(s.createdAt ?? new Date().toISOString()),
      }))
      .filter((s) => s.sessionId && s.apiKey);
  } catch {
    return [];
  }
}

function saveStoredSessions(sessions: CreatedSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AgentConsole() {
  const qc = useQueryClient();
  const [storedSessions, setStoredSessions] = useState<CreatedSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    const sessions = loadStoredSessions();
    setStoredSessions(sessions);
    if (sessions.length > 0 && sessions[0]) {
      setActiveSessionId(sessions[0].sessionId);
    } else {
      setShowCreateForm(true);
    }
  }, []);

  // Fetch global agent stats
  const { data: stats } = useQuery({
    queryKey: ["agent-stats"],
    queryFn: () => api.get<AgentStats>("/api/agent/stats"),
    refetchInterval: 30_000,
  });

  // Fetch protocol statuses
  const { data: protocolsData } = useQuery({
    queryKey: ["agent-protocols"],
    queryFn: () => api.get<ProtocolsResponse>("/api/agent/protocols"),
  });

  // Fetch the active session detail
  const activeSession = storedSessions.find((s) => s.sessionId === activeSessionId);
  const { data: sessionDetail, refetch: refetchSession } = useQuery({
    queryKey: ["agent-session", activeSessionId],
    queryFn: () => api.get<SessionDetail>(`/api/agent/sessions/${activeSessionId}`),
    enabled: !!activeSessionId,
    refetchInterval: 15_000,
  });

  function handleSessionCreated(session: CreatedSession) {
    const next = [session, ...storedSessions];
    setStoredSessions(next);
    saveStoredSessions(next);
    setActiveSessionId(session.sessionId);
    setShowCreateForm(false);
    qc.invalidateQueries({ queryKey: ["agent-stats"] });
  }

  function handleRemoveSession(id: string) {
    if (!confirm("Remove this session from your local browser storage? Your API key will be lost. The session will continue to exist on the server until it expires.")) {
      return;
    }
    const next = storedSessions.filter((s) => s.sessionId !== id);
    setStoredSessions(next);
    saveStoredSessions(next);
    if (activeSessionId === id) {
      setActiveSessionId(next[0]?.sessionId ?? null);
      if (next.length === 0) setShowCreateForm(true);
    }
  }

  return (
    <div className="min-h-screen bg-mpp-bg">
      {/* Header */}
      <section className="border-b border-mpp-border py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3">
                Agent Console
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-2">
                Your Agent Sessions
              </h1>
              <p className="text-muted-foreground text-sm max-w-2xl">
                Create an agent session to get a rate-limited API key for calling services across 5 settlement protocols.
                <span className="text-foreground"> Your wallet pays providers directly — MPP32 never holds your funds.</span> Sessions and API keys are stored in your browser; save your API key on creation.
              </p>
            </div>
            <Link to="/agent-hub" className="text-mpp-amber text-xs hover:text-mpp-amber-bright transition-colors flex items-center gap-1.5 font-mono uppercase tracking-wider">
              <ExternalLink className="w-3.5 h-3.5" />
              About Agent Plugin
            </Link>
          </div>
        </div>
      </section>

      {/* Global stats strip */}
      <section className="border-b border-mpp-border py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label="Active Sessions (Network)"
              value={stats?.activeSessions != null ? String(stats.activeSessions) : "—"}
            />
            <StatTile
              label="Total Requests"
              value={stats?.totalRequests != null ? stats.totalRequests.toLocaleString() : "—"}
            />
            <StatTile
              label="Settled On-Chain"
              value={stats?.settledVolumeUsd != null ? `$${stats.settledVolumeUsd.toFixed(2)}` : "—"}
            />
            <StatTile
              label="Protocols Online"
              value={
                protocolsData
                  ? `${protocolsData.enabledCount}/${protocolsData.totalCount}`
                  : "—"
              }
            />
          </div>
        </div>
      </section>

      {/* Main */}
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-6">
          {/* Left: session list */}
          <div className="lg:col-span-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Local Sessions
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-xs text-mpp-amber hover:text-mpp-amber-bright flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
            </div>
            {storedSessions.length === 0 ? (
              <div className="card-surface rounded p-5 text-sm text-muted-foreground">
                No agent sessions yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {storedSessions.map((s) => (
                  <button
                    key={s.sessionId}
                    onClick={() => {
                      setActiveSessionId(s.sessionId);
                      setShowCreateForm(false);
                    }}
                    className={cn(
                      "w-full text-left rounded p-3 border transition-colors",
                      activeSessionId === s.sessionId && !showCreateForm
                        ? "border-mpp-amber/40 bg-mpp-amber/5"
                        : "border-mpp-border bg-mpp-surface hover:border-mpp-border/80"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-foreground text-sm font-medium truncate">
                        {s.agentName || s.agentId}
                      </span>
                      {s.walletVerified && s.projectedDiscountPercent > 0 ? (
                        <span className="font-mono text-[10px] text-mpp-amber bg-mpp-amber/10 border border-mpp-amber/30 px-1.5 py-0.5 rounded flex-shrink-0" title="M32 holder discount active">
                          -{s.projectedDiscountPercent}%
                        </span>
                      ) : s.projectedDiscountPercent > 0 ? (
                        <span className="font-mono text-[10px] text-muted-foreground bg-mpp-bg border border-mpp-border px-1.5 py-0.5 rounded flex-shrink-0" title="Projected discount — activates once SIWS wallet verification ships (see Roadmap)">
                          -{s.projectedDiscountPercent}% preview
                        </span>
                      ) : null}
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {s.apiKey.slice(0, 28)}…
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      Created {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: form OR session detail */}
          <div className="lg:col-span-8">
            {showCreateForm || !activeSession ? (
              <CreateSessionForm onCreated={handleSessionCreated} onCancel={storedSessions.length > 0 ? () => setShowCreateForm(false) : undefined} />
            ) : (
              <SessionDetailView
                stored={activeSession}
                detail={sessionDetail}
                onRefresh={() => refetchSession()}
                onRemove={() => handleRemoveSession(activeSession.sessionId)}
              />
            )}
          </div>
        </div>
      </section>

      {/* Protocol status footer */}
      {protocolsData && (
        <section className="border-t border-mpp-border py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Protocol Status
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {protocolsData.protocols.map((p) => (
                <div
                  key={p.id}
                  className="card-surface rounded p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        p.enabled ? "bg-mpp-success" : "bg-mpp-danger"
                      )}
                    />
                    <span className="font-mono text-xs text-foreground uppercase">
                      {p.id}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p.settlementSpeed}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatTile                                                           */
/* ------------------------------------------------------------------ */

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface rounded p-3">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-mono text-mpp-amber text-lg font-semibold">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CreateSessionForm                                                  */
/* ------------------------------------------------------------------ */

interface WalletBalanceResponse {
  wallet: string;
  m32Balance: number;
  projectedDiscountPercent: number;
  tier: string;
  walletVerified: boolean;
  discountActive: boolean;
  lookupFailed: boolean;
  note: string;
}

function CreateSessionForm({
  onCreated,
  onCancel,
}: {
  onCreated: (s: CreatedSession) => void;
  onCancel?: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [preferredProtocol, setPreferredProtocol] = useState<string>("");
  const [balancePreview, setBalancePreview] = useState<WalletBalanceResponse | null>(null);

  const balanceMutation = useMutation({
    mutationFn: () =>
      api.get<WalletBalanceResponse>(
        `/api/agent/wallet-balance?wallet=${encodeURIComponent(walletAddress.trim())}`,
      ),
    onSuccess: (data) => {
      setBalancePreview(data);
    },
    onError: (err) => {
      setBalancePreview(null);
      const msg = err instanceof ApiError ? err.message : "Balance lookup failed";
      toast.error("Could not check balance", { description: msg });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        agentId: agentId.trim(),
      };
      if (agentName.trim()) payload.agentName = agentName.trim();
      if (walletAddress.trim()) payload.walletAddress = walletAddress.trim();
      if (preferredProtocol) payload.preferredProtocol = preferredProtocol;
      return api.post<Omit<CreatedSession, "createdAt">>(
        "/api/agent/sessions",
        payload
      );
    },
    onSuccess: (data) => {
      const stored: CreatedSession = {
        ...data,
        agentName: agentName.trim() || undefined,
        walletAddress: walletAddress.trim() || data.walletAddress,
        createdAt: new Date().toISOString(),
      };
      onCreated(stored);
      toast.success("Session created", {
        description: `Save your API key. It won't be shown again.`,
      });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to create session";
      toast.error("Could not create session", { description: msg });
    },
  });

  return (
    <div className="card-surface rounded p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Create Agent Session
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Generates a rate-limited API key (120 calls/min). Optional Solana wallet lets you preview your projected M32 holder discount — discounts activate once Sign-In With Solana (SIWS) ships (<Link to="/roadmap" className="text-mpp-amber hover:text-mpp-amber-bright underline-offset-2 hover:underline">roadmap</Link>). <span className="text-foreground">Your wallet pays providers directly; MPP32 never custodies funds.</span>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!agentId.trim()) return;
          createMutation.mutate();
        }}
        className="space-y-4"
      >
        <Field
          label="Agent ID"
          required
          hint="A unique identifier for your agent (e.g. 'my-trading-bot')."
        >
          <input
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="my-trading-bot"
            required
            maxLength={256}
            className="w-full bg-mpp-bg border border-mpp-border rounded px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-mpp-amber/50 transition-colors"
          />
        </Field>

        <Field
          label="Agent Name"
          hint="Optional friendly display name."
        >
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Trading Bot"
            maxLength={100}
            className="w-full bg-mpp-bg border border-mpp-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors"
          />
        </Field>

        <Field
          label="Solana Wallet Address"
          hint="Optional. Preview your projected discount: 250K+ M32 = 20% off, 1M+ = 40% off. Discounts activate once SIWS wallet verification ships — until then they're informational only."
        >
          <div className="flex gap-2">
            <input
              value={walletAddress}
              onChange={(e) => {
                setWalletAddress(e.target.value);
                setBalancePreview(null);
              }}
              placeholder="9Pa8yUe…"
              className="flex-1 bg-mpp-bg border border-mpp-border rounded px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-mpp-amber/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => balanceMutation.mutate()}
              disabled={balanceMutation.isPending || !walletAddress.trim()}
              className="border border-mpp-border bg-mpp-surface hover:border-mpp-amber/40 transition-colors px-3 py-2 rounded text-xs font-mono text-foreground disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
              title="Check M32 balance + projected discount without creating a session"
            >
              {balanceMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wallet className="w-3 h-3" />
              )}
              Check Balance
            </button>
          </div>
          {balancePreview && (
            <div className="mt-2 rounded p-3 border border-mpp-border bg-mpp-bg flex flex-wrap items-center gap-3 text-xs">
              <span className="font-mono text-muted-foreground">M32 Balance:</span>
              <span className="font-mono text-foreground font-semibold">
                {balancePreview.m32Balance.toLocaleString()}
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span className="font-mono text-muted-foreground">Projected:</span>
              {balancePreview.projectedDiscountPercent > 0 ? (
                <span className="font-mono text-mpp-amber bg-mpp-amber/10 border border-mpp-amber/30 px-1.5 py-0.5 rounded">
                  -{balancePreview.projectedDiscountPercent}% ({balancePreview.tier})
                </span>
              ) : (
                <span className="font-mono text-muted-foreground">no discount tier</span>
              )}
              {balancePreview.lookupFailed && (
                <span className="font-mono text-mpp-danger text-[10px]">RPC lookup failed — try again</span>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground/80 font-mono">
                Preview · activates with SIWS
              </span>
            </div>
          )}
        </Field>

        <Field
          label="Preferred Protocol"
          hint="Routing preference. Final settlement happens via the protocol the called service supports — MPP32 forwards 402 challenges to your wallet for paid services."
        >
          <select
            value={preferredProtocol}
            onChange={(e) => setPreferredProtocol(e.target.value)}
            className="w-full bg-mpp-bg border border-mpp-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors"
          >
            <option value="">Auto-select</option>
              <option value="x402">x402 (Solana USDC, &lt;400ms)</option>
              <option value="tempo">Tempo (Eth L2 pathUSD, &lt;1s)</option>
              <option value="acp">ACP (sessions)</option>
              <option value="ap2">AP2 (verifiable credentials)</option>
              <option value="agtp">AGTP (agent identity)</option>
            </select>
        </Field>

        <div className="rounded p-3 border-l-2 border-mpp-amber/60 bg-mpp-amber/5 flex gap-2">
          <AlertCircle className="w-4 h-4 text-mpp-amber flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-mpp-amber font-mono uppercase tracking-wider">Save your key:</span>{" "}
            The API key is stored only in this browser. If you clear localStorage you'll lose access to your session
            (the session will keep working until it expires, but you won't be able to call <code className="font-mono text-foreground">/execute</code> with it).
          </p>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending || !agentId.trim()}
          className="btn-amber flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              Create Session
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
        {required && <span className="text-mpp-amber ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground/70 mt-1">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  SessionDetailView                                                  */
/* ------------------------------------------------------------------ */

function SessionDetailView({
  stored,
  detail,
  onRefresh,
  onRemove,
}: {
  stored: CreatedSession;
  detail: SessionDetail | undefined;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const [showKey, setShowKey] = useState(false);

  const session = detail?.session;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="card-surface rounded p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {stored.agentId}
            </p>
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {stored.agentName || stored.agentId}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-2 py-1"
            >
              <Activity className="w-3 h-3" />
              Refresh
            </button>
            <button
              onClick={onRemove}
              className="text-xs text-mpp-danger hover:text-mpp-danger/80 transition-colors flex items-center gap-1 px-2 py-1"
              title="Forget locally"
            >
              <Trash2 className="w-3 h-3" />
              Forget
            </button>
          </div>
        </div>

        {/* API Key */}
        <div className="bg-mpp-bg rounded border border-mpp-border p-3 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3 h-3" />
              API Key (X-Agent-Key header)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowKey((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <CopyButton text={stored.apiKey} />
            </div>
          </div>
          <p className="font-mono text-xs text-foreground select-all break-all">
            {showKey ? stored.apiKey : `${stored.apiKey.slice(0, 16)}${"•".repeat(24)}`}
          </p>
        </div>

        {/* Claude Desktop / Cursor / Windsurf one-click config */}
        <McpClientConfig apiKey={stored.apiKey} />

        {/* Honest stats grid: only counts that correspond to real on-chain state */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat
            label="Total Calls"
            value={session ? session.totalRequests.toLocaleString() : "—"}
            subtext={session ? `${session.successRate}% 2xx` : undefined}
          />
          <MiniStat
            label="Settled On-Chain"
            value={session ? session.settledCalls.toLocaleString() : "—"}
            subtext={session ? `$${session.settledVolumeUsd.toFixed(4)} verified` : undefined}
          />
          <MiniStat
            label="Calls (Last Hour)"
            value={session ? `${session.callsLastHour} / ${session.rateLimit.max}` : "—"}
            subtext="Rate limit per agent key"
          />
          <MiniStat
            label="M32 Discount"
            value={
              stored.projectedDiscountPercent > 0
                ? `${stored.projectedDiscountPercent}%`
                : "—"
            }
            subtext={
              !stored.walletAddress
                ? "No wallet"
                : !stored.walletVerified
                  ? "Preview · SIWS pending"
                  : stored.projectedDiscountPercent > 0
                    ? "Active"
                    : "No M32"
            }
          />
        </div>

        {/* Custody disclosure — replaces the fake budget progress bar */}
        <div className="mt-4 rounded p-3 border-l-2 border-mpp-success/60 bg-mpp-success/5 flex gap-2">
          <ShieldCheck className="w-4 h-4 text-mpp-success flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-mpp-success font-mono uppercase tracking-wider">Non-custodial:</span>{" "}
            MPP32 never holds your funds. Paid services are settled by your own wallet via x402 (USDC on Solana) or Tempo (pathUSD on Eth&nbsp;L2). Settled volume above counts only payments verified on-chain by the facilitator.
          </p>
        </div>

        {/* Wallet info — honest about verification state */}
        {stored.walletAddress && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Wallet:</span>
            <code className="font-mono text-foreground/80">
              {stored.walletAddress.slice(0, 6)}…{stored.walletAddress.slice(-6)}
            </code>
            {stored.m32BalanceSnapshot > 0 && (
              <span className="font-mono text-[10px] text-mpp-amber bg-mpp-amber/10 border border-mpp-amber/30 px-1.5 py-0.5 rounded">
                {stored.m32BalanceSnapshot.toLocaleString()} M32
              </span>
            )}
            {stored.walletVerified ? (
              <span className="font-mono text-[10px] text-mpp-success bg-mpp-success/10 border border-mpp-success/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </span>
            ) : (
              <Link
                to="/roadmap"
                className="font-mono text-[10px] text-muted-foreground bg-mpp-bg border border-mpp-border hover:border-mpp-amber/40 hover:text-foreground transition-colors px-1.5 py-0.5 rounded"
                title="Address ownership not yet authenticated. SIWS sign-in is on the roadmap — click to view."
              >
                Unverified · SIWS pending
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Use-from-your-server snippets */}
      <UseFromServer apiKey={stored.apiKey} />

      {/* Quick try block */}
      <QuickTry sessionId={stored.sessionId} apiKey={stored.apiKey} onSuccess={onRefresh} />

      {/* Protocol breakdown */}
      {detail && detail.protocolBreakdown.length > 0 && (
        <div className="card-surface rounded p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Network className="w-3 h-3" />
            Protocol Breakdown
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {detail.protocolBreakdown.map((p) => (
              <div
                key={p.protocol}
                className="flex items-center justify-between border border-mpp-border/50 rounded px-3 py-2"
              >
                <span className="font-mono text-xs text-mpp-amber uppercase">{p.protocol}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {p.requests} req · ${p.settledVolumeUsd.toFixed(4)} settled
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="card-surface rounded overflow-hidden">
        <div className="px-5 py-3 border-b border-mpp-border flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Recent Transactions
          </p>
        </div>
        {detail && detail.recentTransactions.length > 0 ? (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-mpp-border">
                  <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    When
                  </th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Service
                  </th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Protocol
                  </th>
                  <th className="text-right px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-right px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Latency
                  </th>
                  <th className="text-center px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    OK
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mpp-border">
                {detail.recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 text-muted-foreground font-mono text-[11px]">
                      {new Date(tx.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 text-foreground font-mono text-[11px]">
                      {tx.service}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-mpp-amber uppercase">
                      {tx.protocolUsed}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">
                      {tx.paymentMethod === "free" ? (
                        <span className="text-mpp-success font-mono text-[11px]">FREE</span>
                      ) : tx.settled ? (
                        <span className="flex items-center justify-end gap-1">
                          <span className="text-mpp-success">${tx.priceSettled.toFixed(5)}</span>
                          {tx.settlementTxSignature && (
                            <a
                              href={`https://solscan.io/tx/${tx.settlementTxSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-mpp-amber hover:text-mpp-amber-bright"
                              title="View settlement on Solscan"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {tx.discountPercent > 0 && (
                            <span className="text-mpp-amber text-[10px]">(-{tx.discountPercent}%)</span>
                          )}
                        </span>
                      ) : tx.paymentMethod === "passthrough_402" ? (
                        <span className="text-mpp-amber text-[11px]" title="Upstream returned 402 — caller's wallet must sign and retry">
                          402 challenge
                        </span>
                      ) : tx.paymentMethod === "x402_failed" ? (
                        <span className="text-mpp-danger text-[11px]" title="Payment header sent but upstream rejected">
                          payment failed
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground font-mono">
                      {tx.latencyMs != null ? `${tx.latencyMs}ms` : "—"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {tx.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-mpp-success inline" />
                      ) : (
                        <span className="text-mpp-danger text-xs">×</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No transactions yet. Try executing a query below.
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded border border-mpp-border/60 px-3 py-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="font-mono text-foreground text-sm font-semibold">{value}</p>
      {subtext && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{subtext}</p>}
    </div>
  );
}

function SettlementChip({ meta }: { meta: ExecuteMeta | undefined }) {
  if (!meta) return null;
  if (meta.isFree || meta.paymentMethod === "free") {
    return (
      <span
        className="bg-mpp-success/10 border border-mpp-success/30 rounded px-2 py-0.5 text-mpp-success"
        title="Free service — no payment required"
      >
        FREE
      </span>
    );
  }
  if (meta.settled && meta.settlementTxSignature) {
    return (
      <a
        href={meta.settlementExplorerUrl ?? `https://solscan.io/tx/${meta.settlementTxSignature}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-mpp-success/10 border border-mpp-success/30 rounded px-2 py-0.5 text-mpp-success flex items-center gap-1 hover:bg-mpp-success/15 transition-colors"
        title="Settlement verified on-chain"
      >
        ${(meta.priceSettled ?? 0).toFixed(4)} settled
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    );
  }
  if (meta.settled) {
    return (
      <span
        className="bg-mpp-success/10 border border-mpp-success/30 rounded px-2 py-0.5 text-mpp-success"
        title="Payment verified by facilitator"
      >
        ${(meta.priceSettled ?? 0).toFixed(4)} settled
      </span>
    );
  }
  if (meta.paymentMethod === "passthrough_402") {
    return (
      <span
        className="bg-mpp-amber/10 border border-mpp-amber/30 rounded px-2 py-0.5 text-mpp-amber"
        title="Upstream returned 402 — sign with your wallet using the mppx SDK and retry"
      >
        402 challenge — sign &amp; retry
      </span>
    );
  }
  if (meta.paymentMethod === "x402_failed") {
    return (
      <span className="bg-mpp-danger/10 border border-mpp-danger/30 rounded px-2 py-0.5 text-mpp-danger">
        payment rejected
      </span>
    );
  }
  return (
    <span className="bg-mpp-bg border border-mpp-border rounded px-2 py-0.5 text-muted-foreground" title="No payment recorded for this call">
      —
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  McpClientConfig — drop-in JSON for Claude Desktop / Cursor / etc.  */
/* ------------------------------------------------------------------ */

/**
 * Renders a copy-pastable `mcpServers` config block with the user's freshly
 * issued agent key already substituted in. This is the single most important
 * artifact on /agent-console — the issued key is useless to a new user until
 * they know where to paste it. The accompanying notes call out the two things
 * that have historically tripped new users up:
 *   1. MPP32_SOLANA_PRIVATE_KEY format (base58 secret key, not keypair.json).
 *   2. They need both USDC AND a small amount of native SOL for fees.
 */
function McpClientConfig({ apiKey }: { apiKey: string }) {
  const [tab, setTab] = useState<"with-key" | "without-key">("with-key");

  const withKeySnippet = `{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["-y", "mpp32-mcp-server@latest"],
      "env": {
        "MPP32_AGENT_KEY": "${apiKey}",
        "MPP32_SOLANA_PRIVATE_KEY": "PASTE_YOUR_BASE58_SOLANA_SECRET_KEY"
      }
    }
  }
}`;

  const withoutKeySnippet = `{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["-y", "mpp32-mcp-server@latest"],
      "env": {
        "MPP32_AGENT_KEY": "${apiKey}"
      }
    }
  }
}`;

  const text = tab === "with-key" ? withKeySnippet : withoutKeySnippet;

  return (
    <div className="rounded border border-mpp-amber/30 bg-mpp-amber/5 p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-mpp-amber" />
          <span className="font-mono text-[10px] text-mpp-amber uppercase tracking-wider">
            Connect Claude Desktop, Cursor, Windsurf, or Claude Code
          </span>
        </div>
        <CopyButton text={text} />
      </div>

      <div className="flex border-b border-mpp-amber/20 mb-3">
        <button
          onClick={() => setTab("with-key")}
          className={cn(
            "px-3 py-1.5 font-mono text-[11px] transition-colors relative",
            tab === "with-key"
              ? "text-mpp-amber"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          With payment key (x402)
          {tab === "with-key" && (
            <span className="absolute bottom-0 left-0 right-0 h-px bg-mpp-amber" />
          )}
        </button>
        <button
          onClick={() => setTab("without-key")}
          className={cn(
            "px-3 py-1.5 font-mono text-[11px] transition-colors relative",
            tab === "without-key"
              ? "text-mpp-amber"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Free services only
          {tab === "without-key" && (
            <span className="absolute bottom-0 left-0 right-0 h-px bg-mpp-amber" />
          )}
        </button>
      </div>

      <pre className="bg-mpp-bg p-3 rounded text-[11px] font-mono text-foreground overflow-x-auto scrollbar-thin whitespace-pre leading-relaxed border border-mpp-border">
        {text}
      </pre>

      <div className="mt-3 space-y-2 text-[11px] text-muted-foreground leading-relaxed">
        <p className="flex items-start gap-1.5">
          <span className="font-mono text-mpp-amber flex-shrink-0">file:</span>
          <span>
            <span className="font-mono text-foreground">Claude Desktop</span>{" "}
            macOS{" "}
            <code className="font-mono text-foreground/80">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </code>{" "}
            · Windows{" "}
            <code className="font-mono text-foreground/80">
              %APPDATA%\Claude\claude_desktop_config.json
            </code>{" "}
            ·{" "}
            <span className="font-mono text-foreground">Cursor</span>{" "}
            <code className="font-mono text-foreground/80">
              ~/.cursor/mcp.json
            </code>{" "}
            ·{" "}
            <span className="font-mono text-foreground">Windsurf</span>{" "}
            <code className="font-mono text-foreground/80">
              ~/.codeium/windsurf/mcp_config.json
            </code>
            . Fully quit and reopen the client after editing.
          </span>
        </p>
        {tab === "with-key" && (
          <>
            <p className="flex items-start gap-1.5">
              <span className="font-mono text-mpp-amber flex-shrink-0">key:</span>
              <span>
                <code className="font-mono text-foreground">
                  MPP32_SOLANA_PRIVATE_KEY
                </code>{" "}
                must be the 64-byte Solana secret key, base58 encoded — the
                value Phantom shows under{" "}
                <code className="font-mono text-foreground/80">
                  settings &raquo; show private key
                </code>
                , not the recovery phrase. From a{" "}
                <code className="font-mono text-foreground/80">
                  keypair.json
                </code>{" "}
                file (the array form Solana CLI writes), convert with{" "}
                <code className="font-mono text-foreground/80">
                  node -e "console.log(require('bs58').encode(Buffer.from(JSON.parse(require('fs').readFileSync('keypair.json')))))"
                </code>
                . Never share it; it can move funds.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="font-mono text-mpp-amber flex-shrink-0">fund:</span>
              <span>
                Wallet needs both USDC (for the payment itself) and a tiny
                amount of native SOL (for the transaction fee, typically{" "}
                <code className="font-mono text-foreground/80">
                  0.001 SOL
                </code>{" "}
                covers many calls). A USDC-only wallet will fail with{" "}
                <code className="font-mono text-foreground/80">
                  insufficient funds for rent
                </code>{" "}
                even though USDC is plentiful.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="font-mono text-mpp-amber flex-shrink-0">test:</span>
              <span>
                Inside Claude, ask:{" "}
                <span className="text-foreground italic">
                  "Run the mpp32 diagnostics tool"
                </span>
                . The tool prints{" "}
                <code className="font-mono text-foreground/80">
                  Ready to pay: YES
                </code>{" "}
                when the agent key, the Solana key, and the API are all wired
                up correctly.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UseFromServer — copyable cURL + SDK snippets                       */
/* ------------------------------------------------------------------ */

function UseFromServer({ apiKey }: { apiKey: string }) {
  const [tab, setTab] = useState<"curl" | "sdk">("curl");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://mpp32.org";

  const curlSnippet = `# Free service — works from anywhere with just your X-Agent-Key
curl -X POST "${origin}/api/agent/execute" \\
  -H "X-Agent-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"free:dexscreener-search","method":"GET","query":{"q":"SOL"}}'

# Paid Intelligence Oracle — first call returns a 402 challenge.
# Sign with your wallet using the mppx SDK from your server (next tab),
# then retry the same request with the X-Payment header.
curl -X POST "${origin}/api/agent/execute" \\
  -H "X-Agent-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"intelligence","body":{"token":"BONK"}}'`;

  const sdkSnippet = `// 1. Install
//    npm install mppx
//    (or pnpm add mppx / bun add mppx)

import { createMppxClient } from "mppx";

const mpp = createMppxClient({
  baseUrl: "${origin}",
  agentKey: "${apiKey}",
  // Your Solana keypair signs USDC payments via x402.
  solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
});

// Auto-handles 402 challenge → wallet signs USDC payment → retry → result.
const { result, meta } = await mpp.execute({
  service: "intelligence",
  body: { token: "BONK" },
});

console.log(meta.settlementTxSignature); // → solscan.io/tx/...`;

  const text = tab === "curl" ? curlSnippet : sdkSnippet;

  return (
    <div className="card-surface rounded overflow-hidden">
      <div className="px-5 py-3 border-b border-mpp-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3 h-3 text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Use From Your Server
          </p>
        </div>
        <a
          href={MPPX_SDK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-mpp-amber hover:text-mpp-amber-bright transition-colors flex items-center gap-1 font-mono"
        >
          mppx SDK
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="flex border-b border-mpp-border">
        <button
          onClick={() => setTab("curl")}
          className={cn(
            "px-4 py-2 font-mono text-[11px] transition-colors relative",
            tab === "curl" ? "text-mpp-amber" : "text-muted-foreground hover:text-foreground"
          )}
        >
          cURL
          {tab === "curl" && <span className="absolute bottom-0 left-0 right-0 h-px bg-mpp-amber" />}
        </button>
        <button
          onClick={() => setTab("sdk")}
          className={cn(
            "px-4 py-2 font-mono text-[11px] transition-colors relative",
            tab === "sdk" ? "text-mpp-amber" : "text-muted-foreground hover:text-foreground"
          )}
        >
          mppx SDK (TypeScript)
          {tab === "sdk" && <span className="absolute bottom-0 left-0 right-0 h-px bg-mpp-amber" />}
        </button>
        <div className="ml-auto pr-3 flex items-center">
          <CopyButton text={text} />
        </div>
      </div>
      <pre className="bg-mpp-bg p-4 text-[11px] font-mono text-foreground overflow-x-auto scrollbar-thin whitespace-pre leading-relaxed">
        {text}
      </pre>
      <div className="px-5 py-3 border-t border-mpp-border bg-mpp-surface/50">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Browser calls to paid services return a 402 challenge that requires a wallet signature — sign from your server with the mppx SDK and retry. Free services (prefix <code className="font-mono text-foreground">free:</code>) work directly from any client with just the API key.
        </p>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-mpp-success" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  QuickTry — interactive demo                                         */
/* ------------------------------------------------------------------ */

type ExecuteMeta = {
  service?: string;
  slug?: string;
  sourceKind?: string;
  isFree?: boolean;
  protocol?: string;
  protocolReasoning?: string;
  priceQuoted?: number;
  priceSettled?: number;
  discountPercent?: number;
  paymentMethod?: string | null;
  settled?: boolean;
  settlementTxSignature?: string | null;
  settlementExplorerUrl?: string | null;
  latencyMs?: number;
  statusCode?: number;
  success?: boolean;
  custody?: string;
};

type ExecuteResult = {
  result: unknown;
  meta: ExecuteMeta;
};

type OracleData = {
  token?: { address?: string; name?: string; symbol?: string; priceUsd?: string };
  marketData?: {
    priceChange24h?: number;
    priceChange1h?: number;
    priceChange7d?: number;
    volume24h?: number;
    liquidity?: number;
    marketCap?: number;
    fdv?: number;
    pairAge?: string;
    dexId?: string;
    twitterFollowers?: number | null;
  };
  rugRisk?: { score?: number; level?: string; factors?: string[] };
  whaleActivity?: { level?: string; recentBuys?: number; recentSells?: number; dominanceScore?: number };
  alphaScore?: number;
  pumpProbability24h?: number;
  summary?: string;
  coingeckoEnriched?: boolean;
  timestamp?: string;
  [k: string]: unknown;
};

type QuickTryPreset = {
  id: string;
  label: string;
  description: string;
  service: string;
  method: "GET" | "POST";
  paid: boolean;
  defaultInput: string;
  buildPayload: (input: string) => { body?: unknown; query?: Record<string, string> };
};

const QUICK_TRY_PRESETS: QuickTryPreset[] = [
  {
    id: "intelligence",
    label: "Intelligence Oracle",
    description: "Real-time Solana token alpha + rug risk + whale activity. PAID — your wallet signs the USDC payment via x402. From the browser this returns a 402 challenge; use the MPP32 SDK from your server to sign and retry.",
    service: "intelligence",
    method: "POST",
    paid: true,
    defaultInput: "BONK",
    buildPayload: (input) => ({ body: { token: input.trim() } }),
  },
  {
    id: "dex-search",
    label: "DexScreener Search (free)",
    description: "Search any token across DEXes. Free public API — perfect for testing your key with no spend.",
    service: "free:dexscreener-search",
    method: "GET",
    paid: false,
    defaultInput: "SOL",
    buildPayload: (input) => ({ query: { q: input.trim() } }),
  },
  {
    id: "jup-price",
    label: "Jupiter Price (free)",
    description: "Real-time SPL token prices via Jupiter. Free, no auth needed.",
    service: "free:jupiter-price",
    method: "GET",
    paid: false,
    defaultInput: "So11111111111111111111111111111111111111112",
    buildPayload: (input) => ({ query: { ids: input.trim() } }),
  },
  {
    id: "httpbin",
    label: "httpbin Echo (free)",
    description: "Echo your request — verify the agent key, headers, and payload routing.",
    service: "free:httpbin",
    method: "POST",
    paid: false,
    defaultInput: "agent-key works",
    buildPayload: (input) => ({ body: { message: input.trim(), timestamp: new Date().toISOString() } }),
  },
];

interface CatalogServiceDetail {
  slug: string;
  name: string;
  description: string | null;
  endpointUrl: string | null;
  protocol: string;
  basePrice: number | null;
  effectivePrice: number | null;
  network: string | null;
  asset: string | null;
}

function isStdioEndpoint(endpoint: string | null | undefined): boolean {
  return !!endpoint && (endpoint.startsWith("npx://") || endpoint.startsWith("stdio://") || endpoint.startsWith("pypi://"));
}

function tryParseJson(s: string): unknown | null {
  try { return JSON.parse(s); } catch { return null; }
}

function QuickTry({
  sessionId,
  apiKey,
  onSuccess,
}: {
  sessionId: string;
  apiKey: string;
  onSuccess: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSlug = searchParams.get("service");

  // Fetch the requested catalog service (if any) to build a dynamic preset.
  const catalogQuery = useQuery({
    queryKey: ["catalog-detail", requestedSlug],
    queryFn: () => api.get<CatalogServiceDetail>(`/api/catalog/${encodeURIComponent(requestedSlug!)}`),
    enabled: !!requestedSlug,
    staleTime: 60_000,
    retry: false,
  });

  const dynamicPreset = useMemo<QuickTryPreset | null>(() => {
    const s = catalogQuery.data;
    if (!s) return null;
    const price = s.effectivePrice ?? s.basePrice ?? 0;
    const paid = price > 0;
    const method: "GET" | "POST" = "POST";
    return {
      id: `catalog:${s.slug}`,
      label: s.name,
      description: s.description ?? `Catalog service ${s.slug}.`,
      service: s.slug,
      method,
      paid,
      defaultInput: paid ? '{"prompt":"hello"}' : '{}',
      buildPayload: (input: string) => {
        const parsed = tryParseJson(input);
        if (parsed && typeof parsed === "object") return { body: parsed };
        return { body: { input } };
      },
    };
  }, [catalogQuery.data]);

  const presets = useMemo(() => {
    return dynamicPreset ? [dynamicPreset, ...QUICK_TRY_PRESETS] : QUICK_TRY_PRESETS;
  }, [dynamicPreset]);

  // Default to FREE preset; switch to dynamic preset once it loads.
  const [presetId, setPresetId] = useState<string>("dex-search");
  const preset = presets.find((p) => p.id === presetId) ?? presets[0]!;
  const [input, setInput] = useState(preset.defaultInput);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Auto-select the deep-linked catalog service once it loads.
  useEffect(() => {
    if (dynamicPreset && presetId !== dynamicPreset.id) {
      setPresetId(dynamicPreset.id);
      setInput(dynamicPreset.defaultInput);
      setResult(null);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicPreset?.id]);

  const stdioBlocked = !!catalogQuery.data && isStdioEndpoint(catalogQuery.data.endpointUrl);

  function selectPreset(id: string) {
    const next = presets.find((p) => p.id === id) ?? presets[0]!;
    setPresetId(id);
    setInput(next.defaultInput);
    setResult(null);
    setError(null);
    // If switching off the deep-linked service, clear the URL param.
    if (dynamicPreset && id !== dynamicPreset.id) {
      const params = new URLSearchParams(searchParams);
      params.delete("service");
      setSearchParams(params, { replace: true });
    }
  }

  const exec = useMutation({
    mutationFn: async () => {
      const payload = preset.buildPayload(input);
      const res = await api.post<ExecuteResult>(
        "/api/agent/execute",
        { service: preset.service, method: preset.method, ...payload },
        { headers: { "X-Agent-Key": apiKey } }
      );
      return res;
    },
    onSuccess: (data) => {
      setError(null);
      setResult(data);
      onSuccess();
      const meta = data.meta ?? {};
      toast.success(`${meta.service ?? preset.label} via ${meta.protocol ?? "router"}`, {
        description: `${meta.latencyMs ?? "?"}ms · HTTP ${meta.statusCode ?? "?"}`,
      });
    },
    onError: (err) => {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "Execute failed");
    },
  });

  const oracle: OracleData | null =
    preset.id === "intelligence" && result?.result && typeof result.result === "object" && result.result !== null
      ? ((result.result as { data?: OracleData }).data ?? null)
      : null;

  return (
    <div className="card-surface rounded p-5">
      <div className="flex items-center gap-1.5 mb-3">
        <ShieldCheck className="w-3 h-3 text-muted-foreground" />
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Quick Try
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Calls <code className="font-mono text-foreground">/api/agent/execute</code> with{" "}
        <code className="font-mono text-foreground">X-Agent-Key</code>. Free services run directly. Paid services
        return a 402 challenge — your wallet must sign and retry (use the{" "}
        <a href={MPPX_SDK_URL} target="_blank" rel="noopener noreferrer" className="text-mpp-amber hover:opacity-80 underline-offset-2 hover:underline">mppx SDK</a>{" "}
        from your server).
      </p>

      {requestedSlug && catalogQuery.isLoading && (
        <div className="rounded p-2.5 border border-mpp-border bg-mpp-bg flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading catalog service…
        </div>
      )}
      {requestedSlug && catalogQuery.isError && (
        <div className="rounded p-2.5 border border-mpp-danger/30 bg-mpp-danger/5 mb-3 text-xs text-mpp-danger font-mono">
          Service "{requestedSlug}" not found in catalog. <Link to="/catalog" className="underline">Browse catalog →</Link>
        </div>
      )}
      {dynamicPreset && catalogQuery.data && (
        <div className="rounded p-3 border-l-2 border-mpp-amber bg-mpp-amber/5 mb-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-foreground font-semibold text-sm">{catalogQuery.data.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{catalogQuery.data.slug}</p>
            </div>
            <Link to="/catalog" className="text-[10px] font-mono text-mpp-amber hover:underline whitespace-nowrap">← back to catalog</Link>
          </div>
          {catalogQuery.data.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">{catalogQuery.data.description}</p>
          )}
          {stdioBlocked && (
            <div className="rounded p-2 border border-mpp-danger/30 bg-mpp-danger/5 text-[11px] text-mpp-danger font-mono">
              This is a stdio MCP server — install locally with your AI client (Claude Desktop, Cursor). Cannot be invoked through MPP32.
            </div>
          )}
        </div>
      )}

      {/* Preset picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPreset(p.id)}
            className={cn(
              "rounded border px-2.5 py-2 text-left transition-colors",
              presetId === p.id
                ? "border-mpp-amber/60 bg-mpp-amber/5"
                : "border-mpp-border hover:border-mpp-border/80 bg-mpp-bg"
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-foreground truncate">{p.label}</span>
              {p.paid ? (
                <span
                  className="font-mono text-[9px] text-mpp-amber bg-mpp-amber/10 border border-mpp-amber/30 px-1 py-0.5 rounded flex-shrink-0"
                  title="Requires wallet signature (USDC on Solana via x402)"
                >
                  PAID
                </span>
              ) : (
                <span className="font-mono text-[9px] text-mpp-success bg-mpp-success/10 border border-mpp-success/30 px-1 py-0.5 rounded flex-shrink-0">
                  FREE
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/80 mb-3 italic">{preset.description}</p>

      {preset.paid && (
        <div className="rounded p-2.5 border-l-2 border-mpp-amber/60 bg-mpp-amber/5 flex gap-2 mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-mpp-amber flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-mpp-amber font-mono uppercase tracking-wider">Paid:</span>{" "}
            From the browser this returns a 402 challenge. To complete the call, sign with your wallet using the{" "}
            <a href="https://github.com/wevm/mppx" target="_blank" rel="noopener noreferrer" className="text-mpp-amber hover:opacity-80 underline-offset-2 hover:underline">mppx SDK</a>{" "}
            from your server, or pick a FREE preset to test the key.
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={preset.defaultInput}
          className="flex-1 bg-mpp-bg border border-mpp-border rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors"
        />
        <button
          onClick={() => exec.mutate()}
          disabled={exec.isPending || !input.trim() || stdioBlocked}
          className="btn-amber px-4 py-2 rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
        >
          {exec.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
          {preset.paid ? "Execute (returns 402)" : "Execute"}
        </button>
      </div>

      {error && (
        <div className="rounded p-3 border border-mpp-danger/30 bg-mpp-danger/5 text-xs text-mpp-danger font-mono mb-2">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {/* Meta strip — honest settlement state */}
          <div className="flex flex-wrap gap-2 items-center text-[10px] font-mono">
            <span className="bg-mpp-bg border border-mpp-border rounded px-2 py-0.5 text-foreground">
              HTTP {result.meta?.statusCode ?? "?"}
            </span>
            <span className="bg-mpp-bg border border-mpp-border rounded px-2 py-0.5 text-mpp-amber uppercase">
              {result.meta?.protocol ?? "—"}
            </span>
            <span className="bg-mpp-bg border border-mpp-border rounded px-2 py-0.5 text-muted-foreground">
              {result.meta?.latencyMs ?? "?"}ms
            </span>
            <SettlementChip meta={result.meta} />
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRaw ? "Hide raw JSON" : "Show raw JSON"}
            </button>
          </div>

          {/* Rich Oracle viewer */}
          {oracle && !showRaw && <OraclePreview data={oracle} />}

          {/* Raw JSON viewer */}
          {(showRaw || !oracle) && (
            <pre className="bg-mpp-bg border border-mpp-border rounded p-3 text-[11px] font-mono text-foreground overflow-x-auto scrollbar-thin max-h-80 whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70 mt-3 font-mono">
        Session ID: {sessionId.slice(0, 18)}…
      </p>
    </div>
  );
}

function OraclePreview({ data }: { data: OracleData }) {
  const t = data.token ?? {};
  const md = data.marketData ?? {};
  const rug = data.rugRisk ?? {};
  const whales = data.whaleActivity ?? {};

  function fmtUsd(n: number | string | undefined) {
    const v = typeof n === "string" ? parseFloat(n) : n;
    if (v == null || isNaN(v as number)) return "—";
    if ((v as number) < 0.01) return `$${(v as number).toFixed(8)}`;
    if ((v as number) > 1_000_000) return `$${((v as number) / 1_000_000).toFixed(2)}M`;
    if ((v as number) > 1_000) return `$${((v as number) / 1_000).toFixed(2)}K`;
    return `$${(v as number).toFixed(4)}`;
  }

  return (
    <div className="bg-mpp-bg border border-mpp-border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-foreground">{t.symbol}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{t.name}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-mpp-amber text-lg font-semibold">{fmtUsd(t.priceUsd)}</p>
          {md.priceChange24h != null && (
            <p
              className={cn(
                "font-mono text-[11px]",
                md.priceChange24h >= 0 ? "text-mpp-success" : "text-mpp-danger"
              )}
            >
              {md.priceChange24h >= 0 ? "+" : ""}
              {Number(md.priceChange24h).toFixed(2)}% 24h
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ScorePill label="Alpha Score" value={`${data.alphaScore ?? "—"}/100`} accent="amber" />
        <ScorePill
          label="Rug Risk"
          value={rug.level ?? "—"}
          accent={rug.level === "low" ? "success" : rug.level === "high" ? "danger" : "amber"}
        />
        <ScorePill label="Pump 24h" value={`${data.pumpProbability24h ?? "—"}%`} accent="amber" />
        <ScorePill
          label="Whales"
          value={whales.level ?? "—"}
          accent={whales.level === "high" ? "amber" : "default"}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[11px] font-mono">
        <Stat label="Volume 24h" value={fmtUsd(md.volume24h)} />
        <Stat label="Liquidity" value={fmtUsd(md.liquidity)} />
        <Stat label="Market Cap" value={fmtUsd(md.marketCap)} />
        <Stat label="DEX" value={md.dexId ?? "—"} />
      </div>

      {data.summary && (
        <p className="text-[12px] text-foreground/90 leading-relaxed border-t border-mpp-border/50 pt-2">
          {data.summary}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground font-mono pt-1">
        Sources: DexScreener{data.coingeckoEnriched ? " + CoinGecko" : ""}
        {data.timestamp && ` · ${new Date(data.timestamp).toLocaleTimeString()}`}
      </p>
    </div>
  );
}

function ScorePill({ label, value, accent }: { label: string; value: string; accent: "amber" | "success" | "danger" | "default" }) {
  const colors: Record<string, string> = {
    amber: "border-mpp-amber/30 bg-mpp-amber/5 text-mpp-amber",
    success: "border-mpp-success/30 bg-mpp-success/5 text-mpp-success",
    danger: "border-mpp-danger/30 bg-mpp-danger/5 text-mpp-danger",
    default: "border-mpp-border bg-mpp-surface text-foreground",
  };
  return (
    <div className={cn("rounded border px-2.5 py-1.5", colors[accent])}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-80 mb-0.5">{label}</p>
      <p className="font-mono text-xs font-semibold capitalize">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium truncate">{value}</span>
    </div>
  );
}
