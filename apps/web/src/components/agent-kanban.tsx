"use client";

import { useState } from "react";
import {
  Inbox,
  Loader2,
  CheckCircle2,
  XCircle,
  GripVertical,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface AgentTask {
  id: string;
  title: string;
  agent: string;
  priority: number;
  createdAt: string;
}

type KanbanColumn = "inbox" | "in_progress" | "completed" | "failed";

/* ─── Mock Data ─── */
const INITIAL_TASKS: Record<KanbanColumn, AgentTask[]> = {
  inbox: [
    { id: "t1", title: "Analyze PNCP licitações", agent: "@jarvis", priority: 8, createdAt: "2min ago" },
    { id: "t2", title: "Generate API docs", agent: "@docs", priority: 5, createdAt: "15min ago" },
    { id: "t3", title: "Security audit sprint", agent: "@security", priority: 9, createdAt: "1h ago" },
  ],
  in_progress: [
    { id: "t4", title: "Refactor auth module", agent: "@backend", priority: 7, createdAt: "30min ago" },
    { id: "t5", title: "Dashboard charts", agent: "@frontend", priority: 6, createdAt: "45min ago" },
  ],
  completed: [
    { id: "t6", title: "Memory index rebuild", agent: "@workspace", priority: 4, createdAt: "2h ago" },
    { id: "t7", title: "Daily backup", agent: "@backup", priority: 3, createdAt: "3h ago" },
  ],
  failed: [
    { id: "t8", title: "Discord webhook sync", agent: "@moltbook", priority: 5, createdAt: "1h ago" },
  ],
};

const COLUMNS: { key: KanbanColumn; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "inbox", label: "Inbox", icon: <Inbox className="w-4 h-4" />, color: "text-neon-cyan" },
  { key: "in_progress", label: "Working", icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "text-neon-amber" },
  { key: "completed", label: "Done", icon: <CheckCircle2 className="w-4 h-4" />, color: "text-neon-green" },
  { key: "failed", label: "Failed", icon: <XCircle className="w-4 h-4" />, color: "text-status-error" },
];

/* ─── Component ─── */
export function AgentKanban() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [dragging, setDragging] = useState<{ task: AgentTask; from: KanbanColumn } | null>(null);

  const handleDragStart = (task: AgentTask, from: KanbanColumn) => {
    setDragging({ task, from });
  };

  const handleDrop = (to: KanbanColumn) => {
    if (!dragging || dragging.from === to) {
      setDragging(null);
      return;
    }
    setTasks((prev) => ({
      ...prev,
      [dragging.from]: prev[dragging.from].filter((t) => t.id !== dragging.task.id),
      [to]: [dragging.task, ...prev[to]],
    }));
    setDragging(null);
  };

  const priorityColor = (p: number) => {
    if (p >= 8) return "bg-status-error/20 text-status-error border-status-error/30";
    if (p >= 5) return "bg-neon-amber/10 text-neon-amber border-neon-amber/20";
    return "bg-neon-green/10 text-neon-green border-neon-green/20";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan">
        AGENT TASKS
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={cn(
              "glass-card p-3 min-h-[200px] transition-all",
              dragging && dragging.from !== col.key && "ring-1 ring-neon-cyan/30"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-surface-border">
              <div className={cn("flex items-center gap-2 text-sm font-semibold", col.color)}>
                {col.icon}
                <span>{col.label}</span>
              </div>
              <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">
                {tasks[col.key].length}
              </span>
            </div>

            {/* Tasks */}
            <div className="space-y-2">
              {tasks[col.key].map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task, col.key)}
                  className={cn(
                    "p-3 rounded-lg bg-bg-tertiary/50 border border-surface-border cursor-grab active:cursor-grabbing",
                    "hover:border-neon-cyan/20 hover:bg-bg-tertiary/80 transition-all group"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="flex items-center gap-1 text-[10px] text-neon-cyan">
                          <User className="w-2.5 h-2.5" />
                          {task.agent}
                        </span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", priorityColor(task.priority))}>
                          P{task.priority}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-text-muted ml-auto">
                          <Clock className="w-2.5 h-2.5" />
                          {task.createdAt}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {tasks[col.key].length === 0 && (
                <div className="flex items-center justify-center py-8 text-xs text-text-muted">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
