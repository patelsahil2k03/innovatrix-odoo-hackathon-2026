import uuid
from collections.abc import Generator

from sqlalchemy import Uuid, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from transitops.core.settings import get_settings

settings = get_settings()

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Shared declarative base — every model's metadata lands here for Alembic autogenerate."""

    # Mapped[uuid.UUID] columns get a real `uuid` type on Postgres and CHAR(32) on SQLite,
    # with no per-column type annotation needed.
    type_annotation_map = {uuid.UUID: Uuid(as_uuid=True)}


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
