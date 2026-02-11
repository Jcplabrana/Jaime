"""
API Key authentication middleware.
Reads BRAIN_API_KEY (api_key) from settings.
If empty, auth is disabled (dev mode).
"""

import logging

from fastapi import Request, HTTPException, WebSocket
from starlette.middleware.base import BaseHTTPMiddleware

from config import get_settings

logger = logging.getLogger("jarvis-brain.auth")

# Paths that skip auth
_PUBLIC_PATHS = {"/health", "/health/detailed", "/docs", "/redoc", "/openapi.json"}


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Validate X-API-Key header on every request (when api_key is set)."""

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()

        # Auth disabled in dev mode
        if not settings.api_key:
            return await call_next(request)

        # Skip auth for public endpoints
        if request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        # Validate key
        provided_key = request.headers.get("X-API-Key", "")
        if provided_key != settings.api_key:
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

        return await call_next(request)


def verify_ws_token(websocket: WebSocket) -> bool:
    """Validate WebSocket connection via query param or header."""
    settings = get_settings()

    # Auth disabled in dev mode
    if not settings.api_key:
        return True

    # Check query param first, then header
    token = websocket.query_params.get("token", "")
    if not token:
        token = websocket.headers.get("X-API-Key", "")

    return token == settings.api_key
