from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "TransitOps API"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://transitops:transitops@localhost:5432/transitops"

    # 32+ bytes so HS256 doesn't warn about a short HMAC key; still dev-only, rotate in real .env
    jwt_secret: str = "dev-only-insecure-default-please-rotate-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 480
    auth_cookie_name: str = "transitops_token"
    # Cookies are cross-site (web :3000 → api :8000) but both are http://localhost in dev, where
    # SameSite=none would require Secure=true and be dropped. Lax + same-host origins works.
    auth_cookie_secure: bool = False

    simulator_enabled: bool = True
    simulator_interval_seconds: float = 3.0

    cors_origins: list[str] = ["http://localhost:3000"]

    # Demo password for every seeded account — printed by the seed script, shown on the login screen.
    # seed/seed.py imports this as the single source of truth rather than hardcoding its own value.
    seed_password: str = "Demo@1234"


@lru_cache
def get_settings() -> Settings:
    return Settings()
