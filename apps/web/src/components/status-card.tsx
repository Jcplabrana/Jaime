"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

export interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: "cyan" | "green" | "magenta" | "amber";
}

const colorMap = {
  cyan: "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5",
  green: "text-neon-green border-neon-green/20 bg-neon-green/5",
  magenta: "text-neon-magenta border-neon-magenta/20 bg-neon-magenta/5",
  amber: "text-neon-amber border-neon-amber/20 bg-neon-amber/5",
};

export function StatusCard({ title, value, subtitle, icon, trend, color = "cyan" }: StatusCardProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-lg border", colorMap[color])}>
          {icon}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs text-neon-green">
            <ArrowUpRight className="w-3 h-3" />
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wide">
          {value}
        </p>
        <p className="text-sm text-text-secondary">{title}</p>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
