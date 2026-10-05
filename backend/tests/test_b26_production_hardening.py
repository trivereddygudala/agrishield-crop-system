import pytest
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from bson import ObjectId
from pymongo.errors import AutoReconnect

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
from backend.app.services.harvest_market_service import HarvestMarketService
from backend.app.services.action_center.service import ActionCenterService

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
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []
    mock_db.farm_inventory.records = []
    mock_db.farm_seasons.records = []
    mock_db.notifications.records = []
    mock_db.action_interactions.records = []
    yield
    mock_db.users.records = []
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []
    mock_db.farm_inventory.records = []
    mock_db.farm_seasons.records = []
    mock_db.notifications.records = []
    mock_db.action_interactions.records = []


async def create_user(name: str, email: str, role: str = "farmer"):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "is_active": True
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token


async def create_farm(user_id: str, farm_name: str = "Reliability Farm", crop: str = "Tomato", size: float = 2.5):
    farm_id = ObjectId()
    now = datetime.now(timezone.utc)
    farm_doc = {
        "_id": farm_id,
        "id": str(farm_id),
        "user_id": user_id,
        "farm_name": farm_name,
        "crop_name": crop,
        "crop_variety": "Hybrid Gold",
        "farm_size": size,
        "farm_unit": "acres",
        "state": "Andhra Pradesh",
        "district": "Kurnool",
        "field_name": "Block A",
        "planting_date": "2026-06-01",
        "growth_stage": "Harvesting",
        "number_of_fields": 2,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    mock_db.farm_profiles.records.append(farm_doc)
    return str(farm_id)


# ══════════════════════════════════════════════════════════════════════════════
# 1. HARVEST IDEMPOTENCY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_harvest_idempotency():
    user_id, token = await create_user("Farmer 1", "f1@reliability.org")
    farm_id = await create_farm(user_id, "Farm 1")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "harvest_date": "2026-09-15",
            "quantity": 25.0,
            "unit": "quintal",
            "idempotency_key": "idemp-harv-12345"
        }
        res1 = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res1.status_code == 201
        h1 = res1.json()

        # Duplicate submit with identical idempotency key
        res2 = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res2.status_code == 201
        h2 = res2.json()

        # Same harvest record returned without duplication
        assert h1["harvest_id"] == h2["harvest_id"]
        season = await mock_db["farm_seasons"].find_one({"farm_id": farm_id})
        assert len(season["harvests"]) == 1


# ══════════════════════════════════════════════════════════════════════════════
# 2. SALE IDEMPOTENCY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_sale_idempotency():
    user_id, token = await create_user("Farmer 2", "f2@reliability.org")
    farm_id = await create_farm(user_id, "Farm 2")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "sale_date": "2026-09-20",
            "quantity_sold": 15.0,
            "unit": "quintal",
            "price_per_unit": 2200.0,
            "mandi": "Kurnool APMC",
            "idempotency_key": "idemp-sale-999"
        }
        res1 = await client.post(
            f"/api/farms/{farm_id}/sales",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res1.status_code == 201
        s1 = res1.json()

        res2 = await client.post(
            f"/api/farms/{farm_id}/sales",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res2.status_code == 201
        s2 = res2.json()
        assert s1["sale_id"] == s2["sale_id"]

        season = await mock_db["farm_seasons"].find_one({"farm_id": farm_id})
        assert len(season["sales"]) == 1


# ══════════════════════════════════════════════════════════════════════════════
# 3. SALE -> KHATA IDEMPOTENCY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_sale_to_khata_idempotency():
    user_id, token = await create_user("Farmer 3", "f3@reliability.org")
    farm_id = await create_farm(user_id, "Farm 3")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "sale_date": "2026-09-21",
            "quantity_sold": 10.0,
            "unit": "quintal",
            "price_per_unit": 2000.0,
            "record_in_khata": True,
            "idempotency_key": "idemp-khata-repeat"
        }
        # First call creates sale and Khata entry
        res1 = await client.post(
            f"/api/farms/{farm_id}/sales",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res1.status_code == 201

        # Second call returns existing without second Khata income
        res2 = await client.post(
            f"/api/farms/{farm_id}/sales",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res2.status_code == 201

        khata_entries = [
            e for e in mock_db["farm_khata"].records
            if e.get("farm_id") == farm_id and e.get("category") == "crop_sale"
        ]
        assert len(khata_entries) == 1
        assert khata_entries[0]["amount"] == 20000.0


# ══════════════════════════════════════════════════════════════════════════════
# 4. REPEATED SEASON CLOSE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_repeated_season_close():
    user_id, token = await create_user("Farmer 4", "f4@reliability.org")
    farm_id = await create_farm(user_id, "Farm 4")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First close
        res1 = await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-10-01", "notes": "Season finished."},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res1.status_code == 200
        closed1 = res1.json()
        assert closed1["status"] == "closed"

        # Repeated close: safe, idempotent
        res2 = await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-10-01", "notes": "Season finished."},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res2.status_code == 200
        closed2 = res2.json()
        assert closed2["status"] == "closed"
        assert closed1["season_id"] == closed2["season_id"]


# ══════════════════════════════════════════════════════════════════════════════
# 5. MISSING MARKET DATA RETURNS NOT_AVAILABLE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_missing_market_data():
    user_id, token = await create_user("Farmer 5", "f5@reliability.org")
    # Exotic unlisted crop
    farm_id = await create_farm(user_id, "Farm 5", crop="Dragonfruit")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/selling-advisory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["market_references_count"] == 0
        assert data["market_references"] == []
        assert data["source"] == "Source information not available"
        assert data["estimated_reference_market_value"] is None
        assert data["value_status"] == "not_available"


# ══════════════════════════════════════════════════════════════════════════════
# 6. MISSING PRODUCTION COST
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_missing_production_cost():
    user_id, token = await create_user("Farmer 6", "f6@reliability.org")
    farm_id = await create_farm(user_id, "Farm 6", crop="Tomato")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/selling-advisory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["cost_per_quintal"] is None
        assert data["cost_status"] == "not_available"
        for m in data["market_references"]:
            assert m["spread_status"] == "NOT_AVAILABLE"
            assert m["reference_spread"] is None


# ══════════════════════════════════════════════════════════════════════════════
# 7. UNSUPPORTED HARVEST UNIT
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_unsupported_harvest_unit():
    season_doc = {
        "farm_id": "farm-unsupported",
        "season_id": "season-unsup",
        "crop_name": "Apples",
        "harvests": [{"quantity": 100.0, "unit": "boxes", "normalized_quintals": None}],
        "sales": []
    }
    inv = HarvestMarketService.calculate_harvest_inventory(season_doc)
    assert inv["quantity_status"] == "actual"  # 100 boxes is known as 100 boxes
    assert inv["unit"] == "boxes"
    assert inv["unsold_quintals"] is None  # but cannot fabricate a quintal value!


# ══════════════════════════════════════════════════════════════════════════════
# 8. CROSS-FARMER HARVEST ACCESS IS FORBIDDEN
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_cross_farmer_harvest_access():
    user_a, token_a = await create_user("Farmer A", "a@reliability.org")
    user_b, token_b = await create_user("Farmer B", "b@reliability.org")
    farm_a = await create_farm(user_a, "Farm A")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_a}/harvests",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res.status_code == 403
        assert "Access forbidden" in res.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# 9. CROSS-FARMER SALE ACCESS IS FORBIDDEN
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_cross_farmer_sale_access():
    user_a, token_a = await create_user("Farmer A", "a2@reliability.org")
    user_b, token_b = await create_user("Farmer B", "b2@reliability.org")
    farm_a = await create_farm(user_a, "Farm A")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_a}/sales",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res.status_code == 403
        assert "Access forbidden" in res.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# 10. DATABASE FAILURE BEHAVIOR RETURNS HTTP 503
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_database_failure_503():
    user_id, token = await create_user("Farmer 10", "f10@reliability.org")
    farm_id = await create_farm(user_id, "Farm 10")

    class FaultyDB(MockDatabase):
        def __init__(self):
            super().__init__()
            async def failing_find_one(*args, **kwargs):
                raise AutoReconnect("Simulated MongoDB connection drop")
            self.users.find_one = failing_find_one
            self.farm_profiles.find_one = failing_find_one

    async def get_faulty_db():
        return FaultyDB()

    app.dependency_overrides[get_database] = get_faulty_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get(
                f"/api/farms/{farm_id}/harvests",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 503
            data = res.json()
            assert data["code"] == "DATABASE_UNAVAILABLE"
            assert "Retry-After" in res.headers
    finally:
        app.dependency_overrides[get_database] = override_get_database


# ══════════════════════════════════════════════════════════════════════════════
# 11. MARKET REFERENCE NEVER CREATES KHATA INCOME
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_market_reference_does_not_create_khata_income():
    user_id, token = await create_user("Farmer 11", "f11@reliability.org")
    farm_id = await create_farm(user_id, "Farm 11", crop="Tomato")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Farmer records harvest
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Farmer queries selling advisory multiple times
        for _ in range(5):
            res = await client.get(
                f"/api/farms/{farm_id}/selling-advisory",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 200

        # Farm Khata remains completely untouched!
        khata_entries = [e for e in mock_db["farm_khata"].records if e.get("farm_id") == farm_id]
        assert len(khata_entries) == 0


# ══════════════════════════════════════════════════════════════════════════════
# 12. ACTION CENTER MARKET REVIEW DEDUPLICATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_action_center_market_review_deduplication():
    user_id, token = await create_user("Farmer 12", "f12@reliability.org")
    farm_id = await create_farm(user_id, "Farm 12", crop="Tomato")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 40.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Rapid repeated polls
        for _ in range(3):
            res = await client.get(
                f"/api/v1/farmer/actions?farm_id={farm_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 200
            actions = res.json()["actions"]
            market_tasks = [a for a in actions if a["action_id"] == f"act-market-review-{farm_id}"]
            assert len(market_tasks) == 1


# ══════════════════════════════════════════════════════════════════════════════
# 13. PARTIAL MARKET FAILURE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_partial_market_failure():
    # If crop has no market references, harvest inventory still calculates cleanly
    season_doc = {
        "farm_id": "farm-partial",
        "season_id": "season-partial",
        "crop_name": "Unlisted Specialty Crop",
        "harvests": [{"quantity": 30.0, "unit": "quintal", "normalized_quintals": 30.0}],
        "sales": [{"quantity_sold": 10.0, "unit": "quintal"}]
    }
    inv = HarvestMarketService.calculate_harvest_inventory(season_doc)
    assert inv["unsold_quantity"] == 20.0
    assert inv["quantity_status"] == "actual"

    refs = HarvestMarketService.find_matching_market_references("Unlisted Specialty Crop")
    assert refs == []  # Market unavailable, but harvest inventory remains fully intact!


# ══════════════════════════════════════════════════════════════════════════════
# 14. SOFTWARE AI MODE WITHOUT IOT
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_software_ai_mode_without_iot():
    user_id, token = await create_user("Farmer 14", "f14@reliability.org")
    farm_id = await create_farm(user_id, "Farm 14", crop="Tomato")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Zero IoT device records in DB
        res = await client.get(
            f"/api/farms/{farm_id}/selling-advisory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["crop_name"] == "Tomato"
        assert "market_references" in data


# ══════════════════════════════════════════════════════════════════════════════
# 15. SMART IOT MODE ZERO ACTUATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_smart_iot_mode_zero_actuation():
    user_id, token = await create_user("Farmer 15", "f15@reliability.org")
    farm_id = await create_farm(user_id, "Farm 15", crop="Tomato")

    # Add mock IoT device document
    await mock_db["devices"].insert_one({
        "device_id": "ESP32-HARV-01",
        "farm_id": farm_id,
        "is_online": True,
        "last_telemetry": {"soil_moisture": 48.0}
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/selling-advisory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200

        # Assert no actuator command was issued
        actuator_logs = [e for e in mock_db["device_commands"].records if e.get("farm_id") == farm_id]
        assert len(actuator_logs) == 0


# ══════════════════════════════════════════════════════════════════════════════
# 16. INCONSISTENT HARVEST / SALE DATA RETURNS NOT_AVAILABLE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_inconsistent_harvest_sale_data_returns_not_available():
    # Sold 80 Qtl but only harvested 50 Qtl (data entry mistake)
    season_doc = {
        "farm_id": "farm-inconsistent",
        "season_id": "season-inconsistent",
        "crop_name": "Tomato",
        "harvests": [{"quantity": 50.0, "unit": "quintal", "normalized_quintals": 50.0}],
        "sales": [{"quantity_sold": 80.0, "unit": "quintal"}]
    }
    inv = HarvestMarketService.calculate_harvest_inventory(season_doc)
    # Must NOT invent negative stock or zero; must return safe data-quality state
    assert inv["quantity_status"] == "not_available"
    assert inv["unsold_quantity"] is None
    assert inv["unsold_quintals"] is None


# ══════════════════════════════════════════════════════════════════════════════
# 17. MALFORMED FARM SIZE HANDLED GRACEFULLY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_malformed_farm_size_handled_gracefully():
    # Farm profile with null or empty string farm_size
    malformed_farm_doc = {
        "crop_name": "Tomato",
        "crop_variety": "Hybrid",
        "farm_size": None,  # malformed None
        "farm_unit": "acres",
        "planting_date": "2026-06-01"
    }
    from backend.app.services.harvest_season_service import HarvestSeasonService
    season = await HarvestSeasonService.get_or_create_active_season(
        mock_db, "farm-malformed", "user-malformed", malformed_farm_doc
    )
    assert season["area"] == 1.0  # Safely fell back to default 1.0 without TypeError!
