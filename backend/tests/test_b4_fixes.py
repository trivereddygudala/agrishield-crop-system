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
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.farm_profiles.records = []
    mock_db.support_tickets.records = []
    yield
    mock_db.users.records = []
    mock_db.predictions.records = []
    mock_db.notifications.records = []
    mock_db.farm_profiles.records = []
    mock_db.support_tickets.records = []


async def create_user(name: str, email: str, role: str = "farmer", preferred_language: str = "en"):
    user_id = ObjectId()
    user_doc = {
        "_id": user_id,
        "id": str(user_id),
        "name": name,
        "email": email,
        "role": role,
        "preferred_language": preferred_language,
        "preferred_languages": ["en", preferred_language] if preferred_language != "en" else ["en"]
    }
    mock_db.users.records.append(user_doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token


# ==============================================================================
# C-1 TESTS: Registration Signature & Data Persistence
# ==============================================================================

@pytest.mark.anyio
async def test_c1_registration_with_crops_and_string_location():
    """Verify registration retains crops, equipment_types, and normalized farm_location."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "name": "Ramu Farmer",
            "email": "ramu.farmer@example.com",
            "password": "Password123!",
            "role": "farmer",
            "preferred_language": "te",
            "selected_crops": ["Tomato", "Chilli", "Cotton"],
            "equipment_types": [],
            "farm_location": "Pasupugallu, Guntur, Andhra Pradesh"
        }
        res = await client.post("/api/auth/register", json=payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["selected_crops"] == ["Tomato", "Chilli", "Cotton"]
        assert data["farm_location"] == "Pasupugallu, Guntur, Andhra Pradesh"
        assert data["role"] == "farmer"

        # Verify persisted in database
        user_doc = await mock_db.users.find_one({"email": "ramu.farmer@example.com"})
        assert user_doc is not None
        assert user_doc["selected_crops"] == ["Tomato", "Chilli", "Cotton"]
        assert user_doc["farm_location"] == "Pasupugallu, Guntur, Andhra Pradesh"


@pytest.mark.anyio
async def test_c1_registration_dict_location_normalized_to_string():
    """Verify dictionary farm_location is normalized to string by schemas validator."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "name": "Kiran Provider",
            "email": "kiran.provider@example.com",
            "password": "Password123!",
            "role": "farmer",
            "preferred_language": "en",
            "selected_crops": [],
            "equipment_types": ["Tractor", "Harvester"],
            "farm_location": {
                "village": "Kandukur",
                "district": "Prakasam",
                "state": "Andhra Pradesh"
            }
        }
        res = await client.post("/api/auth/register", json=payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["farm_location"] == "Kandukur, Prakasam, Andhra Pradesh"


# ==============================================================================
# C-2 TESTS: Intelligence farm_id Authorization & 404 Handling
# ==============================================================================

@pytest.mark.anyio
async def test_c2_intelligence_weather_authorization_and_404():
    """Verify farm_id requires auth, returns 404 for nonexistent, 403 for other user, 200 for owner/admin."""
    # Setup users
    farmer1_id, token_f1 = await create_user("Farmer One", "f1@agri.com", "farmer")
    farmer2_id, token_f2 = await create_user("Farmer Two", "f2@agri.com", "farmer")
    admin_id, token_admin = await create_user("Admin Officer", "admin@agri.com", "admin")

    # Setup farm owned by farmer1
    farm_id = ObjectId()
    farm_doc = {
        "_id": farm_id,
        "id": str(farm_id),
        "user_id": farmer1_id,
        "farm_name": "Sunrise Farm",
        "latitude": 16.5062,
        "longitude": 80.6480,
        "village": "Pasupugallu",
        "district": "Guntur"
    }
    await mock_db.farm_profiles.insert_one(farm_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request with farm_id -> 401
        res_unauth = await client.get(f"/api/intelligence/weather?farm_id={str(farm_id)}")
        assert res_unauth.status_code == 401, res_unauth.text

        # 2. Nonexistent farm_id with authenticated user -> 404
        nonexistent_id = str(ObjectId())
        res_404 = await client.get(
            f"/api/intelligence/weather?farm_id={nonexistent_id}",
            headers={"Authorization": f"Bearer {token_f1}"}
        )
        assert res_404.status_code == 404, res_404.text

        # 3. Unauthorized farmer2 trying to access farmer1's farm -> 403
        res_403 = await client.get(
            f"/api/intelligence/weather?farm_id={str(farm_id)}",
            headers={"Authorization": f"Bearer {token_f2}"}
        )
        assert res_403.status_code == 403, res_403.text

        # 4. Authorized owner farmer1 -> 200
        res_owner = await client.get(
            f"/api/intelligence/weather?farm_id={str(farm_id)}",
            headers={"Authorization": f"Bearer {token_f1}"}
        )
        assert res_owner.status_code == 200, res_owner.text

        # 5. Admin access -> 200
        res_admin = await client.get(
            f"/api/intelligence/weather?farm_id={str(farm_id)}",
            headers={"Authorization": f"Bearer {token_admin}"}
        )
        assert res_admin.status_code == 200, res_admin.text

        # 6. Public weather request with explicit lat/lon and no farm_id -> 200 unauthenticated
        res_public = await client.get("/api/intelligence/weather?lat=16.5&lon=80.6")
        assert res_public.status_code == 200, res_public.text


@pytest.mark.anyio
async def test_c2_intelligence_other_endpoints_authorization():
    """Verify irrigation and disease-risk also enforce _verify_farm_access."""
    farmer1_id, token_f1 = await create_user("Farmer One", "f1@agri.com", "farmer")
    farmer2_id, token_f2 = await create_user("Farmer Two", "f2@agri.com", "farmer")

    farm_id = ObjectId()
    await mock_db.farm_profiles.insert_one({
        "_id": farm_id,
        "id": str(farm_id),
        "user_id": farmer1_id,
        "farm_name": "F1 Farm",
        "latitude": 16.5,
        "longitude": 80.6
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Irrigation: 401 unauth, 403 non-owner
        r1 = await client.get(f"/api/intelligence/irrigation?farm_id={str(farm_id)}")
        assert r1.status_code == 401

        r2 = await client.get(
            f"/api/intelligence/irrigation?farm_id={str(farm_id)}",
            headers={"Authorization": f"Bearer {token_f2}"}
        )
        assert r2.status_code == 403

        # Disease risk: 401 unauth, 403 non-owner
        r3 = await client.get(f"/api/intelligence/disease-risk?farm_id={str(farm_id)}")
        assert r3.status_code == 401

        r4 = await client.get(
            f"/api/intelligence/disease-risk?farm_id={str(farm_id)}",
            headers={"Authorization": f"Bearer {token_f2}"}
        )
        assert r4.status_code == 403


# ==============================================================================
# H-1 TESTS: Single Prediction Fetch GET /api/history/{id} & Auth
# ==============================================================================

@pytest.mark.anyio
async def test_h1_get_history_record_by_id_authorization():
    """Verify GET /api/history/{id} enforces authentication and owner/admin check."""
    farmer1_id, token_f1 = await create_user("Farmer One", "f1@agri.com", "farmer")
    farmer2_id, token_f2 = await create_user("Farmer Two", "f2@agri.com", "farmer")
    admin_id, token_admin = await create_user("Admin Officer", "admin@agri.com", "admin")

    pred_id = ObjectId()
    pred_doc = {
        "_id": pred_id,
        "id": str(pred_id),
        "user_id": farmer1_id,
        "crop_name": "Tomato",
        "disease_name": "Early Blight",
        "confidence": 0.94,
        "prediction_status": "diseased",
        "image_path": "uploads/predictions/test.jpg"
    }
    await mock_db.predictions.insert_one(pred_doc)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request -> 401
        res_unauth = await client.get(f"/api/history/{str(pred_id)}")
        assert res_unauth.status_code == 401

        # 2. Nonexistent record ID -> 404
        nonexistent_id = str(ObjectId())
        res_404 = await client.get(
            f"/api/history/{nonexistent_id}",
            headers={"Authorization": f"Bearer {token_f1}"}
        )
        assert res_404.status_code == 404

        # 3. Farmer 2 trying to read Farmer 1's record -> 403 Forbidden
        res_403 = await client.get(
            f"/api/history/{str(pred_id)}",
            headers={"Authorization": f"Bearer {token_f2}"}
        )
        assert res_403.status_code == 403

        # 4. Farmer 1 (owner) reading own record -> 200 OK
        res_owner = await client.get(
            f"/api/history/{str(pred_id)}",
            headers={"Authorization": f"Bearer {token_f1}"}
        )
        assert res_owner.status_code == 200
        data = res_owner.json()
        assert data["crop_name"] == "Tomato"
        assert data["disease_name"] == "Early Blight"

        # 5. Admin reading record -> 200 OK
        res_admin = await client.get(
            f"/api/history/{str(pred_id)}",
            headers={"Authorization": f"Bearer {token_admin}"}
        )
        assert res_admin.status_code == 200


# ==============================================================================
# H-3 TESTS: Support Ticket Language Submission
# ==============================================================================

@pytest.mark.anyio
async def test_h3_support_ticket_language_retention():
    """Verify support ticket preserves non-English language code."""
    farmer_id, token = await create_user("Selvam", "farmer.tamil@example.com", "farmer", "ta")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "category": "crop_disease",
            "priority": "high",
            "subject": "தக்காளி இலை கருகல்",
            "description": "தக்காளி பயிரில் இலைகள் கருகி உதிர்ந்து போகின்றன.",
            "language": "ta"
        }
        res = await client.post(
            "/api/support/tickets",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["ticket"]["language"] == "ta"
        assert data["ticket"]["source_language"] == "ta"
