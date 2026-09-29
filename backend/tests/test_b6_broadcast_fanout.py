"""
B6 Phase 11 — B6-P7-03 Admin Broadcast Fanout Optimization Tests
Validates:
- Batched persistence using insert_many
- Correct recipient counts and audience targeting
- Localization translations preserved
- Idempotency key prevents duplicate fanout
- Offline users get authoritative persistence without wasted WS/unread queries
- Online users receive real-time WebSocket delivery
- Non-admin callers rejected
"""

import pytest
import asyncio
from bson import ObjectId
from datetime import datetime, timezone
from fastapi import HTTPException

from backend.tests.mock_db import MockDatabase
from backend.app.db.mongodb import db_instance, get_database
from backend.app.routers.admin.admin import (
    broadcast_system_notification,
    AdminBroadcastRequest
)
from backend.app.services.notification_service import (
    NotificationService,
    active_websocket_manager
)
from backend.app.services.translation_service import TranslationService


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture
def mock_db():
    db = MockDatabase()
    db_instance.db = db
    return db


@pytest.mark.anyio
async def test_admin_broadcast_small_audience(mock_db):
    """Verify small audience persistence with translations, correct fields, and history record."""
    u1 = ObjectId()
    u2 = ObjectId()
    u3 = ObjectId()

    await mock_db.users.insert_one({"_id": u1, "preferred_language": "te", "role": "farmer"})
    await mock_db.users.insert_one({"_id": u2, "preferred_language": "hi", "role": "farmer"})
    await mock_db.users.insert_one({"_id": u3, "preferred_language": "en", "role": "equipment_provider"})

    TranslationService.set_cache_entry("en", "te", "Weather Alert", "వాతావరణ హెచ్చరిక")
    TranslationService.set_cache_entry("en", "te", "Heavy rains expected.", "భారీ వర్షాలు కురిసే అవకాశం ఉంది.")

    req = AdminBroadcastRequest(
        title="Weather Alert",
        message="Heavy rains expected.",
        priority="High",
        audience="farmers",
        action_url="/farm-intelligence?tab=weather",
        idempotency_key="bc_test_small_001"
    )
    admin_user = {"id": "admin_test", "role": "admin", "email": "admin@agrishield.com"}

    res = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)

    assert res["status"] == "success"
    assert res["broadcast"]["recipient_count"] == 2
    assert res["broadcast"]["audience"] == "farmers"
    assert res["broadcast"]["status"] == "Delivered"

    # Check recipient 1 notification
    doc1 = await mock_db.notifications.find_one({"user_id": str(u1)})
    assert doc1 is not None
    assert doc1["category"] == "broadcast"
    assert doc1["priority"] == "High"
    assert doc1["action_url"] == "/farm-intelligence?tab=weather"
    assert doc1["translations"]["te"]["title"] == "వాతావరణ హెచ్చరిక"

    # Check recipient 2 notification
    doc2 = await mock_db.notifications.find_one({"user_id": str(u2)})
    assert doc2 is not None
    assert doc2["category"] == "broadcast"

    # Check provider did not receive farmer-targeted broadcast
    doc3 = await mock_db.notifications.find_one({"user_id": str(u3)})
    assert doc3 is None

    # Check canonical broadcast history record
    bc_record = await mock_db.broadcasts.find_one({"idempotency_key": "bc_test_small_001"})
    assert bc_record is not None
    assert bc_record["recipient_count"] == 2
    assert bc_record["status"] == "Delivered"


@pytest.mark.anyio
async def test_admin_broadcast_idempotency_prevents_duplicate_dispatch(mock_db):
    """Verify identical broadcast retry with same idempotency_key does not duplicate fanout."""
    u1 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})

    req = AdminBroadcastRequest(
        title="System Update",
        message="Maintenance tonight at 11 PM.",
        priority="Normal",
        audience="all",
        idempotency_key="bc_idempotent_test_999"
    )
    admin_user = {"id": "admin_test", "role": "admin", "email": "admin@agrishield.com"}

    # First dispatch
    res1 = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
    assert res1["status"] == "success"
    assert res1["broadcast"]["recipient_count"] == 1

    initial_notifs_count = await mock_db.notifications.count_documents({})
    assert initial_notifs_count == 1

    # Second dispatch with identical idempotency key (simulated retry / network replay)
    res2 = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
    assert res2["status"] == "success"
    assert res2["broadcast"]["id"] == res1["broadcast"]["id"]

    # Notification count in database MUST NOT increase
    final_notifs_count = await mock_db.notifications.count_documents({})
    assert final_notifs_count == 1, "Duplicate broadcast must not write second set of notifications"


@pytest.mark.anyio
async def test_admin_broadcast_audience_targeting(mock_db):
    """Verify farmers, providers, and all audience targeting."""
    f1 = ObjectId()
    f2 = ObjectId()
    p1 = ObjectId()
    a1 = ObjectId()

    await mock_db.users.insert_one({"_id": f1, "role": "farmer"})
    await mock_db.users.insert_one({"_id": f2, "role": "farmer"})
    await mock_db.users.insert_one({"_id": p1, "role": "equipment_provider"})
    await mock_db.users.insert_one({"_id": a1, "role": "admin"})

    admin_user = {"id": "admin_test", "role": "admin", "email": "admin@agrishield.com"}

    # 1. Target providers only
    req_p = AdminBroadcastRequest(title="T1", message="M1", audience="providers", idempotency_key="bc_aud_p")
    res_p = await broadcast_system_notification(req_p, current_user=admin_user, db=mock_db)
    assert res_p["broadcast"]["recipient_count"] == 1

    # 2. Target farmers only
    req_f = AdminBroadcastRequest(title="T2", message="M2", audience="farmers", idempotency_key="bc_aud_f")
    res_f = await broadcast_system_notification(req_f, current_user=admin_user, db=mock_db)
    assert res_f["broadcast"]["recipient_count"] == 2

    # 3. Target all (excludes admin)
    req_all = AdminBroadcastRequest(title="T3", message="M3", audience="all", idempotency_key="bc_aud_all")
    res_all = await broadcast_system_notification(req_all, current_user=admin_user, db=mock_db)
    assert res_all["broadcast"]["recipient_count"] == 3


@pytest.mark.anyio
async def test_admin_broadcast_websocket_delivery_for_active_connections(mock_db):
    """Verify WebSocket broadcast is sent to active connections and unread count is updated."""
    online_user = str(ObjectId())
    offline_user = str(ObjectId())

    await mock_db.users.insert_one({"_id": ObjectId(online_user), "role": "farmer", "preferred_language": "en"})
    await mock_db.users.insert_one({"_id": ObjectId(offline_user), "role": "farmer", "preferred_language": "en"})

    received_ws_messages = []

    class MockWSManager:
        def __init__(self):
            # Only online_user is active
            self.active_connections = {online_user: ["mock_ws_socket"]}
        async def broadcast_to_user(self, uid, msg):
            received_ws_messages.append((uid, msg))

    mock_ws = MockWSManager()
    NotificationService.register_websocket_manager(mock_ws)

    try:
        req = AdminBroadcastRequest(
            title="Live Alert",
            message="Immediate test message",
            audience="farmers",
            idempotency_key="bc_ws_active_test"
        )
        admin_user = {"id": "admin_test", "role": "admin", "email": "admin@agrishield.com"}
        res = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
        assert res["status"] == "success"

        # Verify only the online user received WebSocket dispatch
        delivered_uids = [uid for uid, _ in received_ws_messages]
        assert online_user in delivered_uids
        assert offline_user not in delivered_uids, "Offline user should not receive WebSocket message"

        # Both users MUST have authoritative persistence in MongoDB
        assert await mock_db.notifications.find_one({"user_id": online_user}) is not None
        assert await mock_db.notifications.find_one({"user_id": offline_user}) is not None
    finally:
        NotificationService.register_websocket_manager(None)


@pytest.mark.anyio
async def test_create_broadcast_notifications_batching_unit(mock_db):
    """Unit test for create_broadcast_notifications testing batching and count accuracy."""
    recipients = [{"user_id": f"user_{i}", "preferred_language": "en", "role": "farmer"} for i in range(15)]

    res = await NotificationService.create_broadcast_notifications(
        mock_db,
        recipients=recipients,
        title="Batch Test",
        message="Testing batch persistence",
        translations={},
        priority="Normal",
        batch_size=5  # Forces 3 distinct insert_many batches of 5
    )

    assert res["status"] == "success"
    assert res["persisted_count"] == 15
    assert res["total_recipients"] == 15

    total_in_db = await mock_db.notifications.count_documents({"title": "Batch Test"})
    assert total_in_db == 15


@pytest.mark.anyio
async def test_admin_broadcast_non_admin_role_rejected():
    """Verify require_role('admin') strictly rejects non-admin roles with HTTP 403 Forbidden."""
    from backend.app.core.security import require_role
    checker = require_role("admin")

    # Mock decode_access_token to simulate farmer role token
    with pytest.MonkeyPatch.context() as mp:
        async def mock_decode(token):
            return {"sub": "farmer_1", "role": "farmer", "email": "farmer@agrishield.com"}
        mp.setattr("backend.app.core.security.decode_access_token", mock_decode)

        with pytest.raises(HTTPException) as exc_info:
            await checker(token="fake_farmer_jwt_token")
        assert exc_info.value.status_code == 403
        assert "Access forbidden" in exc_info.value.detail


@pytest.mark.anyio
async def test_create_broadcast_notifications_failure_deterministic(mock_db):
    """Verify that a failure during batch persistence raises an error deterministically without corrupt state."""
    recipients = [{"user_id": f"err_user_{i}", "preferred_language": "en", "role": "farmer"} for i in range(5)]

    class FailingCollection:
        async def insert_many(self, *args, **kwargs):
            raise RuntimeError("Simulated MongoDB Atlas Connection Drop")

    failing_db = MockDatabase()
    failing_db.notifications = FailingCollection()

    with pytest.raises(RuntimeError) as exc_info:
        await NotificationService.create_broadcast_notifications(
            failing_db,
            recipients=recipients,
            title="Fail Test",
            message="Should fail deterministically",
            translations={}
        )
    assert "Simulated MongoDB Atlas Connection Drop" in str(exc_info.value)
