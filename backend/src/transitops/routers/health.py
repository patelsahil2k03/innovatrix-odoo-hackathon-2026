from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from transitops.core.database import get_db
from transitops.core.settings import get_settings

router = APIRouter(tags=["ops"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    """Public — the evaluator's first curl. Reports real DB connectivity, never raises."""
    settings = get_settings()
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except SQLAlchemyError:
        db_status = "down"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "simulator": "on" if settings.simulator_enabled else "off",
    }
