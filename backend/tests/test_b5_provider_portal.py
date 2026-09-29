import pytest
from httpx import ASGITransport, AsyncClient
from bson import ObjectId
from datetime import datetime

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

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
def reset_db_state():
    db_instance.db = mock_db
    db_instance.client = mock_db.client
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_fleet_status.records = []
    mock_db.provider_status.records = []
    mock_db.notifications.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_locks.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._fleet_availability.clear()
    eq_module._provider_status_store.clear()
    yield
    mock_db.users.records = []
    mock_db.equipment_catalog.records = []
    mock_db.equipment_fleet_status.records = []
    mock_db.provider_status.records = []
    mock_db.notifications.records = []
    mock_db.equipment_bookings.records = []
    mock_db.equipment_locks.records = []
    mock_db.idempotency_records.records = []
    eq_module._in_memory_bookings = []
    eq_module._in_memory_catalog = []
    eq_module._fleet_availability.clear()
    eq_module._provider_status_store.clear()


async def create_test_user(name: str, email: str, role: str = "equipment_provider", phone: str = "9876543210"):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "phone": phone,
        "mobile": phone,
        "provider_profile": {
            "business_name": f"{name} Services",
            "is_online": False
        }
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token, phone


# ==============================================================================
# C-3 TESTS: Authoritative Equipment Availability & Sync
# ==============================================================================

@pytest.mark.anyio
async def test_c3_availability_persistence_and_fleet_catalog_consistency():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p1_id, p1_token, _ = await create_test_user("Provider One", "p1@agri.com", "equipment_provider")
        p2_id, p2_token, _ = await create_test_user("Provider Two", "p2@agri.com", "equipment_provider")
        f_id, f_token, _ = await create_test_user("Farmer John", "farmer@agri.com", "farmer")
        adm_id, adm_token, _ = await create_test_user("Admin User", "admin@agri.com", "admin")

        # Seed equipment in catalog
        eq_id = "EQ-TRACTOR-9001"
        mock_db.equipment_catalog.records.append({
            "id": eq_id,
            "title": "Mahindra 575 DI Tractor",
            "category": "tractor",
            "providerId": p1_id,
            "owner_id": p1_id,
            "available": True,
            "village": "Mandavalli",
            "district": "Krishna"
        })

        # 1. Unauthenticated or non-owner cannot toggle availability
        res_anon = await ac.patch(f"/api/v1/equipment/fleet/{eq_id}/availability", json={"available": False})
        assert res_anon.status_code == 401

        res_farmer = await ac.patch(
            f"/api/v1/equipment/fleet/{eq_id}/availability",
            headers={"Authorization": f"Bearer {f_token}"},
            json={"available": False}
        )
        assert res_farmer.status_code == 403

        res_p2 = await ac.patch(
            f"/api/v1/equipment/fleet/{eq_id}/availability",
            headers={"Authorization": f"Bearer {p2_token}"},
            json={"available": False}
        )
        assert res_p2.status_code == 403

        # 2. Owner provider updates availability to False
        res_p1 = await ac.patch(
            f"/api/v1/equipment/fleet/{eq_id}/availability",
            headers={"Authorization": f"Bearer {p1_token}"},
            json={"available": False}
        )
        assert res_p1.status_code == 200
        assert res_p1.json()["available"] is False

        # 3. GET /catalog and GET /fleet/status must both reflect False
        res_cat = await ac.get("/api/v1/equipment/catalog")
        assert res_cat.status_code == 200
        cat_items = res_cat.json().get("equipment", [])
        target_cat = next((item for item in cat_items if item["id"] == eq_id), None)
        assert target_cat is not None
        assert target_cat["available"] is False

        res_fleet = await ac.get("/api/v1/equipment/fleet/status")
        assert res_fleet.status_code == 200
        fleet_status = res_fleet.json().get("availability", {})
        assert fleet_status.get(eq_id) is False

        # 4. Simulate process restart / memory wipe:
        # Clear in-memory dictionary. Backend must query persisted database!
        eq_module._fleet_availability.clear()

        res_restart_fleet = await ac.get("/api/v1/equipment/fleet/status")
        assert res_restart_fleet.status_code == 200
        assert res_restart_fleet.json().get("availability", {}).get(eq_id) is False

        res_restart_cat = await ac.get("/api/v1/equipment/catalog")
        assert res_restart_cat.status_code == 200
        cat_items_re = res_restart_cat.json().get("equipment", [])
        target_cat_re = next((item for item in cat_items_re if item["id"] == eq_id), None)
        assert target_cat_re["available"] is False

        # 5. Admin updates availability back to True
        res_adm = await ac.patch(
            f"/api/v1/equipment/fleet/{eq_id}/availability",
            headers={"Authorization": f"Bearer {adm_token}"},
            json={"available": True}
        )
        assert res_adm.status_code == 200
        assert res_adm.json()["available"] is True

        res_cat_after = await ac.get("/api/v1/equipment/catalog")
        target_cat_after = next((item for item in res_cat_after.json()["equipment"] if item["id"] == eq_id), None)
        assert target_cat_after["available"] is True


# ==============================================================================
# H-3 TESTS: Server-Backed Provider Online/Offline Status
# ==============================================================================

@pytest.mark.anyio
async def test_h3_provider_online_status_rbac_and_persistence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p1_id, p1_token, p1_phone = await create_test_user("Provider Alpha", "alpha@agri.com", "equipment_provider", "9111111111")
        p2_id, p2_token, _ = await create_test_user("Provider Beta", "beta@agri.com", "equipment_provider", "9222222222")
        f_id, f_token, _ = await create_test_user("Farmer Rao", "rao@agri.com", "farmer", "9333333333")

        # 1. Anonymous access is denied
        res_anon_get = await ac.get("/api/v1/equipment/provider/status")
        assert res_anon_get.status_code == 401

        res_anon_patch = await ac.patch("/api/v1/equipment/provider/status", json={"is_online": True})
        assert res_anon_patch.status_code == 401

        # 2. Farmer cannot patch status
        res_farmer_patch = await ac.patch(
            "/api/v1/equipment/provider/status",
            headers={"Authorization": f"Bearer {f_token}"},
            json={"is_online": True}
        )
        assert res_farmer_patch.status_code == 403

        # 3. Provider cannot modify another provider's status
        res_p2_cross = await ac.patch(
            "/api/v1/equipment/provider/status",
            headers={"Authorization": f"Bearer {p2_token}"},
            json={"provider_id": p1_id, "is_online": True}
        )
        assert res_p2_cross.status_code == 403

        # 4. Provider Alpha updates their own status to online
        res_p1_on = await ac.patch(
            "/api/v1/equipment/provider/status",
            headers={"Authorization": f"Bearer {p1_token}"},
            json={"is_online": True}
        )
        assert res_p1_on.status_code == 200
        assert res_p1_on.json()["is_online"] is True
        assert res_p1_on.json()["status"] == "online"

        # 5. Farmer views Provider Alpha's status
        res_f_check = await ac.get(
            f"/api/v1/equipment/provider/status?provider_id={p1_id}",
            headers={"Authorization": f"Bearer {f_token}"}
        )
        assert res_f_check.status_code == 200
        assert res_f_check.json()["is_online"] is True
        assert res_f_check.json()["status"] == "online"

        # 6. Check by phone number
        res_phone_check = await ac.get(
            f"/api/v1/equipment/provider/status?phone={p1_phone}",
            headers={"Authorization": f"Bearer {f_token}"}
        )
        assert res_phone_check.status_code == 200
        assert res_phone_check.json()["is_online"] is True

        # 7. Persistence across memory wipe / restart simulation
        eq_module._provider_status_store.clear()
        res_restart_check = await ac.get(
            f"/api/v1/equipment/provider/status?provider_id={p1_id}",
            headers={"Authorization": f"Bearer {f_token}"}
        )
        assert res_restart_check.status_code == 200
        assert res_restart_check.json()["is_online"] is True

        # 8. Provider Alpha switches offline
        res_p1_off = await ac.patch(
            "/api/v1/equipment/provider/status",
            headers={"Authorization": f"Bearer {p1_token}"},
            json={"is_online": False}
        )
        assert res_p1_off.status_code == 200
        assert res_p1_off.json()["is_online"] is False
        assert res_p1_off.json()["status"] == "offline"

        # Farmer sees offline
        res_f_check_off = await ac.get(
            f"/api/v1/equipment/provider/status?provider_id={p1_id}",
            headers={"Authorization": f"Bearer {f_token}"}
        )
        assert res_f_check_off.json()["is_online"] is False
        assert res_f_check_off.json()["status"] == "offline"

        # 9. Querying an unknown / non-existent provider NEVER defaults to True
        res_unknown = await ac.get(
            "/api/v1/equipment/provider/status?provider_id=NON_EXISTENT_ID_999",
            headers={"Authorization": f"Bearer {f_token}"}
        )
        assert res_unknown.status_code == 200
        assert res_unknown.json()["is_online"] is False
        assert res_unknown.json()["status"] == "unknown"


# ==============================================================================
# M-3 TESTS: Multi-Provider Batch Booking Notifications
# ==============================================================================

@pytest.mark.anyio
async def test_m3_batch_booking_multi_provider_notifications():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p1_id, p1_token, p1_phone = await create_test_user("Provider Green", "green@agri.com", "equipment_provider", "9440000001")
        p2_id, p2_token, p2_phone = await create_test_user("Provider Blue", "blue@agri.com", "equipment_provider", "9440000002")
        f_id, f_token, f_phone = await create_test_user("Farmer Suresh", "suresh@agri.com", "farmer", "9848022338")

        # Multi-provider batch payload: 2 items for Provider Green, 1 item for Provider Blue
        batch_payload = {
            "bookings": [
                {
                    "equipment_id": "EQ-TRACTOR-1",
                    "equipment_name": "Tractor 55HP",
                    "providerId": p1_id,
                    "provider_phone": p1_phone,
                    "farmer_phone": f_phone,
                    "farmer_name": "Suresh",
                    "start_date": "2026-10-01",
                    "end_date": "2026-10-02",
                    "total_price": 3000
                },
                {
                    "equipment_id": "EQ-ROTO-1",
                    "equipment_name": "Heavy Rotavator",
                    "providerId": p1_id,
                    "provider_phone": p1_phone,
                    "farmer_phone": f_phone,
                    "farmer_name": "Suresh",
                    "start_date": "2026-10-01",
                    "end_date": "2026-10-02",
                    "total_price": 1500
                },
                {
                    "equipment_id": "EQ-DRONE-1",
                    "equipment_name": "Agricultural Spray Drone",
                    "providerId": p2_id,
                    "provider_phone": p2_phone,
                    "farmer_phone": f_phone,
                    "farmer_name": "Suresh",
                    "start_date": "2026-10-03",
                    "end_date": "2026-10-03",
                    "total_price": 2000
                }
            ]
        }

        res_batch = await ac.post(
            "/api/v1/equipment/bookings/batch",
            headers={"Authorization": f"Bearer {f_token}"},
            json=batch_payload
        )
        assert res_batch.status_code == 200
        assert res_batch.json()["count"] == 3

        # Verify notifications in mock database
        notifications = mock_db.notifications.records
        # Exactly 2 notifications generated (one for Provider Green, one for Provider Blue)
        p1_notifs = [n for n in notifications if str(n.get("user_id")) == p1_id]
        p2_notifs = [n for n in notifications if str(n.get("user_id")) == p2_id]

        assert len(p1_notifs) == 1, f"Provider 1 should have exactly 1 consolidated notification, got: {len(p1_notifs)}"
        assert len(p2_notifs) == 1, f"Provider 2 should have exactly 1 consolidated notification, got: {len(p2_notifs)}"

        # Verify Provider 1 notification content
        p1_msg = p1_notifs[0]
        assert "2 New Machinery Bookings Received!" in p1_msg["title"]
        assert "Tractor 55HP" in p1_msg["message"]
        assert "Heavy Rotavator" in p1_msg["message"]
        assert "Spray Drone" not in p1_msg["message"], "Provider 1 should not see Provider 2's equipment!"

        # Verify Provider 2 notification content
        p2_msg = p2_notifs[0]
        assert "New Machinery Booking Received!" in p2_msg["title"]
        assert "Agricultural Spray Drone" in p2_msg["message"]
        assert "Tractor 55HP" not in p2_msg["message"], "Provider 2 should not see Provider 1's equipment!"


# ==============================================================================
# PHASE 2 TESTS: C-1, C-2, H-1, H-4, M-4
# ==============================================================================

@pytest.mark.anyio
async def test_c1_rejected_status_is_terminal_and_cannot_be_reopened():
    """
    C-1: Verify that a rejected booking cannot be reopened or transitioned to confirmed.
    Terminal state transition rejection returns HTTP 409 Conflict.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, _ = await create_test_user("Provider Ramu", "ramu@agri.com", "equipment_provider")
        f_id, f_token, _ = await create_test_user("Farmer Gopi", "gopi@agri.com", "farmer")

        b_id = "BK-TEST-REJECT-01"
        mock_db.equipment_bookings.records.append({
            "id": b_id,
            "equipmentId": "EQ-100",
            "providerId": p_id,
            "userId": f_id,
            "status": "rejected",
            "date": "2026-10-15",
            "start_time": datetime(2026, 10, 15, 4, 0),
            "end_time": datetime(2026, 10, 15, 12, 0)
        })

        # Attempt to reopen rejected booking to confirmed
        res = await ac.patch(
            f"/api/v1/equipment/bookings/{b_id}/status",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"status": "confirmed"}
        )
        assert res.status_code == 409
        assert "Cannot change terminal status 'rejected' to 'confirmed'" in res.json()["detail"]

        # Confirm status remains rejected
        b_doc = await mock_db.equipment_bookings.find_one({"id": b_id})
        assert b_doc["status"] == "rejected"


@pytest.mark.anyio
async def test_c2_provider_cancels_confirmed_booking_and_releases_lock():
    """
    C-2: Verify provider can cancel a confirmed booking using existing PATCH flow,
    and cancellation releases the time slot lock so another booking can be confirmed.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, _ = await create_test_user("Provider Shiva", "shiva@agri.com", "equipment_provider")
        f1_id, f1_token, _ = await create_test_user("Farmer A", "fa@agri.com", "farmer")
        f2_id, f2_token, _ = await create_test_user("Farmer B", "fb@agri.com", "farmer")
        other_p_id, other_p_token, _ = await create_test_user("Other Provider", "other@agri.com", "equipment_provider")

        eq_id = "EQ-TRACTOR-500"
        b1_id = "BK-CONF-01"
        b2_id = "BK-CONF-02"

        # Seed catalog item
        mock_db.equipment_catalog.records.append({
            "id": eq_id,
            "title": "John Deere 5050D",
            "providerId": p_id,
            "owner_id": p_id,
            "available": True
        })

        # Seed 2 bookings for the same date and time slot
        mock_db.equipment_bookings.records.append({
            "id": b1_id,
            "equipmentId": eq_id,
            "providerId": p_id,
            "userId": f1_id,
            "status": "pending",
            "date": "2026-10-20",
            "timeSlot": "09:00 - 13:00",
            "bookingDate": "2026-10-20"
        })
        mock_db.equipment_bookings.records.append({
            "id": b2_id,
            "equipmentId": eq_id,
            "providerId": p_id,
            "userId": f2_id,
            "status": "pending",
            "date": "2026-10-20",
            "timeSlot": "09:00 - 13:00",
            "bookingDate": "2026-10-20"
        })

        # 1. Provider confirms Booking 1
        res1 = await ac.patch(
            f"/api/v1/equipment/bookings/{b1_id}/status",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"status": "confirmed"}
        )
        assert res1.status_code == 200
        assert res1.json()["booking"]["status"] == "confirmed"

        # 2. Attempting to confirm Booking 2 for same slot results in 409 collision
        res2_collide = await ac.patch(
            f"/api/v1/equipment/bookings/{b2_id}/status",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"status": "confirmed"}
        )
        assert res2_collide.status_code == 409
        assert "collision" in res2_collide.json()["detail"].lower()

        # 3. Unauthorized non-owner provider cannot cancel Booking 1
        res_cross_cancel = await ac.patch(
            f"/api/v1/equipment/bookings/{b1_id}/status",
            headers={"Authorization": f"Bearer {other_p_token}"},
            json={"status": "cancelled", "reason": "Unauthorized attempt"}
        )
        assert res_cross_cancel.status_code == 403

        # 4. Authorized Provider Shiva cancels Booking 1 with reason
        res_cancel = await ac.patch(
            f"/api/v1/equipment/bookings/{b1_id}/status",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"status": "cancelled", "reason": "Equipment breakdown: hydraulic pump service"}
        )
        assert res_cancel.status_code == 200
        cancelled_data = res_cancel.json()["booking"]
        assert cancelled_data["status"] == "cancelled"
        assert cancelled_data.get("cancelReason") == "Equipment breakdown: hydraulic pump service"

        # 5. Now Booking 2 can be confirmed for the exact same slot without collision!
        res2_success = await ac.patch(
            f"/api/v1/equipment/bookings/{b2_id}/status",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"status": "confirmed"}
        )
        assert res2_success.status_code == 200
        assert res2_success.json()["booking"]["status"] == "confirmed"


@pytest.mark.anyio
async def test_h4_cannot_delete_confirmed_or_completed_booking():
    """
    H-4: Deleting active (confirmed) or completed bookings must be rejected with HTTP 400.
    Pending bookings can be deleted.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, _ = await create_test_user("Provider Krishna", "krishna@agri.com", "equipment_provider")
        f_id, f_token, _ = await create_test_user("Farmer Murthy", "murthy@agri.com", "farmer")

        b_conf = "BK-DEL-CONF"
        b_comp = "BK-DEL-COMP"
        b_pend = "BK-DEL-PEND"

        mock_db.equipment_bookings.records.extend([
            {"id": b_conf, "equipmentId": "EQ-1", "providerId": p_id, "userId": f_id, "status": "confirmed"},
            {"id": b_comp, "equipmentId": "EQ-1", "providerId": p_id, "userId": f_id, "status": "completed"},
            {"id": b_pend, "equipmentId": "EQ-1", "providerId": p_id, "userId": f_id, "status": "pending"}
        ])

        # Attempt to delete confirmed booking -> 400
        res_del_conf = await ac.delete(
            f"/api/v1/equipment/bookings/{b_conf}",
            headers={"Authorization": f"Bearer {p_token}"}
        )
        assert res_del_conf.status_code == 400
        assert "Active or completed bookings" in res_del_conf.json()["detail"]

        # Attempt to delete completed booking -> 400
        res_del_comp = await ac.delete(
            f"/api/v1/equipment/bookings/{b_comp}",
            headers={"Authorization": f"Bearer {p_token}"}
        )
        assert res_del_comp.status_code == 400
        assert "Active or completed bookings" in res_del_comp.json()["detail"]

        # Deleting pending booking succeeds
        res_del_pend = await ac.delete(
            f"/api/v1/equipment/bookings/{b_pend}",
            headers={"Authorization": f"Bearer {p_token}"}
        )
        assert res_del_pend.status_code == 200
        assert res_del_pend.json()["success"] is True


@pytest.mark.anyio
async def test_m4_booking_creation_provider_id_resolution():
    """
    M-4: Booking creation must resolve canonical provider/owner ID and NEVER store equipment.id as providerId.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, p_phone = await create_test_user("Provider Harsha", "harsha@agri.com", "equipment_provider", "9848123456")
        f_id, f_token, f_phone = await create_test_user("Farmer Naidu", "naidu@agri.com", "farmer", "9848654321")

        eq_id = "EQ-ROTAVATOR-88"
        mock_db.equipment_catalog.records.append({
            "id": eq_id,
            "title": "Shaktiman Rotavator",
            "providerId": p_id,
            "owner_id": p_id,
            "phone": p_phone
        })

        # 1. Single booking where client errantly sends providerId == equipmentId
        booking_payload = {
            "id": "BK-M4-01",
            "equipmentId": eq_id,
            "providerId": eq_id,  # Buggy client pattern
            "farmerPhone": f_phone,
            "farmerName": "Naidu",
            "date": "2026-10-25"
        }

        res_single = await ac.post(
            "/api/v1/equipment/bookings",
            headers={"Authorization": f"Bearer {f_token}"},
            json=booking_payload
        )
        assert res_single.status_code == 200
        created_booking = res_single.json()["booking"]
        # Must resolve to canonical provider ID and NEVER equal equipment.id
        assert created_booking["providerId"] == p_id
        assert created_booking["providerId"] != eq_id

        # 2. Batch booking where client sends providerId == equipmentId
        batch_payload = {
            "bookings": [
                {
                    "id": "BK-M4-BATCH-01",
                    "equipmentId": eq_id,
                    "providerId": eq_id,
                    "farmerPhone": f_phone,
                    "date": "2026-10-26"
                }
            ]
        }
        res_batch = await ac.post(
            "/api/v1/equipment/bookings/batch",
            headers={"Authorization": f"Bearer {f_token}"},
            json=batch_payload
        )
        assert res_batch.status_code == 200
        saved_doc = await mock_db.equipment_bookings.find_one({"id": "BK-M4-BATCH-01"})
        assert saved_doc is not None
        assert saved_doc["providerId"] == p_id
        assert saved_doc["providerId"] != eq_id


@pytest.mark.anyio
async def test_h1_provider_equipment_registration_and_chat_no_mock_pii():
    """
    H-1: Verify that equipment registration and chat stamping use authenticated profile data,
    never injecting hardcoded mock strings (Mandavalli, Krishna, 9848022338, Ramesh Farm Services).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, p_phone = await create_test_user("Auth Provider Real", "realprov@agri.com", "equipment_provider", "9777777777")

        new_eq = {
            "title": "Custom Mini Harvester",
            "category": "harvester",
            "village": "Real Village",
            "district": "Real District"
        }

        res = await ac.post(
            "/api/v1/equipment/catalog",
            headers={"Authorization": f"Bearer {p_token}"},
            json=new_eq
        )
        assert res.status_code == 200
        reg_item = res.json()["equipment"]
        assert reg_item["providerId"] == p_id
        assert reg_item["owner_id"] == p_id
        assert reg_item["phone"] == p_phone
        assert reg_item["providerName"] == "Auth Provider Real"
        assert "Ramesh" not in reg_item.get("providerName", "")
        assert "9848022338" != reg_item.get("phone")


# ==============================================================================
# M-1 TESTS: Provider Tenant Isolation & Fleet Fallback Privacy
# ==============================================================================

@pytest.mark.anyio
async def test_m1_empty_provider_fleet_returns_empty_list():
    """M-1 Test 1: New/empty provider fleet returns [] rather than starter fleet."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, _ = await create_test_user("New Provider", "newprov@agri.com", "equipment_provider", "9111111111")
        res = await ac.get(
            "/api/v1/equipment/fleet",
            headers={"Authorization": f"Bearer {p_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["count"] == 0
        assert data["fleet"] == []
        assert data["equipment"] == []


@pytest.mark.anyio
async def test_m1_provider_tenant_isolation_fleet_endpoint():
    """M-1 Test 2 & 4: Provider A cannot receive Provider B's equipment through /fleet."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p1_id, p1_token, _ = await create_test_user("Provider A", "pa@agri.com", "equipment_provider", "9111111112")
        p2_id, p2_token, _ = await create_test_user("Provider B", "pb@agri.com", "equipment_provider", "9111111113")

        # Provider A registers machine
        res1 = await ac.post(
            "/api/v1/equipment/catalog",
            headers={"Authorization": f"Bearer {p1_token}"},
            json={"title": "Provider A Tractor", "category": "tractor", "village": "Village A"}
        )
        assert res1.status_code == 200
        p1_eq_id = res1.json()["equipment"]["id"]

        # Provider B registers machine
        res2 = await ac.post(
            "/api/v1/equipment/catalog",
            headers={"Authorization": f"Bearer {p2_token}"},
            json={"title": "Provider B Drone", "category": "drone", "village": "Village B"}
        )
        assert res2.status_code == 200
        p2_eq_id = res2.json()["equipment"]["id"]

        # Provider A calls /fleet -> must only see p1_eq_id
        res_fleet_a = await ac.get(
            "/api/v1/equipment/fleet",
            headers={"Authorization": f"Bearer {p1_token}"}
        )
        assert res_fleet_a.status_code == 200
        fleet_a_ids = [m["id"] for m in res_fleet_a.json()["fleet"]]
        assert p1_eq_id in fleet_a_ids
        assert p2_eq_id not in fleet_a_ids

        # Provider B calls /fleet -> must only see p2_eq_id
        res_fleet_b = await ac.get(
            "/api/v1/equipment/fleet",
            headers={"Authorization": f"Bearer {p2_token}"}
        )
        assert res_fleet_b.status_code == 200
        fleet_b_ids = [m["id"] for m in res_fleet_b.json()["fleet"]]
        assert p2_eq_id in fleet_b_ids
        assert p1_eq_id not in fleet_b_ids


@pytest.mark.anyio
async def test_m1_fleet_endpoint_requires_auth_and_provider_role():
    """M-1 Test 3: Provider fleet endpoint requires authentication and rejects unauthorized roles."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Unauthenticated -> 401
        res_anon = await ac.get("/api/v1/equipment/fleet")
        assert res_anon.status_code == 401

        # 2. Farmer role -> 403 Forbidden
        f_id, f_token, _ = await create_test_user("Farmer Joe", "fj@agri.com", "farmer", "9111111114")
        res_farmer = await ac.get(
            "/api/v1/equipment/fleet",
            headers={"Authorization": f"Bearer {f_token}"}
        )
        assert res_farmer.status_code == 403

        # 3. Provider role -> 200 OK
        p_id, p_token, _ = await create_test_user("Provider Joe", "pj@agri.com", "equipment_provider", "9111111115")
        res_provider = await ac.get(
            "/api/v1/equipment/fleet",
            headers={"Authorization": f"Bearer {p_token}"}
        )
        assert res_provider.status_code == 200


@pytest.mark.anyio
async def test_m1_harden_provider_phone_filter_invalid_inputs():
    """M-1 Tests 5 & 6: provider_phone='+' or ' ' does NOT return the entire catalog."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, p_phone = await create_test_user("Real Provider", "rp@agri.com", "equipment_provider", "9876543210")
        await ac.post(
            "/api/v1/equipment/catalog",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"title": "Heavy Harvester", "category": "harvester", "village": "Prakasam"}
        )

        # 1. Query with '+' must return 0 items, never all equipment
        res_plus = await ac.get("/api/v1/equipment/catalog?provider_phone=%2B")
        assert res_plus.status_code == 200
        assert res_plus.json()["count"] == 0
        assert res_plus.json()["equipment"] == []

        # 2. Query with ' ' (space) must return 0 items
        res_space = await ac.get("/api/v1/equipment/catalog?provider_phone=%20")
        assert res_space.status_code == 200
        assert res_space.json()["count"] == 0
        assert res_space.json()["equipment"] == []

        # 3. Query with non-digit '++++' must return 0 items
        res_multi_plus = await ac.get("/api/v1/equipment/catalog?provider_phone=%2B%2B%2B%2B")
        assert res_multi_plus.status_code == 200
        assert res_multi_plus.json()["count"] == 0
        assert res_multi_plus.json()["equipment"] == []

        # 4. Query with legitimate phone returns the matching equipment
        res_valid = await ac.get(f"/api/v1/equipment/catalog?provider_phone={p_phone}")
        assert res_valid.status_code == 200
        assert res_valid.json()["count"] >= 1


@pytest.mark.anyio
async def test_m1_farmer_global_catalog_remains_intact():
    """M-1 Test 7: Public /catalog endpoint remains globally accessible for farmer discovery."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        p_id, p_token, _ = await create_test_user("Public Provider", "pub@agri.com", "equipment_provider", "9848011223")
        await ac.post(
            "/api/v1/equipment/catalog",
            headers={"Authorization": f"Bearer {p_token}"},
            json={"title": "Public Farmer Tractor", "category": "tractor", "village": "Prakasam"}
        )

        # Unauthenticated farmer read
        res = await ac.get("/api/v1/equipment/catalog")
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert res.json()["count"] >= 1
