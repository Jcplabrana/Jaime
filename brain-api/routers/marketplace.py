"""Agent Marketplace router — templates, install, rating."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

import database

logger = logging.getLogger("jarvis-brain.marketplace")
router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    config: dict = Field(default_factory=dict)
    is_official: bool = False


class RatingUpdate(BaseModel):
    rating: float = Field(..., ge=0, le=5)


@router.get("/templates")
async def list_templates(
    category: Optional[str] = None,
    limit: int = Query(default=50, le=200),
):
    """List agent templates in marketplace."""
    try:
        query = """
            SELECT id::text, name, description, icon, category, config,
                   rating, downloads, is_official, created_at
            FROM jarvis.agent_templates WHERE 1=1
        """
        params = []

        if category:
            params.append(category)
            query += f" AND category = ${len(params)}"

        params.append(limit)
        query += f" ORDER BY downloads DESC, rating DESC LIMIT ${len(params)}"

        rows = await database.fetch(query, *params)
        return {
            "templates": [
                {
                    "id": r["id"], "name": r["name"], "description": r["description"],
                    "icon": r["icon"], "category": r["category"],
                    "config": dict(r["config"]) if r["config"] else {},
                    "rating": float(r["rating"] or 0),
                    "downloads": int(r["downloads"] or 0),
                    "is_official": r["is_official"],
                }
                for r in rows
            ],
            "total": len(rows),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates")
async def create_template(data: TemplateCreate):
    """Publish a new agent template."""
    try:
        tid = await database.fetchval(
            """
            INSERT INTO jarvis.agent_templates (name, description, icon, category, config, is_official)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            RETURNING id::text
            """,
            data.name, data.description, data.icon, data.category,
            json.dumps(data.config, default=str), data.is_official,
        )
        return {"status": "published", "id": tid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/{template_id}/install")
async def install_template(template_id: str):
    """Install (download) a template — increments download counter."""
    try:
        config = await database.fetchval(
            """
            UPDATE jarvis.agent_templates SET downloads = downloads + 1
            WHERE id = $1::uuid
            RETURNING config
            """,
            template_id,
        )
        if config is None:
            raise HTTPException(status_code=404, detail="Template not found")

        return {
            "status": "installed",
            "template_id": template_id,
            "config": dict(config) if config else {},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/templates/{template_id}/rate")
async def rate_template(template_id: str, data: RatingUpdate):
    """Rate a template (simple overwrite for now)."""
    try:
        await database.execute(
            "UPDATE jarvis.agent_templates SET rating = $1 WHERE id = $2::uuid",
            data.rating, template_id,
        )
        return {"status": "rated", "template_id": template_id, "rating": data.rating}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
