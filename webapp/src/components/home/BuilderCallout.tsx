import { Link } from "react-router-dom";

const providerFeatures = [
  {
    num: "01",
    title: "100% revenue, zero platform cut",
    desc: "Set any price in USD. Every payment settles directly to your wallet. MPP32 takes nothing. No fees, no holdbacks, no revenue share.",
  },
  {
    num: "02",
    title: "Full proxy infrastructure",
    desc: "Your API stays where it is. MPP32 proxies every request to your endpoint with payment verification, body size limits, upstream retries for transient failures, and idempotency keys to prevent double charging.",
  },
  {
    num: "03",
    title: "5-protocol payment verification",
    desc: "Every call is verified before it reaches your server. MPP32 handles the full payment flow across Tempo, x402, ACP, AP2, and AGTP. Callers pay before they consume.",
  },
  {
    num: "04",
    title: "Analytics and provider dashboard",
    desc: "Track every request in real time. Query counts, success rates, latency percentiles, revenue totals, and error breakdowns. Update your pricing, endpoint URL, or description at any time from the management console.",
  },
  {
    num: "05",
    title: "Global agent and developer discovery",
    desc: "Your service is listed in the MPP32 Ecosystem the moment you register. Indexed by category. Browsable by agents through the MCP server and by developers through the API and marketplace.",
  },
  {
    num: "06",
    title: "MCP server for AI agents",
    desc: "Agents discover and pay for your service through the MPP32 MCP server. One install command gives any agent access to every service in the ecosystem across all 5 protocols, including yours.",
  },
  {
    num: "07",
    title: "Rate limiting and DDoS protection",
    desc: "Production grade rate limiting protects your upstream from abuse. Request throttling, concurrent connection limits, and structured logging on every call. Your endpoint only sees clean, verified traffic.",
  },
  {
    num: "08",
    title: "No code changes required",
    desc: "If your service has an HTTP endpoint that returns data, it works with MPP32. No SDK integration needed on your side. No middleware. No webhook handlers. Submit the URL and you are live.",
  },
];

export function BuilderCallout() {
  return (
    <section className="border-y border-mpp-border bg-mpp-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">

        {/* Header row with proof badge */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
              Universal Proxy
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              One integration. Five protocols. Every agent can pay.
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              Any HTTP endpoint that returns data can be monetized through MPP32. Token scanners, price oracles, sentiment feeds, trading signals. Register your endpoint, set your price, and MPP32 handles protocol translation, payment verification, and settlement across all 5 protocols automatically.
            </p>
          </div>
          {/* "Proven by us" badge */}
          <div className="shrink-0 card-surface border border-mpp-amber/20 rounded-lg px-5 py-4 bg-mpp-amber/5 max-w-[280px]">
            <p className="font-mono text-mpp-amber text-[10px] uppercase tracking-widest mb-1">Proven by MPP32</p>
            <p className="text-foreground text-sm font-semibold mb-1">We run our own Oracle on this same infrastructure.</p>
            <p className="text-muted-foreground text-xs leading-relaxed">The MPP32 Intelligence API serves production traffic on the same proxy and payment infrastructure available to every provider.</p>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {providerFeatures.map((f) => (
            <div key={f.num} className="card-surface border border-mpp-border rounded-lg p-6 hover:border-mpp-amber/30 transition-colors">
              <p className="font-mono text-mpp-amber text-xs mb-4">{f.num}</p>
              <p className="text-foreground font-semibold text-sm mb-2">{f.title}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Link to="/build">
            <button className="btn-amber px-6 py-2.5 rounded text-sm font-semibold">
              Start Building
            </button>
          </Link>
          <Link to="/ecosystem" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            Browse the ecosystem →
          </Link>
        </div>
      </div>
    </section>
  );
}
