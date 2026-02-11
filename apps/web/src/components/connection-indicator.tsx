"use client";

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/use-websocket";

/**
 * Real-time connection status indicator.
 * Shows a small dot/icon in the header to indicate WebSocket state.
 */
export function ConnectionIndicator() {
  const { status } = useWebSocket();

  const config = {
    connected: {
      icon: Wifi,
      color: "text-neon-green",
      bg: "bg-neon-green/10",
      border: "border-neon-green/20",
      label: "Live",
      pulse: true,
    },
    connecting: {
      icon: Loader2,
      color: "text-neon-amber",
      bg: "bg-neon-amber/10",
      border: "border-neon-amber/20",
      label: "Connecting",
      pulse: false,
    },
    disconnected: {
      icon: WifiOff,
      color: "text-text-muted",
      bg: "bg-bg-tertiary",
      border: "border-surface-border",
      label: "Offline",
      pulse: false,
    },
    error: {
      icon: WifiOff,
      color: "text-neon-red",
      bg: "bg-neon-red/10",
      border: "border-neon-red/20",
      label: "Error",
      pulse: false,
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all",
        config.bg,
        config.border,
        config.color,
      )}
      title={`WebSocket: ${status}`}
    >
      <div className="relative">
        <Icon
          className={cn(
            "w-3 h-3",
            status === "connecting" && "animate-spin",
          )}
        />
        {config.pulse && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-neon-green animate-pulse" />
        )}
      </div>
      <span className="hidden sm:inline font-medium">{config.label}</span>
    </div>
  );
}
