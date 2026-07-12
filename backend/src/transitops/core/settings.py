from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TransitOps API"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://transitops:transitops@localhost:5432/transitops"
    jwt_secret: str = "dev-only-change-me"
    jwt_expires_minutes: int = 480
    simulator_enabled: bool = True
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
