"use client";

import { useState, useCallback } from "react";
import { Settings, Save, Server, Brain, Database, Shield, Loader2 } from "lucide-react";
import { healthApi, type HealthStatus } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ============================================
   Configuration Page — connected to Brain API
   ============================================ */

export default function ConfigPage() {
  const fetchHealth = useCallback(() => healthApi.detailed(), []);
  const { data: health, loading } = useApi<HealthStatus>(
    fetchHealth,
    { status: "offline", services: { database: "offline", redis: "offline", ollama: "offline" }, timestamp: "" },
  );

  const isOnline = health.status === "ok" || health.status === "online";

  const [config, setConfig] = useState({
    primaryModel: "deepseek-v3.2",
    fallbackModel: "claude-3.5-sonnet",
    simpleTasks: "claude-3.5-haiku",
    embeddingModel: "mxbai-embed-large",
    codeModel: "qwen2.5-coder:7b",
    ollamaUrl: "http://192.168.1.100:11434",
    brainApiUrl: "http://localhost:8000",
    postgres: "postgresql://jarvis@localhost:5432/jarvis_brain",
    redis: "redis://localhost:6379/0",
    gatewayPort: "18789",
  });

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-7 h-7 text-neon-cyan" />
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">CONFIGURATION</h1>
          <p className="text-sm text-text-secondary mt-1">
            System settings and model configuration
            {loading && " — loading..."}
            {!loading && isOnline && " — connected"}
            {!loading && !isOnline && " — offline (using defaults)"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LLM Config */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4"><Brain className="w-4 h-4 text-neon-cyan" /><h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">LLM Models</h3></div>
          <div className="space-y-4">
            {[
              { label: "Primary Model", key: "primaryModel" },
              { label: "Fallback Model", key: "fallbackModel" },
              { label: "Simple Tasks", key: "simpleTasks" },
              { label: "Embedding Model", key: "embeddingModel" },
              { label: "Code Model", key: "codeModel" },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1 block">{field.label}</label>
                <input
                  value={config[field.key as keyof typeof config]}
                  onChange={(e) => updateConfig(field.key, e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm text-text-primary focus:border-neon-cyan/50 focus:outline-none transition-all"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Infrastructure */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4"><Server className="w-4 h-4 text-neon-cyan" /><h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Infrastructure</h3></div>
          <div className="space-y-4">
            {[
              { label: "Ollama URL", key: "ollamaUrl" },
              { label: "Brain API URL", key: "brainApiUrl" },
              { label: "PostgreSQL", key: "postgres" },
              { label: "Redis", key: "redis" },
              { label: "Gateway Port", key: "gatewayPort" },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1 block">{field.label}</label>
                <input
                  value={config[field.key as keyof typeof config]}
                  onChange={(e) => updateConfig(field.key, e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm font-mono text-text-primary focus:border-neon-cyan/50 focus:outline-none transition-all"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Cache Settings */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-neon-cyan" /><h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Cache & Memory</h3></div>
          <div className="space-y-4">
            {[
              { label: "Redis Max Memory", value: "512mb" },
              { label: "L1 Default TTL", value: "3600" },
              { label: "Prompt Cache", value: "enabled", type: "toggle" },
              { label: "Smart Routing", value: "enabled", type: "toggle" },
              { label: "Context Summarization", value: "enabled", type: "toggle" },
            ].map((field) => (
              <div key={field.label} className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">{field.label}</label>
                {field.type === "toggle" ? (
                  <button className="w-10 h-5 rounded-full bg-neon-green/30 relative"><span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-neon-green" /></button>
                ) : (
                  <input defaultValue={field.value} className="w-32 px-3 py-1.5 bg-bg-tertiary border border-surface-border rounded text-sm text-right font-mono text-text-primary focus:border-neon-cyan/50 focus:outline-none transition-all" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4"><Shield className="w-4 h-4 text-neon-cyan" /><h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Security</h3></div>
          <div className="space-y-4">
            {[
              { label: "API Key", value: "sk-••••••••••••" },
              { label: "Gateway Token", value: "gw-••••••••••••" },
              { label: "JWT Secret", value: "jwt-••••••••••••" },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1 block">{field.label}</label>
                <input type="password" defaultValue={field.value} className="w-full px-3 py-2 bg-bg-tertiary border border-surface-border rounded-lg text-sm font-mono text-text-primary focus:border-neon-cyan/50 focus:outline-none transition-all" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan font-medium hover:bg-neon-cyan/20 transition-all glow-cyan">
          <Save className="w-4 h-4" />
          Save Configuration
        </button>
      </div>
    </div>
  );
}
