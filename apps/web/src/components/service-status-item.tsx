"use client";

import { cn } from "@/lib/utils";

export interface ServiceStatusProps {
  name: string;
  status: "online" | "offline" | "warning";
  latency?: number;
  icon: React.ReactNode;
}

const statusConfig = {
  online: { color: "bg-status-online", text: "Online", textColor: "text-status-online" },
  offline: { color: "bg-status-offline", text: "Offline", textColor: "text-status-offline" },
  warning: { color: "bg-status-warning", text: "Warning", textColor: "text-status-warning" },
};

export function ServiceStatusItem({ name, status, latency, icon }: ServiceStatusProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-bg-tertiary/50 border border-surface-border">
      <div className="flex items-center gap-3">
        <div className="text-text-muted">{icon}</div>
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        {latency != null && (
          <span className="text-xs text-text-muted font-mono">
            {latency}ms
          </span>
        )}
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", statusConfig[status].color, status === "online" && "animate-pulse-glow")} />
          <span className={cn("text-xs font-medium", statusConfig[status].textColor)}>
            {statusConfig[status].text}
          </span>
        </div>
      </div>
    </div>
  );
}
