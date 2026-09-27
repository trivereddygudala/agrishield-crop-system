import pytest
from httpx import ASGITransport, AsyncClient
from bson import ObjectId
from pydantic import ValidationError

from backend.app.main import app
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
from backend.app.models.schemas import (
    UserBase,
    UserResponse,
    ProfileUpdate,
    SUPPORTED_LANGUAGE_CODES
)

# Setup Mock database for testing
mock_db = MockDatabase()
db_instance.db = mock_db

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
def clean_mock_data():
    db_instance.db = mock_db
    app.dependency_overrides[get_database] = override_get_database
    mock_db.users.records = []
    mock_db.devices.records = []
    yield
    mock_db.users.records = []
    mock_db.devices.records = []

# --- Required Test 1: ["en", "te", "hi"] -> ["en", "te", "hi"] ---
def test_01_en_te_hi():
    update = ProfileUpdate(preferred_languages=["en", "te", "hi"])
    assert update.preferred_languages == ["en", "te", "hi"]
    assert update.preferred_language == "en"

# --- Required Test 2: ["te", "en", "hi"] -> ["en", "te", "hi"] ---
def test_02_te_en_hi_normalizes_to_en_first():
    update = ProfileUpdate(preferred_languages=["te", "en", "hi"])
    assert update.preferred_languages == ["en", "te", "hi"]
    assert update.preferred_language == "en"

# --- Required Test 3: ["hi", "te", "en"] -> ["en", "hi", "te"] ---
def test_03_hi_te_en_normalizes_to_en_first_preserving_regional():
    update = ProfileUpdate(preferred_languages=["hi", "te", "en"])
    assert update.preferred_languages == ["en", "hi", "te"]
    assert update.preferred_language == "en"

# --- Required Test 4: ["te", "hi"] -> ["en", "te", "hi"] ---
def test_04_te_hi_normalizes_to_include_en_at_index_0():
    update = ProfileUpdate(preferred_languages=["te", "hi"])
    assert update.preferred_languages == ["en", "te", "hi"]
    assert update.preferred_language == "en"

# --- Required Test 5: ["kn"] -> ["en", "kn"] ---
def test_05_single_regional_normalizes_to_include_en_at_index_0():
    update = ProfileUpdate(preferred_languages=["kn"])
    assert update.preferred_languages == ["en", "kn"]
    assert update.preferred_language == "en"

# --- Required Test 6: Four languages -> rejected ---
def test_06_four_languages_rejected():
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te", "hi", "ta"])
    assert "Maximum 3 preferred languages allowed" in str(exc_info.value)

# --- Required Test 7: Duplicate -> rejected ---
def test_07_duplicate_rejected():
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te", "te"])
    assert "Duplicate language codes are not allowed" in str(exc_info.value)

# --- Required Test 8: Unsupported language -> rejected ---
def test_08_unsupported_language_rejected():
    # Unsupported random code
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te", "xx"])
    assert "Unsupported language code: 'xx'" in str(exc_info.value)

    # Sanskrit 'sa' is not in canonical 13 list -> must be rejected
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te", "sa"])
    assert "Unsupported language code: 'sa'" in str(exc_info.value)

    # Assamese 'as' IS supported in canonical 13 list -> must succeed
    update_as = ProfileUpdate(preferred_languages=["en", "as"])
    assert update_as.preferred_languages == ["en", "as"]
    assert len(SUPPORTED_LANGUAGE_CODES) == 13

# --- Required Test 9: Legacy preferred_language compatibility ---
def test_09_legacy_preferred_language_compatibility():
    # Legacy user with "te"
    legacy_te = {"id": "user_1", "email": "f1@agrishield.com", "preferred_language": "te"}
    res_te = UserResponse(**legacy_te)
    assert res_te.preferred_language == "te"
    assert res_te.preferred_languages == ["en", "te"]

    # Legacy user with "en"
    legacy_en = {"id": "user_2", "email": "f2@agrishield.com", "preferred_language": "en"}
    res_en = UserResponse(**legacy_en)
    assert res_en.preferred_language == "en"
    assert res_en.preferred_languages == ["en"]

# --- Required Test 10: Conflicting preferred_language and preferred_languages synchronization ---
def test_10_conflicting_singular_and_plural_synchronization():
    # preferred_languages is authoritative; preferred_language is synchronized to index 0 ("en")
    update = ProfileUpdate(
        preferred_language="te",
        preferred_languages=["en", "hi", "te"]
    )
    assert update.preferred_languages == ["en", "hi", "te"]
    assert update.preferred_language == "en"

    # Only single preferred_language supplied -> preferred_languages constructed with "en" at index 0
    update_single = ProfileUpdate(preferred_language="kn")
    assert update_single.preferred_language == "kn"
    assert update_single.preferred_languages == ["en", "kn"]

# --- Helpers for API Integration Tests ---
async def create_test_user(name: str, email: str, role: str, pref_lang: str = "en", pref_langs: list = None):
    user_id = ObjectId()
    doc = {
        "_id": user_id,
        "name": name,
        "email": email,
        "role": role,
        "preferred_language": pref_lang,
        "preferred_languages": pref_langs or ([pref_lang] if pref_lang == "en" else ["en", pref_lang]),
        "password_hash": "dummy_hash",
        "password_history": ["dummy_hash"]
    }
    await mock_db.users.insert_one(doc)
    token = create_access_token(subject=str(user_id), role=role)
    return str(user_id), token

# --- Required Test 11: Farmer persistence ---
@pytest.mark.anyio
async def test_11_farmer_persistence():
    user_id, token = await create_test_user("Ramesh Farmer", "ramesh@test.com", "farmer")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Update with te, en, hi (tests index 0 normalization via API)
        put_res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_languages": ["te", "en", "hi"]}
        )
        assert put_res.status_code == 200
        body = put_res.json()
        assert body["preferred_languages"] == ["en", "te", "hi"]
        assert body["preferred_language"] == "en"

        # Check DB persistence
        db_user = await mock_db.users.find_one({"_id": ObjectId(user_id)})
        assert db_user["preferred_languages"] == ["en", "te", "hi"]
        assert db_user["preferred_language"] == "en"

        # Check GET /profile retrieval
        get_res = await client.get(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_res.status_code == 200
        assert get_res.json()["preferred_languages"] == ["en", "te", "hi"]

# --- Required Test 12: Equipment Provider persistence ---
@pytest.mark.anyio
async def test_12_equipment_provider_persistence():
    user_id, token = await create_test_user("Kisan Tractors", "kisan@test.com", "equipment_provider")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        put_res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_languages": ["en", "ta", "kn"]}
        )
        assert put_res.status_code == 200
        assert put_res.json()["preferred_languages"] == ["en", "ta", "kn"]
        assert put_res.json()["preferred_language"] == "en"

        db_user = await mock_db.users.find_one({"_id": ObjectId(user_id)})
        assert db_user["preferred_languages"] == ["en", "ta", "kn"]
        assert db_user["preferred_language"] == "en"

# --- Required Test 13: User isolation ---
@pytest.mark.anyio
async def test_13_user_isolation():
    farmer_id, farmer_token = await create_test_user("Farmer A", "farmer_a@test.com", "farmer", pref_langs=["en"])
    provider_id, provider_token = await create_test_user("Provider B", "provider_b@test.com", "equipment_provider", pref_langs=["en", "kn"])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Farmer A attempts to pass Provider B's id in payload
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {farmer_token}"},
            json={"preferred_languages": ["en", "te"], "id": provider_id, "_id": provider_id}
        )
        assert res.status_code == 200

        # Verify Farmer A modified
        f_user = await mock_db.users.find_one({"_id": ObjectId(farmer_id)})
        assert f_user["preferred_languages"] == ["en", "te"]

        # Verify Provider B UNCHANGED
        p_user = await mock_db.users.find_one({"_id": ObjectId(provider_id)})
        assert p_user["preferred_languages"] == ["en", "kn"]
