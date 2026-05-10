import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

interface StoredQuery {
  queriedAt: string;
  inputToken: string;
  alphaScore?: number;
  rugRisk?: { score: number; level: string; factors: string[] };
  pumpProbability24h?: number;
  token?: { symbol: string };
}

export default function Dashboard() {
  const [queries, setQueries] = useState<StoredQuery[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mpp32_queries");
      if (raw) setQueries(JSON.parse(raw));
    } catch {
      setQueries([]);
    }
  }, []);

  const avgAlpha = queries.length
    ? Math.round(queries.reduce((s, q) => s + (q.alphaScore ?? 0), 0) / queries.length)
    : null;

  return (
    <div className="min-h-screen bg-mpp-bg">
      {/* Top nav */}
      <header className="border-b border-mpp-border bg-mpp-surface sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-mpp-amber text-sm leading-none">■</span>
              <span className="font-display text-base font-semibold text-foreground">MPP32</span>
            </Link>
            <div className="hidden sm:block w-px h-4 bg-mpp-border" />
            <span className="hidden sm:block text-muted-foreground text-xs font-mono">Query History</span>
          </div>
          <Link to="/playground">
            <button className="btn-amber flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-semibold">
              New Query
            </button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-1">Query History</h1>
          <p className="text-muted-foreground text-sm">Your recent Oracle Playground queries, stored locally in your browser. For agent session management, see the <Link to="/agent-console" className="text-mpp-amber hover:opacity-80 underline-offset-2 hover:underline">Agent Console</Link>.</p>
        </div>

        {queries.length === 0 ? (
          // Empty state
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-surface rounded p-12 flex flex-col items-center justify-center text-center">
              <p className="text-muted-foreground text-sm mb-2">No queries yet.</p>
              <p className="text-muted-foreground text-xs mb-6">Run your first analysis from the playground.</p>
              <Link to="/playground">
                <button className="btn-amber px-5 py-2 rounded text-sm font-semibold">
                  Open Playground
                </button>
              </Link>
            </div>
            <div className="card-surface rounded p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-mpp-amber" />
                <p className="text-foreground font-semibold text-sm">API Configuration</p>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed mb-4">
                MPP32 uses wallet-based authentication via the Machine Payments Protocol. No API keys needed.
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1.5 border-b border-mpp-border/50">
                  <span className="text-muted-foreground">Endpoint</span>
                  <span className="text-foreground">api.mpp32.io</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-mpp-border/50">
                  <span className="text-muted-foreground">Protocol</span>
                  <span className="text-foreground">MPP v1</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-mpp-border/50">
                  <span className="text-muted-foreground">Network</span>
                  <span className="text-foreground">Solana</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Price/Query</span>
                  <span className="text-mpp-amber">$0.008</span>
                </div>
              </div>
              <Link to="/docs" className="mt-4 block text-mpp-amber text-xs font-mono hover:underline">
                View API Reference →
              </Link>
            </div>
          </div>
        ) : (
          // With data
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Queries", value: String(queries.length) },
                { label: "Avg Alpha Score", value: avgAlpha != null ? String(avgAlpha) : "—" },
                { label: "This Session", value: String(queries.length) },
                { label: "Cost / Query", value: "$0.008" },
              ].map((s) => (
                <div key={s.label} className="card-surface rounded p-5">
                  <p className="font-mono text-mpp-amber text-xl font-medium mb-1">{s.value}</p>
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Queries table */}
            <div className="card-surface rounded overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-mpp-border">
                <p className="text-foreground font-semibold text-sm">Recent Queries</p>
                <Link to="/playground" className="text-mpp-amber text-xs font-mono hover:underline">
                  New Query →
                </Link>
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mpp-border">
                      {["Token", "Alpha Score", "Rug Risk", "Pump Prob", "Date"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mpp-border">
                    {queries.map((q, i) => {
                      const alpha = q.alphaScore ?? 0;
                      const rug = q.rugRisk?.level ?? "—";
                      const pump = q.pumpProbability24h ?? 0;
                      const date = new Date(q.queriedAt).toLocaleString();
                      const symbol = q.token?.symbol ?? q.inputToken?.toUpperCase() ?? "—";
                      return (
                        <tr key={i} className="hover:bg-mpp-card transition-colors">
                          <td className="px-5 py-3 text-foreground font-semibold">{symbol}</td>
                          <td className="px-5 py-3 font-mono text-mpp-amber">{alpha}</td>
                          <td className="px-5 py-3 text-muted-foreground capitalize">{rug}</td>
                          <td className="px-5 py-3 font-mono text-muted-foreground">{pump > 0 ? `${Math.round(pump)}%` : "—"}</td>
                          <td className="px-5 py-3 text-muted-foreground text-xs">{date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* API config */}
            <div className="mt-6 card-surface rounded p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-mpp-amber" />
                <p className="text-foreground font-semibold text-sm">API Configuration</p>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed mb-4">
                To query programmatically, use the mppx SDK. MPP32 uses wallet-based authentication. No API keys required.
              </p>
              <div className="card-surface-2 rounded p-4">
                <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre">{`import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

Mppx.create({ methods: [tempo({ account: privateKeyToAccount(process.env.PRIVATE_KEY) })] })

const res = await fetch('https://mpp32.org/api/intelligence', {
  method: 'POST',
  body: JSON.stringify({ token: 'NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump' })
})
const { data } = await res.json()`}</pre>
              </div>
              <Link to="/docs" className="mt-4 block text-mpp-amber text-xs font-mono hover:underline">
                Full API Reference →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
