import os
import re
import uuid
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Any, List, Set
from jose import jwt, JWTError
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from backend.app.core.config import settings

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

# Token Revocation List (in-memory cache for degraded mode)
REVOKED_TOKENS: Set[str] = set()

# Argon2id optional support
try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError, InvalidHashError
    _argon2_ph = PasswordHasher()
    ARGON2_AVAILABLE = True
except ImportError:
    _argon2_ph = None
    ARGON2_AVAILABLE = False


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Simplified password policy for farmer ease-of-use:
    - Minimum 4 characters
    - No mandatory uppercase, numbers, or special symbols
    """
    if not password or len(password) < 4:
        return False, "Password must be at least 4 characters long."
    return True, "Password meets requirements."


def hash_password(password: str) -> str:
    """Hash password using Argon2id if available, falling back to bcrypt."""
    if ARGON2_AVAILABLE and _argon2_ph:
        try:
            return _argon2_ph.hash(password)
        except Exception:
            pass
    # Bcrypt fallback
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against hashed password in constant time.
    Supports both Argon2id and bcrypt formatted hashes seamlessly.
    """
    if not plain_password or not hashed_password:
        return False

    try:
        if hashed_password.startswith("$argon2id$") and ARGON2_AVAILABLE and _argon2_ph:
            try:
                return _argon2_ph.verify(hashed_password, plain_password)
            except (VerifyMismatchError, InvalidHashError):
                return False
        
        # Fallback / standard bcrypt verify
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$") or hashed_password.startswith("$2y$"):
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        
        # If hash is unknown format, attempt bcrypt
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(
    subject: Union[str, Any],
    role: str = "farmer",
    expires_delta: Optional[timedelta] = None
) -> str:
    """Generate a signed JWT access token with issuer, audience, jti, and expiration claims."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = str(uuid.uuid4())
    to_encode = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(subject),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": expire,
        "jti": jti
    }
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Generate a signed JWT refresh token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    jti = str(uuid.uuid4())
    to_encode = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(subject),
        "type": "refresh",
        "iat": now,
        "exp": expire,
        "jti": jti
    }
    return jwt.encode(to_encode, settings.REFRESH_TOKEN_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def revoke_token(token: str) -> bool:
    """Add token signature or jti to revocation list in MongoDB."""
    from backend.app.db.mongodb import db_instance
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False, "verify_aud": False, "verify_iss": False}
        )
        jti = payload.get("jti")
    except JWTError:
        jti = None
        
    jti_to_revoke = jti if jti else token
    
    if db_instance.db is not None:
        try:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            await db_instance.db.revoked_tokens.insert_one({
                "jti": jti_to_revoke,
                "expires_at": expire
            })
            return True
        except Exception:
            pass
            
    REVOKED_TOKENS.add(jti_to_revoke)
    return True


async def is_token_revoked(token: str, payload: Optional[dict] = None) -> bool:
    """Check if token or jti is in revocation list in MongoDB."""
    from backend.app.db.mongodb import db_instance
    jti = payload.get("jti") if payload else None
    
    if token in REVOKED_TOKENS or (jti and jti in REVOKED_TOKENS):
        return True
        
    if db_instance.db is not None:
        try:
            query = {"$or": [{"jti": token}]}
            if jti:
                query["$or"].append({"jti": jti})
            revoked = await db_instance.db.revoked_tokens.find_one(query)
            if revoked:
                return True
        except Exception:
            pass
            
    return False


async def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE
        )
        if payload.get("type") != "access" and "type" in payload:
            return None
        if await is_token_revoked(token, payload):
            return None
        return payload
    except JWTError:
        # Permissive fallback for legacy tokens without iss/aud during dev transition
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_aud": False, "verify_iss": False}
            )
            if await is_token_revoked(token, payload):
                return None
            return payload
        except JWTError:
            return None


async def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT refresh token."""
    try:
        payload = jwt.decode(
            token,
            settings.REFRESH_TOKEN_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE
        )
        if payload.get("type") != "refresh":
            return None
        if await is_token_revoked(token, payload):
            return None
        return payload
    except JWTError:
        return None


def require_role(*allowed_roles: str):
    """
    FastAPI dependency guard for Role-Based Access Control (RBAC).
    Usage: @router.get("/admin/stats", dependencies=[Depends(require_role("admin"))])
    """
    async def role_checker(token: str = Depends(oauth2_scheme)):
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        payload = await decode_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_role = payload.get("role", "farmer")
        if allowed_roles and user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {list(allowed_roles)}"
            )
        return payload
    return role_checker
