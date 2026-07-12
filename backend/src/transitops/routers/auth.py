from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from transitops.core.database import get_db
from transitops.core.errors import Unauthorized
from transitops.core.rbac import get_current_user
from transitops.core.security import create_access_token, verify_password
from transitops.core.settings import get_settings
from transitops.models.user import User
from transitops.schemas.auth import AuthResponse, LoginRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    settings = get_settings()
    user = db.scalar(
        select(User).options(joinedload(User.role)).where(User.email == payload.email)
    )

    # Same error whether the email is unknown or the password is wrong — don't leak which
    # accounts exist.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise Unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect")
    if not user.is_active:
        raise Unauthorized("ACCOUNT_DISABLED", "This account has been disabled")

    token = create_access_token(user.id, user.role.name)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,  # JS can't read it → XSS can't exfiltrate the session
        samesite="lax",
        secure=settings.auth_cookie_secure,
        max_age=settings.jwt_expires_minutes * 60,
        path="/",
    )
    return AuthResponse(user=UserOut.from_user(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    settings = get_settings()
    response.delete_cookie(settings.auth_cookie_name, path="/")


@router.get("/me", response_model=AuthResponse)
def me(user: User = Depends(get_current_user)):
    return AuthResponse(user=UserOut.from_user(user))


@router.post("/token", include_in_schema=False)
def token_for_curl(payload: LoginRequest, db: Session = Depends(get_db)):
    """Bearer token for curl/Swagger demos — same credentials, no cookie."""
    user = db.scalar(
        select(User).options(joinedload(User.role)).where(User.email == payload.email)
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise Unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect")
    return {
        "access_token": create_access_token(user.id, user.role.name),
        "token_type": "bearer",
    }
