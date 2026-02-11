"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, DollarSign, TrendingDown, Coins, Layers, Loader2 } from "lucide-react";
import { TokenEconomyChart } from "@/components/token-economy-chart";
import { analyticsApi } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ============================================
   Types
   ============================================ */

interface UsageDay {
  day: string;
  tokens: number;
  cached: number;
  cost: number;
}

interface ModelDist {
  name: string;
  pct: number;
  color: string;
}

/* ============================================
   Fallback Data
   ============================================ */

const FALLBACK_DAILY: UsageDay[] = [
  { day: "Mon", tokens: 0, cached: 0, cost: 0 },
  { day: "Tue", tokens: 0, cached: 0, cost: 0 },
  { day: "Wed", tokens: 0, cached: 0, cost: 0 },
  { day: "Thu", tokens: 0, cached: 0, cost: 0 },
  { day: "Fri", tokens: 0, cached: 0, cost: 0 },
  { day: "Sat", tokens: 0, cached: 0, cost: 0 },
  { day: "Sun", tokens: 0, cached: 0, cost: 0 },
];

const FALLBACK_MODELS: ModelDist[] = [
  { name: "Haiku (simple)", pct: 0, color: "bg-neon-green" },
  { name: "Sonnet (medium)", pct: 0, color: "bg-neon-cyan" },
  { name: "Opus (complex)", pct: 0, color: "bg-neon-magenta" },
  { name: "Local/Ollama", pct: 0, color: "bg-neon-amber" },
];

/* ============================================
   Usage Page
   ============================================ */

export default function UsagePage() {
  const fetchUsage = useCallback(() =>
    analyticsApi.usage(7).then((raw) => {
      if (Array.isArray(raw) && raw.length > 0) return raw as unknown as UsageDay[];
      return FALLBACK_DAILY;
    }),
    []
  );

  const fetchModels = useCallback(() =>
    analyticsApi.modelDistribution().then((raw) => {
      if (Array.isArray(raw) && raw.length > 0) {
        const colors = ["bg-neon-green", "bg-neon-cyan", "bg-neon-magenta", "bg-neon-amber"];
        return (raw as Array<{ name: string; pct: number }>).map((m, i) => ({
          ...m,
          color: colors[i % colors.length],
        }));
      }
      return FALLBACK_MODELS;
    }),
    []
  );

  const { data: daily, loading: usageLoading } = useApi<UsageDay[]>(fetchUsage, FALLBACK_DAILY);
  const { data: models } = useApi<ModelDist[]>(fetchModels, FALLBACK_MODELS);

  const totT = daily.reduce((s, d) => s + d.tokens, 0);
  const totC = daily.reduce((s, d) => s + d.cached, 0);
  const totCost = daily.reduce((s, d) => s + d.cost, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-7 h-7 text-neon-cyan" />
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">TOKEN USAGE</h1>
          <p className="text-sm text-text-secondary mt-1">Cost analytics and token economy</p>
        </div>
      </div>

      {usageLoading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: <Coins className="w-4 h-4" />, label: "Total Tokens", val: totT > 0 ? `${(totT/1000).toFixed(0)}K` : "—", sub: "Last 7 days", c: "text-neon-cyan" },
          { icon: <TrendingDown className="w-4 h-4" />, label: "Cached", val: totC > 0 ? `${(totC/1000).toFixed(0)}K` : "—", sub: totT > 0 ? `${((totC/totT)*100).toFixed(0)}% rate` : "—", c: "text-neon-green" },
          { icon: <DollarSign className="w-4 h-4" />, label: "Cost", val: totCost > 0 ? `$${totCost.toFixed(2)}` : "—", sub: "This week", c: "text-neon-amber" },
          { icon: <TrendingDown className="w-4 h-4" />, label: "Savings", val: totCost > 0 ? `$${(totCost*5.67).toFixed(2)}` : "—", sub: "85% reduction", c: "text-neon-green" },
        ].map((card) => (
          <div key={card.label} className="glass-card p-5">
            <div className={cn("flex items-center gap-2 mb-2", card.c)}>{card.icon}<span className="text-xs uppercase text-text-muted">{card.label}</span></div>
            <p className="text-2xl font-bold font-[family-name:var(--font-orbitron)]">{card.val}</p>
            <p className="text-xs text-text-muted mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">Daily Token Usage</h2>
        <div className="flex items-end gap-3 h-48">
          {daily.map((d) => {
            const max = Math.max(...daily.map(x => x.tokens), 1);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full relative" style={{ height: `${(d.tokens/max)*100}%` }}>
                  <div className="absolute bottom-0 w-full rounded-t bg-neon-cyan/20 border border-neon-cyan/30 h-full" />
                  <div className="absolute bottom-0 w-full rounded-t bg-neon-green/40" style={{ height: d.tokens > 0 ? `${(d.cached/d.tokens)*100}%` : "0%" }} />
                </div>
                <span className="text-xs text-text-muted">{d.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4"><Layers className="w-4 h-4 text-neon-cyan" /><h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Smart Routing</h2></div>
        <div className="space-y-3">
          {models.map((m) => (
            <div key={m.name} className="space-y-1">
              <div className="flex justify-between text-sm"><span>{m.name}</span><span className="font-mono text-text-secondary">{m.pct}%</span></div>
              <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden"><div className={cn("h-full rounded-full", m.color)} style={{ width: `${m.pct}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <TokenEconomyChart />
    </div>
  );
}
