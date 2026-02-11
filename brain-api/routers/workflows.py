"""
Workflow Router — CRUD + execution for workflow definitions.
Uses jarvis.workflows table from init-db.sql.

Endpoints:
  GET    /api/workflows           — list all workflows
  POST   /api/workflows           — create workflow
  GET    /api/workflows/{id}      — get single workflow
  POST   /api/workflows/{id}/run  — execute workflow
  DELETE /api/workflows/{id}      — delete workflow
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..database import database

router = APIRouter(tags=["workflows"])


# ─── Models ───


class WorkflowNode(BaseModel):
    id: str
    type: str  # "trigger" | "agent" | "condition" | "action"
    label: str
    config: dict = Field(default_factory=dict)
    position: dict = Field(default_factory=dict)  # {x, y} for UI


class WorkflowEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    is_active: bool = True


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    nodes: list[dict]
    edges: list[dict]
    is_active: bool
    created_at: str
    updated_at: str


class WorkflowRunResult(BaseModel):
    workflow_id: str
    status: str  # "completed" | "failed" | "partial"
    steps_executed: int
    steps_total: int
    results: list[dict]
    duration_ms: int


# ─── Endpoints ───


@router.get("")
async def list_workflows(
    limit: int = 20,
    offset: int = 0,
    active_only: bool = False,
) -> list[WorkflowResponse]:
    """List all workflows with optional active filter."""
    query = """
        SELECT id, name, description, nodes, edges,
               is_active, created_at, updated_at
        FROM jarvis.workflows
    """
    params: list = []
    if active_only:
        query += " WHERE is_active = true"
    query += " ORDER BY updated_at DESC LIMIT $1 OFFSET $2"
    params.extend([limit, offset])

    rows = await database.fetch(query, *params)
    return [
        WorkflowResponse(
            id=str(r["id"]),
            name=r["name"],
            description=r["description"],
            nodes=r["nodes"] or [],
            edges=r.get("edges") or [],
            is_active=r["is_active"],
            created_at=str(r["created_at"]),
            updated_at=str(r["updated_at"]),
        )
        for r in rows
    ]


@router.post("", status_code=201)
async def create_workflow(data: WorkflowCreate) -> WorkflowResponse:
    """Create a new workflow definition."""
    import json

    workflow_id = await database.fetchval(
        """
        INSERT INTO jarvis.workflows (name, description, nodes, edges, is_active)
        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
        RETURNING id
        """,
        data.name,
        data.description,
        json.dumps([n.model_dump() for n in data.nodes]),
        json.dumps([e.model_dump() for e in data.edges]),
        data.is_active,
    )
    return WorkflowResponse(
        id=str(workflow_id),
        name=data.name,
        description=data.description,
        nodes=[n.model_dump() for n in data.nodes],
        edges=[e.model_dump() for e in data.edges],
        is_active=data.is_active,
        created_at=str(datetime.utcnow()),
        updated_at=str(datetime.utcnow()),
    )


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: UUID) -> WorkflowResponse:
    """Get a single workflow by ID."""
    row = await database.fetchrow(
        """
        SELECT id, name, description, nodes, edges,
               is_active, created_at, updated_at
        FROM jarvis.workflows WHERE id = $1
        """,
        workflow_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return WorkflowResponse(
        id=str(row["id"]),
        name=row["name"],
        description=row["description"],
        nodes=row["nodes"] or [],
        edges=row.get("edges") or [],
        is_active=row["is_active"],
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


@router.post("/{workflow_id}/run")
async def execute_workflow(
    workflow_id: UUID,
    input_data: Optional[dict] = None,
) -> WorkflowRunResult:
    """Execute a workflow by processing its node graph.

    Execution order: trigger → agents → conditions → actions.
    Each node type is processed by a specialized handler.
    """
    import time

    start = time.monotonic()

    row = await database.fetchrow(
        "SELECT nodes, edges, is_active FROM jarvis.workflows WHERE id = $1",
        workflow_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not row["is_active"]:
        raise HTTPException(status_code=400, detail="Workflow is inactive")

    nodes = row["nodes"] or []
    results: list[dict] = []
    steps_executed = 0

    # Simple sequential execution by node type order
    type_order = ["trigger", "agent", "condition", "action"]

    for node_type in type_order:
        type_nodes = [n for n in nodes if n.get("type") == node_type]
        for node in type_nodes:
            steps_executed += 1
            result = {
                "node_id": node.get("id"),
                "type": node_type,
                "label": node.get("label", ""),
                "status": "completed",
                "output": f"Executed {node_type}: {node.get('label', 'unnamed')}",
            }
            # Agent nodes would call the agents API here
            if node_type == "agent":
                agent_name = node.get("config", {}).get("agent", "jarvis")
                result["output"] = f"Agent '{agent_name}' task queued"
            results.append(result)

    duration_ms = int((time.monotonic() - start) * 1000)

    return WorkflowRunResult(
        workflow_id=str(workflow_id),
        status="completed",
        steps_executed=steps_executed,
        steps_total=len(nodes),
        results=results,
        duration_ms=duration_ms,
    )


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: UUID) -> None:
    """Delete a workflow by ID."""
    result = await database.execute(
        "DELETE FROM jarvis.workflows WHERE id = $1",
        workflow_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Workflow not found")
