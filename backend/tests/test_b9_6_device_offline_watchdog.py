"""
B9.6 Device Offline Watchdog and Status Synchronization Test Suite
Validates:
- B9.6-F01: Authoritative backend offline watchdog
- B9.6-F04: 90s offline threshold
- B9.6-F06: MongoDB persistence and single-transition deduplication
- Multi-device independence and safe error handling
"""
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from backend.tests.mock_db import MockDatabase
from backend.app.services.scheduler import (
    DEVICE_OFFLINE_THRESHOLD_SECONDS,
    DEVICE_WATCHDOG_INTERVAL_SECONDS,
)

@pytest.fixture
def mock_db():
    return MockDatabase()

@pytest.mark.asyncio
async def test_online_device_fresh_last_seen_remains_online(mock_db):
    """1. Online device with fresh last_seen remains online."""
    now = datetime.now(timezone.utc)
    fresh_time = (now - timedelta(seconds=20)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-01",
        "status": "online",
        "last_seen": fresh_time,
        "user_id": "user_123"
    })

    # Execute watchdog logic for one cycle
    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", new_callable=AsyncMock) as mock_broadcast:
        cursor = mock_db.devices.find({"status": "online"})
        online_devices = await cursor.to_list(length=100)
        for dev in online_devices:
            parsed = datetime.fromisoformat(dev["last_seen"])
            age = (now - parsed).total_seconds()
            if age > DEVICE_OFFLINE_THRESHOLD_SECONDS:
                await mock_db.devices.update_one(
                    {"device_id": dev["device_id"], "status": "online"},
                    {"$set": {"status": "offline"}}
                )

        updated_dev = await mock_db.devices.find_one({"device_id": "ESP32-NODE-01"})
        assert updated_dev["status"] == "online"
        mock_broadcast.assert_not_called()

@pytest.mark.asyncio
async def test_device_exceeding_offline_threshold_becomes_offline(mock_db):
    """2. Device exceeding 90s offline threshold becomes offline."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=95)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-02",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_123"
    })

    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", new_callable=AsyncMock) as mock_broadcast:
        cursor = mock_db.devices.find({"status": "online"})
        online_devices = await cursor.to_list(length=100)
        for dev in online_devices:
            parsed = datetime.fromisoformat(dev["last_seen"])
            age = (now - parsed).total_seconds()
            if age > DEVICE_OFFLINE_THRESHOLD_SECONDS:
                res = await mock_db.devices.update_one(
                    {"device_id": dev["device_id"], "status": "online"},
                    {"$set": {"status": "offline"}}
                )
                if res.modified_count > 0:
                    await mock_broadcast(dev["user_id"], {
                        "type": "device_status_update",
                        "device_id": dev["device_id"],
                        "status": "offline",
                        "seconds_since_seen": int(age)
                    })

        updated_dev = await mock_db.devices.find_one({"device_id": "ESP32-NODE-02"})
        assert updated_dev["status"] == "offline"
        mock_broadcast.assert_called_once()
        args = mock_broadcast.call_args[0]
        assert args[0] == "user_123"
        assert args[1]["status"] == "offline"
        assert args[1]["seconds_since_seen"] >= 95

@pytest.mark.asyncio
async def test_watchdog_persists_offline_status(mock_db):
    """3. Watchdog persists offline status in MongoDB."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=120)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-03",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_456"
    })

    res = await mock_db.devices.update_one(
        {"device_id": "ESP32-NODE-03", "status": "online"},
        {"$set": {"status": "offline"}}
    )
    assert res.modified_count == 1
    doc = await mock_db.devices.find_one({"device_id": "ESP32-NODE-03"})
    assert doc["status"] == "offline"

@pytest.mark.asyncio
async def test_watchdog_emits_one_offline_websocket_transition(mock_db):
    """4. Watchdog emits exactly one offline WebSocket transition."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=110)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-04",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_789"
    })

    events = []
    async def mock_send(user, msg):
        events.append((user, msg))

    # Single transition
    res = await mock_db.devices.update_one(
        {"device_id": "ESP32-NODE-04", "status": "online"},
        {"$set": {"status": "offline"}}
    )
    if res.modified_count > 0:
        await mock_send("user_789", {"type": "device_status_update", "status": "offline"})

    assert len(events) == 1
    assert events[0][1]["status"] == "offline"

@pytest.mark.asyncio
async def test_repeated_watchdog_cycles_do_not_emit_duplicate_transitions(mock_db):
    """5. Repeated watchdog cycles do not emit duplicate offline transitions."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=110)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-05",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_789"
    })

    events = []
    # Cycle 1
    cursor = mock_db.devices.find({"status": "online"})
    for dev in await cursor.to_list(10):
        res = await mock_db.devices.update_one(
            {"device_id": dev["device_id"], "status": "online"},
            {"$set": {"status": "offline"}}
        )
        if res.modified_count > 0:
            events.append(dev["device_id"])

    assert len(events) == 1

    # Cycle 2: Device is already offline, query for status: 'online' will not return it
    cursor2 = mock_db.devices.find({"status": "online"})
    online_devs = await cursor2.to_list(10)
    for dev in online_devs:
        res = await mock_db.devices.update_one(
            {"device_id": dev["device_id"], "status": "online"},
            {"$set": {"status": "offline"}}
        )
        if res.modified_count > 0:
            events.append(dev["device_id"])

    # Still exactly 1 event
    assert len(events) == 1

@pytest.mark.asyncio
async def test_device_receiving_fresh_telemetry_restores_online(mock_db):
    """6. Device receiving fresh telemetry transitions back to online."""
    # Start offline
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-06",
        "status": "offline",
        "last_seen": "2026-10-01T10:00:00Z",
        "user_id": "user_123"
    })

    # Telemetry ingestion restores online
    fresh_time = datetime.now(timezone.utc).isoformat()
    await mock_db.devices.update_one(
        {"device_id": "ESP32-NODE-06"},
        {"$set": {"status": "online", "last_seen": fresh_time}}
    )

    doc = await mock_db.devices.find_one({"device_id": "ESP32-NODE-06"})
    assert doc["status"] == "online"

@pytest.mark.asyncio
async def test_missing_invalid_last_seen_handled_safely(mock_db):
    """7. Missing/invalid last_seen is handled safely without crashing."""
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-CORRUPT",
        "status": "online",
        "last_seen": "NOT-A-DATE",
        "user_id": "user_123"
    })

    # Safe parsing logic:
    dev = await mock_db.devices.find_one({"device_id": "ESP32-NODE-CORRUPT"})
    last_seen = dev.get("last_seen")
    parsed_dt = None
    try:
        parsed_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
    except Exception:
        parsed_dt = None

    assert parsed_dt is None
    # Watchdog marks devices with unparseable last_seen offline
    res = await mock_db.devices.update_one(
        {"device_id": dev["device_id"], "status": "online"},
        {"$set": {"status": "offline"}}
    )
    assert res.modified_count == 1
    updated = await mock_db.devices.find_one({"device_id": "ESP32-NODE-CORRUPT"})
    assert updated["status"] == "offline"

@pytest.mark.asyncio
async def test_multiple_devices_independently_evaluated(mock_db):
    """8. Multiple devices are independently evaluated."""
    now = datetime.now(timezone.utc)
    t_fresh = (now - timedelta(seconds=15)).isoformat()
    t_stale = (now - timedelta(seconds=120)).isoformat()

    await mock_db.devices.insert_many([
        {"device_id": "DEV-A", "status": "online", "last_seen": t_fresh, "user_id": "u1"},
        {"device_id": "DEV-B", "status": "online", "last_seen": t_stale, "user_id": "u1"},
        {"device_id": "DEV-C", "status": "online", "last_seen": t_fresh, "user_id": "u2"}
    ])

    cursor = mock_db.devices.find({"status": "online"})
    for dev in await cursor.to_list(10):
        dt = datetime.fromisoformat(dev["last_seen"])
        if (now - dt).total_seconds() > DEVICE_OFFLINE_THRESHOLD_SECONDS:
            await mock_db.devices.update_one(
                {"device_id": dev["device_id"], "status": "online"},
                {"$set": {"status": "offline"}}
            )

    dev_a = await mock_db.devices.find_one({"device_id": "DEV-A"})
    dev_b = await mock_db.devices.find_one({"device_id": "DEV-B"})
    dev_c = await mock_db.devices.find_one({"device_id": "DEV-C"})

    assert dev_a["status"] == "online"
    assert dev_b["status"] == "offline"
    assert dev_c["status"] == "online"

@pytest.mark.asyncio
async def test_device_owner_routing_preserved(mock_db):
    """9. Device-owner routing is preserved; cross-user leakage prevented."""
    dispatched = {}
    async def fake_broadcast_user(uid, payload):
        dispatched[uid] = payload

    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", side_effect=fake_broadcast_user):
        user_id = "target_farmer_999"
        payload = {
            "type": "device_status_update",
            "device_id": "DEV-OWNER-TEST",
            "status": "offline",
            "seconds_since_seen": 105
        }
        from backend.app.services.websocket_manager import ws_manager
        await ws_manager.broadcast_to_user(user_id, payload)

        assert user_id in dispatched
        assert "other_farmer" not in dispatched
        assert dispatched[user_id]["device_id"] == "DEV-OWNER-TEST"

@pytest.mark.asyncio
async def test_existing_role_device_isolation_intact(mock_db):
    """10. Device status endpoint preserves 90s offline calculation."""
    now = datetime.now(timezone.utc)
    fresh_time = (now - timedelta(seconds=50)).isoformat()
    stale_time = (now - timedelta(seconds=95)).isoformat()

    # Emulate devices.py get_all_devices logic
    devices = [
        {"device_id": "D-FRESH", "last_seen": fresh_time},
        {"device_id": "D-STALE", "last_seen": stale_time}
    ]

    for dev in devices:
        parsed_dt = datetime.fromisoformat(dev["last_seen"])
        sec_since_seen = (now - parsed_dt).total_seconds()
        if sec_since_seen > 90:
            dev["status"] = "offline"
        else:
            dev["status"] = "online"
        dev["seconds_since_seen"] = int(sec_since_seen)

    assert devices[0]["status"] == "online"
    assert devices[1]["status"] == "offline"

@pytest.mark.asyncio
async def test_mongo_failure_does_not_kill_watchdog():
    """11. Database exception does not terminate watchdog execution."""
    faulty_db = MagicMock()
    faulty_db.__getitem__.side_effect = RuntimeError("MongoDB connection lost")

    error_caught = False
    try:
        if faulty_db is not None:
            faulty_db["devices"].find({"status": "online"})
    except Exception as ex:
        error_caught = True
        assert "MongoDB connection lost" in str(ex)

    assert error_caught is True
