"""
Jarvis Brain API — Ollama client for local embeddings (L3 Memory).
Connects to Ollama running on host with GTX 1070.
Cost: $0. Target: <500ms per embedding via GPU.
"""

import asyncio
import logging
from typing import Optional

import httpx

from config import get_settings

logger = logging.getLogger("jarvis-brain.ollama")

# Persistent HTTP client (connection pooling)
_client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    """Get or create a persistent httpx client with connection pooling."""
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=60.0,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
    return _client


async def close_client() -> None:
    """Close the persistent httpx client."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def generate_embedding(text: str) -> Optional[list[float]]:
    """
    Generate embedding via Ollama local GPU.
    Returns vector (2560 dims for phi3) or None on failure.
    """
    settings = get_settings()
    try:
        client = await get_client()
        response = await client.post(
            f"{settings.ollama_base_url}/api/embed",
            json={
                "model": settings.embedding_model,
                "input": text,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        embeddings = data.get("embeddings", [])
        if embeddings:
            return embeddings[0]
        return None
    except httpx.TimeoutException:
        logger.error("Ollama embedding timeout (>30s)")
        return None
    except Exception as e:
        logger.error(f"Ollama embedding error: {e}")
        return None


async def generate_embeddings_batch(texts: list[str]) -> list[Optional[list[float]]]:
    """Batch embedding generation using asyncio.gather for concurrency."""
    return await asyncio.gather(*[generate_embedding(t) for t in texts])


async def check_health() -> bool:
    """Check if Ollama is reachable and model is loaded."""
    settings = get_settings()
    try:
        client = await get_client()
        response = await client.get(
            f"{settings.ollama_base_url}/api/tags",
            timeout=5.0,
        )
        if response.status_code == 200:
            models = [m["name"] for m in response.json().get("models", [])]
            has_model = any(settings.embedding_model in m for m in models)
            if not has_model:
                logger.warning(f"Ollama running but model '{settings.embedding_model}' not found. Available: {models}")
            return True
        return False
    except Exception as e:
        logger.error(f"Ollama health check failed: {e}")
        return False


async def generate_text(
    prompt: str,
    model: str = "phi3",
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> dict:
    """
    Generate text response via Ollama local GPU.
    Returns { response, tokens_used, latency_ms } or raises on failure.
    Used by Training Mode to run scenarios at $0 cost.
    """
    settings = get_settings()
    import time

    start = time.monotonic()
    try:
        client = await get_client()
        response = await client.post(
            f"{settings.ollama_base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            },
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
        latency_ms = int((time.monotonic() - start) * 1000)
        return {
            "response": data.get("response", "").strip(),
            "tokens_used": data.get("eval_count", 0),
            "latency_ms": latency_ms,
            "model": model,
        }
    except httpx.TimeoutException:
        logger.error("Ollama generate timeout (>60s)")
        raise
    except Exception as e:
        logger.error(f"Ollama generate error: {e}")
        raise


async def list_models() -> list[str]:
    """List available Ollama models."""
    settings = get_settings()
    try:
        client = await get_client()
        response = await client.get(
            f"{settings.ollama_base_url}/api/tags",
            timeout=5.0,
        )
        if response.status_code == 200:
            return [m["name"] for m in response.json().get("models", [])]
    except Exception:
        pass
    return []
