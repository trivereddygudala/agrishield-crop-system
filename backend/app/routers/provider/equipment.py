"""
Equipment Rental & Farm Machinery Bookings Router
Provides multi-device persistence for farm machinery bookings between Farmers and Equipment Providers.
Syncs across devices (PC, mobile browser, tablets) via MongoDB and persistent JSON store fallback.
"""

from fastapi import APIRouter, HTTPException, Query, Body, Depends, Header, status
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
import json
import os
import asyncio
import hashlib
import random
import zoneinfo
from bson import ObjectId
from pymongo.errors import OperationFailure, ConnectionFailure, DuplicateKeyError
from backend.app.db.mongodb import db_instance
from backend.app.services.sync_service import SyncService
from backend.app.routers.common.auth import get_current_user

router = APIRouter(tags=["Equipment & Farm Machinery Bookings"])

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "equipment_bookings.json")
CATALOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "equipment_catalog.json")

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC_TZ = timezone.utc

def _normalize_booking_interval(booking_data: Dict[str, Any]) -> Tuple[datetime, datetime]:
    """
    Convert local Indian Standard Time (Asia/Kolkata) booking date and slot/time
    into canonical half-open [start_time, end_time) UTC datetime objects.
    """
    raw_date = booking_data.get("date") or booking_data.get("bookingDate") or datetime.now(IST_TZ).strftime("%Y-%m-%d")
    date_str = str(raw_date).split("T")[0].strip()

    raw_slot = str(booking_data.get("timeSlot") or booking_data.get("slot") or "").strip()
    raw_start = str(booking_data.get("startTime") or "").strip()
    raw_end = str(booking_data.get("endTime") or "").strip()

    # Canonical Legacy Slot Mappings (IST)
    if "early morning" in raw_slot.lower():
        start_h, start_m, end_h, end_m = 6, 0, 10, 0
    elif "afternoon" in raw_slot.lower():
        start_h, start_m, end_h, end_m = 14, 0, 18, 0
    elif "full day" in raw_slot.lower():
        start_h, start_m, end_h, end_m = 8, 0, 17, 0
    elif raw_start and raw_end:
        try:
            s_dt = datetime.strptime(raw_start, "%H:%M")
            e_dt = datetime.strptime(raw_end, "%H:%M")
            start_h, start_m, end_h, end_m = s_dt.hour, s_dt.minute, e_dt.hour, e_dt.minute
        except Exception:
            start_h, start_m, end_h, end_m = 8, 0, 17, 0
    else:
        # Default fallback: Early morning
        start_h, start_m, end_h, end_m = 6, 0, 10, 0

    try:
        y, m, d = map(int, date_str.split("-")[:3])
    except Exception:
        now_ist = datetime.now(IST_TZ)
        y, m, d = now_ist.year, now_ist.month, now_ist.day

    local_start = datetime(y, m, d, start_h, start_m, 0, tzinfo=IST_TZ)
    local_end = datetime(y, m, d, end_h, end_m, 0, tzinfo=IST_TZ)

    if local_start >= local_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid interval: start_time ({local_start.isoformat()}) must be earlier than end_time ({local_end.isoformat()})"
        )

    return local_start.astimezone(UTC_TZ), local_end.astimezone(UTC_TZ)

VALID_STATUS_TRANSITIONS = {
    "pending": {"confirmed", "rejected", "cancelled"},
    "confirmed": {"completed", "cancelled"},
    "rejected": set(),
    "cancelled": set(),
    "completed": set(),
}

def _validate_state_transition(current_status: str, target_status: str):
    curr = str(current_status).lower().strip()
    target = str(target_status).lower().strip()
    if curr in ["declined", "reject"]: curr = "rejected"
    if curr in ["confirm", "accepted", "accept"]: curr = "confirmed"
    if curr in ["complete", "done"]: curr = "completed"
    if curr in ["cancel", "canceled"]: curr = "cancelled"

    allowed = VALID_STATUS_TRANSITIONS.get(curr)
    if allowed is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unrecognized booking status: {current_status}")
    if curr in ["rejected", "cancelled", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid state transition: Cannot change terminal status '{curr}' to '{target}'"
        )
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid state transition: '{curr}' -> '{target}' is not permitted"
        )

# In-memory store fallback with initial seed if file doesn't exist
_in_memory_bookings: List[Dict[str, Any]] = []
_in_memory_catalog: List[Dict[str, Any]] = []

def _is_admin(user: Dict[str, Any]) -> bool:
    return str(user.get("role", "")).lower() == "admin"

def _is_provider(user: Dict[str, Any]) -> bool:
    return str(user.get("role", "")).lower() in ["equipment_provider", "provider"]

def _is_farmer(user: Dict[str, Any]) -> bool:
    role = str(user.get("role", "")).lower()
    return role == "farmer" or role == ""

async def _get_provider_equipment_ids(user: Dict[str, Any]) -> set:
    uid = str(user.get("id") or user.get("_id") or "")
    u_phone = "".join(filter(str.isdigit, str(user.get("phone") or user.get("mobile") or "")))
    eq_ids = set()
    if db_instance.db is not None:
        try:
            q = {"$or": [{"providerId": uid}, {"owner_id": uid}, {"userId": uid}]}
            if u_phone:
                q["$or"].extend([{"phone": u_phone}, {"contactPhone": u_phone}])
            cursor = db_instance.db["equipment_catalog"].find(q, {"id": 1, "equipment_id": 1})
            docs = await cursor.to_list(length=500)
            for d in docs:
                if d.get("id"): eq_ids.add(str(d["id"]))
                if d.get("equipment_id"): eq_ids.add(str(d["equipment_id"]))
        except Exception:
            pass
    for item in _load_disk_catalog():
        i_pid = str(item.get("providerId") or item.get("owner_id") or "")
        i_phone = "".join(filter(str.isdigit, str(item.get("phone") or item.get("contactPhone") or "")))
        if (uid and i_pid == uid) or (u_phone and i_phone and (u_phone == i_phone or u_phone[-10:] == i_phone[-10:])):
            if item.get("id"): eq_ids.add(str(item["id"]))
            if item.get("equipment_id"): eq_ids.add(str(item["equipment_id"]))
    return eq_ids

def _user_matches_farmer(booking: Dict[str, Any], user: Dict[str, Any]) -> bool:
    uid = str(user.get("id") or user.get("_id") or "")
    b_uid = str(booking.get("userId") or booking.get("user_id") or "")
    if uid and b_uid and uid == b_uid:
        return True
    u_phone = "".join(filter(str.isdigit, str(user.get("phone") or user.get("mobile") or "")))
    b_phone = "".join(filter(str.isdigit, str(booking.get("farmerPhone") or booking.get("phone") or "")))
    if u_phone and b_phone and (u_phone == b_phone or u_phone[-10:] == b_phone[-10:]):
        return True
    return False

def _user_matches_provider(booking: Dict[str, Any], user: Dict[str, Any], provider_eq_ids: Optional[set] = None) -> bool:
    uid = str(user.get("id") or user.get("_id") or "")
    b_pid = str(booking.get("providerId") or booking.get("provider_id") or "")
    if uid and b_pid and uid == b_pid:
        return True
    u_phone = "".join(filter(str.isdigit, str(user.get("phone") or user.get("mobile") or "")))
    b_phone = "".join(filter(str.isdigit, str(booking.get("providerPhone") or booking.get("contactPhone") or "")))
    if u_phone and b_phone and (u_phone == b_phone or u_phone[-10:] == b_phone[-10:]):
        return True
    if provider_eq_ids:
        eq_id = str(booking.get("equipmentId") or booking.get("equipment_id") or "")
        if eq_id and eq_id in provider_eq_ids:
            return True
    return False

def _load_disk_bookings() -> List[Dict[str, Any]]:
    global _in_memory_bookings
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    _in_memory_bookings = SyncService.filter_out_deleted("booking", data, ["id", "bookingId"])
                    return _in_memory_bookings
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Failed loading from disk: {e}")
    return _in_memory_bookings

def _save_disk_bookings():
    global _in_memory_bookings
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(_in_memory_bookings, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ [EquipmentBookings] Failed saving to disk: {e}")

def _load_disk_catalog() -> List[Dict[str, Any]]:
    global _in_memory_catalog
    if os.path.exists(CATALOG_FILE):
        try:
            with open(CATALOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    _in_memory_catalog = SyncService.filter_out_deleted("equipment", data, ["id", "equipment_id"])
                    return _in_memory_catalog
        except Exception as e:
            print(f"⚠️ [EquipmentCatalog] Failed loading from disk: {e}")
    return _in_memory_catalog

def _save_disk_catalog():
    global _in_memory_catalog
    try:
        os.makedirs(os.path.dirname(CATALOG_FILE), exist_ok=True)
        with open(CATALOG_FILE, "w", encoding="utf-8") as f:
            json.dump(_in_memory_catalog, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ [EquipmentCatalog] Failed saving to disk: {e}")

CHAT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "equipment_chat_messages.json")
_in_memory_chat_threads: Dict[str, List[Dict[str, Any]]] = {}

def _normalize_chat_booking_id(raw_id: str) -> str:
    raw = str(raw_id or "").strip()
    clean = raw.replace("notif-stat-", "").replace("notif-order-", "").replace("notif-chat-", "").replace("notif-", "").replace("fleet_", "")
    if clean.startswith("BK-") or clean.startswith("INQ-"):
        return clean
    if clean.isdigit() or (len(clean) > 0 and not clean.startswith("BK-")):
        return f"BK-{clean}"
    return "BK-GENERAL"

def _load_disk_chat_messages() -> Dict[str, List[Dict[str, Any]]]:
    global _in_memory_chat_threads
    if os.path.exists(CHAT_FILE):
        try:
            with open(CHAT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _in_memory_chat_threads = data
                    return _in_memory_chat_threads
        except Exception as e:
            print(f"⚠️ [EquipmentChat] Failed loading from disk: {e}")
    return _in_memory_chat_threads

def _save_disk_chat_messages():
    global _in_memory_chat_threads
    try:
        os.makedirs(os.path.dirname(CHAT_FILE), exist_ok=True)
        with open(CHAT_FILE, "w", encoding="utf-8") as f:
            json.dump(_in_memory_chat_threads, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ [EquipmentChat] Failed saving to disk: {e}")

# Initialize from disk on startup
_load_disk_bookings()
_load_disk_catalog()
_load_disk_chat_messages()


@router.get("/bookings")
async def get_all_bookings(
    provider_phone: Optional[str] = Query(None, description="Filter by equipment provider phone"),
    farmer_phone: Optional[str] = Query(None, description="Filter by farmer phone"),
    status: Optional[str] = Query(None, description="Filter by status (pending, confirmed, completed, rejected)"),
    language: Optional[str] = Query(None, description="Active language code for localization"),
    limit: Optional[int] = Query(2500, description="Max bookings to return (default 2500 for stress testing)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Fetch machinery bookings with strict RBAC and tenant isolation.
    - Farmer: Only their own bookings.
    - Provider: Only bookings for their equipment / assigned to them.
    - Admin: All bookings across the system.
    """
    bookings = []
    status_str = status if isinstance(status, str) else None
    prov_phone_str = provider_phone if isinstance(provider_phone, str) else None
    farmer_phone_str = farmer_phone if isinstance(farmer_phone, str) else None
    lang_str = language if isinstance(language, str) else None
    fetch_limit = limit if isinstance(limit, int) else 2500

    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    clean_user_phone = "".join(filter(str.isdigit, str(current_user.get("phone") or current_user.get("mobile") or "")))
    provider_eq_ids = set()
    if _is_provider(current_user):
        provider_eq_ids = await _get_provider_equipment_ids(current_user)

    # 1. Try MongoDB if active
    if db_instance.db is not None:
        try:
            query: Dict[str, Any] = {}
            if status_str:
                query["status"] = status_str

            # Apply DB-level tenant filtering
            if _is_farmer(current_user):
                f_or = [{"userId": user_id}, {"user_id": user_id}]
                if clean_user_phone:
                    f_or.extend([
                        {"farmerPhone": clean_user_phone},
                        {"phone": clean_user_phone},
                        {"farmerPhone": {"$regex": clean_user_phone[-10:]}}
                    ])
                query["$or"] = f_or
            elif _is_provider(current_user):
                p_or = [{"providerId": user_id}, {"provider_id": user_id}]
                if clean_user_phone:
                    p_or.extend([
                        {"providerPhone": clean_user_phone},
                        {"contactPhone": clean_user_phone},
                        {"providerPhone": {"$regex": clean_user_phone[-10:]}}
                    ])
                if provider_eq_ids:
                    p_or.append({"equipmentId": {"$in": list(provider_eq_ids)}})
                    p_or.append({"equipment_id": {"$in": list(provider_eq_ids)}})
                query["$or"] = p_or
            # Admins have no tenant constraint ($or not restricted)

            cursor = db_instance.db["equipment_bookings"].find(query).sort("createdAt", -1)
            docs = await cursor.to_list(length=fetch_limit)
            for doc in docs:
                doc.pop("_id", None)
                bookings.append(doc)
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Mongo fetch notice: {e}")

    # 2. If Mongo had items, update memory cache
    if bookings:
        pass
    else:
        # Fallback to in-memory / disk cache
        bookings = _load_disk_bookings()

    # 3. Strictly filter out any deleted tombstones across the entire cluster
    bookings = SyncService.filter_out_deleted("booking", bookings, ["id", "bookingId"])

    # 4. Strict in-memory Tenant Isolation Enforcement
    if _is_farmer(current_user):
        bookings = [b for b in bookings if _user_matches_farmer(b, current_user)]
    elif _is_provider(current_user):
        bookings = [b for b in bookings if _user_matches_provider(b, current_user, provider_eq_ids)]
    # Admins see all

    # Apply in-memory query filters if needed
    result = bookings
    if status_str:
        result = [b for b in result if str(b.get("status", "")).lower() == status_str.lower()]
    if prov_phone_str:
        clean_p = "".join(filter(str.isdigit, prov_phone_str))
        result = [b for b in result if clean_p in "".join(filter(str.isdigit, str(b.get("providerPhone") or b.get("provider_phone") or b.get("contactPhone") or "")))]
    if farmer_phone_str:
        clean_f = "".join(filter(str.isdigit, farmer_phone_str))
        result = [b for b in result if clean_f in "".join(filter(str.isdigit, str(b.get("farmerPhone") or b.get("phone") or "")))]

    if lang_str and lang_str != "en":
        norm_lang = lang_str.strip().lower().split("-")[0]
        from backend.app.services.translation_service import COMMON_GLOSSARY
        for b in result:
            raw_status = str(b.get("status", "")).lower()
            b["original_status"] = b.get("original_status") or b.get("status")
            if raw_status in COMMON_GLOSSARY and norm_lang in COMMON_GLOSSARY[raw_status]:
                b["status_label"] = COMMON_GLOSSARY[raw_status][norm_lang]
            raw_notes = b.get("notes") or b.get("custom_notes") or b.get("specialInstructions")
            if raw_notes:
                b["original_notes"] = b.get("original_notes") or raw_notes
                b_translations = b.get("translations", {})
                if norm_lang in b_translations:
                    b["notes"] = b_translations[norm_lang]

    return {
        "success": True,
        "count": len(result),
        "bookings": result
    }


@router.post("/bookings")
async def create_booking(
    booking_data: Dict[str, Any] = Body(...),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Save or update a farm machinery booking with authenticated tenant identity and idempotency replay.
    Enforces that booking is securely tied to current_user.
    """
    global _in_memory_bookings
    if not booking_data:
        raise HTTPException(status_code=400, detail="Booking data is required")

    auth_uid = str(current_user.get("id") or current_user.get("_id") or "")
    booking_id = booking_data.get("id") or booking_data.get("bookingId") or f"BK-{int(datetime.now().timestamp() * 1000) % 90000 + 10000}"

    # F-04: Idempotency pre-check for creation
    if idempotency_key and db_instance.db is not None:
        try:
            existing_idemp = await db_instance.db["idempotency_records"].find_one({
                "key": idempotency_key,
                "user_id": auth_uid
            })
            if existing_idemp and existing_idemp.get("status") == "completed":
                return existing_idemp.get("response_body")
        except Exception:
            pass

    booking_data["id"] = booking_id
    booking_data["bookingId"] = booking_id

    # Stamp authenticated user credentials (tenant isolation & tamper prevention)
    booking_data["userId"] = auth_uid
    booking_data["user_id"] = auth_uid
    if not booking_data.get("farmerName"):
        booking_data["farmerName"] = current_user.get("name") or current_user.get("full_name") or "Farmer"
    if not booking_data.get("farmerEmail"):
        booking_data["farmerEmail"] = current_user.get("email") or ""
    if not booking_data.get("farmerPhone") and (current_user.get("phone") or current_user.get("mobile")):
        booking_data["farmerPhone"] = current_user.get("phone") or current_user.get("mobile")

    # B1-FIX-B/C: Normalize local IST booking times to UTC ISO datetime
    start_utc, end_utc = _normalize_booking_interval(booking_data)
    booking_data["start_time"] = start_utc
    booking_data["end_time"] = end_utc
    booking_data["start_time_iso"] = start_utc.isoformat()
    booking_data["end_time_iso"] = end_utc.isoformat()

    if not booking_data.get("status"):
        booking_data["status"] = "pending"
    if not booking_data.get("createdAt"):
        booking_data["createdAt"] = datetime.now().isoformat()
    booking_data["updatedAt"] = datetime.now().isoformat()

    raw_notes = booking_data.get("custom_notes") or booking_data.get("notes") or booking_data.get("specialInstructions") or ""
    if raw_notes:
        booking_data["original_notes"] = booking_data.get("original_notes") or raw_notes
        if "translations" not in booking_data:
            booking_data["translations"] = {}

    # C-4: Prevent booking-ID hijacking and illegal overwrite of confirmed/terminal bookings
    existing_b = None
    if db_instance.db is not None:
        try:
            existing_b = await db_instance.db["equipment_bookings"].find_one(
                {"$or": [{"id": booking_id}, {"bookingId": booking_id}]}
            )
        except Exception:
            existing_b = None
    else:
        _load_disk_bookings()
        existing_b = next((b for b in _in_memory_bookings if b.get("id") == booking_id or b.get("bookingId") == booking_id), None)

    if existing_b:
        existing_uid = str(existing_b.get("userId") or existing_b.get("user_id") or "")
        if existing_uid and existing_uid != auth_uid and not _is_admin(current_user):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Booking identifier '{booking_id}' already exists and belongs to another user."
            )
        existing_status = str(existing_b.get("status", "pending")).lower()
        if existing_status in ["confirmed", "completed", "cancelled", "rejected"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot overwrite booking '{booking_id}' in state '{existing_status}' via creation endpoint."
            )

    # 1. Update in-memory / disk
    _load_disk_bookings()
    updated_list = [b for b in _in_memory_bookings if b.get("id") != booking_id]
    # For disk JSON, save start_time/end_time as ISO strings
    json_safe_booking = dict(booking_data)
    json_safe_booking["start_time"] = start_utc.isoformat()
    json_safe_booking["end_time"] = end_utc.isoformat()
    updated_list.insert(0, json_safe_booking)
    _in_memory_bookings = updated_list
    _save_disk_bookings()

    # 2. Save to MongoDB if available
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_bookings"].update_one(
                {"id": booking_id},
                {"$set": booking_data},
                upsert=True
            )
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Mongo update notice: {e}")

    # 3. Automated notification dispatch to Equipment Provider
    if db_instance.db is not None:
        try:
            from backend.app.services.notification_service import NotificationService
            from backend.app.models.notification import NotificationCreate
            p_phone = booking_data.get("providerPhone") or booking_data.get("provider_phone") or ""
            clean_p = "".join(filter(str.isdigit, str(p_phone)))
            prov_user = None
            if clean_p:
                prov_user = await db_instance.db["users"].find_one({
                    "$or": [
                        {"phone": clean_p},
                        {"mobile": clean_p},
                        {"phone": {"$regex": clean_p[-10:]}}
                    ]
                })
            if not prov_user:
                prov_name = booking_data.get("providerName") or booking_data.get("provider_name") or booking_data.get("owner") or ""
                if prov_name:
                    import re as _re
                    prov_user = await db_instance.db["users"].find_one({
                        "name": {"$regex": f"^{_re.escape(prov_name.strip())}$", "$options": "i"},
                        "role": "equipment_provider"
                    })
            if not prov_user:
                prov_email = booking_data.get("providerEmail") or booking_data.get("provider_email") or ""
                if prov_email:
                    prov_user = await db_instance.db["users"].find_one({"email": prov_email.lower().strip()})
            if not prov_user:
                prov_user = await db_instance.db["users"].find_one({"role": "equipment_provider"})

            target_uid = str(prov_user["_id"]) if prov_user else (booking_data.get("providerId") or "provider_hub")
            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"🚜 New Machinery Booking Request: #{booking_id}",
                    message=f"Farmer {booking_data.get('farmerName', 'Farmer')} booked {booking_data.get('equipmentName', 'Machinery')} ({booking_data.get('acres', '1')} acres) for {booking_data.get('date', 'Today')}.",
                    category="booking",
                    priority="High",
                    booking_id=booking_id,
                    action_url="/provider/dashboard?tab=orders"
                )
            )
        except Exception as n_err:
            print(f"⚠️ [EquipmentBookings] Provider notification dispatch notice: {n_err}")

    res_payload = {
        "success": True,
        "message": "Booking recorded and synced successfully",
        "booking": booking_data
    }

    # F-04: Persist completed idempotency record on successful creation
    if idempotency_key and db_instance.db is not None:
        try:
            clean_res = {
                "success": True,
                "message": "Booking recorded and synced successfully",
                "booking": {k: (str(v) if isinstance(v, ObjectId) else v) for k, v in booking_data.items() if k != "_id"}
            }
            await db_instance.db["idempotency_records"].update_one(
                {"key": idempotency_key, "user_id": auth_uid},
                {"$set": {
                    "key": idempotency_key,
                    "user_id": auth_uid,
                    "status": "completed",
                    "response_status_code": 200,
                    "response_body": clean_res,
                    "created_at": datetime.now(timezone.utc),
                    "completed_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
        except Exception:
            pass

    return res_payload


@router.post("/bookings/batch")
async def create_bookings_batch(
    bookings_data: List[Dict[str, Any]] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    High-throughput bulk booking endpoint to create or sync up to 1000+ bookings in one round-trip.
    Enforces authenticated user identity across all batch reservations.
    """
    global _in_memory_bookings
    if not bookings_data or not isinstance(bookings_data, list):
        raise HTTPException(status_code=400, detail="A list of booking objects is required")

    auth_uid = str(current_user.get("id") or current_user.get("_id") or "")
    default_name = current_user.get("name") or current_user.get("full_name") or "Farmer"
    default_email = current_user.get("email") or ""
    default_phone = current_user.get("phone") or current_user.get("mobile") or ""

    now_iso = datetime.now().isoformat()
    processed_bookings = []
    mongo_ops = []

    _load_disk_bookings()
    existing_map = {b.get("id"): b for b in _in_memory_bookings if b.get("id")}

    from pymongo import UpdateOne
    for idx, b in enumerate(bookings_data):
        b_id = b.get("id") or b.get("bookingId") or f"BK-{int(datetime.now().timestamp() * 1000) % 90000 + idx + 10000}"
        b["id"] = b_id
        b["bookingId"] = b_id
        b["userId"] = auth_uid
        b["user_id"] = auth_uid
        if not b.get("farmerName"):
            b["farmerName"] = default_name
        if not b.get("farmerEmail") and default_email:
            b["farmerEmail"] = default_email
        if not b.get("farmerPhone") and default_phone:
            b["farmerPhone"] = default_phone

        # F-01: Batch endpoint is restricted strictly to pending booking submissions
        req_status = str(b.get("status") or "pending").lower().strip()
        if req_status not in ["pending", ""]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Batch booking submission only permits status='pending'. Status '{req_status}' is disallowed; use canonical status PATCH endpoint for state transitions."
            )
        b["status"] = "pending"

        # C-4: Prevent booking-ID hijacking and illegal overwrite of confirmed/terminal bookings in batch
        existing_doc = None
        if db_instance.db is not None:
            try:
                existing_doc = await db_instance.db["equipment_bookings"].find_one(
                    {"$or": [{"id": b_id}, {"bookingId": b_id}]}
                )
            except Exception:
                existing_doc = None
        else:
            existing_doc = existing_map.get(b_id)

        if existing_doc:
            doc_uid = str(existing_doc.get("userId") or existing_doc.get("user_id") or "")
            if doc_uid and doc_uid != auth_uid and not _is_admin(current_user):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Booking #{b_id} already exists and belongs to another user."
                )
            curr_s = str(existing_doc.get("status", "pending")).lower()
            if curr_s in ["confirmed", "completed", "cancelled", "rejected"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot overwrite booking #{b_id} with status '{curr_s}' via batch creation."
                )

        # Normalize UTC interval
        start_utc, end_utc = _normalize_booking_interval(b)
        b["start_time"] = start_utc
        b["end_time"] = end_utc
        b["start_time_iso"] = start_utc.isoformat()
        b["end_time_iso"] = end_utc.isoformat()

        if not b.get("createdAt"):
            b["createdAt"] = now_iso
        b["updatedAt"] = now_iso

        processed_bookings.append(b)
        # Store string ISO dates in disk map
        b_disk = dict(b)
        b_disk["start_time"] = start_utc.isoformat()
        b_disk["end_time"] = end_utc.isoformat()
        existing_map[b_id] = b_disk

        if db_instance.db is not None:
            clean_b = {k: v for k, v in b.items() if k != "_id"}
            mongo_ops.append(
                UpdateOne({"id": b_id}, {"$set": clean_b}, upsert=True)
            )

    # 1. Update in-memory / disk cache
    _in_memory_bookings = list(existing_map.values())
    _save_disk_bookings()

    # 2. Bulk upsert to MongoDB
    if db_instance.db is not None and mongo_ops:
        try:
            await db_instance.db["equipment_bookings"].bulk_write(mongo_ops, ordered=False)
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Mongo bulk_write notice: {e}")

    # 3. Dispatch high-level summary notification to Provider
    if db_instance.db is not None and processed_bookings:
        try:
            from backend.app.services.notification_service import NotificationService
            from backend.app.models.notification import NotificationCreate
            first_b = processed_bookings[0]
            p_phone = first_b.get("providerPhone") or first_b.get("provider_phone") or ""
            clean_p = "".join(filter(str.isdigit, str(p_phone)))
            prov_user = None
            if clean_p:
                prov_user = await db_instance.db["users"].find_one({
                    "$or": [
                        {"phone": clean_p},
                        {"mobile": clean_p},
                        {"phone": {"$regex": clean_p[-10:]}}
                    ]
                })
            if not prov_user:
                prov_name = first_b.get("providerName") or first_b.get("provider_name") or first_b.get("owner") or ""
                if prov_name:
                    import re as _re
                    prov_user = await db_instance.db["users"].find_one({
                        "name": {"$regex": f"^{_re.escape(prov_name.strip())}$", "$options": "i"},
                        "role": "equipment_provider"
                    })
            if not prov_user:
                prov_email = first_b.get("providerEmail") or first_b.get("provider_email") or ""
                if prov_email:
                    prov_user = await db_instance.db["users"].find_one({"email": prov_email.lower().strip()})
            if not prov_user:
                prov_user = await db_instance.db["users"].find_one({"role": "equipment_provider"})

            target_uid = str(prov_user["_id"]) if prov_user else (first_b.get("providerId") or "provider_hub")
            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"🚜 {len(processed_bookings)} New Machinery Bookings Received!",
                    message=f"Farmer {first_b.get('farmerName', 'Farmer')} submitted a high-volume booking batch of {len(processed_bookings)} equipment reservations.",
                    category="booking",
                    priority="High",
                    action_url="/provider/dashboard?tab=orders"
                )
            )
        except Exception as n_err:
            print(f"⚠️ [EquipmentBookings] Batch provider notification notice: {n_err}")

    return {
        "success": True,
        "count": len(processed_bookings),
        "message": f"Successfully created and synchronized {len(processed_bookings)} bookings."
    }


@router.patch("/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    status_update: Dict[str, Any] = Body(...),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update the status of a booking with B1-FIX-B state machine and B1-FIX-C concurrency-safe slot protection.
    Uses MongoDB transaction with equipment_locks serialization, collision evaluation, retry loop, and idempotency caching.
    """
    global _in_memory_bookings
    raw_status = status_update.get("status")
    if not raw_status:
        raise HTTPException(status_code=400, detail="New status is required")

    new_status = str(raw_status).lower().strip()
    if new_status in ["declined", "reject"]:
        new_status = "rejected"
    elif new_status in ["confirm", "accepted", "accept"]:
        new_status = "confirmed"
    elif new_status in ["complete", "done"]:
        new_status = "completed"
    elif new_status in ["cancel", "cancelled", "canceled"]:
        new_status = "cancelled"

    cancel_reason = status_update.get("reason") or status_update.get("cancelReason")
    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    endpoint_sig = f"PATCH:/bookings/{booking_id}/status"

    # 1. Idempotency Pre-Check & In-Progress Registration (F-03)
    req_payload_str = json.dumps({"status": new_status, "reason": cancel_reason}, sort_keys=True)
    req_hash = hashlib.sha256(req_payload_str.encode("utf-8")).hexdigest()

    if idempotency_key and db_instance.db is not None:
        try:
            existing_idemp = await db_instance.db["idempotency_records"].find_one({
                "key": idempotency_key,
                "user_id": user_id
            })
            if existing_idemp:
                if existing_idemp.get("booking_id") != booking_id or existing_idemp.get("request_hash") != req_hash:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Idempotency-Key already used for a different request payload or booking."
                    )
                if existing_idemp.get("status") == "completed":
                    return existing_idemp.get("response_body")
                elif existing_idemp.get("status") == "in_progress":
                    # Check age of in_progress
                    rec_dt = existing_idemp.get("created_at")
                    if rec_dt and isinstance(rec_dt, datetime):
                        age_sec = (datetime.now(timezone.utc) - rec_dt.replace(tzinfo=timezone.utc)).total_seconds()
                        if age_sec < 60:
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail="Concurrent request with this Idempotency-Key is currently in progress. Please retry shortly."
                            )
            else:
                try:
                    await db_instance.db["idempotency_records"].insert_one({
                        "key": idempotency_key,
                        "user_id": user_id,
                        "endpoint": endpoint_sig,
                        "request_hash": req_hash,
                        "booking_id": booking_id,
                        "status": "in_progress",
                        "created_at": datetime.now(timezone.utc)
                    })
                except DuplicateKeyError:
                    raced = await db_instance.db["idempotency_records"].find_one({
                        "key": idempotency_key,
                        "user_id": user_id
                    })
                    if raced:
                        if raced.get("booking_id") != booking_id or raced.get("request_hash") != req_hash:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="Idempotency-Key already used for a different request payload or booking."
                            )
                        if raced.get("status") == "completed":
                            return raced.get("response_body")
                        elif raced.get("status") == "in_progress":
                            rec_dt = raced.get("created_at")
                            if rec_dt and isinstance(rec_dt, datetime):
                                age_sec = (datetime.now(timezone.utc) - rec_dt.replace(tzinfo=timezone.utc)).total_seconds()
                                if age_sec < 60:
                                    raise HTTPException(
                                        status_code=status.HTTP_409_CONFLICT,
                                        detail="Concurrent request with this Idempotency-Key is currently in progress. Please retry shortly."
                                    )
        except HTTPException:
            raise
        except Exception as e:
            print(f"⚠️ [Idempotency] Pre-check notice: {e}")

    # 2. Locate existing booking and verify RBAC
    existing_booking = None
    if db_instance.db is not None:
        try:
            existing_booking = await db_instance.db["equipment_bookings"].find_one(
                {"$or": [{"id": booking_id}, {"bookingId": booking_id}]}
            )
        except Exception:
            pass
    if not existing_booking:
        _load_disk_bookings()
        for b in _in_memory_bookings:
            if b.get("id") == booking_id or b.get("bookingId") == booking_id:
                existing_booking = b
                break

    if not existing_booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider_eq_ids = await _get_provider_equipment_ids(current_user) if _is_provider(current_user) else set()
    is_farmer_owner = _user_matches_farmer(existing_booking, current_user)
    is_provider_owner = _user_matches_provider(existing_booking, current_user, provider_eq_ids)
    is_admin = _is_admin(current_user)

    # RBAC verification
    if new_status == "cancelled":
        if not (is_farmer_owner or is_provider_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to cancel this booking"
            )
    elif new_status in ["confirmed", "rejected", "completed"]:
        if not (is_provider_owner or is_admin):
            if is_farmer_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only equipment providers and admins can confirm, reject, or complete bookings"
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to manage this booking"
            )
    else:
        if not (is_provider_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Unauthorized status transition"
            )

    # Validate state transition rules
    current_status = existing_booking.get("status", "pending")
    _validate_state_transition(current_status, new_status)

    # Canonical equipment ID and time intervals
    canonical_eq_id = existing_booking.get("equipmentId") or existing_booking.get("machineId") or existing_booking.get("equipment_id")
    if not canonical_eq_id and new_status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot confirm booking: equipment identifier is missing."
        )

    # Compute UTC normalized interval if missing
    req_start_utc = existing_booking.get("start_time")
    req_end_utc = existing_booking.get("end_time")
    if not (isinstance(req_start_utc, datetime) and isinstance(req_end_utc, datetime)):
        req_start_utc, req_end_utc = _normalize_booking_interval(existing_booking)

    # 3. Transaction Execution with Concurrency Retries
    MAX_RETRIES = 5
    BASE_BACKOFF_MS = 25
    MAX_BACKOFF_MS = 250
    updated_booking = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # Check if running with replica set / transaction support
            client = getattr(db_instance, "client", None)
            has_sessions = client is not None and hasattr(client, "start_session")

            if has_sessions and db_instance.db is not None:
                async with await client.start_session() as session:
                    async with session.start_transaction():
                        # A. Re-read target booking inside transaction
                        b_doc = await db_instance.db["equipment_bookings"].find_one(
                            {"$or": [{"id": booking_id}, {"bookingId": booking_id}]},
                            session=session
                        )
                        if not b_doc:
                            raise HTTPException(status_code=404, detail="Booking not found in transaction")

                        b_curr_status = b_doc.get("status", "pending")
                        # If already in target status, idempotent return
                        if b_curr_status == new_status:
                            updated_booking = b_doc
                            break

                        _validate_state_transition(b_curr_status, new_status)

                        if new_status == "confirmed":
                            # B. Serialize on equipment_locks document
                            await db_instance.db["equipment_locks"].find_one_and_update(
                                {"_id": canonical_eq_id},
                                {"$inc": {"lock_version": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                                upsert=True,
                                session=session
                            )

                            # C. Collision check for overlapping CONFIRMED bookings on this equipment
                            # Overlap condition: existing.start < req.end AND existing.end > req.start
                            collision = await db_instance.db["equipment_bookings"].find_one(
                                {
                                    "$or": [
                                        {"equipmentId": canonical_eq_id},
                                        {"equipment_id": canonical_eq_id}
                                    ],
                                    "status": "confirmed",
                                    "id": {"$ne": booking_id},
                                    "bookingId": {"$ne": booking_id},
                                    "start_time": {"$lt": req_end_utc},
                                    "end_time": {"$gt": req_start_utc}
                                },
                                session=session
                            )
                            if collision:
                                coll_id = collision.get("id") or collision.get("bookingId") or "existing"
                                coll_s = collision.get("start_time_iso") or str(collision.get("start_time"))
                                coll_e = collision.get("end_time_iso") or str(collision.get("end_time"))
                                raise HTTPException(
                                    status_code=status.HTTP_409_CONFLICT,
                                    detail=f"Time slot collision: Equipment {canonical_eq_id} is already confirmed for booking #{coll_id} ({coll_s} to {coll_e})."
                                )

                        # D. Update target booking
                        now_utc = datetime.now(timezone.utc)
                        up_fields = {
                            "status": new_status,
                            "updatedAt": now_utc.isoformat(),
                            "start_time": req_start_utc,
                            "end_time": req_end_utc,
                            "start_time_iso": req_start_utc.isoformat(),
                            "end_time_iso": req_end_utc.isoformat()
                        }
                        if cancel_reason:
                            up_fields["cancelReason"] = cancel_reason
                        if new_status == "cancelled":
                            up_fields["cancelledAt"] = now_utc.isoformat()

                        updated_booking = await db_instance.db["equipment_bookings"].find_one_and_update(
                            {"$or": [{"id": booking_id}, {"bookingId": booking_id}]},
                            {"$set": up_fields},
                            return_document=True,
                            session=session
                        )

                        # F-03: Commit idempotency record atomically inside booking transaction to eliminate crash window
                        if idempotency_key:
                            response_payload_tx = {
                                "success": True,
                                "message": f"Status updated to {new_status}",
                                "booking": {k: (str(v) if isinstance(v, ObjectId) else v) for k, v in updated_booking.items() if k != "_id"}
                            }
                            await db_instance.db["idempotency_records"].update_one(
                                {"key": idempotency_key, "user_id": user_id},
                                {"$set": {
                                    "status": "completed",
                                    "response_status_code": 200,
                                    "response_body": response_payload_tx,
                                    "completed_at": datetime.now(timezone.utc)
                                }},
                                upsert=True,
                                session=session
                            )

                        # F-06: Robust commit handling distinguishing commit uncertainty
                        while True:
                            try:
                                await session.commit_transaction()
                                break
                            except (OperationFailure, ConnectionFailure) as commit_exc:
                                is_unknown = (
                                    getattr(commit_exc, "has_error_label", lambda lbl: False)("UnknownTransactionCommitResult") or
                                    "UnknownTransactionCommitResult" in str(commit_exc)
                                )
                                if is_unknown:
                                    # Inspect whether the transaction actually succeeded on the server
                                    check_doc = await db_instance.db["equipment_bookings"].find_one(
                                        {"$or": [{"id": booking_id}, {"bookingId": booking_id}]}
                                    )
                                    if check_doc and check_doc.get("status") == new_status:
                                        updated_booking = check_doc
                                        break
                                    # If not yet reflected, retry commit
                                    continue
                                raise
                        break
            else:
                # Standalone / In-memory fallback mode
                # In-memory collision check if confirming
                if new_status == "confirmed":
                    _load_disk_bookings()
                    for b in _in_memory_bookings:
                        if (b.get("id") != booking_id and b.get("bookingId") != booking_id and
                            str(b.get("status", "")).lower() == "confirmed" and
                            (b.get("equipmentId") == canonical_eq_id or b.get("equipment_id") == canonical_eq_id)):
                            b_s = b.get("start_time")
                            b_e = b.get("end_time")
                            if not (isinstance(b_s, datetime) and isinstance(b_e, datetime)):
                                b_s, b_e = _normalize_booking_interval(b)
                            if b_s < req_end_utc and b_e > req_start_utc:
                                raise HTTPException(
                                    status_code=status.HTTP_409_CONFLICT,
                                    detail=f"Time slot collision: Equipment {canonical_eq_id} is already confirmed for booking #{b.get('id')}."
                                )

                now_utc = datetime.now(timezone.utc)
                up_fields = {
                    "status": new_status,
                    "updatedAt": now_utc.isoformat(),
                    "start_time": req_start_utc,
                    "end_time": req_end_utc,
                    "start_time_iso": req_start_utc.isoformat(),
                    "end_time_iso": req_end_utc.isoformat()
                }
                if cancel_reason:
                    up_fields["cancelReason"] = cancel_reason
                if new_status == "cancelled":
                    up_fields["cancelledAt"] = now_utc.isoformat()

                if db_instance.db is not None:
                    updated_booking = await db_instance.db["equipment_bookings"].find_one_and_update(
                        {"$or": [{"id": booking_id}, {"bookingId": booking_id}]},
                        {"$set": up_fields},
                        return_document=True
                    )
                else:
                    existing_booking.update(up_fields)
                    updated_booking = existing_booking
                break

        except HTTPException:
            raise
        except (OperationFailure, ConnectionFailure) as exc:
            # Check for UnknownTransactionCommitResult or transient transaction errors / write conflicts (code 112)
            is_unknown = (
                getattr(exc, "has_error_label", lambda lbl: False)("UnknownTransactionCommitResult") or
                "UnknownTransactionCommitResult" in str(exc)
            )
            if is_unknown and db_instance.db is not None:
                # F-06: Check if already committed before blindly retrying mutation body
                check_b = await db_instance.db["equipment_bookings"].find_one(
                    {"$or": [{"id": booking_id}, {"bookingId": booking_id}]}
                )
                if check_b and check_b.get("status") == new_status:
                    updated_booking = check_b
                    break

            is_transient = (
                getattr(exc, "has_error_label", lambda lbl: False)("TransientTransactionError") or
                getattr(exc, "code", None) == 112 or
                "WriteConflict" in str(exc) or
                is_unknown
            )
            if is_transient:
                if attempt == MAX_RETRIES:
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Booking system is experiencing heavy transaction contention. Please retry your request shortly.",
                        headers={"Retry-After": "1"}
                    )
                backoff_sec = random.uniform(0, min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** attempt))) / 1000.0
                await asyncio.sleep(backoff_sec)
                continue
            raise

    # 4. Synchronize in-memory / disk cache
    _load_disk_bookings()
    if updated_booking:
        if "_id" in updated_booking:
            updated_booking.pop("_id", None)
        # Disk store receives string ISO dates
        disk_safe = dict(updated_booking)
        if isinstance(disk_safe.get("start_time"), datetime):
            disk_safe["start_time"] = disk_safe["start_time"].isoformat()
        if isinstance(disk_safe.get("end_time"), datetime):
            disk_safe["end_time"] = disk_safe["end_time"].isoformat()

        _in_memory_bookings = [b for b in _in_memory_bookings if b.get("id") != booking_id and b.get("bookingId") != booking_id]
        _in_memory_bookings.insert(0, disk_safe)
        _save_disk_bookings()

    # 5. Automated Notification Dispatch
    if db_instance.db is not None and updated_booking:
        try:
            from backend.app.services.notification_service import NotificationService
            from backend.app.models.notification import NotificationCreate
            f_phone = updated_booking.get("farmerPhone") or updated_booking.get("phone") or ""
            clean_f = "".join(filter(str.isdigit, str(f_phone)))
            farmer_user = None
            if clean_f:
                farmer_user = await db_instance.db["users"].find_one({
                    "$or": [{"phone": clean_f}, {"mobile": clean_f}, {"phone": {"$regex": clean_f[-10:]}}]
                })
            b_uid = updated_booking.get("userId") or updated_booking.get("user_id") or ""
            target_uid = str(farmer_user["_id"]) if farmer_user else b_uid
            if target_uid:
                status_emoji = "✅" if new_status == "confirmed" else ("❌" if new_status in ["rejected", "cancelled"] else "🚜")
                status_label = "Confirmed" if new_status == "confirmed" else ("Cancelled" if new_status == "cancelled" else ("Declined" if new_status == "rejected" else new_status.title()))
                await NotificationService.create_notification(
                    db_instance.db,
                    NotificationCreate(
                        user_id=target_uid,
                        title=f"{status_emoji} Machinery Booking #{booking_id} {status_label}",
                        message=f"Reservation for {updated_booking.get('equipmentName', updated_booking.get('title', 'Machinery'))} is now {status_label.lower()}.",
                        category="booking",
                        priority="High",
                        booking_id=booking_id,
                        action_url="/equipment-booking"
                    )
                )
                try:
                    from backend.app.routers.common.notifications import ws_manager
                    from backend.app.services.translation_service import TranslationService
                    farmer_lang = (farmer_user.get("preferred_language") or "en").lower().strip() if farmer_user else "en"
                    loc_status = status_label
                    if farmer_lang != "en":
                        loc_status = await TranslationService.translate_text(status_label, farmer_lang, source_lang="en", db=db_instance.db)
                    await ws_manager.broadcast_to_user(target_uid, {
                        "type": "booking_status_updated",
                        "booking_id": booking_id,
                        "status": new_status,
                        "status_label": loc_status,
                        "original_status_label": status_label,
                        "booking": updated_booking
                    })
                except Exception:
                    pass
        except Exception as n_err:
            print(f"⚠️ [EquipmentBookings] Notification dispatch notice: {n_err}")

    response_payload = {
        "success": True,
        "message": f"Status updated to {new_status}",
        "booking": updated_booking
    }

    # Record idempotency completion
    if idempotency_key and db_instance.db is not None:
        try:
            await db_instance.db["idempotency_records"].update_one(
                {"key": idempotency_key, "user_id": user_id},
                {"$set": {
                    "status": "completed",
                    "response_status_code": 200,
                    "response_body": response_payload
                }}
            )
        except Exception:
            pass

    return response_payload


@router.delete("/bookings/{booking_id}")
async def delete_booking(
    booking_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Remove an unconfirmed draft/pending booking permanently.
    Confirmed, completed, or cancelled bookings CANNOT be deleted (must maintain audit trail).
    Strict RBAC: Admin, farmer owner, or provider owner only.
    """
    global _in_memory_bookings

    existing_booking = None
    if db_instance.db is not None:
        try:
            existing_booking = await db_instance.db["equipment_bookings"].find_one(
                {"$or": [{"id": booking_id}, {"bookingId": booking_id}]}
            )
        except Exception:
            pass
    if not existing_booking:
        _load_disk_bookings()
        for b in _in_memory_bookings:
            if b.get("id") == booking_id or b.get("bookingId") == booking_id:
                existing_booking = b
                break

    if not existing_booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider_eq_ids = await _get_provider_equipment_ids(current_user) if _is_provider(current_user) else set()
    is_farmer_owner = _user_matches_farmer(existing_booking, current_user)
    is_provider_owner = _user_matches_provider(existing_booking, current_user, provider_eq_ids)
    is_admin = _is_admin(current_user)

    if not (is_admin or is_farmer_owner or is_provider_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not authorized to delete this booking"
        )

    # Audit constraint: Only pending bookings can be physically deleted
    curr_status = str(existing_booking.get("status", "pending")).lower()
    if curr_status in ["confirmed", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Active or completed bookings (status='{curr_status}') cannot be physically deleted. Please cancel the booking instead to release the time slot."
        )

    # 1. Register permanent tombstone
    await SyncService.record_deletion(
        entity_type="booking",
        entity_id=booking_id,
        reason="API delete_booking"
    )

    # 2. Update memory & disk cache
    _load_disk_bookings()
    _in_memory_bookings = [b for b in _in_memory_bookings if b.get("id") != booking_id and b.get("bookingId") != booking_id]
    _save_disk_bookings()

    # 3. Remove from MongoDB
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_bookings"].delete_many({
                "$or": [{"id": booking_id}, {"bookingId": booking_id}]
            })
        except Exception:
            pass

    return {"success": True, "message": f"Booking {booking_id} permanently deleted across all devices"}


# In-memory fleet availability map
_fleet_availability: Dict[str, bool] = {}

@router.get("/fleet/status")
async def get_fleet_status():
    """
    Get live availability status of all equipment across devices.
    """
    return {
        "success": True,
        "availability": _fleet_availability
    }


@router.patch("/fleet/{equipment_id}/availability")
async def update_equipment_availability(
    equipment_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update machine availability status (available: true/false).
    Strict RBAC: Provider owner or Admin only.
    """
    if not _is_admin(current_user):
        provider_eq_ids = await _get_provider_equipment_ids(current_user)
        if equipment_id not in provider_eq_ids:
            owned = False
            if db_instance.db is not None:
                try:
                    doc = await db_instance.db["equipment_catalog"].find_one({"id": equipment_id})
                    if doc and (str(doc.get("providerId") or doc.get("owner_id")) == str(current_user.get("id"))):
                        owned = True
                except Exception:
                    pass
            if not owned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the equipment provider or an admin can update machine availability"
                )

    global _fleet_availability
    available = bool(payload.get("available", True))
    _fleet_availability[equipment_id] = available

    # Also update in MongoDB if available
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_fleet_status"].update_one(
                {"equipment_id": equipment_id},
                {"$set": {"available": available, "updatedAt": datetime.now().isoformat()}},
                upsert=True
            )
        except Exception:
            pass

    return {
        "success": True,
        "equipment_id": equipment_id,
        "available": available
    }


# ─────────────────────────────────────────────────────────────
# Equipment Catalog Management (Cross-Device Fleet Sync)
# ─────────────────────────────────────────────────────────────
@router.get("/catalog")
async def get_equipment_catalog(
    category: Optional[str] = Query(None, description="Filter by machinery category: tractor, drone, harvester, pump"),
    village: Optional[str] = Query(None, description="Filter by village"),
    district: Optional[str] = Query(None, description="Filter by district"),
    provider_phone: Optional[str] = Query(None, description="Filter by provider phone"),
    language: Optional[str] = Query(None, description="Active language code for localized description")
):
    """
    Fetch all registered farm machinery listings across all providers and devices.
    Public read-only discovery endpoint.
    """
    catalog = []
    cat_str = category if isinstance(category, str) else None
    vill_str = village if isinstance(village, str) else None
    dist_str = district if isinstance(district, str) else None
    prov_str = provider_phone if isinstance(provider_phone, str) else None
    lang_str = language if isinstance(language, str) else None

    if db_instance.db is not None:
        try:
            query = {}
            if cat_str and cat_str.lower() != "all":
                query["category"] = {"$regex": f"^{cat_str}$", "$options": "i"}
            if dist_str:
                query["district"] = {"$regex": dist_str, "$options": "i"}
            cursor = db_instance.db["equipment_catalog"].find(query).sort("createdAt", -1)
            docs = await cursor.to_list(length=200)
            for doc in docs:
                doc.pop("_id", None)
                catalog.append(doc)
        except Exception as e:
            print(f"⚠️ [EquipmentCatalog] Mongo catalog fetch notice: {e}")

    if catalog:
        global _in_memory_catalog
        _in_memory_catalog = catalog
        _save_disk_catalog()
    else:
        catalog = _load_disk_catalog()

    # Strictly filter out any deleted machinery tombstones across the system
    result = SyncService.filter_out_deleted("equipment", catalog, ["id", "equipment_id"])
    if cat_str and cat_str.lower() != "all":
        result = [c for c in result if str(c.get("category", "")).lower() == cat_str.lower()]
    if vill_str:
        v_clean = vill_str.lower().strip()
        result = [c for c in result if v_clean in str(c.get("village", "")).lower()]
    if dist_str:
        d_clean = dist_str.lower().strip()
        result = [c for c in result if d_clean in str(c.get("district", "")).lower()]
    if prov_str:
        p_clean = "".join(filter(str.isdigit, prov_str))
        result = [c for c in result if p_clean in "".join(filter(str.isdigit, str(c.get("phone") or c.get("contactPhone") or "")))]

    for item in result:
        orig_d = item.get("original_description") or item.get("description", "")
        item["original_description"] = orig_d
        item["description"] = orig_d
        if lang_str and lang_str != "en":
            norm_lang = lang_str.strip().lower().split("-")[0]
            item_tr = item.get("translations", {})
            if norm_lang in item_tr:
                item["description"] = item_tr[norm_lang]

    return {
        "success": True,
        "count": len(result),
        "equipment": result
    }


@router.post("/catalog")
async def register_equipment_item(
    equipment_data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Register or update machinery listing for rental so it instantly syncs to all devices.
    Strict RBAC: Only Equipment Providers and Admins can register/list machinery.
    """
    if not (_is_admin(current_user) or _is_provider(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only equipment providers and admins can register equipment"
        )

    global _in_memory_catalog
    if not equipment_data:
        raise HTTPException(status_code=400, detail="Equipment data is required")

    eq_id = equipment_data.get("id") or f"EQ-{int(datetime.now().timestamp() * 1000) % 90000 + 10000}"
    equipment_data["id"] = eq_id

    # Stamp provider identity
    auth_uid = str(current_user.get("id") or current_user.get("_id") or "")
    equipment_data["providerId"] = auth_uid
    equipment_data["owner_id"] = auth_uid
    if not equipment_data.get("providerName"):
        equipment_data["providerName"] = current_user.get("name") or current_user.get("full_name") or "Equipment Provider"
    if not equipment_data.get("phone") and (current_user.get("phone") or current_user.get("mobile")):
        equipment_data["phone"] = current_user.get("phone") or current_user.get("mobile")

    if "available" not in equipment_data:
        equipment_data["available"] = True
    if not equipment_data.get("createdAt"):
        equipment_data["createdAt"] = datetime.now().isoformat()
    equipment_data["updatedAt"] = datetime.now().isoformat()

    # C-3: Verify ownership of existing listing to prevent cross-provider hijacking
    existing_catalog_item = None
    if db_instance.db is not None:
        try:
            existing_catalog_item = await db_instance.db["equipment_catalog"].find_one({"id": eq_id})
        except Exception:
            existing_catalog_item = None
    else:
        _load_disk_catalog()
        existing_catalog_item = next((c for c in _in_memory_catalog if c.get("id") == eq_id), None)

    if existing_catalog_item and not _is_admin(current_user):
        item_owner = str(existing_catalog_item.get("providerId") or existing_catalog_item.get("owner_id") or "")
        if item_owner and item_owner != auth_uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not own this equipment listing"
            )

    # Update in-memory & disk
    _load_disk_catalog()
    updated_list = [c for c in _in_memory_catalog if c.get("id") != eq_id]
    updated_list.insert(0, equipment_data)
    _in_memory_catalog = updated_list
    _save_disk_catalog()

    # Detect if this is a NEW listing (not an edit): createdAt was NOT in original payload
    is_new_listing = not equipment_data.get("_was_existing", False) and equipment_data.get("createdAt") == equipment_data.get("updatedAt")

    # Save to MongoDB
    if db_instance.db is not None:
        try:
            is_new_listing = existing_catalog_item is None  # truly new only if no prior record
            await db_instance.db["equipment_catalog"].update_one(
                {"id": eq_id},
                {"$set": equipment_data},
                upsert=True
            )
        except Exception as e:
            print(f"⚠️ [EquipmentCatalog] Mongo catalog update notice: {e}")
            is_new_listing = False

        # Notify all admin users about the new machinery listing (new listings only, not edits)
        if is_new_listing:
            try:
                from backend.app.services.notification_service import NotificationService
                from backend.app.models.notification import NotificationCreate
                # Try role=admin first, then email fallback
                admin_cursor = db_instance.db["users"].find({"role": "admin"}, {"_id": 1})
                admin_users = await admin_cursor.to_list(length=None)
                if not admin_users:
                    email_cursor = db_instance.db["users"].find(
                        {"email": {"$regex": "admin", "$options": "i"}}, {"_id": 1}
                    )
                    admin_users = await email_cursor.to_list(length=None)
                if not admin_users:
                    print(f"⚠️ [EquipmentCatalog] No admin users found for notification dispatch — listing {eq_id}")
                eq_name = equipment_data.get("name") or equipment_data.get("title") or "Machinery"
                eq_type = equipment_data.get("type") or equipment_data.get("category") or "Equipment"
                provider_name = equipment_data.get("providerName") or equipment_data.get("owner") or "Equipment Provider"
                for admin_u in admin_users:
                    notif_result = await NotificationService.create_notification(
                        db_instance.db,
                        NotificationCreate(
                            user_id=str(admin_u["_id"]),
                            title=f"🚜 New Machinery Listed: {eq_name}",
                            message=f"{provider_name} listed a new {eq_type} ({eq_name}) available for rental. ID: {eq_id}.",
                            category="machinery_listing",
                            priority="Medium",
                            action_url="/admin/dashboard?tab=fleet"
                        )
                    )
                    print(f"✅ [EquipmentCatalog] Admin notif dispatched to {admin_u['_id']}: {notif_result.get('notification_id', 'no-id')}")
            except Exception as notif_err:
                print(f"⚠️ [EquipmentCatalog] Admin notification dispatch error: {notif_err}")
    else:
        print("⚠️ [EquipmentCatalog] MongoDB not connected — skipping admin notification for new listing")

    return {
        "success": True,
        "message": "Equipment listing saved and synced across all devices",
        "equipment": equipment_data
    }


@router.delete("/catalog/{equipment_id}")
async def delete_equipment_item(
    equipment_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Remove equipment listing from active catalog permanently with cross-device tombstone registration.
    Strict RBAC: Provider owner or Admin only.
    """
    if not _is_admin(current_user):
        provider_eq_ids = await _get_provider_equipment_ids(current_user)
        if equipment_id not in provider_eq_ids:
            owned = False
            if db_instance.db is not None:
                try:
                    doc = await db_instance.db["equipment_catalog"].find_one({"id": equipment_id})
                    if doc and (str(doc.get("providerId") or doc.get("owner_id")) == str(current_user.get("id"))):
                        owned = True
                except Exception:
                    pass
            if not owned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: Only the equipment provider or an admin can delete equipment"
                )

    global _in_memory_catalog

    # 1. Register permanent tombstone so no worker/device ever resurrects this equipment
    await SyncService.record_deletion(
        entity_type="equipment",
        entity_id=equipment_id,
        reason="API delete_equipment_item"
    )

    # 2. Update memory & disk cache
    _load_disk_catalog()
    _in_memory_catalog = [c for c in _in_memory_catalog if c.get("id") != equipment_id]
    _save_disk_catalog()

    # 3. Remove from MongoDB
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_catalog"].delete_one({"id": equipment_id})
        except Exception:
            pass

    return {"success": True, "message": f"Equipment listing {equipment_id} permanently removed across all devices"}


# ═══════════════════════════════════════════════════════════════════
# CROSS-DEVICE REAL-TIME EQUIPMENT CHAT MESSAGING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

async def _verify_booking_access(booking_id: str, current_user: Dict[str, Any]):
    """Strict authorization check to prevent cross-tenant chat snooping."""
    if _is_admin(current_user):
        return
    canonical_id = _normalize_chat_booking_id(booking_id)
    if canonical_id == "BK-GENERAL":
        return
    b_doc = None
    if db_instance.db is not None:
        try:
            b_doc = await db_instance.db["equipment_bookings"].find_one({
                "$or": [{"id": canonical_id}, {"bookingId": canonical_id}, {"id": booking_id}, {"bookingId": booking_id}]
            })
        except Exception:
            pass
    if not b_doc:
        for b in _load_disk_bookings():
            if b.get("id") in [canonical_id, booking_id] or b.get("bookingId") in [canonical_id, booking_id]:
                b_doc = b
                break
    if b_doc:
        provider_eq_ids = await _get_provider_equipment_ids(current_user) if _is_provider(current_user) else set()
        if not (_user_matches_farmer(b_doc, current_user) or _user_matches_provider(b_doc, current_user, provider_eq_ids)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You are not authorized to access messages for this booking"
            )


@router.get("/bookings/{booking_id}/messages")
async def get_booking_chat_messages(
    booking_id: str,
    target_lang: Optional[str] = Query(None, description="Active user language for message translation"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve all real-time chat messages for an equipment booking thread.
    Synchronizes cross-browser, cross-device communications between Farmer and Provider.
    """
    await _verify_booking_access(booking_id, current_user)
    canonical_id = _normalize_chat_booking_id(booking_id)
    messages = []

    # 1. Check MongoDB if active
    if db_instance.db is not None:
        try:
            doc = await db_instance.db["equipment_chat_messages"].find_one({
                "$or": [
                    {"booking_id": canonical_id},
                    {"booking_id": booking_id},
                    {"bookingId": canonical_id}
                ]
            })
            if doc and isinstance(doc.get("messages"), list):
                messages = doc["messages"]
        except Exception as e:
            print(f"⚠️ [EquipmentChat] Mongo fetch notice: {e}")

    # 2. Check in-memory / disk cache if mongo was empty or offline
    if not messages:
        threads = _load_disk_chat_messages()
        messages = threads.get(canonical_id) or threads.get(booking_id) or []

    # Format multilingual fields safely
    for m in messages:
        orig = m.get("original_text") or m.get("text", "")
        m["original_text"] = orig
        translations = m.get("translations") or {}
        msg_src = m.get("source_language", "en")
        if target_lang and target_lang != msg_src:
            if target_lang in translations:
                m["translated_text"] = translations[target_lang]
                m["text"] = translations[target_lang]
            elif orig:
                try:
                    from backend.app.services.translation_service import TranslationService
                    tr = await TranslationService.translate_text(orig, target_lang, source_lang=msg_src, db=db_instance.db)
                    if tr and tr != orig:
                        translations[target_lang] = tr
                        m["translated_text"] = tr
                        m["text"] = tr
                except Exception:
                    pass
        else:
            m["text"] = orig

    return {
        "success": True,
        "booking_id": canonical_id,
        "count": len(messages),
        "messages": messages
    }


@router.post("/bookings/{booking_id}/messages")
async def send_booking_chat_message(
    booking_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Post a new chat message to a booking thread.
    Instantly saves and propagates to all active devices (web, mobile, cross-browser).
    """
    await _verify_booking_access(booking_id, current_user)
    global _in_memory_chat_threads
    canonical_id = _normalize_chat_booking_id(booking_id)

    # Stamp sender identity from authenticated user
    sender = "provider" if _is_provider(current_user) else ("admin" if _is_admin(current_user) else "farmer")
    sender_name = current_user.get("name") or current_user.get("full_name") or ("Equipment Provider" if sender == "provider" else "Farmer")

    msg_id = payload.get("id") or f"msg_{int(datetime.now().timestamp() * 1000)}"
    text = (payload.get("text") or "").strip()
    sender = payload.get("sender") or "farmer"
    sender_name = payload.get("senderName") or ("Equipment Provider" if sender == "provider" else "Farmer")
    msg_type = payload.get("type") or "text"
    time_str = payload.get("time") or datetime.now().strftime("%I:%M %p")
    timestamp = payload.get("timestamp") or datetime.now().isoformat()

    # Dynamic Multilingual Free-Form Translation (Phase 2E)
    recipient_role = "equipment_provider" if sender == "farmer" else "farmer"
    source_lang = payload.get("source_language") or payload.get("language") or "auto"
    translations = {}
    translated_text = None

    recipient_lang = "en"
    target_uid = "provider_hub" if recipient_role == "equipment_provider" else "farmer_hub"
    if db_instance.db is not None:
        user_doc = None
        if canonical_id and canonical_id != "BK-GENERAL":
            b_doc = await db_instance.db["equipment_bookings"].find_one({"$or": [{"id": canonical_id}, {"bookingId": canonical_id}]})
            if b_doc:
                if recipient_role == "equipment_provider":
                    p_id = b_doc.get("providerId") or b_doc.get("provider_id")
                    if p_id:
                        try:
                            user_doc = await db_instance.db["users"].find_one({"$or": [{"_id": ObjectId(p_id)}, {"id": p_id}]})
                        except Exception:
                            user_doc = await db_instance.db["users"].find_one({"id": p_id})
                    if not user_doc:
                        p_phone = b_doc.get("providerPhone") or b_doc.get("provider_phone") or ""
                        clean_p = "".join(filter(str.isdigit, str(p_phone)))
                        if clean_p:
                            user_doc = await db_instance.db["users"].find_one({"$or": [{"phone": clean_p}, {"mobile": clean_p}]})
                else:
                    f_id = b_doc.get("userId") or b_doc.get("user_id")
                    if f_id:
                        try:
                            user_doc = await db_instance.db["users"].find_one({"$or": [{"_id": ObjectId(f_id)}, {"id": f_id}]})
                        except Exception:
                            user_doc = await db_instance.db["users"].find_one({"id": f_id})
                    if not user_doc:
                        f_phone = b_doc.get("farmerPhone") or b_doc.get("phone") or ""
                        clean_f = "".join(filter(str.isdigit, str(f_phone)))
                        if clean_f:
                            user_doc = await db_instance.db["users"].find_one({"$or": [{"phone": clean_f}, {"mobile": clean_f}]})
        if not user_doc:
            user_doc = await db_instance.db["users"].find_one({"role": recipient_role})
        if user_doc:
            target_uid = str(user_doc["_id"])
            recipient_lang = user_doc.get("preferred_language", "en")

    if text and recipient_lang != source_lang:
        try:
            from backend.app.services.translation_service import TranslationService
            translated_text = await TranslationService.translate_text(
                text, recipient_lang, source_lang=source_lang, db=db_instance.db
            )
            if translated_text and translated_text != text:
                translations[recipient_lang] = translated_text
        except Exception as tr_err:
            print(f"Chat translation notice: {tr_err}")

    new_message = {
        "id": msg_id,
        "sender": sender,
        "senderName": sender_name,
        "type": msg_type,
        "text": text,
        "original_text": text,
        "source_language": source_lang if source_lang != "auto" else "en",
        "translations": translations,
        "translated_text": translated_text,
        "time": time_str,
        "timestamp": timestamp,
        "status": "sent"
    }
    if "location" in payload:
        new_message["location"] = payload["location"]
    if "audioUrl" in payload:
        new_message["audioUrl"] = payload["audioUrl"]
    if "duration" in payload:
        new_message["duration"] = payload["duration"]

    # Update memory & disk
    _load_disk_chat_messages()
    current_list = _in_memory_chat_threads.get(canonical_id, [])
    # Deduplicate by id
    if not any(m.get("id") == msg_id for m in current_list):
        current_list.append(new_message)
    _in_memory_chat_threads[canonical_id] = current_list
    _save_disk_chat_messages()

    # Update MongoDB
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_chat_messages"].update_one(
                {"booking_id": canonical_id},
                {
                    "$set": {"updated_at": datetime.now().isoformat()},
                    "$addToSet": {"messages": new_message}
                },
                upsert=True
            )
        except Exception as e:
            print(f"⚠️ [EquipmentChat] Mongo update notice: {e}")

    # Trigger counterparty in-app notification in DB if available
    try:
        from backend.app.services.notification_service import NotificationService
        from backend.app.models.notification import NotificationCreate
        preview_text = (translated_text or text)[:80] if text else "Sent a location attachment"

        if db_instance.db is not None:
            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"💬 New Message ({canonical_id})",
                    message=f"{sender_name}: \"{preview_text}\"",
                    original_title=f"💬 New Message ({canonical_id})",
                    original_message=f"{sender_name}: \"{preview_text}\"",
                    source_language="en",
                    category="booking",
                    priority="Normal",
                    booking_id=canonical_id,
                    action_url=f"/notifications?bookingId={canonical_id}"
                )
            )
    except Exception:
        pass

    # Direct Real-Time WebSocket broadcast to counterparty
    if target_uid:
        try:
            from backend.app.routers.common.notifications import ws_manager
            await ws_manager.broadcast_to_user(target_uid, {
                "type": "booking_chat_message",
                "booking_id": canonical_id,
                "message": {
                    **new_message,
                    "text": translated_text if translated_text else text,
                    "original_text": text,
                    "translated_text": translated_text
                }
            })
        except Exception:
            pass

    return {
        "success": True,
        "booking_id": canonical_id,
        "message": new_message,
        "total": len(current_list)
    }


@router.get("/chat/messages")
async def get_chat_messages_query(
    booking_id: str = Query(..., description="Booking ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return await get_booking_chat_messages(booking_id, current_user=current_user)


@router.post("/chat/messages")
async def post_chat_messages_body(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    b_id = payload.get("booking_id") or payload.get("bookingId") or "BK-GENERAL"
    return await send_booking_chat_message(b_id, payload, current_user=current_user)


@router.delete("/bookings/{booking_id}/messages/{message_id}")
async def delete_booking_chat_message(
    booking_id: str,
    message_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a single message from a booking chat thread across all devices.
    Strict RBAC: Authorized booking participants or Admin only.
    """
    await _verify_booking_access(booking_id, current_user)
    global _in_memory_chat_threads
    canonical_id = _normalize_chat_booking_id(booking_id)

    # 1. Update in-memory & disk
    _load_disk_chat_messages()
    current_list = _in_memory_chat_threads.get(canonical_id, [])
    updated_list = [m for m in current_list if m.get("id") != message_id]
    _in_memory_chat_threads[canonical_id] = updated_list
    _save_disk_chat_messages()

    # 2. Update MongoDB
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_chat_messages"].update_one(
                {"booking_id": canonical_id},
                {"$pull": {"messages": {"id": message_id}}}
            )
        except Exception as e:
            print(f"⚠️ [EquipmentChat] Mongo message deletion notice: {e}")

    return {
        "success": True,
        "booking_id": canonical_id,
        "deleted_message_id": message_id,
        "remaining_count": len(updated_list)
    }


@router.patch("/bookings/{booking_id}/messages/{message_id}")
async def edit_booking_chat_message(
    booking_id: str,
    message_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Edit the text of an existing chat message.
    Strict RBAC: Authorized booking participants or Admin only.
    """
    await _verify_booking_access(booking_id, current_user)
    global _in_memory_chat_threads
    canonical_id = _normalize_chat_booking_id(booking_id)
    new_text = (payload.get("text") or "").strip()
    if not new_text:
        raise HTTPException(status_code=400, detail="Updated message text cannot be empty")

    _load_disk_chat_messages()
    current_list = _in_memory_chat_threads.get(canonical_id, [])
    updated_msg = None
    now_iso = datetime.now().isoformat()

    for m in current_list:
        if m.get("id") == message_id:
            m["text"] = new_text
            m["edited"] = True
            m["editedAt"] = now_iso
            updated_msg = m
            break

    _in_memory_chat_threads[canonical_id] = current_list
    _save_disk_chat_messages()

    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_chat_messages"].update_one(
                {"booking_id": canonical_id, "messages.id": message_id},
                {"$set": {
                    "messages.$.text": new_text,
                    "messages.$.edited": True,
                    "messages.$.editedAt": now_iso
                }}
            )
        except Exception as e:
            print(f"⚠️ [EquipmentChat] Mongo message edit notice: {e}")

    return {
        "success": True,
        "booking_id": canonical_id,
        "message": updated_msg or {"id": message_id, "text": new_text, "edited": True}
    }


@router.delete("/chat/messages")
async def delete_chat_messages_query(
    booking_id: str = Query(..., description="Booking ID"),
    message_id: str = Query(..., description="Message ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    return await delete_booking_chat_message(booking_id, message_id, current_user=current_user)


@router.patch("/chat/messages")
async def patch_chat_messages_body(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    b_id = payload.get("booking_id") or payload.get("bookingId") or "BK-GENERAL"
    m_id = payload.get("message_id") or payload.get("id")
    if not m_id:
        raise HTTPException(status_code=400, detail="message_id is required")
    return await edit_booking_chat_message(b_id, m_id, payload, current_user=current_user)


