"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Database, Zap, HardDrive, Search, Trash2, Loader2 } from "lucide-react";
import { memoryApi, type MemoryStats } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ============================================
   Memory Visualization Page
   ============================================ */

const FALLBACK_STATS: MemoryStats = {
  total_memories: 0,
  by_agent: {},
  by_layer: { l1_redis: 0, l2_postgres: 0, l3_embedding: 0 },
  cache_hit_rate: 0,
};

export default function MemoryPage() {
  const fetchStats = useCallback(() => memoryApi.stats(), []);
  const { data: stats, loading } = useApi<MemoryStats>(fetchStats, FALLBACK_STATS);

  const MEMORY_LAYERS = [
    {
      id: "l1",
      name: "L1 — Redis",
      description: "Fast cache with TTL-based expiration",
      icon: <Zap className="w-5 h-5" />,
      color: "text-neon-cyan",
      bgColor: "bg-neon-cyan/5",
      borderColor: "border-neon-cyan/20",
      stats: {
        entries: stats.by_layer.l1_redis,
        hitRate: `${(stats.cache_hit_rate * 100).toFixed(1)}%`,
        avgLatency: "<1ms",
        memory: "—",
      },
    },
    {
      id: "l2",
      name: "L2 — PostgreSQL",
      description: "Persistent storage with full-text search",
      icon: <Database className="w-5 h-5" />,
      color: "text-neon-green",
      bgColor: "bg-neon-green/5",
      borderColor: "border-neon-green/20",
      stats: {
        entries: stats.by_layer.l2_postgres,
        hitRate: "—",
        avgLatency: "4ms",
        memory: "—",
      },
    },
    {
      id: "l3",
      name: "L3 — Embeddings",
      description: "Semantic search via Ollama GPU (mxbai-embed-large)",
      icon: <HardDrive className="w-5 h-5" />,
      color: "text-neon-magenta",
      bgColor: "bg-neon-magenta/5",
      borderColor: "border-neon-magenta/20",
      stats: {
        entries: stats.by_layer.l3_embedding,
        hitRate: "—",
        avgLatency: "45ms",
        memory: "—",
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-7 h-7 text-neon-cyan" />
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
            MEMORY ENGINE
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            3-Layer memory architecture — {stats.total_memories.toLocaleString()} total memories
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading memory stats...</span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Semantic search across all memory layers..."
          className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-surface-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/20 transition-all"
        />
      </div>

      {/* Layers */}
      {MEMORY_LAYERS.map((layer) => (
        <div key={layer.id} className="glass-card overflow-hidden">
          <div className={cn("flex items-center justify-between p-5 border-b border-surface-border", layer.bgColor)}>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg border", layer.bgColor, layer.borderColor, layer.color)}>
                {layer.icon}
              </div>
              <div>
                <h3 className={cn("text-sm font-bold", layer.color)}>{layer.name}</h3>
                <p className="text-xs text-text-muted">{layer.description}</p>
              </div>
            </div>
            <div className="flex gap-6">
              {Object.entries(layer.stats).map(([key, value]) => (
                <div key={key} className="text-right">
                  <p className="text-sm font-bold font-mono">{value}</p>
                  <p className="text-[10px] text-text-muted uppercase">{key.replace(/([A-Z])/g, " $1")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4">
            <p className="text-xs text-text-muted text-center py-4">
              {typeof layer.stats.entries === "number" && layer.stats.entries > 0
                ? `${layer.stats.entries} entries stored`
                : "No entries — connect Brain API to view data"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
