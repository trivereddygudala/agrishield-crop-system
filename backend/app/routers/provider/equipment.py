"""
Equipment Rental & Farm Machinery Bookings Router
Provides multi-device persistence for farm machinery bookings between Farmers and Equipment Providers.
Syncs across devices (PC, mobile browser, tablets) via MongoDB and persistent JSON store fallback.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import os
import asyncio
from backend.app.db.mongodb import db_instance
from backend.app.services.sync_service import SyncService

router = APIRouter(tags=["Equipment & Farm Machinery Bookings"])

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "equipment_bookings.json")
CATALOG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "equipment_catalog.json")

# In-memory store fallback with initial seed if file doesn't exist
_in_memory_bookings: List[Dict[str, Any]] = []
_in_memory_catalog: List[Dict[str, Any]] = []

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
    limit: Optional[int] = Query(2500, description="Max bookings to return (default 2500 for stress testing)")
):
    """
    Fetch all machinery bookings across devices with optional phone/status filters.
    Supports up to 2500+ records for large-scale farm fleet management and stress-testing.
    Strictly filters out any deleted tombstones to guarantee zero resurrection across mobile devices.
    """
    bookings = []
    fetch_limit = limit or 2500
    
    # 1. Try MongoDB if active
    if db_instance.db is not None:
        try:
            query = {}
            if status:
                query["status"] = status
            cursor = db_instance.db["equipment_bookings"].find(query).sort("createdAt", -1)
            docs = await cursor.to_list(length=fetch_limit)
            for doc in docs:
                doc.pop("_id", None)
                bookings.append(doc)
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Mongo fetch notice: {e}")

    # 2. If Mongo has items, update memory cache (WITHOUT resurrecting deleted items)
    if bookings:
        global _in_memory_bookings
        _in_memory_bookings = bookings[:fetch_limit]
        _save_disk_bookings()
    else:
        # Fallback to in-memory / disk cache
        bookings = _load_disk_bookings()

    # 3. Strictly filter out any deleted tombstones across the entire cluster
    bookings = SyncService.filter_out_deleted("booking", bookings, ["id", "bookingId"])

    # Apply in-memory filters if needed
    result = bookings
    if status:
        result = [b for b in result if str(b.get("status", "")).lower() == status.lower()]
    if provider_phone:
        clean_p = "".join(filter(str.isdigit, provider_phone))
        result = [b for b in result if clean_p in "".join(filter(str.isdigit, str(b.get("providerPhone") or b.get("provider_phone") or b.get("contactPhone") or "")))]
    if farmer_phone:
        clean_f = "".join(filter(str.isdigit, farmer_phone))
        result = [b for b in result if clean_f in "".join(filter(str.isdigit, str(b.get("farmerPhone") or b.get("phone") or "")))]

    return {
        "success": True,
        "count": len(result),
        "bookings": result
    }


@router.post("/bookings")
async def create_booking(booking_data: Dict[str, Any] = Body(...)):
    """
    Save or update a farm machinery booking so it immediately propagates to all devices.
    """
    global _in_memory_bookings
    if not booking_data:
        raise HTTPException(status_code=400, detail="Booking data is required")

    booking_id = booking_data.get("id") or booking_data.get("bookingId") or f"BK-{int(datetime.now().timestamp() * 1000) % 90000 + 10000}"
    booking_data["id"] = booking_id
    booking_data["bookingId"] = booking_id

    if not booking_data.get("status"):
        booking_data["status"] = "pending"
    if not booking_data.get("createdAt"):
        booking_data["createdAt"] = datetime.now().isoformat()
    booking_data["updatedAt"] = datetime.now().isoformat()

    # 1. Update in-memory / disk
    _load_disk_bookings()
    updated_list = [b for b in _in_memory_bookings if b.get("id") != booking_id]
    updated_list.insert(0, booking_data)
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
                        {"phone": {"$regex": clean_p[-10:]}},
                        {"role": "equipment_provider"}
                    ]
                })
            target_uid = str(prov_user["_id"]) if prov_user else "provider_hub"
            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"🚜 New Machinery Booking Request: #{booking_id}",
                    message=f"Farmer {booking_data.get('farmerName', 'Farmer')} booked {booking_data.get('equipmentName', 'Machinery')} ({booking_data.get('acres', '1')} acres) for {booking_data.get('date', 'Today')}.",
                    category="equipment_booking",
                    priority="High",
                    booking_id=booking_id,
                    action_url="/provider/dashboard?tab=orders"
                )
            )
        except Exception as n_err:
            print(f"⚠️ [EquipmentBookings] Provider notification dispatch notice: {n_err}")

    return {
        "success": True,
        "message": "Booking recorded and synced successfully",
        "booking": booking_data
    }


@router.post("/bookings/batch")
async def create_bookings_batch(bookings_data: List[Dict[str, Any]] = Body(...)):
    """
    High-throughput bulk booking endpoint to create or sync up to 1000+ bookings in one round-trip.
    Ideal for large farm cooperatives, automated dispatch testing, and instant multi-order pipelines.
    """
    global _in_memory_bookings
    if not bookings_data or not isinstance(bookings_data, list):
        raise HTTPException(status_code=400, detail="A list of booking objects is required")

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
        if not b.get("status"):
            b["status"] = "pending"
        if not b.get("createdAt"):
            b["createdAt"] = now_iso
        b["updatedAt"] = now_iso

        processed_bookings.append(b)
        existing_map[b_id] = b

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
                        {"phone": {"$regex": clean_p[-10:]}},
                        {"role": "equipment_provider"}
                    ]
                })
            target_uid = str(prov_user["_id"]) if prov_user else "provider_hub"
            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"🚜 {len(processed_bookings)} New Machinery Bookings Received!",
                    message=f"Farmer {first_b.get('farmerName', 'Farmer')} submitted a high-volume booking batch of {len(processed_bookings)} equipment reservations.",
                    category="equipment_booking",
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
    status_update: Dict[str, Any] = Body(...)
):
    """
    Update the status of a booking (confirmed, rejected, completed).
    Automatically dispatches status notifications to the farmer.
    """
    global _in_memory_bookings
    raw_status = status_update.get("status")
    if not raw_status:
        raise HTTPException(status_code=400, detail="New status is required")

    new_status = str(raw_status).lower()
    if new_status in ["declined", "reject"]:
        new_status = "rejected"
    elif new_status in ["confirm", "accepted", "accept"]:
        new_status = "confirmed"
    elif new_status in ["complete", "done"]:
        new_status = "completed"
    elif new_status in ["cancel", "cancelled", "canceled"]:
        new_status = "cancelled"

    cancel_reason = status_update.get("reason") or status_update.get("cancelReason")

    _load_disk_bookings()
    found = False
    updated_booking = None

    for b in _in_memory_bookings:
        if b.get("id") == booking_id or b.get("bookingId") == booking_id:
            b["status"] = new_status
            b["updatedAt"] = datetime.now().isoformat()
            if cancel_reason:
                b["cancelReason"] = cancel_reason
            updated_booking = b
            found = True
            break

    # Update in Mongo with authoritative return
    if db_instance.db is not None:
        try:
            update_fields = {"status": new_status, "updatedAt": datetime.now().isoformat()}
            if cancel_reason:
                update_fields["cancelReason"] = cancel_reason

            mongo_doc = await db_instance.db["equipment_bookings"].find_one_and_update(
                {"$or": [{"id": booking_id}, {"bookingId": booking_id}]},
                {"$set": update_fields},
                return_document=True
            )
            if mongo_doc:
                mongo_doc.pop("_id", None)
                if not updated_booking:
                    updated_booking = mongo_doc
                    found = True
                else:
                    updated_booking.update(mongo_doc)
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Mongo status update notice: {e}")

    if updated_booking:
        _in_memory_bookings = [b for b in _in_memory_bookings if b.get("id") != booking_id and b.get("bookingId") != booking_id]
        _in_memory_bookings.insert(0, updated_booking)
        _save_disk_bookings()

    # Automated notification dispatch to Farmer / Provider
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
            target_uid = str(farmer_user["_id"]) if farmer_user else (updated_booking.get("userId") or "farmer_user")
            status_emoji = "✅" if new_status == "confirmed" else ("❌" if new_status in ["rejected", "cancelled"] else "🚜")
            status_label = "Confirmed" if new_status == "confirmed" else ("Cancelled" if new_status == "cancelled" else ("Declined" if new_status == "rejected" else new_status.title()))
            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"{status_emoji} Machinery Booking #{booking_id} {status_label}",
                    message=f"Reservation for {updated_booking.get('equipmentName', updated_booking.get('title', 'Machinery'))} is now {status_label.lower()}.",
                    category="equipment_booking",
                    priority="High",
                    booking_id=booking_id,
                    action_url="/equipment-booking"
                )
            )
        except Exception as n_err:
            print(f"⚠️ [EquipmentBookings] Notification dispatch notice: {n_err}")

    if not found and db_instance.db is None:
        # If not found in memory, still return acknowledgment
        return {
            "success": True,
            "message": f"Status updated to {new_status}",
            "booking_id": booking_id,
            "status": new_status
        }

    return {
        "success": True,
        "message": f"Status updated to {new_status}",
        "booking": updated_booking
    }


@router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str):
    """
    Remove a booking permanently with cross-device tombstone registration.
    """
    global _in_memory_bookings

    # 1. Register permanent tombstone so no worker/device ever resurrects this booking
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
    payload: Dict[str, Any] = Body(...)
):
    """
    Update machine availability status (available: true/false).
    """
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
    provider_phone: Optional[str] = Query(None, description="Filter by provider phone")
):
    """
    Fetch all registered farm machinery listings across all providers and devices.
    """
    catalog = []
    if db_instance.db is not None:
        try:
            query = {}
            if category and category.lower() != "all":
                query["category"] = {"$regex": f"^{category}$", "$options": "i"}
            if district:
                query["district"] = {"$regex": district, "$options": "i"}
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
    if category and category.lower() != "all":
        result = [c for c in result if str(c.get("category", "")).lower() == category.lower()]
    if village:
        v_clean = village.lower().strip()
        result = [c for c in result if v_clean in str(c.get("village", "")).lower()]
    if district:
        d_clean = district.lower().strip()
        result = [c for c in result if d_clean in str(c.get("district", "")).lower()]
    if provider_phone:
        p_clean = "".join(filter(str.isdigit, provider_phone))
        result = [c for c in result if p_clean in "".join(filter(str.isdigit, str(c.get("phone") or c.get("contactPhone") or "")))]

    return {
        "success": True,
        "count": len(result),
        "equipment": result
    }


@router.post("/catalog")
async def register_equipment_item(equipment_data: Dict[str, Any] = Body(...)):
    """
    Register or update machinery listing for rental so it instantly syncs to all devices.
    """
    global _in_memory_catalog
    if not equipment_data:
        raise HTTPException(status_code=400, detail="Equipment data is required")

    eq_id = equipment_data.get("id") or f"EQ-{int(datetime.now().timestamp() * 1000) % 90000 + 10000}"
    equipment_data["id"] = eq_id

    if "available" not in equipment_data:
        equipment_data["available"] = True
    if not equipment_data.get("createdAt"):
        equipment_data["createdAt"] = datetime.now().isoformat()
    equipment_data["updatedAt"] = datetime.now().isoformat()

    # Update in-memory & disk
    _load_disk_catalog()
    updated_list = [c for c in _in_memory_catalog if c.get("id") != eq_id]
    updated_list.insert(0, equipment_data)
    _in_memory_catalog = updated_list
    _save_disk_catalog()

    # Save to MongoDB
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_catalog"].update_one(
                {"id": eq_id},
                {"$set": equipment_data},
                upsert=True
            )
        except Exception as e:
            print(f"⚠️ [EquipmentCatalog] Mongo catalog update notice: {e}")

    return {
        "success": True,
        "message": "Equipment listing saved and synced across all devices",
        "equipment": equipment_data
    }


@router.delete("/catalog/{equipment_id}")
async def delete_equipment_item(equipment_id: str):
    """
    Remove equipment listing from active catalog permanently with cross-device tombstone registration.
    """
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

@router.get("/bookings/{booking_id}/messages")
async def get_booking_chat_messages(booking_id: str):
    """
    Retrieve all real-time chat messages for an equipment booking thread.
    Synchronizes cross-browser, cross-device communications between Farmer and Provider.
    """
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

    return {
        "success": True,
        "booking_id": canonical_id,
        "count": len(messages),
        "messages": messages
    }


@router.post("/bookings/{booking_id}/messages")
async def send_booking_chat_message(
    booking_id: str,
    payload: Dict[str, Any] = Body(...)
):
    """
    Post a new chat message to a booking thread.
    Instantly saves and propagates to all active devices (web, mobile, cross-browser).
    """
    global _in_memory_chat_threads
    canonical_id = _normalize_chat_booking_id(booking_id)

    msg_id = payload.get("id") or f"msg_{int(datetime.now().timestamp() * 1000)}"
    text = (payload.get("text") or "").strip()
    sender = payload.get("sender") or "farmer"
    sender_name = payload.get("senderName") or ("Equipment Provider" if sender == "provider" else "Farmer")
    msg_type = payload.get("type") or "text"
    time_str = payload.get("time") or datetime.now().strftime("%I:%M %p")
    timestamp = payload.get("timestamp") or datetime.now().isoformat()

    new_message = {
        "id": msg_id,
        "sender": sender,
        "senderName": sender_name,
        "type": msg_type,
        "text": text,
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
        recipient_role = "equipment_provider" if sender == "farmer" else "farmer"
        preview_text = text[:80] if text else "Sent a location attachment"

        target_uid = "provider_hub" if recipient_role == "equipment_provider" else "farmer_hub"
        if db_instance.db is not None:
            user_doc = await db_instance.db["users"].find_one({"role": recipient_role})
            if user_doc:
                target_uid = str(user_doc["_id"])

            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"💬 New Message ({canonical_id})",
                    message=f"{sender_name}: \"{preview_text}\"",
                    category="booking",
                    priority="Normal",
                    booking_id=canonical_id,
                    action_url=f"/notifications?bookingId={canonical_id}"
                )
            )
    except Exception:
        pass

    return {
        "success": True,
        "booking_id": canonical_id,
        "message": new_message,
        "total": len(current_list)
    }


@router.get("/chat/messages")
async def get_chat_messages_query(booking_id: str = Query(..., description="Booking ID")):
    return await get_booking_chat_messages(booking_id)


@router.post("/chat/messages")
async def post_chat_messages_body(payload: Dict[str, Any] = Body(...)):
    b_id = payload.get("booking_id") or payload.get("bookingId") or "BK-GENERAL"
    return await send_booking_chat_message(b_id, payload)


@router.delete("/bookings/{booking_id}/messages/{message_id}")
async def delete_booking_chat_message(
    booking_id: str,
    message_id: str
):
    """
    Delete a single message from a booking chat thread across all devices.
    """
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
    payload: Dict[str, Any] = Body(...)
):
    """
    Edit the text of an existing chat message.
    """
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
    message_id: str = Query(..., description="Message ID")
):
    return await delete_booking_chat_message(booking_id, message_id)


@router.patch("/chat/messages")
async def patch_chat_messages_body(payload: Dict[str, Any] = Body(...)):
    b_id = payload.get("booking_id") or payload.get("bookingId") or "BK-GENERAL"
    m_id = payload.get("message_id") or payload.get("id")
    if not m_id:
        raise HTTPException(status_code=400, detail="message_id is required")
    return await edit_booking_chat_message(b_id, m_id, payload)


