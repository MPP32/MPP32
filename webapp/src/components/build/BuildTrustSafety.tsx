const logLines = [
  { time: "00:00.000", text: "Caller hits proxy endpoint", highlight: false },
  { time: "00:00.001", text: "402 challenge issued — payment required", highlight: false },
  { time: "00:00.147", text: "On-chain Tempo payment verified", highlight: true },
  { time: "00:00.148", text: "Request forwarded to your endpoint (origin hidden)", highlight: false },
  { time: "00:00.196", text: "Response returned to caller", highlight: false },
  { time: "00:00.197", text: "queryCount +1, lastQueriedAt updated", highlight: false },
];

const trustFacts = [
  {
    title: "Non-custodial",
    body: "We never hold your funds. The payment challenge specifies your wallet as recipient — we only verify it happened on-chain.",
  },
  {
    title: "Endpoint privacy",
    body: "Your real endpoint URL is stored server-side only. Callers interact with the proxy URL and never learn your origin.",
  },
  {
    title: "Auditable protocol",
    body: "MPP is open-source. Every payment challenge and verification is on-chain and independently verifiable by anyone.",
  },
  {
    title: "Builder in control",
    body: "Your proxy URL and payment address are yours. Remove your listing or change your endpoint anytime — just reach out and it's done same day.",
  },
];

export function BuildTrustSafety() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
          Security
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-12 max-w-2xl">
          Built for production. Non-custodial by design.
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left: terminal audit trail */}
          <div className="bg-[#0a0a0a] border border-mpp-border rounded-lg overflow-hidden">
            {/* Terminal title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-mpp-border bg-[#0d0d0d]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="font-mono text-xs text-muted-foreground ml-2">
                proxy-audit.log
              </span>
            </div>
            {/* Log lines */}
            <div className="p-5 space-y-2">
              {logLines.map((line, i) => (
                <div key={i} className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-muted-foreground/50 shrink-0 tabular-nums">
                    [{line.time}]
                  </span>
                  <span
                    className={`font-mono text-xs leading-relaxed ${
                      line.highlight ? "text-mpp-amber" : "text-foreground/70"
                    }`}
                  >
                    {line.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: trust facts */}
          <div className="space-y-0 divide-y divide-mpp-border border border-mpp-border rounded-lg overflow-hidden">
            {trustFacts.map((fact) => (
              <div key={fact.title} className="bg-mpp-card px-6 py-5">
                <p className="font-mono text-xs text-mpp-amber uppercase tracking-widest mb-1.5">
                  {fact.title}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {fact.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
