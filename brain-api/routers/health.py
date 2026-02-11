"""Health check router — real service checks."""

from fastapi import APIRouter

import database
import cache
import ollama_client
from config import get_settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check."""
    return {
        "status": "ok",
        "service": "jarvis-brain-api",
        "version": get_settings().api_version,
    }


@router.get("/health/detailed")
async def detailed_health():
    """Detailed health check with real service status."""
    db_ok = await database.check_health()
    redis_ok = await cache.check_health()
    ollama_ok = await ollama_client.check_health()

    all_ok = db_ok and redis_ok
    status = "ok" if all_ok else "degraded"

    return {
        "status": status,
        "services": {
            "api": "healthy",
            "database": "healthy" if db_ok else "unhealthy",
            "redis": "healthy" if redis_ok else "unhealthy",
            "ollama": "healthy" if ollama_ok else "unavailable",
        },
    }
