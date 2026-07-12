from fastapi import APIRouter

from transitops.core.settings import get_settings

router = APIRouter(tags=["ops"])


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "db": "pending",  # flips to real connectivity check once models land (Card C)
        "simulator": "on" if settings.simulator_enabled else "off",
    }
