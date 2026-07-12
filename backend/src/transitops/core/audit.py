"""Audit middleware — who did what, when (Tier-2 B4).

Records every *successful write* (POST/PATCH/PUT/DELETE → 2xx) against the acting user. The
entity id comes from the URL when it's there (`PATCH /vehicles/{id}`) and otherwise from the
`id` in the response body (`POST /vehicles` → the row it just created), which is why JSON write
responses are buffered here. Reads are never audited — that would be noise, not a trail.

Failures in this middleware are swallowed: an audit-log problem must never break the request
that was already successfully committed.
"""

import json
import logging
import re
import uuid

from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from transitops.core.database import SessionLocal
from transitops.core.security import decode_access_token
from transitops.core.settings import get_settings
from transitops.models.audit_log import AuditLog

log = logging.getLogger("transitops.audit")

WRITE_METHODS = {"POST", "PATCH", "PUT", "DELETE"}
UUID_IN_PATH = re.compile(
    r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", re.IGNORECASE
)
# Auth endpoints carry credentials — never persist their bodies.
SKIP_PATHS = ("/auth/login", "/auth/logout", "/auth/token")


class AuditMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, api_prefix: str) -> None:
        super().__init__(app)
        self.api_prefix = api_prefix

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if (
            request.method not in WRITE_METHODS
            or not (200 <= response.status_code < 300)
            or not request.url.path.startswith(self.api_prefix)
            or any(request.url.path.endswith(p) for p in SKIP_PATHS)
        ):
            return response

        body = b""
        if response.headers.get("content-type", "").startswith("application/json"):
            chunks = [chunk async for chunk in response.body_iterator]
            body = b"".join(chunks)
            # The iterator is consumed — hand the client a response that still has a body.
            response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        try:
            # The ORM here is sync: committing inline would block the event loop — and with it
            # every other request, the SSE heartbeats, and the simulator — for the duration of
            # the INSERT. Hand it to a worker thread instead.
            await run_in_threadpool(self._record, request, response.status_code, body)
        except Exception:
            log.exception("failed to write audit log for %s %s", request.method, request.url.path)

        return response

    def _record(self, request: Request, status_code: int, body: bytes) -> None:
        user_id = self._acting_user(request)
        if user_id is None:
            return

        path = request.url.path
        entity_id = self._entity_id(path, body)
        if entity_id is None:
            return

        segments = [s for s in path[len(self.api_prefix) :].split("/") if s]
        entity_name = segments[0] if segments else "unknown"
        # /trips/{id}/dispatch → "trips.dispatch"; PATCH /vehicles/{id} → "vehicles.patch"
        action_suffix = segments[-1] if len(segments) > 2 else request.method.lower()

        db = SessionLocal()
        try:
            db.add(
                AuditLog(
                    user_id=user_id,
                    action=f"{entity_name}.{action_suffix}",
                    entity_name=entity_name,
                    entity_id=entity_id,
                    payload={"method": request.method, "path": path, "status": status_code},
                )
            )
            db.commit()
        finally:
            db.close()

    def _acting_user(self, request: Request) -> uuid.UUID | None:
        settings = get_settings()
        token = request.cookies.get(settings.auth_cookie_name)
        if not token:
            header = request.headers.get("authorization") or ""
            scheme, _, param = header.partition(" ")
            token = param if scheme.lower() == "bearer" else ""
        if not token:
            return None

        payload = decode_access_token(token)
        if not payload:
            return None
        try:
            return uuid.UUID(str(payload.get("sub")))
        except (TypeError, ValueError):
            return None

    def _entity_id(self, path: str, body: bytes) -> uuid.UUID | None:
        match = UUID_IN_PATH.search(path)
        if match:
            return uuid.UUID(match.group(1))

        if not body:
            return None
        try:
            data = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        if isinstance(data, dict) and "id" in data:
            try:
                return uuid.UUID(str(data["id"]))
            except (TypeError, ValueError):
                return None
        return None
