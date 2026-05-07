const providerPersonas = [
  { label: "Data API", anchor: "#data-api" },
  { label: "Intelligence API", anchor: "#intelligence-api" },
  { label: "Model Serving", anchor: "#model-serving" },
  { label: "Infrastructure", anchor: "#infra-services" },
  { label: "SaaS Monetization", anchor: "#saas-monetization" },
  { label: "Any HTTP Endpoint", anchor: "#any-http" },
];

const consumerPersonas = [
  { label: "Retail Trader", anchor: "#retail" },
  { label: "Speed Trader", anchor: "#speed" },
  { label: "Sniper Bot", anchor: "#sniper" },
  { label: "AI Agent", anchor: "#ai-agent" },
  { label: "Portfolio Monitor", anchor: "#portfolio" },
  { label: "DeFi Developer", anchor: "#developer" },
];

export function UseCasesHero() {
  return (
    <section className="pt-24 pb-16 border-b border-mpp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-5 animate-fade-in">
          Use Cases
        </p>

        <h1 className="font-display text-5xl lg:text-6xl font-semibold text-foreground leading-tight max-w-3xl mb-5 animate-fade-in-up">
          Monetize your API.<br />Query ours.
        </h1>

        <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-10 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          MPP32 serves two audiences. API providers register any HTTP endpoint and earn per query from agents and developers worldwide. Data consumers use the MPP32 Oracle for on-chain Solana intelligence. Both sides pay through any of 5 supported protocols: Tempo, x402, AP2, ACP, and AGTP.
        </p>

        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">API Providers</p>
            <div className="flex flex-wrap gap-2">
              {providerPersonas.map((p) => (
                <a
                  key={p.anchor}
                  href={p.anchor}
                  className="font-mono text-xs text-muted-foreground border border-mpp-amber/30 bg-mpp-amber/5 px-3.5 py-1.5 rounded-full hover:border-mpp-amber hover:text-mpp-amber transition-all duration-200"
                >
                  {p.label}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Oracle Consumers</p>
            <div className="flex flex-wrap gap-2">
              {consumerPersonas.map((p) => (
                <a
                  key={p.anchor}
                  href={p.anchor}
                  className="font-mono text-xs text-muted-foreground border border-mpp-border px-3.5 py-1.5 rounded-full hover:border-mpp-amber hover:text-mpp-amber transition-all duration-200"
                >
                  {p.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
