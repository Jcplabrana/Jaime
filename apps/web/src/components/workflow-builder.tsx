"use client";

import { useState, useCallback, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, Trash2, Zap, Bot, GitBranch, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { nodeTypes } from "./workflow-nodes";

/* ─── Types ─── */
interface WorkflowBuilderProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  workflowName?: string;
  workflowId?: string;
  onSave?: (data: { name: string; nodes: Node[]; edges: Edge[] }) => void;
  onClose?: () => void;
}

/* ─── Sidebar Panel Items ─── */
const PANEL_ITEMS = [
  { type: "trigger", label: "Trigger", icon: Zap, color: "neon-green" },
  { type: "agent", label: "Agent", icon: Bot, color: "neon-cyan" },
  { type: "condition", label: "Condition", icon: GitBranch, color: "neon-amber" },
  { type: "action", label: "Action", icon: Play, color: "neon-magenta" },
] as const;

let nodeIdCounter = 0;
const getNodeId = () => `node_${++nodeIdCounter}_${Date.now()}`;

/* ─── Component ─── */
export function WorkflowBuilder({
  initialNodes = [],
  initialEdges = [],
  workflowName = "Untitled Workflow",
  onSave,
  onClose,
}: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [name, setName] = useState(workflowName);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "var(--color-neon-cyan)", strokeWidth: 2 },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  /* ─── Drag & Drop ─── */
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;

      const bounds = wrapper.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 80,
        y: event.clientY - bounds.top - 30,
      };

      const newNode: Node = {
        id: getNodeId(),
        type,
        position,
        data: {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const handleSave = () => {
    onSave?.({ name, nodes, edges });
  };

  const handleClear = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="flex h-[calc(100vh-160px)] gap-4">
      {/* ─── Side Panel ─── */}
      <div className="w-48 shrink-0 space-y-3">
        {/* Workflow Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-neon-cyan/50"
          placeholder="Workflow name"
        />

        {/* Node Palette */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
            Drag to canvas
          </p>
          {PANEL_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.type}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all",
                  `bg-${item.color}/5 border-${item.color}/20 hover:border-${item.color}/40 text-${item.color}`
                )}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/reactflow", item.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-3 border-t border-surface-border">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs hover:bg-neon-cyan/20 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Save Workflow
          </button>
          <button
            onClick={handleClear}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-neon-red/10 border border-neon-red/30 text-neon-red text-xs hover:bg-neon-red/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Canvas
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary transition-all"
            >
              ← Back to List
            </button>
          )}
        </div>
      </div>

      {/* ─── Canvas ─── */}
      <div
        ref={reactFlowWrapper}
        className="flex-1 rounded-xl border border-surface-border overflow-hidden bg-bg-tertiary/30"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "var(--color-neon-cyan)", strokeWidth: 2 },
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255,255,255,0.05)"
          />
          <Controls
            className="bg-bg-secondary! border-surface-border! rounded-lg! [&>button]:bg-bg-primary! [&>button]:border-surface-border! [&>button]:text-text-muted! [&>button:hover]:text-text-primary!"
          />
          <MiniMap
            className="bg-bg-secondary! border-surface-border! rounded-lg!"
            nodeColor={(node) => {
              const colors: Record<string, string> = {
                trigger: "#22c55e",
                agent: "#06b6d4",
                condition: "#f59e0b",
                action: "#ec4899",
              };
              return colors[node.type || ""] || "#6b7280";
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
