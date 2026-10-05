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
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []
    yield
    mock_db.users.records = []
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []


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


async def create_farm(user_id: str, farm_name: str = "Green Valley Farm", farm_size: float = 2.0, farm_unit: str = "acres"):
    farm_id = ObjectId()
    farm_doc = {
        "_id": farm_id,
        "id": str(farm_id),
        "user_id": user_id,
        "farm_name": farm_name,
        "crop_name": "Tomato",
        "farm_size": farm_size,
        "farm_unit": farm_unit,
        "village": "Pasupugallu",
        "timeline_tasks": {}
    }
    mock_db.farm_profiles.records.append(farm_doc)
    return str(farm_id)


# ══════════════════════════════════════════════════════════════════════════════
# B17 TESTS: FARM EXPENSE, INCOME & PROFIT MANAGER
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_b17_legacy_compatibility():
    """Verify legacy transactions without B17 fields default gracefully to actual & paid."""
    farmer_id, token = await create_user("Ramesh Kumar", "ramesh_legacy@test.com")
    farm_id = await create_farm(farmer_id)

    # Directly inject legacy records missing B17 fields
    legacy_doc = {
        "_id": ObjectId(),
        "farm_id": farm_id,
        "user_id": farmer_id,
        "type": "expense",
        "category": "seeds",
        "description": "Legacy hybrid seeds purchase",
        "amount": 1500.0,
        "date": "2026-08-10"
    }
    mock_db.farm_khata.records.append(legacy_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 1
        tx = data["transactions"][0]
        # Legacy defaults verified
        assert tx["is_estimated"] is False
        assert tx["payment_status"] == "paid"
        assert tx["crop_name"] is None
        assert tx["field_id"] is None


@pytest.mark.anyio
async def test_b17_extended_fields_crud():
    """Verify creating transactions with all extended B17 fields (crop, field, season, quantity, vendor)."""
    farmer_id, token = await create_user("Sita Devi", "sita_b17@test.com")
    farm_id = await create_farm(farmer_id)

    payload = {
        "type": "expense",
        "category": "fertilizer",
        "description": "DAP 3 Bags + Urea 2 Bags for North Plot",
        "amount": 4200.0,
        "date": "2026-09-01",
        "field_id": "Field-1",
        "crop_name": "Tomato",
        "season": "Kharif 2026",
        "is_estimated": False,
        "payment_status": "unpaid",
        "quantity": 5.0,
        "unit": "bags",
        "vendor": "Sri Rama Agro Agencies"
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create
        res = await client.post(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"}, json=payload)
        assert res.status_code == 201
        created = res.json()
        assert created["field_id"] == "Field-1"
        assert created["crop_name"] == "Tomato"
        assert created["season"] == "Kharif 2026"
        assert created["is_estimated"] is False
        assert created["payment_status"] == "unpaid"
        assert created["quantity"] == 5.0
        assert created["unit"] == "bags"
        assert created["vendor"] == "Sri Rama Agro Agencies"

        # List
        list_res = await client.get(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"})
        assert list_res.status_code == 200
        assert list_res.json()["count"] == 1
        tx = list_res.json()["transactions"][0]
        assert tx["vendor"] == "Sri Rama Agro Agencies"
        assert tx["payment_status"] == "unpaid"


@pytest.mark.anyio
async def test_b17_actual_vs_estimated_profit_analytics():
    """
    Verify strict separation of ACTUAL vs ESTIMATED in profit calculations:
    - Actual Profit = Actual Income - Actual Expense
    - Estimated profit clearly aggregated into projected_profit
    - Never add estimated income into total_actual_income
    """
    farmer_id, token = await create_user("Kalyan Rao", "kalyan_profit@test.com")
    farm_id = await create_farm(farmer_id, farm_size=2.0)

    # 1. Actual Expense: Seeds ₹2,000
    # 2. Actual Expense: Fertilizer ₹3,000
    # 3. Actual Income: First harvest sale ₹12,000
    # 4. Estimated Expense: Future picking labour ₹1,500
    # 5. Estimated Income: Remaining harvest projection ₹25,000
    transactions = [
        {"type": "expense", "category": "seeds", "description": "Tomato Seeds", "amount": 2000.0, "date": "2026-08-01", "is_estimated": False},
        {"type": "expense", "category": "fertilizer", "description": "DAP Basal", "amount": 3000.0, "date": "2026-08-10", "is_estimated": False},
        {"type": "income", "category": "harvest", "description": "1st Picking Sale", "amount": 12000.0, "date": "2026-09-15", "is_estimated": False},
        {"type": "expense", "category": "labour", "description": "Projected 2nd Picking Labour", "amount": 1500.0, "date": "2026-10-01", "is_estimated": True},
        {"type": "income", "category": "harvest", "description": "Projected Yield (200 Crates @ ₹125/Crate)", "amount": 25000.0, "date": "2026-10-15", "is_estimated": True}
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for tx in transactions:
            post_res = await client.post(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"}, json=tx)
            assert post_res.status_code == 201

        # Query analytics
        analytics_res = await client.get(f"/api/farms/{farm_id}/khata/analytics", headers={"Authorization": f"Bearer {token}"})
        assert analytics_res.status_code == 200
        an = analytics_res.json()

        # Actual: Spent ₹5,000, Earned ₹12,000 -> Actual Profit ₹7,000
        assert an["total_actual_expenses"] == 5000.0
        assert an["total_actual_income"] == 12000.0
        assert an["actual_profit"] == 7000.0

        # Estimated: Expenses ₹1,500, Income ₹25,000
        assert an["estimated_expenses"] == 1500.0
        assert an["estimated_income"] == 25000.0

        # Projected Net Profit: (12,000 + 25,000) - (5,000 + 1,500) = 37,000 - 6,500 = 30,500
        assert an["projected_profit"] == 30500.0

        # Cost per unit (2.0 acres): 5000 / 2 = 2500 / acre
        assert an["cost_per_unit"] == 2500.0
        assert an["profit_per_unit"] == 3500.0


@pytest.mark.anyio
async def test_b17_payment_status_and_breakdowns():
    """Verify payment status tracking (unpaid/partial) and category/crop/field breakdowns."""
    farmer_id, token = await create_user("Anasuya Devi", "anasuya_pay@test.com")
    farm_id = await create_farm(farmer_id, farm_size=3.0)

    # 1. Paid seeds: ₹1,000
    # 2. Unpaid fertilizer: ₹4,000
    # 3. Partial machinery rental: ₹2,500
    txs = [
        {
            "type": "expense",
            "category": "seeds",
            "description": "Chilli Seeds",
            "amount": 1000.0,
            "date": "2026-08-01",
            "field_id": "Plot A",
            "crop_name": "Chilli",
            "season": "Kharif 2026",
            "payment_status": "paid"
        },
        {
            "type": "expense",
            "category": "fertilizer",
            "description": "Complex 10-26-26 on Credit",
            "amount": 4000.0,
            "date": "2026-08-15",
            "field_id": "Plot A",
            "crop_name": "Chilli",
            "season": "Kharif 2026",
            "payment_status": "unpaid"
        },
        {
            "type": "expense",
            "category": "machinery",
            "description": "Tractor Plowing Advance",
            "amount": 2500.0,
            "date": "2026-08-20",
            "field_id": "Plot B",
            "crop_name": "Tomato",
            "season": "Kharif 2026",
            "payment_status": "partial"
        }
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for tx in txs:
            res = await client.post(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"}, json=tx)
            assert res.status_code == 201

        analytics_res = await client.get(f"/api/farms/{farm_id}/khata/analytics", headers={"Authorization": f"Bearer {token}"})
        assert analytics_res.status_code == 200
        an = analytics_res.json()

        assert an["total_actual_expenses"] == 7500.0
        assert an["unpaid_amount"] == 4000.0
        assert an["partial_amount"] == 2500.0

        # Category breakdown
        cat_b = an["category_breakdown"]
        assert cat_b["seeds"]["amount"] == 1000.0
        assert cat_b["fertilizer"]["amount"] == 4000.0
        assert cat_b["machinery"]["amount"] == 2500.0
        # Category percentage checks
        assert round(cat_b["seeds"]["percentage"], 1) == round(1000.0 / 7500.0 * 100, 1)

        # Crop breakdown
        crop_b = an["crop_breakdown"]
        assert crop_b["Chilli"]["expense"] == 5000.0
        assert crop_b["Tomato"]["expense"] == 2500.0

        # Field breakdown
        field_b = an["field_breakdown"]
        assert field_b["Plot A"]["expense"] == 5000.0
        assert field_b["Plot B"]["expense"] == 2500.0


@pytest.mark.anyio
async def test_b17_farm_level_unallocated_expenses():
    """Verify expenses without field or crop are assigned to Farm-level and Unallocated."""
    farmer_id, token = await create_user("Venkatesh", "venkatesh_unalloc@test.com")
    farm_id = await create_farm(farmer_id)

    # General infrastructure: Borewell repair
    payload = {
        "type": "expense",
        "category": "irrigation",
        "description": "Borewell Submersible Pump Rewinding",
        "amount": 3800.0,
        "date": "2026-08-25"
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"}, json=payload)
        assert res.status_code == 201

        analytics_res = await client.get(f"/api/farms/{farm_id}/khata/analytics", headers={"Authorization": f"Bearer {token}"})
        an = analytics_res.json()
        assert an["crop_breakdown"]["Unallocated"]["expense"] == 3800.0
        assert an["field_breakdown"]["Farm-level"]["expense"] == 3800.0


@pytest.mark.anyio
async def test_b17_tenant_isolation_and_security():
    """Verify Farmer B cannot read or alter Farmer A's financial ledger or analytics."""
    f1_id, token_f1 = await create_user("Farmer One", "f1_priv@test.com")
    f2_id, token_f2 = await create_user("Farmer Two", "f2_priv@test.com")
    farm1_id = await create_farm(f1_id, "F1 Protected Farm")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # F1 adds expense
        await client.post(
            f"/api/farms/{farm1_id}/khata",
            headers={"Authorization": f"Bearer {token_f1}"},
            json={"type": "expense", "category": "seeds", "description": "F1 Seeds", "amount": 1200.0, "date": "2026-09-01"}
        )

        # F2 attempts to read F1's Khata -> 403 Forbidden
        res_khata = await client.get(f"/api/farms/{farm1_id}/khata", headers={"Authorization": f"Bearer {token_f2}"})
        assert res_khata.status_code == 403

        # F2 attempts to read F1's Analytics -> 403 Forbidden
        res_an = await client.get(f"/api/farms/{farm1_id}/khata/analytics", headers={"Authorization": f"Bearer {token_f2}"})
        assert res_an.status_code == 403

        # Unauthenticated request -> 401 Unauthorized
        res_unauth = await client.get(f"/api/farms/{farm1_id}/khata/analytics")
        assert res_unauth.status_code == 401


@pytest.mark.anyio
async def test_b17_validation_rules():
    """Verify strict validation on amount, transaction type, and payment status."""
    farmer_id, token = await create_user("Nagaraju", "raju_val@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Negative amount -> 400 Bad Request
        res1 = await client.post(
            f"/api/farms/{farm_id}/khata",
            headers={"Authorization": f"Bearer {token}"},
            json={"type": "expense", "category": "seeds", "description": "Invalid negative", "amount": -500.0, "date": "2026-09-01"}
        )
        assert res1.status_code in [400, 422]

        # 2. Zero amount -> 400 Bad Request
        res2 = await client.post(
            f"/api/farms/{farm_id}/khata",
            headers={"Authorization": f"Bearer {token}"},
            json={"type": "expense", "category": "seeds", "description": "Invalid zero", "amount": 0.0, "date": "2026-09-01"}
        )
        assert res2.status_code in [400, 422]

        # 3. Invalid transaction type -> 400 Bad Request
        res3 = await client.post(
            f"/api/farms/{farm_id}/khata",
            headers={"Authorization": f"Bearer {token}"},
            json={"type": "dividend", "category": "seeds", "description": "Invalid type", "amount": 1000.0, "date": "2026-09-01"}
        )
        assert res3.status_code == 400

        # 4. Invalid payment status -> 400 Bad Request
        res4 = await client.post(
            f"/api/farms/{farm_id}/khata",
            headers={"Authorization": f"Bearer {token}"},
            json={"type": "expense", "category": "seeds", "description": "Invalid status", "amount": 1000.0, "date": "2026-09-01", "payment_status": "crypto"}
        )
        assert res4.status_code == 400


@pytest.mark.anyio
async def test_b17_booking_idempotency_regression():
    """Verify duplicate equipment booking sync returns existing transaction without duplicating."""
    farmer_id, token = await create_user("Gopal", "gopal_booking@test.com")
    farm_id = await create_farm(farmer_id)

    booking_tx = {
        "type": "expense",
        "category": "machinery",
        "description": "Tractor Rotavator Booking #BK-9999",
        "amount": 3500.0,
        "date": "2026-09-10",
        "booking_id": "BK-9999"
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First sync
        res1 = await client.post(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"}, json=booking_tx)
        assert res1.status_code == 201

        # Second sync with same booking_id -> returns existing record without duplicating
        res2 = await client.post(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"}, json=booking_tx)
        assert res2.status_code in [200, 201]

        # Khata total count must still be 1
        list_res = await client.get(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"})
        assert list_res.json()["count"] == 1


@pytest.mark.anyio
async def test_b17_filter_parameters():
    """Verify filtering transactions by type, is_estimated, and payment_status."""
    farmer_id, token = await create_user("Bhavani", "bhavani_filt@test.com")
    farm_id = await create_farm(farmer_id)

    txs = [
        {"type": "expense", "category": "seeds", "description": "Actual Seeds", "amount": 1000.0, "date": "2026-09-01", "is_estimated": False, "payment_status": "paid"},
        {"type": "expense", "category": "fertilizer", "description": "Unpaid Fertilizer", "amount": 2000.0, "date": "2026-09-02", "is_estimated": False, "payment_status": "unpaid"},
        {"type": "income", "category": "harvest", "description": "Actual Sale", "amount": 8000.0, "date": "2026-09-03", "is_estimated": False, "payment_status": "paid"},
        {"type": "income", "category": "harvest", "description": "Estimated Harvest", "amount": 15000.0, "date": "2026-09-04", "is_estimated": True, "payment_status": "paid"}
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for tx in txs:
            await client.post(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"}, json=tx)

        # 1. Filter is_estimated=true -> only 1 record
        res_est = await client.get(f"/api/farms/{farm_id}/khata?is_estimated=true", headers={"Authorization": f"Bearer {token}"})
        assert res_est.json()["count"] == 1
        assert res_est.json()["transactions"][0]["description"] == "Estimated Harvest"

        # 2. Filter is_estimated=false -> 3 records
        res_act = await client.get(f"/api/farms/{farm_id}/khata?is_estimated=false", headers={"Authorization": f"Bearer {token}"})
        assert res_act.json()["count"] == 3

        # 3. Filter payment_status=unpaid -> 1 record
        res_unpaid = await client.get(f"/api/farms/{farm_id}/khata?payment_status=unpaid", headers={"Authorization": f"Bearer {token}"})
        assert res_unpaid.json()["count"] == 1
        assert res_unpaid.json()["transactions"][0]["category"] == "fertilizer"
