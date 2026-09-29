import pytest
from httpx import ASGITransport, AsyncClient
from bson import ObjectId

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
import backend.app.routers.provider.equipment as eq_module

mock_db = MockDatabase()
db_instance.db = mock_db

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def reset_test_state():
    db_instance.db = mock_db
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_chat_messages.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._in_memory_chat_threads = {}
    from backend.app.services.sync_service import _in_memory_tombstones
    _in_memory_tombstones.clear()
    yield
    mock_db.users.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_chat_messages.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._in_memory_chat_threads = {}
    _in_memory_tombstones.clear()

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


# ══════════════════════════════════════════════════════════════════════════════
# C-1 TESTS: Public /auth/register Role Enactment (Farmer only)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_c1_registration_forces_farmer_role_ignoring_admin_input():
    """C-1: Anonymous registration requesting role='admin' must be forced to role='farmer'."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/auth/register", json={
            "name": "Attacker Admin",
            "email": "attacker_admin@agrishield.com",
            "password": "Password123!",
            "role": "admin"
        })
        assert res.status_code == 201
        data = res.json()
        assert data["role"] == "farmer"

        # Verify directly in MongoDB
        db_user = await mock_db.users.find_one({"email": "attacker_admin@agrishield.com"})
        assert db_user is not None
        assert db_user["role"] == "farmer"


@pytest.mark.anyio
async def test_c1_registration_forces_farmer_role_ignoring_provider_input():
    """C-1: Anonymous registration requesting role='equipment_provider' must be forced to role='farmer'."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/auth/register", json={
            "name": "Attacker Provider",
            "email": "attacker_prov@agrishield.com",
            "password": "Password123!",
            "role": "equipment_provider"
        })
        assert res.status_code == 201
        assert res.json()["role"] == "farmer"

        db_user = await mock_db.users.find_one({"email": "attacker_prov@agrishield.com"})
        assert db_user is not None
        assert db_user["role"] == "farmer"


# ══════════════════════════════════════════════════════════════════════════════
# C-2 TESTS: Secured /sync/tombstones and /sync/deletions Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_c2_anonymous_tombstone_rejected_with_401():
    """C-2: Anonymous POST to /sync/tombstones and /sync/deletions must be rejected with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r1 = await ac.post("/api/v1/sync/tombstones", json={
            "entity_type": "booking",
            "entity_id": "BK-ANON-1"
        })
        assert r1.status_code == 401

        r2 = await ac.post("/api/v1/sync/deletions", json={
            "entity_type": "equipment",
            "entity_id": "EQ-ANON-1"
        })
        assert r2.status_code == 401


@pytest.mark.anyio
async def test_c2_farmer_cannot_tombstone_other_farmers_booking():
    """C-2: Farmer 2 cannot record a tombstone for Farmer 1's existing booking."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer")
    f2_id, f2_tok = await create_user("Farmer 2", "f2@agri.com", "farmer")

    # Seed Farmer 1's booking
    mock_db.equipment_bookings.records.append({
        "id": "BK-F1-SECURE",
        "userId": f1_id,
        "equipmentId": "EQ-1",
        "status": "pending"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/sync/tombstones", json={
            "entity_type": "booking",
            "entity_id": "BK-F1-SECURE"
        }, headers={"Authorization": f"Bearer {f2_tok}"})
        assert res.status_code == 403
        assert "not authorized" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_c2_legitimate_farmer_and_admin_tombstone_allowed():
    """C-2: Owning farmer and admin can legitimately register tombstones."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer")
    adm_id, adm_tok = await create_user("Admin User", "adm@agri.com", "admin")

    mock_db.equipment_bookings.records.append({
        "id": "BK-F1-LEGIT",
        "userId": f1_id,
        "equipmentId": "EQ-1",
        "status": "pending"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer 1 tombstones their own booking
        r_farmer = await ac.post("/api/v1/sync/tombstones", json={
            "entity_type": "booking",
            "entity_id": "BK-F1-LEGIT"
        }, headers={"Authorization": f"Bearer {f1_tok}"})
        assert r_farmer.status_code == 201

        # Admin can tombstone any item
        r_admin = await ac.post("/api/v1/sync/tombstones", json={
            "entity_type": "booking",
            "entity_id": "BK-ANYTHING"
        }, headers={"Authorization": f"Bearer {adm_tok}"})
        assert r_admin.status_code == 201


@pytest.mark.anyio
async def test_c2_get_tombstones_remains_publicly_accessible():
    """C-2: GET /sync/tombstones remains open for anonymous multi-device cache synchronization."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/sync/tombstones")
        assert res.status_code == 200
        assert "tombstones" in res.json()
        assert "deleted_ids_by_type" in res.json()


# ══════════════════════════════════════════════════════════════════════════════
# C-3 TESTS: Cross-Provider Catalog Overwrite Protection
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_c3_cross_provider_catalog_hijack_rejected_with_403():
    """C-3: Provider 2 cannot overwrite Provider 1's machinery listing."""
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider")
    p2_id, p2_tok = await create_user("Provider 2", "p2@agri.com", "equipment_provider")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Provider 1 lists equipment
        r1 = await ac.post("/api/v1/equipment/catalog", json={
            "id": "EQ-P1-TRACTOR",
            "title": "Provider 1 John Deere Tractor",
            "ratePerHour": 1200
        }, headers={"Authorization": f"Bearer {p1_tok}"})
        assert r1.status_code == 200

        # Provider 2 attempts to overwrite Provider 1's listing
        r2 = await ac.post("/api/v1/equipment/catalog", json={
            "id": "EQ-P1-TRACTOR",
            "title": "Hijacked by Provider 2",
            "ratePerHour": 500
        }, headers={"Authorization": f"Bearer {p2_tok}"})
        assert r2.status_code == 403
        assert "do not own" in r2.json()["detail"].lower()

        # Verify listing in DB remains untouched
        doc = await mock_db.equipment_catalog.find_one({"id": "EQ-P1-TRACTOR"})
        assert doc["providerId"] == p1_id
        assert doc["title"] == "Provider 1 John Deere Tractor"


@pytest.mark.anyio
async def test_c3_owner_and_admin_can_update_equipment():
    """C-3: Owner Provider and Admin can legitimately update equipment listings."""
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider")
    adm_id, adm_tok = await create_user("Admin User", "adm@agri.com", "admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Provider 1 registers
        await ac.post("/api/v1/equipment/catalog", json={
            "id": "EQ-EDITABLE",
            "title": "Initial Title",
            "ratePerHour": 1000
        }, headers={"Authorization": f"Bearer {p1_tok}"})

        # 2. Provider 1 updates their own listing
        r_owner = await ac.post("/api/v1/equipment/catalog", json={
            "id": "EQ-EDITABLE",
            "title": "Updated by Owner",
            "ratePerHour": 1100
        }, headers={"Authorization": f"Bearer {p1_tok}"})
        assert r_owner.status_code == 200

        # 3. Admin updates listing
        r_admin = await ac.post("/api/v1/equipment/catalog", json={
            "id": "EQ-EDITABLE",
            "title": "Moderated by Admin",
            "ratePerHour": 1150
        }, headers={"Authorization": f"Bearer {adm_tok}"})
        assert r_admin.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# C-4 TESTS: Booking ID Hijacking & Overwrite Protection
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_c4_cross_farmer_booking_id_hijack_rejected_in_single_creation():
    """C-4: Farmer 2 cannot hijack or overwrite Farmer 1's booking via POST /bookings."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer")
    f2_id, f2_tok = await create_user("Farmer 2", "f2@agri.com", "farmer")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer 1 creates booking
        r1 = await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-TENANT-X",
            "equipmentId": "EQ-MACH-1",
            "date": "2026-10-10",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})
        assert r1.status_code == 200

        # Farmer 2 attempts to submit new booking with identical ID
        r2 = await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-TENANT-X",
            "equipmentId": "EQ-MACH-2",
            "date": "2026-10-15",
            "slot": "Afternoon (2:00 PM - 6:00 PM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f2_tok}"})
        assert r2.status_code == 409
        assert "already exists" in r2.json()["detail"].lower()

        # Verify DB document still belongs to Farmer 1
        doc = await mock_db.equipment_bookings.find_one({"id": "BK-TENANT-X"})
        assert doc["userId"] == f1_id
        assert doc["equipmentId"] == "EQ-MACH-1"


@pytest.mark.anyio
async def test_c4_confirmed_booking_cannot_be_reverted_via_creation():
    """C-4: Confirmed booking cannot be overwritten or reverted to pending via POST /bookings."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Create booking
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-CONFIRM-TEST",
            "equipmentId": "EQ-MACH-1",
            "date": "2026-10-10",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        # 2. Provider confirms booking
        await ac.patch("/api/v1/equipment/bookings/BK-CONFIRM-TEST/status", json={"status": "confirmed"},
                       headers={"Authorization": f"Bearer {p1_tok}"})

        # 3. Farmer attempts to overwrite confirmed booking via POST
        r_revert = await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-CONFIRM-TEST",
            "equipmentId": "EQ-MACH-1",
            "date": "2026-10-10",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})
        assert r_revert.status_code == 409
        assert "cannot overwrite" in r_revert.json()["detail"].lower()


@pytest.mark.anyio
async def test_c4_batch_creation_cross_farmer_hijack_rejected():
    """C-4: Batch creation rejects overwriting another farmer's booking ID with 409."""
    f1_id, f1_tok = await create_user("Farmer 1", "f1@agri.com", "farmer")
    f2_id, f2_tok = await create_user("Farmer 2", "f2@agri.com", "farmer")
    p1_id, p1_tok = await create_user("Provider 1", "p1@agri.com", "equipment_provider")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer 1 creates booking
        await ac.post("/api/v1/equipment/bookings", json={
            "id": "BK-BATCH-TARGET",
            "equipmentId": "EQ-MACH-1",
            "date": "2026-10-10",
            "slot": "Early Morning (6:00 AM - 10:00 AM)",
            "providerId": p1_id
        }, headers={"Authorization": f"Bearer {f1_tok}"})

        # Farmer 2 attempts batch submission with Farmer 1's ID
        r_batch = await ac.post("/api/v1/equipment/bookings/batch", json=[{
            "id": "BK-BATCH-TARGET",
            "equipmentId": "EQ-MACH-2",
            "date": "2026-10-12",
            "slot": "Afternoon (2:00 PM - 6:00 PM)",
            "status": "pending"
        }], headers={"Authorization": f"Bearer {f2_tok}"})
        assert r_batch.status_code == 409
        assert "already exists" in r_batch.json()["detail"].lower()
