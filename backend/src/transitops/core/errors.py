"""Error envelope — every non-2xx response in the API has the shape:

    {"error": {"code": "CARGO_EXCEEDS_CAPACITY", "message": "...", "fields": {...}}}

Contract §0. Invalid input must never surface as a bare 500, so we register handlers for
pydantic validation errors, HTTPException, DB integrity errors, and a catch-all.
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Domain error carrying the contract's code/message/fields triple."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_422_UNPROCESSABLE_ENTITY,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.fields = fields


class NotFound(AppError):
    def __init__(self, entity: str, entity_id: Any) -> None:
        super().__init__(
            "NOT_FOUND", f"{entity} {entity_id} not found", status.HTTP_404_NOT_FOUND
        )


class Conflict(AppError):
    def __init__(self, code: str, message: str, fields: dict[str, str] | None = None) -> None:
        super().__init__(code, message, status.HTTP_409_CONFLICT, fields)


class Unauthorized(AppError):
    def __init__(self, code: str = "UNAUTHORIZED", message: str = "Not authenticated") -> None:
        super().__init__(code, message, status.HTTP_401_UNAUTHORIZED)


class Forbidden(AppError):
    def __init__(self, message: str = "Your role may not perform this action") -> None:
        super().__init__("FORBIDDEN", message, status.HTTP_403_FORBIDDEN)


def _envelope(
    code: str, message: str, fields: dict[str, str] | None, status_code: int
) -> JSONResponse:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return JSONResponse(status_code=status_code, content={"error": error})


# HTTP status → contract code, for the HTTPException fallback path.
_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return _envelope(exc.code, exc.message, exc.fields, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for err in exc.errors():
            # loc looks like ("body", "cargo_weight_kg") — drop the source segment.
            path = [str(p) for p in err["loc"][1:]] or [str(p) for p in err["loc"]]
            fields[".".join(path)] = err["msg"]
        return _envelope(
            "VALIDATION_ERROR",
            "Request failed validation",
            fields,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return _envelope(
            _STATUS_CODES.get(exc.status_code, "ERROR"), detail, None, exc.status_code
        )

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        # A unique/check constraint we did not pre-empt in the service layer. 409, not 500.
        return _envelope(
            "CONFLICT",
            "The request violates a database constraint",
            None,
            status.HTTP_409_CONFLICT,
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        return _envelope(
            "INTERNAL_ERROR",
            "Something went wrong on our side",
            None,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
