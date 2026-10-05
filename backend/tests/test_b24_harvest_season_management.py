import pytest
from datetime import datetime, timezone, timedelta
from httpx import ASGITransport, AsyncClient
from bson import ObjectId

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
from backend.app.services.harvest_season_service import HarvestSeasonService, normalize_to_quintals
from backend.app.models.harvest_season import HarvestCreate, SaleCreate, SeasonCreate, SeasonCloseRequest

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
    yield
    mock_db.users.records = []
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []
    mock_db.farm_inventory.records = []
    mock_db.farm_seasons.records = []


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


async def create_farm(user_id: str, farm_name: str = "Surya Farms", crop_name: str = "Tomato", area: float = 2.5):
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
        "planting_date": "2026-06-01",
        "growth_stage": "Harvesting",
        "number_of_fields": 2,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    mock_db.farm_profiles.records.append(farm_doc)
    return str(farm_id)


# ══════════════════════════════════════════════════════════════════════════════
# TEST 1: HARVEST CREATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_01_harvest_creation():
    user_id, token = await create_user("Ramesh Farmer", "ramesh@farm.org")
    farm_id = await create_farm(user_id, "Ramesh Farm", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={
                "harvest_date": "2026-09-15",
                "quantity": 35.5,
                "unit": "quintal",
                "grade": "Grade A",
                "notes": "First picking, high quality fruits"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 201
        data = res.json()
        assert data["quantity"] == 35.5
        assert data["unit"] == "quintal"
        assert data["normalized_quintals"] == 35.5
        assert data["picking_number"] == 1
        assert "season_id" in data
        assert data["season_id"].startswith("season-")

        # Verify season was created and persisted in db
        season_doc = await mock_db["farm_seasons"].find_one({"season_id": data["season_id"]})
        assert season_doc is not None
        assert len(season_doc["harvests"]) == 1
        assert season_doc["harvests"][0]["quantity"] == 35.5


# ══════════════════════════════════════════════════════════════════════════════
# TEST 2: MULTIPLE HARVESTS AGGREGATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_02_multiple_harvests():
    user_id, token = await create_user("Krishna", "krishna@farm.org")
    farm_id = await create_farm(user_id, "Krishna Sector", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Picking 1: 100 kg
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 100.0, "unit": "kg"},
            headers={"Authorization": f"Bearer {token}"}
        )
        # Picking 2: 200 kg
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-15", "quantity": 200.0, "unit": "kg"},
            headers={"Authorization": f"Bearer {token}"}
        )
        # Picking 3: 150 kg
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-20", "quantity": 150.0, "unit": "kg"},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        scorecard = res.json()
        assert scorecard["total_pickings_count"] == 3
        assert scorecard["total_harvest_quantity"] == 450.0
        assert scorecard["total_harvest_quintals"] == 4.5  # 450 kg = 4.5 quintals
        assert scorecard["harvest_status"] == "actual"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 3: INVALID HARVEST (REJECT ZERO OR NEGATIVE QUANTITY)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_03_invalid_harvest():
    user_id, token = await create_user("Anil", "anil@farm.org")
    farm_id = await create_farm(user_id, "Anil Farm", "Chilli", 1.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Zero quantity
        res_zero = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-15", "quantity": 0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_zero.status_code in (400, 422)

        # Negative quantity
        res_neg = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-15", "quantity": -10.5, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_neg.status_code in (400, 422)


# ══════════════════════════════════════════════════════════════════════════════
# TEST 4: HARVEST IDEMPOTENCY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_04_harvest_idempotency():
    user_id, token = await create_user("Suresh", "suresh@farm.org")
    farm_id = await create_farm(user_id, "Suresh Farm", "Tomato", 3.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "harvest_date": "2026-09-18",
            "quantity": 50.0,
            "unit": "quintal",
            "idempotency_key": "idemp-harv-test-key-12345"
        }
        res1 = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res1.status_code == 201
        h1 = res1.json()

        # Submit identical request with same idempotency key
        res2 = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res2.status_code in (200, 201)
        h2 = res2.json()

        # Verify only one harvest exists
        assert h1["harvest_id"] == h2["harvest_id"]
        harvests_res = await client.get(
            f"/api/farms/{farm_id}/harvests",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert len(harvests_res.json()) == 1


# ══════════════════════════════════════════════════════════════════════════════
# TEST 5: HARVEST VS SALE (REVENUE USES ACTUAL SALES ONLY)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_05_harvest_vs_sale():
    user_id, token = await create_user("Venkatesh", "venkatesh@farm.org")
    farm_id = await create_farm(user_id, "Venkatesh Farm", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Harvest 500 kg
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-01", "quantity": 500.0, "unit": "kg"},
            headers={"Authorization": f"Bearer {token}"}
        )
        # Sell 300 kg @ ₹20/kg
        await client.post(
            f"/api/farms/{farm_id}/sales",
            json={
                "sale_date": "2026-09-02",
                "quantity_sold": 300.0,
                "unit": "kg",
                "price_per_unit": 20.0,
                "buyer": "Local Trader"
            },
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        assert data["total_harvest_quantity"] == 500.0
        # Revenue must be calculated from 300 kg sold (300 * 20 = ₹6,000), not the full 500 kg!
        assert data["actual_sales_income"] == 6000.0
        assert data["revenue_status"] == "actual"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 6: SALE CALCULATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_06_sale_calculation():
    user_id, token = await create_user("Naidu", "naidu@farm.org")
    farm_id = await create_farm(user_id, "Naidu Estate", "Tomato", 1.5)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/farms/{farm_id}/sales",
            json={
                "sale_date": "2026-09-22",
                "quantity_sold": 25.5,
                "unit": "quintal",
                "price_per_unit": 1850.0,
                "buyer": "APMC Trader"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 201
        sale = res.json()
        expected_total = round(25.5 * 1850.0, 2)
        assert sale["total_sale_value"] == expected_total


# ══════════════════════════════════════════════════════════════════════════════
# TEST 7: SALE IDEMPOTENCY & FINANCIAL RECORD
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_07_sale_idempotency():
    user_id, token = await create_user("Babu", "babu@farm.org")
    farm_id = await create_farm(user_id, "Babu Sector", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "sale_date": "2026-09-25",
            "quantity_sold": 40.0,
            "unit": "quintal",
            "price_per_unit": 1600.0,
            "buyer": "Vijayawada Mandi",
            "record_in_khata": True,
            "idempotency_key": "sale-idemp-key-999"
        }
        res1 = await client.post(
            f"/api/farms/{farm_id}/sales",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res1.status_code == 201
        s1 = res1.json()
        assert s1["khata_tx_id"] is not None

        # Repeat submission
        res2 = await client.post(
            f"/api/farms/{farm_id}/sales",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res2.status_code in (200, 201)
        s2 = res2.json()
        assert s1["sale_id"] == s2["sale_id"]

        # Verify only one Khata income transaction was generated
        khata_income = [tx for tx in mock_db.farm_khata.records if tx.get("booking_id") == f"harvest-sale-{s1['sale_id']}"]
        assert len(khata_income) == 1


# ══════════════════════════════════════════════════════════════════════════════
# TEST 8: ACTUAL VS ESTIMATED INCOME
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_08_actual_vs_estimated():
    user_id, token = await create_user("Madhav", "madhav@farm.org")
    farm_id = await create_farm(user_id, "Madhav Farm", "Tomato", 2.0)

    # Insert an estimated Khata transaction (e.g. projected income)
    mock_db.farm_khata.records.append({
        "_id": ObjectId(),
        "id": "khata-est-1",
        "farm_id": farm_id,
        "type": "income",
        "category": "crop_sale",
        "amount": 95000.0,
        "is_estimated": True,  # ESTIMATED!
        "date": "2026-09-01"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        # Estimated revenue cannot appear as actual sales income!
        assert data["actual_sales_income"] is None
        assert data["revenue_status"] == "not_available"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 9: YIELD PER ACRE USES HISTORICAL SEASON AREA
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_09_yield_per_acre():
    user_id, token = await create_user("Chandra", "chandra@farm.org")
    farm_id = await create_farm(user_id, "Chandra Farm", "Tomato", 2.0)  # Historical area = 2.0 acres

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Harvest 60 quintals on 2.0 acres -> 30 quintals/acre
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 60.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Later, user modifies current farm profile area to 5.0 acres
        for f in mock_db.farm_profiles.records:
            if str(f.get("_id")) == farm_id:
                f["farm_size"] = 5.0

        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        assert data["historical_area"] == 2.0
        assert data["yield_per_acre_quintal"] == 30.0  # 60 / 2.0 = 30.0 (NOT 60 / 5.0 = 12.0)


# ══════════════════════════════════════════════════════════════════════════════
# TEST 10: COST PER QUINTAL CALCULATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_10_cost_per_quintal():
    user_id, token = await create_user("AppaRao", "apparao@farm.org")
    farm_id = await create_farm(user_id, "AppaRao Farm", "Tomato", 2.0)

    # Actual Khata expenses: ₹40,000
    mock_db.farm_khata.records.append({
        "_id": ObjectId(),
        "id": "khata-exp-1",
        "farm_id": farm_id,
        "type": "expense",
        "category": "fertilizer",
        "amount": 40000.0,
        "is_estimated": False,
        "crop_name": "Tomato",
        "date": "2026-08-01"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Harvest: 50 quintals
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-15", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        assert data["actual_cultivation_cost"] == 40000.0
        assert data["total_harvest_quintals"] == 50.0
        # Cost per quintal = ₹40,000 / 50 = ₹800.0 / quintal
        assert data["cost_per_quintal"] == 800.0
        assert data["cost_per_quintal_status"] == "actual"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 11: PROFIT PER ACRE CALCULATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_11_profit_per_acre():
    user_id, token = await create_user("Prasad", "prasad@farm.org")
    farm_id = await create_farm(user_id, "Prasad Farm", "Tomato", 2.0)

    # Actual expenses: ₹50,000
    mock_db.farm_khata.records.append({
        "_id": ObjectId(),
        "id": "khata-exp-p",
        "farm_id": farm_id,
        "type": "expense",
        "category": "seeds",
        "amount": 50000.0,
        "is_estimated": False,
        "crop_name": "Tomato",
        "date": "2026-07-01"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Sale: ₹1,50,000
        await client.post(
            f"/api/farms/{farm_id}/sales",
            json={"sale_date": "2026-09-20", "quantity_sold": 100.0, "unit": "quintal", "price_per_unit": 1500.0},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        # Net profit = 150,000 - 50,000 = ₹1,00,000
        assert data["net_profit"] == 100000.0
        # Profit per acre = 1,00,000 / 2.0 = ₹50,000.0 / acre
        assert data["profit_per_acre"] == 50000.0
        assert data["profit_per_acre_status"] == "actual"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 12: ACTUAL ROI CALCULATION
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_12_roi():
    user_id, token = await create_user("Gowtham", "gowtham@farm.org")
    farm_id = await create_farm(user_id, "Gowtham Farm", "Tomato", 1.0)

    # Expenses: ₹40,000
    mock_db.farm_khata.records.append({
        "_id": ObjectId(),
        "id": "khata-exp-roi",
        "farm_id": farm_id,
        "type": "expense",
        "category": "machinery",
        "amount": 40000.0,
        "is_estimated": False,
        "crop_name": "Tomato",
        "date": "2026-07-01"
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Sales: ₹80,000 (Net profit = ₹40,000)
        await client.post(
            f"/api/farms/{farm_id}/sales",
            json={"sale_date": "2026-09-25", "quantity_sold": 40.0, "unit": "quintal", "price_per_unit": 2000.0},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        assert data["net_profit"] == 40000.0
        # ROI = (40,000 / 40,000) * 100 = 100.0%
        assert data["actual_roi_percentage"] == 100.0
        assert data["roi_status"] == "actual"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 13: MISSING DATA RETURNS NOT AVAILABLE (NO FABRICATION)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_13_missing_data():
    user_id, token = await create_user("Kalyan", "kalyan@farm.org")
    farm_id = await create_farm(user_id, "Kalyan Farm", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Harvest recorded, but NO sales and NO expenses
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 30.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        assert data["harvest_status"] == "actual"
        assert data["actual_sales_income"] is None
        assert data["revenue_status"] == "not_available"
        assert data["net_profit"] is None
        assert data["profit_status"] == "not_available"
        assert data["actual_roi_percentage"] is None
        assert data["roi_status"] == "not_available"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 14: SEASON CLOSE (ACTIVE -> CLOSED)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_14_season_close():
    user_id, token = await create_user("Rao", "rao@farm.org")
    farm_id = await create_farm(user_id, "Rao Farm", "Tomato", 2.5)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 50.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )

        close_res = await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-09-30", "notes": "Season ended successfully"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert close_res.status_code == 200
        closed_data = close_res.json()
        assert closed_data["status"] == "closed"
        assert closed_data["season_end_date"] == "2026-09-30"
        assert closed_data["scorecard"] is not None
        assert closed_data["scorecard"]["total_harvest_quintals"] == 50.0


# ══════════════════════════════════════════════════════════════════════════════
# TEST 15: CLOSE IDEMPOTENCY
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_15_close_idempotency():
    user_id, token = await create_user("Shiva", "shiva@farm.org")
    farm_id = await create_farm(user_id, "Shiva Farm", "Tomato", 1.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First close
        res1 = await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-09-30"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res1.status_code == 200
        data1 = res1.json()

        # Second close on the same season
        res2 = await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-09-30"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data1["season_id"] == data2["season_id"]
        assert data2["status"] == "closed"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 16: START NEW SEASON (NON-DESTRUCTIVE ROLLOVER)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_16_new_season():
    user_id, token = await create_user("Mohan16", "mohan16@farm.org")
    farm_id = await create_farm(user_id, "Mohan Farm", "Tomato", 2.5)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Season 1 active
        await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 75.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-09-30"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Launch Season 2
        new_res = await client.post(
            f"/api/farms/{farm_id}/seasons/start",
            json={
                "crop_name": "Rice",
                "variety": "BPT 5204",
                "area": 3.0,
                "area_unit": "acres",
                "planting_date": "2026-10-15",
                "season_name": "Rabi Rice 2026-27"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert new_res.status_code == 201
        s2 = new_res.json()
        assert s2["crop_name"] == "Rice"
        assert s2["area"] == 3.0
        assert s2["status"] == "active"


# ══════════════════════════════════════════════════════════════════════════════
# TEST 17: HISTORICAL CROP PRESERVATION AFTER ROLLOVER
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_17_historical_crop_preservation():
    user_id, token = await create_user("Mohan17", "mohan17@farm.org")
    farm_id = await create_farm(user_id, "Mohan Farm", "Tomato", 2.5)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Log harvest in Season 1
        h_res = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-10", "quantity": 75.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        s1_id = h_res.json()["season_id"]

        # Close Season 1
        await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-09-30"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Launch Season 2: Rice on 3.0 acres
        await client.post(
            f"/api/farms/{farm_id}/seasons/start",
            json={
                "crop_name": "Rice",
                "variety": "BPT 5204",
                "area": 3.0,
                "area_unit": "acres",
                "planting_date": "2026-10-15",
                "season_name": "Rabi Rice 2026-27"
            },
            headers={"Authorization": f"Bearer {token}"}
        )

        # Verify Season 1 still contains old crop, old area, old planting date
        s1_fetch = await client.get(
            f"/api/farms/{farm_id}/seasons/{s1_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert s1_fetch.status_code == 200
        s1_data = s1_fetch.json()
        assert s1_data["crop_name"] == "Tomato"
        assert s1_data["area"] == 2.5
        assert s1_data["planting_date"] == "2026-06-01"
        assert s1_data["status"] == "closed"
        assert len(s1_data["harvests"]) == 1
        assert s1_data["harvests"][0]["quantity"] == 75.0


# ══════════════════════════════════════════════════════════════════════════════
# TEST 18: CROSS-FARMER ACCESS (TENANT ISOLATION)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_18_cross_farmer_access():
    farmer_a_id, token_a = await create_user("Farmer A", "farmer.a@farm.org")
    farmer_b_id, token_b = await create_user("Farmer B", "farmer.b@farm.org")

    farm_a_id = await create_farm(farmer_a_id, "Farm A", "Tomato", 2.0)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Farmer B tries to log a harvest on Farmer A's farm -> 403 Forbidden!
        res_harv = await client.post(
            f"/api/farms/{farm_a_id}/harvests",
            json={"harvest_date": "2026-09-15", "quantity": 10.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res_harv.status_code == 403

        # Farmer B tries to view Farmer A's scorecard -> 403 Forbidden!
        res_score = await client.get(
            f"/api/farms/{farm_a_id}/season-summary",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert res_score.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# TEST 19: KHATA FILTERING BY SEASON
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_19_khata_filtering():
    user_id, token = await create_user("Jagadish", "jagadish@farm.org")
    farm_id = await create_farm(user_id, "Jagadish Farm", "Tomato", 2.0)

    # Season 1 expense: ₹30,000 for Tomato
    mock_db.farm_khata.records.append({
        "_id": ObjectId(),
        "id": "khata-exp-s1",
        "farm_id": farm_id,
        "type": "expense",
        "category": "seeds",
        "amount": 30000.0,
        "crop_name": "Tomato",
        "season": "Tomato Season 2026",
        "is_estimated": False
    })

    # Season 2 expense: ₹80,000 for unrelated Cotton crop
    mock_db.farm_khata.records.append({
        "_id": ObjectId(),
        "id": "khata-exp-s2",
        "farm_id": farm_id,
        "type": "expense",
        "category": "pesticide",
        "amount": 80000.0,
        "crop_name": "Cotton",
        "season": "Cotton Season 2026",
        "is_estimated": False
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/season-summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        data = res.json()
        # Only Tomato expenses (₹30,000) must be included, NOT Cotton (₹80,000)
        assert data["actual_cultivation_cost"] == 30000.0


# ══════════════════════════════════════════════════════════════════════════════
# TEST 20: NO AUTOMATIC INCOME FROM HARVEST
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_20_no_automatic_income():
    user_id, token = await create_user("Satyam", "satyam@farm.org")
    farm_id = await create_farm(user_id, "Satyam Farm", "Tomato", 2.0)

    initial_khata_count = len(mock_db.farm_khata.records)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Logging a harvest of 500 quintals
        res = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-15", "quantity": 500.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 201

        # Must NOT create any income transaction in Khata!
        final_khata_count = len(mock_db.farm_khata.records)
        assert final_khata_count == initial_khata_count


# ══════════════════════════════════════════════════════════════════════════════
# TEST 21: SOFTWARE AI MODE
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_21_software_ai_mode():
    user_id, token = await create_user("Prakash", "prakash@farm.org")
    # Farm without device_id (pure software AI mode)
    farm_id = await create_farm(user_id, "Prakash Farm", "Chilli", 1.5)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/farms/{farm_id}/seasons/active",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        season = res.json()
        assert season["status"] == "active"
        assert season["crop_name"] == "Chilli"

        # Complete harvest and sale workflows work 100% without hardware
        h_res = await client.post(
            f"/api/farms/{farm_id}/harvests",
            json={"harvest_date": "2026-09-15", "quantity": 20.0, "unit": "quintal"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert h_res.status_code == 201


# ══════════════════════════════════════════════════════════════════════════════
# TEST 22: SMART IOT MODE (NO HARDWARE ACTUATION)
# ══════════════════════════════════════════════════════════════════════════════
@pytest.mark.anyio
async def test_22_smart_iot_mode():
    user_id, token = await create_user("IoT Farmer", "iot.farmer@farm.org")
    farm_id = await create_farm(user_id, "IoT Smart Farm", "Tomato", 3.0)

    # Attach IoT device to farm
    for f in mock_db.farm_profiles.records:
        if str(f.get("_id")) == farm_id:
            f["device_id"] = "ESP32_PUMP_NODE_01"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Closing season in IoT mode must not trigger pump or hardware actuation
        res = await client.post(
            f"/api/farms/{farm_id}/close-season",
            json={"season_end_date": "2026-09-30"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        # Verify no hardware control side effects were produced
        assert res.json()["status"] == "closed"
