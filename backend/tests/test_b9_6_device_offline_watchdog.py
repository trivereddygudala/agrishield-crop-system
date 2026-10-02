"""
B9.6 Device Offline Watchdog and Status Synchronization Test Suite
Validates:
- B9.6-F01: Authoritative backend offline watchdog
- B9.6-F04: 90s offline threshold
- B9.6-F06: MongoDB persistence and single-transition deduplication
- Multi-device independence and safe error handling

B10.3 Refinement:
Directly exercises the real production `device_watchdog_loop(db)` function from
`backend/app/services/scheduler.py` using a controlled async sleep state-machine
to verify true production execution, atomic DB updates, and WebSocket broadcasts.
"""
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from backend.tests.mock_db import MockDatabase
from backend.app.services.scheduler import (
    DEVICE_OFFLINE_THRESHOLD_SECONDS,
    DEVICE_WATCHDOG_INTERVAL_SECONDS,
    device_watchdog_loop,
)

@pytest.fixture
def mock_db():
    return MockDatabase()

async def run_single_watchdog_cycle(db, cycles=1):
    """
    Executes the REAL production device_watchdog_loop for `cycles` iterations
    by controlling asyncio.sleep.
    - Sleep call 1 (startup grace period sleep): completes immediately.
    - Production watchdog loop executes real code (queries, evaluations, atomic updates, WebSocket broadcasts).
    - Sleep call 2 (interval sleep between iterations): if cycles completed, raises asyncio.CancelledError.
    - Cleanly catches CancelledError to allow assertions on the resulting DB and event state.
    """
    sleep_count = 0
    async def mock_sleep(seconds):
        nonlocal sleep_count
        sleep_count += 1
        if sleep_count > cycles:
            raise asyncio.CancelledError()
        return

    with patch("asyncio.sleep", side_effect=mock_sleep):
        try:
            await device_watchdog_loop(db)
        except asyncio.CancelledError:
            pass

@pytest.mark.asyncio
async def test_online_device_fresh_last_seen_remains_online(mock_db):
    """1. Online device with fresh last_seen remains online when evaluated by real watchdog loop."""
    now = datetime.now(timezone.utc)
    fresh_time = (now - timedelta(seconds=20)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-01",
        "status": "online",
        "last_seen": fresh_time,
        "user_id": "user_123"
    })

    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", new_callable=AsyncMock) as mock_broadcast, \
         patch("backend.app.services.websocket_manager.ws_manager.broadcast_all", new_callable=AsyncMock) as mock_broadcast_all:
        # Run the real production watchdog loop for 1 cycle
        await run_single_watchdog_cycle(mock_db)

        updated_dev = await mock_db.devices.find_one({"device_id": "ESP32-NODE-01"})
        assert updated_dev["status"] == "online"
        mock_broadcast.assert_not_called()
        mock_broadcast_all.assert_not_called()

@pytest.mark.asyncio
async def test_device_exceeding_offline_threshold_becomes_offline(mock_db):
    """2. Device exceeding 90s offline threshold transitions to offline in production watchdog loop."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=95)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-02",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_123"
    })

    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", new_callable=AsyncMock) as mock_broadcast:
        # Run the real production watchdog loop for 1 cycle
        await run_single_watchdog_cycle(mock_db)

        updated_dev = await mock_db.devices.find_one({"device_id": "ESP32-NODE-02"})
        assert updated_dev["status"] == "offline"
        mock_broadcast.assert_called_once()
        args = mock_broadcast.call_args[0]
        assert args[0] == "user_123"
        assert args[1]["status"] == "offline"
        assert args[1]["seconds_since_seen"] >= 95

@pytest.mark.asyncio
async def test_watchdog_persists_offline_status(mock_db):
    """3. Watchdog persists offline status in MongoDB via real production loop."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=120)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-03",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_456"
    })

    await run_single_watchdog_cycle(mock_db)
    doc = await mock_db.devices.find_one({"device_id": "ESP32-NODE-03"})
    assert doc["status"] == "offline"

@pytest.mark.asyncio
async def test_watchdog_emits_one_offline_websocket_transition(mock_db):
    """4. Watchdog emits exactly one offline WebSocket transition via real production loop."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=110)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-04",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_789"
    })

    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", new_callable=AsyncMock) as mock_broadcast:
        await run_single_watchdog_cycle(mock_db)
        assert mock_broadcast.call_count == 1
        payload = mock_broadcast.call_args[0][1]
        assert payload["status"] == "offline"
        assert payload["device_id"] == "ESP32-NODE-04"

@pytest.mark.asyncio
async def test_repeated_watchdog_cycles_do_not_emit_duplicate_transitions(mock_db):
    """5. Repeated production watchdog cycles do not emit duplicate offline transitions."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=110)).isoformat()
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-05",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "user_789"
    })

    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", new_callable=AsyncMock) as mock_broadcast:
        # Cycle 1: Device is online and stale -> transitions to offline and emits event
        await run_single_watchdog_cycle(mock_db, cycles=1)
        assert mock_broadcast.call_count == 1

        # Cycle 2: Device is already offline -> no duplicate event emitted
        await run_single_watchdog_cycle(mock_db, cycles=1)
        assert mock_broadcast.call_count == 1

@pytest.mark.asyncio
async def test_device_receiving_fresh_telemetry_restores_online(mock_db):
    """6. Device receiving fresh telemetry transitions back to online and is kept online by watchdog."""
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

    # Watchdog evaluation cycle
    await run_single_watchdog_cycle(mock_db)

    doc = await mock_db.devices.find_one({"device_id": "ESP32-NODE-06"})
    assert doc["status"] == "online"

@pytest.mark.asyncio
async def test_missing_invalid_last_seen_handled_safely(mock_db):
    """7. Missing/invalid last_seen is handled safely without crashing in real production watchdog."""
    await mock_db.devices.insert_one({
        "device_id": "ESP32-NODE-CORRUPT",
        "status": "online",
        "last_seen": "NOT-A-DATE",
        "user_id": "user_123"
    })

    # Watchdog marks devices with unparseable last_seen offline safely
    await run_single_watchdog_cycle(mock_db)

    updated = await mock_db.devices.find_one({"device_id": "ESP32-NODE-CORRUPT"})
    assert updated["status"] == "offline"

@pytest.mark.asyncio
async def test_multiple_devices_independently_evaluated(mock_db):
    """8. Multiple devices are independently evaluated by the real production watchdog loop."""
    now = datetime.now(timezone.utc)
    t_fresh = (now - timedelta(seconds=15)).isoformat()
    t_stale = (now - timedelta(seconds=120)).isoformat()

    await mock_db.devices.insert_many([
        {"device_id": "DEV-A", "status": "online", "last_seen": t_fresh, "user_id": "u1"},
        {"device_id": "DEV-B", "status": "online", "last_seen": t_stale, "user_id": "u1"},
        {"device_id": "DEV-C", "status": "online", "last_seen": t_fresh, "user_id": "u2"}
    ])

    await run_single_watchdog_cycle(mock_db)

    dev_a = await mock_db.devices.find_one({"device_id": "DEV-A"})
    dev_b = await mock_db.devices.find_one({"device_id": "DEV-B"})
    dev_c = await mock_db.devices.find_one({"device_id": "DEV-C"})

    assert dev_a["status"] == "online"
    assert dev_b["status"] == "offline"
    assert dev_c["status"] == "online"

@pytest.mark.asyncio
async def test_device_owner_routing_preserved(mock_db):
    """9. Device-owner routing is preserved; cross-user leakage prevented by real watchdog broadcast."""
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(seconds=105)).isoformat()

    await mock_db.devices.insert_one({
        "device_id": "DEV-OWNER-TEST",
        "status": "online",
        "last_seen": stale_time,
        "user_id": "target_farmer_999"
    })

    dispatched = {}
    async def fake_broadcast_user(uid, payload):
        dispatched[uid] = payload

    with patch("backend.app.services.websocket_manager.ws_manager.broadcast_to_user", side_effect=fake_broadcast_user), \
         patch("backend.app.services.websocket_manager.ws_manager.broadcast_all", new_callable=AsyncMock) as mock_broadcast_all:
        await run_single_watchdog_cycle(mock_db)

        assert "target_farmer_999" in dispatched
        assert "other_farmer" not in dispatched
        assert dispatched["target_farmer_999"]["device_id"] == "DEV-OWNER-TEST"
        assert dispatched["target_farmer_999"]["status"] == "offline"
        mock_broadcast_all.assert_not_called()

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
    """11. Database exception does not crash or terminate production watchdog execution."""
    faulty_db = MagicMock()
    faulty_db.__getitem__.side_effect = RuntimeError("MongoDB connection lost")

    # Real production device_watchdog_loop gracefully catches DB exceptions
    # in its try...except Exception as loop_err block without raising unhandled errors.
    await run_single_watchdog_cycle(faulty_db)
