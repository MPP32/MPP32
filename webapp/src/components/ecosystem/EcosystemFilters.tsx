import { CategoryCombobox } from "@/components/build/CategoryCombobox";

interface EcosystemFiltersProps {
  activeCategory: string | null;
  onSelect: (cat: string | null) => void;
}

export function EcosystemFilters({ activeCategory, onSelect }: EcosystemFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Filter by category
      </span>
      <CategoryCombobox
        value={activeCategory ?? ""}
        onChange={(v) => onSelect(v === "" ? null : v)}
        includeAllOption
        allLabel="All categories"
        allValue=""
        placeholder="All categories"
        compact
      />
    </div>
  );
}
