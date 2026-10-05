import pytest
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from bson import ObjectId

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
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token


async def create_farm(user_id: str, farm_name: str = "Surya Farm", crop_name: str = "Tomato", area: float = 2.0):
    farm_id = ObjectId()
    farm_doc = {
        "_id": farm_id,
        "id": str(farm_id),
        "user_id": user_id,
        "farm_name": farm_name,
        "crop_name": crop_name,
        "crop_variety": "US 440",
        "farm_size": area,
        "farm_unit": "acres",
        "district": "Guntur",
        "state": "Andhra Pradesh",
        "planting_date": "2026-06-01",
        "growth_stage": "Harvesting",
        "number_of_fields": 2,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    mock_db.farm_profiles.records.append(farm_doc)
    return str(farm_id)


# ══════════════════════════════════════════════════════════════════════════════
# TEST 1: UNSOLD HARVEST CALCULATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_unsold_harvest_calculation():
    user_id, token = await create_user("Farmer 1", "f1@farm.org")
    farm_id = await create_farm(user_id, "Farm 1", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Log 85 Quintals harvested
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 85.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        # Log 50 Quintals sold
        await client.post(
            f"/api/farms/{farm_id}/sales",
            json={"sale_date": "2026-09-12", "quantity_sold": 50.0, "unit": "quintal", "price_per_unit": 2200.0},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/harvest-inventory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_harvested"] == 85.0
        assert data["total_sold"] == 50.0
        assert data["unsold_quantity"] == 35.0
        assert data["unsold_quintals"] == 35.0
        assert data["quantity_status"] == "actual"
        assert data["is_fully_sold"] is False


# ══════════════════════════════════════════════════════════════════════════════
# TEST 2: MULTIPLE PICKINGS AND MULTIPLE SALES AGGREGATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_multiple_pickings_and_sales():
    user_id, token = await create_user("Farmer 2", "f2@farm.org")
    farm_id = await create_farm(user_id, "Farm 2", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 3 Pickings: 30 Qtl + 40 Qtl + 25 Qtl = 95 Qtl
        for q in [30.0, 40.0, 25.0]:
            await client.post(
                f"/api/farms/{farm_id}/harvests",
                json={"harvest_date": "2026-09-10", "quantity": q, "unit": "quintal"},
                headers={"Authorization": f"Bearer {token}"}
            )

        # 2 Sales: 20 Qtl + 35 Qtl = 55 Qtl
        for q in [20.0, 35.0]:
            await client.post(
                f"/api/farms/{farm_id}/sales",
                json={"sale_date": "2026-09-15", "quantity_sold": q, "unit": "quintal", "price_per_unit": 2100.0},
                headers={"Authorization": f"Bearer {token}"}
            )

        res = await client.get(
            f"/api/farms/{farm_id}/harvest-inventory",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        assert data["total_harvested"] == 95.0
        assert data["total_sold"] == 55.0
        assert data["unsold_quantity"] == 40.0
        assert data["number_of_pickings"] == 3
        assert data["number_of_sales"] == 2


# ══════════════════════════════════════════════════════════════════════════════
# TEST 3: FULLY SOLD HARVEST
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_fully_sold_harvest():
    user_id, token = await create_user("Farmer 3", "f3@farm.org")
    farm_id = await create_farm(user_id, "Farm 3", "Tomato", 1.5)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 40 Qtl harvested, 40 Qtl sold
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 40.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        await client.post(
            f"/api/farms/{farm_id}/sales",
            json={"sale_date": "2026-09-12", "quantity_sold": 40.0, "unit": "quintal", "price_per_unit": 2000.0},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/harvest-inventory",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        assert data["unsold_quantity"] == 0.0
        assert data["is_fully_sold"] is True


# ══════════════════════════════════════════════════════════════════════════════
# TEST 4: UNSUPPORTED / INCOMPATIBLE UNITS RETURN NOT AVAILABLE
# ══════════════════════════════════════════════════════════════════════════════
def test_unsupported_unit_returns_not_available():
    # Season with incompatible mixed non-convertible units: crates vs bags
    season_doc = {
        "farm_id": "farm-test",
        "season_id": "season-test",
        "crop_name": "Tomato",
        "harvests": [{"quantity": 100.0, "unit": "crates", "normalized_quintals": None}],
        "sales": [{"quantity_sold": 50.0, "unit": "bags"}]
    }
    inv = HarvestMarketService.calculate_harvest_inventory(season_doc)
    assert inv["quantity_status"] == "not_available"
    assert inv["unsold_quantity"] is None
    assert inv["unsold_quintals"] is None


# ══════════════════════════════════════════════════════════════════════════════
# TEST 5: REFERENCE SPREAD CALCULATION
# ══════════════════════════════════════════════════════════════════════════════
def test_reference_spread_calculation():
    # Mandi modal = 2100, Cost = 1350 -> Spread = +750
    spread_info = HarvestMarketService.calculate_reference_spread(
        modal_price=2100.0, cost_per_quintal=1350.0
    )
    assert spread_info["reference_spread"] == 750.0
    assert spread_info["spread_status"] == "ABOVE_PRODUCTION_COST"
    assert "above recorded production cost" in spread_info["spread_label"]


# ══════════════════════════════════════════════════════════════════════════════
# TEST 6: MISSING COST RETURNS NOT AVAILABLE (NO FABRICATION)
# ══════════════════════════════════════════════════════════════════════════════
def test_missing_cost_returns_not_available():
    spread_info = HarvestMarketService.calculate_reference_spread(
        modal_price=2100.0, cost_per_quintal=None
    )
    assert spread_info["reference_spread"] is None
    assert spread_info["spread_status"] == "NOT_AVAILABLE"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 7: MARKET PRICE UNAVAILABLE RETURNS NOT AVAILABLE
# ══════════════════════════════════════════════════════════════════════════════
def test_market_price_unavailable():
    spread_info = HarvestMarketService.calculate_reference_spread(
        modal_price=None, cost_per_quintal=1350.0
    )
    assert spread_info["reference_spread"] is None
    assert spread_info["spread_status"] == "NOT_AVAILABLE"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 8: MSP REFERENCE WHEN AVAILABLE
# ══════════════════════════════════════════════════════════════════════════════
def test_msp_reference_when_available():
    refs = HarvestMarketService.find_matching_market_references("Paddy (Rice)")
    assert len(refs) > 0
    # Paddy has official MSP in GOVT_MSP_DATABASE
    assert refs[0]["msp_reference"] is not None
    assert refs[0]["msp_reference"] in [2300, 2320]


# ══════════════════════════════════════════════════════════════════════════════
# TEST 9: MSP MISSING RETURNS NOT AVAILABLE (NO FABRICATION)
# ══════════════════════════════════════════════════════════════════════════════
def test_msp_missing_is_not_available():
    # Vegetables like Tomato do not have official MSP
    refs = HarvestMarketService.find_matching_market_references("Tomato")
    assert len(refs) > 0
    assert refs[0]["msp_reference"] is None


# ══════════════════════════════════════════════════════════════════════════════
# TEST 10: REFERENCE MARKET VALUE IS NOT ACTUAL INCOME
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_reference_market_value_is_not_actual_income():
    user_id, token = await create_user("Farmer 10", "f10@farm.org")
    farm_id = await create_farm(user_id, "Farm 10", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Harvest 50 Qtl
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/selling-advisory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["estimated_reference_market_value"] is not None
        assert data["value_status"] == "estimated"
        assert "not actual sale income" in data["value_disclaimer"].lower()

        # Check Farm Khata: MUST NOT contain any automatic income transactions!
        khata_income = [k for k in mock_db.farm_khata.records if k.get("type") == "income"]
        assert len(khata_income) == 0


# ══════════════════════════════════════════════════════════════════════════════
# TEST 11: BELOW PRODUCTION COST STATE
# ══════════════════════════════════════════════════════════════════════════════
def test_below_production_cost_state():
    # Mandi modal = 1100, Cost = 1450 -> Spread = -350
    spread_info = HarvestMarketService.calculate_reference_spread(
        modal_price=1100.0, cost_per_quintal=1450.0
    )
    assert spread_info["reference_spread"] == -350.0
    assert spread_info["spread_status"] == "BELOW_PRODUCTION_COST"
    assert "below recorded production cost" in spread_info["spread_label"]


# ══════════════════════════════════════════════════════════════════════════════
# TEST 12: ABOVE PRODUCTION COST STATE
# ══════════════════════════════════════════════════════════════════════════════
def test_above_production_cost_state():
    # Mandi modal = 2200, Cost = 1450 -> Spread = +750
    spread_info = HarvestMarketService.calculate_reference_spread(
        modal_price=2200.0, cost_per_quintal=1450.0
    )
    assert spread_info["reference_spread"] == 750.0
    assert spread_info["spread_status"] == "ABOVE_PRODUCTION_COST"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 13: CROSS-FARMER TENANT ISOLATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_cross_farmer_tenant_isolation():
    farmer_a, token_a = await create_user("Farmer A", "a@farm.org")
    farmer_b, token_b = await create_user("Farmer B", "b@farm.org")
    farm_a = await create_farm(farmer_a, "Farm A", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Farmer B attempts to access Farmer A's harvest inventory -> 403
        res1 = await client.get(
            f"/api/farms/{farm_a}/harvest-inventory",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res1.status_code == 403

        # Farmer B attempts to access Farmer A's selling advisory -> 403
        res2 = await client.get(
            f"/api/farms/{farm_a}/selling-advisory",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res2.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# TEST 14: ACTION CENTER MARKET REVIEW CONDITION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_action_center_market_review_condition():
    user_id, token = await create_user("Farmer 14", "f14@farm.org")
    farm_id = await create_farm(user_id, "Farm 14", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Before harvest: no unsold stock -> no market review action
        res_actions1 = await client.get(
            f"/api/v1/farmer/actions?farm_id={farm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_actions1.status_code == 200
        actions1 = res_actions1.json()["actions"]
        assert not any(a["action_id"].startswith("act-market-review-") for a in actions1)

        # 2. Log 35 Qtl harvest
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 35.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # 3. After harvest: unsold stock exists & market reference exists -> action generates!
        res_actions2 = await client.get(
            f"/api/v1/farmer/actions?farm_id={farm_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_actions2.status_code == 200
        actions2 = res_actions2.json()["actions"]
        market_actions = [a for a in actions2 if a["action_id"].startswith("act-market-review-")]
        assert len(market_actions) == 1
        assert "35.0 quintal Tomato Unsold" in market_actions[0]["what"]
        assert market_actions[0]["priority"] == "P2"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 15: ACTION CENTER DOES NOT CREATE DUPLICATE TASKS
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_action_center_does_not_create_duplicate_tasks():
    user_id, token = await create_user("Farmer 15", "f15@farm.org")
    farm_id = await create_farm(user_id, "Farm 15", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Multiple queries to Action Center
        for _ in range(3):
            res = await client.get(
                f"/api/v1/farmer/actions?farm_id={farm_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 200
            actions = res.json()["actions"]
            market_actions = [a for a in actions if a["action_id"] == f"act-market-review-{farm_id}"]
            assert len(market_actions) == 1


# ══════════════════════════════════════════════════════════════════════════════
# TEST 16: SALE HANDOFF PRESERVES B24 IDEMPOTENCY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_sale_handoff_preserves_b24_idempotency():
    user_id, token = await create_user("Farmer 16", "f16@farm.org")
    farm_id = await create_farm(user_id, "Farm 16", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        sale_payload = {
            "sale_date": "2026-09-12",
            "quantity_sold": 25.0,
            "unit": "quintal",
            "price_per_unit": 2200.0,
            "mandi": "Madanapalle Tomato Yard",
            "record_in_khata": True,
            "idempotency_key": "sale-handoff-retry-key-001"
        }

        # First submit
        res1 = await client.post(f"/api/farms/{farm_id}/sales", json=sale_payload, headers={"Authorization": f"Bearer {token}"})
        assert res1.status_code == 201

        # Second submit with same idempotency_key (simulated browser double-click)
        res2 = await client.post(f"/api/farms/{farm_id}/sales", json=sale_payload, headers={"Authorization": f"Bearer {token}"})
        assert res2.status_code == 201

        # Confirm exactly 1 sale in season and exactly 1 income transaction in Farm Khata
        season = await mock_db.farm_seasons.find_one({"farm_id": farm_id})
        assert len(season["sales"]) == 1

        khata_income = [k for k in mock_db.farm_khata.records if k.get("type") == "income"]
        assert len(khata_income) == 1


# ══════════════════════════════════════════════════════════════════════════════
# TEST 17: EXPLICIT SALE CREATES ACTUAL REVENUE ONLY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_explicit_sale_creates_actual_revenue_only():
    user_id, token = await create_user("Farmer 17", "f17@farm.org")
    farm_id = await create_farm(user_id, "Farm 17", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Harvest 50 Qtl
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Scorecard before sale: revenue MUST be not_available
        s_res1 = await client.get(f"/api/farms/{farm_id}/season-summary", headers={"Authorization": f"Bearer {token}"})
        assert s_res1.json()["actual_sales_income"] is None
        assert s_res1.json()["revenue_status"] == "not_available"

        # 2. Explicitly record 30 Qtl sale @ ₹2,000/Qtl = ₹60,000
        await client.post(
            f"/api/farms/{farm_id}/sales",
            json={"sale_date": "2026-09-12", "quantity_sold": 30.0, "unit": "quintal", "price_per_unit": 2000.0},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Scorecard after sale: actual revenue = 60,000
        s_res2 = await client.get(f"/api/farms/{farm_id}/season-summary", headers={"Authorization": f"Bearer {token}"})
        assert s_res2.json()["actual_sales_income"] == 60000.0
        assert s_res2.json()["revenue_status"] == "actual"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 18: SOFTWARE AI MODE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_software_ai_mode():
    # Verify B25 operates 100% when no IoT hardware devices are connected
    user_id, token = await create_user("Farmer 18", "f18@farm.org")
    farm_id = await create_farm(user_id, "Farm 18", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/selling-advisory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["crop_name"] == "Tomato"
        assert "market_references" in data


# ══════════════════════════════════════════════════════════════════════════════
# TEST 19: SMART IOT MODE ZERO ACTUATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_smart_iot_mode_zero_actuation():
    # Verify presence of telemetry does not trigger automated harvest actions or sales
    user_id, token = await create_user("Farmer 19", "f19@farm.org")
    farm_id = await create_farm(user_id, "Farm 19", "Tomato", 2.0)

    # Inject mock telemetry
    mock_db.iot_telemetry = MockDatabase()
    mock_db.iot_telemetry.records = [{
        "device_id": "esp32-node-1",
        "temperature": 28.5,
        "humidity": 65.0,
        "soil_moisture": 42.0,
        "received_at": datetime.now(timezone.utc)
    }]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/selling-advisory",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        # Zero sales created
        season = await mock_db.farm_seasons.find_one({"farm_id": farm_id})
        assert len(season.get("sales", [])) == 0


# ══════════════════════════════════════════════════════════════════════════════
# TEST 20: NO AUTOMATIC KHATA INCOME FROM MARKET REFERENCE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_no_automatic_khata_income_from_market_reference():
    user_id, token = await create_user("Farmer 20", "f20@farm.org")
    farm_id = await create_farm(user_id, "Farm 20", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 100.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Repeatedly query selling advisory
        for _ in range(5):
            await client.get(
                f"/api/farms/{farm_id}/selling-advisory",
                headers={"Authorization": f"Bearer {token}"}
            )

        # Zero income transactions must exist in Khata
        income_txs = [k for k in mock_db.farm_khata.records if k.get("type") == "income"]
        assert len(income_txs) == 0


# ══════════════════════════════════════════════════════════════════════════════
# TEST 21: NO AUTOMATIC SALE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_no_automatic_sale():
    user_id, token = await create_user("Farmer 21", "f21@farm.org")
    farm_id = await create_farm(user_id, "Farm 21", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Logging harvest does not create sale
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        season = await mock_db.farm_seasons.find_one({"farm_id": farm_id})
        assert len(season.get("sales", [])) == 0

        # Querying harvest inventory does not create sale
        await client.get(f"/api/farms/{farm_id}/harvest-inventory", headers={"Authorization": f"Bearer {token}"})
        season = await mock_db.farm_seasons.find_one({"farm_id": farm_id})
        assert len(season.get("sales", [])) == 0
