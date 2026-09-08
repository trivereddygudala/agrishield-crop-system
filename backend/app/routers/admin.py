from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from bson import ObjectId
from backend.app.db.mongodb import get_database
from backend.app.core.security import require_role
from backend.app.core.rate_limiter import rate_limit, ADMIN_LIMIT
from backend.app.core.audit_logger import audit_logger
from backend.app.models.schemas import UserResponse

router = APIRouter(prefix="/api/admin", tags=["Admin Management"])

@router.get("/users", dependencies=[Depends(require_role("admin")), Depends(rate_limit(ADMIN_LIMIT, 60))])
async def list_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role_filter: Optional[str] = None,
    db = Depends(get_database)
):
    """
    Strict Admin Endpoint: Retrieve list of all registered users from MongoDB.
    Requires 'admin' role authentication.
    """
    query = {}
    if role_filter:
        query["role"] = role_filter

    total_users = await db.users.count_documents(query)
    cursor = db.users.find(query).sort("created_at", -1).skip(skip).limit(limit)
    users_list = await cursor.to_list(length=limit)

    sanitized_users = []
    for user in users_list:
        sanitized = {
            "id": str(user["_id"]),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role", "farmer"),
            "farm_location": user.get("farm_location"),
            "preferred_language": user.get("preferred_language", "en"),
            "farming_practices": user.get("farming_practices", "Conventional"),
            "farm_profile_completed": user.get("farm_profile_completed", False),
            "created_at": user.get("created_at")
        }
        sanitized_users.append(sanitized)

    return {
        "total": total_users,
        "skip": skip,
        "limit": limit,
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

from backend.app.core.audit_logger import log_security_event

@router.put("/users/{user_id}/role", dependencies=[Depends(require_role("admin"))])
async def update_user_role(user_id: str, new_role: str = Query(..., pattern="^(admin|farmer|researcher|tester|guest)$"), db = Depends(get_database)):
    """Strict Admin Endpoint: Change role of any registered user."""
    try:
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": new_role}}
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid User ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    log_security_event("USER_ROLE_UPDATED", {"user_id": user_id, "new_role": new_role}, level="INFO")
    return {"message": f"Successfully updated user {user_id} role to '{new_role}'."}

from pydantic import BaseModel

class UserEditRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    preferred_language: Optional[str] = None
    farming_practices: Optional[str] = None
    farm_location: Optional[str] = None

class AdminPasswordResetRequest(BaseModel):
    new_password: str

@router.put("/users/{user_id}", dependencies=[Depends(require_role("admin"))])
async def edit_user_details(user_id: str, edit_data: UserEditRequest, db = Depends(get_database)):
    """Admin Endpoint: Edit user profile details (Name, Email, Role, Language, Location)."""
    try:
        update_fields = {}
        if edit_data.name is not None: update_fields["name"] = edit_data.name
        if edit_data.email is not None: update_fields["email"] = edit_data.email.lower().strip()
        if edit_data.role is not None: update_fields["role"] = edit_data.role.lower()
        if edit_data.preferred_language is not None: update_fields["preferred_language"] = edit_data.preferred_language
        if edit_data.farming_practices is not None: update_fields["farming_practices"] = edit_data.farming_practices
        if edit_data.farm_location is not None: update_fields["farm_location"] = edit_data.farm_location

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update")

        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to update user: {str(e)}")

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    log_security_event("USER_PROFILE_EDITED", {"user_id": user_id, "updated_fields": list(update_fields.keys())}, level="INFO")
    return {"message": "User details updated successfully."}

@router.delete("/users/{target_user_id}", dependencies=[Depends(require_role("admin"))])
async def delete_user(target_user_id: str, db = Depends(get_database)):
    """Admin endpoint to permanently delete a user and their data."""
    if not ObjectId.is_valid(target_user_id):
        raise HTTPException(status_code=400, detail="Invalid target user ID")
    
    # Cascade delete (predictions, telemetry, etc.)
    await db.predictions.delete_many({"user_id": target_user_id})
    await db.iot_telemetry.delete_many({"user_id": target_user_id})
    await db.notifications.delete_many({"user_id": target_user_id})
    
    res = await db.users.delete_one({"_id": ObjectId(target_user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    log_security_event("USER_ACCOUNT_DELETED", {"deleted_user_id": target_user_id}, level="WARNING")
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

from backend.app.core.security import hash_password, validate_password_strength

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

from datetime import datetime, timezone

class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "farmer"
    preferred_language: Optional[str] = "en"
    farm_location: Optional[str] = None

@router.post("/create-user", dependencies=[Depends(require_role("admin"))])
async def admin_create_new_user(payload: AdminCreateUserRequest, db = Depends(get_database)):
    """Admin Endpoint: Register/Create a new user account (Admin, Farmer, Tester, Researcher)."""
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
    new_user_doc = {
        "name": payload.name.strip(),
        "email": email_clean,
        "password_hash": pwd_hash,
        "role": payload.role.lower() if payload.role else "farmer",
        "preferred_language": payload.preferred_language or "en",
        "farm_location": payload.farm_location or "",
        "farming_practices": "Conventional",
        "farm_profile_completed": True if payload.farm_location else False,
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
            "role": payload.role,
            "farm_location": payload.farm_location,
            "preferred_language": payload.preferred_language,
            "farm_profile_completed": True if payload.farm_location else False,
            "created_at": new_user_doc["created_at"]
        }
    }


from backend.app.services.notification_service import NotificationService
from backend.app.models.notification import NotificationCreate

class AdminBroadcastRequest(BaseModel):
    title: str
    message: str
    priority: str = "High"

@router.post("/broadcast", dependencies=[Depends(require_role("admin"))])
async def broadcast_system_notification(payload: AdminBroadcastRequest, db = Depends(get_database)):
    """Admin Endpoint: Broadcast a global system notification to all users."""
    users_cursor = db.users.find({}, {"_id": 1})
    users_list = await users_cursor.to_list(length=None)
    
    count = 0
    for u in users_list:
        uid_str = str(u["_id"])
        await NotificationService.create_notification(
            db,
            NotificationCreate(
                user_id=uid_str,
                title=payload.title,
                message=payload.message,
                category="system",
                priority=payload.priority,
                action_url="/dashboard"
            )
        )
        count += 1
        
    log_security_event("GLOBAL_BROADCAST_DISPATCHED", {"title": payload.title, "priority": payload.priority, "recipients_count": count}, level="INFO")
    return {"status": "success", "message": f"Successfully broadcasted to {count} users."}


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
    await audit_logger.log_security_event(
        db=db,
        event_type="IOT_INGESTION_TOGGLED",
        severity="INFO" if req_body.enabled else "WARNING",
        action="ENABLED_IOT_INGESTION" if req_body.enabled else "DISABLED_IOT_INGESTION",
        actor_id=str(current_user.get("id") or current_user.get("_id", "")),
        actor_email=current_user.get("email", "admin"),
        ip_address=request.client.host if request.client else "unknown",
        details={"enabled": req_body.enabled}
    )
    
    return {
        "status": "success",
        "enabled": req_body.enabled,
        "message": f"IoT telemetry ingestion is now {'ENABLED' if req_body.enabled else 'PAUSED'}."
    }

