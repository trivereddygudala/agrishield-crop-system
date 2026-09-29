"""
Master Data Synchronization & Deletion Tombstone Router
Enables seamless multi-device synchronization so deletions on one mobile device
are immediately propagated to all other mobile devices, tablets, and desktops.
"""

from fastapi import APIRouter, Query, Body, HTTPException, status, Depends
from typing import Optional, List, Dict, Any
from bson import ObjectId
from backend.app.services.sync_service import SyncService
from backend.app.db.mongodb import db_instance
from backend.app.routers.common.auth import get_current_user

router = APIRouter(tags=["Multi-Device Data Sync & Deletions"])


@router.get("/tombstones")
@router.get("/deletions")
async def get_deletion_tombstones(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (equipment, booking, notification, prediction)"),
    since: Optional[str] = Query(None, description="ISO timestamp to fetch only tombstones after this time")
):
    """
    Fetch all active deletion tombstones across the system.
    Mobile devices poll this or call it on app focus/resume to immediately purge
    locally cached items that were deleted on another mobile phone.
    """
    tombstones = await SyncService.get_all_tombstones(entity_type=entity_type, since=since)
    
    # Also compile quick lookup dictionary by entity_type for ultra-fast client-side set lookups
    by_type: Dict[str, List[str]] = {}
    for t in tombstones:
        e_type = t.get("entity_type", "generic")
        e_id = t.get("entity_id")
        if e_type not in by_type:
            by_type[e_type] = []
        if e_id and e_id not in by_type[e_type]:
            by_type[e_type].append(e_id)

    return {
        "success": True,
        "count": len(tombstones),
        "tombstones": tombstones,
        "deleted_ids_by_type": by_type
    }


@router.post("/tombstones", status_code=status.HTTP_201_CREATED)
@router.post("/deletions", status_code=status.HTTP_201_CREATED)
async def record_client_deletion(
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Record a deletion tombstone from any authenticated client device.
    Secured with JWT auth and ownership/admin authorization to prevent arbitrary entity deletion.
    """
    entity_type = (payload.get("entity_type") or payload.get("type") or "").strip().lower()
    raw_entity_id = payload.get("entity_id") or payload.get("id")
    if not entity_type or not raw_entity_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="entity_type and entity_id are required fields"
        )
    entity_id = str(raw_entity_id).strip()

    user_id = str(current_user.get("id") or current_user.get("_id") or "")
    user_role = str(current_user.get("role", "farmer")).lower()
    is_admin = user_role == "admin"

    # C-2: Verify ownership / authorization for non-admin callers if entity exists in database
    if not is_admin and db_instance.db is not None:
        db = db_instance.db
        if entity_type == "equipment":
            doc = await db["equipment_catalog"].find_one({"id": entity_id})
            if doc:
                owner = str(doc.get("providerId") or doc.get("owner_id") or "")
                if owner and owner != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: You do not own this equipment listing"
                    )
        elif entity_type == "booking":
            doc = await db["equipment_bookings"].find_one({"$or": [{"id": entity_id}, {"bookingId": entity_id}]})
            if doc:
                b_user = str(doc.get("userId") or doc.get("user_id") or "")
                b_prov = str(doc.get("providerId") or doc.get("provider_id") or "")
                u_phone = "".join(filter(str.isdigit, str(current_user.get("phone") or current_user.get("mobile") or "")))
                p_phone = "".join(filter(str.isdigit, str(doc.get("providerPhone") or doc.get("provider_phone") or "")))
                is_phone_match = bool(u_phone and p_phone and (u_phone == p_phone or u_phone[-10:] == p_phone[-10:]))
                if b_user != user_id and b_prov != user_id and not is_phone_match:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: You are not authorized to delete this booking"
                    )
        elif entity_type == "prediction":
            q = [{"id": entity_id}]
            if ObjectId.is_valid(entity_id):
                q.append({"_id": ObjectId(entity_id)})
            doc = await db["predictions"].find_one({"$or": q})
            if doc:
                p_user = str(doc.get("user_id") or doc.get("userId") or "")
                if p_user and p_user != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: You do not own this diagnosis scan"
                    )
        elif entity_type == "notification":
            q = [{"id": entity_id}]
            if ObjectId.is_valid(entity_id):
                q.append({"_id": ObjectId(entity_id)})
            doc = await db["notifications"].find_one({"$or": q})
            if doc:
                n_user = str(doc.get("user_id") or doc.get("userId") or "")
                if n_user and n_user != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Forbidden: You do not own this notification"
                    )

    reason = payload.get("reason", "Client user deletion")
    metadata = payload.get("metadata", {})

    success = await SyncService.record_deletion(
        entity_type=entity_type,
        entity_id=entity_id,
        deleted_by=user_id,
        reason=reason,
        metadata=metadata
    )

    return {
        "success": success,
        "message": f"Deletion tombstone recorded for {entity_type} {entity_id}",
        "entity_type": entity_type,
        "entity_id": entity_id
    }


@router.get("/status")
async def get_sync_status():
    """
    Check sync status and total active tombstones across entity categories.
    """
    all_t = await SyncService.get_all_tombstones()
    counts = {}
    for t in all_t:
        etype = t.get("entity_type", "other")
        counts[etype] = counts.get(etype, 0) + 1

    return {
        "status": "operational",
        "total_tombstones": len(all_t),
        "tombstones_by_category": counts
    }
