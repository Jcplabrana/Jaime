"use client";

import { useCallback } from "react";
import { Cpu, Zap, Cloud, HardDrive, Check, Settings2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ─── Types ─── */
interface ModelConfig {
  id: string;
  name: string;
  provider: "ollama" | "openrouter" | "anthropic" | "openai";
  type: "local" | "cloud";
  costPer1k: number;
  latencyMs: number;
  usedBy: string[];
  isDefault: boolean;
}

/* ─── Fallback Data ─── */
const FALLBACK_MODELS: ModelConfig[] = [
  { id: "phi3", name: "Phi-3 Mini", provider: "ollama", type: "local", costPer1k: 0, latencyMs: 120, usedBy: ["summarization", "embeddings"], isDefault: false },
  { id: "llama3", name: "Llama 3.1 8B", provider: "ollama", type: "local", costPer1k: 0, latencyMs: 200, usedBy: ["background-tasks", "code-review"], isDefault: false },
  { id: "claude-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic", type: "cloud", costPer1k: 3.0, latencyMs: 800, usedBy: ["jarvis", "frontend", "backend"], isDefault: true },
  { id: "blockrun-auto", name: "Blockrun Auto", provider: "openrouter", type: "cloud", costPer1k: 1.5, latencyMs: 600, usedBy: ["fallback"], isDefault: false },
  { id: "gpt4o-mini", name: "GPT-4o Mini", provider: "openai", type: "cloud", costPer1k: 0.15, latencyMs: 400, usedBy: ["docs", "training"], isDefault: false },
];

const providerConfig = {
  ollama: { label: "Ollama (Local)", icon: <HardDrive className="w-4 h-4" />, color: "text-neon-green", bg: "bg-neon-green/10 border-neon-green/20" },
  openrouter: { label: "OpenRouter", icon: <Cloud className="w-4 h-4" />, color: "text-neon-cyan", bg: "bg-neon-cyan/10 border-neon-cyan/20" },
  anthropic: { label: "Anthropic", icon: <Cpu className="w-4 h-4" />, color: "text-neon-magenta", bg: "bg-neon-magenta/10 border-neon-magenta/20" },
  openai: { label: "OpenAI", icon: <Zap className="w-4 h-4" />, color: "text-neon-amber", bg: "bg-neon-amber/10 border-neon-amber/20" },
};

/* ─── Component ─── */
export default function ModelsPage() {
  const fetchModels = useCallback(() =>
    analyticsApi.modelDistribution().then((raw) => {
      if (Array.isArray(raw) && raw.length > 0) return raw as unknown as ModelConfig[];
      return FALLBACK_MODELS;
    }),
    []
  );

  const { data: models, loading } = useApi<ModelConfig[]>(fetchModels, FALLBACK_MODELS);

  const localModels = models.filter((m) => m.type === "local");
  const cloudModels = models.filter((m) => m.type === "cloud");

  const ModelCard = ({ model }: { model: ModelConfig }) => {
    const provider = providerConfig[model.provider] || providerConfig.openrouter;
    return (
      <div className="glass-card p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg border", provider.bg, provider.color)}>
              {provider.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{model.name}</span>
                {model.isDefault && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20">
                    <Check className="w-2.5 h-2.5" /> DEFAULT
                  </span>
                )}
              </div>
              <span className={cn("text-xs", provider.color)}>{provider.label}</span>
            </div>
          </div>
          <button className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50 transition-all">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center p-2 rounded bg-bg-tertiary/30">
            <p className="text-xs text-text-muted">Cost/1K</p>
            <p className={cn("text-sm font-mono font-bold", model.costPer1k === 0 ? "text-neon-green" : "text-text-primary")}>
              {model.costPer1k === 0 ? "FREE" : `$${model.costPer1k}`}
            </p>
          </div>
          <div className="text-center p-2 rounded bg-bg-tertiary/30">
            <p className="text-xs text-text-muted">Latency</p>
            <p className="text-sm font-mono font-bold">{model.latencyMs}ms</p>
          </div>
          <div className="text-center p-2 rounded bg-bg-tertiary/30">
            <p className="text-xs text-text-muted">Agents</p>
            <p className="text-sm font-mono font-bold">{model.usedBy?.length || 0}</p>
          </div>
        </div>

        {model.usedBy && model.usedBy.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {model.usedBy.map((agent) => (
              <span key={agent} className="text-[10px] px-2 py-0.5 rounded bg-bg-tertiary text-text-muted border border-surface-border">
                {agent}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
          MODEL SELECTOR
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure AI models — local GPU ($0) and cloud providers
          {loading && " — loading..."}
        </p>
      </div>

      {/* Local Models */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neon-green mb-3 flex items-center gap-2">
          <HardDrive className="w-4 h-4" /> Local Models (GPU — $0)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localModels.map((m) => <ModelCard key={m.id} model={m} />)}
        </div>
      </div>

      {/* Cloud Models */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neon-cyan mb-3 flex items-center gap-2">
          <Cloud className="w-4 h-4" /> Cloud Models
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cloudModels.map((m) => <ModelCard key={m.id} model={m} />)}
        </div>
      </div>
    </div>
  );
}
