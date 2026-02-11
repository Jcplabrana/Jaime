"use client";

import { useState, useCallback } from "react";
import {
  Brain,
  Play,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Plus,
  BarChart3,
  Loader2,
  X,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trainingApi } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ─── Types ─── */
interface Scenario {
  id: string;
  text: string;
  expected: string | null;
  difficulty: string;
  category: string | null;
  agent: string | null;
  status: "ready" | "running" | "completed";
  actualResponse?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

interface TrainingStats {
  total_runs: number;
  positive: number;
  negative: number;
  edited: number;
  success_rate: number;
  avg_tokens: number;
  avg_latency_ms: number;
}

/* ─── Fallbacks ─── */
const FALLBACK_SCENARIOS: Scenario[] = [];
const FALLBACK_STATS: TrainingStats = {
  total_runs: 0, positive: 0, negative: 0, edited: 0,
  success_rate: 0, avg_tokens: 0, avg_latency_ms: 0,
};

/* ─── Component ─── */
export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<"scenarios" | "stats">("scenarios");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Local state for scenarios (to track run/completion status)
  const [localScenarios, setLocalScenarios] = useState<Scenario[]>([]);
  const [hasLocalData, setHasLocalData] = useState(false);

  const fetchScenarios = useCallback(() =>
    trainingApi.scenarios().then((raw) => {
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((r) => ({
          id: String(r.id || ""),
          text: String(r.scenario_text || ""),
          expected: (r.expected_response || null) as string | null,
          difficulty: String(r.difficulty || "medium"),
          category: (r.category || null) as string | null,
          agent: (r.agent_name || null) as string | null,
          status: "ready" as const,
        }));
      }
      return FALLBACK_SCENARIOS;
    }),
    []
  );

  const fetchStats = useCallback(() =>
    trainingApi.stats().then((raw) => {
      if (raw && typeof raw === "object" && "total_runs" in raw) return raw;
      return FALLBACK_STATS;
    }),
    []
  );

  const { data: apiScenarios, loading, refetch } = useApi<Scenario[]>(fetchScenarios, FALLBACK_SCENARIOS);
  const { data: stats, refetch: refetchStats } = useApi<TrainingStats>(fetchStats, FALLBACK_STATS);

  const scenarios = hasLocalData ? localScenarios : apiScenarios;

  /* ─── Handlers ─── */

  const handleRun = async (scenarioId: string) => {
    // Set running state
    const updated = scenarios.map((s) =>
      s.id === scenarioId ? { ...s, status: "running" as const } : s,
    );
    setLocalScenarios(updated);
    setHasLocalData(true);

    try {
      const result = await trainingApi.runScenario(scenarioId);
      setLocalScenarios((prev) =>
        prev.map((s) =>
          s.id === scenarioId
            ? {
                ...s,
                status: "completed" as const,
                actualResponse: result.actual_response,
                tokensUsed: result.tokens_used,
                latencyMs: result.latency_ms,
              }
            : s,
        ),
      );
    } catch {
      setLocalScenarios((prev) =>
        prev.map((s) =>
          s.id === scenarioId ? { ...s, status: "ready" as const } : s,
        ),
      );
    }
  };

  const handleFeedback = async (
    scenario: Scenario,
    type: "thumbs_up" | "thumbs_down" | "edit",
  ) => {
    if (type === "edit") {
      setEditingId(scenario.id);
      setEditText(scenario.actualResponse || "");
      return;
    }

    try {
      await trainingApi.submitFeedback({
        scenario_id: scenario.id,
        agent_name: scenario.agent || "jarvis",
        actual_response: scenario.actualResponse || "",
        feedback: type,
        tokens_used: scenario.tokensUsed || 0,
        latency_ms: scenario.latencyMs || 0,
      });
      refetchStats();
    } catch {
      /* silently continue */
    }
  };

  const handleEditSubmit = async (scenario: Scenario) => {
    try {
      await trainingApi.submitFeedback({
        scenario_id: scenario.id,
        agent_name: scenario.agent || "jarvis",
        actual_response: scenario.actualResponse || "",
        feedback: "edit",
        edited_response: editText,
        tokens_used: scenario.tokensUsed || 0,
        latency_ms: scenario.latencyMs || 0,
      });
      setEditingId(null);
      setEditText("");
      refetchStats();
    } catch {
      /* silently continue */
    }
  };

  const handleCreateScenario = async (formData: {
    scenario_text: string;
    expected_response: string;
    difficulty: string;
    category: string;
    agent_name: string;
  }) => {
    try {
      await trainingApi.createScenario(formData as never);
      setShowNewModal(false);
      setHasLocalData(false);
      refetch();
    } catch {
      /* silently continue */
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-neon-cyan glow-text-cyan">
            TRAINING MODE
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Train agents with scenarios and feedback loops
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm hover:bg-neon-cyan/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Scenario
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading training data...</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary/50 border border-surface-border w-fit">
        {(["scenarios", "stats"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab === "scenarios" ? "Scenarios" : "Statistics"}
          </button>
        ))}
      </div>

      {activeTab === "scenarios" ? (
        <div className="space-y-3">
          {scenarios.length > 0 ? scenarios.map((scenario) => (
            <div key={scenario.id} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-neon-magenta/10 border border-neon-magenta/20">
                    <Brain className="w-4 h-4 text-neon-magenta" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{scenario.text.slice(0, 80)}{scenario.text.length > 80 ? "..." : ""}</span>
                      {scenario.category && (
                        <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted border border-surface-border">
                          {scenario.category}
                        </span>
                      )}
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full border",
                        scenario.difficulty === "easy" ? "bg-neon-green/10 text-neon-green border-neon-green/20" :
                        scenario.difficulty === "hard" ? "bg-neon-amber/10 text-neon-amber border-neon-amber/20" :
                        scenario.difficulty === "expert" ? "bg-neon-red/10 text-neon-red border-neon-red/20" :
                        "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20"
                      )}>
                        {scenario.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      Agent: <span className="text-neon-cyan">@{scenario.agent || "jarvis"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {scenario.status === "completed" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleFeedback(scenario, "thumbs_up")}
                        className="p-1.5 rounded-md bg-neon-green/10 border border-neon-green/20 text-neon-green hover:bg-neon-green/20 transition-all"
                        title="Good response"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(scenario, "thumbs_down")}
                        className="p-1.5 rounded-md bg-neon-red/10 border border-neon-red/20 text-neon-red hover:bg-neon-red/20 transition-all"
                        title="Bad response"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(scenario, "edit")}
                        className="p-1.5 rounded-md bg-neon-amber/10 border border-neon-amber/20 text-neon-amber hover:bg-neon-amber/20 transition-all"
                        title="Edit response"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {scenario.status === "ready" && (
                    <button
                      onClick={() => handleRun(scenario.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neon-green/10 border border-neon-green/20 text-neon-green text-xs hover:bg-neon-green/20 transition-all"
                    >
                      <Play className="w-3 h-3" />
                      Run
                    </button>
                  )}
                  {scenario.status === "running" && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neon-cyan/10 text-neon-cyan text-xs">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Running
                    </span>
                  )}
                </div>
              </div>

              {/* Response area (shown after run) */}
              {scenario.status === "completed" && scenario.actualResponse && (
                <div className="mt-3 pt-3 border-t border-surface-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-text-muted">Agent Response:</span>
                    <div className="flex gap-3 text-[10px] text-text-muted">
                      <span>{scenario.tokensUsed} tokens</span>
                      <span>{scenario.latencyMs}ms</span>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary bg-bg-tertiary/50 rounded-lg p-3 whitespace-pre-wrap">
                    {scenario.actualResponse}
                  </p>

                  {/* Edit mode */}
                  {editingId === scenario.id && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg bg-bg-secondary border border-neon-amber/30 text-sm text-text-primary p-3 focus:outline-none focus:border-neon-amber/60 resize-none"
                        placeholder="Edit the response..."
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-secondary transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditSubmit(scenario)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-neon-amber/10 border border-neon-amber/30 text-neon-amber text-xs hover:bg-neon-amber/20 transition-all"
                        >
                          <Send className="w-3 h-3" />
                          Submit Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )) : (
            <div className="glass-card p-10 text-center">
              <Brain className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">No training scenarios yet — create one to start training agents</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 text-center">
            <BarChart3 className="w-8 h-8 text-neon-cyan mx-auto mb-3" />
            <p className="text-3xl font-bold font-mono">{stats.total_runs}</p>
            <p className="text-sm text-text-secondary mt-1">Total Sessions</p>
          </div>
          <div className="glass-card p-5 text-center">
            <ThumbsUp className="w-8 h-8 text-neon-green mx-auto mb-3" />
            <p className="text-3xl font-bold font-mono text-neon-green">
              {(stats.success_rate * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-text-secondary mt-1">Success Rate</p>
          </div>
          <div className="glass-card p-5">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">👍 Thumbs Up</span>
                <span className="text-neon-green font-mono">{stats.positive}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">👎 Thumbs Down</span>
                <span className="text-neon-red font-mono">{stats.negative}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">✏️ Edits</span>
                <span className="text-neon-amber font-mono">{stats.edited}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-surface-border pt-3">
                <span className="text-text-muted">Avg Latency</span>
                <span className="text-text-primary font-mono">{stats.avg_latency_ms}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Avg Tokens</span>
                <span className="text-text-primary font-mono">{stats.avg_tokens}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Scenario Modal */}
      {showNewModal && (
        <NewScenarioModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreateScenario}
        />
      )}
    </div>
  );
}

/* ─── New Scenario Modal ─── */

function NewScenarioModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    scenario_text: string;
    expected_response: string;
    difficulty: string;
    category: string;
    agent_name: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    scenario_text: "",
    expected_response: "",
    difficulty: "medium",
    category: "",
    agent_name: "jarvis",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.scenario_text.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neon-cyan">New Training Scenario</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Scenario Text *</label>
            <textarea
              value={form.scenario_text}
              onChange={(e) => setForm({ ...form, scenario_text: e.target.value })}
              rows={3}
              className="w-full rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary p-3 focus:outline-none focus:border-neon-cyan/50 resize-none"
              placeholder="Describe the scenario for the agent..."
              required
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Expected Response</label>
            <textarea
              value={form.expected_response}
              onChange={(e) => setForm({ ...form, expected_response: e.target.value })}
              rows={2}
              className="w-full rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary p-3 focus:outline-none focus:border-neon-cyan/50 resize-none"
              placeholder="What should the ideal response look like?"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary p-2 focus:outline-none focus:border-neon-cyan/50"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary p-2 focus:outline-none focus:border-neon-cyan/50"
                placeholder="e.g. code"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Agent</label>
              <input
                value={form.agent_name}
                onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                className="w-full rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary p-2 focus:outline-none focus:border-neon-cyan/50"
                placeholder="jarvis"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-all">
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm hover:bg-neon-cyan/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Scenario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
