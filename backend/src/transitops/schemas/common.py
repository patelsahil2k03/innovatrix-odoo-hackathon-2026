from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    """Response models read straight off SQLAlchemy instances."""

    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    """List envelope (contract §0)."""

    items: list[T]
    total: int
    page: int
    page_size: int
