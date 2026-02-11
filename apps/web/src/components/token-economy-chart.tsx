"use client";

import { useCallback } from "react";
import { TrendingDown, DollarSign, Zap, Database, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { cacheApi, type CacheStats, type CacheDailyEntry } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ─── Fallbacks ─── */
const FALLBACK_STATS: CacheStats = {
  total_requests: 0,
  cache_hits: 0,
  cache_misses: 0,
  hit_rate: 0,
  total_cached_tokens: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cost_usd: 0,
  estimated_savings_usd: 0,
  avg_latency_ms: 0,
  avg_cached_latency_ms: 0,
  avg_uncached_latency_ms: 0,
};

const FALLBACK_DAILY: CacheDailyEntry[] = [];

/* ─── Component ─── */
export function TokenEconomyChart() {
  const fetchStats = useCallback(() => cacheApi.getStats(), []);
  const fetchDaily = useCallback(() => cacheApi.getDaily(7), []);

  const { data: stats, loading } = useApi<CacheStats>(fetchStats, FALLBACK_STATS);
  const { data: daily } = useApi<CacheDailyEntry[]>(fetchDaily, FALLBACK_DAILY);

  const hitRate = Math.round(stats.hit_rate * 100);
  const maxBar = daily.length > 0
    ? Math.max(...daily.map((d) => d.total_tokens))
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-wider text-neon-green">
          TOKEN ECONOMY
        </h2>
        {loading && (
          <div className="flex items-center gap-1 text-xs text-neon-amber">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          icon={<DollarSign className="w-4 h-4" />}
          label="Spent"
          value={`$${stats.total_cost_usd.toFixed(2)}`}
          color="text-neon-cyan"
        />
        <KPICard
          icon={<TrendingDown className="w-4 h-4" />}
          label="Saved"
          value={`$${stats.estimated_savings_usd.toFixed(2)}`}
          sub={stats.total_cost_usd > 0
            ? `${Math.round((stats.estimated_savings_usd / (stats.total_cost_usd + stats.estimated_savings_usd)) * 100)}% reduction`
            : "—"}
          color="text-neon-green"
        />
        <KPICard
          icon={<Zap className="w-4 h-4" />}
          label="Cache Hit"
          value={`${hitRate}%`}
          sub={`${(stats.total_cached_tokens / 1000).toFixed(0)}K cached`}
          color="text-neon-amber"
        />
        <KPICard
          icon={<Database className="w-4 h-4" />}
          label="Avg Latency"
          value={`${stats.avg_latency_ms}ms`}
          sub={stats.avg_cached_latency_ms > 0
            ? `cached: ${stats.avg_cached_latency_ms}ms`
            : "—"}
          color="text-neon-magenta"
        />
      </div>

      {/* Bar Chart */}
      {daily.length > 0 ? (
        <div className="glass-card p-4">
          <div className="flex items-end gap-2 h-40">
            {daily.map((day) => {
              const cachedHeight = (day.cached_tokens / maxBar) * 100;
              const regularHeight = ((day.total_tokens - day.cached_tokens) / maxBar) * 100;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-32 gap-0.5">
                    <div
                      className="w-full rounded-t bg-neon-green/15 border border-neon-green/20"
                      style={{ height: `${cachedHeight}%` }}
                      title={`Cached: ${(day.cached_tokens / 1000).toFixed(0)}K tokens`}
                    />
                    <div
                      className="w-full rounded-b bg-linear-to-t from-neon-cyan/60 to-neon-cyan/30 border border-neon-cyan/30"
                      style={{ height: `${regularHeight}%` }}
                      title={`Regular: ${((day.total_tokens - day.cached_tokens) / 1000).toFixed(0)}K tokens`}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted">{day.date.slice(5)}</span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-surface-border">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <div className="w-3 h-3 rounded bg-neon-cyan/40 border border-neon-cyan/30" />
              <span>Regular tokens</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <div className="w-3 h-3 rounded bg-neon-green/15 border border-neon-green/20" />
              <span>Cached tokens (saved)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center text-sm text-text-muted">
          No cache data yet — token usage will appear once sessions are recorded
        </div>
      )}
    </div>
  );
}

/* ─── KPI Sub-component ─── */
function KPICard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="glass-card p-3">
      <div className={cn("flex items-center gap-2 mb-1", color)}>
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold font-mono">{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}
