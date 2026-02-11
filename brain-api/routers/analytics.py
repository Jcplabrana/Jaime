"""Analytics and metrics router — real DB queries."""

import logging
from typing import Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

import database

logger = logging.getLogger("jarvis-brain.analytics")
router = APIRouter()


@router.get("/dashboard")
async def dashboard_metrics(hours: int = 24):
    """Get dashboard summary from real session data."""
    try:
        row = await database.fetchrow(
            """
            SELECT
                COUNT(*) AS total_actions,
                COUNT(CASE WHEN cache_hit THEN 1 END) AS cache_hits,
                SUM(input_tokens + output_tokens) AS total_tokens,
                SUM(cached_tokens) AS cached_tokens,
                SUM(cost_usd)::float AS total_cost,
                AVG(latency_ms)::integer AS avg_latency
            FROM jarvis.sessions
            WHERE created_at >= NOW() - ($1 || ' hours')::interval
            """,
            str(hours),
        )

        total = int(row["total_actions"] or 0)
        hits = int(row["cache_hits"] or 0)

        return {
            "total_actions": total,
            "total_tokens": int(row["total_tokens"] or 0),
            "cached_tokens": int(row["cached_tokens"] or 0),
            "total_cost_usd": round(float(row["total_cost"] or 0), 6),
            "avg_latency_ms": int(row["avg_latency"] or 0),
            "cache_hit_rate": round(hits / total, 3) if total > 0 else 0.0,
            "period": f"last_{hours}h",
        }
    except Exception as e:
        logger.error(f"Dashboard query failed: {e}")
        return {"total_actions": 0, "error": str(e)}


@router.get("/usage")
async def usage_stats(days: int = 7):
    """Get daily token usage breakdown."""
    try:
        rows = await database.fetch(
            """
            SELECT
                date,
                agent_name,
                total_tokens,
                cached_tokens,
                total_cost_usd::float AS cost,
                avg_latency_ms,
                cache_hit_rate
            FROM jarvis.analytics_daily
            WHERE date >= CURRENT_DATE - $1
            ORDER BY date DESC, agent_name
            """,
            days,
        )

        daily = []
        for row in rows:
            daily.append({
                "date": row["date"].isoformat(),
                "agent": row["agent_name"],
                "tokens": int(row["total_tokens"] or 0),
                "cached": int(row["cached_tokens"] or 0),
                "cost_usd": round(float(row["cost"] or 0), 6),
                "latency_ms": int(row["avg_latency_ms"] or 0),
                "cache_hit_rate": round(float(row["cache_hit_rate"] or 0), 3),
            })

        return {"period_days": days, "daily": daily, "total_rows": len(daily)}
    except Exception as e:
        logger.error(f"Usage query failed: {e}")
        return {"period_days": days, "daily": [], "error": str(e)}


@router.get("/agents/performance")
async def agent_performance():
    """Get performance metrics per agent from materialized view."""
    try:
        rows = await database.fetch(
            """
            SELECT
                agent_name,
                total_sessions,
                total_tokens,
                total_cached_tokens,
                total_cost::float AS cost,
                avg_latency,
                cache_hit_rate
            FROM jarvis.mv_agent_stats
            ORDER BY total_sessions DESC
            """
        )

        agents = []
        for row in rows:
            agents.append({
                "agent": row["agent_name"],
                "sessions": int(row["total_sessions"] or 0),
                "tokens": int(row["total_tokens"] or 0),
                "cached_tokens": int(row["total_cached_tokens"] or 0),
                "cost_usd": round(float(row["cost"] or 0), 6),
                "avg_latency_ms": int(row["avg_latency"] or 0),
                "cache_hit_rate": round(float(row["cache_hit_rate"] or 0), 3),
            })

        return {"agents": agents, "total": len(agents)}
    except Exception as e:
        logger.error(f"Performance query failed: {e}")
        return {"agents": [], "error": str(e)}


@router.get("/models/distribution")
async def model_distribution():
    """Get model usage distribution for routing analytics."""
    try:
        rows = await database.fetch(
            """
            SELECT
                model_used,
                COUNT(*) AS requests,
                SUM(cost_usd)::float AS total_cost,
                AVG(latency_ms)::integer AS avg_latency
            FROM jarvis.sessions
            WHERE model_used IS NOT NULL
            GROUP BY model_used
            ORDER BY requests DESC
            """
        )

        models = []
        total = 0
        for row in rows:
            count = int(row["requests"] or 0)
            total += count
            models.append({
                "model": row["model_used"],
                "requests": count,
                "cost_usd": round(float(row["total_cost"] or 0), 6),
                "avg_latency_ms": int(row["avg_latency"] or 0),
            })

        return {"models": models, "total_requests": total}
    except Exception as e:
        logger.error(f"Model distribution query failed: {e}")
        return {"models": [], "total_requests": 0, "error": str(e)}


@router.get("/memory/layers")
async def memory_layer_stats():
    """Get memory layer statistics."""
    try:
        row = await database.fetchrow(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) AS with_embedding,
                SUM(access_count) AS total_accesses
            FROM jarvis.agent_memory
            """
        )

        return {
            "l2_postgres": {"entries": int(row["total"] or 0)},
            "l3_embedding": {"entries": int(row["with_embedding"] or 0)},
            "total_memories": int(row["total"] or 0),
            "total_accesses": int(row["total_accesses"] or 0),
        }
    except Exception as e:
        logger.error(f"Memory stats query failed: {e}")
        return {"total_memories": 0, "error": str(e)}


@router.post("/refresh-stats")
async def refresh_materialized_views():
    """Refresh materialized views (call via cron or manually)."""
    try:
        await database.execute("SELECT jarvis.refresh_agent_stats()")
        return {"status": "refreshed", "views": ["mv_agent_stats"]}
    except Exception as e:
        logger.error(f"Refresh failed: {e}")
        return {"status": "failed", "error": str(e)}
