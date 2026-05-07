import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  getCategoryLabel,
  type Category,
  type CategoryGroup,
} from "@/lib/categories";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Extra option prepended as "All", e.g. for filters. If provided, clicking it calls onChange("") or the given allValue. */
  includeAllOption?: boolean;
  allLabel?: string;
  allValue?: string;
  placeholder?: string;
  className?: string;
  /** When true, renders in a more compact filter-style trigger. */
  compact?: boolean;
}

export function CategoryCombobox({
  value,
  onChange,
  includeAllOption = false,
  allLabel = "All categories",
  allValue = "",
  placeholder = "Select a category",
  className,
  compact = false,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    value === "" || value === allValue
      ? includeAllOption
        ? allLabel
        : ""
      : getCategoryLabel(value);

  // Group the categories for display.
  const groupedCategories: Record<CategoryGroup, Category[]> = CATEGORY_GROUPS.reduce(
    (acc, g) => {
      acc[g] = CATEGORIES.filter((c) => c.group === g);
      return acc;
    },
    {} as Record<CategoryGroup, Category[]>
  );

  const triggerBase = compact
    ? "inline-flex items-center justify-between gap-2 rounded-full border border-mpp-border bg-mpp-card px-4 py-1.5 text-sm font-mono text-foreground hover:border-foreground/30 focus:outline-none focus:border-mpp-amber/50 transition-colors"
    : "w-full bg-mpp-card border border-mpp-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-mpp-amber/50 transition-colors text-sm flex items-center justify-between gap-2";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(triggerBase, className)}
        >
          <span
            className={cn(
              "truncate text-left",
              selectedLabel === "" ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {selectedLabel !== "" ? selectedLabel : placeholder}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 bg-mpp-card border-mpp-border w-[min(92vw,22rem)] max-w-[calc(100vw-2rem)]"
      >
        <Command
          className="bg-mpp-card"
          filter={(itemValue, search) => {
            // itemValue = slug; search against label text too.
            const cat = CATEGORIES.find((c) => c.value === itemValue);
            const haystack = [
              itemValue,
              cat?.label ?? "",
              cat?.group ?? "",
            ]
              .join(" ")
              .toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Search categories…"
            className="font-mono text-xs"
          />
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="text-muted-foreground text-xs py-4">
              No categories match.
            </CommandEmpty>

            {includeAllOption ? (
              <CommandGroup heading="Filter">
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onChange(allValue);
                    setOpen(false);
                  }}
                  className="data-[selected=true]:bg-mpp-amber/10 data-[selected=true]:text-foreground"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5 text-mpp-amber",
                      value === allValue || value === ""
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span className="text-sm">{allLabel}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}

            {CATEGORY_GROUPS.map((group) => {
              const items = groupedCategories[group];
              if (items.length === 0) return null;
              return (
                <CommandGroup key={group} heading={group}>
                  {items.map((cat) => (
                    <CommandItem
                      key={cat.value}
                      value={cat.value}
                      onSelect={(current) => {
                        onChange(current);
                        setOpen(false);
                      }}
                      className="data-[selected=true]:bg-mpp-amber/10 data-[selected=true]:text-foreground"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5 text-mpp-amber",
                          value === cat.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-sm">{cat.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
