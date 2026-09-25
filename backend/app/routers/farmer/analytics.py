from datetime import timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional, Dict, Any

from backend.app.db.mongodb import get_database
from backend.app.routers.auth import get_current_user
from backend.app.services.analytics import analytics_service

router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"]
)

@router.get("/summary", response_model=Dict[str, Any])
async def get_analytics_summary(
    time_range: str = Query("all", description="Time range for analytics (today, 7d, 30d, 90d, 1y, custom, all)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD) for custom time range"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD) for custom time range"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Returns user-specific analytics summary based on the prediction history.
    Results are cached in-memory for 5 minutes.
    """
    try:
        user_id = str(current_user["id"])
        data = await analytics_service.get_full_analytics(
            db=db,
            user_id=user_id,
            time_range=time_range,
            start_date_str=start_date,
            end_date_str=end_date
        )
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate analytics summary: {str(e)}"
        )
