/**
 * Brain API Client — connects frontend to the Jarvis Brain API.
 * Centralizes all API calls. Uses fetch with typed responses.
 */

const BRAIN_API_BASE =
  process.env.NEXT_PUBLIC_BRAIN_API_URL || "http://localhost:8000";

/* ─── Generic Fetch Helpers ─── */

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BRAIN_API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brain API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/* ─── Health ─── */

export interface HealthStatus {
  status: string;
  services: {
    database: string;
    redis: string;
    ollama: string;
  };
  timestamp: string;
}

export const healthApi = {
  check: () => apiFetch<HealthStatus>("/api/health"),
  detailed: () => apiFetch<HealthStatus>("/api/health/detailed"),
};

/* ─── Memory ─── */

export interface MemoryStoreRequest {
  agent_name: string;
  key: string;
  content: Record<string, unknown>;
  importance?: number;
  ttl_seconds?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryRecallResult {
  agent: string;
  query: string;
  results: Array<{
    key: string;
    content: Record<string, unknown>;
    layer: string;
    score?: number;
  }>;
  total: number;
  latency_ms: number;
}

export interface MemoryStats {
  total_memories: number;
  by_agent: Record<string, number>;
  by_layer: { l1_redis: number; l2_postgres: number; l3_embedding: number };
  cache_hit_rate: number;
}

export const memoryApi = {
  store: (data: MemoryStoreRequest) =>
    apiFetch("/api/memory/store", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recall: (agent_name: string, query: string, layers?: string[]) =>
    apiFetch<MemoryRecallResult>("/api/memory/recall", {
      method: "POST",
      body: JSON.stringify({ agent_name, query, layers }),
    }),
  search: (query: string, limit?: number) =>
    apiFetch<MemoryRecallResult>(
      `/api/memory/search?query=${encodeURIComponent(query)}&limit=${limit || 10}`
    ),
  stats: () => apiFetch<MemoryStats>("/api/memory/stats"),
  delete: (agent_name: string, key: string) =>
    apiFetch(`/api/memory/${agent_name}/${key}`, { method: "DELETE" }),
};

/* ─── Agents ─── */

export interface AgentConfig {
  name: string;
  role: string;
  description: string;
  model: { primary: string; fallback?: string };
  capabilities: Array<Record<string, unknown>>;
  personality?: string;
  max_iterations?: number;
  max_tools?: number;
  tools?: string[];
  status?: string;
  stats?: {
    total_tasks: number;
    completed: number;
    failed: number;
    in_progress: number;
  };
}

export interface AgentListResponse {
  agents: AgentConfig[];
  total: number;
  active: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description?: string;
  delegated_by: string;
  status: string;
  priority: number;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
  retry_count?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface AgentTasksResponse {
  agent: string;
  tasks: AgentTask[];
  total: number;
}

export const agentsApi = {
  list: () => apiFetch<AgentListResponse>("/api/agents"),
  get: (agentName: string) => apiFetch<AgentConfig>(`/api/agents/${agentName}`),
  getTasks: (agentName: string, status?: string) =>
    apiFetch<AgentTasksResponse>(
      `/api/agents/${agentName}/tasks${status ? `?status=${status}` : ""}`
    ),
  delegate: (data: {
    title: string;
    description: string;
    target_agent: string;
    delegated_by?: string;
    priority?: number;
    input_data?: Record<string, unknown>;
  }) =>
    apiFetch<{ status: string; task_id: string; target_agent: string }>("/api/agents/delegate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTask: (taskId: string, data: { status: string; output_data?: Record<string, unknown>; error_message?: string }) =>
    apiFetch(`/api/agents/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

/* ─── Analytics ─── */

export interface DashboardMetrics {
  total_actions: number;
  successful: number;
  failed: number;
  avg_latency_ms: number;
  total_tokens: number;
  estimated_cost: number;
  period: string;
}

export const analyticsApi = {
  dashboard: () => apiFetch<DashboardMetrics>("/api/analytics/dashboard"),
  usage: (days?: number) =>
    apiFetch<Array<Record<string, unknown>>>(`/api/analytics/usage?days=${days || 7}`),
  agentPerformance: () =>
    apiFetch<Array<Record<string, unknown>>>("/api/analytics/agents/performance"),
  modelDistribution: () =>
    apiFetch<Array<Record<string, unknown>>>("/api/analytics/models/distribution"),
  memoryStats: () =>
    apiFetch<Record<string, unknown>>("/api/analytics/memory/stats"),
};

/* ─── PNCP ─── */

export interface Licitacao {
  id: string;
  pncp_id: string;
  orgao: string;
  objeto: string;
  valor_estimado?: number;
  modalidade?: string;
  data_abertura?: string;
  status: string;
  created_at: string;
}

export const pncpApi = {
  list: (limit?: number, offset?: number) =>
    apiFetch<Licitacao[]>(`/api/pncp/licitacoes?limit=${limit || 20}&offset=${offset || 0}`),
  get: (id: string) => apiFetch<Licitacao>(`/api/pncp/licitacoes/${id}`),
  create: (data: Omit<Licitacao, "id" | "status" | "created_at">) =>
    apiFetch<Licitacao>("/api/pncp/licitacoes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  search: (query: string, limit?: number) =>
    apiFetch<Licitacao[]>(
      `/api/pncp/search?query=${encodeURIComponent(query)}&limit=${limit || 10}`
    ),
};

/* ─── Training ─── */

export interface TrainingScenario {
  id: string;
  scenario_text: string;
  expected_response?: string;
  difficulty?: string;
  category?: string;
  agent_name?: string;
  created_at: string;
}

export interface TrainingFeedback {
  scenario_id: string;
  agent_name: string;
  actual_response: string;
  feedback: "thumbs_up" | "thumbs_down" | "edit";
  edited_response?: string;
  tokens_used?: number;
  latency_ms?: number;
}

export const trainingApi = {
  scenarios: (agent?: string) =>
    apiFetch<TrainingScenario[]>(
      `/api/training/scenarios${agent ? `?agent_name=${agent}` : ""}`
    ),
  createScenario: (data: Omit<TrainingScenario, "id" | "created_at">) =>
    apiFetch<TrainingScenario>("/api/training/scenarios", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  runScenario: (scenarioId: string) =>
    apiFetch<{
      scenario_id: string;
      agent_name: string;
      actual_response: string;
      tokens_used: number;
      latency_ms: number;
      model: string;
      expected_response: string | null;
    }>(`/api/training/scenarios/${scenarioId}/run`, {
      method: "POST",
    }),
  submitFeedback: (data: TrainingFeedback) =>
    apiFetch("/api/training/feedback", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  stats: (agentName?: string) =>
    apiFetch<{
      total_runs: number;
      positive: number;
      negative: number;
      edited: number;
      success_rate: number;
      avg_tokens: number;
      avg_latency_ms: number;
    }>(`/api/training/stats${agentName ? `?agent_name=${agentName}` : ""}`),
  getResults: (agentName: string) =>
    apiFetch<Record<string, unknown>>(
      `/api/training/stats${agentName !== "all" ? `?agent_name=${agentName}` : ""}`
    ),
};

/* ─── Marketplace ─── */

export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  config: Record<string, unknown>;
  downloads: number;
  rating: number;
  is_official: boolean;
  created_at: string;
}

export const marketplaceApi = {
  list: (category?: string) =>
    apiFetch<AgentTemplate[]>(
      `/api/marketplace/templates${category ? `?category=${category}` : ""}`
    ),
  create: (data: Omit<AgentTemplate, "id" | "downloads" | "rating" | "created_at">) =>
    apiFetch<AgentTemplate>("/api/marketplace/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  install: (templateId: string) =>
    apiFetch(`/api/marketplace/templates/${templateId}/install`, {
      method: "POST",
    }),
  rate: (templateId: string, rating: number) =>
    apiFetch(`/api/marketplace/templates/${templateId}/rate`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    }),
};

/* ─── Workflows ─── */

export interface WorkflowNode {
  id: string;
  type: "trigger" | "agent" | "condition" | "action";
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  source: string;
  target: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRunResult {
  workflow_id: string;
  status: "completed" | "failed" | "partial";
  steps_executed: number;
  steps_total: number;
  results: Array<Record<string, unknown>>;
  duration_ms: number;
}

export const workflowsApi = {
  list: (activeOnly?: boolean) =>
    apiFetch<Workflow[]>(
      `/api/workflows${activeOnly ? "?active_only=true" : ""}`
    ),
  create: (data: {
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    is_active?: boolean;
  }) =>
    apiFetch<Workflow>("/api/workflows", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  get: (id: string) => apiFetch<Workflow>(`/api/workflows/${id}`),
  execute: (id: string, inputData?: Record<string, unknown>) =>
    apiFetch<WorkflowRunResult>(`/api/workflows/${id}/run`, {
      method: "POST",
      body: inputData ? JSON.stringify(inputData) : undefined,
    }),
  delete: (id: string) =>
    apiFetch(`/api/workflows/${id}`, { method: "DELETE" }),
};

/* ─── Cache Stats ─── */

export interface CacheStats {
  total_requests: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
  total_cached_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  estimated_savings_usd: number;
  avg_latency_ms: number;
  avg_cached_latency_ms: number;
  avg_uncached_latency_ms: number;
}

export interface CacheDailyEntry {
  date: string;
  requests: number;
  hits: number;
  cached_tokens: number;
  total_tokens: number;
  cost: number;
}

export const cacheApi = {
  getStats: (agentName?: string) =>
    apiFetch<CacheStats>(
      `/api/cache/stats${agentName ? `?agent_name=${agentName}` : ""}`
    ),
  getDaily: (days = 7) =>
    apiFetch<CacheDailyEntry[]>(`/api/cache/daily?days=${days}`),
};
