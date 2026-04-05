import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface SubmissionStats {
  total: number;
  categories: Record<string, number>;
}

export function EcosystemStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["submission-stats"],
    queryFn: () => api.get<SubmissionStats>("/api/submissions/stats"),
  });

  const categoryCount = data ? Object.keys(data.categories).length : 0;

  return (
    <div className="bg-mpp-surface border-b border-mpp-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-0 divide-x divide-mpp-border">

          {/* Stat 1: Total services */}
          <div className="px-6 py-4 flex items-center gap-3">
            {isLoading ? (
              <div className="h-5 w-8 bg-mpp-border rounded animate-pulse" />
            ) : (
              <span className="font-mono text-mpp-amber font-semibold text-lg leading-none">
                {data?.total ?? 0}
              </span>
            )}
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Listed Services
            </span>
          </div>

          <span className="hidden sm:block text-mpp-border px-2 select-none">|</span>

          {/* Stat 2: Categories */}
          <div className="px-6 py-4 flex items-center gap-3">
            {isLoading ? (
              <div className="h-5 w-8 bg-mpp-border rounded animate-pulse" />
            ) : (
              <span className="font-mono text-mpp-amber font-semibold text-lg leading-none">
                {categoryCount}
              </span>
            )}
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Categories Active
            </span>
          </div>

          <span className="hidden sm:block text-mpp-border px-2 select-none">|</span>

          {/* Stat 3: Static */}
          <div className="px-6 py-4 flex items-center gap-3">
            <span className="font-mono text-mpp-amber font-semibold text-lg leading-none">
              &lt; 200ms
            </span>
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Avg. Settlement
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
