"use client";

import { useState, useCallback } from "react";
import {
  MessageSquare,
  Phone,
  Globe,
  Mail,
  ToggleLeft,
  ToggleRight,
  Settings2,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agentsApi, type AgentConfig } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ─── Types ─── */
interface Channel {
  id: string;
  name: string;
  type: "telegram" | "whatsapp" | "discord" | "email" | "web";
  status: "connected" | "disconnected" | "pending";
  agent: string;
  messagesPerDay: number;
  enabled: boolean;
}

/* ─── Fallback Data ─── */
const FALLBACK_CHANNELS: Channel[] = [
  { id: "1", name: "Telegram Bot", type: "telegram", status: "disconnected", agent: "jarvis", messagesPerDay: 0, enabled: false },
  { id: "2", name: "WhatsApp Business", type: "whatsapp", status: "pending", agent: "jarvis", messagesPerDay: 0, enabled: false },
  { id: "3", name: "Discord Server", type: "discord", status: "disconnected", agent: "moltbook", messagesPerDay: 0, enabled: false },
  { id: "4", name: "Email Integration", type: "email", status: "disconnected", agent: "docs", messagesPerDay: 0, enabled: false },
  { id: "5", name: "Web Widget", type: "web", status: "disconnected", agent: "frontend", messagesPerDay: 0, enabled: false },
];

const channelIcons = {
  telegram: <MessageSquare className="w-5 h-5" />,
  whatsapp: <Phone className="w-5 h-5" />,
  discord: <MessageSquare className="w-5 h-5" />,
  email: <Mail className="w-5 h-5" />,
  web: <Globe className="w-5 h-5" />,
};

const statusConfig = {
  connected: { color: "bg-status-online", text: "Connected", textColor: "text-status-online" },
  disconnected: { color: "bg-status-offline", text: "Disconnected", textColor: "text-status-offline" },
  pending: { color: "bg-status-warning", text: "Pending", textColor: "text-status-warning" },
};

/* ─── Component ─── */
export default function ChannelsPage() {
  const [channels, setChannels] = useState(FALLBACK_CHANNELS);

  // Load agents to populate available agent names
  const fetchAgents = useCallback(() => agentsApi.list().then((r) => r.agents || []), []);
  const { data: agents, loading } = useApi<AgentConfig[]>(fetchAgents, []);

  const toggleChannel = (id: string) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-orbitron)] tracking-wider text-neon-cyan glow-text-cyan">
            CHANNELS
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage communication channels for Jarvis agents
            {agents.length > 0 && ` — ${agents.length} agents available`}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm hover:bg-neon-cyan/20 transition-all">
          <Plus className="w-4 h-4" />
          Add Channel
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading agents...</span>
        </div>
      )}

      {/* Channel Cards */}
      <div className="space-y-3">
        {channels.map((channel) => {
          const status = statusConfig[channel.status];
          return (
            <div key={channel.id} className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-lg border",
                    channel.enabled
                      ? "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan"
                      : "bg-bg-tertiary/50 border-surface-border text-text-muted"
                  )}>
                    {channelIcons[channel.type]}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{channel.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", status.color, channel.status === "connected" && "animate-pulse-glow")} />
                        <span className={cn("text-xs", status.textColor)}>{status.text}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      <span>Agent: <span className="text-neon-cyan">@{channel.agent}</span></span>
                      {channel.messagesPerDay > 0 && (
                        <span>{channel.messagesPerDay} msgs/day</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary/50 transition-all">
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleChannel(channel.id)}
                    className="text-text-muted hover:text-neon-cyan transition-all"
                  >
                    {channel.enabled ? (
                      <ToggleRight className="w-8 h-8 text-neon-green" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
