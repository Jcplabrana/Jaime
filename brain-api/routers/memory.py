"""Memory Engine router — 3-Layer implementation (L1 Redis → L2 PostgreSQL → L3 Ollama)."""

import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import database
import cache
import ollama_client
from utils.math import cosine_similarity
from utils.sanitize import escape_ilike

logger = logging.getLogger("jarvis-brain.memory")
router = APIRouter()


class MemoryStoreRequest(BaseModel):
    agent_name: str = Field(..., description="Agent storing memory")
    key: str = Field(..., description="Memory key")
    content: dict = Field(..., description="Content to store")
    importance: float = Field(default=0.5, ge=0, le=1)
    ttl_seconds: Optional[int] = Field(default=3600, description="TTL for L1 Redis")
    metadata: Optional[dict] = Field(default_factory=dict)


class MemoryRecallRequest(BaseModel):
    agent_name: str
    query: str = Field(..., description="Search query", max_length=2000)
    max_results: int = Field(default=5, ge=1, le=50)
    min_importance: float = Field(default=0.0, ge=0, le=1)


class MemorySearchRequest(BaseModel):
    agent_name: Optional[str] = None
    query: str = Field(..., description="Semantic search query", max_length=2000)
    max_results: int = Field(default=10, ge=1, le=50)


@router.post("/store")
async def store_memory(request: MemoryStoreRequest):
    """
    Store memory across 3 layers:
    - L1: Redis (fast, TTL-based cache)
    - L2: PostgreSQL (persistent)
    - L3: Ollama Embedding (semantic index)
    """
    start = time.time()
    memory_id = str(uuid4())
    content_json = json.dumps(request.content, default=str)

    # L1: Redis cache
    cache_key = f"mem:{request.agent_name}:{request.key}"
    l1_status = "cached" if await cache.cache_set(
        cache_key,
        {"id": memory_id, "content": request.content, "importance": request.importance},
        request.ttl_seconds or 3600,
    ) else "failed"

    # L3: Generate embedding (async, GPU)
    embedding = await ollama_client.generate_embedding(content_json)
    l3_status = "indexed" if embedding else "skipped"

    # L2: PostgreSQL persistent store
    try:
        await database.execute(
            """
            INSERT INTO jarvis.agent_memory (id, agent_name, memory_key, content, embedding, importance, metadata)
            VALUES ($1, $2::varchar, $3::varchar, $4::jsonb, $5, $6, $7::jsonb)
            ON CONFLICT (agent_name, memory_key)
            DO UPDATE SET content = $4::jsonb, embedding = $5, importance = $6,
                          metadata = $7::jsonb, updated_at = NOW(), access_count = jarvis.agent_memory.access_count + 1
            """,
            memory_id, request.agent_name, request.key,
            content_json, embedding, request.importance,
            json.dumps(request.metadata or {}, default=str),
        )
        l2_status = "persisted"
    except Exception as e:
        logger.error(f"L2 store failed: {e}")
        l2_status = "failed"

    elapsed_ms = int((time.time() - start) * 1000)

    return {
        "status": "stored",
        "id": memory_id,
        "agent": request.agent_name,
        "key": request.key,
        "layers": {"l1_redis": l1_status, "l2_postgres": l2_status, "l3_embedding": l3_status},
        "latency_ms": elapsed_ms,
    }


@router.post("/recall")
async def recall_memory(request: MemoryRecallRequest):
    """
    Recall memories using 3-layer cascade:
    1. L1 Redis (fastest, <5ms)
    2. L2 PostgreSQL key match (<15ms)
    3. L3 Semantic search via embeddings (<500ms)
    """
    start = time.time()
    results = []
    source_layer = "none"

    # L1: Try Redis cache first
    cache_key = f"mem:{request.agent_name}:{request.query}"
    cached = await cache.cache_get(cache_key)
    if cached:
        source_layer = "l1_redis"
        results.append({**cached, "source_layer": "l1_redis", "similarity": 1.0})

    # L2: PostgreSQL key/content search
    if not results:
        try:
            rows = await database.fetch(
                """
                SELECT id::text, agent_name, memory_key, content, importance, access_count, created_at
                FROM jarvis.agent_memory
                WHERE agent_name = $1 AND importance >= $2
                AND (memory_key ILIKE $3 OR content::text ILIKE $3)
                ORDER BY importance DESC, last_accessed_at DESC
                LIMIT $4
                """,
                request.agent_name, request.min_importance,
                f"%{escape_ilike(request.query)}%", request.max_results,
            )
            if rows:
                source_layer = "l2_postgres"
                for row in rows:
                    results.append({
                        "id": row["id"],
                        "agent_name": row["agent_name"],
                        "key": row["memory_key"],
                        "content": json.loads(row["content"]) if isinstance(row["content"], str) else dict(row["content"]),
                        "importance": float(row["importance"]),
                        "source_layer": "l2_postgres",
                        "similarity": None,
                    })

                    # Warm L1 cache with result
                    await cache.cache_set(
                        f"mem:{row['agent_name']}:{row['memory_key']}",
                        {"id": row["id"], "content": dict(row["content"]), "importance": float(row["importance"])},
                    )
        except Exception as e:
            logger.error(f"L2 recall failed: {e}")

    # L3: Semantic search via embeddings
    if not results:
        query_embedding = await ollama_client.generate_embedding(request.query)
        if query_embedding:
            try:
                # Cosine similarity via SQL (basic approach without pgvector)
                rows = await database.fetch(
                    """
                    SELECT id::text, agent_name, memory_key, content, importance, embedding
                    FROM jarvis.agent_memory
                    WHERE agent_name = $1 AND embedding IS NOT NULL AND importance >= $2
                    ORDER BY importance DESC
                    LIMIT 100
                    """,
                    request.agent_name, request.min_importance,
                )
                if rows:
                    source_layer = "l3_embedding"
                    scored = []
                    for row in rows:
                        if row["embedding"]:
                            sim = cosine_similarity(query_embedding, list(row["embedding"]))
                            scored.append((sim, row))

                    scored.sort(key=lambda x: x[0], reverse=True)
                    for sim, row in scored[:request.max_results]:
                        results.append({
                            "id": row["id"],
                            "agent_name": row["agent_name"],
                            "key": row["memory_key"],
                            "content": json.loads(row["content"]) if isinstance(row["content"], str) else dict(row["content"]),
                            "importance": float(row["importance"]),
                            "source_layer": "l3_embedding",
                            "similarity": round(sim, 4),
                        })
            except Exception as e:
                logger.error(f"L3 recall failed: {e}")

    elapsed_ms = int((time.time() - start) * 1000)

    # Update access count for retrieved memories
    for r in results:
        if "id" in r:
            try:
                await database.execute(
                    "UPDATE jarvis.agent_memory SET access_count = access_count + 1, last_accessed_at = NOW() WHERE id = $1::uuid",
                    r["id"],
                )
            except Exception:
                pass

    return {
        "agent": request.agent_name,
        "query": request.query,
        "results": results,
        "total": len(results),
        "source_layer": source_layer,
        "latency_ms": elapsed_ms,
    }


@router.post("/search")
async def semantic_search(request: MemorySearchRequest):
    """Pure semantic search across memories using embeddings (L3 only)."""
    start = time.time()

    query_embedding = await ollama_client.generate_embedding(request.query)
    if not query_embedding:
        raise HTTPException(status_code=503, detail="Ollama unavailable for embedding generation")

    agent_filter = "AND agent_name = $2" if request.agent_name else ""
    params = [request.agent_name] if request.agent_name else []

    try:
        rows = await database.fetch(
            f"""
            SELECT id::text, agent_name, memory_key, content, importance, embedding
            FROM jarvis.agent_memory
            WHERE embedding IS NOT NULL {agent_filter}
            ORDER BY importance DESC
            LIMIT 200
            """,
            *params,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

    scored = []
    for row in rows:
        if row["embedding"]:
            sim = cosine_similarity(query_embedding, list(row["embedding"]))
            scored.append({
                "id": row["id"],
                "agent_name": row["agent_name"],
                "key": row["memory_key"],
                "content": json.loads(row["content"]) if isinstance(row["content"], str) else dict(row["content"]),
                "importance": float(row["importance"]),
                "similarity": round(sim, 4),
            })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    elapsed_ms = int((time.time() - start) * 1000)

    return {
        "query": request.query,
        "results": scored[:request.max_results],
        "total": len(scored[:request.max_results]),
        "latency_ms": elapsed_ms,
    }


@router.get("/stats/{agent_name}")
async def memory_stats(agent_name: str):
    """Get memory statistics for an agent from real data."""
    try:
        row = await database.fetchrow(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) AS with_embedding,
                AVG(importance)::float AS avg_importance,
                SUM(access_count) AS total_accesses
            FROM jarvis.agent_memory
            WHERE agent_name = $1
            """,
            agent_name,
        )
        return {
            "agent": agent_name,
            "total_memories": int(row["total"] or 0),
            "l3_embedded": int(row["with_embedding"] or 0),
            "avg_importance": round(float(row["avg_importance"] or 0), 3),
            "total_accesses": int(row["total_accesses"] or 0),
        }
    except Exception as e:
        logger.error(f"Stats query failed: {e}")
        return {"agent": agent_name, "total_memories": 0, "error": "Query failed"}


@router.delete("/{agent_name}/{key}")
async def delete_memory(agent_name: str, key: str):
    """Delete a specific memory from all layers."""
    # L1: Clear cache
    await cache.cache_delete(f"mem:{agent_name}:{key}")

    # L2+L3: Delete from PostgreSQL (embedding goes with it)
    try:
        result = await database.execute(
            "DELETE FROM jarvis.agent_memory WHERE agent_name = $1 AND memory_key = $2",
            agent_name, key,
        )
        return {
            "status": "deleted",
            "agent": agent_name,
            "key": key,
            "layers_cleared": ["l1_redis", "l2_postgres", "l3_embedding"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Delete failed")
