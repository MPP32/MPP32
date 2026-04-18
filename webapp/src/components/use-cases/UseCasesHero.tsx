const personas = [
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
          Built for every layer<br />of the market
        </h1>

        <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mb-10 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
          From retail traders catching rugs before entry to autonomous AI agents querying intelligence at machine speed — MPP32's API surfaces on-chain truth for any workflow.
        </p>

        <div className="flex flex-wrap gap-2 animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          {personas.map((p) => (
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
    </section>
  );
}
