"use client";

import { useState } from "react";
import { Search as SearchIcon, Layers, Zap, Database, Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { memoryApi } from "@/lib/brain-api";

/* ─── Types ─── */
interface SearchResult {
  key: string;
  agent: string;
  content: string;
  layer: "l1_redis" | "l2_postgres" | "l3_embedding";
  score: number;
  timestamp: string;
}

const layerConfig = {
  l1_redis: { label: "L1 Redis", icon: <Zap className="w-3.5 h-3.5" />, color: "text-neon-green", bg: "bg-neon-green/10 border-neon-green/20" },
  l2_postgres: { label: "L2 PostgreSQL", icon: <Database className="w-3.5 h-3.5" />, color: "text-neon-cyan", bg: "bg-neon-cyan/10 border-neon-cyan/20" },
  l3_embedding: { label: "L3 Embedding", icon: <Brain className="w-3.5 h-3.5" />, color: "text-neon-magenta", bg: "bg-neon-magenta/10 border-neon-magenta/20" },
};

/* ─── Component ─── */
export default function MemorySearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await memoryApi.search(query, 20);
      // Map API response to our SearchResult type
      const mapped: SearchResult[] = (response?.results || []).map((r: Record<string, unknown>, i: number) => ({
        key: (r.key as string) || `result-${i}`,
        agent: (r.agent as string) || "system",
        content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
        layer: (r.layer as SearchResult["layer"]) || "l2_postgres",
        score: (r.score as number) ?? 0,
        timestamp: (r.timestamp as string) || "—",
      }));
      setResults(mapped);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
          SEMANTIC SEARCH
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Search across all memory layers: Redis → PostgreSQL → Embeddings
        </p>
      </div>

      {/* Search Box */}
      <div className="glass-card p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search memories... (e.g. 'user preferences', 'API design decisions')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-12 pr-4 py-3 rounded-lg bg-bg-tertiary/50 border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/50 focus:outline-none transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-medium hover:bg-neon-cyan/20 disabled:opacity-50 transition-all"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SearchIcon className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        {/* Layer Badges */}
        <div className="flex items-center gap-4 mt-3">
          <span className="text-xs text-text-muted">Searching:</span>
          {Object.entries(layerConfig).map(([key, cfg]) => (
            <div key={key} className={cn("flex items-center gap-1.5 px-2 py-1 rounded border text-xs", cfg.bg, cfg.color)}>
              {cfg.icon}
              {cfg.label}
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Results ({results.length})
            </h2>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Layers className="w-3 h-3" />
              Multi-layer search
            </div>
          </div>
          {results.map((result) => {
            const layer = layerConfig[result.layer] || layerConfig.l2_postgres;
            return (
              <div key={result.key} className="glass-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium font-mono text-neon-cyan">
                      {result.key}
                    </span>
                    <span className="text-xs text-text-muted">@{result.agent}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px]", layer.bg, layer.color)}>
                      {layer.icon}
                      {layer.label}
                    </div>
                    <span className="text-xs font-mono text-neon-green">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-text-secondary">{result.content}</p>
                <p className="text-xs text-text-muted mt-2">{result.timestamp}</p>
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && query && !isSearching && (
        <div className="glass-card p-10 text-center">
          <Brain className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">No memories found. Try a different query.</p>
        </div>
      )}
    </div>
  );
}
