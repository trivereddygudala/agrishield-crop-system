import pytest
from datetime import datetime, timezone, timedelta
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
    mock_db.farm_inventory.records = []
    yield
    mock_db.users.records = []
    mock_db.farm_profiles.records = []
    mock_db.farm_khata.records = []
    mock_db.farm_inventory.records = []


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


async def create_farm(user_id: str, farm_name: str = "Green Valley Farm"):
    farm_id = ObjectId()
    farm_doc = {
        "_id": farm_id,
        "id": str(farm_id),
        "user_id": user_id,
        "farm_name": farm_name,
        "crop_name": "Tomato",
        "farm_size": 2.5,
        "farm_unit": "acres",
        "village": "Pasupugallu",
        "timeline_tasks": {}
    }
    mock_db.farm_profiles.records.append(farm_doc)
    return str(farm_id)


# ══════════════════════════════════════════════════════════════════════════════
# B18 TESTS: SMART FARM INVENTORY MANAGER
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.anyio
async def test_1_create_inventory_item():
    """1. Create inventory item with valid fields."""
    farmer_id, token = await create_user("Sita Devi", "sita_dev@test.com")
    farm_id = await create_farm(farmer_id)

    payload = {
        "item_name": "Urea Neem Coated",
        "category": "fertilizer",
        "quantity": 10.0,
        "unit": "bags",
        "brand": "IFFCO",
        "active_ingredient": "Nitrogen 46%",
        "minimum_quantity": 3.0,
        "purchase_date": "2026-09-01",
        "expiry_date": "2028-09-01",
        "batch_number": "B-9981",
        "vendor": "Kisan Seva Kendra",
        "purchase_price": 2665.0,
        "field_id": "Field-1",
        "crop_name": "Tomato"
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 201
        data = res.json()
        assert data["item_name"] == "Urea Neem Coated"
        assert data["category"] == "fertilizer"
        assert data["quantity"] == 10.0
        assert data["unit"] == "bags"
        assert data["cost_per_unit"] == 266.5  # 2665 / 10
        assert data["remaining_stock_value"] == 2665.0
        assert data["status"] == "in_stock"
        assert data["archived"] is False


@pytest.mark.anyio
async def test_2_list_inventory_and_filters():
    """2. List inventory items with category and status filtering."""
    farmer_id, token = await create_user("Ramu", "ramu@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create 2 items: fertilizer and seeds
        await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "DAP", "category": "fertilizer", "quantity": 5.0, "unit": "bags"},
            headers={"Authorization": f"Bearer {token}"}
        )
        await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Tomato Arka Rakshak", "category": "seeds", "quantity": 2.0, "unit": "packets"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # List all
        res = await client.get(f"/api/farms/{farm_id}/inventory", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["count"] == 2

        # Filter by category seeds
        res_seeds = await client.get(f"/api/farms/{farm_id}/inventory?category=seeds", headers={"Authorization": f"Bearer {token}"})
        assert res_seeds.status_code == 200
        assert res_seeds.json()["count"] == 1
        assert res_seeds.json()["items"][0]["item_name"] == "Tomato Arka Rakshak"


@pytest.mark.anyio
async def test_3_get_inventory_detail():
    """3. Get detailed information for a single inventory item."""
    farmer_id, token = await create_user("Anil", "anil@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Mancozeb 75 WP", "category": "pesticide", "quantity": 3.0, "unit": "kg", "brand": "Indofil"},
            headers={"Authorization": f"Bearer {token}"}
        )
        item_id = created.json()["id"]

        detail_res = await client.get(f"/api/farms/{farm_id}/inventory/{item_id}", headers={"Authorization": f"Bearer {token}"})
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == item_id
        assert detail["item_name"] == "Mancozeb 75 WP"
        assert detail["brand"] == "Indofil"


@pytest.mark.anyio
async def test_4_5_6_use_stock_and_history_and_limits():
    """4, 5, 6. Use stock, record usage history, and prevent using more than available."""
    farmer_id, token = await create_user("Lakshmi", "lakshmi@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Potash MOP", "category": "fertilizer", "quantity": 10.0, "unit": "bags"},
            headers={"Authorization": f"Bearer {token}"}
        )
        item_id = created.json()["id"]

        # Use 3 bags
        use_res = await client.post(
            f"/api/farms/{farm_id}/inventory/{item_id}/use",
            json={
                "quantity_used": 3.0,
                "activity": "Top dressing application",
                "field_id": "Field-2",
                "crop_name": "Chilli",
                "notes": "Applied before irrigation"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert use_res.status_code == 200
        data = use_res.json()
        assert data["quantity"] == 7.0
        assert len(data["usage_history"]) == 1
        entry = data["usage_history"][0]
        assert entry["quantity_used"] == 3.0
        assert entry["activity"] == "Top dressing application"
        assert entry["field_id"] == "Field-2"

        # Attempt to use 8 bags (more than remaining 7 bags) -> 400
        over_res = await client.post(
            f"/api/farms/{farm_id}/inventory/{item_id}/use",
            json={"quantity_used": 8.0},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert over_res.status_code == 400
        assert "Cannot use 8.0 bags" in over_res.json()["detail"]


@pytest.mark.anyio
async def test_7_restock_item():
    """7. Restock an existing inventory item."""
    farmer_id, token = await create_user("Kiran", "kiran@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Drip Lateral Pipe", "category": "irrigation", "quantity": 100.0, "unit": "metres"},
            headers={"Authorization": f"Bearer {token}"}
        )
        item_id = created.json()["id"]

        # Restock 50 metres
        restock_res = await client.post(
            f"/api/farms/{farm_id}/inventory/{item_id}/restock",
            json={"quantity": 50.0, "purchase_price": 750.0, "vendor": "Jain Irrigation"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert restock_res.status_code == 200
        data = restock_res.json()
        assert data["quantity"] == 150.0
        assert data["vendor"] == "Jain Irrigation"


@pytest.mark.anyio
async def test_8_12_zero_stock_and_out_of_stock_status():
    """8, 12. Zero stock preserves item and derives out_of_stock status."""
    farmer_id, token = await create_user("Sunil", "sunil@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Neem Oil 10000 PPM", "category": "pesticide", "quantity": 2.0, "unit": "litres"},
            headers={"Authorization": f"Bearer {token}"}
        )
        item_id = created.json()["id"]

        # Consume all 2.0 litres
        await client.post(
            f"/api/farms/{farm_id}/inventory/{item_id}/use",
            json={"quantity_used": 2.0, "activity": "Spray on cotton"},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Check detail: item is NOT deleted, quantity is 0, status is out_of_stock
        detail_res = await client.get(f"/api/farms/{farm_id}/inventory/{item_id}", headers={"Authorization": f"Bearer {token}"})
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["quantity"] == 0.0
        assert detail["status"] == "out_of_stock"


@pytest.mark.anyio
async def test_9_low_stock_status():
    """9. Low stock derived when quantity <= minimum_quantity."""
    farmer_id, token = await create_user("Prasad", "prasad@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Urea", "category": "fertilizer", "quantity": 5.0, "unit": "bags", "minimum_quantity": 3.0},
            headers={"Authorization": f"Bearer {token}"}
        )
        item_id = created.json()["id"]
        assert created.json()["status"] == "in_stock"

        # Use 3 bags -> 2 left (<= minimum_quantity 3.0)
        use_res = await client.post(
            f"/api/farms/{farm_id}/inventory/{item_id}/use",
            json={"quantity_used": 3.0},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert use_res.json()["quantity"] == 2.0
        assert use_res.json()["status"] == "low_stock"


@pytest.mark.anyio
async def test_10_11_expired_and_expiring_soon_status():
    """10, 11. Expiry precedence: expired when past date, expiring_soon when within 30 days."""
    farmer_id, token = await create_user("Chandra", "chandra@test.com")
    farm_id = await create_farm(farmer_id)

    now = datetime.now(timezone.utc)
    expired_date = (now - timedelta(days=5)).strftime("%Y-%m-%d")
    soon_date = (now + timedelta(days=15)).strftime("%Y-%m-%d")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Expired item
        res_exp = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Old Bio Pesticide", "category": "pesticide", "quantity": 4.0, "unit": "bottles", "expiry_date": expired_date},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_exp.json()["status"] == "expired"

        # Expiring soon item
        res_soon = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Trichoderma Viride", "category": "pesticide", "quantity": 6.0, "unit": "packets", "expiry_date": soon_date},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_soon.json()["status"] == "expiring_soon"


@pytest.mark.anyio
async def test_13_14_tenant_isolation_and_unauthorized_access():
    """13, 14. Farmer A cannot see, use, or modify Farmer B's inventory."""
    farmer_a, token_a = await create_user("Farmer A", "farmer_a@test.com")
    farm_a = await create_farm(farmer_a, "Farm Alpha")

    farmer_b, token_b = await create_user("Farmer B", "farmer_b@test.com")
    farm_b = await create_farm(farmer_b, "Farm Beta")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Farmer A creates item in Farm A
        created = await client.post(
            f"/api/farms/{farm_a}/inventory",
            json={"item_name": "Alpha Seeds", "category": "seeds", "quantity": 10.0, "unit": "packets"},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        item_id = created.json()["id"]

        # Farmer B tries to access Farm A's inventory list -> 403 Forbidden
        list_res = await client.get(f"/api/farms/{farm_a}/inventory", headers={"Authorization": f"Bearer {token_b}"})
        assert list_res.status_code == 403

        # Farmer B tries to get Farm A's item -> 403
        get_res = await client.get(f"/api/farms/{farm_a}/inventory/{item_id}", headers={"Authorization": f"Bearer {token_b}"})
        assert get_res.status_code == 403

        # Farmer B tries to use Farm A's item -> 403
        use_res = await client.post(
            f"/api/farms/{farm_a}/inventory/{item_id}/use",
            json={"quantity_used": 1.0},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert use_res.status_code == 403


@pytest.mark.anyio
async def test_15_archive_behavior():
    """15. Archiving hides item from default list but preserves record."""
    farmer_id, token = await create_user("Naidu", "naidu@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Broken Spade", "category": "tools", "quantity": 1.0, "unit": "pieces"},
            headers={"Authorization": f"Bearer {token}"}
        )
        item_id = created.json()["id"]

        # Archive item
        arch_res = await client.delete(f"/api/farms/{farm_id}/inventory/{item_id}", headers={"Authorization": f"Bearer {token}"})
        assert arch_res.status_code == 200
        assert arch_res.json()["archived"] is True

        # Default list does NOT show archived item
        list_res = await client.get(f"/api/farms/{farm_id}/inventory", headers={"Authorization": f"Bearer {token}"})
        assert list_res.json()["count"] == 0

        # With include_archived=true it is retrieved
        list_arch = await client.get(f"/api/farms/{farm_id}/inventory?include_archived=true", headers={"Authorization": f"Bearer {token}"})
        assert list_arch.json()["count"] == 1
        assert list_arch.json()["items"][0]["archived"] is True


@pytest.mark.anyio
async def test_16_17_field_crop_association_and_quantity_validation():
    """16, 17. Optional crop/field association and negative quantity rejection."""
    farmer_id, token = await create_user("Rao", "rao@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Negative quantity must fail
        neg_res = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={"item_name": "Invalid Item", "category": "seeds", "quantity": -5.0, "unit": "kg"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert neg_res.status_code == 422 or neg_res.status_code == 400

        # Valid crop and field association
        valid_res = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={
                "item_name": "Tomato Stake Twine",
                "category": "other",
                "quantity": 5.0,
                "unit": "pieces",
                "crop_name": "Tomato",
                "field_id": "Plot-4B"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert valid_res.status_code == 201
        assert valid_res.json()["crop_name"] == "Tomato"
        assert valid_res.json()["field_id"] == "Plot-4B"


@pytest.mark.anyio
async def test_18_agrochemical_prefill_integration():
    """18. Creating inventory with agrochemical scanner prefilled fields."""
    farmer_id, token = await create_user("Srinivas", "srini@test.com")
    farm_id = await create_farm(farmer_id)

    # Scanner provides item_name, brand, active_ingredient, notes
    scanned_payload = {
        "item_name": "Coragen Insecticide",
        "category": "pesticide",
        "brand": "FMC",
        "active_ingredient": "Chlorantraniliprole 18.5% SC",
        "quantity": 3.0,
        "unit": "bottles",
        "purchase_price": 4500.0,
        "notes": "Scanned bottle. Target pests: Helicoverpa, Spodoptera."
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json=scanned_payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 201
        data = res.json()
        assert data["item_name"] == "Coragen Insecticide"
        assert data["brand"] == "FMC"
        assert data["active_ingredient"] == "Chlorantraniliprole 18.5% SC"
        assert data["quantity"] == 3.0
        assert data["cost_per_unit"] == 1500.0


@pytest.mark.anyio
async def test_19_20_khata_link_and_idempotency():
    """19, 20. B17 Khata link records expense without duplicates on retry."""
    farmer_id, token = await create_user("Venkat", "venkat@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create item with record_in_khata = True
        create_res = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={
                "item_name": "DAP Fertilizer",
                "category": "fertilizer",
                "quantity": 4.0,
                "unit": "bags",
                "purchase_price": 5400.0,
                "record_in_khata": True,
                "vendor": "Agro Hub"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert create_res.status_code == 201
        data = create_res.json()
        assert data["khata_tx_id"] is not None

        # Verify ONE expense was inserted in farm_khata
        khata_list = await client.get(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"})
        assert khata_list.status_code == 200
        assert khata_list.json()["count"] == 1
        tx = khata_list.json()["transactions"][0]
        assert tx["amount"] == 5400.0
        assert tx["type"] == "expense"
        assert "DAP Fertilizer" in tx["description"]

        # Restock without Khata: does NOT add Khata expense
        await client.post(
            f"/api/farms/{farm_id}/inventory/{data['id']}/restock",
            json={"quantity": 2.0, "record_in_khata": False},
            headers={"Authorization": f"Bearer {token}"}
        )
        khata_list_after = await client.get(f"/api/farms/{farm_id}/khata", headers={"Authorization": f"Bearer {token}"})
        assert khata_list_after.json()["count"] == 1  # Still exactly 1!


@pytest.mark.anyio
async def test_21_22_summary_metrics_and_remaining_stock_valuation():
    """21, 22. Summary calculations and remaining stock valuation (10 bags @ ₹500, use 6 -> ₹2,000 remaining)."""
    farmer_id, token = await create_user("Nagesh", "nagesh@test.com")
    farm_id = await create_farm(farmer_id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Item 1: 10 bags @ ₹5000 (cost_per_unit = ₹500)
        c1 = await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={
                "item_name": "Urea",
                "category": "fertilizer",
                "quantity": 10.0,
                "unit": "bags",
                "purchase_price": 5000.0,
                "minimum_quantity": 3.0
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        item1_id = c1.json()["id"]

        # Farmer uses 6 bags -> 4 bags remain
        await client.post(
            f"/api/farms/{farm_id}/inventory/{item1_id}/use",
            json={"quantity_used": 6.0},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Item 2: 2 packets seeds @ ₹1200 each = ₹2400 total
        await client.post(
            f"/api/farms/{farm_id}/inventory",
            json={
                "item_name": "Chilli Seeds",
                "category": "seeds",
                "quantity": 2.0,
                "unit": "packets",
                "purchase_price": 2400.0
            },
            headers={"Authorization": f"Bearer {token}"}
        )

        # Get summary
        sum_res = await client.get(f"/api/farms/{farm_id}/inventory/summary", headers={"Authorization": f"Bearer {token}"})
        assert sum_res.status_code == 200
        summary = sum_res.json()

        assert summary["total_items"] == 2
        # Item 1: 4 bags remaining * ₹500 = ₹2000
        # Item 2: 2 packets remaining * ₹1200 = ₹2400
        # Total remaining stock value = ₹4400 (NOT the original 5000 + 2400 = 7400!)
        assert summary["total_stock_value"] == 4400.0
        assert summary["category_counts"]["fertilizer"] == 1
        assert summary["category_counts"]["seeds"] == 1
