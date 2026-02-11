"""Training Mode router — scenarios and feedback."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

import database

logger = logging.getLogger("jarvis-brain.training")
router = APIRouter()


class ScenarioCreate(BaseModel):
    scenario_text: str
    expected_response: Optional[str] = None
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard|expert)$")
    category: Optional[str] = None
    agent_name: Optional[str] = None


class FeedbackCreate(BaseModel):
    scenario_id: str
    agent_name: str
    actual_response: str
    feedback: str = Field(..., pattern="^(thumbs_up|thumbs_down|edit)$")
    edited_response: Optional[str] = None
    tokens_used: int = 0
    latency_ms: int = 0


@router.get("/scenarios")
async def list_scenarios(
    difficulty: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(default=50, le=200),
):
    """List training scenarios."""
    try:
        query = "SELECT id::text, scenario_text, expected_response, difficulty, category, agent_name, created_at FROM jarvis.training_scenarios WHERE 1=1"
        params = []

        if difficulty:
            params.append(difficulty)
            query += f" AND difficulty = ${len(params)}"
        if category:
            params.append(category)
            query += f" AND category = ${len(params)}"

        params.append(limit)
        query += f" ORDER BY created_at DESC LIMIT ${len(params)}"

        rows = await database.fetch(query, *params)
        return {
            "scenarios": [
                {
                    "id": r["id"], "text": r["scenario_text"],
                    "expected": r["expected_response"], "difficulty": r["difficulty"],
                    "category": r["category"], "agent": r["agent_name"],
                }
                for r in rows
            ],
            "total": len(rows),
        }
    except Exception as e:
        logger.error(f"List scenarios failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/scenarios")
async def create_scenario(data: ScenarioCreate):
    """Create a training scenario."""
    try:
        sid = await database.fetchval(
            """
            INSERT INTO jarvis.training_scenarios (scenario_text, expected_response, difficulty, category, agent_name)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id::text
            """,
            data.scenario_text, data.expected_response,
            data.difficulty, data.category, data.agent_name,
        )
        return {"status": "created", "id": sid}
    except Exception as e:
        logger.error(f"Create scenario failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/scenarios/{scenario_id}/run")
async def run_scenario(scenario_id: str):
    """Run a training scenario against an agent model (via Ollama)."""
    try:
        row = await database.fetchrow(
            "SELECT scenario_text, expected_response, agent_name FROM jarvis.training_scenarios WHERE id = $1::uuid",
            scenario_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Scenario not found")

        from ollama_client import generate_text

        agent_name = row["agent_name"] or "jarvis"
        prompt = f"You are agent @{agent_name}. Respond to this scenario:\n\n{row['scenario_text']}"

        result = await generate_text(prompt, model="phi3", max_tokens=1024)

        return {
            "scenario_id": scenario_id,
            "agent_name": agent_name,
            "actual_response": result["response"],
            "tokens_used": result["tokens_used"],
            "latency_ms": result["latency_ms"],
            "model": result["model"],
            "expected_response": row["expected_response"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scenario run failed: {e}")
        raise HTTPException(status_code=500, detail="Scenario execution failed")


@router.post("/feedback")
async def submit_feedback(data: FeedbackCreate):
    """Submit feedback for a training run (👍/👎/✏️)."""
    try:
        rid = await database.fetchval(
            """
            INSERT INTO jarvis.training_results (scenario_id, agent_name, actual_response, feedback, edited_response, tokens_used, latency_ms)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
            RETURNING id::text
            """,
            data.scenario_id, data.agent_name, data.actual_response,
            data.feedback, data.edited_response,
            data.tokens_used, data.latency_ms,
        )
        return {"status": "recorded", "id": rid, "feedback": data.feedback}
    except Exception as e:
        logger.error(f"Submit feedback failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats")
async def training_stats(agent_name: Optional[str] = None):
    """Get training statistics."""
    try:
        agent_filter = "WHERE agent_name = $1" if agent_name else ""
        params = [agent_name] if agent_name else []

        row = await database.fetchrow(
            f"""
            SELECT
                COUNT(*) AS total_runs,
                COUNT(CASE WHEN feedback = 'thumbs_up' THEN 1 END) AS positive,
                COUNT(CASE WHEN feedback = 'thumbs_down' THEN 1 END) AS negative,
                COUNT(CASE WHEN feedback = 'edit' THEN 1 END) AS edited,
                AVG(tokens_used)::integer AS avg_tokens,
                AVG(latency_ms)::integer AS avg_latency
            FROM jarvis.training_results
            {agent_filter}
            """,
            *params,
        )

        total = int(row["total_runs"] or 0)
        positive = int(row["positive"] or 0)

        return {
            "total_runs": total,
            "positive": positive,
            "negative": int(row["negative"] or 0),
            "edited": int(row["edited"] or 0),
            "success_rate": round(positive / total, 3) if total > 0 else 0.0,
            "avg_tokens": int(row["avg_tokens"] or 0),
            "avg_latency_ms": int(row["avg_latency"] or 0),
        }
    except Exception as e:
        logger.error(f"Training stats failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
