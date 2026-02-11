"use client";

import { useState, useCallback } from "react";
import {
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pncpApi, type Licitacao } from "@/lib/brain-api";
import { useApi } from "@/hooks/use-api";

/* ─── Helpers ─── */
function getScoreBadge(score: number | null | undefined) {
  if (score == null)
    return { label: "PENDING", color: "bg-bg-tertiary text-text-muted border-surface-border" };
  if (score >= 7)
    return { label: `${score.toFixed(1)} HIGH`, color: "bg-neon-green/10 text-neon-green border-neon-green/20" };
  if (score >= 4)
    return { label: `${score.toFixed(1)} MED`, color: "bg-neon-amber/10 text-neon-amber border-neon-amber/20" };
  return { label: `${score.toFixed(1)} LOW`, color: "bg-red-500/10 text-red-400 border-red-500/20" };
}

function getStatusIcon(status: string) {
  switch (status) {
    case "analisada": return <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" />;
    case "descartada": return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    default: return <Clock className="w-3.5 h-3.5 text-neon-amber" />;
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

/* ─── Extended type for UI-specific fields ─── */
interface LicitacaoUI extends Licitacao {
  score?: number | null;
  recomendacao?: string | null;
}

/* ─── Component ─── */
export default function PncpPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLicitacoes = useCallback(() =>
    pncpApi.list(50, 0).then((raw) => {
      if (Array.isArray(raw)) return raw as LicitacaoUI[];
      if (raw && typeof raw === "object" && "items" in raw) return (raw as { items: LicitacaoUI[] }).items;
      return [] as LicitacaoUI[];
    }),
    []
  );

  const { data: licitacoes, loading } = useApi<LicitacaoUI[]>(fetchLicitacoes, []);

  const filtered = licitacoes.filter((l) => {
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      l.objeto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.orgao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.pncp_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const total = licitacoes.length;
  const analisadas = licitacoes.filter((l) => l.status === "analisada").length;
  const highScore = licitacoes.filter((l) => l.score != null && l.score >= 7).length;
  const totalValor = licitacoes.reduce((sum, l) => sum + (l.valor_estimado ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-neon-amber glow-text-amber flex items-center gap-3">
            <FileSearch className="w-7 h-7" />
            PNCP MONITOR
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Licitações públicas — busca automática, análise com IA, scoring inteligente
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar licitação..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-bg-secondary border border-surface-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-amber/50 w-64"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-neon-amber">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading licitações...</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: total, icon: <FileSearch className="w-4 h-4" />, color: "text-neon-cyan" },
          { label: "Analisadas", value: analisadas, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-neon-green" },
          { label: "Score ≥ 7.0", value: highScore, icon: <TrendingUp className="w-4 h-4" />, color: "text-neon-amber" },
          { label: "Valor Total", value: formatCurrency(totalValor), icon: <Filter className="w-4 h-4" />, color: "text-neon-magenta" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4">
            <div className={cn("flex items-center gap-2 text-xs mb-1", kpi.color)}>
              {kpi.icon}
              {kpi.label}
            </div>
            <div className="text-lg font-bold">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "nova", "analisada", "descartada"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize",
              statusFilter === status
                ? "bg-neon-amber/15 text-neon-amber border-neon-amber/30"
                : "bg-bg-secondary text-text-muted border-surface-border hover:border-text-muted/30"
            )}
          >
            {status === "all" ? "Todas" : status}
          </button>
        ))}
      </div>

      {/* Licitação Cards */}
      <div className="space-y-3">
        {filtered.map((lic) => {
          const badge = getScoreBadge(lic.score);
          return (
            <div key={lic.id} className="glass-card p-4 hover:ring-1 hover:ring-neon-amber/20 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {getStatusIcon(lic.status)}
                    <span className="text-[10px] font-mono text-text-muted">{lic.pncp_id}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", badge.color)}>
                      {badge.label}
                    </span>
                    {lic.modalidade && (
                      <span className="text-[10px] text-text-muted capitalize px-2 py-0.5 rounded-full bg-bg-tertiary">
                        {lic.modalidade}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neon-cyan font-medium mb-0.5">{lic.orgao}</p>
                  <p className="text-sm text-text-primary leading-snug">{lic.objeto}</p>
                  {lic.recomendacao && (
                    <p className="text-xs text-text-muted mt-2 italic">💡 {lic.recomendacao}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-neon-amber">{formatCurrency(lic.valor_estimado)}</div>
                  {lic.data_abertura && (
                    <div className="text-[10px] text-text-muted mt-0.5">Abertura: {lic.data_abertura}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-text-muted">
          <FileSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {licitacoes.length === 0
              ? "Nenhuma licitação carregada — conecte a Brain API"
              : "Nenhuma licitação encontrada"}
          </p>
        </div>
      )}
    </div>
  );
}
