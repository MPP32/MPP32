import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: null, label: "All" },
  { value: "token-scanner", label: "Token Scanner" },
  { value: "price-oracle", label: "Price Oracle" },
  { value: "sentiment-analysis", label: "Sentiment" },
  { value: "data-feed", label: "Data Feed" },
  { value: "trading-signal", label: "Trading Signal" },
  { value: "nft-intelligence", label: "NFT Intel" },
  { value: "defi-analytics", label: "DeFi Analytics" },
  { value: "other", label: "Other" },
] as const;

interface EcosystemFiltersProps {
  activeCategory: string | null;
  onSelect: (cat: string | null) => void;
}

export function EcosystemFilters({ activeCategory, onSelect }: EcosystemFiltersProps) {
  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      <div className="flex gap-2 min-w-max">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.label}
              onClick={() => onSelect(cat.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-mono transition-colors cursor-pointer whitespace-nowrap",
                isActive
                  ? "bg-mpp-amber text-mpp-bg font-semibold"
                  : "border border-mpp-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
