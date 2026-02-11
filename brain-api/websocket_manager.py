"""
WebSocket Connection Manager — real-time event distribution.
Manages client connections and broadcasts events to all connected clients.
Part of Sprint 5C: WebSocket Real-Time.
"""

import logging
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger("jarvis-brain.websocket")


class ConnectionManager:
    """Manages WebSocket connections with heartbeat and broadcast."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Active: {len(self.active_connections)}")

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(message)
        except Exception as e:
            logger.warning(f"Failed to send personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, event_type: str, data: Optional[dict] = None) -> None:
        """Broadcast an event to all connected clients."""
        message = {
            "type": event_type,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        disconnected = []
        for connection in self.active_connections:
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_json(message)
                else:
                    disconnected.append(connection)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def close_all(self) -> None:
        """Gracefully close all WebSocket connections (for shutdown)."""
        for connection in list(self.active_connections):
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.close(code=1001, reason="Server shutting down")
            except Exception:
                pass
        self.active_connections.clear()
        logger.info("All WebSocket connections closed.")

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# Global singleton
manager = ConnectionManager()


# Event type constants
class Events:
    # Agent events
    AGENT_STATUS_CHANGED = "agent.status_changed"
    AGENT_TASK_STARTED = "agent.task_started"
    AGENT_TASK_COMPLETED = "agent.task_completed"

    # Memory events
    MEMORY_STORED = "memory.stored"
    MEMORY_SEARCHED = "memory.searched"

    # Training events
    TRAINING_SCENARIO_RUN = "training.scenario_run"
    TRAINING_FEEDBACK_SUBMITTED = "training.feedback_submitted"

    # Workflow events
    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_STEP_COMPLETED = "workflow.step_completed"

    # System events
    SYSTEM_HEALTH = "system.health"
    SYSTEM_ERROR = "system.error"
    CACHE_HIT = "cache.hit"
