import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Zap,
  Shield,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Network,
  Activity,
  Code2,
  CircleDot,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const protocols = [
  {
    name: "Tempo",
    type: "Payment (HTTP 402)",
    network: "Ethereum L2",
    currency: "pathUSD",
    speed: "<1s",
    bestFor: "High-frequency micropayments, EVM-native agents",
  },
  {
    name: "x402",
    type: "Payment (HTTP 402)",
    network: "Solana Mainnet",
    currency: "USDC",
    speed: "<400ms",
    bestFor: "Solana-native agents, stablecoin payments",
  },
  {
    name: "ACP",
    type: "Commerce (Sessions)",
    network: "Database-backed",
    currency: "USD",
    speed: "Instant",
    bestFor: "Checkout sessions, cart operations",
  },
  {
    name: "AP2",
    type: "Authorization (Credentials)",
    network: "Protocol-agnostic",
    currency: "Verifiable Credentials",
    speed: "Instant",
    bestFor: "W3C VC agents, enterprise compliance",
  },
  {
    name: "AGTP",
    type: "Identity (Transport)",
    network: "Protocol-agnostic",
    currency: "Agent Identity Tokens",
    speed: "Instant",
    bestFor: "Agent identity, delegated authority",
  },
];

const steps = [
  {
    num: "01",
    title: "Create Session",
    desc: "Register agent identity, get a rate-limited API key. Optional Solana wallet for protocol routing.",
    icon: Wallet,
  },
  {
    num: "02",
    title: "Get Quote",
    desc: "Compare pricing across all 5 protocols. Quotes are informational — every paid call is settled by your own wallet, never by MPP32.",
    icon: BarChart3,
  },
  {
    num: "03",
    title: "Sign &amp; Execute",
    desc: "MPP32 forwards 402 challenges from upstream services. Your wallet signs the USDC (x402) or pathUSD (Tempo) payment; the facilitator verifies on-chain.",
    icon: Zap,
  },
  {
    num: "04",
    title: "Track Settlements",
    desc: "Per-call analytics with on-chain settlement signatures (Solscan-linked). Settled volume = sum of payments verified by the facilitator.",
    icon: Activity,
  },
];

interface ComparisonRow {
  feature: string;
  mpp32: { text: string; status: "yes" | "no" | "partial" };
  grok: { text: string; status: "yes" | "no" | "partial" };
  geminiExchange: { text: string; status: "yes" | "no" | "partial" };
  chatgpt: { text: string; status: "yes" | "no" | "partial" };
  googleGemini: { text: string; status: "yes" | "no" | "partial" };
}

const comparisonData: ComparisonRow[] = [
  {
    feature: "Cross-protocol payments",
    mpp32: { text: "YES (5 protocols)", status: "yes" },
    grok: { text: "No", status: "no" },
    geminiExchange: { text: "Exchange only", status: "partial" },
    chatgpt: { text: "No", status: "no" },
    googleGemini: { text: "Enterprise only", status: "partial" },
  },
  {
    feature: "Smart protocol routing",
    mpp32: { text: "YES (auto-optimized)", status: "yes" },
    grok: { text: "No", status: "no" },
    geminiExchange: { text: "No", status: "no" },
    chatgpt: { text: "No", status: "no" },
    googleGemini: { text: "No", status: "no" },
  },
  {
    feature: "Non-custodial settlement",
    mpp32: { text: "YES (wallet pays direct)", status: "yes" },
    grok: { text: "Wallet on Base", status: "partial" },
    geminiExchange: { text: "Exchange custody", status: "no" },
    chatgpt: { text: "No", status: "no" },
    googleGemini: { text: "Pay.sh custody", status: "no" },
  },
  {
    feature: "MCP integration",
    mpp32: { text: "YES (6 tools)", status: "yes" },
    grok: { text: "No", status: "no" },
    geminiExchange: { text: "MCP trading", status: "partial" },
    chatgpt: { text: "MCP adopted", status: "partial" },
    googleGemini: { text: "A2A protocol", status: "partial" },
  },
  {
    feature: "Agent sessions",
    mpp32: { text: "YES (tracked)", status: "yes" },
    grok: { text: "Wallet on Base", status: "partial" },
    geminiExchange: { text: "Exchange accounts", status: "partial" },
    chatgpt: { text: "No", status: "no" },
    googleGemini: { text: "Pay.sh", status: "partial" },
  },
  {
    feature: "Real-time intelligence",
    mpp32: { text: "YES (8-dimension oracle)", status: "yes" },
    grok: { text: "Social scraping", status: "partial" },
    geminiExchange: { text: "Market data", status: "partial" },
    chatgpt: { text: "Pulse alerts", status: "partial" },
    googleGemini: { text: "Vertex AI", status: "partial" },
  },
  {
    feature: "Settlement speed",
    mpp32: { text: "<400ms Solana", status: "yes" },
    grok: { text: "N/A", status: "no" },
    geminiExchange: { text: "Exchange speed", status: "partial" },
    chatgpt: { text: "N/A", status: "no" },
    googleGemini: { text: "Enterprise", status: "partial" },
  },
  {
    feature: "Open marketplace",
    mpp32: { text: "YES (any API)", status: "yes" },
    grok: { text: "No", status: "no" },
    geminiExchange: { text: "Gemini only", status: "partial" },
    chatgpt: { text: "Plugin store", status: "partial" },
    googleGemini: { text: "Cloud marketplace", status: "partial" },
  },
];

const codeExamples = {
  "Create Session": `const session = await fetch('https://mpp32.org/api/agent/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agentId: 'my-trading-bot',
    walletAddress: '9Pa8yUe...', // optional, for protocol routing
    preferredProtocol: 'x402'
  })
});
// Returns: { apiKey, custodyDisclosure, ... }
// MPP32 NEVER spends on your behalf — paid calls are settled by your own wallet.`,

  "Sign & Execute": `// 1. First call — no payment header. Returns 402 with the challenge.
const challenge = await fetch('https://mpp32.org/api/agent/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Agent-Key': key },
  body: JSON.stringify({ service: 'intelligence', body: { token: 'SOL' } })
});
// challenge.error.challenge.headers contains the x402 Payment-Required header.

// 2. Sign with the mppx SDK (signs USDC SPL transfer with YOUR wallet):
const { paymentHeader } = await mppx.payX402(challenge);

// 3. Retry with X-Payment header. Facilitator verifies & settles on-chain.
const result = await fetch('https://mpp32.org/api/agent/execute', {
  method: 'POST',
  headers: { 'X-Agent-Key': key, 'X-Payment': paymentHeader },
  body: JSON.stringify({ service: 'intelligence', body: { token: 'SOL' } })
});
// meta.settled === true, meta.settlementTxSignature → solscan.io/tx/...`,

  "MCP Integration": `{
  "mcpServers": {
    "mpp32": {
      "command": "npx",
      "args": ["mpp32-mcp-server"],
      "env": {
        "MPP32_AGENT_KEY": "mpp32_agent_…",
        "MPP32_SOLANA_PRIVATE_KEY": "your-solana-key (optional, for paid services)"
      }
    }
  }
}
// Get MPP32_AGENT_KEY at mpp32.org/agent-console — every call shows up
// in your dashboard. SOLANA key is only needed for paid services.`,
};

type CodeTab = keyof typeof codeExamples;
const codeTabs: CodeTab[] = ["Create Session", "Sign & Execute", "MCP Integration"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function StatusCell({ text, status }: { text: string; status: "yes" | "no" | "partial" }) {
  if (status === "yes") {
    return (
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-mpp-success flex-shrink-0" />
        <span className="text-mpp-success font-medium">{text}</span>
      </span>
    );
  }
  if (status === "no") {
    return (
      <span className="flex items-center gap-1.5">
        <XCircle className="w-3.5 h-3.5 text-mpp-danger flex-shrink-0" />
        <span className="text-mpp-danger">{text}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <CircleDot className="w-3.5 h-3.5 text-mpp-amber flex-shrink-0" />
      <span className="text-mpp-amber">{text}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats types                                                        */
/* ------------------------------------------------------------------ */

interface AgentStats {
  activeSessions: number;
  totalRequests: number;
  settledRequests: number;
  settledVolumeUsd: number;
  supportedProtocols: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AgentHub() {
  const [activeTab, setActiveTab] = useState<CodeTab>("Create Session");

  const { data: stats } = useQuery({
    queryKey: ["agent-stats"],
    queryFn: () => api.get<AgentStats>("/api/agent/stats"),
  });

  return (
    <div className="min-h-screen bg-mpp-bg">

      {/* ============================================================ */}
      {/*  1. HERO                                                      */}
      {/* ============================================================ */}
      <section className="border-b border-mpp-border py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-5">
            Cross-Protocol Agent Commerce
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground mb-6 leading-tight">
            The Only AI Agent Plugin That Routes Payments Through 5 Protocols
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-3xl mx-auto mb-8">
            No other platform — not Grok, not Gemini, not ChatGPT — offers unified
            cross-protocol commerce with non-custodial settlement. Create an agent session,
            get smart protocol routing, and on-chain settlement receipts.{" "}
            <span className="text-foreground">Your wallet pays providers directly — MPP32 never holds your funds.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Link to="/agent-console">
              <button className="btn-amber flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold w-full sm:w-auto justify-center">
                Create Agent Session
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/catalog">
              <button className="border border-mpp-amber/40 bg-mpp-amber/5 text-mpp-amber hover:bg-mpp-amber/10 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold w-full sm:w-auto justify-center">
                Browse 4,000+ Services
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/docs">
              <button className="border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm w-full sm:w-auto justify-center">
                View API Docs
              </button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["Tempo", "x402", "ACP", "AP2", "AGTP"].map((p) => (
              <span
                key={p}
                className="font-mono text-[11px] text-mpp-amber border border-mpp-amber/20 bg-mpp-amber/5 rounded px-2.5 py-1"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  2. HOW IT WORKS                                              */}
      {/* ============================================================ */}
      <section className="border-b border-mpp-border py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3 text-center">
            How It Works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-12 text-center">
            Four Steps to Cross-Protocol Commerce
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="card-surface rounded p-6 relative group">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-mpp-amber text-xs">{step.num}</span>
                    <Icon className="w-4 h-4 text-mpp-amber" />
                  </div>
                  <h3 className="text-foreground font-semibold text-sm mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  3. COMPETITIVE COMPARISON                                    */}
      {/* ============================================================ */}
      <section className="border-b border-mpp-border py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3 text-center">
            Why MPP32
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4 text-center">
            Competitive Comparison
          </h2>
          <p className="text-muted-foreground text-sm text-center mb-10 max-w-2xl mx-auto">
            No other agent commerce platform supports all five payment protocols with
            native token utility, smart routing, and self-custody settlement on every call.
          </p>
          <div className="card-surface rounded overflow-hidden overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-mpp-border">
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-[180px]">
                    Feature
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-mpp-amber uppercase tracking-wider">
                    MPP32 Agent
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Grok
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Gemini Exchange
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    ChatGPT
                  </th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Google / Gemini AI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mpp-border">
                {comparisonData.map((row) => (
                  <tr key={row.feature} className="hover:bg-mpp-card/50 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium text-xs">
                      {row.feature}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusCell {...row.mpp32} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusCell {...row.grok} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusCell {...row.geminiExchange} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusCell {...row.chatgpt} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <StatusCell {...row.googleGemini} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  4. PROTOCOL SELECTION                                        */}
      {/* ============================================================ */}
      <section className="border-b border-mpp-border py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3 text-center">
            Protocol Layer
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4 text-center">
            5 Protocols, 1 Plugin
          </h2>
          <p className="text-muted-foreground text-sm text-center mb-10 max-w-2xl mx-auto">
            Smart routing selects the optimal protocol for each transaction based on
            speed, cost, and network conditions.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((proto) => (
              <div key={proto.name} className="card-surface rounded p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-mpp-amber" />
                    <span className="text-foreground font-semibold text-sm">{proto.name}</span>
                  </div>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-mpp-success" />
                    <span className="font-mono text-[10px] text-mpp-success">Enabled</span>
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-mpp-border/50">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground font-mono text-[11px]">{proto.type}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-mpp-border/50">
                    <span className="text-muted-foreground">Network</span>
                    <span className="text-foreground">{proto.network}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-mpp-border/50">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="text-foreground">{proto.currency}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-mpp-border/50">
                    <span className="text-muted-foreground">Speed</span>
                    <span className="text-mpp-amber font-mono text-[11px]">{proto.speed}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Best for</span>
                    <span className="text-foreground text-right max-w-[180px]">{proto.bestFor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  5. CODE EXAMPLES                                             */}
      {/* ============================================================ */}
      <section className="border-b border-mpp-border py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 justify-center mb-3">
            <Code2 className="w-4 h-4 text-mpp-amber" />
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest">
              Integration
            </p>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-10 text-center">
            Ship in Minutes
          </h2>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-mpp-border mb-0">
            {codeTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 font-mono text-xs transition-colors relative ${
                  activeTab === tab
                    ? "text-mpp-amber"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-mpp-amber" />
                )}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="card-surface rounded-t-none rounded-b p-5">
            <pre className="text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">
              {codeExamples[activeTab]}
            </pre>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  6. LIVE STATS                                                */}
      {/* ============================================================ */}
      <section className="border-b border-mpp-border py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-3 text-center">
            Platform Metrics
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-10 text-center">
            Agent Network Stats
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Active Sessions",
                value: stats?.activeSessions != null ? String(stats.activeSessions) : "\u2014",
                icon: Shield,
              },
              {
                label: "Total Requests",
                value: stats?.totalRequests != null ? stats.totalRequests.toLocaleString() : "\u2014",
                icon: Activity,
              },
              {
                label: "Settled On-Chain",
                value: stats?.settledVolumeUsd != null ? `$${stats.settledVolumeUsd.toFixed(2)}` : "\u2014",
                icon: BarChart3,
              },
              {
                label: "Supported Protocols",
                value: stats?.supportedProtocols != null ? String(stats.supportedProtocols) : "\u2014",
                icon: Network,
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="card-surface rounded p-6 text-center">
                  <Icon className="w-5 h-5 text-mpp-amber mx-auto mb-3" />
                  <p className="font-mono text-mpp-amber text-2xl font-semibold mb-1">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground text-xs">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  8. BOTTOM CTA                                                */}
      {/* ============================================================ */}
      <section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Clock className="w-6 h-6 text-mpp-amber mx-auto mb-4" />
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
            Start Building
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-xl mx-auto mb-8">
            Create an agent session and start calling services across 5 settlement protocols with
            a single integration. Your wallet pays providers directly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/agent-console">
              <button className="btn-amber flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold w-full sm:w-auto justify-center">
                Create Agent Session
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link to="/docs">
              <button className="border border-mpp-border text-foreground hover:border-mpp-amber/40 transition-colors flex items-center gap-2 px-6 py-2.5 rounded text-sm w-full sm:w-auto justify-center">
                Read the Docs
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
