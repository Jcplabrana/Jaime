"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, Server, Database, Cpu, HardDrive, RefreshCw, FileText, Clock, Loader2 } from "lucide-react";
import { healthApi, type HealthStatus } from "@/lib/brain-api";
import { useApiPolling } from "@/hooks/use-api";
import { useWebSocket, type WSMessage } from "@/hooks/use-websocket";

/* ============================================
   Monitor Status Page
   ============================================ */

interface MetricCardProps {
  title: string;
  metrics: { label: string; value: string; color?: string }[];
  icon: React.ReactNode;
}

function MetricSection({ title, metrics, icon }: MetricCardProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-neon-cyan">{icon}</span>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">{title}</h3>
      </div>
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">{metric.label}</span>
            <span className={cn("text-sm font-mono font-medium", metric.color || "text-text-primary")}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LogItem {
  time: string;
  level: string;
  msg: string;
  color: string;
}

export default function MonitorPage() {
  const fetchHealth = useCallback(() => healthApi.detailed(), []);
  const { data: health, loading, refetch } = useApiPolling<HealthStatus>(
    fetchHealth,
    { status: "offline", services: { database: "offline", redis: "offline", ollama: "offline" }, timestamp: "" },
    10000,
  );

  const isOnline = health.status === "ok" || health.status === "online";

  const LOGS: LogItem[] = [
    { time: new Date().toLocaleTimeString("en-US", { hour12: false }), level: isOnline ? "OK" : "ERR", msg: isOnline ? "Health check passed: services operational" : "Brain API unreachable", color: isOnline ? "text-neon-green" : "text-neon-red" },
  ];

  /* ─── Real-time events → live log entries ─── */
  const ws = useWebSocket();
  const isConnected = ws.status === "connected";
  const [realtimeLogs, setRealtimeLogs] = useState<LogItem[]>([]);

  useEffect(() => {
    const unsub = ws.on("*", (msg: WSMessage) => {
      const now = new Date().toLocaleTimeString("en-US", { hour12: false });
      setRealtimeLogs((prev) => [
        {
          time: now,
          level: "WS",
          msg: `[${msg.type}] ${JSON.stringify(msg.data || {}).slice(0, 120)}`,
          color: "text-neon-cyan",
        },
        ...prev.slice(0, 49),
      ]);
    });
    return unsub;
  }, [ws]);

  const allLogs = [...realtimeLogs, ...LOGS];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-neon-cyan" />
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
              SYSTEM MONITOR
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Real-time infrastructure monitoring
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-sm hover:bg-neon-cyan/20 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Health Check
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricSection
          title="System Status"
          icon={<Server className="w-4 h-4" />}
          metrics={[
            { label: "Brain API", value: isOnline ? "Online" : "Offline", color: isOnline ? "text-neon-green" : "text-neon-red" },
            { label: "Database", value: health.services?.database || "unknown", color: health.services?.database === "online" ? "text-neon-green" : undefined },
            { label: "Redis", value: health.services?.redis || "unknown", color: health.services?.redis === "online" ? "text-neon-green" : undefined },
            { label: "Ollama", value: health.services?.ollama || "unknown", color: health.services?.ollama === "online" ? "text-neon-green" : undefined },
          ]}
        />
        <MetricSection
          title="Database"
          icon={<Database className="w-4 h-4" />}
          metrics={[
            { label: "Status", value: health.services?.database || "—" },
            { label: "Latency", value: "—" },
            { label: "Connections", value: "—" },
            { label: "Cache Hit", value: "—" },
          ]}
        />
        <MetricSection
          title="GPU (Ollama)"
          icon={<Cpu className="w-4 h-4" />}
          metrics={[
            { label: "Status", value: health.services?.ollama || "—" },
            { label: "Models", value: "—" },
            { label: "VRAM", value: "—" },
            { label: "Embed Latency", value: "—" },
          ]}
        />
        <MetricSection
          title="Storage"
          icon={<HardDrive className="w-4 h-4" />}
          metrics={[
            { label: "Disk", value: "—" },
            { label: "Models", value: "—" },
            { label: "Redis Mem", value: "—" },
            { label: "Logs", value: "—" },
          ]}
        />
      </div>

      {/* Logs */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neon-cyan" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Recent Logs</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            <span>{isConnected ? "Live" : "Polling 10s"}</span>
            <span className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-neon-green animate-pulse-glow" : "bg-neon-amber"
            )} />
          </div>
        </div>
        <div className="space-y-1 font-mono text-xs max-h-96 overflow-y-auto">
          {allLogs.map((log, i) => (
            <div key={i} className="flex gap-3 py-1.5 px-3 rounded hover:bg-bg-hover/30 transition-colors">
              <span className="text-text-muted w-16 flex-shrink-0">{log.time}</span>
              <span className={cn("w-12 flex-shrink-0 font-bold", log.color)}>{log.level}</span>
              <span className="text-text-secondary">{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
