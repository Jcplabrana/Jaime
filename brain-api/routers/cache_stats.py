"""
Cache Statistics Router — exposes prompt cache metrics via REST API.
Part of Sprint 5D: Token Economy Dashboard.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

import database

logger = logging.getLogger("jarvis-brain.cache-stats")
router = APIRouter()


@router.get("/stats")
async def cache_stats(agent_name: Optional[str] = None):
    """Get prompt cache statistics from sessions data."""
    try:
        agent_filter = "WHERE agent_name = $1" if agent_name else ""
        params = [agent_name] if agent_name else []

        row = await database.fetchrow(
            f"""
            SELECT
                COUNT(*) AS total_requests,
                SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits,
                SUM(CASE WHEN NOT cache_hit THEN 1 ELSE 0 END) AS cache_misses,
                SUM(cached_tokens) AS total_cached_tokens,
                SUM(input_tokens) AS total_input_tokens,
                SUM(output_tokens) AS total_output_tokens,
                SUM(cost_usd) AS total_cost,
                AVG(latency_ms)::integer AS avg_latency_ms,
                AVG(CASE WHEN cache_hit THEN latency_ms END)::integer AS avg_cached_latency_ms,
                AVG(CASE WHEN NOT cache_hit THEN latency_ms END)::integer AS avg_uncached_latency_ms
            FROM jarvis.sessions
            {agent_filter}
            """,
            *params,
        )

        total = int(row["total_requests"] or 0)
        hits = int(row["cache_hits"] or 0)
        cached_tokens = int(row["total_cached_tokens"] or 0)
        input_tokens = int(row["total_input_tokens"] or 0)

        # Estimate savings: cached tokens at $0.30/1M instead of $3/1M
        savings_per_token = (3.0 - 0.3) / 1_000_000
        estimated_savings = round(cached_tokens * savings_per_token, 4)

        return {
            "total_requests": total,
            "cache_hits": hits,
            "cache_misses": int(row["cache_misses"] or 0),
            "hit_rate": round(hits / total, 4) if total > 0 else 0.0,
            "total_cached_tokens": cached_tokens,
            "total_input_tokens": input_tokens,
            "total_output_tokens": int(row["total_output_tokens"] or 0),
            "total_cost_usd": round(float(row["total_cost"] or 0), 6),
            "estimated_savings_usd": estimated_savings,
            "avg_latency_ms": int(row["avg_latency_ms"] or 0),
            "avg_cached_latency_ms": int(row["avg_cached_latency_ms"] or 0),
            "avg_uncached_latency_ms": int(row["avg_uncached_latency_ms"] or 0),
        }
    except Exception as e:
        logger.error(f"Cache stats error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/daily")
async def cache_daily(days: int = 7):
    """Get daily cache metrics for chart visualization."""
    try:
        rows = await database.fetch(
            """
            SELECT
                DATE(created_at) AS date,
                COUNT(*) AS requests,
                SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS hits,
                SUM(cached_tokens) AS cached_tokens,
                SUM(input_tokens + output_tokens) AS total_tokens,
                SUM(cost_usd) AS cost
            FROM jarvis.sessions
            WHERE created_at >= NOW() - ($1 || ' days')::interval
            GROUP BY DATE(created_at)
            ORDER BY date
            """,
            str(days),
        )

        return [
            {
                "date": str(row["date"]),
                "requests": int(row["requests"]),
                "hits": int(row["hits"]),
                "cached_tokens": int(row["cached_tokens"] or 0),
                "total_tokens": int(row["total_tokens"] or 0),
                "cost": round(float(row["cost"] or 0), 6),
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Cache daily stats error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
