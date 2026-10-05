import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from backend.app.routers.auth import get_current_user
from backend.app.models.action_center import FarmerActionsResponse, ActionStatusUpdateResponse
from backend.app.services.action_center.service import ActionCenterService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Smart Farmer Action Center"])

action_center_service = ActionCenterService()


@router.get("", response_model=FarmerActionsResponse, summary="Get Prioritized Farmer Daily Actions")
@router.get("/", response_model=FarmerActionsResponse, include_in_schema=False)
async def get_farmer_actions(
    farm_id: Optional[str] = Query(None, description="Active Farm Profile ID (optional, defaults to farmer's primary farm)"),
    priority: Optional[str] = Query(None, description="Filter by priority: P0 | P1 | P2 | P3"),
    limit: int = Query(20, ge=1, le=100, description="Max actions to return (default 20)"),
    bucket: Optional[str] = Query(None, description="Operational bucket: today | overdue | upcoming | completed | all"),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve synthesized, prioritized daily actions for the authenticated farmer.
    Synthesizes signals from B15 Smart Irrigation, B16 Crop Calendar, B17 Farm Khata,
    B18 Farm Inventory, Weather, Disease Risk, and Machinery Bookings.
    """
    return await action_center_service.get_actions(
        farm_id=farm_id,
        priority=priority,
        limit=limit,
        bucket=bucket,
        current_user=current_user
    )


@router.post("/{action_id}/complete", response_model=ActionStatusUpdateResponse, summary="Mark Action Completed")
async def complete_farmer_action(
    action_id: str,
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a farmer action as completed.
    - If the action is a B16 crop calendar task, delegates to the authoritative B16 timeline_tasks mechanism.
    - If advisory action, persists completion state inside farm_profiles.action_center_state.
    Never alters physical inventory or financial ledgers.
    """
    # If farm_id not explicitly in query, resolve from user or action_id
    f_id = farm_id or "default"
    res = await action_center_service.complete_action(
        farm_id=f_id,
        action_id=action_id,
        current_user=current_user
    )
    return res


@router.post("/{action_id}/dismiss", response_model=ActionStatusUpdateResponse, summary="Dismiss Advisory Action")
async def dismiss_farmer_action(
    action_id: str,
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Dismiss an advisory action card.
    Saves lightweight dismissal into farm_profiles.action_center_state without altering source domain data.
    """
    f_id = farm_id or "default"
    res = await action_center_service.dismiss_action(
        farm_id=f_id,
        action_id=action_id,
        current_user=current_user
    )
    return res


@router.post("/{action_id}/reopen", response_model=ActionStatusUpdateResponse, summary="Reopen Completed Action")
async def reopen_farmer_action(
    action_id: str,
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Reopen a previously completed action back to pending state.
    - If B16 crop calendar task: updates farm_profiles.timeline_tasks directly.
    - If advisory action: updates farm_profiles.action_center_state.
    Idempotent and RBAC-enforced.
    """
    f_id = farm_id or "default"
    res = await action_center_service.reopen_action(
        farm_id=f_id,
        action_id=action_id,
        current_user=current_user
    )
    return res
