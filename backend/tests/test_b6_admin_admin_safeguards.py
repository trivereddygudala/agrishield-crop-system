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
async def reset_test_state():
    db_instance.db = mock_db
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.predictions.records = []
    mock_db.iot_telemetry.records = []
    mock_db.notifications.records = []
    yield
    mock_db.users.records = []
    mock_db.predictions.records = []
    mock_db.iot_telemetry.records = []
    mock_db.notifications.records = []

def create_user_doc(uid: ObjectId, role: str, email: str, name: str = "Test User"):
    return {
        "_id": uid,
        "id": str(uid),
        "name": name,
        "email": email,
        "role": role,
        "phone": "9876543210",
        "farm_location": "Andhra Pradesh",
        "preferred_language": "en",
        "farm_profile_completed": True
    }

# ---------------------------------------------------------------------------
# 1. Admin Self-Deletion Safeguard
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_admin_cannot_delete_self():
    """Verify an active admin cannot delete their own account."""
    admin_id = ObjectId()
    admin_doc = create_user_doc(admin_id, "admin", "admin1@agrishield.com", "Admin One")
    # Also seed a second admin so last-admin is not the reason
    admin2_id = ObjectId()
    admin2_doc = create_user_doc(admin2_id, "admin", "admin2@agrishield.com", "Admin Two")
    mock_db.users.records = [admin_doc, admin2_doc]

    token = create_access_token(subject=str(admin_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.delete(
            f"/api/admin/users/{str(admin_id)}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 400
        assert "Cannot delete your own active administrator account" in res.json().get("detail", "")

    # Verify destructive DB operation was NOT executed
    user_in_db = await mock_db.users.find_one({"_id": admin_id})
    assert user_in_db is not None
    assert user_in_db["role"] == "admin"

# ---------------------------------------------------------------------------
# 2. Admin Self-Demotion Safeguard (via /role and via details PUT)
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_admin_cannot_demote_self_via_role_endpoint():
    """Verify an active admin cannot demote their own account via /role."""
    admin_id = ObjectId()
    admin_doc = create_user_doc(admin_id, "admin", "admin1@agrishield.com", "Admin One")
    admin2_id = ObjectId()
    admin2_doc = create_user_doc(admin2_id, "admin", "admin2@agrishield.com", "Admin Two")
    mock_db.users.records = [admin_doc, admin2_doc]

    token = create_access_token(subject=str(admin_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/admin/users/{str(admin_id)}/role?new_role=farmer",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 400
        assert "Cannot demote your own active administrator account" in res.json().get("detail", "")

    user_in_db = await mock_db.users.find_one({"_id": admin_id})
    assert user_in_db is not None
    assert user_in_db["role"] == "admin"

@pytest.mark.anyio
async def test_admin_cannot_demote_self_via_details_endpoint():
    """Verify an active admin cannot demote their own account via PUT /users/{id}."""
    admin_id = ObjectId()
    admin_doc = create_user_doc(admin_id, "admin", "admin1@agrishield.com", "Admin One")
    admin2_id = ObjectId()
    admin2_doc = create_user_doc(admin2_id, "admin", "admin2@agrishield.com", "Admin Two")
    mock_db.users.records = [admin_doc, admin2_doc]

    token = create_access_token(subject=str(admin_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/admin/users/{str(admin_id)}",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "farmer", "name": "Changed Name"}
        )
        assert res.status_code == 400
        assert "Cannot demote your own active administrator account" in res.json().get("detail", "")

    user_in_db = await mock_db.users.find_one({"_id": admin_id})
    assert user_in_db is not None
    assert user_in_db["role"] == "admin"

# ---------------------------------------------------------------------------
# 3. Sole Remaining Admin Safeguards (Sole Admin Lockout Protection)
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_sole_remaining_admin_cannot_be_deleted():
    """Verify the sole remaining admin in the database cannot be deleted."""
    sole_admin_id = ObjectId()
    sole_admin_doc = create_user_doc(sole_admin_id, "admin", "soleadmin@agrishield.com", "Sole Admin")
    mock_db.users.records = [sole_admin_doc]

    token = create_access_token(subject=str(sole_admin_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.delete(
            f"/api/admin/users/{str(sole_admin_id)}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 400
        # Will reject with self-delete or last-admin safeguard
        detail = res.json().get("detail", "")
        assert "Cannot delete" in detail

    user_in_db = await mock_db.users.find_one({"_id": sole_admin_id})
    assert user_in_db is not None

@pytest.mark.anyio
async def test_sole_remaining_admin_cannot_be_demoted():
    """Verify the sole remaining admin cannot be demoted."""
    sole_admin_id = ObjectId()
    sole_admin_doc = create_user_doc(sole_admin_id, "admin", "soleadmin@agrishield.com", "Sole Admin")
    mock_db.users.records = [sole_admin_doc]

    token = create_access_token(subject=str(sole_admin_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/admin/users/{str(sole_admin_id)}/role?new_role=equipment_provider",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 400
        detail = res.json().get("detail", "")
        assert "Cannot demote" in detail

    user_in_db = await mock_db.users.find_one({"_id": sole_admin_id})
    assert user_in_db is not None
    assert user_in_db["role"] == "admin"

# ---------------------------------------------------------------------------
# 4. Multi-Admin Legitimate Actions
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_admin_can_demote_another_admin_when_multiple_admins_remain():
    """Verify Admin A can demote Admin B when Admin C ensures >= 1 admin remains."""
    admin_a_id = ObjectId()
    admin_b_id = ObjectId()
    admin_c_id = ObjectId()

    mock_db.users.records = [
        create_user_doc(admin_a_id, "admin", "admin_a@agrishield.com", "Admin A"),
        create_user_doc(admin_b_id, "admin", "admin_b@agrishield.com", "Admin B"),
        create_user_doc(admin_c_id, "admin", "admin_c@agrishield.com", "Admin C"),
    ]

    token_a = create_access_token(subject=str(admin_a_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/admin/users/{str(admin_b_id)}/role?new_role=researcher",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res.status_code == 200
        assert "Successfully updated" in res.json().get("message", "")

    user_b = await mock_db.users.find_one({"_id": admin_b_id})
    assert user_b["role"] == "researcher"

@pytest.mark.anyio
async def test_admin_cannot_demote_another_admin_if_only_one_admin_left():
    """Verify Admin A cannot demote Admin B if Admin B is the last admin (e.g. edge case or count <= 1)."""
    admin_a_id = ObjectId()
    admin_b_id = ObjectId()

    mock_db.users.records = [
        create_user_doc(admin_a_id, "admin", "admin_a@agrishield.com", "Admin A"),
        create_user_doc(admin_b_id, "farmer", "user_b@agrishield.com", "User B"),
    ]

    token_a = create_access_token(subject=str(admin_a_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # User B is not an admin, so promoting user B to admin works
        res_promote = await ac.put(
            f"/api/admin/users/{str(admin_b_id)}/role?new_role=admin",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_promote.status_code == 200

        # Now 2 admins exist (A and B). Admin A demotes Admin B:
        res_demote = await ac.put(
            f"/api/admin/users/{str(admin_b_id)}/role?new_role=farmer",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_demote.status_code == 200

        # Now only 1 admin exists (Admin A). If someone tries to demote Admin A:
        res_demote_last = await ac.put(
            f"/api/admin/users/{str(admin_a_id)}/role?new_role=farmer",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_demote_last.status_code == 400
        assert "Cannot demote" in res_demote_last.json().get("detail", "")

@pytest.mark.anyio
async def test_admin_can_delete_another_admin_when_multiple_admins_remain():
    """Verify Admin A can delete Admin B when Admin C ensures >= 1 admin remains."""
    admin_a_id = ObjectId()
    admin_b_id = ObjectId()
    admin_c_id = ObjectId()

    mock_db.users.records = [
        create_user_doc(admin_a_id, "admin", "admin_a@agrishield.com", "Admin A"),
        create_user_doc(admin_b_id, "admin", "admin_b@agrishield.com", "Admin B"),
        create_user_doc(admin_c_id, "admin", "admin_c@agrishield.com", "Admin C"),
    ]

    token_a = create_access_token(subject=str(admin_a_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.delete(
            f"/api/admin/users/{str(admin_b_id)}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res.status_code == 200
        assert res.json().get("status") == "success"

    user_b = await mock_db.users.find_one({"_id": admin_b_id})
    assert user_b is None

@pytest.mark.anyio
async def test_admin_cannot_delete_another_admin_when_it_would_leave_zero_admins():
    """Verify that if two admins exist, Admin A deleting Admin B leaves Admin A (valid).
    But if Admin B is the last remaining admin in the system, deleting Admin B is rejected."""
    admin_a_id = ObjectId()
    admin_b_id = ObjectId()

    # Suppose Admin A was demoted or not role=admin in db, leaving only Admin B as admin
    mock_db.users.records = [
        create_user_doc(admin_a_id, "admin", "admin_a@agrishield.com", "Admin A"),
        create_user_doc(admin_b_id, "admin", "admin_b@agrishield.com", "Admin B"),
    ]

    token_a = create_access_token(subject=str(admin_a_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Admin A deletes Admin B (leaves 1 admin: Admin A) -> Allowed
        res1 = await ac.delete(
            f"/api/admin/users/{str(admin_b_id)}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res1.status_code == 200

        # Now only Admin A is left. Admin A attempting to delete Admin A -> Rejected
        res2 = await ac.delete(
            f"/api/admin/users/{str(admin_a_id)}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res2.status_code == 400
        assert "Cannot delete" in res2.json().get("detail", "")

# ---------------------------------------------------------------------------
# 5. Normal Non-Admin Operations
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_normal_farmer_role_update_functional():
    """Verify normal farmer role updates remain fully functional."""
    admin_id = ObjectId()
    farmer_id = ObjectId()

    mock_db.users.records = [
        create_user_doc(admin_id, "admin", "admin@agrishield.com", "Admin"),
        create_user_doc(farmer_id, "farmer", "farmer@agrishield.com", "Farmer"),
    ]

    token = create_access_token(subject=str(admin_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/admin/users/{str(farmer_id)}/role?new_role=equipment_provider",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        assert "Successfully updated" in res.json().get("message", "")

    user_farmer = await mock_db.users.find_one({"_id": farmer_id})
    assert user_farmer["role"] == "equipment_provider"

@pytest.mark.anyio
async def test_normal_deletion_of_non_admin_functional():
    """Verify normal deletion of a non-admin user remains fully functional."""
    admin_id = ObjectId()
    farmer_id = ObjectId()

    mock_db.users.records = [
        create_user_doc(admin_id, "admin", "admin@agrishield.com", "Admin"),
        create_user_doc(farmer_id, "farmer", "farmer@agrishield.com", "Farmer"),
    ]

    token = create_access_token(subject=str(admin_id), role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.delete(
            f"/api/admin/users/{str(farmer_id)}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        assert res.json().get("status") == "success"

    user_farmer = await mock_db.users.find_one({"_id": farmer_id})
    assert user_farmer is None

# ---------------------------------------------------------------------------
# 6. Unauthorized & Non-Admin Rejection
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_unauthorized_and_farmer_callers_rejected():
    """Verify anonymous and farmer callers cannot delete users or update roles."""
    farmer_id = ObjectId()
    target_id = ObjectId()

    mock_db.users.records = [
        create_user_doc(farmer_id, "farmer", "farmer@agrishield.com", "Farmer"),
        create_user_doc(target_id, "farmer", "target@agrishield.com", "Target"),
    ]

    farmer_token = create_access_token(subject=str(farmer_id), role="farmer")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Anonymous DELETE
        res_anon_del = await ac.delete(f"/api/admin/users/{str(target_id)}")
        assert res_anon_del.status_code == 401

        # Farmer DELETE
        res_farmer_del = await ac.delete(
            f"/api/admin/users/{str(target_id)}",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert res_farmer_del.status_code == 403

        # Anonymous PUT role
        res_anon_role = await ac.put(f"/api/admin/users/{str(target_id)}/role?new_role=admin")
        assert res_anon_role.status_code == 401

        # Farmer PUT role
        res_farmer_role = await ac.put(
            f"/api/admin/users/{str(target_id)}/role?new_role=admin",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert res_farmer_role.status_code == 403
