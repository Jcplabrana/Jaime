"""
Jarvis Brain API — Settings via pydantic-settings.
Reads from environment variables or .env file.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # PostgreSQL
    database_url: str = "postgresql+asyncpg://jarvis:jarvis_secret_2026@localhost:5432/jarvis_brain"

    # Redis
    redis_url: str = "redis://:jarvis_redis_2026@localhost:6379/0"
    redis_cache_ttl: int = 3600  # 1 hour default

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "phi3"
    embedding_dimensions: int = 2560

    # General
    log_level: str = "info"
    api_version: str = "1.0.0"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
