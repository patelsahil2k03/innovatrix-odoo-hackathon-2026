"""Shared list-endpoint plumbing: page / page_size / sort / q (contract §0)."""

from dataclasses import dataclass
from typing import Any, TypeVar

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from transitops.core.errors import AppError

T = TypeVar("T")

MAX_PAGE_SIZE = 200


@dataclass
class ListParams:
    page: int
    page_size: int
    sort: str | None
    q: str | None


def list_params(
    page: int = Query(1, ge=1, description="1-indexed page number"),
    page_size: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    sort: str | None = Query(None, description="`field` ascending or `-field` descending"),
    q: str | None = Query(None, description="Free-text search"),
) -> ListParams:
    return ListParams(page=page, page_size=page_size, sort=sort, q=q)


def apply_sort(
    stmt: Select, sort: str | None, sortable: dict[str, InstrumentedAttribute], default: str
) -> Select:
    """Sort by `field` / `-field`, restricted to an allowlist so `sort` can't reach arbitrary SQL."""
    key = sort or default
    descending = key.startswith("-")
    column_name = key[1:] if descending else key

    column = sortable.get(column_name)
    if column is None:
        raise AppError(
            "VALIDATION_ERROR",
            f"Cannot sort by '{column_name}'",
            fields={"sort": f"Allowed: {', '.join(sorted(sortable))}"},
        )
    return stmt.order_by(column.desc() if descending else column.asc())


def paginate(db: Session, stmt: Select, params: ListParams) -> dict[str, Any]:
    """Run `stmt` windowed by `params`, returning the contract's list envelope."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(
        stmt.limit(params.page_size).offset((params.page - 1) * params.page_size)
    ).all()
    return {
        "items": list(rows),
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
    }
