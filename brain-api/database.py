"""
Jarvis Brain API — PostgreSQL connection via asyncpg.
Direct asyncpg pool (no ORM overhead) for max performance.
"""

import asyncpg
import logging
from typing import Optional

from config import get_settings

logger = logging.getLogger("jarvis-brain.db")

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        # asyncpg uses its own URL format (no +asyncpg suffix)
        dsn = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("🗄️ PostgreSQL pool created (2-10 connections)")
    return _pool


async def close_pool():
    """Close the connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("🗄️ PostgreSQL pool closed")


async def execute(query: str, *args):
    """Execute a query (INSERT/UPDATE/DELETE)."""
    pool = await get_pool()
    return await pool.execute(query, *args)


async def fetch(query: str, *args) -> list:
    """Fetch multiple rows."""
    pool = await get_pool()
    return await pool.fetch(query, *args)


async def fetchrow(query: str, *args) -> Optional[asyncpg.Record]:
    """Fetch a single row."""
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def fetchval(query: str, *args):
    """Fetch a single value."""
    pool = await get_pool()
    return await pool.fetchval(query, *args)


async def check_health() -> bool:
    """Check if database is reachable."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            return result == 1
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
        return False
