"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Brain, Zap, CheckCircle2, XCircle, TrendingUp, Clock, Activity, Loader2 } from "lucide-react";
import { analyticsApi, type DashboardMetrics } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ============================================
   Brain Statistics Page
   ============================================ */

const FALLBACK_METRICS: DashboardMetrics = {
  total_actions: 0,
  successful: 0,
  failed: 0,
  avg_latency_ms: 0,
  total_tokens: 0,
  estimated_cost: 0,
  period: "all-time",
};

interface AgentPerf {
  name: string;
  tasks: number;
  success: number;
  avgTime: string;
  tokens: string;
}

export default function BrainPage() {
  const fetchMetrics = useCallback(() => analyticsApi.dashboard(), []);
  const fetchPerf = useCallback(() =>
    analyticsApi.agentPerformance().then((raw) => {
      if (Array.isArray(raw) && raw.length > 0) return raw as unknown as AgentPerf[];
      return [] as AgentPerf[];
    }),
    []
  );

  const { data: metrics, loading: metricsLoading } = useApi<DashboardMetrics>(fetchMetrics, FALLBACK_METRICS);
  const { data: agents } = useApi<AgentPerf[]>(fetchPerf, []);

  const successRate = metrics.total_actions > 0
    ? ((metrics.successful / metrics.total_actions) * 100).toFixed(1)
    : "—";

  const METRIC_CARDS = [
    { label: "Total Actions", value: metrics.total_actions.toLocaleString(), icon: <Zap className="w-5 h-5" />, color: "text-neon-cyan" },
    { label: "Successful", value: metrics.successful.toLocaleString(), icon: <CheckCircle2 className="w-5 h-5" />, color: "text-neon-green" },
    { label: "Failed", value: metrics.failed.toLocaleString(), icon: <XCircle className="w-5 h-5" />, color: "text-neon-red" },
    { label: "Success Rate", value: `${successRate}%`, icon: <TrendingUp className="w-5 h-5" />, color: "text-neon-amber" },
    { label: "Avg Latency", value: `${metrics.avg_latency_ms}ms`, icon: <Clock className="w-5 h-5" />, color: "text-neon-cyan" },
    { label: "Total Tokens", value: metrics.total_tokens > 1000 ? `${(metrics.total_tokens / 1000).toFixed(0)}K` : String(metrics.total_tokens), icon: <Activity className="w-5 h-5" />, color: "text-neon-green" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-7 h-7 text-neon-cyan" />
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
            BRAIN STATISTICS
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            AI performance metrics and intelligence analytics
          </p>
        </div>
      </div>

      {metricsLoading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading brain stats...</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {METRIC_CARDS.map((metric) => (
          <div key={metric.label} className="glass-card p-4 text-center">
            <div className={cn("flex justify-center mb-2", metric.color)}>
              {metric.icon}
            </div>
            <p className="text-xl font-bold font-[family-name:var(--font-orbitron)]">
              {metric.value}
            </p>
            <p className="text-xs text-text-muted mt-1">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* Agent Performance Table */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
          Agent Performance Breakdown
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-text-muted font-medium">Agent</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-muted font-medium">Tasks</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-muted font-medium">Success %</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-muted font-medium">Avg Time</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-muted font-medium">Tokens Used</th>
              </tr>
            </thead>
            <tbody>
              {agents.length > 0 ? agents.map((agent) => (
                <tr key={agent.name} className="border-b border-surface-border/50 hover:bg-bg-hover/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-neon-cyan">@{agent.name}</td>
                  <td className="py-3 px-4 text-right font-mono">{agent.tasks?.toLocaleString() || 0}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      "font-mono",
                      (agent.success || 0) >= 97 ? "text-neon-green" : (agent.success || 0) >= 95 ? "text-neon-amber" : "text-neon-red"
                    )}>
                      {agent.success || 0}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-text-secondary">{agent.avgTime || "—"}</td>
                  <td className="py-3 px-4 text-right font-mono text-text-secondary">{agent.tokens || "—"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-muted text-sm">
                    No agent performance data yet — connect Brain API
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Training Mode Link */}
      <div className="glass-card p-6 gradient-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-neon-magenta/10 border border-neon-magenta/20">
            <Brain className="w-5 h-5 text-neon-magenta" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Training Mode</h2>
            <p className="text-xs text-text-muted">Run scenarios to improve agent performance</p>
          </div>
        </div>
        <a
          href="/brain/training"
          className="flex items-center justify-center h-12 rounded-lg bg-neon-magenta/10 border border-neon-magenta/20 text-neon-magenta text-sm hover:bg-neon-magenta/20 transition-all"
        >
          Open Training Mode →
        </a>
      </div>
    </div>
  );
}
