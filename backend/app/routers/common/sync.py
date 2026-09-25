"""
Master Data Synchronization & Deletion Tombstone Router
Enables seamless multi-device synchronization so deletions on one mobile device
are immediately propagated to all other mobile devices, tablets, and desktops.
"""

from fastapi import APIRouter, Query, Body, HTTPException, status
from typing import Optional, List, Dict, Any
from backend.app.services.sync_service import SyncService

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
async def record_client_deletion(payload: Dict[str, Any] = Body(...)):
    """
    Record a deletion tombstone from any client device.
    Immediately makes the deletion permanent across all backend workers, MongoDB,
    disk storage, and other connected mobile devices.
    """
    entity_type = payload.get("entity_type") or payload.get("type")
    entity_id = payload.get("entity_id") or payload.get("id")
    deleted_by = payload.get("deleted_by")
    reason = payload.get("reason", "Client user deletion")
    metadata = payload.get("metadata", {})

    if not entity_type or not entity_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="entity_type and entity_id are required fields"
        )

    success = await SyncService.record_deletion(
        entity_type=entity_type,
        entity_id=str(entity_id),
        deleted_by=deleted_by,
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
