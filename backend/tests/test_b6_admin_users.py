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
    yield
    mock_db.users.records = []

async def seed_users(count: int = 60):
    for i in range(count):
        uid = ObjectId()
        role = "admin" if i == 0 else ("equipment_provider" if i % 4 == 0 else "farmer")
        user_doc = {
            "_id": uid,
            "id": str(uid),
            "name": f"User {i:03d}",
            "email": f"farmer_{i:03d}@example.com" if i > 0 else "superadmin@example.com",
            "role": role,
            "phone": f"9876543{i:03d}",
            "mobile": f"9876543{i:03d}",
            "farm_location": "Andhra Pradesh" if i % 2 == 0 else "Telangana",
            "preferred_language": "te" if i % 3 == 0 else "en",
            "farming_practices": "Conventional",
            "farm_profile_completed": True if i % 2 == 0 else False,
            "provider_profile": {} if role == "equipment_provider" else None,
            "created_at": "2026-01-01T00:00:00Z"
        }
        mock_db.users.records.append(user_doc)

@pytest.mark.anyio
async def test_admin_users_pagination_page_1():
    """Verify admin can request page 1 with limit=25 and returns exactly 25 items and total=60."""
    await seed_users(60)
    admin_token = create_access_token(subject="admin-123", role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/users?page=1&limit=25",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 60
    assert data["skip"] == 0
    assert data["limit"] == 25
    assert data["page"] == 1
    assert data["total_pages"] == 3
    assert data["has_more"] is True
    assert len(data["users"]) == 25
    assert data["users"][0]["name"] == "User 000"

@pytest.mark.anyio
async def test_admin_users_pagination_page_2_and_3():
    """Verify admin can request page 2 and page 3, with skip advancing properly."""
    await seed_users(60)
    admin_token = create_access_token(subject="admin-123", role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Page 2
        res2 = await ac.get(
            "/api/admin/users?page=2&limit=25",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["page"] == 2
        assert data2["skip"] == 25
        assert len(data2["users"]) == 25
        assert data2["has_more"] is True
        assert data2["users"][0]["name"] == "User 025"

        # Page 3 (final page with remaining 10 users)
        res3 = await ac.get(
            "/api/admin/users?page=3&limit=25",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["page"] == 3
        assert data3["skip"] == 50
        assert len(data3["users"]) == 10
        assert data3["has_more"] is False
        assert data3["users"][0]["name"] == "User 050"

@pytest.mark.anyio
async def test_admin_users_skip_and_limit_direct():
    """Verify skip and limit parameters directly advance and slice users."""
    await seed_users(60)
    admin_token = create_access_token(subject="admin-123", role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/users?skip=10&limit=15",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["skip"] == 10
    assert data["limit"] == 15
    assert len(data["users"]) == 15
    assert data["users"][0]["name"] == "User 010"

@pytest.mark.anyio
async def test_admin_users_excessive_limit_rejected():
    """Verify limit > 100 is rejected by validation (422 Unprocessable Entity)."""
    await seed_users(10)
    admin_token = create_access_token(subject="admin-123", role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/users?limit=500",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    assert res.status_code == 422

@pytest.mark.anyio
async def test_unauthorized_access_rejected():
    """Verify unauthenticated user cannot access /api/admin/users."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/admin/users")
    assert res.status_code == 401

@pytest.mark.anyio
async def test_farmer_forbidden_from_admin_users():
    """Verify farmer role receives 403 Forbidden on /api/admin/users."""
    farmer_token = create_access_token(subject="farmer-123", role="farmer")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
    assert res.status_code == 403

@pytest.mark.anyio
async def test_provider_forbidden_from_admin_users():
    """Verify equipment_provider role receives 403 Forbidden on /api/admin/users."""
    provider_token = create_access_token(subject="prov-123", role="equipment_provider")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {provider_token}"}
        )
    assert res.status_code == 403

@pytest.mark.anyio
async def test_admin_users_search_filter():
    """Verify server-side keyword search filters results correctly."""
    await seed_users(30)
    admin_token = create_access_token(subject="admin-123", role="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Search by email substring
        res = await ac.get(
            "/api/admin/users?search=superadmin",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert len(data["users"]) == 1
        assert data["users"][0]["email"] == "superadmin@example.com"
