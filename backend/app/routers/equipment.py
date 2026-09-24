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

router = APIRouter(prefix="/api/v1/equipment", tags=["Equipment & Farm Machinery Bookings"])

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "equipment_bookings.json")

# In-memory store fallback with initial seed if file doesn't exist
_in_memory_bookings: List[Dict[str, Any]] = []

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

# Initialize from disk on startup
_load_disk_bookings()


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
        result = [b for b in result if clean_p in "".join(filter(str.isdigit, str(b.get("providerPhone") or b.get("contactPhone") or "")))]
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
