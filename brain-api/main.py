"""
OpenClaw Jarvis Edition - Brain API
FastAPI backend for Memory Engine, Agent Management, and Analytics.
"""

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import database
import cache
from config import get_settings
from routers import memory, agents, analytics, health, pncp, training, marketplace, workflows, cache_stats
from websocket_manager import manager as ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("jarvis-brain")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — connect and disconnect services."""
    settings = get_settings()
    logger.info("🧠 Jarvis Brain API starting...")
    logger.info(f"🗄️ Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'local'}")
    logger.info(f"⚡ Redis: {settings.redis_url.split('@')[1] if '@' in settings.redis_url else 'local'}")
    logger.info(f"🤖 Ollama: {settings.ollama_base_url}")

    # Initialize pools
    await database.get_pool()
    await cache.get_redis()

    yield

    # Cleanup
    await database.close_pool()
    await cache.close_redis()
    logger.info("🧠 Jarvis Brain API shut down.")


app = FastAPI(
    title="Jarvis Brain API",
    description="Memory Engine, Agent Management & Analytics for OpenClaw Jarvis Edition",
    version=get_settings().api_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(memory.router, prefix="/api/memory", tags=["Memory"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(pncp.router, prefix="/api/pncp", tags=["PNCP"])
app.include_router(training.router, prefix="/api/training", tags=["Training"])
app.include_router(marketplace.router, prefix="/api/marketplace", tags=["Marketplace"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(cache_stats.router, prefix="/api/cache", tags=["Cache"])


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time event stream for Jarvis frontend."""
    await ws_manager.connect(websocket)
    # Send initial status
    await ws_manager.send_personal(websocket, {
        "type": "system.connected",
        "data": {
            "message": "Connected to Jarvis Brain API",
            "active_connections": ws_manager.connection_count,
        },
    })
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data) if data else {}
            # Handle ping/pong heartbeat
            if msg.get("type") == "ping":
                await ws_manager.send_personal(websocket, {"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
