import { useState } from "react";
import { ExternalLink, Twitter, Github, Star, Copy, Check, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryLabel, getCategoryGroup, type CategoryGroup } from "@/lib/categories";

export interface SubmissionItem {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  category: string;
  websiteUrl: string;
  endpointUrl: string | null;
  pricePerQuery: number | null;
  paymentAddress: string | null;
  creatorName: string;
  logoUrl: string | null;
  twitterHandle: string | null;
  githubUrl: string | null;
  status: string;
  queryCount: number;
  isVerified: boolean;
  createdAt: string;
}

// Per-group color styling for category badges. Keeps the palette cohesive even with 47 categories.
const GROUP_STYLES: Record<CategoryGroup, { border: string; text: string }> = {
  "AI & Machine Learning":    { border: "border-purple-500/30", text: "text-purple-400" },
  "Data & Intelligence":      { border: "border-cyan-500/30",   text: "text-cyan-400" },
  "Crypto / Web3":            { border: "border-yellow-500/30", text: "text-yellow-400" },
  "Utility":                  { border: "border-blue-500/30",   text: "text-blue-400" },
  "Business":                 { border: "border-pink-500/30",   text: "text-pink-400" },
  "Developer Tools":          { border: "border-green-500/30",  text: "text-green-400" },
  "Media & Entertainment":    { border: "border-orange-500/30", text: "text-orange-400" },
  "Other":                    { border: "border-gray-500/30",   text: "text-gray-400" },
};

function getCategoryStyle(value: string): { border: string; text: string; label: string } {
  const group = getCategoryGroup(value) ?? "Other";
  const style = GROUP_STYLES[group];
  return { ...style, label: getCategoryLabel(value) };
}

const LOGO_COLORS = [
  "bg-blue-900/60 text-blue-300",
  "bg-purple-900/60 text-purple-300",
  "bg-green-900/60 text-green-300",
  "bg-pink-900/60 text-pink-300",
  "bg-cyan-900/60 text-cyan-300",
  "bg-orange-900/60 text-orange-300",
];

function getLogoColor(name: string): string {
  const idx = name.charCodeAt(0) % LOGO_COLORS.length;
  return LOGO_COLORS[idx];
}

interface ProjectCardProps {
  item: SubmissionItem;
  index: number;
}

function CopyProxyButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const proxyUrl =
    (import.meta.env.VITE_BACKEND_URL || window.location.origin) +
    "/api/proxy/" +
    slug;

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(proxyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-mpp-amber transition-colors px-2 py-1 rounded border border-mpp-border hover:border-mpp-amber/30 bg-mpp-bg"
      title={`Copy proxy URL: ${proxyUrl}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-green-400" />
          <span className="text-green-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          Proxy URL
        </>
      )}
    </button>
  );
}

export function ProjectCard({ item, index }: ProjectCardProps) {
  const catStyle = getCategoryStyle(item.category);
  const hasProxy = item.endpointUrl !== null && item.paymentAddress !== null;

  return (
    <div
      className="card-surface border border-mpp-border rounded-lg p-5 hover:border-mpp-amber/30 transition-colors flex flex-col gap-3 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: "both" }}
    >
      {/* Top row: logo + name + category badge */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {item.logoUrl ? (
            <img
              src={item.logoUrl}
              alt={item.name}
              className="w-10 h-10 rounded object-cover"
            />
          ) : (
            <div className={cn("w-10 h-10 rounded flex items-center justify-center font-mono font-bold text-base select-none", getLogoColor(item.name))}>
              {item.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground font-semibold text-sm leading-tight">{item.name}</span>
            {item.status === "featured" ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-mpp-amber/40 text-mpp-amber text-[10px] font-mono uppercase tracking-wider">
                <Star className="w-2.5 h-2.5" />
                Featured
              </span>
            ) : null}
            {!item.isVerified ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-yellow-500/30 text-yellow-400 text-[10px] font-mono uppercase tracking-wider">
                <ShieldAlert className="w-2.5 h-2.5" />
                Unverified
              </span>
            ) : null}
          </div>
          <span className={cn("inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded border", catStyle.border, catStyle.text)}>
            {catStyle.label}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 flex-1">
        {item.shortDescription}
      </p>

      {/* Proxy URL row — only if service has endpoint + payment address configured */}
      {hasProxy ? (
        <div className="flex items-center gap-2 py-2 px-3 rounded bg-mpp-bg border border-mpp-border/60">
          <span className="font-mono text-[10px] text-muted-foreground/60 truncate flex-1">
            /api/proxy/{item.slug}
          </span>
          <CopyProxyButton slug={item.slug} />
        </div>
      ) : null}

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-mpp-border/50">
        <div className="flex items-center gap-3 min-w-0">
          {item.pricePerQuery !== null ? (
            <span className="font-mono text-xs text-mpp-amber shrink-0">
              {item.pricePerQuery} USD / query
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground truncate">
            by {item.creatorName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {item.twitterHandle ? (
            <a
              href={`https://twitter.com/${item.twitterHandle.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-3.5 h-3.5" />
            </a>
          ) : null}
          {item.githubUrl ? (
            <a
              href={item.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-3.5 h-3.5" />
            </a>
          ) : null}
          <a
            href={item.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-mpp-amber transition-colors"
            aria-label="Visit website"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
