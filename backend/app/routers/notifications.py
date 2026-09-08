from datetime import timezone
import logging
from typing import Optional, List, Dict, Any
from fastapi import (
    APIRouter, Depends, HTTPException, status, Query, 
    WebSocket, WebSocketDisconnect, Response
)
from backend.app.db.mongodb import get_database
from backend.app.routers.auth import get_current_user
from backend.app.services.notification_service import NotificationService
from backend.app.services.firebase_service import FirebaseService
from backend.app.models.notification import (
    NotificationHistoryResponse, NotificationResponse,
    NotificationSettingsResponse, NotificationSettingsUpdate,
    NotificationCreate, NotificationAcknowledge, FCMTokenRegister
)

from fastapi.encoders import jsonable_encoder
from backend.app.core.security import decode_access_token

logger = logging.getLogger(__name__)

# Main APIRouter without constructor prefix to support dual prefix matching (/api and /api/v1)
router = APIRouter(tags=["Notifications"])

# --- WebSocket Live Connections Manager ---
class WebSocketManager:
    def __init__(self):
        # Maps user_id strings to list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket client connected for user: {user_id}")

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket client disconnected for user: {user_id}")

    async def broadcast_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            encoded_message = jsonable_encoder(message)
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(encoded_message)
                except Exception as e:
                    logger.error(f"WebSocket push message failed: {e}")

    async def broadcast_all(self, message: dict):
        """Broadcast real-time telemetry or event to all active WebSocket clients."""
        encoded_message = jsonable_encoder(message)
        for user_id, connections in list(self.active_connections.items()):
            for connection in list(connections):
                try:
                    await connection.send_json(encoded_message)
                except Exception as e:
                    logger.error(f"WebSocket broadcast_all push message failed: {e}")

ws_manager = WebSocketManager()
# Register ws manager callback on NotificationService
NotificationService.register_websocket_manager(ws_manager)

# --- WebSocket Route ---
@router.websocket("/ws/{user_id}")
@router.websocket("/ws/notifications/{user_id}")
@router.websocket("/api/notifications/ws/{user_id}")
@router.websocket("/api/v1/notifications/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket connection handler for real-time dashboard notifications."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return
    payload = await decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid or expired authentication token")
        return
    token_user_id = str(payload.get("sub", ""))
    if token_user_id and token_user_id != user_id:
        await websocket.close(code=4003, reason="Token subject mismatch")
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # Echo ping message to maintain handshake alive
            data = await websocket.receive_text()
            await websocket.send_json({"status": "ping_ack"})
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)

# --- Notifications History ---
@router.get("/api/notifications", response_model=NotificationHistoryResponse)
@router.get("/api/v1/notifications", response_model=NotificationHistoryResponse)
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = None,
    priority: Optional[str] = None,
    unread_only: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Fetch paginated notification logs list for user."""
    records, total = await NotificationService.get_notifications(
        db, 
        user_id=str(current_user["id"]), 
        limit=limit, 
        page=page, 
        category=category, 
        priority=priority,
        unread_only=unread_only
    )
    pages = (total + limit - 1) // limit if total > 0 else 1
    return {
        "notifications": records,
        "total": total,
        "page": page,
        "pages": pages
    }

@router.get("/api/notifications/unread", response_model=List[NotificationResponse])
@router.get("/api/v1/notifications/unread", response_model=List[NotificationResponse])
async def get_unread_notifications(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Fetch recent unread alerts list."""
    return await NotificationService.get_unread_notifications(
        db, 
        user_id=str(current_user["id"]), 
        limit=limit
    )

# --- Notification Updates (Read / Acknowledge / Delete) ---
@router.post("/api/notifications/{notification_id}/read")
@router.put("/api/notifications/{notification_id}/read")
@router.put("/api/v1/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Mark a notification as read and registers opened/clicked lifecycle actions."""
    success = await NotificationService.mark_as_read(
        db, 
        notification_id=notification_id, 
        user_id=str(current_user["id"])
    )
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found or access denied")
    return {"status": "success", "message": "Notification marked as read"}

@router.post("/api/notifications/read-all")
@router.post("/api/v1/notifications/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Mark all unread notifications of user as read."""
    modified = await NotificationService.mark_all_read(db, user_id=str(current_user["id"]))
    return {"status": "success", "modified_count": modified}

@router.post("/api/notifications/{notification_id}/acknowledge")
@router.post("/api/v1/notifications/{notification_id}/acknowledge")
async def acknowledge_alert(
    notification_id: str,
    payload: NotificationAcknowledge,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Mark warning status as Acknowledged with action response description."""
    success = await NotificationService.acknowledge_notification(
        db,
        notification_id=notification_id,
        user_id=str(current_user["id"]),
        action_taken=payload.acknowledged_action
    )
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found or access denied")
    return {"status": "success", "message": "Notification acknowledged successfully"}

@router.delete("/api/notifications/clear")
@router.delete("/api/v1/notifications/clear")
async def clear_notifications(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete all notification records of current user."""
    deleted = await NotificationService.clear_all_notifications(db, user_id=str(current_user["id"]))
    return {"status": "success", "deleted_count": deleted}

@router.delete("/api/notifications/{notification_id}")
@router.delete("/api/v1/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete an individual notification record."""
    success = await NotificationService.delete_notification(
        db, 
        notification_id=notification_id, 
        user_id=str(current_user["id"])
    )
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found or access denied")
    return {"status": "success", "message": "Notification deleted successfully"}

@router.get("/api/notifications/count")
@router.get("/api/v1/notifications/count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Return actual unread notifications count."""
    count = await NotificationService.get_unread_count(db, user_id=str(current_user["id"]))
    return {"unread_count": count}

# --- Settings / Preferences ---
@router.get("/api/notifications/settings", response_model=NotificationSettingsResponse)
@router.get("/api/v1/notifications/settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get notifications and quiet hours settings preferences for current user."""
    return await NotificationService.get_notification_settings(db, user_id=str(current_user["id"]))

@router.put("/api/notifications/settings")
@router.put("/api/v1/notifications/settings")
async def update_notification_settings(
    payload: NotificationSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update notifications and quiet hours settings preferences."""
    success = await NotificationService.update_notification_settings(
        db,
        user_id=str(current_user["id"]),
        settings=payload.dict(exclude_unset=True)
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save notification settings")
    return {"status": "success", "message": "Notification preferences updated"}

# --- Analytics & Exports ---
@router.get("/api/notifications/analytics")
@router.get("/api/v1/notifications/analytics")
async def get_notifications_analytics(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve category counts, response speed average, and system effectiveness score."""
    return await NotificationService.get_notification_analytics(db, user_id=str(current_user["id"]))

@router.get("/api/notifications/export")
@router.get("/api/v1/notifications/export")
async def export_notifications(
    category: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Export historical logs of the user in CSV format."""
    csv_data = await NotificationService.export_notifications(
        db,
        user_id=str(current_user["id"]),
        category=category,
        priority=priority
    )
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=notifications_export.csv"}
    )

# --- Device Registration & Test Alert triggers ---
@router.post("/api/notifications/register-fcm")
@router.post("/api/v1/notifications/register-fcm")
async def register_fcm_token(
    payload: FCMTokenRegister,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Register user browser device push token."""
    success = await FirebaseService.register_fcm_token(
        db,
        user_id=str(current_user["id"]),
        token=payload.token,
        device_type=payload.device_type
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to register FCM token")
    return {"status": "success", "message": "FCM Token registered"}

@router.post("/api/notifications/test")
@router.post("/api/v1/notifications/test")
async def trigger_test_alert(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Send localized dummy notification test to verified websocket and push clients."""
    # Create soil moisture low mock alert
    telemetry_mock = {"soil_moisture": 18.4, "liters": 5.0}
    
    doc = await NotificationService.create_notification(
        db,
        NotificationCreate(
            user_id=str(current_user["id"]),
            title="Soil Moisture Low",
            message="Soil moisture level is critically low. Recommended irrigation: 5 L/m².",
            category="soil",
            priority="High",
            action_url="/recommendations",
            confidence_score=0.98
        ),
        template_key="soil_moisture_low",
        template_context=telemetry_mock
    )
    return {"status": "success", "message": "Test notification dispatched", "notification": doc}

@router.get("/api/test-trigger-all")
async def test_trigger_all():
    """Unauthenticated trigger to broadcast a test notification to ALL active websocket users."""
    if not ws_manager.active_connections:
        return {"status": "error", "message": "No active websocket connections"}
    
    count = 0
    for uid in list(ws_manager.active_connections.keys()):
        count += 1
        await ws_manager.broadcast_to_user(uid, {
            "type": "new_notification",
            "unread_count": 99,
            "notification": {
                "title": "System Test Alert",
                "message": "This is a live test of the real-time notification popup system.",
                "category": "system",
                "priority": "High",
                "action_url": "/dashboard"
            }
        })
    return {"status": "success", "message": f"Broadcasted to {count} users"}

