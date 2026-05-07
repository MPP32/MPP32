const flowNodes = [
  { label: "Caller sends request", sub: "POST /api/proxy/slug", highlight: false },
  { label: "MPP32 issues 402", sub: "payment challenge", highlight: true },
  { label: "Caller pays", sub: "Tempo or Solana to your wallet", highlight: false },
  { label: "Payment verified", sub: "on-chain proof", highlight: false },
  { label: "Request forwarded", sub: "to your real endpoint", highlight: false },
  { label: "Response returned", sub: "to caller", highlight: false },
];

const facts = [
  {
    index: "01",
    text: "Your endpoint URL stays private. Callers only see the proxy URL.",
  },
  {
    index: "02",
    text: "Payment is verified on-chain before any request is forwarded",
  },
  {
    index: "03",
    text: "No custody: funds settle instantly to your address",
  },
];

export function BuildProxyExplainer() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
          Hosted Proxy
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 max-w-xl">
          Zero-code payment gating for any API
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl mb-12">
          Provide your endpoint URL once. MPP32 wraps it with an HTTP 402 payment gate. Callers interact with the proxy, and your origin stays hidden and only receives verified, paid requests.
        </p>

        {/* Flow diagram */}
        <div className="overflow-x-auto scrollbar-thin pb-4 mb-12">
          <div className="flex items-stretch gap-0 min-w-max">
            {flowNodes.map((node, i) => (
              <div key={node.label} className="flex items-center">
                <div
                  className={`flex flex-col justify-center px-4 py-3 rounded border text-center min-w-[120px] ${
                    node.highlight
                      ? "bg-mpp-amber/10 border-mpp-amber/40"
                      : "bg-mpp-card border-mpp-border"
                  }`}
                >
                  <span
                    className={`font-mono text-xs font-semibold leading-tight ${
                      node.highlight ? "text-mpp-amber" : "text-foreground"
                    }`}
                  >
                    {node.label}
                  </span>
                  <span className="text-muted-foreground text-xs mt-0.5">
                    {node.sub}
                  </span>
                </div>
                {i < flowNodes.length - 1 ? (
                  <span className="text-muted-foreground text-sm px-2 select-none">
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Three facts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-mpp-border rounded-lg overflow-hidden">
          {facts.map((fact) => (
            <div key={fact.index} className="bg-mpp-card px-6 py-6">
              <span className="font-mono text-mpp-amber/40 text-2xl font-semibold block mb-3 leading-none">
                {fact.index}
              </span>
              <p className="text-foreground text-sm leading-relaxed">{fact.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
