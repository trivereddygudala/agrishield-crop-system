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
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._in_memory_chat_threads = {}
    from backend.app.services.sync_service import _in_memory_tombstones
    test_keys = [k for k in list(_in_memory_tombstones.keys()) if "test" in k.lower() or "bk-" in k.lower() or "eq-" in k.lower()]
    for k in test_keys:
        _in_memory_tombstones.pop(k, None)
    yield
    mock_db.users.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_chat_messages.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._in_memory_chat_threads = {}
    for k in test_keys:
        _in_memory_tombstones.pop(k, None)

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

def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}

# ============================================================================
# 1. ANONYMOUS ACCESS REJECTION (HTTP 401)
# ============================================================================

@pytest.mark.anyio
async def test_anonymous_access_denied_on_booking_endpoints():
    """Verify that all booking CRUD endpoints deny anonymous requests with HTTP 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # GET /bookings
        r1 = await ac.get("/api/v1/equipment/bookings")
        assert r1.status_code == 401

        # POST /bookings
        r2 = await ac.post("/api/v1/equipment/bookings", json={"equipmentName": "Tractor", "acres": 2})
        assert r2.status_code == 401

        # POST /bookings/batch
        r3 = await ac.post("/api/v1/equipment/bookings/batch", json=[{"equipmentName": "Tractor"}])
        assert r3.status_code == 401

        # PATCH /bookings/{id}/status
        r4 = await ac.patch("/api/v1/equipment/bookings/BK-TEST-1/status", json={"status": "cancelled"})
        assert r4.status_code == 401

        # DELETE /bookings/{id}
        r5 = await ac.delete("/api/v1/equipment/bookings/BK-TEST-1")
        assert r5.status_code == 401

        # POST /catalog
        r6 = await ac.post("/api/v1/equipment/catalog", json={"name": "Harvester"})
        assert r6.status_code == 401

        # DELETE /catalog/{id}
        r7 = await ac.delete("/api/v1/equipment/catalog/EQ-TEST-1")
        assert r7.status_code == 401

        # PATCH /fleet/{id}/availability
        r8 = await ac.patch("/api/v1/equipment/fleet/EQ-TEST-1/availability", json={"available": False})
        assert r8.status_code == 401

        # GET /bookings/{id}/messages
        r9 = await ac.get("/api/v1/equipment/bookings/BK-TEST-1/messages")
        assert r9.status_code == 401

        # POST /bookings/{id}/messages
        r10 = await ac.post("/api/v1/equipment/bookings/BK-TEST-1/messages", json={"text": "Hello"})
        assert r10.status_code == 401

# ============================================================================
# 2. PUBLIC DISCOVERY ENDPOINTS (HTTP 200 for Anonymous)
# ============================================================================

@pytest.mark.anyio
async def test_public_catalog_discovery_endpoints_allowed_anonymously():
    """Verify that catalog viewing and fleet availability status remain public read-only."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r_cat = await ac.get("/api/v1/equipment/catalog")
        assert r_cat.status_code == 200
        assert r_cat.json().get("success") is True

        r_fleet = await ac.get("/api/v1/equipment/fleet/status")
        assert r_fleet.status_code == 200
        assert r_fleet.json().get("success") is True

# ============================================================================
# 3. FARMER RBAC & TENANT ISOLATION
# ============================================================================

@pytest.mark.anyio
async def test_farmer_booking_creation_and_tenant_isolation():
    """Verify Farmer creates bookings stamped with their identity and cannot access other farmers' bookings."""
    farmer1_id, farmer1_token = await create_user("Farmer Ramesh", "ramesh@farm.test", "farmer", "9111111111")
    farmer2_id, farmer2_token = await create_user("Farmer Suresh", "suresh@farm.test", "farmer", "9222222222")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Farmer 1 creates a booking
        b1_payload = {
            "id": "BK-RAMESH-01",
            "equipmentName": "Mahindra 575 DI",
            "acres": 3,
            "date": "2026-10-01"
        }
        res_create = await ac.post("/api/v1/equipment/bookings", json=b1_payload, headers=auth_headers(farmer1_token))
        assert res_create.status_code == 200
        created = res_create.json()["booking"]
        assert created["userId"] == farmer1_id
        assert created["farmerName"] == "Farmer Ramesh"

        # Farmer 2 creates a booking
        b2_payload = {
            "id": "BK-SURESH-01",
            "equipmentName": "John Deere 5050 D",
            "acres": 5,
            "date": "2026-10-02"
        }
        res_create2 = await ac.post("/api/v1/equipment/bookings", json=b2_payload, headers=auth_headers(farmer2_token))
        assert res_create2.status_code == 200
        created2 = res_create2.json()["booking"]
        assert created2["userId"] == farmer2_id

        # Farmer 1 queries bookings: Must see ONLY their own booking
        res_list1 = await ac.get("/api/v1/equipment/bookings", headers=auth_headers(farmer1_token))
        assert res_list1.status_code == 200
        bookings1 = res_list1.json()["bookings"]
        b1_ids = [b["id"] for b in bookings1]
        assert "BK-RAMESH-01" in b1_ids
        assert "BK-SURESH-01" not in b1_ids

        # Farmer 2 queries bookings: Must see ONLY their own booking
        res_list2 = await ac.get("/api/v1/equipment/bookings", headers=auth_headers(farmer2_token))
        assert res_list2.status_code == 200
        bookings2 = res_list2.json()["bookings"]
        b2_ids = [b["id"] for b in bookings2]
        assert "BK-SURESH-01" in b2_ids
        assert "BK-RAMESH-01" not in b2_ids

@pytest.mark.anyio
async def test_farmer_cannot_confirm_or_modify_other_farmers_booking():
    """Verify Farmer cannot confirm bookings (role restriction) and cannot cancel other farmers' bookings."""
    farmer1_id, farmer1_token = await create_user("Farmer Ramesh", "ramesh@farm.test", "farmer", "9111111111")
    farmer2_id, farmer2_token = await create_user("Farmer Suresh", "suresh@farm.test", "farmer", "9222222222")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Farmer 1 creates booking
        await ac.post(
            "/api/v1/equipment/bookings",
            json={"id": "BK-RAMESH-STATUS", "equipmentName": "Drone Sprayer"},
            headers=auth_headers(farmer1_token)
        )

        # Farmer 1 attempts to confirm own booking -> 403 Forbidden
        r_confirm = await ac.patch(
            "/api/v1/equipment/bookings/BK-RAMESH-STATUS/status",
            json={"status": "confirmed"},
            headers=auth_headers(farmer1_token)
        )
        assert r_confirm.status_code == 403

        # Farmer 2 attempts to cancel Farmer 1's booking -> 403 Forbidden
        r_cross_cancel = await ac.patch(
            "/api/v1/equipment/bookings/BK-RAMESH-STATUS/status",
            json={"status": "cancelled", "reason": "Not my booking"},
            headers=auth_headers(farmer2_token)
        )
        assert r_cross_cancel.status_code == 403

        # Farmer 1 cancels own booking -> 200 OK
        r_own_cancel = await ac.patch(
            "/api/v1/equipment/bookings/BK-RAMESH-STATUS/status",
            json={"status": "cancelled", "reason": "Weather changed"},
            headers=auth_headers(farmer1_token)
        )
        assert r_own_cancel.status_code == 200
        assert r_own_cancel.json()["booking"]["status"] == "cancelled"

@pytest.mark.anyio
async def test_farmer_cannot_register_equipment_in_catalog():
    """Verify Farmers cannot register machinery listings (provider role required)."""
    farmer_id, farmer_token = await create_user("Farmer Ramesh", "ramesh@farm.test", "farmer", "9111111111")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.post(
            "/api/v1/equipment/catalog",
            json={"id": "EQ-FARMER-FAIL", "name": "Fake Tractor", "category": "tractor"},
            headers=auth_headers(farmer_token)
        )
        assert r.status_code == 403

# ============================================================================
# 4. EQUIPMENT PROVIDER RBAC & CROSS-PROVIDER ISOLATION
# ============================================================================

@pytest.mark.anyio
async def test_provider_catalog_and_booking_management():
    """Verify Equipment Provider can register machinery and manage assigned bookings."""
    prov1_id, prov1_token = await create_user("Provider Krishna", "krishna@machinery.test", "equipment_provider", "9333333333")
    prov2_id, prov2_token = await create_user("Provider Mohan", "mohan@machinery.test", "equipment_provider", "9444444444")
    farmer_id, farmer_token = await create_user("Farmer Ramesh", "ramesh@farm.test", "farmer", "9111111111")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Provider 1 registers a machine
        r_cat = await ac.post(
            "/api/v1/equipment/catalog",
            json={"id": "EQ-KRISHNA-TR1", "name": "Krishna Tractor", "category": "tractor", "hourlyRate": 800},
            headers=auth_headers(prov1_token)
        )
        assert r_cat.status_code == 200
        assert r_cat.json()["equipment"]["providerId"] == prov1_id

        # Farmer books Provider 1's machine
        r_book = await ac.post(
            "/api/v1/equipment/bookings",
            json={
                "id": "BK-KRISHNA-01",
                "equipmentId": "EQ-KRISHNA-TR1",
                "providerId": prov1_id,
                "providerPhone": "9333333333",
                "equipmentName": "Krishna Tractor"
            },
            headers=auth_headers(farmer_token)
        )
        assert r_book.status_code == 200

        # Provider 1 views bookings: Must see this booking
        r_p1_bookings = await ac.get("/api/v1/equipment/bookings", headers=auth_headers(prov1_token))
        assert r_p1_bookings.status_code == 200
        p1_b_ids = [b["id"] for b in r_p1_bookings.json()["bookings"]]
        assert "BK-KRISHNA-01" in p1_b_ids

        # Provider 2 views bookings: Must NOT see Provider 1's booking
        r_p2_bookings = await ac.get("/api/v1/equipment/bookings", headers=auth_headers(prov2_token))
        assert r_p2_bookings.status_code == 200
        p2_b_ids = [b["id"] for b in r_p2_bookings.json()["bookings"]]
        assert "BK-KRISHNA-01" not in p2_b_ids

        # Cross-Provider denial: Provider 2 cannot confirm Provider 1's booking
        r_p2_confirm = await ac.patch(
            "/api/v1/equipment/bookings/BK-KRISHNA-01/status",
            json={"status": "confirmed"},
            headers=auth_headers(prov2_token)
        )
        assert r_p2_confirm.status_code == 403

        # Cross-Provider denial: Provider 2 cannot delete Provider 1's catalog item
        r_p2_del_cat = await ac.delete(
            "/api/v1/equipment/catalog/EQ-KRISHNA-TR1",
            headers=auth_headers(prov2_token)
        )
        assert r_p2_del_cat.status_code == 403

        # Provider 1 confirms their own booking -> 200 OK
        r_p1_confirm = await ac.patch(
            "/api/v1/equipment/bookings/BK-KRISHNA-01/status",
            json={"status": "confirmed"},
            headers=auth_headers(prov1_token)
        )
        assert r_p1_confirm.status_code == 200
        assert r_p1_confirm.json()["booking"]["status"] == "confirmed"

# ============================================================================
# 5. ADMIN AUTHORIZATION (Global Access)
# ============================================================================

@pytest.mark.anyio
async def test_admin_global_access_and_management():
    """Verify Admin can view and manage all bookings and catalog items across all tenants."""
    admin_id, admin_token = await create_user("Super Admin", "admin@agrishield.test", "admin", "9999999999")
    farmer_id, farmer_token = await create_user("Farmer Ramesh", "ramesh@farm.test", "farmer", "9111111111")
    prov_id, prov_token = await create_user("Provider Krishna", "krishna@machinery.test", "equipment_provider", "9333333333")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create booking by farmer
        await ac.post(
            "/api/v1/equipment/bookings",
            json={"id": "BK-ADMIN-TEST-1", "equipmentName": "Rotavator"},
            headers=auth_headers(farmer_token)
        )

        # Admin views all bookings
        r_admin_list = await ac.get("/api/v1/equipment/bookings", headers=auth_headers(admin_token))
        assert r_admin_list.status_code == 200
        admin_b_ids = [b["id"] for b in r_admin_list.json()["bookings"]]
        assert "BK-ADMIN-TEST-1" in admin_b_ids

        # Admin can update status of any booking
        r_admin_update = await ac.patch(
            "/api/v1/equipment/bookings/BK-ADMIN-TEST-1/status",
            json={"status": "completed"},
            headers=auth_headers(admin_token)
        )
        assert r_admin_update.status_code == 200
        assert r_admin_update.json()["booking"]["status"] == "completed"

        # Admin can delete any booking
        r_admin_del = await ac.delete(
            "/api/v1/equipment/bookings/BK-ADMIN-TEST-1",
            headers=auth_headers(admin_token)
        )
        assert r_admin_del.status_code == 200
