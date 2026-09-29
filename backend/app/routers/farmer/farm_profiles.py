import math
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from backend.app.db.mongodb import get_database
from backend.app.routers.auth import get_current_user
from backend.app.models.farm_profile import (
    FarmProfileCreate,
    FarmProfileUpdate,
    FarmProfileResponse,
    KhataTransactionCreate,
    TimelineTasksUpdate
)
from backend.app.services.farm_profile_service import FarmProfileService

router = APIRouter(prefix="/api/farms", tags=["Farm Profiles"])

@router.get("", response_model=List[FarmProfileResponse])
async def list_farms(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all farms for the logged-in user."""
    return await FarmProfileService.list_farms(db, current_user["id"])

@router.get("/archived", response_model=List[FarmProfileResponse])
async def list_archived_farms(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all archived farms for the logged-in user."""
    return await FarmProfileService.list_archived_farms(db, current_user["id"])

@router.get("/current", response_model=Optional[FarmProfileResponse])
async def get_current_farm(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve the currently active farm profile."""
    return await FarmProfileService.get_active_farm(db, current_user["id"])

@router.get("/{farm_id}", response_model=FarmProfileResponse)
async def get_farm(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve details of a specific farm profile."""
    farm = await FarmProfileService.get_farm(db, farm_id, current_user["id"])
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm profile not found or access denied"
        )
    return farm

@router.post("", response_model=FarmProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_farm(
    farm_data: FarmProfileCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new farm profile and automatically make it active."""
    try:
        return await FarmProfileService.create_farm(db, current_user["id"], farm_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create farm: {str(e)}"
        )

@router.put("/{farm_id}", response_model=FarmProfileResponse)
async def update_farm(
    farm_id: str,
    farm_data: FarmProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update details of a specific farm profile."""
    farm = await FarmProfileService.update_farm(db, farm_id, current_user["id"], farm_data)
    if not farm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm profile not found or failed to update"
        )
    return farm

@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a farm profile."""
    deleted = await FarmProfileService.delete_farm(db, farm_id, current_user["id"])
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm profile not found or delete failed"
        )
    return None

@router.post("/{farm_id}/unarchive")
async def unarchive_farm(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Restore an archived farm profile."""
    success = await FarmProfileService.unarchive_farm(db, farm_id, current_user["id"])
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm profile not found or could not be restored"
        )
    return {"message": "Farm restored successfully", "active_farm_id": farm_id}

@router.post("/{farm_id}/select")
async def select_active_farm(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Set a specific farm profile as active."""
    success = await FarmProfileService.set_active_farm(db, farm_id, current_user["id"])
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm profile not found or could not be selected"
        )
    return {"message": "Active farm updated successfully", "active_farm_id": farm_id}

def calculate_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon)
    initial_bearing = math.atan2(y, x)
    initial_bearing = math.degrees(initial_bearing)
    compass_bearing = (initial_bearing + 360) % 360
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"]
    idx = int((compass_bearing + 22.5) / 45)
    return directions[idx]

@router.get("/{farm_id}/nearby-radar")
async def get_nearby_farm_radar(
    farm_id: str,
    radius_km: float = 5.0,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Scan nearby farms, crops, active diseases, and airborne spore risk within radius."""
    farm = await FarmProfileService.get_farm(db, farm_id, current_user["id"])
    if not farm:
        farms = await FarmProfileService.list_farms(db, current_user["id"])
        farm = farms[0] if farms else {}

    c_lat = lat if lat is not None else (farm.get("latitude") or 14.6819)
    c_lng = lng if lng is not None else (farm.get("longitude") or 77.6006)
    crop = farm.get("crop_name", "Tomato")

    nearby = []
    try:
        cursor = db["farm_profiles"].find({"is_archived": {"$ne": True}})
        async for doc in cursor:
            if str(doc.get("_id")) == farm_id:
                continue
            f_lat = doc.get("latitude")
            f_lng = doc.get("longitude")
            if f_lat and f_lng:
                dist = calculate_haversine(c_lat, c_lng, f_lat, f_lng)
                if dist <= radius_km:
                    bearing = calculate_bearing(c_lat, c_lng, f_lat, f_lng)
                    idx = len(nearby) + 1
                    nearby.append({
                        "id": f"radar_plot_{idx}",
                        "distance_km": dist,
                        "bearing": bearing,
                        "crop": doc.get("crop_name", "Crop"),
                        "variety": doc.get("crop_variety", "Local"),
                        "disease": doc.get("active_disease", "Healthy"),
                        "status": "Infected" if doc.get("active_disease") and doc.get("active_disease") != "Healthy" else "Healthy",
                        "severity": doc.get("severity", "Moderate")
                    })
    except Exception:
        pass

    nearby.sort(key=lambda x: x["distance_km"])
    infected_count = sum(1 for n in nearby if n["status"] == "Infected")
    alert_level = "CRITICAL" if infected_count >= 3 else ("WARNING" if infected_count >= 1 else "SAFE")

    return {
        "center": {
            "farm_id": farm_id,
            "farm_name": farm.get("farm_name", "My Farm"),
            "crop": crop,
            "lat": c_lat,
            "lng": c_lng,
            "boundary_coordinates": farm.get("boundary_coordinates") or []
        },
        "radius_km": radius_km,
        "total_nearby": len(nearby),
        "infected_count": infected_count,
        "alert_level": alert_level,
        "airborne_spore_risk": "High" if alert_level == "CRITICAL" else ("Moderate" if alert_level == "WARNING" else "Low"),
        "recommended_action": (
            f"⚠️ {infected_count} active infection(s) detected in neighboring plots within {radius_km} km. Prophylactic spray (Mancozeb / Trichoderma) recommended."
            if infected_count > 0 else
            f"✅ All surveyed neighboring fields in your area report healthy crops. No active airborne spore threats detected within {radius_km} km."
        ),
        "nearby_farms": nearby
    }


async def _verify_farm_access(farm_id: str, current_user: dict, db) -> dict:
    """
    Verify farm existence and caller access permissions:
    - 401 if unauthenticated (handled by Depends(get_current_user))
    - 404 if farm does not exist in db["farm_profiles"]
    - 403 if non-admin caller is not the owner of the farm
    - Returns the farm document
    """
    if not farm_id or not str(farm_id).strip():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm profile not found."
        )

    query_cond = [{"id": farm_id}]
    if ObjectId.is_valid(farm_id):
        query_cond.append({"_id": ObjectId(farm_id)})
    else:
        query_cond.append({"_id": farm_id})

    farm_doc = await db["farm_profiles"].find_one({"$or": query_cond})
    if not farm_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farm profile not found."
        )

    user_role = (current_user.get("role") or "farmer").lower()
    user_id = str(current_user.get("id") or current_user.get("_id") or "")

    if user_role != "admin":
        farm_owner = str(farm_doc.get("user_id") or "")
        if farm_owner and farm_owner != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You do not own this farm profile."
            )

    return farm_doc


# ══════════════════════════════════════════════════════════════════════════════
# M-1: DIGITAL FARM KHATA LEDGER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{farm_id}/khata")
async def get_farm_khata(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all financial ledger transactions for a farm."""
    await _verify_farm_access(farm_id, current_user, db)

    cursor = db["farm_khata"].find({"farm_id": farm_id}).sort("date", -1)
    transactions = []
    async for doc in cursor:
        doc["id"] = str(doc.get("_id") or doc.get("id"))
        doc["_id"] = str(doc.get("_id"))
        if "created_at" in doc and isinstance(doc["created_at"], datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        if "updated_at" in doc and isinstance(doc["updated_at"], datetime):
            doc["updated_at"] = doc["updated_at"].isoformat()
        transactions.append(doc)

    return {
        "status": "success",
        "farm_id": farm_id,
        "transactions": transactions,
        "count": len(transactions)
    }


@router.post("/{farm_id}/khata", status_code=status.HTTP_201_CREATED)
async def add_farm_khata_transaction(
    farm_id: str,
    tx_data: KhataTransactionCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new Khata income or expense transaction."""
    await _verify_farm_access(farm_id, current_user, db)

    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    tx_type = tx_data.type.lower().strip()
    if tx_type not in ["expense", "income"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction type must be 'expense' or 'income'."
        )
    if tx_data.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than 0."
        )

    # Duplicate booking-sync protection: if booking_id is provided, check if already recorded
    if tx_data.booking_id:
        existing = await db["farm_khata"].find_one({
            "farm_id": farm_id,
            "booking_id": str(tx_data.booking_id)
        })
        if existing:
            existing["id"] = str(existing.get("_id") or existing.get("id"))
            existing["_id"] = str(existing.get("_id"))
            if "created_at" in existing and isinstance(existing["created_at"], datetime):
                existing["created_at"] = existing["created_at"].isoformat()
            if "updated_at" in existing and isinstance(existing["updated_at"], datetime):
                existing["updated_at"] = existing["updated_at"].isoformat()
            return existing

    now = datetime.now(timezone.utc)
    doc = {
        "farm_id": farm_id,
        "user_id": user_id,
        "type": tx_type,
        "category": tx_data.category.strip(),
        "description": tx_data.description.strip(),
        "amount": float(tx_data.amount),
        "date": tx_data.date.strip(),
        "created_at": now,
        "updated_at": now
    }
    if tx_data.booking_id:
        doc["booking_id"] = str(tx_data.booking_id)

    res = await db["farm_khata"].insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc["_id"] = str(res.inserted_id)
    doc["created_at"] = now.isoformat()
    doc["updated_at"] = now.isoformat()
    return doc


@router.delete("/{farm_id}/khata/{tx_id}")
async def delete_farm_khata_transaction(
    farm_id: str,
    tx_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a Khata transaction."""
    await _verify_farm_access(farm_id, current_user, db)

    cond = [{"id": tx_id}]
    if ObjectId.is_valid(tx_id):
        cond.append({"_id": ObjectId(tx_id)})

    tx = await db["farm_khata"].find_one({"$and": [{"farm_id": farm_id}, {"$or": cond}]})
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Khata transaction not found."
        )

    await db["farm_khata"].delete_one({"_id": tx["_id"]})
    return {"message": "Transaction deleted successfully", "id": tx_id}


# ══════════════════════════════════════════════════════════════════════════════
# M-2: CROP GROWTH TIMELINE PERSISTENCE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{farm_id}/timeline-tasks")
async def get_timeline_tasks(
    farm_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve crop growth timeline completed tasks for a farm."""
    farm_doc = await _verify_farm_access(farm_id, current_user, db)
    return {
        "status": "success",
        "farm_id": farm_id,
        "completed_tasks": farm_doc.get("timeline_tasks") or {}
    }


@router.put("/{farm_id}/timeline-tasks")
async def update_timeline_tasks(
    farm_id: str,
    payload: TimelineTasksUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update crop growth timeline completed tasks for a farm."""
    farm_doc = await _verify_farm_access(farm_id, current_user, db)

    tasks = payload.completed_tasks
    if not isinstance(tasks, dict) or len(tasks) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid completed_tasks format or payload size exceeds 100 items."
        )
    for k, v in tasks.items():
        if not isinstance(k, str) or len(k) > 100 or not isinstance(v, bool):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task entry: key must be string <= 100 chars, value must be boolean."
            )

    now = datetime.now(timezone.utc)
    await db["farm_profiles"].update_one(
        {"_id": farm_doc["_id"]},
        {
            "$set": {
                "timeline_tasks": tasks,
                "updated_at": now
            }
        }
    )
    return {
        "status": "success",
        "farm_id": farm_id,
        "completed_tasks": tasks
    }

