import pytest
from httpx import ASGITransport, AsyncClient
from bson import ObjectId

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase

# Setup Mock database for testing
mock_db = MockDatabase()
db_instance.db = mock_db

# Ensure mock find accepts projection arguments like PyMongo
_orig_mock_find = mock_db.devices.__class__.find
def _flexible_find(self, query, *args, **kwargs):
    return _orig_mock_find(self, query)
mock_db.devices.__class__.find = _flexible_find

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def clean_mock_data():
    db_instance.db = mock_db
    app.dependency_overrides[get_database] = override_get_database
    mock_db.devices.records = []
    mock_db.users.records = []
    yield
    mock_db.devices.records = []
    mock_db.users.records = []

async def create_test_user(name: str, email: str, role: str):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "name": name,
        "email": email,
        "role": role,
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token

# ============================================================================
# FINDING-01: SSRF & Proxy Authentication / Authorization Tests
# ============================================================================

@pytest.mark.anyio
async def test_finding_01_anonymous_proxy_rejected():
    """Anonymous callers MUST be rejected with HTTP 401 before outbound network access."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Anonymous POST /proxy
        res_post = await ac.post("/api/v1/devices/proxy", json={"ip": "192.0.2.1", "endpoint": "/status"})
        assert res_post.status_code == 401, f"Expected 401, got {res_post.status_code}"

        # 2. Anonymous GET /proxy-download
        res_get = await ac.get("/api/v1/devices/proxy-download", params={"ip": "192.0.2.1", "endpoint": "/file"})
        assert res_get.status_code == 401, f"Expected 401, got {res_get.status_code}"

@pytest.mark.anyio
async def test_finding_01_provider_proxy_forbidden():
    """Equipment Providers MUST be rejected with HTTP 403."""
    _, provider_token = await create_test_user("Provider Bob", "provider@test.com", "provider")
    headers = {"Authorization": f"Bearer {provider_token}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_post = await ac.post("/api/v1/devices/proxy", json={"ip": "192.168.1.50", "endpoint": "/status"}, headers=headers)
        assert res_post.status_code == 403, f"Expected 403, got {res_post.status_code}"

        res_get = await ac.get("/api/v1/devices/proxy-download", params={"ip": "192.168.1.50", "endpoint": "/file"}, headers=headers)
        assert res_get.status_code == 403, f"Expected 403, got {res_get.status_code}"

@pytest.mark.anyio
async def test_finding_01_ssrf_destination_validation():
    """Dangerous destinations (loopback, cloud metadata, hostnames) MUST be rejected with 400 BEFORE outbound network access."""
    _, farmer_token = await create_test_user("Farmer Dave", "farmer@test.com", "farmer")
    headers = {"Authorization": f"Bearer {farmer_token}"}
    
    dangerous_targets = [
        "127.0.0.1",
        "127.0.0.2",
        "::1",
        "169.254.169.254",
        "localhost",
        "metadata.google.internal",
        "http://127.0.0.1:8000"
    ]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        for target in dangerous_targets:
            res_post = await ac.post("/api/v1/devices/proxy", json={"ip": target, "endpoint": "/status"}, headers=headers)
            assert res_post.status_code == 400, f"Target {target} should be rejected with 400, got {res_post.status_code}"

            res_get = await ac.get("/api/v1/devices/proxy-download", params={"ip": target, "endpoint": "/file"}, headers=headers)
            assert res_get.status_code == 400, f"Target {target} should be rejected with 400, got {res_get.status_code}"

@pytest.mark.anyio
async def test_finding_01_farmer_device_ownership_isolation():
    """Farmer cannot proxy requests to an IP registered to a different farmer."""
    farmer_1_id, farmer_1_token = await create_test_user("Farmer One", "farmer1@test.com", "farmer")
    farmer_2_id, _ = await create_test_user("Farmer Two", "farmer2@test.com", "farmer")
    
    # Register device belonging to farmer 2
    mock_db.devices.records.append({
        "device_id": "esp32_other",
        "user_id": farmer_2_id,
        "ip": "192.168.1.99"
    })
    
    headers = {"Authorization": f"Bearer {farmer_1_token}"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/devices/proxy", json={"ip": "192.168.1.99", "endpoint": "/status"}, headers=headers)
        assert res.status_code == 403, f"Expected 403 ownership violation, got {res.status_code}"
        assert "another farmer" in res.json().get("detail", "")

@pytest.mark.anyio
async def test_finding_01_admin_proxy_authorized(monkeypatch):
    """Admin is authorized to proxy requests to devices."""
    from unittest.mock import AsyncMock, MagicMock
    _, admin_token = await create_test_user("Admin User", "admin@test.com", "admin")
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "application/json"}
    mock_resp.json.return_value = {"device": "online"}
    mock_resp.text = '{"device": "online"}'

    async def mock_get(self, url, headers=None, **kwargs):
        assert url == "http://192.168.1.50/status"
        assert headers.get("X-API-Key") == "crop_iot_secure_key_2026"
        return mock_resp

    monkeypatch.setattr("httpx.AsyncClient.get", mock_get)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/devices/proxy", json={"ip": "192.168.1.50", "endpoint": "/status"}, headers=headers)
        assert res.status_code == 200
        assert res.json() == {"device": "online"}

# ============================================================================
# FINDING-02: Device Status Scoping Tests
# ============================================================================

@pytest.mark.anyio
async def test_finding_02_status_anonymous_rejected():
    """Anonymous callers MUST receive HTTP 401 when requesting device status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/devices/status")
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"

@pytest.mark.anyio
async def test_finding_02_status_role_scoping():
    """
    Verify:
    1. Farmer receives ONLY devices registered under their user_id.
    2. Provider receives empty list [] (no farmer IoT device access).
    3. Admin receives complete device list across all users.
    """
    farmer_a_id, farmer_a_token = await create_test_user("Farmer A", "farmer_a@test.com", "farmer")
    farmer_b_id, farmer_b_token = await create_test_user("Farmer B", "farmer_b@test.com", "farmer")
    _, provider_token = await create_test_user("Provider P", "provider@test.com", "provider")
    _, admin_token = await create_test_user("Admin Master", "admin@test.com", "admin")
    
    # Populate mock devices
    mock_db.devices.records = [
        {"device_id": "dev_a1", "user_id": farmer_a_id, "name": "Node A1", "ip": "192.168.1.10", "last_seen": "2026-09-26T10:00:00Z"},
        {"device_id": "dev_a2", "user_id": farmer_a_id, "name": "Node A2", "ip": "192.168.1.11", "last_seen": "2026-09-26T10:00:00Z"},
        {"device_id": "dev_b1", "user_id": farmer_b_id, "name": "Node B1", "ip": "192.168.1.20", "last_seen": "2026-09-26T10:00:00Z"}
    ]
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Farmer A gets ONLY dev_a1 and dev_a2
        res_a = await ac.get("/api/v1/devices/status", headers={"Authorization": f"Bearer {farmer_a_token}"})
        assert res_a.status_code == 200
        devices_a = res_a.json()
        assert len(devices_a) == 2
        assert {d["device_id"] for d in devices_a} == {"dev_a1", "dev_a2"}
        
        # 2. Farmer B gets ONLY dev_b1
        res_b = await ac.get("/api/v1/devices/status", headers={"Authorization": f"Bearer {farmer_b_token}"})
        assert res_b.status_code == 200
        devices_b = res_b.json()
        assert len(devices_b) == 1
        assert devices_b[0]["device_id"] == "dev_b1"
        
        # 3. Provider gets empty list
        res_p = await ac.get("/api/v1/devices/status", headers={"Authorization": f"Bearer {provider_token}"})
        assert res_p.status_code == 200
        assert res_p.json() == []
        
        # 4. Admin gets ALL devices (dev_a1, dev_a2, dev_b1)
        res_admin = await ac.get("/api/v1/devices/status", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_admin.status_code == 200
        devices_admin = res_admin.json()
        assert len(devices_admin) == 3
        assert {d["device_id"] for d in devices_admin} == {"dev_a1", "dev_a2", "dev_b1"}
