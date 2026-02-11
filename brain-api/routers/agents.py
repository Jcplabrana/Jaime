"""Agents management router — real DB queries + dynamic config loading."""

import json
import logging
import os
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import database
from websocket_manager import manager as ws_manager, Events

logger = logging.getLogger("jarvis-brain.agents")
router = APIRouter()

# Path to agent configs (relative to project root)
AGENTS_DIR = Path(__file__).parent.parent.parent / "agents"


def _load_agent_configs() -> list[dict]:
    """Load agent configs from agents/*/config.yaml dynamically."""
    agents = []
    if not AGENTS_DIR.exists():
        logger.warning(f"Agents dir not found: {AGENTS_DIR}")
        return agents

    for agent_dir in sorted(AGENTS_DIR.iterdir()):
        config_file = agent_dir / "config.yaml"
        if agent_dir.is_dir() and config_file.exists():
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    config = yaml.safe_load(f)
                    agents.append({
                        "name": config.get("name", agent_dir.name),
                        "role": config.get("role", "unknown"),
                        "description": config.get("description", ""),
                        "model": config.get("model", {}),
                        "max_iterations": config.get("max_iterations", 30),
                        "max_tools": config.get("max_tools", 15),
                        "capabilities": config.get("capabilities", []),
                        "personality": config.get("personality", ""),
                        "status": "active",
                    })
            except Exception as e:
                logger.error(f"Failed to load {config_file}: {e}")
    return agents


class TaskDelegation(BaseModel):
    title: str
    description: str
    target_agent: str
    delegated_by: str = "jarvis"
    priority: int = Field(default=5, ge=1, le=10)
    input_data: Optional[dict] = Field(default_factory=dict)


class TaskUpdate(BaseModel):
    status: str = Field(..., pattern="^(inbox|in_progress|completed|failed|cancelled)$")
    output_data: Optional[dict] = None
    error_message: Optional[str] = None


@router.get("/")
async def list_agents():
    """List all configured agents from YAML configs."""
    agents = _load_agent_configs()
    return {
        "agents": agents,
        "total": len(agents),
        "active": sum(1 for a in agents if a["status"] == "active"),
    }


@router.get("/{agent_name}")
async def get_agent(agent_name: str):
    """Get detailed info about a specific agent including DB stats."""
    agents = _load_agent_configs()
    agent = next((a for a in agents if a["name"] == agent_name), None)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")

    # Get real stats from DB
    try:
        stats = await database.fetchrow(
            """
            SELECT
                COUNT(*) AS total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress
            FROM jarvis.agent_tasks
            WHERE assigned_agent = $1
            """,
            agent_name,
        )
        agent["stats"] = {
            "total_tasks": int(stats["total_tasks"] or 0),
            "completed": int(stats["completed"] or 0),
            "failed": int(stats["failed"] or 0),
            "in_progress": int(stats["in_progress"] or 0),
        }
    except Exception as e:
        logger.error(f"Stats query failed: {e}")
        agent["stats"] = {"total_tasks": 0, "completed": 0, "failed": 0, "in_progress": 0}

    return agent


@router.get("/{agent_name}/tasks")
async def get_agent_tasks(agent_name: str, status: Optional[str] = None, limit: int = 50):
    """Get tasks assigned to an agent from DB."""
    try:
        query = """
            SELECT id::text, title, description, assigned_agent, delegated_by,
                   status, priority, input_data, output_data, error_message,
                   retry_count, started_at, completed_at, created_at
            FROM jarvis.agent_tasks
            WHERE assigned_agent = $1
        """
        params = [agent_name]

        if status:
            query += " AND status = $2"
            params.append(status)

        query += " ORDER BY priority DESC, created_at DESC LIMIT $" + str(len(params) + 1)
        params.append(limit)

        rows = await database.fetch(query, *params)
        tasks = []
        for row in rows:
            tasks.append({
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
                "delegated_by": row["delegated_by"],
                "status": row["status"],
                "priority": row["priority"],
                "input_data": dict(row["input_data"]) if row["input_data"] else {},
                "output_data": dict(row["output_data"]) if row["output_data"] else None,
                "error_message": row["error_message"],
                "retry_count": row["retry_count"],
                "started_at": row["started_at"].isoformat() if row["started_at"] else None,
                "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            })

        return {"agent": agent_name, "tasks": tasks, "total": len(tasks)}
    except Exception as e:
        logger.error(f"Tasks query failed: {e}")
        return {"agent": agent_name, "tasks": [], "total": 0, "error": "Query failed"}


@router.post("/delegate")
async def delegate_task(delegation: TaskDelegation):
    """Delegate a task from one agent to another — persists in DB."""
    # Validate target agent exists
    agents = _load_agent_configs()
    valid_names = [a["name"] for a in agents]
    if delegation.target_agent not in valid_names:
        raise HTTPException(
            status_code=400,
            detail=f"Agent '{delegation.target_agent}' not found. Available: {valid_names}",
        )

    try:
        task_id = await database.fetchval(
            """
            INSERT INTO jarvis.agent_tasks (title, description, assigned_agent, delegated_by, priority, input_data)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            RETURNING id::text
            """,
            delegation.title, delegation.description,
            delegation.target_agent, delegation.delegated_by,
            delegation.priority,
            json.dumps(delegation.input_data or {}, default=str),
        )

        # Broadcast to connected WebSocket clients
        await ws_manager.broadcast(Events.AGENT_TASK_STARTED, {
            "task_id": task_id,
            "agent": delegation.target_agent,
            "title": delegation.title,
            "priority": delegation.priority,
        })

        return {
            "status": "delegated",
            "task_id": task_id,
            "target_agent": delegation.target_agent,
            "delegated_by": delegation.delegated_by,
            "title": delegation.title,
            "priority": delegation.priority,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Delegation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Delegation failed")


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, update: TaskUpdate):
    """Update task status (agent reports progress/completion)."""
    try:
        extra_sets = []
        params = [update.status, task_id]

        if update.status == "in_progress":
            extra_sets.append("started_at = NOW()")
        elif update.status in ("completed", "failed"):
            extra_sets.append("completed_at = NOW()")

        if update.output_data is not None:
            params.insert(-1, json.dumps(update.output_data, default=str))
            extra_sets.append(f"output_data = ${len(params) - 1}::jsonb")

        if update.error_message is not None:
            params.insert(-1, update.error_message)
            extra_sets.append(f"error_message = ${len(params) - 1}")

        extra = (", " + ", ".join(extra_sets)) if extra_sets else ""

        await database.execute(
            f"UPDATE jarvis.agent_tasks SET status = $1{extra} WHERE id = ${len(params)}::uuid",
            *params,
        )

        # Broadcast task update to WebSocket clients
        await ws_manager.broadcast(Events.AGENT_TASK_COMPLETED, {
            "task_id": task_id,
            "status": update.status,
        })

        return {"status": "updated", "task_id": task_id, "new_status": update.status}
    except Exception as e:
        logger.error(f"Task update failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Update failed")
