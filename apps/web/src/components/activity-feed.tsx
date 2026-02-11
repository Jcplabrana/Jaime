"use client";

import { cn } from "@/lib/utils";

export interface Activity {
  id: string;
  agent: string;
  action: string;
  status: "completed" | "working" | "failed" | "idle";
  time: string;
}

const statusBadge = {
  completed: "bg-neon-green/10 text-neon-green border-neon-green/20",
  working: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20",
  failed: "bg-neon-red/10 text-neon-red border-neon-red/20",
  idle: "bg-text-muted/10 text-text-muted border-text-muted/20",
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-bg-tertiary/30 border border-surface-border">
          <div className="flex items-center gap-3">
            <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold border", statusBadge[activity.status])}>
              {activity.status}
            </span>
            <div>
              <span className="text-sm font-medium text-neon-cyan">@{activity.agent}</span>
              <span className="text-sm text-text-secondary ml-2">{activity.action}</span>
            </div>
          </div>
          <span className="text-xs text-text-muted font-mono">{activity.time}</span>
        </div>
      ))}
    </div>
  );
}
