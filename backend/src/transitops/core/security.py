"""Password hashing (bcrypt) + JWT issue/verify.

We call the `bcrypt` package directly rather than through passlib: passlib 1.7.4 probes
`bcrypt.__about__`, which bcrypt 5.x removed, and blows up on backend detection.
"""

import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from transitops.core.settings import get_settings

# bcrypt hashes at most 72 bytes and errors on longer input; truncate so a long password is
# merely weakened, never a 500.
_MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8")[:_MAX_PASSWORD_BYTES], bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8")[:_MAX_PASSWORD_BYTES], password_hash.encode("utf-8")
        )
    except ValueError:
        # Malformed/legacy hash in the DB — treat as a failed login, not a crash.
        return False


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
