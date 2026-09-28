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
from backend.tests.mock_db import MockCollection
async def mock_update_many(self, query, update_dict, **kwargs):
    for rec in self.records:
        if "$set" in update_dict:
            for k, v in update_dict["$set"].items():
                rec[k] = v
    return True
MockCollection.update_many = mock_update_many

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

# --- Test 1: English Only ---
def test_01_english_only():
    update = ProfileUpdate(preferred_languages=["en"], preferred_language="en")
    assert update.preferred_languages == ["en"]
    assert update.preferred_language == "en"

# --- Test 2: English + Telugu ---
def test_02_english_plus_telugu():
    update = ProfileUpdate(preferred_languages=["en", "te"], preferred_language="te")
    assert update.preferred_languages == ["en", "te"]
    assert update.preferred_language == "te"

# --- Test 3: English + Telugu + Hindi ---
def test_03_english_plus_telugu_plus_hindi():
    update = ProfileUpdate(preferred_languages=["en", "te", "hi"], preferred_language="hi")
    assert update.preferred_languages == ["en", "te", "hi"]
    assert update.preferred_language == "hi"

# --- Test 4: Regional submitted without English -> normalizes to index 0 English ---
def test_04_regional_submitted_without_english():
    update = ProfileUpdate(preferred_languages=["te", "hi"])
    assert update.preferred_languages == ["en", "te", "hi"]
    assert update.preferred_language is None

# --- Test 5: Active Telugu with English/Telugu/Hindi pool ---
def test_05_active_telugu_with_pool():
    update = ProfileUpdate(preferred_languages=["te", "hi"], preferred_language="te")
    assert update.preferred_languages == ["en", "te", "hi"]
    assert update.preferred_language == "te"

# --- Test 6: Active Hindi with English/Telugu/Hindi pool ---
def test_06_active_hindi_with_pool():
    update = ProfileUpdate(preferred_languages=["hi", "te"], preferred_language="hi")
    assert update.preferred_languages == ["en", "hi", "te"]
    assert update.preferred_language == "hi"

# --- Test 7: Change active language without losing selected languages ---
@pytest.mark.anyio
async def test_07_change_active_language_without_losing_selected():
    user_id, token = await create_test_user(
        "Farmer Seven", "seven@test.com", "farmer",
        pref_lang="te", pref_langs=["en", "te", "hi"]
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User submits preferred_language="hi" only
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_language": "hi"}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["preferred_language"] == "hi"
        assert body["preferred_languages"] == ["en", "te", "hi"]

        # Verify DB
        db_user = await mock_db.users.find_one({"_id": ObjectId(user_id)})
        assert db_user["preferred_language"] == "hi"
        assert db_user["preferred_languages"] == ["en", "te", "hi"]

# --- Test 8: Remove active language and verify safe fallback (Preserved when still present) ---
@pytest.mark.anyio
async def test_08_active_language_preserved_when_present_in_new_pool():
    user_id, token = await create_test_user(
        "Farmer Eight", "eight@test.com", "farmer",
        pref_lang="te", pref_langs=["en", "te", "hi"]
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User updates pool to te, kn (omits hi, keeps te)
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_languages": ["te", "kn"]}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["preferred_languages"] == ["en", "te", "kn"]
        assert body["preferred_language"] == "te"  # Preserved!

# --- Test 9: Invalid active language not in pool -> rejected ---
def test_09_invalid_active_language_not_in_pool():
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te"], preferred_language="hi")
    assert "Active language 'hi' must belong to the selected language pool" in str(exc_info.value)

# --- Test 10: Duplicate languages -> rejected ---
def test_10_duplicate_languages():
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te", "te"])
    assert "Duplicate language codes are not allowed" in str(exc_info.value)

# --- Test 11: Four languages -> rejected ---
def test_11_four_languages():
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te", "hi", "ta"])
    assert "Maximum 3 preferred languages allowed" in str(exc_info.value)

# --- Test 12: Unsupported language code -> rejected ---
def test_12_unsupported_language_code():
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=["en", "te", "fr"])
    assert "Unsupported language code: 'fr'" in str(exc_info.value)

# --- Test 13: Empty list -> rejected ---
def test_13_empty_list():
    with pytest.raises(ValidationError) as exc_info:
        ProfileUpdate(preferred_languages=[])
    assert "preferred_languages cannot be empty" in str(exc_info.value)

# --- Test 14: Legacy user with preferred_language only ---
def test_14_legacy_user_compatibility():
    legacy_doc = {"id": "user_14", "email": "leg@farm.com", "preferred_language": "te"}
    resp = UserResponse(**legacy_doc)
    assert resp.preferred_language == "te"
    assert resp.preferred_languages == ["en", "te"]

# --- Test 15: Farmer persistence ---
@pytest.mark.anyio
async def test_15_farmer_persistence():
    user_id, token = await create_test_user("Farmer Fifteen", "fifteen@test.com", "farmer")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_languages": ["te", "en", "hi"], "preferred_language": "te"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["preferred_languages"] == ["en", "te", "hi"]
        assert data["preferred_language"] == "te"

        # Check GET
        get_res = await client.get("/api/v1/auth/profile", headers={"Authorization": f"Bearer {token}"})
        assert get_res.status_code == 200
        assert get_res.json()["preferred_language"] == "te"
        assert get_res.json()["preferred_languages"] == ["en", "te", "hi"]

# --- Test 16: Equipment Provider persistence ---
@pytest.mark.anyio
async def test_16_equipment_provider_persistence():
    user_id, token = await create_test_user("Provider Sixteen", "sixteen@test.com", "equipment_provider")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_languages": ["en", "ta", "kn"], "preferred_language": "kn"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["preferred_languages"] == ["en", "ta", "kn"]
        assert data["preferred_language"] == "kn"

        db_user = await mock_db.users.find_one({"_id": ObjectId(user_id)})
        assert db_user["preferred_languages"] == ["en", "ta", "kn"]
        assert db_user["preferred_language"] == "kn"

# --- Test 17: User isolation ---
@pytest.mark.anyio
async def test_17_user_isolation():
    f_id, f_token = await create_test_user("Farmer A", "fa@test.com", "farmer", pref_langs=["en"])
    p_id, p_token = await create_test_user("Provider B", "pb@test.com", "equipment_provider", pref_langs=["en", "kn"])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {f_token}"},
            json={"preferred_languages": ["en", "te"], "preferred_language": "te"}
        )
        assert res.status_code == 200
        f_user = await mock_db.users.find_one({"_id": ObjectId(f_id)})
        p_user = await mock_db.users.find_one({"_id": ObjectId(p_id)})
        assert f_user["preferred_languages"] == ["en", "te"]
        assert f_user["preferred_language"] == "te"
        assert p_user["preferred_languages"] == ["en", "kn"]

# --- Test 18: IoT Device synchronization ---
@pytest.mark.anyio
async def test_18_iot_device_synchronization():
    user_id, token = await create_test_user("IoT Farmer", "iot@test.com", "farmer")
    device_id = ObjectId()
    await mock_db.devices.insert_one({"_id": device_id, "user_id": user_id, "display_language": "en"})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_languages": ["en", "te"], "preferred_language": "te"}
        )
        assert res.status_code == 200
        dev = await mock_db.devices.find_one({"_id": device_id})
        assert dev["display_language"] == "te"

# --- Test 19: All 7 canonical language codes accepted ---
def test_19_all_7_canonical_codes_accepted():
    expected_7 = {"en", "te", "ta", "kn", "hi", "ml", "or"}
    assert SUPPORTED_LANGUAGE_CODES == expected_7
    for code in expected_7:
        update = ProfileUpdate(preferred_languages=["en", code] if code != "en" else ["en"])
        assert code in update.preferred_languages

# --- Test 20: Removed language codes (mr, pa, bn, ur, as, gu, sa) rejected ---
def test_20_removed_codes_rejected():
    removed_codes = ["mr", "pa", "bn", "ur", "as", "gu", "sa"]
    for code in removed_codes:
        with pytest.raises(ValidationError):
            ProfileUpdate(preferred_languages=["en", code])

# --- Test 21: Strict non-auto-add on activation (HTTP 422) ---
@pytest.mark.anyio
async def test_21_strict_non_auto_add_on_activation():
    user_id, token = await create_test_user(
        "Farmer TwentyOne", "twentyone@test.com", "farmer",
        pref_lang="te", pref_langs=["en", "te"]
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request active "hi", which is NOT in ["en", "te"]
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_language": "hi"}
        )
        assert res.status_code == 422
        assert "not in your current language pool" in res.json()["detail"]

        # Verify pool remains strictly unchanged
        db_user = await mock_db.users.find_one({"_id": ObjectId(user_id)})
        assert db_user["preferred_languages"] == ["en", "te"]
        assert db_user["preferred_language"] == "te"

# --- Test 22: Fallback to English when active language removed ---
@pytest.mark.anyio
async def test_22_fallback_to_english_when_active_language_removed():
    user_id, token = await create_test_user(
        "Farmer TwentyTwo", "twentytwo@test.com", "farmer",
        pref_lang="te", pref_langs=["en", "te", "hi"]
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Updates pool to ["en", "hi"], omitting previous active "te"
        res = await client.put(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            json={"preferred_languages": ["en", "hi"]}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["preferred_languages"] == ["en", "hi"]
        assert body["preferred_language"] == "en"  # Safe fallback!

        db_user = await mock_db.users.find_one({"_id": ObjectId(user_id)})
        assert db_user["preferred_languages"] == ["en", "hi"]
        assert db_user["preferred_language"] == "en"

# --- Helper for creating test users in mock_db ---
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
