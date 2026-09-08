import asyncio
import re
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Request
from backend.app.db.mongodb import get_database
from backend.app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    revoke_token,
    validate_password_strength,
    oauth2_scheme
)
from backend.app.core.lockout_manager import (
    is_account_locked,
    get_remaining_lockout_seconds,
    record_failed_login,
    record_successful_login,
    get_progressive_delay
)
from backend.app.core.rate_limiter import rate_limit, AUTH_LIMIT
from backend.app.core.audit_logger import log_security_event
from backend.app.models.schemas import UserRegister, UserLogin, UserResponse, TokenResponse, ProfileUpdate

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_database)):
    """Dependency to retrieve the currently authenticated user using JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = await decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id = payload.get("sub") if isinstance(payload, dict) else payload
    if not user_id:
        raise credentials_exception

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise credentials_exception

    if user is None:
        raise credentials_exception

    user["id"] = str(user["_id"])
    user.setdefault("role", "farmer")
    user.setdefault("farm_location", None)
    user.setdefault("preferred_language", "en")
    user.setdefault("color_theme", "agrishield-default")
    user.setdefault("navbar_theme", "farmer-dynamic")
    user.setdefault("crop_history", [])
    user.setdefault("farming_practices", "Conventional")
    user.setdefault("farm_profile_completed", False)
    user.setdefault("notification_settings", {})
    
    active_fid = user.get("active_farm_id")
    user["active_farm_id"] = str(active_fid) if active_fid else None
    
    return user

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit(AUTH_LIMIT, 60))])
async def register(request: Request, user_data: UserRegister, db = Depends(get_database)):
    """Register a new user (farmer) with simplified password policy."""
    client_ip = request.client.host if request.client else "127.0.0.1"

    # Validate password strength (simplified: min 4 chars)
    is_valid, msg = validate_password_strength(user_data.password)
    if not is_valid:
        log_security_event("REGISTER_WEAK_PASSWORD", {"email": user_data.email, "reason": msg}, level="WARNING", client_ip=client_ip)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Weak password: {msg}"
        )

    # Normalize email / username: if no @ provided, map to username@agrishield.com
    raw_email = user_data.email.strip().lower()
    email_key = raw_email if "@" in raw_email else f"{raw_email}@agrishield.com"
    username_key = user_data.name.strip()

    # Check if email or username is already taken
    existing_user = await db.users.find_one({
        "$or": [
            {"email": email_key},
            {"email": raw_email},
            {"name": {"$regex": f"^{re.escape(username_key)}$", "$options": "i"}}
        ]
    })
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username or email already exists"
        )

    # Hash password and store password history
    hashed_pwd = hash_password(user_data.password)
    user_dict = {
        "name": username_key,
        "email": email_key,
        "username": raw_email.split("@")[0] if "@" in raw_email else raw_email,
        "password_hash": hashed_pwd,
        "password_history": [hashed_pwd],
        "role": user_data.role or "farmer",
        "farm_location": user_data.farm_location,
        "preferred_language": user_data.preferred_language or "en",
        "crop_history": user_data.crop_history or [],
        "farming_practices": user_data.farming_practices or "Conventional",
        "farm_profile_completed": False,
        "active_farm_id": None,
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.users.insert_one(user_dict)
    user_dict["id"] = str(result.inserted_id)

    log_security_event("REGISTER_SUCCESS", {"user_id": user_dict["id"], "email": user_dict["email"]}, client_ip=client_ip)
    return user_dict

@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit(AUTH_LIMIT, 60))])
async def login(request: Request, credentials: UserLogin, db = Depends(get_database)):
    """Log in user with lockout tracking, progressive delay, and JWT access + refresh tokens."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    login_key = credentials.email.lower().strip()
    login_as_email = login_key if "@" in login_key else f"{login_key}@agrishield.com"

    # 1. Lockout Check
    if is_account_locked(client_ip) or is_account_locked(login_key) or is_account_locked(login_as_email):
        rem_sec = max(get_remaining_lockout_seconds(client_ip), get_remaining_lockout_seconds(login_key), get_remaining_lockout_seconds(login_as_email))
        log_security_event("LOGIN_BLOCKED_LOCKOUT", {"email": login_key}, level="WARNING", client_ip=client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account or IP locked out due to multiple failed login attempts. Try again in {rem_sec} seconds."
        )

    # Find user by exact email, derived email, username, or name
    user = await db.users.find_one({
        "$or": [
            {"email": login_key},
            {"email": login_as_email},
            {"username": login_key},
            {"name": {"$regex": f"^{re.escape(login_key)}$", "$options": "i"}}
        ]
    })
    if not user:
        attempts = record_failed_login(client_ip)
        record_failed_login(login_key)
        delay = get_progressive_delay(attempts)
        if delay > 0:
            await asyncio.sleep(delay)
        log_security_event("LOGIN_FAILED_USER_NOT_FOUND", {"email": login_key}, level="WARNING", client_ip=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, email, or password"
        )

    # 2. Constant-time Password Verification
    if not verify_password(credentials.password, user["password_hash"]):
        attempts = record_failed_login(client_ip)
        record_failed_login(login_key)
        delay = get_progressive_delay(attempts)
        if delay > 0:
            await asyncio.sleep(delay)
        log_security_event("LOGIN_FAILED_INVALID_PASSWORD", {"email": login_key}, level="WARNING", client_ip=client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, email, or password"
        )

    # Success: Reset failed attempts & lockouts
    record_successful_login(client_ip)
    record_successful_login(login_key)
    record_successful_login(login_as_email)

    user_role = user.get("role", "farmer")
    user_id_str = str(user["_id"])

    # 3. Generate Access Token & Refresh Token
    access_token = create_access_token(subject=user_id_str, role=user_role)
    refresh_token = create_refresh_token(subject=user_id_str)

    user["id"] = user_id_str
    user["_id"] = user_id_str
    user["name"] = str(user.get("name") or user.get("full_name") or "User")
    user.setdefault("role", user_role)
    user.setdefault("color_theme", "agrishield-default")
    user.setdefault("navbar_theme", "farmer-dynamic")
    active_fid = user.get("active_farm_id")
    user["active_farm_id"] = str(active_fid) if active_fid else None
    
    created_at_val = user.get("created_at")
    if isinstance(created_at_val, str):
        try:
            user["created_at"] = datetime.fromisoformat(created_at_val.replace('Z', '+00:00'))
        except Exception:
            user["created_at"] = datetime.now(timezone.utc)
    elif not isinstance(created_at_val, datetime):
        user["created_at"] = datetime.now(timezone.utc)

    log_security_event("LOGIN_SUCCESS", {"user_id": user_id_str, "role": user_role}, client_ip=client_ip)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/refresh")
async def refresh_access_token(refresh_token: str, db = Depends(get_database)):
    """Refresh expired access token using valid refresh token."""
    payload = await decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user_id = payload.get("sub")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access_token = create_access_token(subject=str(user["_id"]), role=user.get("role", "farmer"))
    new_refresh_token = create_refresh_token(subject=str(user["_id"]))
    
    # Rotate refresh token
    await revoke_token(refresh_token)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.post("/logout")
async def logout(request: Request, token: str = Depends(oauth2_scheme)):
    """Revoke active JWT session token."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    if token:
        await revoke_token(token)
        try:
            # We can decode it just to get the user ID for the log, ignoring expiration
            import jwt
            from backend.app.core.security import settings
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM], options={"verify_exp": False, "verify_aud": False, "verify_iss": False})
            user_id = payload.get("sub", "unknown")
            log_security_event("LOGOUT_SUCCESS", {"user_id": user_id}, client_ip=client_ip)
        except Exception:
            log_security_event("LOGOUT_SUCCESS", {"user_id": "unknown"}, client_ip=client_ip)
    return {"message": "Successfully logged out and session revoked."}

@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Retrieve profile of current logged in user."""
    return current_user

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    update_data: ProfileUpdate, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_database)
):
    """Update profile information with password history enforcement."""
    update_dict = {}
    if update_data.name is not None:
        update_dict["name"] = update_data.name
    
    if update_data.password is not None and update_data.password != "":
        # Enforce password policy
        is_valid, msg = validate_password_strength(update_data.password)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Weak password: {msg}")

        # Check password history (last 5 passwords)
        user_doc = await db.users.find_one({"_id": ObjectId(current_user["id"])})
        history = user_doc.get("password_history", []) if user_doc else []
        
        for old_hash in history[-5:]:
            if verify_password(update_data.password, old_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot reuse any of your last 5 passwords."
                )

        new_hash = hash_password(update_data.password)
        update_dict["password_hash"] = new_hash
        history.append(new_hash)
        update_dict["password_history"] = history[-10:]  # keep last 10

    if update_data.farm_location is not None:
        update_dict["farm_location"] = update_data.farm_location
    if update_data.preferred_language is not None:
        update_dict["preferred_language"] = update_data.preferred_language
    if update_data.crop_history is not None:
        update_dict["crop_history"] = update_data.crop_history
    if update_data.farming_practices is not None:
        update_dict["farming_practices"] = update_data.farming_practices
    if update_data.farm_profile_completed is not None:
        update_dict["farm_profile_completed"] = update_data.farm_profile_completed
    if update_data.active_farm_id is not None:
        update_dict["active_farm_id"] = ObjectId(update_data.active_farm_id) if update_data.active_farm_id else None
    if update_data.notification_settings is not None:
        update_dict["notification_settings"] = update_data.notification_settings
    if update_data.color_theme is not None:
        update_dict["color_theme"] = update_data.color_theme
    if update_data.navbar_theme is not None:
        update_dict["navbar_theme"] = update_data.navbar_theme

    if not update_dict:
        return current_user

    update_dict["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": update_dict}
    )

    if "preferred_language" in update_dict:
        await db.devices.update_many(
            {"user_id": ObjectId(current_user["id"])},
            {"$set": {"display_language": update_dict["preferred_language"]}}
        )

    updated_user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    updated_user["id"] = str(updated_user["_id"])
    updated_user.setdefault("role", "farmer")
    updated_user.setdefault("farm_location", None)
    updated_user.setdefault("preferred_language", "en")
    updated_user.setdefault("color_theme", "agrishield-default")
    updated_user.setdefault("navbar_theme", "farmer-dynamic")
    updated_user.setdefault("crop_history", [])
    updated_user.setdefault("farming_practices", "Conventional")
    updated_user.setdefault("farm_profile_completed", False)
    updated_user.setdefault("notification_settings", {})
    
    active_fid = updated_user.get("active_farm_id")
    updated_user["active_farm_id"] = str(active_fid) if active_fid else None

    # Sync other active browser sessions for the same user in real-time
    from backend.app.services.notification_service import active_websocket_manager
    if active_websocket_manager:
        try:
            await active_websocket_manager.broadcast_to_user(
                str(current_user["id"]),
                {"type": "profile_updated", "user": updated_user}
            )
        except Exception as e:
            # Silently ignore WS broadcast failures on closed channels
            pass
    
    return updated_user
