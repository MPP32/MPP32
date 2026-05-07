import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layers, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { ProjectCard, type SubmissionItem } from "./ProjectCard";

interface EcosystemGridProps {
  category: string | null;
}

function SkeletonCard() {
  return (
    <div className="card-surface border border-mpp-border rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded bg-mpp-border animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-28 bg-mpp-border rounded animate-pulse" />
          <div className="h-3 w-16 bg-mpp-border rounded animate-pulse" />
        </div>
      </div>
      <div className="space-y-2 flex-1">
        <div className="h-3 w-full bg-mpp-border rounded animate-pulse" />
        <div className="h-3 w-4/5 bg-mpp-border rounded animate-pulse" />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-mpp-border/50">
        <div className="h-3 w-24 bg-mpp-border rounded animate-pulse" />
        <div className="h-3 w-10 bg-mpp-border rounded animate-pulse" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-lg border border-mpp-border flex items-center justify-center mb-4">
        <Layers className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-foreground font-semibold mb-1">No services listed yet</p>
      <p className="text-muted-foreground text-sm mb-6">
        Be the first to submit your MPP service
      </p>
      <Link to="/build#submit">
        <button className="btn-amber inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold">
          Submit Your Project
          <ArrowRight className="w-4 h-4" />
        </button>
      </Link>
    </div>
  );
}

export function EcosystemGrid({ category }: EcosystemGridProps) {
  const url = category ? `/api/submissions?category=${category}` : "/api/submissions";

  const { data, isLoading } = useQuery({
    queryKey: ["submissions", category],
    queryFn: () => api.get<SubmissionItem[]>(url),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const items = (data ?? []).filter((item) => item.endpointUrl);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        items.map((item, index) => (
          <ProjectCard key={item.id} item={item} index={index} />
        ))
      )}
    </div>
  );
}
