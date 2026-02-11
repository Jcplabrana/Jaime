"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GitBranch, Play, Trash2, Plus, Loader2, List, PenTool } from "lucide-react";
import { workflowsApi, type Workflow, type WorkflowNode, type WorkflowEdge } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";
import { WorkflowBuilder } from "@/components/workflow-builder";
import type { Node, Edge } from "@xyflow/react";

/* ─── Fallback Data ─── */
const FALLBACK_WORKFLOWS: Workflow[] = [];

/* ─── Workflows Page ─── */
export default function WorkflowsPage() {
  const [activeView, setActiveView] = useState<"list" | "builder">("list");
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  const fetchWorkflows = useCallback(() => workflowsApi.list(), []);
  const { data: workflows, loading, error, refetch } = useApi<Workflow[]>(
    fetchWorkflows,
    FALLBACK_WORKFLOWS
  );

  const handleRun = async (id: string) => {
    try {
      await workflowsApi.execute(id);
      refetch();
    } catch {
      /* silently fail */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await workflowsApi.delete(id);
      refetch();
    } catch {
      /* silently fail */
    }
  };

  const handleOpenInBuilder = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setActiveView("builder");
  };

  const handleNewWorkflow = () => {
    setEditingWorkflow(null);
    setActiveView("builder");
  };

  const handleSave = async (data: { name: string; nodes: Node[]; edges: Edge[] }) => {
    try {
      const apiNodes: WorkflowNode[] = data.nodes.map((n) => ({
        id: n.id,
        type: (n.type || "action") as WorkflowNode["type"],
        label: String(n.data?.label || ""),
        config: (n.data?.config || {}) as Record<string, unknown>,
        position: n.position,
      }));

      const apiEdges: WorkflowEdge[] = data.edges.map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label as string | undefined,
      }));

      if (editingWorkflow) {
        // Update: delete old + create new (since our API doesn't have PUT)
        await workflowsApi.delete(editingWorkflow.id);
      }

      await workflowsApi.create({
        name: data.name,
        nodes: apiNodes,
        edges: apiEdges,
        is_active: true,
      });

      setActiveView("list");
      setEditingWorkflow(null);
      refetch();
    } catch {
      /* silently fail */
    }
  };

  /* ─── Convert API workflow to ReactFlow format ─── */
  const toReactFlowNodes = (wf: Workflow): Node[] =>
    wf.nodes.map((n, i) => ({
      id: n.id,
      type: n.type,
      position: n.position || { x: 100 + (i % 3) * 250, y: 100 + Math.floor(i / 3) * 150 },
      data: { label: n.label, config: n.config },
    }));

  const toReactFlowEdges = (wf: Workflow): Edge[] =>
    wf.edges.map((e, i) => ({
      id: `e-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: true,
      style: { stroke: "var(--color-neon-cyan)", strokeWidth: 2 },
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-7 h-7 text-neon-cyan" />
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-neon-cyan glow-text-cyan">
              WORKFLOWS
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Automate multi-step agent pipelines
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-bg-tertiary/50 border border-surface-border">
            <button
              onClick={() => { setActiveView("list"); setEditingWorkflow(null); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                activeView === "list"
                  ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={handleNewWorkflow}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                activeView === "builder"
                  ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <PenTool className="w-3.5 h-3.5" />
              Builder
            </button>
          </div>

          {activeView === "list" && (
            <button
              onClick={handleNewWorkflow}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm hover:bg-neon-cyan/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Workflow
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading workflows...</span>
        </div>
      )}

      {error && (
        <div className="glass-card p-4 border-neon-amber/30">
          <p className="text-sm text-neon-amber">⚠️ Brain API offline — showing cached data</p>
        </div>
      )}

      {/* ─── List View ─── */}
      {activeView === "list" && workflows.length === 0 && !loading && (
        <div className="glass-card p-12 text-center">
          <GitBranch className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-secondary mb-2">No workflows yet</h3>
          <p className="text-sm text-text-muted mb-4">Create your first workflow to automate agent pipelines</p>
          <button
            onClick={handleNewWorkflow}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm hover:bg-neon-cyan/20 transition-colors"
          >
            <PenTool className="w-4 h-4" />
            Open Builder
          </button>
        </div>
      )}

      {activeView === "list" && workflows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className="glass-card p-5 group cursor-pointer hover:ring-1 hover:ring-neon-cyan/20 transition-all"
                  onClick={() => handleOpenInBuilder(wf)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{wf.name}</h3>
                      {wf.description && (
                        <p className="text-xs text-text-muted mt-1">{wf.description}</p>
                      )}
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] uppercase font-bold border",
                      wf.is_active
                        ? "bg-neon-green/10 text-neon-green border-neon-green/20"
                        : "bg-text-muted/10 text-text-muted border-text-muted/20"
                    )}>
                      {wf.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
                    <span>{wf.nodes.length} nodes</span>
                    <span>{wf.edges.length} edges</span>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRun(wf.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-neon-green/10 text-neon-green text-xs border border-neon-green/20 hover:bg-neon-green/20 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Run
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(wf.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-neon-red/10 text-neon-red text-xs border border-neon-red/20 hover:bg-neon-red/20 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

      {/* ─── Builder View ─── */}
      {activeView === "builder" && (
        <WorkflowBuilder
          initialNodes={editingWorkflow ? toReactFlowNodes(editingWorkflow) : []}
          initialEdges={editingWorkflow ? toReactFlowEdges(editingWorkflow) : []}
          workflowName={editingWorkflow?.name || "Untitled Workflow"}
          workflowId={editingWorkflow?.id}
          onSave={handleSave}
          onClose={() => { setActiveView("list"); setEditingWorkflow(null); }}
        />
      )}
    </div>
  );
}
