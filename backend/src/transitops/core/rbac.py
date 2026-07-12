"""Authentication + RBAC dependencies.

Token is read from the httpOnly cookie first (the web app) and falls back to
`Authorization: Bearer` (curl demos / Swagger "Authorize"). RBAC matrix: docs/02 §3.
"""

import uuid
from collections.abc import Callable

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from transitops.core.database import get_db
from transitops.core.errors import Forbidden, Unauthorized
from transitops.core.settings import get_settings
from transitops.core.security import decode_access_token
from transitops.models.enums import RoleName
from transitops.models.user import User


def _extract_token(request: Request) -> str | None:
    settings = get_settings()
    cookie = request.cookies.get(settings.auth_cookie_name)
    if cookie:
        return cookie
    header = request.headers.get("authorization") or ""
    scheme, _, param = header.partition(" ")
    if scheme.lower() == "bearer" and param:
        return param
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = _extract_token(request)
    if not token:
        raise Unauthorized()

    payload = decode_access_token(token)
    if not payload:
        raise Unauthorized("INVALID_TOKEN", "Session expired or token invalid")

    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except (TypeError, ValueError):
        raise Unauthorized("INVALID_TOKEN", "Session expired or token invalid") from None

    user = db.scalar(
        select(User).options(joinedload(User.role)).where(User.id == user_id)
    )
    if user is None or not user.is_active:
        raise Unauthorized("INVALID_TOKEN", "Account no longer active")
    return user


def require_roles(*roles: RoleName) -> Callable[[User], User]:
    """Route dependency: 403 unless the caller holds one of `roles`."""

    allowed = {r.value for r in roles}

    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role.name not in allowed:
            raise Forbidden(
                f"Role '{user.role.name}' may not perform this action "
                f"(requires: {', '.join(sorted(allowed))})"
            )
        return user

    return _guard


# Write-capability aliases, straight from the RBAC matrix — used as route dependencies so the
# permission is legible at the endpoint rather than buried in a role list.
require_vehicle_write = require_roles(RoleName.FLEET_MANAGER)
require_maintenance_write = require_roles(RoleName.FLEET_MANAGER)
require_driver_write = require_roles(RoleName.SAFETY_OFFICER)
require_trip_write = require_roles(RoleName.DISPATCHER)
require_cost_write = require_roles(RoleName.DISPATCHER, RoleName.FINANCIAL_ANALYST)
require_compliance_write = require_roles(RoleName.SAFETY_OFFICER, RoleName.FLEET_MANAGER)
require_admin = require_roles(RoleName.FLEET_MANAGER)
