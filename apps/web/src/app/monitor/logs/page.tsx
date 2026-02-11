"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollText, AlertCircle, CheckCircle2, Info, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { healthApi, type HealthStatus } from "@/lib/brain-api";
import { useApiPolling } from "@/hooks/use-api";

/* ─── Types ─── */
interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
}

/* ─── Component ─── */
export default function LogsPage() {
  const [filter, setFilter] = useState<"all" | "info" | "warn" | "error" | "debug">("all");
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchHealth = useCallback(() => healthApi.detailed(), []);
  const { data: health } = useApiPolling<HealthStatus>(
    fetchHealth,
    { status: "offline", services: { database: "offline", redis: "offline", ollama: "offline" }, timestamp: "" },
    5000,
  );

  // Generate real-time logs from health polling
  useEffect(() => {
    const isOnline = health.status === "ok" || health.status === "online";
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });

    const newLogs: LogEntry[] = [];

    if (isOnline) {
      newLogs.push({
        id: `health-${Date.now()}`,
        timestamp: now,
        level: "info",
        source: "brain-api",
        message: "Health check passed: all services online",
      });

      if (health.services?.database === "online") {
        newLogs.push({
          id: `db-${Date.now()}`,
          timestamp: now,
          level: "info",
          source: "postgres",
          message: "Database connection pool active",
        });
      }

      if (health.services?.redis === "online") {
        newLogs.push({
          id: `redis-${Date.now()}`,
          timestamp: now,
          level: "info",
          source: "redis",
          message: "Redis cache operational",
        });
      }

      if (health.services?.ollama === "online") {
        newLogs.push({
          id: `ollama-${Date.now()}`,
          timestamp: now,
          level: "info",
          source: "ollama",
          message: "Ollama GPU inference ready",
        });
      }
    } else {
      newLogs.push({
        id: `offline-${Date.now()}`,
        timestamp: now,
        level: "error",
        source: "brain-api",
        message: "Brain API unreachable — check if server is running",
      });
    }

    setLogs((prev) => [...newLogs, ...prev].slice(0, 100));
  }, [health]);

  const levelConfig = {
    info: { icon: <Info className="w-3.5 h-3.5" />, color: "text-neon-cyan", bg: "bg-neon-cyan/10 border-neon-cyan/20" },
    warn: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-neon-amber", bg: "bg-neon-amber/10 border-neon-amber/20" },
    error: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-neon-red", bg: "bg-neon-red/10 border-neon-red/20" },
    debug: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-text-muted", bg: "bg-text-muted/10 border-text-muted/20" },
  };

  const filtered = logs
    .filter((log) => filter === "all" || log.level === filter)
    .filter((log) =>
      search ? log.message.toLowerCase().includes(search.toLowerCase()) || log.source.toLowerCase().includes(search.toLowerCase()) : true
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
          SYSTEM LOGS
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Real-time log stream from all Jarvis services
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-bg-tertiary/50 border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/50 focus:outline-none transition-all"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary/50 border border-surface-border">
          {(["all", "info", "warn", "error", "debug"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                filter === level
                  ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          Live (5s)
        </div>
      </div>

      {/* Log Entries */}
      <div className="glass-card overflow-hidden">
        <div className="space-y-px">
          {filtered.length > 0 ? filtered.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-bg-tertiary/30 transition-colors"
            >
              <span className="text-xs font-mono text-text-muted whitespace-nowrap pt-0.5">
                {log.timestamp}
              </span>
              <span className={cn("p-1 rounded border", levelConfig[log.level].bg, levelConfig[log.level].color)}>
                {levelConfig[log.level].icon}
              </span>
              <span className="text-xs font-medium text-neon-cyan min-w-[80px]">
                {log.source}
              </span>
              <span className="text-sm text-text-secondary flex-1">
                {log.message}
              </span>
            </div>
          )) : (
            <div className="p-8 text-center text-text-muted text-sm">
              Waiting for logs... (health check every 5s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
