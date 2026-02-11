"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap, Bot, GitBranch, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Base Node Wrapper ─── */
function NodeShell({
  children,
  color,
  selected,
}: {
  children: React.ReactNode;
  color: string;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border px-4 py-3 min-w-[160px] transition-all",
        "bg-bg-primary/90 backdrop-blur-md shadow-lg",
      )}
      style={{
        borderColor: `var(--color-${color})`,
        opacity: selected ? 1 : 0.85,
        boxShadow: selected ? `0 0 20px color-mix(in srgb, var(--color-${color}) 30%, transparent)` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Trigger Node (green) ─── */
function TriggerNodeRaw({ data, selected }: NodeProps) {
  return (
    <NodeShell color="neon-green" selected={selected}>
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-neon-green/15">
          <Zap className="w-4 h-4 text-neon-green" />
        </div>
        <div>
          <p className="text-[10px] text-neon-green uppercase font-bold tracking-wider">Trigger</p>
          <p className="text-sm font-medium text-text-primary">{String(data.label || "Start")}</p>
        </div>
      </div>
      {typeof data.config === 'object' && data.config && (
        <p className="text-[10px] text-text-muted mt-1 font-mono">
          event: {String((data.config as Record<string, string>).event_type || "manual")}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: "var(--color-neon-green)", border: "2px solid var(--color-bg-primary)" }} />
    </NodeShell>
  );
}

/* ─── Agent Node (cyan) ─── */
function AgentNodeRaw({ data, selected }: NodeProps) {
  return (
    <NodeShell color="neon-cyan" selected={selected}>
      <Handle type="target" position={Position.Top} style={{ width: 12, height: 12, background: "var(--color-neon-cyan)", border: "2px solid var(--color-bg-primary)" }} />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-neon-cyan/15">
          <Bot className="w-4 h-4 text-neon-cyan" />
        </div>
        <div>
          <p className="text-[10px] text-neon-cyan uppercase font-bold tracking-wider">Agent</p>
          <p className="text-sm font-medium text-text-primary">{String(data.label || "Agent")}</p>
        </div>
      </div>
      {typeof data.config === 'object' && data.config && (
        <p className="text-[10px] text-text-muted mt-1 font-mono">
          @{String((data.config as Record<string, string>).agent_name || "jarvis")}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: "var(--color-neon-cyan)", border: "2px solid var(--color-bg-primary)" }} />
    </NodeShell>
  );
}

/* ─── Condition Node (amber) ─── */
function ConditionNodeRaw({ data, selected }: NodeProps) {
  return (
    <NodeShell color="neon-amber" selected={selected}>
      <Handle type="target" position={Position.Top} style={{ width: 12, height: 12, background: "var(--color-neon-amber)", border: "2px solid var(--color-bg-primary)" }} />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-neon-amber/15">
          <GitBranch className="w-4 h-4 text-neon-amber" />
        </div>
        <div>
          <p className="text-[10px] text-neon-amber uppercase font-bold tracking-wider">Condition</p>
          <p className="text-sm font-medium text-text-primary">{String(data.label || "If/Then")}</p>
        </div>
      </div>
      {typeof data.config === 'object' && data.config && (
        <p className="text-[10px] text-text-muted mt-1 font-mono truncate max-w-[140px]">
          {String((data.config as Record<string, string>).expression || "...")}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} id="true" style={{ width: 12, height: 12, background: "var(--color-neon-green)", border: "2px solid var(--color-bg-primary)", left: "30%" }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ width: 12, height: 12, background: "var(--color-neon-red)", border: "2px solid var(--color-bg-primary)", left: "70%" }} />
    </NodeShell>
  );
}

/* ─── Action Node (magenta) ─── */
function ActionNodeRaw({ data, selected }: NodeProps) {
  return (
    <NodeShell color="neon-magenta" selected={selected}>
      <Handle type="target" position={Position.Top} style={{ width: 12, height: 12, background: "var(--color-neon-magenta)", border: "2px solid var(--color-bg-primary)" }} />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-neon-magenta/15">
          <Play className="w-4 h-4 text-neon-magenta" />
        </div>
        <div>
          <p className="text-[10px] text-neon-magenta uppercase font-bold tracking-wider">Action</p>
          <p className="text-sm font-medium text-text-primary">{String(data.label || "Action")}</p>
        </div>
      </div>
      {typeof data.config === 'object' && data.config && (
        <p className="text-[10px] text-text-muted mt-1 font-mono">
          {String((data.config as Record<string, string>).action_type || "execute")}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} style={{ width: 12, height: 12, background: "var(--color-neon-magenta)", border: "2px solid var(--color-bg-primary)" }} />
    </NodeShell>
  );
}

/* ─── Memoized Exports ─── */
export const TriggerNode = memo(TriggerNodeRaw);
export const AgentNode = memo(AgentNodeRaw);
export const ConditionNode = memo(ConditionNodeRaw);
export const ActionNode = memo(ActionNodeRaw);

export const nodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  condition: ConditionNode,
  action: ActionNode,
};
