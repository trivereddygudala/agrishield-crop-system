"""
B10.3 API Pagination Boundaries Test Suite
==========================================
Validates B10-F03 standardized pagination boundaries across backend routers:
- /api/history: limit in [1, 500] (preserves frontend's limit=150)
- /api/v1/equipment/bookings: limit in [1, 5000] (preserves frontend's limit=2500)
- /api/intelligence/timeline: limit in [1, 200]
- /api/intelligence/products: limit in [1, 250]
- /api/v1/system/diagnostics/traces: limit in [1, 100]
- /api/v1/iot/telemetry/history: limit in [1, 10000]
"""

import pytest
from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from backend.app.main import app
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
from backend.app.db.mongodb import db_instance, get_database

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def setup_env():
    mock_db = MockDatabase()
    db_instance.db = mock_db
    app.dependency_overrides[get_database] = lambda: mock_db

    admin_id = ObjectId()
    await mock_db.users.insert_one({
        "_id": admin_id,
        "id": str(admin_id),
        "role": "admin",
        "name": "Super Admin"
    })
    admin_token = create_access_token(subject=str(admin_id), role="admin")

    farmer_id = ObjectId()
    await mock_db.users.insert_one({
        "_id": farmer_id,
        "id": str(farmer_id),
        "role": "farmer",
        "name": "Test Farmer"
    })
    farmer_token = create_access_token(subject=str(farmer_id), role="farmer")

    yield {
        "db": mock_db,
        "admin_token": admin_token,
        "farmer_token": farmer_token,
        "farmer_id": str(farmer_id)
    }

    app.dependency_overrides.pop(get_database, None)

# ---------------------------------------------------------------------------
# 1. /api/history bounds
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_predict_history_pagination_accepted_limits(setup_env):
    """Verify limit=150 (frontend default) and limit=500 are accepted."""
    headers = {"Authorization": f"Bearer {setup_env['farmer_token']}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r150 = await ac.get("/api/history?limit=150", headers=headers)
        assert r150.status_code == 200

        r500 = await ac.get("/api/history?limit=500", headers=headers)
        assert r500.status_code == 200

@pytest.mark.anyio
async def test_predict_history_pagination_rejected_limits(setup_env):
    """Verify limit=501 and limit=0 return HTTP 422 Unprocessable Entity."""
    headers = {"Authorization": f"Bearer {setup_env['farmer_token']}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r501 = await ac.get("/api/history?limit=501", headers=headers)
        assert r501.status_code == 422

        r0 = await ac.get("/api/history?limit=0", headers=headers)
        assert r0.status_code == 422

# ---------------------------------------------------------------------------
# 2. /api/v1/equipment/bookings bounds
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_equipment_bookings_pagination_accepted_limits(setup_env):
    """Verify limit=2500 (frontend default) and limit=5000 are accepted."""
    headers = {"Authorization": f"Bearer {setup_env['farmer_token']}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r2500 = await ac.get("/api/v1/equipment/bookings?limit=2500", headers=headers)
        assert r2500.status_code == 200

        r5000 = await ac.get("/api/v1/equipment/bookings?limit=5000", headers=headers)
        assert r5000.status_code == 200

@pytest.mark.anyio
async def test_equipment_bookings_pagination_rejected_limits(setup_env):
    """Verify limit=5001 and limit=0 return HTTP 422."""
    headers = {"Authorization": f"Bearer {setup_env['farmer_token']}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r5001 = await ac.get("/api/v1/equipment/bookings?limit=5001", headers=headers)
        assert r5001.status_code == 422

        r0 = await ac.get("/api/v1/equipment/bookings?limit=0", headers=headers)
        assert r0.status_code == 422

# ---------------------------------------------------------------------------
# 3. /api/intelligence/timeline bounds
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_timeline_pagination_limits(setup_env):
    """Verify timeline limit=200 accepted, limit=201 rejected with 422, limit=0 rejected with 422."""
    headers = {"Authorization": f"Bearer {setup_env['farmer_token']}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r200 = await ac.get("/api/intelligence/timeline?limit=200", headers=headers)
        assert r200.status_code == 200

        r201 = await ac.get("/api/intelligence/timeline?limit=201", headers=headers)
        assert r201.status_code == 422

        r0 = await ac.get("/api/intelligence/timeline?limit=0", headers=headers)
        assert r0.status_code == 422

# ---------------------------------------------------------------------------
# 4. /api/intelligence/products bounds
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_products_pagination_limits():
    """Verify products limit=250 accepted, limit=251 rejected with 422, limit=0 rejected with 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r250 = await ac.get("/api/intelligence/products?limit=250")
        assert r250.status_code == 200

        r251 = await ac.get("/api/intelligence/products?limit=251")
        assert r251.status_code == 422

        r0 = await ac.get("/api/intelligence/products?limit=0")
        assert r0.status_code == 422

# ---------------------------------------------------------------------------
# 5. /api/v1/system/diagnostics/traces bounds
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_diagnostics_traces_pagination_limits(setup_env):
    """Verify diagnostics traces limit=100 accepted, limit=101 rejected with 422, limit=0 rejected with 422."""
    headers = {"Authorization": f"Bearer {setup_env['admin_token']}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r100 = await ac.get("/api/v1/system/diagnostics/traces?limit=100", headers=headers)
        assert r100.status_code == 200

        r101 = await ac.get("/api/v1/system/diagnostics/traces?limit=101", headers=headers)
        assert r101.status_code == 422

        r0 = await ac.get("/api/v1/system/diagnostics/traces?limit=0", headers=headers)
        assert r0.status_code == 422

# ---------------------------------------------------------------------------
# 6. /api/v1/iot/telemetry/history bounds
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_telemetry_history_pagination_limits(setup_env):
    """Verify telemetry history limit=10000 accepted, limit=10001 rejected with 422, limit=0 rejected with 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Request timeframe=raw with empty DB
        r10000 = await ac.get("/api/v1/iot/telemetry/history?timeframe=raw&limit=10000")
        assert r10000.status_code == 200

        r10001 = await ac.get("/api/v1/iot/telemetry/history?limit=10001")
        assert r10001.status_code == 422

        r0 = await ac.get("/api/v1/iot/telemetry/history?limit=0")
        assert r0.status_code == 422
