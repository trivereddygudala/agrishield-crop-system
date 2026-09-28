import pytest
import asyncio
from httpx import ASGITransport, AsyncClient
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import zoneinfo

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
import backend.app.routers.provider.equipment as eq_module

mock_db = MockDatabase()
db_instance.db = mock_db
db_instance.client = mock_db.client

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database

IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def reset_test_state():
    db_instance.db = mock_db
    db_instance.client = mock_db.client
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_locks.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    yield
    mock_db.users.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_locks.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []

async def create_user(name: str, email: str, role: str, phone: str = "9876543210"):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "phone": phone,
        "mobile": phone,
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token

@pytest.mark.anyio
async def test_01_anonymous_booking_access():
    """Anonymous access to booking endpoints is rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/equipment/bookings")
        assert res.status_code == 401
        res2 = await ac.patch("/api/v1/equipment/bookings/BK-123/status", json={"status": "confirmed"})
        assert res2.status_code == 401

@pytest.mark.anyio
async def test_02_03_04_tenant_isolation():
    """Farmer, Provider, and Admin tenant scoping."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")
    adm_id, adm_tok = await create_user("Admin User", "adm@agri.com", "admin", "9333333333")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer creates booking
        b_res = await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-TENANT-1",
            "equipmentId": "EQ-T1",
            "date": "2026-10-01",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})
        assert b_res.status_code == 200

        # Farmer sees their booking
        f_get = await ac.get("/api/v1/equipment/bookings", headers={"Authorization": f"Bearer {f1_tok}"})
        assert f_get.status_code == 200
        assert len(f_get.json()["bookings"]) == 1

        # Provider sees booking for their providerId
        p_get = await ac.get("/api/v1/equipment/bookings", headers={"Authorization": f"Bearer {p1_tok}"})
        assert p_get.status_code == 200
        assert len(p_get.json()["bookings"]) == 1

        # Admin sees booking
        a_get = await ac.get("/api/v1/equipment/bookings", headers={"Authorization": f"Bearer {adm_tok}"})
        assert a_get.status_code == 200
        assert len(a_get.json()["bookings"]) == 1

@pytest.mark.anyio
async def test_05_06_07_pending_transitions():
    """pending -> confirmed, pending -> rejected, pending -> cancelled."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create 3 bookings
        for i in [1, 2, 3]:
            await ac.post("/api/v1/equipment/bookings", json={
                "id": f"BK-P-{i}",
                "equipmentId": f"EQ-MACH-{i}",
                "date": f"2026-10-0{i}",
                "slot": "Early Morning (6:00 AM - 10:00 AM)",
                "providerId": p1_id
            }, headers={"Authorization": f"Bearer {f1_tok}"})

        # 1. pending -> confirmed by provider
        r1 = await ac.patch("/api/v1/equipment/bookings/BK-P-1/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert r1.status_code == 200
        assert r1.json()["booking"]["status"] == "confirmed"

        # 2. pending -> rejected by provider
        r2 = await ac.patch("/api/v1/equipment/bookings/BK-P-2/status", json={"status": "rejected"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert r2.status_code == 200
        assert r2.json()["booking"]["status"] == "rejected"

        # 3. pending -> cancelled by farmer
        r3 = await ac.patch("/api/v1/equipment/bookings/BK-P-3/status", json={"status": "cancelled", "reason": "Change of date"},
                            headers={"Authorization": f"Bearer {f1_tok}"})
        assert r3.status_code == 200
        assert r3.json()["booking"]["status"] == "cancelled"

@pytest.mark.anyio
async def test_08_09_confirmed_transitions():
    """confirmed -> completed, confirmed -> cancelled."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for i in [1, 2]:
            await ac.post("/api/v1/equipment/bookings", json={
                "id": f"BK-CONF-{i}",
                "equipmentId": f"EQ-C-{i}",
                "date": f"2026-10-0{i}",
                "slot": "Early Morning (6:00 AM - 10:00 AM)",
                "providerId": p1_id
            }, headers={"Authorization": f"Bearer {f1_tok}"})
            await ac.patch(f"/api/v1/equipment/bookings/BK-CONF-{i}/status", json={"status": "confirmed"},
                           headers={"Authorization": f"Bearer {p1_tok}"})

        # confirmed -> completed by provider
        rc = await ac.patch("/api/v1/equipment/bookings/BK-CONF-1/status", json={"status": "completed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert rc.status_code == 200
        assert rc.json()["booking"]["status"] == "completed"

        # confirmed -> cancelled by farmer
        rx = await ac.patch("/api/v1/equipment/bookings/BK-CONF-2/status", json={"status": "cancelled", "reason": "Weather bad"},
                            headers={"Authorization": f"Bearer {f1_tok}"})
        assert rx.status_code == 200
        assert rx.json()["booking"]["status"] == "cancelled"

@pytest.mark.anyio
async def test_10_11_12_terminal_state_rejection():
    """Terminal states (cancelled, rejected, completed) cannot transition and return 409."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create 3 bookings
        for i in [1, 2, 3]:
            await ac.post("/api/v1/equipment/bookings", json={
                "id": f"BK-TERM-{i}",
                "equipmentId": f"EQ-T-{i}",
                "date": "2026-10-05",
                "slot": "Early Morning (6:00 AM - 10:00 AM)",
                "providerId": p1_id
            }, headers={"Authorization": f"Bearer {f1_tok}"})

        # 10. cancelled -> confirmed blocked
        await ac.patch("/api/v1/equipment/bookings/BK-TERM-1/status", json={"status": "cancelled"},
                       headers={"Authorization": f"Bearer {f1_tok}"})
        res10 = await ac.patch("/api/v1/equipment/bookings/BK-TERM-1/status", json={"status": "confirmed"},
                               headers={"Authorization": f"Bearer {p1_tok}"})
        assert res10.status_code == 409

        # 11. rejected -> confirmed blocked
        await ac.patch("/api/v1/equipment/bookings/BK-TERM-2/status", json={"status": "rejected"},
                       headers={"Authorization": f"Bearer {p1_tok}"})
        res11 = await ac.patch("/api/v1/equipment/bookings/BK-TERM-2/status", json={"status": "confirmed"},
                               headers={"Authorization": f"Bearer {p1_tok}"})
        assert res11.status_code == 409

        # 12. completed -> rejected blocked
        await ac.patch("/api/v1/equipment/bookings/BK-TERM-3/status", json={"status": "confirmed"},
                       headers={"Authorization": f"Bearer {p1_tok}"})
        await ac.patch("/api/v1/equipment/bookings/BK-TERM-3/status", json={"status": "completed"},
                       headers={"Authorization": f"Bearer {p1_tok}"})
        res12 = await ac.patch("/api/v1/equipment/bookings/BK-TERM-3/status", json={"status": "rejected"},
                               headers={"Authorization": f"Bearer {p1_tok}"})
        assert res12.status_code == 409

@pytest.mark.anyio
async def test_13_sequential_overlapping_confirmations():
    """First confirmation succeeds; second overlapping confirmation returns 409."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    f2_id, f2_tok = await create_user("Farmer 2", "f2@agri.com", "farmer", "9111111112")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Both book same equipment for same date/slot
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-OVER-1",
            "equipmentId": "EQ-TRACTOR-1",
            "date": "2026-10-10",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-OVER-2",
            "equipmentId": "EQ-TRACTOR-1",
            "date": "2026-10-10",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f2_tok}"})

        # Confirm first
        r1 = await ac.patch("/api/v1/equipment/bookings/BK-OVER-1/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert r1.status_code == 200

        # Confirm second -> must be 409 Conflict
        r2 = await ac.patch("/api/v1/equipment/bookings/BK-OVER-2/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert r2.status_code == 409
        assert "collision" in r2.json()["detail"].lower()

@pytest.mark.anyio
async def test_14_back_to_back_confirmations():
    """Back-to-back intervals (10:00-12:00 and 12:00-14:00) both succeed without collision."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Booking 1: 10:00 to 12:00
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-B2B-1",
            "equipmentId": "EQ-B2B",
            "date": "2026-10-12",
            "startTime": "10:00",
            "endTime": "12:00",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        # Booking 2: 12:00 to 14:00
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-B2B-2",
            "equipmentId": "EQ-B2B",
            "date": "2026-10-12",
            "startTime": "12:00",
            "endTime": "14:00",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        r1 = await ac.patch("/api/v1/equipment/bookings/BK-B2B-1/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert r1.status_code == 200

        r2 = await ac.patch("/api/v1/equipment/bookings/BK-B2B-2/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert r2.status_code == 200

@pytest.mark.anyio
async def test_15_different_equipment_independence():
    """Same time slot on different equipment IDs succeeds independently."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-DIFF-1",
            "equipmentId": "EQ-DIFF-A",
            "date": "2026-10-15",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-DIFF-2",
            "equipmentId": "EQ-DIFF-B",
            "date": "2026-10-15",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        r1 = await ac.patch("/api/v1/equipment/bookings/BK-DIFF-1/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        r2 = await ac.patch("/api/v1/equipment/bookings/BK-DIFF-2/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}"})
        assert r1.status_code == 200
        assert r2.status_code == 200

@pytest.mark.anyio
async def test_16_simultaneous_overlapping_confirmations():
    """
    CRITICAL ACCEPTANCE TEST:
    Two concurrent confirmations for overlapping intervals (10:00-14:00 and 12:00-16:00) on same equipment.
    FINAL DB STATE must have EXACTLY ONE confirmed, EXACTLY ONE pending, NEVER both confirmed.
    """
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    f2_id, f2_tok = await create_user("Farmer 2", "f2@agri.com", "farmer", "9111111112")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Booking A: 10:00 - 14:00
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-RACE-A",
            "equipmentId": "EQ-RACE-1",
            "date": "2026-10-20",
            "startTime": "10:00",
            "endTime": "14:00",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        # Booking B: 12:00 - 16:00
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-RACE-B",
            "equipmentId": "EQ-RACE-1",
            "date": "2026-10-20",
            "startTime": "12:00",
            "endTime": "16:00",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f2_tok}"})

        async def confirm_a():
            return await ac.patch("/api/v1/equipment/bookings/BK-RACE-A/status", json={"status": "confirmed"},
                                  headers={"Authorization": f"Bearer {p1_tok}"})

        async def confirm_b():
            return await ac.patch("/api/v1/equipment/bookings/BK-RACE-B/status", json={"status": "confirmed"},
                                  headers={"Authorization": f"Bearer {p1_tok}"})

        res_a, res_b = await asyncio.gather(confirm_a(), confirm_b())

        # HTTP responses: One must succeed (200), one must be rejected (409)
        statuses = {res_a.status_code, res_b.status_code}
        assert statuses == {200, 409}

        # FINAL DATABASE STATE PROOF
        doc_a = await mock_db.equipment_bookings.find_one({"id": "BK-RACE-A"})
        doc_b = await mock_db.equipment_bookings.find_one({"id": "BK-RACE-B"})

        db_statuses = [doc_a["status"], doc_b["status"]]
        assert db_statuses.count("confirmed") == 1
        assert db_statuses.count("pending") == 1
        assert "confirmed" in db_statuses
        assert "pending" in db_statuses

@pytest.mark.anyio
async def test_17_simultaneous_back_to_back_confirmations():
    """Simultaneous confirmation of back-to-back bookings both succeed in DB."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-SIM-B2B-1",
            "equipmentId": "EQ-SIM-B2B",
            "date": "2026-10-22",
            "startTime": "10:00",
            "endTime": "12:00",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-SIM-B2B-2",
            "equipmentId": "EQ-SIM-B2B",
            "date": "2026-10-22",
            "startTime": "12:00",
            "endTime": "14:00",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        async def confirm_1():
            return await ac.patch("/api/v1/equipment/bookings/BK-SIM-B2B-1/status", json={"status": "confirmed"},
                                  headers={"Authorization": f"Bearer {p1_tok}"})

        async def confirm_2():
            return await ac.patch("/api/v1/equipment/bookings/BK-SIM-B2B-2/status", json={"status": "confirmed"},
                                  headers={"Authorization": f"Bearer {p1_tok}"})

        r1, r2 = await asyncio.gather(confirm_1(), confirm_2())
        assert r1.status_code == 200
        assert r2.status_code == 200

        doc1 = await mock_db.equipment_bookings.find_one({"id": "BK-SIM-B2B-1"})
        doc2 = await mock_db.equipment_bookings.find_one({"id": "BK-SIM-B2B-2"})
        assert doc1["status"] == "confirmed"
        assert doc2["status"] == "confirmed"

@pytest.mark.anyio
async def test_18_cancellation_releases_interval():
    """Cancelling a confirmed booking releases the interval so another request can confirm."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    f2_id, f2_tok = await create_user("Farmer 2", "f2@agri.com", "farmer", "9111111112")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-REL-1",
            "equipmentId": "EQ-RELEASE-1",
            "date": "2026-10-25",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-REL-2",
            "equipmentId": "EQ-RELEASE-1",
            "date": "2026-10-25",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f2_tok}"})

        # 1. Confirm first
        await ac.patch("/api/v1/equipment/bookings/BK-REL-1/status", json={"status": "confirmed"},
                       headers={"Authorization": f"Bearer {p1_tok}"})

        # 2. Second confirmation collides
        r2_fail = await ac.patch("/api/v1/equipment/bookings/BK-REL-2/status", json={"status": "confirmed"},
                                 headers={"Authorization": f"Bearer {p1_tok}"})
        assert r2_fail.status_code == 409

        # 3. Farmer 1 cancels
        await ac.patch("/api/v1/equipment/bookings/BK-REL-1/status", json={"status": "cancelled", "reason": "Change plans"},
                       headers={"Authorization": f"Bearer {f1_tok}"})

        # 4. Now second confirmation succeeds
        r2_success = await ac.patch("/api/v1/equipment/bookings/BK-REL-2/status", json={"status": "confirmed"},
                                    headers={"Authorization": f"Bearer {p1_tok}"})
        assert r2_success.status_code == 200
        assert r2_success.json()["booking"]["status"] == "confirmed"

@pytest.mark.anyio
async def test_19_20_21_idempotency_mechanisms():
    """Duplicate submissions, double clicks with Idempotency-Key, and lost response replays."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-IDEMP-1",
            "equipmentId": "EQ-IDEMP",
            "date": "2026-10-28",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        key = "idemp_test_key_abc_123"

        # Call 1 with key
        r1 = await ac.patch("/api/v1/equipment/bookings/BK-IDEMP-1/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}", "Idempotency-Key": key})
        assert r1.status_code == 200

        # Call 2 with identical key -> returns cached 200 response
        r2 = await ac.patch("/api/v1/equipment/bookings/BK-IDEMP-1/status", json={"status": "confirmed"},
                            headers={"Authorization": f"Bearer {p1_tok}", "Idempotency-Key": key})
        assert r2.status_code == 200
        assert r2.json()["booking"]["id"] == "BK-IDEMP-1"

        # Reusing same key for different booking returns 422 Unprocessable Entity
        r_diff = await ac.patch("/api/v1/equipment/bookings/BK-DIFF/status", json={"status": "confirmed"},
                                headers={"Authorization": f"Bearer {p1_tok}", "Idempotency-Key": key})
        assert r_diff.status_code == 422

@pytest.mark.anyio
async def test_22_23_retry_exhaustion_503():
    """Simulated persistent WriteConflict / transient error yields 503 Service Unavailable."""
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    # Inject mock session with persistent TransientTransactionError
    from pymongo.errors import OperationFailure

    class FailingSession:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        def start_transaction(self):
            class Tx:
                async def __aenter__(self_tx):
                    raise OperationFailure("WriteConflict simulated", code=112)
                async def __aexit__(self_tx, exc_type, exc_val, exc_tb):
                    pass
            return Tx()
    async def failing_start_session():
        return FailingSession()

    orig_start_session = mock_db._client.start_session
    mock_db._client.start_session = failing_start_session
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Create a pending booking
            mock_db.equipment_bookings.records.append({
                "id": "BK-FAIL-1",
                "equipmentId": "EQ-FAIL",
                "status": "pending",
                "date": "2026-10-30",
                "slot": "Early Morning (6:00 AM - 10:00 AM)",
                "providerId": p1_id
            })

            res = await ac.patch("/api/v1/equipment/bookings/BK-FAIL-1/status", json={"status": "confirmed"},
                                 headers={"Authorization": f"Bearer {p1_tok}"})
            assert res.status_code == 503
            assert "Retry-After" in res.headers
    finally:
        mock_db._client.start_session = orig_start_session

@pytest.mark.anyio
async def test_24_confirmation_vs_cancellation_race():
    """Cancellation on a confirmed booking cleanly releases; double operation resolves without corrupting state."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-RACE-CANCEL",
            "equipmentId": "EQ-RC",
            "date": "2026-11-01",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        # First confirm
        r_conf = await ac.patch("/api/v1/equipment/bookings/BK-RACE-CANCEL/status", json={"status": "confirmed"},
                                headers={"Authorization": f"Bearer {p1_tok}"})
        assert r_conf.status_code == 200

        # Then cancel
        r_canc = await ac.patch("/api/v1/equipment/bookings/BK-RACE-CANCEL/status", json={"status": "cancelled", "reason": "Tractor damaged"},
                                headers={"Authorization": f"Bearer {p1_tok}"})
        assert r_canc.status_code == 200

        # Attempt to confirm cancelled booking -> 409
        r_reconf = await ac.patch("/api/v1/equipment/bookings/BK-RACE-CANCEL/status", json={"status": "confirmed"},
                                  headers={"Authorization": f"Bearer {p1_tok}"})
        assert r_reconf.status_code == 409

@pytest.mark.anyio
async def test_25_legacy_slot_parsing():
    """Legacy slot strings are properly normalized into canonical UTC datetimes."""
    from backend.app.routers.provider.equipment import _normalize_booking_interval

    # 1. Early Morning: 06:00 - 10:00 IST -> 00:30 - 04:30 UTC
    s1, e1 = _normalize_booking_interval({"date": "2026-09-26", "slot": "Early Morning (6:00 AM - 10:00 AM)"})
    assert s1.hour == 0 and s1.minute == 30
    assert e1.hour == 4 and e1.minute == 30

    # 2. Afternoon: 14:00 - 18:00 IST -> 08:30 - 12:30 UTC
    s2, e2 = _normalize_booking_interval({"date": "2026-09-26", "slot": "Afternoon (2:00 PM - 6:00 PM)"})
    assert s2.hour == 8 and s2.minute == 30
    assert e2.hour == 12 and e2.minute == 30

    # 3. Full Day: 08:00 - 17:00 IST -> 02:30 - 11:30 UTC
    s3, e3 = _normalize_booking_interval({"date": "2026-09-26", "slot": "Full Day (8:00 AM - 5:00 PM)"})
    assert s3.hour == 2 and s3.minute == 30
    assert e3.hour == 11 and e3.minute == 30

    # 4. Active bookings cannot be physically deleted
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer", "9111111111")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider", "9222222222")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-NODELETE",
            "equipmentId": "EQ-ND",
            "date": "2026-11-05",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})
        await ac.patch("/api/v1/equipment/bookings/BK-NODELETE/status", json={"status": "confirmed"},
                       headers={"Authorization": f"Bearer {p1_tok}"})

        # DELETE on confirmed must fail with 400
        del_res = await ac.delete("/api/v1/equipment/bookings/BK-NODELETE", headers={"Authorization": f"Bearer {p1_tok}"})
        assert del_res.status_code == 400
        assert "cannot be physically deleted" in del_res.json()["detail"].lower()
