import pytest
import asyncio
import json
from datetime import datetime, timezone, timedelta
from jose import jwt
from httpx import ASGITransport, AsyncClient
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from bson import ObjectId
from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.mongodb import get_database, db_instance
from backend.app.routers.notifications import ws_manager
from backend.tests.mock_db import MockDatabase
from backend.app.models.notification import NotificationCreate
from backend.app.services.notification_service import NotificationService

# Setup Mock database configuration
database_for_testing = MockDatabase()
db_instance.db = database_for_testing

async def override_get_database():
    return database_for_testing

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture(autouse=True)
def clean_db():
    app.dependency_overrides[get_database] = override_get_database
    db_instance.db = database_for_testing
    asyncio.run(database_for_testing.users.delete_many({}))
    asyncio.run(database_for_testing.devices.delete_many({}))
    asyncio.run(database_for_testing.telemetry.delete_many({}))
    asyncio.run(database_for_testing.notifications.delete_many({}))
    ws_manager.active_connections.clear()
    yield
    asyncio.run(database_for_testing.users.delete_many({}))
    asyncio.run(database_for_testing.devices.delete_many({}))
    asyncio.run(database_for_testing.telemetry.delete_many({}))
    asyncio.run(database_for_testing.notifications.delete_many({}))
    ws_manager.active_connections.clear()

def generate_valid_jwt(user_id: str, email: str = "test@farm.com", role: str = "farmer"):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def generate_expired_jwt(user_id: str):
    now = datetime.now(timezone.utc) - timedelta(days=2)
    payload = {
        "sub": user_id,
        "email": "expired@farm.com",
        "role": "farmer",
        "type": "access",
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

# Use TestClient for synchronous Starlette WebSocket testing
client = TestClient(app)

def test_1_authentication_valid_jwt():
    """Verify JWT authentication succeeds when connecting to WebSocket."""
    user_id = "test_user_valid_auth"
    token = generate_valid_jwt(user_id)
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
        ws.send_text("ping")
        data = ws.receive_json()
        assert data.get("status") == "ping_ack"
        assert user_id in ws_manager.active_connections
        assert len(ws_manager.active_connections[user_id]) == 1

def test_1_authentication_invalid_jwt():
    """Verify invalid JWT is rejected with code 4001."""
    user_id = "test_user_invalid_auth"
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token=invalid.token.string") as ws:
            pass
    assert exc_info.value.code == 4001

def test_1_authentication_expired_jwt():
    """Verify expired JWT is rejected with code 4001."""
    user_id = "test_user_expired_auth"
    token = generate_expired_jwt(user_id)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
            pass
    assert exc_info.value.code == 4001

def test_1_authentication_logout_closes_socket():
    """Verify logout / clean disconnect removes socket from active connections."""
    user_id = "test_user_logout"
    token = generate_valid_jwt(user_id)
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
        assert user_id in ws_manager.active_connections
    # After context exits (client disconnect/logout), active connections should be cleaned up
    assert user_id not in ws_manager.active_connections

def test_2_connection_ping_pong_and_heartbeat():
    """Verify Ping/Pong heartbeat mechanism and initial connection stability."""
    user_id = "test_user_heartbeat"
    token = generate_valid_jwt(user_id)
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
        # Simulate frontend 25s ping interval
        ws.send_text(json.dumps({"type": "ping", "timestamp": 123456789}))
        response = ws.receive_json()
        assert response["status"] == "ping_ack"

def test_2_connection_multiple_browser_tabs():
    """Verify multiple browser tabs (multiple WebSocket connections for same user) all receive broadcasts."""
    user_id = "test_user_multi_tab"
    token = generate_valid_jwt(user_id)
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}&client=tab1") as ws1:
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}&client=tab2") as ws2:
            assert len(ws_manager.active_connections[user_id]) == 2
            
            # Broadcast message from backend
            test_msg = {"type": "custom_broadcast", "data": "multi_tab_test"}
            asyncio.run(ws_manager.broadcast_to_user(user_id, test_msg))
            
            res1 = ws1.receive_json()
            res2 = ws2.receive_json()
            assert res1["type"] == "custom_broadcast" and res1["data"] == "multi_tab_test"
            assert res2["type"] == "custom_broadcast" and res2["data"] == "multi_tab_test"

def test_3_live_telemetry_broadcast():
    """Verify ESP32 telemetry reaches Backend -> MongoDB -> WebSocket Manager without page refresh."""
    user_id = "60c72b2f9b1d8b5a5f8e2c1a"
    device_id = "ESP32-VALID-01"
    token = generate_valid_jwt(user_id)
    
    asyncio.run(database_for_testing.users.insert_one({
        "_id": ObjectId(user_id),
        "email": "telemetry_user@test.com",
        "preferred_language": "TE"
    }))
    
    # Pre-register device with user_id in mock DB
    asyncio.run(database_for_testing.devices.insert_one({
        "device_id": device_id,
        "user_id": user_id,
        "status": "online"
    }))
    
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
        # Post telemetry to REST ingestion endpoint
        telemetry_payload = {
            "device_id": device_id,
            "temperature": 25.4,
            "humidity": 60.2,
            "soil_moisture": 45.0,
            "light_intensity": 800,
            "battery": 92.0,
            "wifi_rssi": -55
        }
        res = client.post("/api/v1/iot/telemetry", json=telemetry_payload)
        assert res.status_code == 201
        
        # Verify WebSocket received real-time telemetry_update broadcast
        msg1 = ws.receive_json()
        assert msg1["type"] == "telemetry_update"
        assert msg1["device_id"] == device_id
        assert msg1["telemetry"]["temperature"] == 25.4
        
        # Verify WebSocket received real-time device_status_update broadcast
        msg2 = ws.receive_json()
        assert msg2["type"] == "device_status_update"
        assert msg2["device_id"] == device_id
        assert msg2["status"] == "online"

def test_4_notifications_real_time_alert():
    """Trigger a real telemetry alert and verify MongoDB document created and WebSocket broadcast executed."""
    user_id = "60c72b2f9b1d8b5a5f8e2c1b"
    device_id = "ESP32-ALERT-01"
    token = generate_valid_jwt(user_id)
    
    asyncio.run(database_for_testing.users.insert_one({
        "_id": ObjectId(user_id),
        "email": "alert_user@test.com",
        "preferred_language": "TE"
    }))
    
    asyncio.run(database_for_testing.devices.insert_one({
        "device_id": device_id,
        "user_id": user_id,
        "status": "online"
    }))
    
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
        # Trigger an alert via NotificationService
        notif_create = NotificationCreate(
            user_id=user_id,
            title="CRITICAL: Soil Moisture Deficit",
            message="Soil moisture has dropped below 15% on field sector A.",
            category="soil",
            priority="Critical",
            device_id=device_id
        )
        asyncio.run(NotificationService.create_notification(
            db=database_for_testing,
            notification=notif_create
        ))
        
        # Verify WebSocket broadcast received by client immediately
        notif_msg = ws.receive_json()
        assert notif_msg["type"] == "new_notification"
        assert notif_msg["notification"]["title"] == "CRITICAL: Soil Moisture Deficit"
        assert notif_msg["notification"]["priority"] == "Critical"
        assert notif_msg["unread_count"] >= 1
        
        # Verify MongoDB notification was persisted
        doc = asyncio.run(database_for_testing.notifications.find_one({"user_id": user_id}))
        assert doc is not None
        assert doc["title"] == "CRITICAL: Soil Moisture Deficit"

def test_5_device_status_heartbeat_broadcast():
    """Verify device online/offline and battery updates via heartbeat broadcast."""
    user_id = "test_user_status"
    device_id = "ESP32-STATUS-01"
    token = generate_valid_jwt(user_id)
    
    asyncio.run(database_for_testing.devices.insert_one({
        "device_id": device_id,
        "user_id": user_id,
        "status": "offline"
    }))
    
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
        heartbeat_payload = {
            "device_id": device_id,
            "status": "online",
            "uptime_ms": 3600000,
            "wifi_rssi": -62
        }
        res = client.post("/api/v1/iot/heartbeat", json=heartbeat_payload)
        assert res.status_code == 200
        
        status_msg = ws.receive_json()
        assert status_msg["type"] == "device_status_update"
        assert status_msg["device_id"] == device_id
        assert status_msg["status"] == "online"
        assert status_msg["uptime_ms"] == 3600000

def test_7_performance_no_duplicate_listeners_and_memory_leak():
    """Verify WebSocket manager cleans up disconnected sockets to prevent memory leaks and event duplication."""
    user_id = "test_user_perf"
    token = generate_valid_jwt(user_id)
    
    # Connect and disconnect 5 times sequentially
    for i in range(5):
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
            assert len(ws_manager.active_connections[user_id]) == 1
    
    # After all connections closed, map should be completely empty for user_id
    assert user_id not in ws_manager.active_connections

def test_8_error_handling_large_payload_and_invalid_text():
    """Verify backend survives invalid arbitrary payloads and handles large JSON structures without crashing."""
    user_id = "test_user_error_resilience"
    token = generate_valid_jwt(user_id)
    with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}?token={token}") as ws:
        # Send arbitrary non-json text
        ws.send_text("MALFORMED_JSON_STRING_{{{[---")
        res1 = ws.receive_json()
        assert res1["status"] == "ping_ack"
        
        # Send large payload (100KB string)
        large_str = "A" * 100000
        ws.send_text(json.dumps({"type": "ping", "data": large_str}))
        res2 = ws.receive_json()
        assert res2["status"] == "ping_ack"
        
        # Connection should remain alive and functional
        assert user_id in ws_manager.active_connections
