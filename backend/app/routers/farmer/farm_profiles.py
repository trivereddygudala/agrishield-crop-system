import math
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    tx_type: Optional[str] = Query(None, alias="type", description="Filter by expense or income"),
    category: Optional[str] = Query(None, description="Filter by category"),
    crop_name: Optional[str] = Query(None, description="Filter by crop name"),
    season: Optional[str] = Query(None, description="Filter by season"),
    is_estimated: Optional[bool] = Query(None, description="Filter by actual (false) or estimated (true)"),
    payment_status: Optional[str] = Query(None, description="Filter by paid, unpaid, or partial"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve financial ledger transactions for a farm with optional B17 filters."""
    await _verify_farm_access(farm_id, current_user, db)

    query: Dict[str, Any] = {"farm_id": farm_id}
    if tx_type and tx_type.strip():
        query["type"] = tx_type.strip().lower()
    if category and category.strip():
        query["category"] = category.strip().lower()
    if crop_name and crop_name.strip():
        query["crop_name"] = crop_name.strip()
    if season and season.strip():
        query["season"] = season.strip()
    if is_estimated is not None:
        query["is_estimated"] = is_estimated
    if payment_status and payment_status.strip():
        query["payment_status"] = payment_status.strip().lower()

    cursor = db["farm_khata"].find(query).sort("date", -1)
    transactions = []
    async for doc in cursor:
        doc["id"] = str(doc.get("_id") or doc.get("id"))
        doc["_id"] = str(doc.get("_id"))
        doc["field_id"] = doc.get("field_id")
        doc["crop_name"] = doc.get("crop_name")
        doc["season"] = doc.get("season")
        doc["is_estimated"] = bool(doc.get("is_estimated", False))
        doc["payment_status"] = str(doc.get("payment_status") or "paid").lower()
        doc["quantity"] = doc.get("quantity")
        doc["unit"] = doc.get("unit")
        doc["vendor"] = doc.get("vendor")
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


@router.get("/{farm_id}/khata/analytics")
async def get_farm_khata_analytics(
    farm_id: str,
    season: Optional[str] = Query(None, description="Optional season filter"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    B17: Calculate comprehensive farm financial analytics:
    - Actual Expenses vs Actual Income -> Actual Net Profit/Loss
    - Estimated Expenses vs Estimated Income -> Projected Net Profit
    - Unpaid and Partial Liabilities
    - Category, Crop, Field, and Season-wise breakdowns
    - Cost of Cultivation per acre/hectare
    """
    farm_doc = await _verify_farm_access(farm_id, current_user, db)

    query: Dict[str, Any] = {"farm_id": farm_id}
    if season and season.strip():
        query["season"] = season.strip()

    cursor = db["farm_khata"].find(query)

    total_actual_expenses = 0.0
    total_actual_income = 0.0
    estimated_expenses = 0.0
    estimated_income = 0.0
    unpaid_amount = 0.0
    partial_amount = 0.0

    category_breakdown: Dict[str, Dict[str, Any]] = {}
    crop_breakdown: Dict[str, Dict[str, float]] = {}
    field_breakdown: Dict[str, Dict[str, float]] = {}
    season_breakdown: Dict[str, Dict[str, Any]] = {}

    async for doc in cursor:
        amount = float(doc.get("amount") or 0.0)
        tx_type = str(doc.get("type") or "expense").lower().strip()
        is_est = bool(doc.get("is_estimated", False))
        pay_stat = str(doc.get("payment_status") or "paid").lower().strip()
        cat = str(doc.get("category") or "other").strip()
        c_name = doc.get("crop_name") or "Unallocated"
        f_id = doc.get("field_id") or "Farm-level"
        s_name = doc.get("season") or "Unassigned"

        if is_est:
            if tx_type == "income":
                estimated_income += amount
            else:
                estimated_expenses += amount
        else:
            if tx_type == "income":
                total_actual_income += amount
            else:
                total_actual_expenses += amount
                if pay_stat == "unpaid":
                    unpaid_amount += amount
                elif pay_stat == "partial":
                    partial_amount += amount

        # Category Breakdown for actual expenses
        if not is_est and tx_type == "expense":
            if cat not in category_breakdown:
                category_breakdown[cat] = {"amount": 0.0, "count": 0}
            category_breakdown[cat]["amount"] += amount
            category_breakdown[cat]["count"] += 1

        # Crop Breakdown for actual transactions
        if not is_est:
            if c_name not in crop_breakdown:
                crop_breakdown[c_name] = {"expense": 0.0, "income": 0.0}
            if tx_type == "expense":
                crop_breakdown[c_name]["expense"] += amount
            else:
                crop_breakdown[c_name]["income"] += amount

        # Field Breakdown for actual transactions
        if not is_est:
            if f_id not in field_breakdown:
                field_breakdown[f_id] = {"expense": 0.0, "income": 0.0}
            if tx_type == "expense":
                field_breakdown[f_id]["expense"] += amount
            else:
                field_breakdown[f_id]["income"] += amount

        # Season Breakdown (both actual and estimated)
        if s_name not in season_breakdown:
            season_breakdown[s_name] = {
                "actual_expense": 0.0,
                "actual_income": 0.0,
                "estimated_expense": 0.0,
                "estimated_income": 0.0
            }
        if is_est:
            if tx_type == "income":
                season_breakdown[s_name]["estimated_income"] += amount
            else:
                season_breakdown[s_name]["estimated_expense"] += amount
        else:
            if tx_type == "income":
                season_breakdown[s_name]["actual_income"] += amount
            else:
                season_breakdown[s_name]["actual_expense"] += amount

    actual_profit = total_actual_income - total_actual_expenses
    projected_profit = (total_actual_income + estimated_income) - (total_actual_expenses + estimated_expenses)

    farm_size = float(farm_doc.get("farm_size") or 0.0)
    farm_unit = str(farm_doc.get("farm_unit") or "acres")
    cost_per_unit = round(total_actual_expenses / farm_size, 2) if farm_size > 0 else None
    profit_per_unit = round(actual_profit / farm_size, 2) if farm_size > 0 else None

    # Calculate percentages for category breakdown
    for cat, data in category_breakdown.items():
        data["percentage"] = round((data["amount"] / total_actual_expenses * 100), 1) if total_actual_expenses > 0 else 0.0
        data["amount"] = round(data["amount"], 2)

    # Round numerical breakdown maps
    for c_k, c_v in crop_breakdown.items():
        c_v["expense"] = round(c_v["expense"], 2)
        c_v["income"] = round(c_v["income"], 2)
    for f_k, f_v in field_breakdown.items():
        f_v["expense"] = round(f_v["expense"], 2)
        f_v["income"] = round(f_v["income"], 2)
    for s_k, s_v in season_breakdown.items():
        s_v["actual_expense"] = round(s_v["actual_expense"], 2)
        s_v["actual_income"] = round(s_v["actual_income"], 2)
        s_v["estimated_expense"] = round(s_v["estimated_expense"], 2)
        s_v["estimated_income"] = round(s_v["estimated_income"], 2)

    return {
        "status": "success",
        "farm_id": farm_id,
        "farm_name": farm_doc.get("farm_name", "My Farm"),
        "farm_size": farm_size,
        "farm_unit": farm_unit,
        "total_actual_expenses": round(total_actual_expenses, 2),
        "total_actual_income": round(total_actual_income, 2),
        "actual_profit": round(actual_profit, 2),
        "estimated_expenses": round(estimated_expenses, 2),
        "estimated_income": round(estimated_income, 2),
        "projected_profit": round(projected_profit, 2),
        "unpaid_amount": round(unpaid_amount, 2),
        "partial_amount": round(partial_amount, 2),
        "cost_per_unit": cost_per_unit,
        "profit_per_unit": profit_per_unit,
        "category_breakdown": category_breakdown,
        "crop_breakdown": crop_breakdown,
        "field_breakdown": field_breakdown,
        "season_breakdown": season_breakdown
    }


@router.post("/{farm_id}/khata", status_code=status.HTTP_201_CREATED)
async def add_farm_khata_transaction(
    farm_id: str,
    tx_data: KhataTransactionCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new Khata income or expense transaction with B17 attribution."""
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

    pay_status = (tx_data.payment_status or "paid").lower().strip()
    if pay_status not in ["paid", "unpaid", "partial"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment status must be 'paid', 'unpaid', or 'partial'."
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
        "field_id": tx_data.field_id.strip() if tx_data.field_id else None,
        "crop_name": tx_data.crop_name.strip() if tx_data.crop_name else None,
        "season": tx_data.season.strip() if tx_data.season else None,
        "is_estimated": bool(tx_data.is_estimated),
        "payment_status": pay_status,
        "quantity": float(tx_data.quantity) if tx_data.quantity is not None else None,
        "unit": tx_data.unit.strip() if tx_data.unit else None,
        "vendor": tx_data.vendor.strip() if tx_data.vendor else None,
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
        if not isinstance(k, str) or len(k) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task entry: key must be string <= 100 chars."
            )
        if isinstance(v, bool):
            continue
        elif isinstance(v, dict):
            status_val = v.get("status")
            if status_val not in ("completed", "skipped", "delayed", "pending"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid task status: '{status_val}'. Must be completed, skipped, delayed, or pending."
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task entry: value must be boolean or status dictionary."
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

