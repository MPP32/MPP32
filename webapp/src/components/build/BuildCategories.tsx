import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/categories";

// Showcase a curated subset per group so the page stays scannable.
// The combobox on the submit form has the full 47 options.
const HIGHLIGHTS_PER_GROUP = 3;

export function BuildCategories() {
  const highlighted = CATEGORY_GROUPS.flatMap((group) =>
    CATEGORIES.filter((c) => c.group === group).slice(0, HIGHLIGHTS_PER_GROUP)
  );

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
            Any HTTP API, whether AI, data, utility, crypto, or anything in between, can be monetized through MPP32.
          </p>

          <div className="flex flex-wrap gap-3">
            {highlighted.map((cat) => (
              <span
                key={cat.value}
                className="border border-mpp-border bg-mpp-card rounded-full px-4 py-2 text-sm text-muted-foreground hover:border-mpp-amber/40 hover:text-foreground transition-colors duration-200 cursor-default"
              >
                {cat.label}
              </span>
            ))}
            <span className="border border-mpp-amber/30 bg-mpp-amber/5 rounded-full px-4 py-2 text-sm text-mpp-amber font-mono">
              +{CATEGORIES.length - highlighted.length} more
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
