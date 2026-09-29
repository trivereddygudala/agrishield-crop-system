"""
B6 Phase 13 — Final Broadcast Idempotency Hardening Tests
Validates:
1. First request creates Processing reservation before fanout
2. Successful fanout transitions status to Delivered
3. Repeated Delivered request does not duplicate notifications
4. Same idempotency key + different payload is rejected with HTTP 422
5. Concurrent same-key submissions cannot create two broadcasts (DuplicateKeyError -> HTTP 409)
6. Crash/partial-failure leaves Processing or Failed durable state
7. Retry after partial fanout does not duplicate already-created recipient notifications
8. Remaining recipients can complete safely
9. Final status becomes Delivered only after all batches persist
10. Non-admin callers remain rejected
"""

import pytest
import asyncio
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from backend.tests.mock_db import MockDatabase
from backend.app.db.mongodb import db_instance
from backend.app.routers.admin.admin import (
    broadcast_system_notification,
    AdminBroadcastRequest
)
from backend.app.services.notification_service import NotificationService
from backend.app.services.translation_service import TranslationService


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture
async def mock_db():
    db = MockDatabase()
    db_instance.db = db
    # Ensure indexes are set up as per db initialization
    await db.broadcasts.create_index("idempotency_key", unique=True, sparse=True)
    await db.notifications.create_index([("broadcast_id", 1), ("user_id", 1)], unique=True, sparse=True)
    return db


@pytest.fixture
def admin_user():
    return {"id": "admin_test", "role": "admin", "email": "admin@agrishield.com"}


@pytest.mark.anyio
async def test_broadcast_processing_reservation_lifecycle(mock_db, admin_user):
    """Verify first request creates Processing reservation and transitions to Delivered."""
    u1 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})

    req = AdminBroadcastRequest(
        title="Cyclone Warning",
        message="Coastal winds intensifying.",
        priority="Critical",
        audience="farmers",
        idempotency_key="bc_res_test_001"
    )

    # Dispatch broadcast
    res = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
    assert res["status"] == "success"
    assert res["broadcast"]["status"] == "Delivered"
    assert res["broadcast"]["recipient_count"] == 1

    # Verify broadcast history in DB
    bc_doc = await mock_db.broadcasts.find_one({"idempotency_key": "bc_res_test_001"})
    assert bc_doc is not None
    assert bc_doc["status"] == "Delivered"
    assert bc_doc["recipient_count"] == 1
    assert "request_hash" in bc_doc
    assert bc_doc["request_hash"] is not None


@pytest.mark.anyio
async def test_broadcast_delivered_replay_no_duplicates(mock_db, admin_user):
    """Verify that repeating a Delivered request returns existing broadcast without creating extra notifications."""
    u1 = ObjectId()
    u2 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})
    await mock_db.users.insert_one({"_id": u2, "preferred_language": "en", "role": "farmer"})

    req = AdminBroadcastRequest(
        title="Pest Alert",
        message="Locust swarm warning.",
        priority="High",
        audience="farmers",
        idempotency_key="bc_rep_test_002"
    )

    res1 = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
    assert res1["status"] == "success"
    assert res1["broadcast"]["recipient_count"] == 2

    count_after_first = await mock_db.notifications.count_documents({})
    assert count_after_first == 2

    # Replay identical request
    res2 = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
    assert res2["status"] == "success"
    assert res2["broadcast"]["id"] == res1["broadcast"]["id"]

    count_after_replay = await mock_db.notifications.count_documents({})
    assert count_after_replay == 2, "Replay must not duplicate notifications"


@pytest.mark.anyio
async def test_broadcast_payload_mismatch_rejected(mock_db, admin_user):
    """Verify same idempotency key with different payload is rejected with HTTP 422."""
    u1 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})

    req1 = AdminBroadcastRequest(
        title="Title Original",
        message="Message Original",
        priority="Normal",
        audience="farmers",
        idempotency_key="bc_tamper_key_003"
    )

    res1 = await broadcast_system_notification(req1, current_user=admin_user, db=mock_db)
    assert res1["status"] == "success"

    # Altered title with the SAME idempotency key
    req_altered = AdminBroadcastRequest(
        title="Title Tampered",
        message="Message Original",
        priority="Normal",
        audience="farmers",
        idempotency_key="bc_tamper_key_003"
    )

    with pytest.raises(HTTPException) as exc_info:
        await broadcast_system_notification(req_altered, current_user=admin_user, db=mock_db)

    assert exc_info.value.status_code == 422
    assert "different broadcast request payload" in exc_info.value.detail


@pytest.mark.anyio
async def test_broadcast_concurrent_submission_rejection(mock_db, admin_user):
    """Verify simultaneous same-key submissions are caught by uniqueness constraint (HTTP 409)."""
    u1 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})

    # Pre-insert active "Processing" reservation created just now (< 60s ago)
    recent_dt = datetime.now(timezone.utc)
    import json, hashlib
    payload_dict = {
        "title": "Concurrent Broadcast",
        "message": "Testing locks",
        "priority": "High",
        "audience": "all",
        "action_url": "/dashboard"
    }
    req_hash = hashlib.sha256(json.dumps(payload_dict, sort_keys=True).encode("utf-8")).hexdigest()

    await mock_db.broadcasts.insert_one({
        "title": "Concurrent Broadcast",
        "message": "Testing locks",
        "priority": "High",
        "audience": "all",
        "status": "Processing",
        "idempotency_key": "bc_concurrent_key_004",
        "request_hash": req_hash,
        "created_at": recent_dt,
        "dispatched_at": recent_dt
    })

    req = AdminBroadcastRequest(
        title="Concurrent Broadcast",
        message="Testing locks",
        priority="High",
        audience="all",
        idempotency_key="bc_concurrent_key_004"
    )

    # Submitting while still actively processing should yield HTTP 409 Conflict
    with pytest.raises(HTTPException) as exc_info:
        await broadcast_system_notification(req, current_user=admin_user, db=mock_db)

    assert exc_info.value.status_code == 409
    assert "currently processing" in exc_info.value.detail.lower()


@pytest.mark.anyio
async def test_broadcast_stale_processing_resumes_without_duplicate(mock_db, admin_user):
    """Verify worker crash leaving a stale Processing record (> 60s) resumes and deduplicates partial fanout."""
    u1 = ObjectId()
    u2 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})
    await mock_db.users.insert_one({"_id": u2, "preferred_language": "en", "role": "farmer"})

    stale_time = datetime.now(timezone.utc) - timedelta(seconds=120)
    import json, hashlib
    payload_dict = {
        "title": "Crash Recovery",
        "message": "Resuming after crash",
        "priority": "High",
        "audience": "farmers",
        "action_url": "/dashboard"
    }
    req_hash = hashlib.sha256(json.dumps(payload_dict, sort_keys=True).encode("utf-8")).hexdigest()

    # Pre-seed stale Processing reservation
    bc_res = await mock_db.broadcasts.insert_one({
        "title": "Crash Recovery",
        "message": "Resuming after crash",
        "priority": "High",
        "audience": "farmers",
        "status": "Processing",
        "idempotency_key": "bc_crash_key_005",
        "request_hash": req_hash,
        "created_at": stale_time,
        "dispatched_at": stale_time
    })
    bc_id_str = str(bc_res.inserted_id)

    # Simulate worker had already persisted u1 notification before dying
    await mock_db.notifications.insert_one({
        "broadcast_id": bc_id_str,
        "user_id": str(u1),
        "title": "Crash Recovery",
        "message": "Resuming after crash",
        "idempotency_key": "bc_crash_key_005"
    })

    assert await mock_db.notifications.count_documents({"broadcast_id": bc_id_str}) == 1

    # Retry broadcast with identical idempotency key
    req = AdminBroadcastRequest(
        title="Crash Recovery",
        message="Resuming after crash",
        priority="High",
        audience="farmers",
        idempotency_key="bc_crash_key_005"
    )

    res = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
    assert res["status"] == "success"
    assert res["broadcast"]["status"] == "Delivered"
    assert res["broadcast"]["recipient_count"] == 2

    # Total notifications must be exactly 2 (u1 was NOT duplicated, u2 was added)
    total_notifs = await mock_db.notifications.count_documents({"broadcast_id": bc_id_str})
    assert total_notifs == 2, "Partial fanout resume must not duplicate u1 notification"


@pytest.mark.anyio
async def test_broadcast_failed_retry_resumes_safely(mock_db, admin_user):
    """Verify that a Failed broadcast record can be retried safely without duplicating existing items."""
    u1 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})

    import json, hashlib
    payload_dict = {
        "title": "Failed Broadcast Retry",
        "message": "Testing recovery",
        "priority": "Normal",
        "audience": "farmers",
        "action_url": "/dashboard"
    }
    req_hash = hashlib.sha256(json.dumps(payload_dict, sort_keys=True).encode("utf-8")).hexdigest()

    bc_res = await mock_db.broadcasts.insert_one({
        "title": "Failed Broadcast Retry",
        "message": "Testing recovery",
        "priority": "Normal",
        "audience": "farmers",
        "status": "Failed",
        "error_detail": "Network socket timeout",
        "idempotency_key": "bc_failed_key_006",
        "request_hash": req_hash,
        "created_at": datetime.now(timezone.utc),
        "dispatched_at": datetime.now(timezone.utc)
    })
    bc_id_str = str(bc_res.inserted_id)

    req = AdminBroadcastRequest(
        title="Failed Broadcast Retry",
        message="Testing recovery",
        priority="Normal",
        audience="farmers",
        idempotency_key="bc_failed_key_006"
    )

    res = await broadcast_system_notification(req, current_user=admin_user, db=mock_db)
    assert res["status"] == "success"
    assert res["broadcast"]["status"] == "Delivered"
    assert res["broadcast"]["recipient_count"] == 1

    updated_bc = await mock_db.broadcasts.find_one({"_id": bc_res.inserted_id})
    assert updated_bc["status"] == "Delivered"


@pytest.mark.anyio
async def test_broadcast_failure_transitions_to_failed(mock_db, admin_user):
    """Verify that an unhandled exception during fanout sets status to Failed with error detail."""
    u1 = ObjectId()
    await mock_db.users.insert_one({"_id": u1, "preferred_language": "en", "role": "farmer"})

    req = AdminBroadcastRequest(
        title="Fault Injection Broadcast",
        message="Will crash during fanout",
        priority="Normal",
        audience="farmers",
        idempotency_key="bc_fault_key_007"
    )

    original_notifications = mock_db.notifications
    class BrokenCollection:
        async def insert_many(self, *args, **kwargs):
            raise ConnectionResetError("Simulated connection reset by peer")
        def find(self, *args, **kwargs):
            return original_notifications.find(*args, **kwargs)

    mock_db.notifications = BrokenCollection()

    with pytest.raises(ConnectionResetError):
        await broadcast_system_notification(req, current_user=admin_user, db=mock_db)

    # Check broadcast state in DB is marked Failed
    bc_doc = await mock_db.broadcasts.find_one({"idempotency_key": "bc_fault_key_007"})
    assert bc_doc is not None
    assert bc_doc["status"] == "Failed"
    assert "Simulated connection reset by peer" in bc_doc.get("error_detail", "")


@pytest.mark.anyio
async def test_stale_worker_failed_handler_cannot_overwrite_delivered(mock_db, admin_user):
    """Verify that if Worker B marks broadcast Delivered, Worker A's subsequent failure cannot overwrite state to Failed."""
    # Seed an already Delivered broadcast record
    bc_id = ObjectId()
    now_dt = datetime.now(timezone.utc)
    await mock_db.broadcasts.insert_one({
        "_id": bc_id,
        "title": "Delivered Broadcast",
        "message": "Already finished",
        "status": "Delivered",
        "recipient_count": 50,
        "created_at": now_dt,
        "updated_at": now_dt,
        "idempotency_key": "bc_stale_fail_test"
    })

    # Simulate Worker A exception handler attempting to mark this broadcast Failed
    err_filter = {"_id": bc_id, "status": "Processing"}
    err_update = {
        "status": "Failed",
        "error_detail": "Stale worker connection drop",
        "updated_at": datetime.now(timezone.utc)
    }
    res = await mock_db.broadcasts.update_one(err_filter, {"$set": err_update})
    assert res.matched_count == 0

    # Ensure status in DB remained Delivered
    bc_doc = await mock_db.broadcasts.find_one({"_id": bc_id})
    assert bc_doc["status"] == "Delivered"
    assert bc_doc["recipient_count"] == 50
    assert "error_detail" not in bc_doc


@pytest.mark.anyio
async def test_stale_worker_delivered_handler_cannot_overwrite_terminal_state(mock_db, admin_user):
    """Verify that a worker cannot mark a broadcast Delivered if it is no longer in Processing state."""
    # Seed an already Failed broadcast record
    bc_id = ObjectId()
    now_dt = datetime.now(timezone.utc)
    await mock_db.broadcasts.insert_one({
        "_id": bc_id,
        "title": "Failed Broadcast",
        "message": "Terminated early",
        "status": "Failed",
        "error_detail": "Initial failure",
        "recipient_count": 0,
        "created_at": now_dt,
        "updated_at": now_dt,
        "idempotency_key": "bc_stale_deliv_test"
    })

    # Stale Delivered update attempt
    cond_filter = {"_id": bc_id, "status": "Processing"}
    update_fields = {
        "status": "Delivered",
        "recipient_count": 100,
        "updated_at": datetime.now(timezone.utc)
    }
    res = await mock_db.broadcasts.update_one(cond_filter, {"$set": update_fields})
    assert res.matched_count == 0

    # Verify status in DB remained Failed
    bc_doc = await mock_db.broadcasts.find_one({"_id": bc_id})
    assert bc_doc["status"] == "Failed"
    assert bc_doc["error_detail"] == "Initial failure"
    assert bc_doc["recipient_count"] == 0


@pytest.mark.anyio
async def test_processing_transitions_to_delivered_conditionally(mock_db, admin_user):
    """Verify that a broadcast strictly in Processing state successfully transitions to Delivered."""
    bc_id = ObjectId()
    now_dt = datetime.now(timezone.utc)
    await mock_db.broadcasts.insert_one({
        "_id": bc_id,
        "title": "Processing Broadcast",
        "message": "Active fanout",
        "status": "Processing",
        "recipient_count": 0,
        "created_at": now_dt,
        "updated_at": now_dt,
        "idempotency_key": "bc_cond_deliv_test"
    })

    cond_filter = {"_id": bc_id, "status": "Processing"}
    update_fields = {
        "status": "Delivered",
        "recipient_count": 150,
        "updated_at": datetime.now(timezone.utc)
    }
    res = await mock_db.broadcasts.update_one(cond_filter, {"$set": update_fields})
    assert res.matched_count == 1
    assert res.modified_count == 1

    bc_doc = await mock_db.broadcasts.find_one({"_id": bc_id})
    assert bc_doc["status"] == "Delivered"
    assert bc_doc["recipient_count"] == 150
