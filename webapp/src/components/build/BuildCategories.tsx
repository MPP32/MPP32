const categories = [
  "Token Scanner",
  "Price Oracle",
  "Sentiment Analysis",
  "Data Feed",
  "Trading Signal",
  "NFT Intelligence",
  "DeFi Analytics",
  "Other",
];

export function BuildCategories() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="font-mono text-mpp-amber text-xs uppercase tracking-widest mb-4">
            Service Types
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-3">
            What can you build?
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed mb-10">
            Any service with an HTTP endpoint can be monetized through MPP32.
          </p>

          <div className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <span
                key={cat}
                className="border border-mpp-border bg-mpp-card rounded-full px-4 py-2 text-sm text-muted-foreground hover:border-mpp-amber/40 hover:text-foreground transition-colors duration-200 cursor-default"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
