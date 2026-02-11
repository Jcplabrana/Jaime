"""
Jarvis Brain API — Redis cache layer (L1 Memory).
Pattern: getOrSet(key, fallback_fn, ttl)
"""

import json
import logging
from typing import Optional, Callable, Any

import redis.asyncio as aioredis

from config import get_settings

logger = logging.getLogger("jarvis-brain.cache")

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Get or create Redis connection."""
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=20,
        )
        logger.info("⚡ Redis connected")
    return _redis


async def close_redis():
    """Close Redis connection."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
        logger.info("⚡ Redis closed")


async def cache_get(key: str) -> Optional[dict]:
    """Get value from cache. Returns None on miss."""
    try:
        r = await get_redis()
        data = await r.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis GET error: {e}")
    return None


async def cache_set(key: str, value: dict, ttl: int = 3600) -> bool:
    """Set value in cache with TTL (seconds)."""
    try:
        r = await get_redis()
        await r.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception as e:
        logger.warning(f"Redis SET error: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """Delete a key from cache."""
    try:
        r = await get_redis()
        await r.delete(key)
        return True
    except Exception as e:
        logger.warning(f"Redis DEL error: {e}")
        return False


async def cache_get_or_set(key: str, fallback: Callable, ttl: int = 3600) -> Any:
    """
    Get from cache. On miss, call fallback(), cache result, return it.
    The core L1 pattern — 85% hit rate target.
    """
    cached = await cache_get(key)
    if cached is not None:
        return cached

    result = await fallback()
    if result is not None:
        await cache_set(key, result, ttl)
    return result


async def check_health() -> bool:
    """Check if Redis is reachable."""
    try:
        r = await get_redis()
        return await r.ping()
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False
