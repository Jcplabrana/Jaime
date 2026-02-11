-- ============================================
-- OpenClaw Jarvis Edition - Database Schema
-- PostgreSQL 16 Initial Setup
-- ============================================
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- Schema
CREATE SCHEMA IF NOT EXISTS jarvis;
-- ============================================
-- Memory Engine - Layer 2 (Persistent Storage)
-- ============================================
CREATE TABLE jarvis.agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100) NOT NULL,
    memory_key VARCHAR(500) NOT NULL,
    content JSONB NOT NULL,
    embedding FLOAT8 [] DEFAULT NULL,
    importance FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(agent_name, memory_key)
);
-- Indexes for fast retrieval
CREATE INDEX idx_agent_memory_agent ON jarvis.agent_memory(agent_name);
CREATE INDEX idx_agent_memory_key ON jarvis.agent_memory(memory_key);
CREATE INDEX idx_agent_memory_importance ON jarvis.agent_memory(importance DESC);
CREATE INDEX idx_agent_memory_accessed ON jarvis.agent_memory(last_accessed_at DESC);
CREATE INDEX idx_agent_memory_content_gin ON jarvis.agent_memory USING GIN(content);
CREATE INDEX idx_agent_memory_metadata_gin ON jarvis.agent_memory USING GIN(metadata);
-- ============================================
-- Agent Tasks & Delegation
-- ============================================
CREATE TABLE jarvis.agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assigned_agent VARCHAR(100) NOT NULL,
    delegated_by VARCHAR(100),
    status VARCHAR(50) DEFAULT 'inbox' CHECK (
        status IN (
            'inbox',
            'in_progress',
            'completed',
            'failed',
            'cancelled'
        )
    ),
    priority INTEGER DEFAULT 5 CHECK (
        priority BETWEEN 1 AND 10
    ),
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agent_tasks_agent ON jarvis.agent_tasks(assigned_agent);
CREATE INDEX idx_agent_tasks_status ON jarvis.agent_tasks(status);
CREATE INDEX idx_agent_tasks_priority ON jarvis.agent_tasks(priority DESC);
-- ============================================
-- Session & Cost Tracking
-- ============================================
CREATE TABLE jarvis.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100) NOT NULL,
    channel VARCHAR(100) NOT NULL,
    model_used VARCHAR(200),
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cached_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_agent ON jarvis.sessions(agent_name);
CREATE INDEX idx_sessions_created ON jarvis.sessions(created_at DESC);
CREATE INDEX idx_sessions_model ON jarvis.sessions(model_used);
-- ============================================
-- Analytics & Metrics
-- ============================================
CREATE TABLE jarvis.analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    total_actions INTEGER DEFAULT 0,
    successful_actions INTEGER DEFAULT 0,
    failed_actions INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cached_tokens INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(10, 6) DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    cache_hit_rate FLOAT DEFAULT 0,
    UNIQUE(date, agent_name)
);
CREATE INDEX idx_analytics_date ON jarvis.analytics_daily(date DESC);
CREATE INDEX idx_analytics_agent ON jarvis.analytics_daily(agent_name);
-- ============================================
-- Workflow Definitions
-- ============================================
CREATE TABLE jarvis.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- ============================================
-- PNCP Pipeline (tutorial v3.1)
-- ============================================
CREATE TABLE jarvis.licitacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pncp_id VARCHAR(100) UNIQUE,
    orgao VARCHAR(500),
    objeto TEXT,
    valor_estimado NUMERIC(15, 2),
    modalidade VARCHAR(100),
    data_abertura TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'nova' CHECK (
        status IN (
            'nova',
            'analisada',
            'qualificada',
            'descartada',
            'monitorando'
        )
    ),
    embedding FLOAT8 [] DEFAULT NULL,
    raw_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_licitacoes_status ON jarvis.licitacoes(status);
CREATE INDEX idx_licitacoes_data ON jarvis.licitacoes(data_abertura DESC);
CREATE INDEX idx_licitacoes_pncp ON jarvis.licitacoes(pncp_id);
CREATE INDEX idx_licitacoes_objeto_trgm ON jarvis.licitacoes USING GIN(objeto gin_trgm_ops);
CREATE TABLE jarvis.analises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    licitacao_id UUID REFERENCES jarvis.licitacoes(id) ON DELETE CASCADE,
    score NUMERIC(5, 2),
    recomendacao TEXT,
    analise_detalhada JSONB DEFAULT '{}'::jsonb,
    analyzed_by VARCHAR(100) DEFAULT '@jarvis',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_analises_licitacao ON jarvis.analises(licitacao_id);
CREATE INDEX idx_analises_score ON jarvis.analises(score DESC);
-- ============================================
-- Agent Marketplace (planejamento completo)
-- ============================================
CREATE TABLE jarvis.agent_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    category VARCHAR(50),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    rating NUMERIC(2, 1) DEFAULT 0 CHECK (
        rating BETWEEN 0 AND 5
    ),
    downloads INTEGER DEFAULT 0,
    is_official BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agent_templates_category ON jarvis.agent_templates(category);
INSERT INTO jarvis.agent_templates (
        name,
        description,
        icon,
        category,
        is_official,
        config
    )
VALUES (
        'Email Assistant',
        'Responde emails automaticamente',
        '📧',
        'productivity',
        TRUE,
        '{"model": "blockrun/auto", "max_iterations": 20}'
    ),
    (
        'Code Reviewer',
        'Analisa PRs e sugere melhorias',
        '👨‍💻',
        'development',
        TRUE,
        '{"model": "blockrun/auto", "max_iterations": 30}'
    ),
    (
        'Social Media Manager',
        'Cria posts otimizados',
        '📱',
        'marketing',
        TRUE,
        '{"model": "ollama/phi3", "max_iterations": 20}'
    ),
    (
        'DevOps Monitor',
        'Monitors infrastructure health, alerts, and auto-remediation',
        '🔧',
        'infrastructure',
        TRUE,
        '{"model": "blockrun/auto", "max_iterations": 25, "tools": ["docker", "k8s"]}'
    ),
    (
        'Legal Analyst',
        'Analisa contratos e documentos legais para riscos e oportunidades',
        '⚖️',
        'legal',
        TRUE,
        '{"model": "blockrun/auto", "max_iterations": 40}'
    ),
    (
        'Data Pipeline',
        'Orchestrates ETL pipelines and data transformations',
        '🔀',
        'data',
        TRUE,
        '{"model": "ollama/phi3", "max_iterations": 30}'
    ),
    (
        'Customer Support',
        'Atendimento ao cliente com análise de sentimento',
        '🎧',
        'support',
        TRUE,
        '{"model": "blockrun/auto", "max_iterations": 15}'
    ),
    (
        'Research Assistant',
        'Academic research, paper summarization, and citation management',
        '🔬',
        'research',
        TRUE,
        '{"model": "blockrun/auto", "max_iterations": 50}'
    ),
    (
        'Meeting Summarizer',
        'Transcreve e resume reuniões com action items',
        '📋',
        'productivity',
        TRUE,
        '{"model": "ollama/phi3", "max_iterations": 20}'
    );
-- ============================================
-- Training Scenarios (seed data)
-- ============================================
INSERT INTO jarvis.training_scenarios (
        scenario_text,
        expected_response,
        difficulty,
        category,
        agent_name
    )
VALUES (
        'A user asks: "What are the top 3 differences between PostgreSQL and MySQL for a new SaaS project?" Provide a concise, structured comparison.',
        'Key differences: 1) PostgreSQL supports JSONB natively for flexible schemas, MySQL requires workarounds. 2) PostgreSQL has superior full-text search (pg_trgm, GIN indexes). 3) PostgreSQL''s MVCC handles concurrent writes better under high load.',
        'medium',
        'technical',
        'jarvis'
    ),
    (
        'Analyze this error log and suggest a fix: "FATAL: password authentication failed for user postgres". The system was working yesterday.',
        'Root cause analysis: 1) Check if pg_hba.conf was recently modified (likely changed from "trust" to "md5"). 2) Verify the PGPASSWORD environment variable is set. 3) Check if Docker volume was reset, requiring password re-initialization. Fix: Update .env with correct credentials or reset pg_hba.conf.',
        'easy',
        'debugging',
        'jarvis'
    ),
    (
        'A client wants to build a real-time notification system for 10,000 concurrent users. What architecture would you recommend? Consider cost, latency, and scalability.',
        'Recommended: WebSocket with Redis Pub/Sub fan-out. Architecture: 1) FastAPI WebSocket endpoints behind load balancer. 2) Redis Pub/Sub for cross-instance message distribution. 3) Connection manager with heartbeat and auto-reconnect. Expected: <50ms latency, ~$30/month for 10K concurrent on 2 instances.',
        'hard',
        'architecture',
        'jarvis'
    );
-- ============================================
-- Training Mode (planejamento completo)
-- ============================================
CREATE TABLE jarvis.training_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_text TEXT NOT NULL,
    expected_response TEXT,
    difficulty VARCHAR(20) CHECK (
        difficulty IN ('easy', 'medium', 'hard', 'expert')
    ),
    category VARCHAR(50),
    agent_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE jarvis.training_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID REFERENCES jarvis.training_scenarios(id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL,
    actual_response TEXT,
    feedback VARCHAR(20) CHECK (feedback IN ('thumbs_up', 'thumbs_down', 'edit')),
    edited_response TEXT,
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_training_results_scenario ON jarvis.training_results(scenario_id);
CREATE INDEX idx_training_results_agent ON jarvis.training_results(agent_name);
-- ============================================
-- Materialized Views for Dashboard
-- ============================================
CREATE MATERIALIZED VIEW jarvis.mv_agent_stats AS
SELECT agent_name,
    COUNT(*) AS total_sessions,
    SUM(input_tokens + output_tokens) AS total_tokens,
    SUM(cached_tokens) AS total_cached_tokens,
    SUM(cost_usd) AS total_cost,
    AVG(latency_ms)::INTEGER AS avg_latency,
    (
        SUM(
            CASE
                WHEN cache_hit THEN 1
                ELSE 0
            END
        )::FLOAT / NULLIF(COUNT(*), 0)
    )::FLOAT AS cache_hit_rate
FROM jarvis.sessions
GROUP BY agent_name;
CREATE UNIQUE INDEX idx_mv_agent_stats ON jarvis.mv_agent_stats(agent_name);
-- ============================================
-- Performance Indexes (F4.6 Optimization)
-- ============================================
-- Partial index: only pending tasks (hot path for task queue)
CREATE INDEX idx_agent_tasks_pending ON jarvis.agent_tasks(priority DESC, created_at ASC)
WHERE status = 'pending';
-- Composite: task status + priority for sorted queries
CREATE INDEX idx_agent_tasks_status_priority ON jarvis.agent_tasks(status, priority DESC);
-- Composite: agent + status for per-agent task filtering
CREATE INDEX idx_agent_tasks_agent_status ON jarvis.agent_tasks(target_agent, status);
-- JSONB: workflow nodes for type-based queries
CREATE INDEX idx_workflows_nodes_gin ON jarvis.workflows USING GIN(nodes);
-- JSONB: workflow edges for graph traversal queries
CREATE INDEX idx_workflows_edges_gin ON jarvis.workflows USING GIN(edges);
-- Composite: PNCP pipeline date + status for dashboard queries
CREATE INDEX idx_licitacoes_status_data ON jarvis.licitacoes(status, data_abertura DESC);
-- Training: feedback aggregation by agent
CREATE INDEX idx_training_results_agent_feedback ON jarvis.training_results(agent_name, feedback);
-- Sessions: cost tracking by date range
CREATE INDEX idx_sessions_created_agent ON jarvis.sessions(created_at DESC, agent_name);
-- ============================================
-- Functions
-- ============================================
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION jarvis.update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_agent_memory_updated BEFORE
UPDATE ON jarvis.agent_memory FOR EACH ROW EXECUTE FUNCTION jarvis.update_updated_at();
CREATE TRIGGER trg_agent_tasks_updated BEFORE
UPDATE ON jarvis.agent_tasks FOR EACH ROW EXECUTE FUNCTION jarvis.update_updated_at();
CREATE TRIGGER trg_workflows_updated BEFORE
UPDATE ON jarvis.workflows FOR EACH ROW EXECUTE FUNCTION jarvis.update_updated_at();
CREATE TRIGGER trg_licitacoes_updated BEFORE
UPDATE ON jarvis.licitacoes FOR EACH ROW EXECUTE FUNCTION jarvis.update_updated_at();
CREATE TRIGGER trg_agent_templates_updated BEFORE
UPDATE ON jarvis.agent_templates FOR EACH ROW EXECUTE FUNCTION jarvis.update_updated_at();
-- Refresh materialized view function
CREATE OR REPLACE FUNCTION jarvis.refresh_agent_stats() RETURNS void AS $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY jarvis.mv_agent_stats;
END;
$$ LANGUAGE plpgsql;
