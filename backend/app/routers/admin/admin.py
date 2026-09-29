from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
from bson import ObjectId
from backend.app.db.mongodb import get_database
from backend.app.core.security import require_role, hash_password, validate_password_strength
from backend.app.core.rate_limiter import rate_limit, ADMIN_LIMIT
from backend.app.core.audit_logger import log_security_event
from backend.app.models.schemas import UserResponse
from backend.app.services.notification_service import NotificationService
from backend.app.models.notification import NotificationCreate
import logging
import asyncio
import json
import hashlib
from pymongo.errors import DuplicateKeyError
from backend.app.services.translation_service import TranslationService
from backend.app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

_admin_mutation_lock = asyncio.Lock()

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])

@router.get("/users", dependencies=[Depends(require_role("admin")), Depends(rate_limit(ADMIN_LIMIT, 60))])
async def list_all_users(
    skip: Optional[int] = Query(None, ge=0),
    limit: int = Query(50, ge=1, le=100),
    page: Optional[int] = Query(None, ge=1),
    role_filter: Optional[str] = None,
    search: Optional[str] = None,
    db = Depends(get_database)
):
    """
    Strict Admin Endpoint: Retrieve paginated list of registered users from MongoDB.
    Supports skip/limit, page-based pagination, role filtering, and safe keyword search.
    Requires 'admin' role authentication.
    """
    # Calculate skip from page if explicit page parameter provided
    if skip is not None:
        effective_skip = skip
    elif page is not None:
        effective_skip = (page - 1) * limit
    else:
        effective_skip = 0

    query: Dict[str, Any] = {}
    if role_filter and role_filter != "all":
        query["role"] = role_filter

    if search:
        search_clean = search.strip()
        if search_clean:
            search_clause = [
                {"name": {"$regex": search_clean, "$options": "i"}},
                {"email": {"$regex": search_clean, "$options": "i"}},
                {"phone": {"$regex": search_clean, "$options": "i"}}
            ]
            if ObjectId.is_valid(search_clean):
                search_clause.append({"_id": ObjectId(search_clean)})

            if query:
                query = {"$and": [query, {"$or": search_clause}]}
            else:
                query = {"$or": search_clause}

    total_users = await db.users.count_documents(query)
    cursor = db.users.find(query).sort("created_at", -1).skip(effective_skip).limit(limit)
    users_list = await cursor.to_list(length=limit)

    sanitized_users = []
    for user in users_list:
        sanitized = {
            "id": str(user["_id"]),
            "name": user.get("name"),
            "email": user.get("email"),
            "phone": user.get("phone") or user.get("mobile") or "",
            "role": user.get("role", "farmer"),
            "farm_location": user.get("farm_location"),
            "preferred_language": user.get("preferred_language", "en"),
            "farming_practices": user.get("farming_practices", "Conventional"),
            "farm_profile_completed": user.get("farm_profile_completed", False),
            "provider_profile": user.get("provider_profile"),
            "created_at": user.get("created_at")
        }
        sanitized_users.append(sanitized)

    current_page = (effective_skip // limit) + 1
    total_pages = (total_users + limit - 1) // limit if total_users > 0 else 1
    has_more = (effective_skip + len(sanitized_users)) < total_users

    return {
        "total": total_users,
        "skip": effective_skip,
        "limit": limit,
        "page": current_page,
        "total_pages": total_pages,
        "has_more": has_more,
        "users": sanitized_users
    }

@router.get("/users/{user_id}", dependencies=[Depends(require_role("admin"))])
async def get_user_by_id(user_id: str, db = Depends(get_database)):
    """Strict Admin Endpoint: Get detailed information of a specific user by ID."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid User ID format")

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user["id"] = str(user["_id"])
    user.pop("password_hash", None)
    user.pop("password_history", None)
    user["_id"] = str(user["_id"])
    return user


@router.put("/users/{user_id}/role", dependencies=[Depends(require_role("admin"))])
async def update_user_role(
    user_id: str,
    new_role: str = Query(..., pattern="^(admin|farmer|equipment_provider|researcher|tester|guest)$"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Strict Admin Endpoint: Change role of any registered user."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid User ID format")

    target_oid = ObjectId(user_id)
    current_user_id = str(current_user.get("id") or current_user.get("_id") or current_user.get("sub", ""))

    async with _admin_mutation_lock:
        target_user = await db.users.find_one({"_id": target_oid})
        if not target_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # 1. Prevent self-demotion
        is_self = (user_id == current_user_id) or (str(target_user.get("_id")) == current_user_id)
        if is_self and new_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote your own active administrator account"
            )

        # 2. Prevent demoting the last remaining admin
        if target_user.get("role") == "admin" and new_role != "admin":
            admin_count = await db.users.count_documents({"role": "admin"})
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot demote the sole remaining administrator account"
                )

        try:
            result = await db.users.update_one(
                {"_id": target_oid},
                {"$set": {"role": new_role}}
            )
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid User ID format")

        matched_count = getattr(result, "matched_count", 1 if result else 0)
        if matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    log_security_event("USER_ROLE_UPDATED", {"user_id": user_id, "new_role": new_role, "actor_id": current_user_id}, level="INFO")
    return {"message": f"Successfully updated user {user_id} role to '{new_role}'."}


class UserEditRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    preferred_language: Optional[str] = None
    farming_practices: Optional[str] = None
    farm_location: Optional[str] = None
    provider_profile: Optional[Dict[str, Any]] = None

class AdminPasswordResetRequest(BaseModel):
    new_password: str

@router.put("/users/{user_id}", dependencies=[Depends(require_role("admin"))])
async def edit_user_details(
    user_id: str,
    edit_data: UserEditRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Admin Endpoint: Edit user profile details (Name, Email, Role, Language, Location, Phone, Provider Profile)."""
    try:
        update_fields = {}
        if edit_data.name is not None: update_fields["name"] = edit_data.name
        if edit_data.email is not None: update_fields["email"] = edit_data.email.lower().strip()
        if edit_data.phone is not None:
            update_fields["phone"] = edit_data.phone.strip()
            update_fields["mobile"] = edit_data.phone.strip()
        if edit_data.preferred_language is not None: update_fields["preferred_language"] = edit_data.preferred_language
        if edit_data.farming_practices is not None: update_fields["farming_practices"] = edit_data.farming_practices
        if edit_data.farm_location is not None: update_fields["farm_location"] = edit_data.farm_location
        if edit_data.provider_profile is not None: update_fields["provider_profile"] = edit_data.provider_profile

        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid User ID format")

        target_oid = ObjectId(user_id)
        current_user_id = str(current_user.get("id") or current_user.get("_id") or current_user.get("sub", ""))

        async with _admin_mutation_lock:
            target_user = await db.users.find_one({"_id": target_oid})
            if not target_user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

            if edit_data.role is not None:
                new_role = edit_data.role.lower().strip()
                is_self = (user_id == current_user_id) or (str(target_user.get("_id")) == current_user_id)
                if is_self and new_role != "admin":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot demote your own active administrator account"
                    )
                if target_user.get("role") == "admin" and new_role != "admin":
                    admin_count = await db.users.count_documents({"role": "admin"})
                    if admin_count <= 1:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot demote the sole remaining administrator account"
                        )
                update_fields["role"] = new_role

            if not update_fields:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update")

            result = await db.users.update_one(
                {"_id": target_oid},
                {"$set": update_fields}
            )
            matched_count = getattr(result, "matched_count", 1 if result else 0)
            if matched_count == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to update user: {str(e)}")

    log_security_event("USER_PROFILE_EDITED", {"user_id": user_id, "updated_fields": list(update_fields.keys()), "actor_id": current_user_id}, level="INFO")
    return {"message": "User details updated successfully."}

@router.delete("/users/{target_user_id}", dependencies=[Depends(require_role("admin"))])
async def delete_user(
    target_user_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Admin endpoint to permanently delete a user and their data."""
    if not ObjectId.is_valid(target_user_id):
        raise HTTPException(status_code=400, detail="Invalid target user ID")

    target_oid = ObjectId(target_user_id)
    current_user_id = str(current_user.get("id") or current_user.get("_id") or current_user.get("sub", ""))

    async with _admin_mutation_lock:
        target_user = await db.users.find_one({"_id": target_oid})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

        # 1. Prevent self-deletion
        is_self = (target_user_id == current_user_id) or (str(target_user.get("_id")) == current_user_id)
        if is_self:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own active administrator account"
            )

        # 2. Prevent deleting the last remaining admin
        if target_user.get("role") == "admin":
            admin_count = await db.users.count_documents({"role": "admin"})
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete the sole remaining administrator account"
                )

        # Cascade delete (predictions, telemetry, etc.)
        await db.predictions.delete_many({"user_id": target_user_id})
        await db.iot_telemetry.delete_many({"user_id": target_user_id})
        await db.notifications.delete_many({"user_id": target_user_id})

        res = await db.users.delete_one({"_id": target_oid})
        deleted_count = getattr(res, "deleted_count", 1 if res else 0)
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

    log_security_event("USER_ACCOUNT_DELETED", {"deleted_user_id": target_user_id, "actor_id": current_user_id}, level="WARNING")
    return {"status": "success", "message": f"User {target_user_id} and associated data deleted"}

@router.get("/audit-logs", dependencies=[Depends(require_role("admin"))])
async def get_audit_logs(
    limit: int = Query(500, ge=1, le=2000),
    db = Depends(get_database)
):
    """Retrieve security audit logs from the database for the Admin Control Panel."""
    cursor = db.audit_logs.find({}).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    for log in logs:
        if "_id" in log:
            log["_id"] = str(log["_id"])
        if "timestamp" in log and hasattr(log["timestamp"], "isoformat"):
            log["timestamp"] = log["timestamp"].isoformat()
    return logs

@router.post("/users/{user_id}/reset-password", dependencies=[Depends(require_role("admin"))])
async def reset_user_password(user_id: str, payload: AdminPasswordResetRequest, db = Depends(get_database)):
    """Admin Endpoint: Force reset password for any user account."""
    is_valid, msg = validate_password_strength(payload.new_password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Weak password: {msg}")

    pwd_hash = hash_password(payload.new_password)
    try:
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "password_hash": pwd_hash,
                "password_history": [pwd_hash],
                "failed_login_attempts": 0,
                "account_locked_until": None
            }}
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid User ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    log_security_event("ADMIN_PASSWORD_RESET", {"target_user_id": user_id}, level="WARNING")
    return {"message": "User password successfully reset."}


class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    role: Optional[str] = "farmer"
    preferred_language: Optional[str] = "en"
    farm_location: Optional[str] = None
    provider_profile: Optional[Dict[str, Any]] = None

@router.post("/create-user", dependencies=[Depends(require_role("admin"))])
async def admin_create_new_user(payload: AdminCreateUserRequest, db = Depends(get_database)):
    """Admin Endpoint: Register/Create a new user account (Admin, Farmer, Equipment Provider, Tester, Researcher)."""
    email_clean = payload.email.lower().strip()
    
    # Check duplicate
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Email '{email_clean}' is already registered.")

    # Validate Password
    is_valid, msg = validate_password_strength(payload.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Weak password: {msg}")

    pwd_hash = hash_password(payload.password)
    phone_clean = payload.phone.strip() if payload.phone else ""
    new_user_doc = {
        "name": payload.name.strip(),
        "email": email_clean,
        "phone": phone_clean,
        "mobile": phone_clean,
        "password_hash": pwd_hash,
        "role": payload.role.lower() if payload.role else "farmer",
        "preferred_language": payload.preferred_language or "en",
        "farm_location": payload.farm_location or "",
        "farming_practices": "Conventional",
        "farm_profile_completed": True if (payload.farm_location or payload.role == "equipment_provider") else False,
        "provider_profile": payload.provider_profile or {},
        "failed_login_attempts": 0,
        "account_locked_until": None,
        "created_at": datetime.now(timezone.utc),
        "password_history": [pwd_hash]
    }

    insert_result = await db.users.insert_one(new_user_doc)
    new_id = str(insert_result.inserted_id)

    log_security_event("ADMIN_USER_CREATED", {"created_user_id": new_id, "email": email_clean, "role": payload.role}, level="INFO")

    return {
        "message": f"Successfully created new {payload.role.upper()} account for {email_clean}.",
        "user": {
            "id": new_id,
            "name": payload.name,
            "email": email_clean,
            "phone": phone_clean,
            "role": payload.role,
            "farm_location": payload.farm_location,
            "preferred_language": payload.preferred_language,
            "farm_profile_completed": True if (payload.farm_location or payload.role == "equipment_provider") else False,
            "provider_profile": payload.provider_profile or {},
            "created_at": new_user_doc["created_at"]
        }
    }


class AdminBroadcastRequest(BaseModel):
    title: str
    message: str
    priority: str = "High"
    audience: str = "all"  # 'farmers' | 'providers' | 'all'
    action_url: Optional[str] = "/dashboard"
    idempotency_key: Optional[str] = None

@router.post("/broadcast", dependencies=[Depends(require_role("admin"))])
async def broadcast_system_notification(
    payload: AdminBroadcastRequest,
    current_user: dict = Depends(require_role("admin")),
    db = Depends(get_database)
):
    """Admin Endpoint: Broadcast a targeted notification to all users, farmers only, or providers only (Optimized Fanout)."""
    audience = (payload.audience or "all").lower()

    # 1. Compute stable request fingerprint / hash across payload attributes
    req_payload_str = json.dumps({
        "title": payload.title,
        "message": payload.message,
        "priority": payload.priority,
        "audience": audience,
        "action_url": payload.action_url or "/dashboard"
    }, sort_keys=True)
    req_hash = hashlib.sha256(req_payload_str.encode("utf-8")).hexdigest()

    broadcast_id_str = None
    existing_bc = None

    # 2. Idempotency Check & Pre-Fanout Reservation
    if payload.idempotency_key:
        existing_bc = await db.broadcasts.find_one({"idempotency_key": payload.idempotency_key})
        if existing_bc:
            # Validate request fingerprint identity
            if existing_bc.get("request_hash") and existing_bc.get("request_hash") != req_hash:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Idempotency-Key already used for a different broadcast request payload."
                )

            current_status = existing_bc.get("status")
            if current_status == "Delivered":
                logger.info(f"Duplicate broadcast replay prevented via idempotency_key '{payload.idempotency_key}'")
                bc_id = str(existing_bc.get("_id") or existing_bc.get("id"))
                dispatched_at_val = existing_bc.get("dispatched_at")
                dispatched_at_str = dispatched_at_val.isoformat() if hasattr(dispatched_at_val, "isoformat") else str(dispatched_at_val)
                return {
                    "status": "success",
                    "message": f"Successfully broadcasted to {existing_bc.get('recipient_count', 0)} users ({existing_bc.get('audience', audience)}).",
                    "broadcast": {
                        "id": bc_id,
                        "title": existing_bc.get("title", payload.title),
                        "message": existing_bc.get("message", payload.message),
                        "priority": existing_bc.get("priority", payload.priority),
                        "audience": existing_bc.get("audience", audience),
                        "recipient_count": existing_bc.get("recipient_count", 0),
                        "dispatched_by": existing_bc.get("dispatched_by", current_user.get("email", "admin")),
                        "status": "Delivered",
                        "dispatched_at": dispatched_at_str
                    }
                }
            elif current_status == "Processing":
                # Durable lease / lock timeout check
                created_dt = existing_bc.get("created_at") or existing_bc.get("dispatched_at")
                if created_dt and isinstance(created_dt, datetime):
                    if created_dt.tzinfo is None:
                        created_dt = created_dt.replace(tzinfo=timezone.utc)
                    age_sec = (datetime.now(timezone.utc) - created_dt).total_seconds()
                    if age_sec < 60:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="A broadcast dispatch with this idempotency key is currently processing. Please retry shortly."
                        )
                # Stale Processing lease expired: allow resume using the same broadcast_id
                logger.warning(f"Resuming stale Processing broadcast '{payload.idempotency_key}'")
                broadcast_id_str = str(existing_bc.get("_id") or existing_bc.get("id"))
            elif current_status == "Failed":
                # Controlled retry of failed broadcast: transition back to Processing and resume
                logger.info(f"Retrying Failed broadcast '{payload.idempotency_key}'")
                broadcast_id_str = str(existing_bc.get("_id") or existing_bc.get("id"))
                try:
                    oid = ObjectId(broadcast_id_str)
                    retry_filter = {"_id": oid, "status": "Failed"}
                except Exception:
                    retry_filter = {"_id": broadcast_id_str, "status": "Failed"}
                await db.broadcasts.update_one(retry_filter, {"$set": {"status": "Processing", "updated_at": datetime.now(timezone.utc)}})

        if not broadcast_id_str:
            # Create durable reservation record BEFORE fanout begins
            reservation_doc = {
                "title": payload.title,
                "message": payload.message,
                "original_title": payload.title,
                "original_message": payload.message,
                "source_language": "en",
                "priority": payload.priority,
                "audience": audience,
                "recipient_count": 0,
                "persisted_count": 0,
                "dispatched_by": current_user.get("email", "admin"),
                "status": "Processing",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "dispatched_at": datetime.now(timezone.utc),
                "idempotency_key": payload.idempotency_key,
                "request_hash": req_hash,
                "action_url": payload.action_url or "/dashboard"
            }
            try:
                res_insert = await db.broadcasts.insert_one(reservation_doc)
                broadcast_id_str = str(res_insert.inserted_id)
            except DuplicateKeyError:
                # Concurrent race condition caught by MongoDB unique index
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A broadcast dispatch with this idempotency key was just initiated concurrently."
                )

    # Pre-translate broadcast into the 7 supported languages once
    translations_bundle: Dict[str, Dict[str, str]] = {}
    for target_lang in ["te", "ta", "kn", "hi", "ml", "or"]:
        try:
            tr_title = await TranslationService.translate_text(
                payload.title, target_lang, source_lang="en", db=db
            )
            tr_msg = await TranslationService.translate_text(
                payload.message, target_lang, source_lang="en", db=db
            )
            translations_bundle[target_lang] = {
                "title": tr_title,
                "message": tr_msg
            }
        except Exception as tr_err:
            logger.warning(f"Broadcast pre-translation warning for {target_lang}: {tr_err}")

    # Build query filter based on audience
    if audience == "farmers":
        query = {"role": "farmer"}
    elif audience == "providers":
        query = {"role": "equipment_provider"}
    else:
        # Exclude admin accounts from "all" broadcasts — admins access broadcasts via admin panel
        query = {"role": {"$ne": "admin"}}

    # Stream recipients in bounded batches, capturing user_id, preferred_language, and role
    users_cursor = db.users.find(query, {"_id": 1, "preferred_language": 1, "role": 1})

    # Bounded recipient batching (500 per batch)
    BATCH_SIZE = 500
    recipients_batch = []
    count = 0

    try:
        async for u in users_cursor:
            recipients_batch.append({
                "user_id": str(u["_id"]),
                "preferred_language": u.get("preferred_language") or "en",
                "role": u.get("role") or "farmer"
            })
            if len(recipients_batch) >= BATCH_SIZE:
                batch_res = await NotificationService.create_broadcast_notifications(
                    db,
                    recipients=recipients_batch,
                    title=payload.title,
                    message=payload.message,
                    translations=translations_bundle,
                    priority=payload.priority,
                    action_url=payload.action_url or "/dashboard",
                    batch_size=BATCH_SIZE,
                    broadcast_id=broadcast_id_str,
                    idempotency_key=payload.idempotency_key
                )
                count += batch_res.get("persisted_count", 0)
                recipients_batch = []

        # Final remaining batch
        if recipients_batch:
            batch_res = await NotificationService.create_broadcast_notifications(
                db,
                recipients=recipients_batch,
                title=payload.title,
                message=payload.message,
                translations=translations_bundle,
                priority=payload.priority,
                action_url=payload.action_url or "/dashboard",
                batch_size=BATCH_SIZE,
                broadcast_id=broadcast_id_str,
                idempotency_key=payload.idempotency_key
            )
            count += batch_res.get("persisted_count", 0)

        # Transition broadcast record to Delivered state in MongoDB conditionally from Processing
        now_dt = datetime.now(timezone.utc)
        if broadcast_id_str:
            update_fields = {
                "translations": translations_bundle,
                "recipient_count": count,
                "persisted_count": count,
                "status": "Delivered",
                "updated_at": now_dt,
                "dispatched_at": now_dt
            }
            try:
                oid = ObjectId(broadcast_id_str)
                cond_filter = {"_id": oid, "status": "Processing"}
            except Exception:
                cond_filter = {"_id": broadcast_id_str, "status": "Processing"}

            res_update = await db.broadcasts.update_one(cond_filter, {"$set": update_fields})
            matched_count = getattr(res_update, "matched_count", 1 if res_update else 0)
            if matched_count == 0:
                logger.warning(
                    f"Broadcast '{broadcast_id_str}' was not in 'Processing' state during Delivered transition "
                    f"(matched_count=0). Stale worker update ignored."
                )
        else:
            broadcast_doc = {
                "title": payload.title,
                "message": payload.message,
                "original_title": payload.title,
                "original_message": payload.message,
                "source_language": "en",
                "translations": translations_bundle,
                "priority": payload.priority,
                "audience": audience,
                "recipient_count": count,
                "persisted_count": count,
                "dispatched_by": current_user.get("email", "admin"),
                "status": "Delivered",
                "dispatched_at": now_dt,
                "updated_at": now_dt,
                "created_at": now_dt,
                "idempotency_key": payload.idempotency_key,
                "request_hash": req_hash
            }
            inserted = await db.broadcasts.insert_one(broadcast_doc)
            broadcast_id_str = str(inserted.inserted_id)

    except Exception as dispatch_err:
        logger.error(f"Broadcast fanout error: {dispatch_err}")
        if broadcast_id_str:
            err_update = {
                "status": "Failed",
                "error_detail": str(dispatch_err),
                "updated_at": datetime.now(timezone.utc)
            }
            try:
                oid = ObjectId(broadcast_id_str)
                err_filter = {"_id": oid, "status": "Processing"}
            except Exception:
                err_filter = {"_id": broadcast_id_str, "status": "Processing"}

            err_res = await db.broadcasts.update_one(err_filter, {"$set": err_update})
            matched_err_count = getattr(err_res, "matched_count", 1 if err_res else 0)
            if matched_err_count == 0:
                logger.warning(
                    f"Broadcast '{broadcast_id_str}' was not in 'Processing' state during Failed transition "
                    f"(matched_count=0). Stale or already terminal broadcast state preserved."
                )
        raise dispatch_err

    log_security_event(
        "GLOBAL_BROADCAST_DISPATCHED",
        {"title": payload.title, "priority": payload.priority, "audience": audience, "recipients_count": count},
        level="INFO"
    )
    return {
        "status": "success",
        "message": f"Successfully broadcasted to {count} users ({audience}).",
        "broadcast": {
            "id": broadcast_id_str,
            "title": payload.title,
            "message": payload.message,
            "priority": payload.priority,
            "audience": audience,
            "recipient_count": count,
            "dispatched_by": current_user.get("email", "admin"),
            "status": "Delivered",
            "dispatched_at": now_dt.isoformat()
        }
    }

@router.get("/broadcast/history", dependencies=[Depends(require_role("admin"))])
async def get_broadcast_history(
    limit: int = Query(50, ge=1, le=200),
    db = Depends(get_database)
):
    """Admin Endpoint: Retrieve persistent broadcast dispatch history from MongoDB."""
    cursor = db.broadcasts.find({}).sort("dispatched_at", -1).limit(limit)
    records = await cursor.to_list(length=limit)
    result = []
    for r in records:
        result.append({
            "id": str(r["_id"]),
            "title": r.get("title", ""),
            "message": r.get("message", ""),
            "priority": r.get("priority", "Normal"),
            "audience": r.get("audience", "all"),
            "recipient_count": r.get("recipient_count", 0),
            "dispatched_by": r.get("dispatched_by", "admin"),
            "status": r.get("status", "Delivered"),
            "dispatched_at": r["dispatched_at"].isoformat() if isinstance(r.get("dispatched_at"), datetime) else r.get("dispatched_at", "")
        })
    return {"total": len(result), "broadcasts": result}


@router.get("/user-geography", dependencies=[Depends(require_role("admin")), Depends(rate_limit(ADMIN_LIMIT, 60))])
async def get_user_geography(db=Depends(get_database)):
    """
    Returns a geographic breakdown of registered users by Indian state,
    derived from the farm_location field. Used for admin map visualization.
    """
    cursor = db.users.find({}, {"farm_location": 1, "role": 1, "name": 1, "created_at": 1})
    all_users = await cursor.to_list(length=None)

    # Indian state keyword mapping
    STATE_KEYWORDS = {
        "Andhra Pradesh": ["andhra", "vijayawada", "guntur", "vishakhapatnam", "vizag", "tirupati", "nellore", "kurnool"],
        "Telangana": ["telangana", "hyderabad", "warangal", "karimnagar", "nizamabad", "khammam"],
        "Tamil Nadu": ["tamil", "chennai", "coimbatore", "madurai", "salem", "trichy", "tirunelveli"],
        "Karnataka": ["karnataka", "bengaluru", "bangalore", "mysuru", "mysore", "hubli", "mangaluru"],
        "Kerala": ["kerala", "kochi", "thiruvananthapuram", "kozhikode", "thrissur", "kollam"],
        "Maharashtra": ["maharashtra", "mumbai", "pune", "nagpur", "nashik", "aurangabad"],
        "Gujarat": ["gujarat", "ahmedabad", "surat", "vadodara", "rajkot", "gandhinagar"],
        "Rajasthan": ["rajasthan", "jaipur", "jodhpur", "udaipur", "kota", "bikaner"],
        "Uttar Pradesh": ["uttar pradesh", "lucknow", "kanpur", "agra", "varanasi", "allahabad", "prayagraj"],
        "Madhya Pradesh": ["madhya pradesh", "bhopal", "indore", "gwalior", "jabalpur"],
        "Punjab": ["punjab", "chandigarh", "ludhiana", "amritsar", "jalandhar", "patiala"],
        "Haryana": ["haryana", "gurugram", "faridabad", "hisar", "rohtak", "panipat"],
        "Bihar": ["bihar", "patna", "gaya", "bhagalpur", "muzaffarpur"],
        "West Bengal": ["west bengal", "kolkata", "howrah", "durgapur", "siliguri", "asansol"],
        "Odisha": ["odisha", "bhubaneswar", "cuttack", "rourkela", "puri"],
        "Assam": ["assam", "guwahati", "dibrugarh", "jorhat", "silchar"],
        "Jharkhand": ["jharkhand", "ranchi", "jamshedpur", "dhanbad", "bokaro"],
        "Chhattisgarh": ["chhattisgarh", "raipur", "bhilai", "durg", "bilaspur"],
        "Uttarakhand": ["uttarakhand", "dehradun", "haridwar", "rishikesh", "nainital"],
        "Himachal Pradesh": ["himachal", "shimla", "dharamshala", "manali", "solan"],
        "Goa": ["goa", "panaji", "margao", "vasco"],
        "Tripura": ["tripura", "agartala"],
        "Manipur": ["manipur", "imphal"],
        "Meghalaya": ["meghalaya", "shillong"],
        "Nagaland": ["nagaland", "kohima", "dimapur"],
        "Arunachal Pradesh": ["arunachal", "itanagar"],
        "Mizoram": ["mizoram", "aizawl"],
        "Sikkim": ["sikkim", "gangtok"],
    }

    state_counts = {}
    unlocated_count = 0

    for user in all_users:
        location = (user.get("farm_location") or "").lower().strip()
        matched_state = None

        for state, keywords in STATE_KEYWORDS.items():
            if any(kw in location for kw in keywords):
                matched_state = state
                break

        if matched_state:
            state_counts[matched_state] = state_counts.get(matched_state, 0) + 1
        else:
            unlocated_count += 1

    # Convert to list format sorted by count desc
    location_data = [
        {"state": state, "count": count}
        for state, count in sorted(state_counts.items(), key=lambda x: -x[1])
    ]

    return {
        "total_users": len(all_users),
        "located_users": len(all_users) - unlocated_count,
        "unlocated_users": unlocated_count,
        "locations": location_data,
    }


class IoTIngestionToggleRequest(BaseModel):
    enabled: bool

@router.get("/iot-ingestion/status", dependencies=[Depends(require_role("admin"))])
async def get_iot_ingestion_status(db = Depends(get_database)):
    """Get whether IoT hardware telemetry ingestion is enabled or paused."""
    setting = await db["system_settings"].find_one({"key": "iot_telemetry_ingestion"})
    enabled = bool(setting.get("enabled", False)) if setting else False
    return {"enabled": enabled, "status": "active" if enabled else "paused"}

@router.post("/iot-ingestion/toggle", dependencies=[Depends(require_role("admin"))])
async def toggle_iot_ingestion(
    request: Request,
    req_body: IoTIngestionToggleRequest,
    current_user: dict = Depends(require_role("admin")),
    db = Depends(get_database)
):
    """Enable or disable IoT telemetry ingestion system-wide."""
    await db["system_settings"].update_one(
        {"key": "iot_telemetry_ingestion"},
        {"$set": {
            "key": "iot_telemetry_ingestion",
            "enabled": req_body.enabled,
            "updated_by": current_user.get("email"),
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    # Audit log
    log_security_event(
        event_type="IOT_INGESTION_TOGGLED",
        details={
            "enabled": req_body.enabled,
            "action": "ENABLED_IOT_INGESTION" if req_body.enabled else "DISABLED_IOT_INGESTION",
            "actor_email": current_user.get("email", "admin")
        },
        level="INFO" if req_body.enabled else "WARNING",
        client_ip=request.client.host if request.client else "127.0.0.1"
    )
    
    return {
        "status": "success",
        "enabled": req_body.enabled,
        "message": f"IoT telemetry ingestion is now {'ENABLED' if req_body.enabled else 'PAUSED'}."
    }


# ─────────────────────────────────────────────────────────────
# Security Firewall & Defense Walls Management
# ─────────────────────────────────────────────────────────────
from backend.app.core.security_walls import (
    get_security_walls_status,
    jail_ip,
    unban_ip,
    is_trusted_ip
)

class FirewallBanRequest(BaseModel):
    ip: str
    reason: str = "Administrative Security Ban"
    duration_hours: float = 24.0

class FirewallUnbanRequest(BaseModel):
    ip: str

@router.get("/firewall/status", dependencies=[Depends(require_role("admin"))])
async def get_firewall_status():
    """Returns real-time status, active walls configuration, and currently jailed IPs."""
    return get_security_walls_status()

@router.get("/firewall/banned-ips", dependencies=[Depends(require_role("admin"))])
async def list_banned_ips(db = Depends(get_database)):
    """List all active and historical IP ban records from MongoDB."""
    cursor = db.security_banned_ips.find({}).sort("banned_at", -1).limit(100)
    records = await cursor.to_list(100)
    out = []
    for r in records:
        out.append({
            "id": str(r["_id"]),
            "ip": r.get("ip"),
            "reason": r.get("reason"),
            "banned_at": r.get("banned_at").isoformat() if r.get("banned_at") else None,
            "expires_at": r.get("expires_at").isoformat() if r.get("expires_at") else None,
            "active": r.get("active", False)
        })
    return out

@router.post("/firewall/ban", dependencies=[Depends(require_role("admin"))])
async def admin_ban_ip(
    request: Request,
    req_body: FirewallBanRequest,
    current_user: dict = Depends(require_role("admin"))
):
    """Manually jail an IP address."""
    if is_trusted_ip(req_body.ip):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot ban trusted local or loopback IP."
        )
    await jail_ip(req_body.ip, req_body.reason, req_body.duration_hours)
    log_security_event(
        "ADMIN_MANUAL_IP_BAN",
        {"ip": req_body.ip, "reason": req_body.reason, "admin": current_user.get("email")},
        level="WARNING",
        client_ip=request.client.host if request.client else "127.0.0.1"
    )
    return {"status": "success", "message": f"IP {req_body.ip} jailed for {req_body.duration_hours} hours."}

@router.post("/firewall/unban", dependencies=[Depends(require_role("admin"))])
async def admin_unban_ip(
    request: Request,
    req_body: FirewallUnbanRequest,
    current_user: dict = Depends(require_role("admin"))
):
    """Manually unban a previously jailed IP address."""
    success = await unban_ip(req_body.ip)
    log_security_event(
        "ADMIN_MANUAL_IP_UNBAN",
        {"ip": req_body.ip, "admin": current_user.get("email"), "success": success},
        level="INFO",
        client_ip=request.client.host if request.client else "127.0.0.1"
    )
    return {"status": "success", "message": f"IP {req_body.ip} unbanned successfully.", "modified": success}

