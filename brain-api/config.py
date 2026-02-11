"""
Jarvis Brain API — Settings via pydantic-settings.
Reads from environment variables or .env file.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    # PostgreSQL (REQUIRED — no hardcoded password)
    database_url: str = Field(..., description="PostgreSQL connection URL")

    # Redis (REQUIRED — no hardcoded password)
    redis_url: str = Field(..., description="Redis connection URL")
    redis_cache_ttl: int = 3600  # 1 hour default

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "phi3"
    embedding_dimensions: int = 2560

    # Security
    api_key: str = ""  # Empty = auth disabled (dev mode)
    cors_origins: str = "http://localhost:3000"

    # General
    log_level: str = "info"
    api_version: str = "1.0.0"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
