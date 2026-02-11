"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Brain,
  Activity,
  Settings,
  Database,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  GraduationCap,
  ScrollText,
  Search,
  Cpu,
  MessageSquare,
  GitBranch,
  Store,
  FileSearch,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Mission Control", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Users },
  {
    href: "/brain", label: "Brain", icon: Brain,
    children: [
      { href: "/brain/training", label: "Training", icon: GraduationCap },
    ],
  },
  {
    href: "/monitor", label: "Monitor", icon: Activity,
    children: [
      { href: "/monitor/logs", label: "Logs", icon: ScrollText },
    ],
  },
  {
    href: "/memory", label: "Memory", icon: Database,
    children: [
      { href: "/memory/search", label: "Search", icon: Search },
    ],
  },
  { href: "/usage", label: "Usage", icon: BarChart3 },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/pncp", label: "PNCP Monitor", icon: FileSearch },
  {
    href: "/config", label: "Config", icon: Settings,
    children: [
      { href: "/config/models", label: "Models", icon: Cpu },
      { href: "/config/channels", label: "Channels", icon: MessageSquare },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  const toggleExpand = (href: string) => {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-surface-border bg-bg-secondary transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[280px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-surface-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-neon-cyan/10 glow-cyan">
          <Zap className="w-5 h-5 text-neon-cyan" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold font-[family-name:var(--font-orbitron)] text-neon-cyan glow-text-cyan tracking-wider">
              JARVIS
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-widest">
              Mission Control
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isChildActive = item.children?.some((c) => pathname === c.href);
          const isOpen = expanded[item.href] || isChildActive;
          const Icon = item.icon;

          return (
            <div key={item.href}>
              <div className="flex items-center">
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex-1",
                    isActive
                      ? "bg-neon-cyan/10 text-neon-cyan glow-cyan border border-neon-cyan/20"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                  )}
                >
                  <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "drop-shadow-[0_0_6px_rgba(0,240,255,0.5)]")} />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                </Link>
                {!collapsed && item.children && (
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className="p-1.5 rounded-md text-text-muted hover:text-text-primary transition-colors"
                  >
                    <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
                  </button>
                )}
              </div>

              {/* Sub-navigation */}
              {!collapsed && item.children && isOpen && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {item.children.map((child) => {
                    const isChildItemActive = pathname === child.href;
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all duration-200",
                          isChildItemActive
                            ? "bg-neon-cyan/5 text-neon-cyan border border-neon-cyan/15"
                            : "text-text-muted hover:text-text-secondary hover:bg-bg-hover/50"
                        )}
                      >
                        <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-surface-border text-text-muted hover:text-neon-cyan transition-colors"
      >
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
}
