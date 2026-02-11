"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Users, Play, CheckCircle2, XCircle, Clock, ChevronRight,
  Loader2, Send, X, Bot, Cpu, Cloud,
} from "lucide-react";
import { agentsApi, type AgentConfig, type AgentTask, type AgentListResponse, type AgentTasksResponse } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";

/* ============================================
   Fallback Data
   ============================================ */

const FALLBACK_AGENTS: AgentListResponse = {
  agents: [
    { name: "jarvis", role: "orchestrator", description: "Orchestrator principal", model: { primary: "blockrun/auto" }, capabilities: [], status: "active" },
    { name: "projects", role: "pipeline_manager", description: "Pipeline Manager", model: { primary: "blockrun/auto" }, capabilities: [], status: "active" },
    { name: "security", role: "security_auditor", description: "Security Auditor", model: { primary: "blockrun/auto" }, capabilities: [], status: "active" },
    { name: "frontend", role: "frontend_developer", description: "Frontend Dev", model: { primary: "blockrun/auto" }, capabilities: [], status: "active" },
    { name: "backend", role: "backend_developer", description: "Backend Dev", model: { primary: "blockrun/auto" }, capabilities: [], status: "active" },
    { name: "docs", role: "documentation", description: "Documentation", model: { primary: "ollama/phi3" }, capabilities: [], status: "active" },
    { name: "workspace", role: "workspace_manager", description: "Workspace Mgr", model: { primary: "ollama/phi3" }, capabilities: [], status: "active" },
    { name: "backup", role: "backup_recovery", description: "Backup Ops", model: { primary: "ollama/phi3" }, capabilities: [], status: "active" },
    { name: "moltbook", role: "social_network", description: "Social Network", model: { primary: "ollama/phi3" }, capabilities: [], status: "active" },
  ],
  total: 9,
  active: 9,
};

/* ============================================
   Task Card
   ============================================ */

function TaskCard({ task }: { task: AgentTask }) {
  return (
    <div className="group p-3 rounded-lg bg-bg-tertiary/50 border border-surface-border hover:border-neon-cyan/20 transition-all">
      <div className="flex items-start justify-between mb-2">
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
          task.priority >= 8 ? "bg-neon-red/10 text-neon-red" :
          task.priority >= 5 ? "bg-neon-amber/10 text-neon-amber" :
          "bg-text-muted/10 text-text-muted"
        )}>
          P{task.priority}
        </span>
        <span className="text-[10px] text-text-muted">{task.delegated_by}</span>
      </div>
      <p className="text-sm text-text-primary mb-1">{task.title}</p>
      {task.description && (
        <p className="text-xs text-text-muted line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-text-muted">
          {task.created_at ? new Date(task.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
        {task.error_message && (
          <span className="text-[10px] text-neon-red truncate max-w-[120px]">{task.error_message}</span>
        )}
      </div>
    </div>
  );
}

/* ============================================
   Delegate Modal
   ============================================ */

function DelegateModal({
  agents,
  onClose,
  onDelegate,
}: {
  agents: AgentConfig[];
  onClose: () => void;
  onDelegate: (data: { title: string; description: string; target_agent: string; priority: number }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAgent, setTargetAgent] = useState(agents[0]?.name || "");
  const [priority, setPriority] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAgent) return;
    setSubmitting(true);
    try {
      await onDelegate({ title, description, target_agent: targetAgent, priority });
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-md mx-4 border border-neon-cyan/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neon-cyan flex items-center gap-2">
            <Send className="w-5 h-5" /> Delegate Task
          </h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-1 block">Title</label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="Task title..."
              className="w-full px-3 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm text-text-primary focus:border-neon-cyan/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="What should the agent do?"
              className="w-full px-3 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm text-text-primary focus:border-neon-cyan/50 focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider mb-1 block">Target Agent</label>
              <select
                value={targetAgent} onChange={(e) => setTargetAgent(e.target.value)}
                className="w-full px-3 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm text-text-primary focus:border-neon-cyan/50 focus:outline-none"
              >
                {agents.map((a) => (
                  <option key={a.name} value={a.name}>@{a.name} — {a.role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider mb-1 block">Priority (1-10)</label>
              <input
                type="number" min={1} max={10} value={priority} onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm text-text-primary focus:border-neon-cyan/50 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !title}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan font-medium hover:bg-neon-cyan/20 transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? "Delegating..." : "Delegate Task"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================
   Agents Page
   ============================================ */

export default function AgentsPage() {
  const fetchAgents = useCallback(() => agentsApi.list(), []);
  const { data: response, loading, refetch } = useApi<AgentListResponse>(fetchAgents, FALLBACK_AGENTS);

  const agents = response.agents || FALLBACK_AGENTS.agents;

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);

  // Load tasks for selected agent
  useEffect(() => {
    if (!selectedAgent) {
      setTasks([]);
      return;
    }
    setTasksLoading(true);
    agentsApi.getTasks(selectedAgent)
      .then((res) => setTasks(res.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [selectedAgent]);

  const handleDelegate = async (data: { title: string; description: string; target_agent: string; priority: number }) => {
    await agentsApi.delegate(data);
    refetch();
    if (selectedAgent === data.target_agent) {
      const res = await agentsApi.getTasks(data.target_agent);
      setTasks(res.tasks || []);
    }
  };

  /* ─── Real-time: auto-refresh tasks on WS events ─── */
  const { subscribe } = useRealtimeUpdates();

  useEffect(() => {
    const unsub1 = subscribe("agent.task_started", (data) => {
      // If the new task is for the currently selected agent, refresh tasks
      if (selectedAgent && String(data.agent) === selectedAgent) {
        agentsApi.getTasks(selectedAgent)
          .then((res) => setTasks(res.tasks || []))
          .catch(() => {});
      }
      refetch();
    });

    const unsub2 = subscribe("agent.task_completed", () => {
      if (selectedAgent) {
        agentsApi.getTasks(selectedAgent)
          .then((res) => setTasks(res.tasks || []))
          .catch(() => {});
      }
      refetch();
    });

    return () => { unsub1(); unsub2(); };
  }, [subscribe, selectedAgent, refetch]);

  // Group tasks by status for kanban
  const tasksByStatus = {
    inbox: tasks.filter((t) => t.status === "inbox"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed"),
    failed: tasks.filter((t) => t.status === "failed" || t.status === "cancelled"),
  };

  const columns = [
    { id: "inbox", title: "Inbox", color: "text-neon-cyan", bgColor: "bg-neon-cyan/5", borderColor: "border-neon-cyan/20", icon: <Clock className="w-4 h-4" />, tasks: tasksByStatus.inbox },
    { id: "in_progress", title: "In Progress", color: "text-neon-amber", bgColor: "bg-neon-amber/5", borderColor: "border-neon-amber/20", icon: <Play className="w-4 h-4" />, tasks: tasksByStatus.in_progress },
    { id: "completed", title: "Completed", color: "text-neon-green", bgColor: "bg-neon-green/5", borderColor: "border-neon-green/20", icon: <CheckCircle2 className="w-4 h-4" />, tasks: tasksByStatus.completed },
    { id: "failed", title: "Failed", color: "text-neon-red", bgColor: "bg-neon-red/5", borderColor: "border-neon-red/20", icon: <XCircle className="w-4 h-4" />, tasks: tasksByStatus.failed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
            AGENTS
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {response.active}/{response.total} agents active
            {selectedAgent && ` — viewing @${selectedAgent}`}
          </p>
        </div>
        <button
          onClick={() => setShowDelegate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm hover:bg-neon-cyan/20 transition-all"
        >
          <Send className="w-4 h-4" />
          Delegate Task
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading agents...</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Kanban Board */}
        <div className="lg:col-span-3 space-y-4">
          {selectedAgent ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => setSelectedAgent(null)} className="text-text-muted hover:text-neon-cyan transition-all">
                  All Agents
                </button>
                <ChevronRight className="w-3 h-3 text-text-muted" />
                <span className="text-neon-cyan font-medium">@{selectedAgent}</span>
                {tasksLoading && <Loader2 className="w-3 h-3 animate-spin text-neon-amber" />}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {columns.map((column) => (
                  <div key={column.id} className="glass-card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className={column.color}>{column.icon}</span>
                        <h3 className={cn("text-sm font-semibold", column.color)}>{column.title}</h3>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs border", column.bgColor, column.borderColor, column.color)}>
                        {column.tasks.length}
                      </span>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {column.tasks.length > 0 ? (
                        column.tasks.map((task) => <TaskCard key={task.id} task={task} />)
                      ) : (
                        <p className="text-xs text-text-muted text-center py-4">No tasks</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Agent Grid when none selected */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {agents.map((agent) => {
                const isLocal = agent.model?.primary?.includes("ollama");
                return (
                  <button
                    key={agent.name}
                    onClick={() => setSelectedAgent(agent.name)}
                    className="glass-card p-4 text-left hover:border-neon-cyan/30 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg border",
                          isLocal ? "bg-neon-amber/10 border-neon-amber/20 text-neon-amber" : "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan"
                        )}>
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">@{agent.name}</p>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider">{agent.role?.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <span className={cn("w-2 h-2 rounded-full", agent.status === "active" ? "bg-neon-green animate-pulse" : "bg-text-muted")} />
                    </div>

                    <p className="text-xs text-text-secondary line-clamp-2 mb-3">{agent.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                        {isLocal ? <Cpu className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                        <span>{agent.model?.primary}</span>
                      </div>
                      {agent.stats && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-neon-green">{agent.stats.completed}✓</span>
                          {agent.stats.failed > 0 && <span className="text-neon-red">{agent.stats.failed}✗</span>}
                          {agent.stats.in_progress > 0 && <span className="text-neon-amber">{agent.stats.in_progress}⟳</span>}
                        </div>
                      )}
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-neon-cyan transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Agent Sidebar */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            All Agents ({agents.length})
          </h3>
          <div className="space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.name}
                onClick={() => setSelectedAgent(agent.name)}
                className={cn(
                  "flex items-center justify-between w-full p-3 rounded-lg border transition-all text-left",
                  selectedAgent === agent.name
                    ? "bg-neon-cyan/10 border-neon-cyan/20"
                    : "bg-bg-tertiary/30 border-surface-border hover:border-neon-cyan/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    agent.model?.primary?.includes("ollama") ? "bg-neon-amber" : "bg-neon-green animate-pulse"
                  )} />
                  <div>
                    <p className={cn("text-sm font-medium", selectedAgent === agent.name ? "text-neon-cyan" : "text-text-primary")}>
                      @{agent.name}
                    </p>
                    <p className="text-[10px] text-text-muted">{agent.role?.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <ChevronRight className={cn("w-4 h-4", selectedAgent === agent.name ? "text-neon-cyan" : "text-text-muted")} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Delegate Modal */}
      {showDelegate && (
        <DelegateModal
          agents={agents}
          onClose={() => setShowDelegate(false)}
          onDelegate={handleDelegate}
        />
      )}
    </div>
  );
}
