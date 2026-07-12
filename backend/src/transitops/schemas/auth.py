import uuid

from pydantic import BaseModel, Field, field_validator

from transitops.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: str = Field(examples=["dispatch@transitops.in"])
    password: str = Field(min_length=1, examples=["transitops123"])

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        # Emails are stored lowercase (models/user.py) — normalize at the boundary so login is
        # case-insensitive without a citext column.
        return v.strip().lower()


class UserOut(ORMModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id, email=user.email, full_name=user.full_name, role=user.role.name
        )


class AuthResponse(BaseModel):
    user: UserOut


__all__ = ["LoginRequest", "UserOut", "AuthResponse"]
