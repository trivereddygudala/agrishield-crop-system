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
                    _in_memory_bookings = data
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
                    _in_memory_catalog = data
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

# Initialize from disk on startup
_load_disk_bookings()
_load_disk_catalog()


@router.get("/bookings")
async def get_all_bookings(
    provider_phone: Optional[str] = Query(None, description="Filter by equipment provider phone"),
    farmer_phone: Optional[str] = Query(None, description="Filter by farmer phone"),
    status: Optional[str] = Query(None, description="Filter by status (pending, confirmed, completed, rejected)")
):
    """
    Fetch all machinery bookings across devices with optional phone/status filters.
    """
    bookings = []
    
    # 1. Try MongoDB if active
    if db_instance.db is not None:
        try:
            query = {}
            if status:
                query["status"] = status
            cursor = db_instance.db["equipment_bookings"].find(query).sort("createdAt", -1)
            docs = await cursor.to_list(length=100)
            for doc in docs:
                doc.pop("_id", None)
                bookings.append(doc)
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Mongo fetch notice: {e}")

    # 2. If Mongo has items, update memory cache
    if bookings:
        global _in_memory_bookings
        # Merge unique IDs
        existing_ids = {b.get("id") for b in bookings if b.get("id")}
        for local_b in _in_memory_bookings:
            if local_b.get("id") and local_b.get("id") not in existing_ids:
                bookings.append(local_b)
        _in_memory_bookings = bookings
        _save_disk_bookings()
    else:
        # Fallback to in-memory / disk cache
        bookings = _load_disk_bookings()

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
    new_status = status_update.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="New status is required")

    _load_disk_bookings()
    found = False
    updated_booking = None

    for b in _in_memory_bookings:
        if b.get("id") == booking_id:
            b["status"] = new_status
            b["updatedAt"] = datetime.now().isoformat()
            updated_booking = b
            found = True
            break

    if updated_booking:
        _save_disk_bookings()

    # Update in Mongo
    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_bookings"].update_one(
                {"id": booking_id},
                {"$set": {"status": new_status, "updatedAt": datetime.now().isoformat()}}
            )
        except Exception as e:
            print(f"⚠️ [EquipmentBookings] Mongo status update notice: {e}")

    # Automated notification dispatch to Farmer
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
            status_emoji = "✅" if new_status == "confirmed" else ("❌" if new_status == "rejected" else "🚜")
            status_label = "Confirmed" if new_status == "confirmed" else ("Declined" if new_status == "rejected" else new_status.title())
            await NotificationService.create_notification(
                db_instance.db,
                NotificationCreate(
                    user_id=target_uid,
                    title=f"{status_emoji} Machinery Booking #{booking_id} {status_label}",
                    message=f"Provider {updated_booking.get('providerName', 'Provider')} has {new_status} your reservation for {updated_booking.get('equipmentName', 'Machinery')}.",
                    category="equipment_booking",
                    priority="High",
                    action_url="/equipment-booking"
                )
            )
        except Exception as n_err:
            print(f"⚠️ [EquipmentBookings] Farmer notification dispatch notice: {n_err}")

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
    Remove a booking.
    """
    global _in_memory_bookings
    _load_disk_bookings()
    _in_memory_bookings = [b for b in _in_memory_bookings if b.get("id") != booking_id]
    _save_disk_bookings()

    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_bookings"].delete_one({"id": booking_id})
        except Exception:
            pass

    return {"success": True, "message": f"Booking {booking_id} deleted"}


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
        existing_ids = {c.get("id") for c in catalog if c.get("id")}
        for local_c in _in_memory_catalog:
            if local_c.get("id") and local_c.get("id") not in existing_ids:
                catalog.append(local_c)
        _in_memory_catalog = catalog
        _save_disk_catalog()
    else:
        catalog = _load_disk_catalog()

    result = catalog
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
    Remove equipment listing from active catalog.
    """
    global _in_memory_catalog
    _load_disk_catalog()
    _in_memory_catalog = [c for c in _in_memory_catalog if c.get("id") != equipment_id]
    _save_disk_catalog()

    if db_instance.db is not None:
        try:
            await db_instance.db["equipment_catalog"].delete_one({"id": equipment_id})
        except Exception:
            pass

    return {"success": True, "message": f"Equipment listing {equipment_id} removed"}
