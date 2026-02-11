"use client";

import { Bell, Search } from "lucide-react";
import { ConnectionIndicator } from "../connection-indicator";

export function Header() {
  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-surface-border bg-bg-secondary/80 backdrop-blur-sm">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search agents, tasks, memories..."
            className="w-full pl-10 pr-4 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/20 transition-all"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Real-time Connection Status */}
        <ConnectionIndicator />

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-neon-magenta animate-pulse" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-magenta flex items-center justify-center text-xs font-bold text-bg-primary">
          J
        </div>
      </div>
    </header>
  );
}
