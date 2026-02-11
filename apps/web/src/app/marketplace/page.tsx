"use client";

import { useState, useCallback } from "react";
import {
  Store,
  Star,
  Download,
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ─── Types ─── */
interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  downloads: number;
  is_official: boolean;
  config: Record<string, string>;
}

const CATEGORIES = ["All", "Productivity", "Code", "Security", "Social", "Docs"];

const FALLBACK_TEMPLATES: AgentTemplate[] = [];

/* ─── Stars Component ─── */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "w-3 h-3",
            star <= Math.round(rating)
              ? "fill-neon-amber text-neon-amber"
              : "text-text-muted/30"
          )}
        />
      ))}
      <span className="text-xs text-text-muted ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

/* ─── Component ─── */
export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  const fetchTemplates = useCallback(() =>
    marketplaceApi.list().then((raw) => {
      if (Array.isArray(raw) && raw.length > 0) return raw as AgentTemplate[];
      return FALLBACK_TEMPLATES;
    }),
    []
  );

  const { data: templates, loading } = useApi<AgentTemplate[]>(fetchTemplates, FALLBACK_TEMPLATES);

  const filtered = templates.filter((t) => {
    const matchesCategory = activeCategory === "All" || t.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleInstall = async (id: string) => {
    try {
      await marketplaceApi.install(id);
    } catch { /* continue */ }
    setInstalledIds((prev) => new Set([...prev, id]));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-neon-magenta glow-text-magenta flex items-center gap-3">
            <Store className="w-7 h-7" />
            MARKETPLACE
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Install pre-built agent templates to extend your Jaime instance
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-magenta/50 w-64"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading marketplace...</span>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              activeCategory === cat
                ? "bg-neon-magenta/15 text-neon-magenta border-neon-magenta/30"
                : "bg-bg-secondary text-text-muted border-surface-border hover:border-text-muted/30"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((template) => {
          const isInstalled = installedIds.has(template.id);
          return (
            <div
              key={template.id}
              className="glass-card p-5 flex flex-col gap-3 hover:ring-1 hover:ring-neon-magenta/20 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-neon-magenta/10 text-neon-magenta shrink-0">
                  <Store className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{template.name}</h3>
                    {template.is_official && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
                        OFFICIAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <StarRating rating={template.rating || 0} />
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Download className="w-3 h-3" />
                  {(template.downloads || 0).toLocaleString()}
                </div>
              </div>

              {template.config && (
                <div className="text-[10px] text-text-muted bg-bg-tertiary/50 rounded-md px-3 py-2 font-mono space-y-0.5">
                  {Object.entries(template.config).slice(0, 3).map(([k, v]) => (
                    <div key={k}>{k}: {v}</div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-border">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted border border-surface-border">
                  {template.category}
                </span>
                <button
                  onClick={() => handleInstall(template.id)}
                  disabled={isInstalled}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    isInstalled
                      ? "bg-neon-green/10 text-neon-green border border-neon-green/20 cursor-default"
                      : "bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/30 hover:bg-neon-magenta/20"
                  )}
                >
                  {isInstalled ? "✓ Installed" : "Install"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-text-muted">
          <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {templates.length === 0
              ? "No templates available — connect Brain API to load marketplace"
              : "No templates found matching your criteria"}
          </p>
        </div>
      )}
    </div>
  );
}
