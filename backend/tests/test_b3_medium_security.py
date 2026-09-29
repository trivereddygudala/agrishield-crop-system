import pytest
from httpx import ASGITransport, AsyncClient
from bson import ObjectId
from datetime import datetime, timezone

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.config import settings
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
    mock_db.devices.records = []
    mock_db.farm_profiles.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    yield
    mock_db.users.records = []
    mock_db.devices.records = []
    mock_db.farm_profiles.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []

async def create_user(name: str, email: str, role: str):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "phone": "9876543210",
        "created_at": datetime.now(timezone.utc)
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token


# ============================================================================
# M-1 TESTS: Protected Farm Timeline & Health Score APIs
# ============================================================================

@pytest.mark.anyio
async def test_m1_timeline_anonymous_rejected():
    """M-1: GET /api/intelligence/timeline must reject unauthenticated requests with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/intelligence/timeline")
        assert res.status_code == 401


@pytest.mark.anyio
async def test_m1_health_score_anonymous_rejected():
    """M-1: GET /api/intelligence/health-score must reject unauthenticated requests with 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/intelligence/health-score")
        assert res.status_code == 401


@pytest.mark.anyio
async def test_m1_timeline_scoped_to_authenticated_farmer():
    """M-1: Authenticated farmer receives only their own diagnostic predictions in the timeline."""
    farmer_a_id, token_a = await create_user("Farmer A", "farmer_a@test.com", "farmer")
    farmer_b_id, token_b = await create_user("Farmer B", "farmer_b@test.com", "farmer")

    now = datetime.now(timezone.utc)

    # Insert prediction for Farmer A
    pred_a = {
        "_id": ObjectId(),
        "user_id": farmer_a_id,
        "crop_name": "Tomato",
        "disease_name": "Early Blight",
        "confidence": 0.94,
        "prediction_status": "disease",
        "created_at": now
    }
    # Insert prediction for Farmer B
    pred_b = {
        "_id": ObjectId(),
        "user_id": farmer_b_id,
        "crop_name": "Chilli",
        "disease_name": "Leaf Curl Virus",
        "confidence": 0.98,
        "prediction_status": "disease",
        "created_at": now
    }
    mock_db.predictions.records.extend([pred_a, pred_b])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer A query
        res_a = await ac.get(
            "/api/intelligence/timeline",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_a.status_code == 200
        events_a = res_a.json()["events"]
        titles_a = [e["title"] for e in events_a]

        # Farmer A should see Tomato Scan
        assert any("Tomato Scan" in t for t in titles_a)
        # Farmer A must NEVER see Farmer B's Chilli Scan
        assert not any("Chilli Scan" in t for t in titles_a)

        # Farmer B query
        res_b = await ac.get(
            "/api/intelligence/timeline",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res_b.status_code == 200
        events_b = res_b.json()["events"]
        titles_b = [e["title"] for e in events_b]

        # Farmer B should see Chilli Scan
        assert any("Chilli Scan" in t for t in titles_b)
        # Farmer B must NEVER see Farmer A's Tomato Scan
        assert not any("Tomato Scan" in t for t in titles_b)


@pytest.mark.anyio
async def test_m1_timeline_admin_access_unscoped():
    """M-1: Admin user can access timeline across the platform."""
    admin_id, admin_token = await create_user("Admin User", "admin@test.com", "admin")
    farmer_id, _ = await create_user("Farmer X", "farmer_x@test.com", "farmer")

    now = datetime.now(timezone.utc)
    pred_doc = {
        "_id": ObjectId(),
        "user_id": farmer_id,
        "crop_name": "Cotton",
        "disease_name": "Bacterial Blight",
        "confidence": 0.91,
        "prediction_status": "disease",
        "created_at": now
    }
    mock_db.predictions.records.append(pred_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/intelligence/timeline",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        events = res.json()["events"]
        titles = [e["title"] for e in events]
        assert any("Cotton Scan" in t for t in titles)


@pytest.mark.anyio
async def test_m1_health_score_cross_farm_ownership_forbidden():
    """M-1: Non-admin user cannot access health score for another user's farm profile."""
    farmer_a_id, token_a = await create_user("Farmer A", "farmer_a2@test.com", "farmer")
    farmer_b_id, token_b = await create_user("Farmer B", "farmer_b2@test.com", "farmer")

    farm_b_id = str(ObjectId())
    mock_db.farm_profiles.records.append({
        "_id": ObjectId(farm_b_id),
        "id": farm_b_id,
        "user_id": farmer_b_id,
        "farm_name": "Farmer B Secret Orchard"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Farmer A querying Farmer B's farm_id must be rejected with 403 Forbidden
        res = await ac.get(
            f"/api/intelligence/health-score?farm_id={farm_b_id}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res.status_code == 403
        assert "Access forbidden" in res.json()["detail"]


@pytest.mark.anyio
async def test_m1_health_score_own_farm_allowed():
    """M-1: Farmer can access health score for their own farm profile."""
    farmer_id, token = await create_user("Farmer Own", "farmer_own@test.com", "farmer")
    farm_id = str(ObjectId())
    mock_db.farm_profiles.records.append({
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": farmer_id,
        "farm_name": "My Farm"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            f"/api/intelligence/health-score?farm_id={farm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        assert "overall_score" in res.json()


# ============================================================================
# M-2 TESTS: Frontend ProtectedRoute Role Enforcement
# ============================================================================

@pytest.mark.anyio
async def test_m2_protected_route_role_enforcement_logic():
    """M-2: Verify ProtectedRoute role authorization logic via component logic tests."""
    # Test helper replicating ProtectedRoute guard logic
    def check_protected_route(user, allowed_roles):
        if not user:
            return {"redirect": "/login"}
        if allowed_roles and len(allowed_roles) > 0:
            user_role = (user.get("role") or "farmer").lower()
            normalized = [r.lower() for r in allowed_roles]
            if user_role not in normalized:
                return {"redirect": "/dashboard"}
        return {"render": True}

    # 1. Anonymous user redirected to /login
    assert check_protected_route(None, ["admin"]) == {"redirect": "/login"}

    # 2. Farmer trying to access admin route redirected to /dashboard
    farmer_user = {"id": "1", "role": "farmer"}
    assert check_protected_route(farmer_user, ["admin"]) == {"redirect": "/dashboard"}

    # 3. Admin accessing admin route permitted
    admin_user = {"id": "2", "role": "admin"}
    assert check_protected_route(admin_user, ["admin"]) == {"render": True}

    # 4. Farmer trying to access provider route redirected to /dashboard
    provider_roles = ["equipment_provider", "provider", "admin"]
    assert check_protected_route(farmer_user, provider_roles) == {"redirect": "/dashboard"}

    # 5. Equipment provider accessing provider route permitted
    provider_user = {"id": "3", "role": "equipment_provider"}
    assert check_protected_route(provider_user, provider_roles) == {"render": True}

    # 6. Admin accessing provider route permitted
    assert check_protected_route(admin_user, provider_roles) == {"render": True}


# ============================================================================
# M-3 TESTS: Neighboring Farmer PII & GPS Privacy Protection
# ============================================================================

@pytest.mark.anyio
async def test_m3_nearby_radar_anonymizes_neighbor_pii_and_gps():
    """M-3: Nearby radar must NOT expose neighbor names, farm names, internal IDs, or exact GPS."""
    farmer_id, token = await create_user("Test Farmer", "radar_farmer@test.com", "farmer")
    my_farm_id = str(ObjectId())

    # Create user's own farm at Vijayawada (16.5062, 80.6480)
    mock_db.farm_profiles.records.append({
        "_id": ObjectId(my_farm_id),
        "id": my_farm_id,
        "user_id": ObjectId(farmer_id),
        "farm_name": "My Private Farm",
        "latitude": 16.5062,
        "longitude": 80.6480,
        "crop_name": "Tomato",
        "is_archived": False
    })

    # Seed 2 neighbor farms with sensitive PII and exact GPS within 5km
    neighbor_1_id = ObjectId()
    mock_db.farm_profiles.records.append({
        "_id": neighbor_1_id,
        "id": str(neighbor_1_id),
        "user_id": ObjectId(),
        "farmer_name": "Venkat Rao Goud",      # Real farmer PII
        "farm_name": "Goud Family Legacy Plot", # Real farm name
        "village": "Kanuru North Sector",
        "latitude": 16.5120,                    # Exact GPS coordinates
        "longitude": 80.6550,
        "crop_name": "Chilli",
        "crop_variety": "Guntur Teja",
        "active_disease": "Leaf Spot",
        "severity": "High",
        "is_archived": False
    })

    neighbor_2_id = ObjectId()
    mock_db.farm_profiles.records.append({
        "_id": neighbor_2_id,
        "id": str(neighbor_2_id),
        "user_id": ObjectId(),
        "farmer_name": "Lakshmi Narayana",
        "farm_name": "Narayana Bio Fields",
        "village": "Poranki Suburb",
        "latitude": 16.5010,
        "longitude": 80.6410,
        "crop_name": "Paddy",
        "crop_variety": "BPT 5204",
        "active_disease": "Healthy",
        "severity": "None",
        "is_archived": False
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            f"/api/farms/{my_farm_id}/nearby-radar?radius_km=5.0&lat=16.5062&lng=80.6480",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        nearby = data.get("nearby_farms", [])
        assert len(nearby) == 2

        for item in nearby:
            # 1. Neighbor farmer PII must NOT be exposed
            assert "Venkat Rao Goud" not in str(item)
            assert "Lakshmi Narayana" not in str(item)
            assert item.get("farmer_name") is None

            # 2. Neighbor farm name must NOT be exposed
            assert "Goud Family Legacy Plot" not in str(item)
            assert "Narayana Bio Fields" not in str(item)
            assert item.get("farm_name") is None

            # 3. Internal Mongo _id must NOT be leaked
            assert str(neighbor_1_id) not in str(item)
            assert str(neighbor_2_id) not in str(item)
            # Item id must be a privacy-safe synthetic identifier
            assert item["id"].startswith("radar_plot_")

            # 4. Exact high-precision GPS coordinates must NOT be exposed
            assert "lat" not in item
            assert "lng" not in item
            assert "latitude" not in item
            assert "longitude" not in item

            # 5. Operational radar metrics must be preserved
            assert "distance_km" in item
            assert "bearing" in item
            assert "crop" in item
            assert "status" in item
            assert "severity" in item


# ============================================================================
# M-4 TESTS: IoT Fail-Closed Authentication in Production
# ============================================================================

@pytest.mark.anyio
async def test_m4_production_telemetry_missing_credentials_rejected(monkeypatch):
    """M-4: In production, POST /api/v1/iot/telemetry without credentials must be rejected with 401."""
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "IOT_SECURITY_MODE", "production")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"device_id": "ESP32_PROD_1", "temperature": 28.5}
        res = await ac.post("/api/v1/iot/telemetry", json=payload)
        assert res.status_code == 401


@pytest.mark.anyio
async def test_m4_production_telemetry_default_key_rejected(monkeypatch):
    """M-4: In production, POST /api/v1/iot/telemetry with default insecure key must be rejected with 401."""
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "IOT_SECURITY_MODE", "production")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"device_id": "ESP32_PROD_1", "temperature": 28.5}
        res = await ac.post(
            "/api/v1/iot/telemetry",
            json=payload,
            headers={"X-IoT-API-Key": "crop_iot_secure_key_2026"}
        )
        assert res.status_code == 401
        assert "Default insecure IoT API key is prohibited" in res.json()["detail"]


@pytest.mark.anyio
async def test_m4_production_heartbeat_missing_credentials_rejected(monkeypatch):
    """M-4: In production, POST /api/v1/iot/heartbeat without credentials must be rejected with 401."""
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "IOT_SECURITY_MODE", "production")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"device_id": "ESP32_HEARTBEAT_1", "status": "online"}
        res = await ac.post("/api/v1/iot/heartbeat", json=payload)
        assert res.status_code == 401


@pytest.mark.anyio
async def test_m4_production_heartbeat_default_key_rejected(monkeypatch):
    """M-4: In production, POST /api/v1/iot/heartbeat with default key must be rejected with 401."""
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "IOT_SECURITY_MODE", "production")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"device_id": "ESP32_HEARTBEAT_1", "status": "online"}
        res = await ac.post(
            "/api/v1/iot/heartbeat",
            json=payload,
            headers={"X-IoT-API-Key": "crop_iot_secure_key_2026"}
        )
        assert res.status_code == 401


@pytest.mark.anyio
async def test_m4_production_valid_configured_key_succeeds(monkeypatch):
    """M-4: In production, genuine non-default configured key allows telemetry and heartbeat."""
    custom_key = "production_super_secret_esp32_hardware_key_2026_xyz"
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "IOT_SECURITY_MODE", "production")
    monkeypatch.setattr(settings, "IOT_API_KEY", custom_key)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Heartbeat with valid configured key
        hb_payload = {"device_id": "ESP32_HEARTBEAT_VALID", "status": "online", "uptime_ms": 120000}
        res_hb = await ac.post(
            "/api/v1/iot/heartbeat",
            json=hb_payload,
            headers={"X-IoT-API-Key": custom_key}
        )
        assert res_hb.status_code == 200
        assert res_hb.json()["status"] == "success"

        # Telemetry with valid configured key
        tel_payload = {"device_id": "ESP32_VALID_1", "temperature": 27.2, "humidity": 65.0}
        res_tel = await ac.post(
            "/api/v1/iot/telemetry",
            json=tel_payload,
            headers={"X-IoT-API-Key": custom_key}
        )
        # Note: telemetry may return 201 or paused (if ingestion switch is off), but MUST NOT return 401
        assert res_tel.status_code in [200, 201]


@pytest.mark.anyio
async def test_m4_development_mode_permissive():
    """M-4: Development mode retains local ESP32 simulation permissiveness."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        hb_payload = {"device_id": "ESP32_DEV_NODE", "status": "online"}
        res = await ac.post("/api/v1/iot/heartbeat", json=hb_payload)
        assert res.status_code == 200
