"""PNCP Pipeline router — busca e análise de licitações."""

import json
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

import database
import ollama_client
from utils.math import cosine_similarity
from utils.sanitize import escape_ilike

logger = logging.getLogger("jarvis-brain.pncp")
router = APIRouter()


class LicitacaoCreate(BaseModel):
    pncp_id: str
    orgao: str
    objeto: str
    valor_estimado: Optional[float] = None
    modalidade: Optional[str] = None
    data_abertura: Optional[str] = None
    raw_data: Optional[dict] = Field(default_factory=dict)


class AnaliseRequest(BaseModel):
    licitacao_id: str
    score: float = Field(..., ge=0, le=100)
    recomendacao: str
    analise_detalhada: Optional[dict] = Field(default_factory=dict)
    analyzed_by: str = "@jarvis"


@router.post("/licitacoes")
async def create_licitacao(data: LicitacaoCreate):
    """Store a new licitação from PNCP search."""
    try:
        # Generate embedding for semantic search
        embedding = await ollama_client.generate_embedding(f"{data.orgao} {data.objeto}")

        lid = await database.fetchval(
            """
            INSERT INTO jarvis.licitacoes (pncp_id, orgao, objeto, valor_estimado, modalidade, data_abertura, embedding, raw_data)
            VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::jsonb)
            ON CONFLICT (pncp_id) DO UPDATE SET
                orgao = EXCLUDED.orgao, objeto = EXCLUDED.objeto,
                valor_estimado = EXCLUDED.valor_estimado, updated_at = NOW()
            RETURNING id::text
            """,
            data.pncp_id, data.orgao, data.objeto,
            data.valor_estimado, data.modalidade,
            data.data_abertura, embedding,
            json.dumps(data.raw_data or {}, default=str),
        )
        return {"status": "created", "id": lid, "pncp_id": data.pncp_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create licitação")


@router.get("/licitacoes")
async def list_licitacoes(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    """List licitações with optional status filter."""
    try:
        query = "SELECT id::text, pncp_id, orgao, objeto, valor_estimado, modalidade, data_abertura, status, created_at FROM jarvis.licitacoes"
        params = []

        if status:
            query += " WHERE status = $1"
            params.append(status)

        query += " ORDER BY created_at DESC LIMIT $" + str(len(params) + 1) + " OFFSET $" + str(len(params) + 2)
        params.extend([limit, offset])

        rows = await database.fetch(query, *params)
        total = await database.fetchval(
            "SELECT COUNT(*) FROM jarvis.licitacoes" + (f" WHERE status = $1" if status else ""),
            *(params[:1] if status else []),
        )

        items = []
        for row in rows:
            items.append({
                "id": row["id"],
                "pncp_id": row["pncp_id"],
                "orgao": row["orgao"],
                "objeto": row["objeto"],
                "valor_estimado": float(row["valor_estimado"]) if row["valor_estimado"] else None,
                "modalidade": row["modalidade"],
                "data_abertura": row["data_abertura"].isoformat() if row["data_abertura"] else None,
                "status": row["status"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            })

        return {"licitacoes": items, "total": int(total or 0), "limit": limit, "offset": offset}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/analyze")
async def analyze_licitacao(data: AnaliseRequest):
    """Store analysis result for a licitação."""
    try:
        aid = await database.fetchval(
            """
            INSERT INTO jarvis.analises (licitacao_id, score, recomendacao, analise_detalhada, analyzed_by)
            VALUES ($1::uuid, $2, $3, $4::jsonb, $5)
            RETURNING id::text
            """,
            data.licitacao_id, data.score, data.recomendacao,
            json.dumps(data.analise_detalhada or {}, default=str),
            data.analyzed_by,
        )

        # Update licitação status
        await database.execute(
            "UPDATE jarvis.licitacoes SET status = 'analisada' WHERE id = $1::uuid AND status = 'nova'",
            data.licitacao_id,
        )

        return {"status": "analyzed", "id": aid, "licitacao_id": data.licitacao_id, "score": data.score}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Analysis failed")


@router.get("/search")
async def search_licitacoes(q: str, limit: int = 10):
    """Semantic search across licitações using embeddings."""
    query_embedding = await ollama_client.generate_embedding(q)
    if not query_embedding:
        # Fallback to text search
        try:
            rows = await database.fetch(
                """
                SELECT id::text, pncp_id, orgao, objeto, valor_estimado, status
                FROM jarvis.licitacoes
                WHERE objeto ILIKE $1 OR orgao ILIKE $1
                ORDER BY created_at DESC LIMIT $2
                """,
                f"%{escape_ilike(q)}%", limit,
            )
            return {"query": q, "method": "text", "results": [dict(r) for r in rows], "total": len(rows)}
        except Exception as e:
            raise HTTPException(status_code=500, detail="Search failed")

    # Semantic search with embeddings
    try:
        rows = await database.fetch(
            "SELECT id::text, pncp_id, orgao, objeto, valor_estimado, status, embedding FROM jarvis.licitacoes WHERE embedding IS NOT NULL LIMIT 200"
        )

        scored = []
        for row in rows:
            if row["embedding"]:
                sim = cosine_similarity(query_embedding, list(row["embedding"]))
                scored.append({
                    "id": row["id"],
                    "pncp_id": row["pncp_id"],
                    "orgao": row["orgao"],
                    "objeto": row["objeto"],
                    "valor_estimado": float(row["valor_estimado"]) if row["valor_estimado"] else None,
                    "status": row["status"],
                    "similarity": round(sim, 4),
                })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return {"query": q, "method": "semantic", "results": scored[:limit], "total": len(scored[:limit])}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Search failed")
