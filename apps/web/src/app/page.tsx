"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Zap,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Cpu,
  Database,
  Server,
  Wifi,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { healthApi, analyticsApi, type HealthStatus, type DashboardMetrics } from "@/lib/brain-api";
import { useApiPolling } from "@/hooks/use-api";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";
import { cn } from "@/lib/utils";
import { StatusCard } from "@/components/status-card";
import { ServiceStatusItem } from "@/components/service-status-item";
import { ActivityFeed, type Activity } from "@/components/activity-feed";

/* ============================================
   Fallback Data
   ============================================ */

const FALLBACK_METRICS: DashboardMetrics = {
  total_actions: 0,
  successful: 0,
  failed: 0,
  avg_latency_ms: 0,
  total_tokens: 0,
  estimated_cost: 0,
  period: "24h",
};

const FALLBACK_ACTIVITIES: Activity[] = [
  { id: "1", agent: "jarvis", action: "Waiting for connection...", status: "idle", time: "—" },
];

/* ============================================
   Mission Control Page
   ============================================ */

export default function MissionControl() {
  const fetchMetrics = useCallback(() => analyticsApi.dashboard(), []);
  const fetchHealth = useCallback(() => healthApi.detailed(), []);

  const { data: metrics, loading: metricsLoading } = useApiPolling<DashboardMetrics>(
    fetchMetrics,
    FALLBACK_METRICS,
    15000,
  );

  const { data: health } = useApiPolling<HealthStatus>(
    fetchHealth,
    { status: "offline", services: { database: "offline", redis: "offline", ollama: "offline" }, timestamp: "" },
    10000,
  );

  /* ─── Real-time events ─── */
  const { subscribe, isConnected } = useRealtimeUpdates();
  const [activities, setActivities] = useState<Activity[]>(FALLBACK_ACTIVITIES);

  useEffect(() => {
    const unsub1 = subscribe("agent.task_started", (data) => {
      setActivities((prev) => [
        {
          id: String(data.task_id || Date.now()),
          agent: String(data.agent || "unknown"),
          action: `Task delegated: ${String(data.title || "New task")}`,
          status: "working" as const,
          time: "Just now",
        },
        ...prev.slice(0, 9),
      ]);
    });

    const unsub2 = subscribe("agent.task_completed", (data) => {
      setActivities((prev) => [
        {
          id: String(data.task_id || Date.now()),
          agent: "system",
          action: `Task ${String(data.task_id || "")} → ${String(data.status || "updated")}`,
          status: (data.status === "completed" ? "completed" : data.status === "failed" ? "failed" : "working") as Activity["status"],
          time: "Just now",
        },
        ...prev.slice(0, 9),
      ]);
    });

    return () => { unsub1(); unsub2(); };
  }, [subscribe]);

  const serviceStatus = (svc: string): "online" | "offline" | "warning" =>
    svc === "online" ? "online" : svc === "warning" ? "warning" : "offline";

  const successRate = metrics.total_actions > 0
    ? Math.round((metrics.successful / metrics.total_actions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
          MISSION CONTROL
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          System overview and real-time agent monitoring
        </p>
      </div>

      {/* Loading Indicator */}
      {metricsLoading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <AlertTriangle className="w-3 h-3" />
          <span>Connecting to Brain API...</span>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Total Actions"
          value={metrics.total_actions.toLocaleString()}
          subtitle="Last 24 hours"
          icon={<Zap className="w-5 h-5" />}
          color="cyan"
        />
        <StatusCard
          title="Successful"
          value={metrics.successful.toLocaleString()}
          subtitle={`${successRate}% success rate`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
        />
        <StatusCard
          title="Failed"
          value={metrics.failed.toLocaleString()}
          subtitle={`${100 - successRate}% failure rate`}
          icon={<XCircle className="w-5 h-5" />}
          color="magenta"
        />
        <StatusCard
          title="Cost"
          value={`$${metrics.estimated_cost.toFixed(2)}`}
          subtitle={`Avg ${metrics.avg_latency_ms}ms latency`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="amber"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Status */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
            Service Status
          </h2>
          <div className="space-y-2">
            <ServiceStatusItem name="Brain API" status={serviceStatus(health.status === "ok" ? "online" : health.status)} icon={<Server className="w-4 h-4" />} />
            <ServiceStatusItem name="Ollama GPU" status={serviceStatus(health.services?.ollama || "offline")} icon={<Cpu className="w-4 h-4" />} />
            <ServiceStatusItem name="PostgreSQL" status={serviceStatus(health.services?.database || "offline")} icon={<Database className="w-4 h-4" />} />
            <ServiceStatusItem name="Redis" status={serviceStatus(health.services?.redis || "offline")} icon={<Zap className="w-4 h-4" />} />
            <ServiceStatusItem name="OpenClaw Gateway" status={serviceStatus(health.status === "ok" ? "online" : "offline")} icon={<Wifi className="w-4 h-4" />} />
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Activity Feed
            </h2>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              <span>{isConnected ? "Live" : "Polling"}</span>
              <span className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-neon-green animate-pulse-glow" : "bg-neon-amber"
              )} />
            </div>
          </div>
          <ActivityFeed activities={activities} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Run Health Check", icon: "🔍" },
            { label: "Refresh Stats", icon: "📊" },
            { label: "Clear Cache", icon: "🗑️" },
            { label: "View Logs", icon: "📋" },
          ].map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-bg-tertiary/50 border border-surface-border text-sm text-text-secondary hover:text-neon-cyan hover:border-neon-cyan/30 transition-all"
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
