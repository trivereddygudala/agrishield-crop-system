import pytest
from httpx import ASGITransport, AsyncClient
from bson import ObjectId

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase

mock_db = MockDatabase()
db_instance.db = mock_db

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
def reset_db_state():
    db_instance.db = mock_db
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []
    mock_db["tombstones"].records = []
    yield
    mock_db.users.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []
    mock_db["tombstones"].records = []


async def create_user(name: str, email: str, role: str = "farmer"):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token


async def create_farm(user_id: str, farm_name: str = "Green Acres"):
    farm_id = ObjectId()
    farm_doc = {
        "_id": farm_id,
        "id": str(farm_id),
        "user_id": user_id,
        "farm_name": farm_name,
        "crop_name": "Tomato",
        "farm_size": 2.5,
        "village": "Pasupugallu",
        "timeline_tasks": {}
    }
    mock_db.farm_profiles.records.append(farm_doc)
    return str(farm_id)


# ==============================================================================
# M-3 TESTS: Admin & Owner Prediction History Deletion
# ==============================================================================

@pytest.mark.anyio
async def test_m3_delete_prediction_authorization_and_safety():
    """Verify DELETE /api/history/{id} enforces strict tenant isolation, admin override, and safety."""
    farmer1_id, token_f1 = await create_user("Farmer One", "f1@test.com", "farmer")
    farmer2_id, token_f2 = await create_user("Farmer Two", "f2@test.com", "farmer")
    admin_id, token_admin = await create_user("Admin User", "admin@test.com", "admin")

    pred1_id = ObjectId()
    mock_db.predictions.records.append({
        "_id": pred1_id,
        "id": str(pred1_id),
        "user_id": farmer1_id,
        "crop_name": "Tomato",
        "disease_name": "Early Blight",
        "image_path": None  # safe null image_path
    })

    pred2_id = ObjectId()
    mock_db.predictions.records.append({
        "_id": pred2_id,
        "id": str(pred2_id),
        "user_id": farmer1_id,
        "crop_name": "Tomato",
        "disease_name": "Late Blight",
        "image_path": "uploads/predictions/nonexistent_sample.jpg"  # missing file safety
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated -> 401
        res = await client.delete(f"/api/history/{str(pred1_id)}")
        assert res.status_code == 401

        # 2. Invalid ID format -> 400
        res = await client.delete("/api/history/invalid-format-id", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 400

        # 3. Nonexistent record -> 404
        nonexistent = str(ObjectId())
        res = await client.delete(f"/api/history/{nonexistent}", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 404

        # 4. Cross-tenant: Farmer 2 attempts to delete Farmer 1's prediction -> 403 Forbidden
        res = await client.delete(f"/api/history/{str(pred1_id)}", headers={"Authorization": f"Bearer {token_f2}"})
        assert res.status_code == 403
        assert "Access forbidden" in res.json()["detail"]

        # 5. Farmer 1 (owner) deletes own prediction -> 200 OK
        res = await client.delete(f"/api/history/{str(pred1_id)}", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 200
        assert not any(str(p.get("_id")) == str(pred1_id) for p in mock_db.predictions.records)

        # 6. Admin deletes Farmer 1's remaining prediction -> 200 OK
        res = await client.delete(f"/api/history/{str(pred2_id)}", headers={"Authorization": f"Bearer {token_admin}"})
        assert res.status_code == 200
        assert not any(str(p.get("_id")) == str(pred2_id) for p in mock_db.predictions.records)

        # 7. Verify SyncService tombstones recorded for deletions
        from backend.app.services.sync_service import SyncService
        assert SyncService.is_deleted("prediction", str(pred1_id))
        assert SyncService.is_deleted("prediction", str(pred2_id))
        tombstones = mock_db["tombstones"].records
        assert len(tombstones) == 2
        assert any(t.get("entity_id") == str(pred1_id) and t.get("deleted_by") == farmer1_id for t in tombstones)
        assert any(t.get("entity_id") == str(pred2_id) and t.get("deleted_by") == admin_id for t in tombstones)


# ==============================================================================
# M-1 TESTS: Digital Farm Khata Persistence & Duplicate Protection
# ==============================================================================

@pytest.mark.anyio
async def test_m1_khata_crud_and_tenant_isolation():
    """Verify Khata GET/POST/DELETE enforce auth, tenant isolation, and duplicate booking protection."""
    farmer1_id, token_f1 = await create_user("Farmer One", "f1_khata@test.com", "farmer")
    farmer2_id, token_f2 = await create_user("Farmer Two", "f2_khata@test.com", "farmer")
    admin_id, token_admin = await create_user("Admin User", "admin_khata@test.com", "admin")

    farm1_id = await create_farm(farmer1_id, "Farmer 1 Plot")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated requests -> 401
        res = await client.get(f"/api/farms/{farm1_id}/khata")
        assert res.status_code == 401
        res = await client.post(f"/api/farms/{farm1_id}/khata", json={"type": "expense", "category": "seeds", "description": "Seeds", "amount": 500, "date": "2026-09-29"})
        assert res.status_code == 401
        res = await client.delete(f"/api/farms/{farm1_id}/khata/sample_id")
        assert res.status_code == 401

        # 2. Nonexistent farm -> 404
        nonexistent_farm = str(ObjectId())
        res = await client.get(f"/api/farms/{nonexistent_farm}/khata", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 404
        res = await client.post(f"/api/farms/{nonexistent_farm}/khata", headers={"Authorization": f"Bearer {token_f1}"}, json={"type": "expense", "category": "seeds", "description": "Seeds", "amount": 500, "date": "2026-09-29"})
        assert res.status_code == 404

        # 3. Cross-tenant access: Farmer 2 on Farmer 1's farm -> 403 Forbidden
        res = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f2}"})
        assert res.status_code == 403
        res = await client.post(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f2}"}, json={"type": "expense", "category": "seeds", "description": "Seeds", "amount": 500, "date": "2026-09-29"})
        assert res.status_code == 403

        # 4. Owner creates expense transaction -> 201 Created
        tx_payload = {
            "type": "expense",
            "category": "fertilizer",
            "description": "DAP Fertilizer (2 bags)",
            "amount": 2700.0,
            "date": "2026-09-25"
        }
        res = await client.post(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"}, json=tx_payload)
        assert res.status_code == 201
        created_tx = res.json()
        assert created_tx["category"] == "fertilizer"
        assert created_tx["amount"] == 2700.0
        tx_id = created_tx["id"]

        # 5. Owner retrieves transactions -> 200 OK
        res = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 1
        assert data["transactions"][0]["id"] == tx_id

        # 6. Admin can read Khata globally -> 200 OK
        res = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_admin}"})
        assert res.status_code == 200
        assert res.json()["count"] == 1

        # 7. Booking sync & duplicate protection
        booking_tx = {
            "type": "expense",
            "category": "machinery",
            "description": "Tractor Plowing - Booking #B1001",
            "amount": 3500.0,
            "date": "2026-09-26",
            "booking_id": "B1001"
        }
        res1 = await client.post(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"}, json=booking_tx)
        assert res1.status_code == 201
        booking_tx_id = res1.json()["id"]

        # Repeated sync with SAME booking_id returns existing record without duplicating
        res2 = await client.post(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"}, json=booking_tx)
        assert res2.status_code in [200, 201]
        assert res2.json()["id"] == booking_tx_id

        # Total transactions should be 2, not 3
        res = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.json()["count"] == 2

        # 7b. Failed sync permits retry: invalid amount fails with 400/422, not persisted
        failed_sync_tx = {
            "type": "expense",
            "category": "machinery",
            "description": "Harvester Booking #B2002",
            "amount": -50.0,
            "date": "2026-09-27",
            "booking_id": "B2002"
        }
        res_fail = await client.post(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"}, json=failed_sync_tx)
        assert res_fail.status_code in [400, 422]
        res_chk = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"})
        assert res_chk.json()["count"] == 2

        # Retry with corrected amount succeeds and persists
        failed_sync_tx["amount"] = 4200.0
        res_retry = await client.post(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"}, json=failed_sync_tx)
        assert res_retry.status_code == 201
        res_chk2 = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"})
        assert res_chk2.json()["count"] == 3

        # 8. Cross-tenant delete: Farmer 2 cannot delete Farmer 1's transaction -> 403 Forbidden
        res = await client.delete(f"/api/farms/{farm1_id}/khata/{tx_id}", headers={"Authorization": f"Bearer {token_f2}"})
        assert res.status_code == 403

        # 9. Owner deletes transaction -> 200 OK
        res = await client.delete(f"/api/farms/{farm1_id}/khata/{tx_id}", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 200
        res = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.json()["count"] == 2


# ==============================================================================
# M-2 TESTS: Crop Growth Timeline Tasks Persistence
# ==============================================================================

@pytest.mark.anyio
async def test_m2_timeline_tasks_persistence_and_validation():
    """Verify timeline tasks GET/PUT enforce auth, tenant isolation, and bounded payload validation."""
    farmer1_id, token_f1 = await create_user("Farmer One", "f1_timeline@test.com", "farmer")
    farmer2_id, token_f2 = await create_user("Farmer Two", "f2_timeline@test.com", "farmer")
    admin_id, token_admin = await create_user("Admin User", "admin_timeline@test.com", "admin")

    farm1_id = await create_farm(farmer1_id, "Farmer 1 Orchard")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated requests -> 401
        res = await client.get(f"/api/farms/{farm1_id}/timeline-tasks")
        assert res.status_code == 401
        res = await client.put(f"/api/farms/{farm1_id}/timeline-tasks", json={"completed_tasks": {}})
        assert res.status_code == 401

        # 2. Nonexistent farm -> 404
        nonexistent = str(ObjectId())
        res = await client.get(f"/api/farms/{nonexistent}/timeline-tasks", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 404
        res = await client.put(f"/api/farms/{nonexistent}/timeline-tasks", headers={"Authorization": f"Bearer {token_f1}"}, json={"completed_tasks": {}})
        assert res.status_code == 404

        # 3. Cross-tenant access: Farmer 2 cannot read or update Farmer 1's tasks -> 403 Forbidden
        res = await client.get(f"/api/farms/{farm1_id}/timeline-tasks", headers={"Authorization": f"Bearer {token_f2}"})
        assert res.status_code == 403
        res = await client.put(f"/api/farms/{farm1_id}/timeline-tasks", headers={"Authorization": f"Bearer {token_f2}"}, json={"completed_tasks": {"task_1": True}})
        assert res.status_code == 403

        # 4. Owner reads initial tasks -> 200 OK (empty)
        res = await client.get(f"/api/farms/{farm1_id}/timeline-tasks", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 200
        assert res.json()["completed_tasks"] == {}

        # 5. Owner updates timeline tasks round-trip -> 200 OK
        tasks_payload = {
            "completed_tasks": {
                "stage-1-task-0": True,
                "stage-1-task-1": True,
                "stage-2-task-0": False
            }
        }
        res = await client.put(f"/api/farms/{farm1_id}/timeline-tasks", headers={"Authorization": f"Bearer {token_f1}"}, json=tasks_payload)
        assert res.status_code == 200
        assert res.json()["completed_tasks"]["stage-1-task-0"] is True

        # Read back verified
        res = await client.get(f"/api/farms/{farm1_id}/timeline-tasks", headers={"Authorization": f"Bearer {token_f1}"})
        assert res.status_code == 200
        assert res.json()["completed_tasks"]["stage-1-task-1"] is True
        assert res.json()["completed_tasks"]["stage-2-task-0"] is False

        # 6. Admin can read timeline tasks -> 200 OK
        res = await client.get(f"/api/farms/{farm1_id}/timeline-tasks", headers={"Authorization": f"Bearer {token_admin}"})
        assert res.status_code == 200
        assert res.json()["completed_tasks"]["stage-1-task-0"] is True

        # 7. Payload validation: oversized dictionary (> 100 items) rejected -> 400 Bad Request
        oversized = {f"task_{i}": True for i in range(105)}
        res = await client.put(f"/api/farms/{farm1_id}/timeline-tasks", headers={"Authorization": f"Bearer {token_f1}"}, json={"completed_tasks": oversized})
        assert res.status_code == 400
