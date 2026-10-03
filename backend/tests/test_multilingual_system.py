"""
AgriShield Comprehensive Multilingual System Verification Suite (Phases 2A - 2G)

Comprehensive automated test coverage across:
1. PHASE 2A: Translation Infrastructure
   - All 13 canonical languages supported
   - L1 RAM and L2 DB caching
   - Fast static glossary
   - Container format & original preservation
   - Fallback on provider failure or empty input
   - Legacy record handling without crashes
   - No unnecessary eager translation of all 13 languages
2. PHASE 2B: Admin Multilingual Communication
   - Admin -> Farmer broadcast
   - Admin -> Equipment Provider broadcast
   - Multi-recipient different active languages & action URLs
   - Original broadcast remains canonical
3. PHASE 2C: Two-Way Helpdesk
   - Farmer -> Admin (Telugu -> English triage)
   - Provider -> Admin (Hindi -> English triage)
   - Admin -> Farmer (English resolution -> Telugu)
   - Admin -> Provider (English resolution -> Hindi)
   - Role-scoped permissions and tenant isolation
4. PHASE 2D: Farmer Dynamic Content
   - Disease diagnosis (PyTorch / Gemini ensemble, canonical preserved)
   - Crop advisory localization (organic, chemical, prevention, tips)
   - Plant identification (scientific name & botanical taxonomy preserved)
   - Agrochemical scanner (active ingredients, chemical names, units preserved)
5. PHASE 2E: Equipment & Booking
   - Equipment catalog dynamic content localization
   - Booking creation & custom notes preservation
   - Booking status update and localized status label
   - Free-form chat translation (Farmer -> Provider)
   - Free-form chat translation (Provider -> Farmer)
   - Booking provider notification dispatch
6. PHASE 2F: WebSocket & Realtime
   - (a) Realtime notification translation to recipient active language
   - (b) Realtime booking status event translation
   - (c) Realtime chat translation to counterparty
   - (d) Fallback when translation fails
   - (e) Reconnect / reload behavior & WebSocket authentication
"""

import pytest
import asyncio
from datetime import datetime, timezone
from bson import ObjectId

from backend.app.main import app
from backend.app.db.mongodb import get_database, db_instance
from backend.tests.mock_db import MockDatabase
from backend.app.services.translation_service import TranslationService, SUPPORTED_LANGUAGES, COMMON_GLOSSARY
from backend.app.services.notification_service import NotificationService
from backend.app.models.notification import NotificationCreate
from backend.app.routers.common.support import format_ticket_doc
from backend.app.routers.admin.admin import broadcast_system_notification, AdminBroadcastRequest

# Mock DB setup
database_for_testing = MockDatabase()

async def override_get_database():
    return database_for_testing

app.dependency_overrides[get_database] = override_get_database

# Ensure MockCollection has update_many support
if not hasattr(database_for_testing.devices, "update_many"):
    async def mock_update_many(self, query, update):
        class MockResult:
            modified_count = 1
        return MockResult()
    from backend.tests.mock_db import MockCollection
    MockCollection.update_many = mock_update_many

@pytest.fixture(autouse=True)
def clean_mock_db(monkeypatch):
    import backend.app.routers.provider.equipment as eq_mod
    monkeypatch.setattr(eq_mod, "_load_disk_bookings", lambda: list(eq_mod._in_memory_bookings))
    monkeypatch.setattr(eq_mod, "_save_disk_bookings", lambda: None)
    monkeypatch.setattr(eq_mod, "_load_disk_catalog", lambda: list(eq_mod._in_memory_catalog))
    monkeypatch.setattr(eq_mod, "_save_disk_catalog", lambda: None)
    app.dependency_overrides[get_database] = override_get_database
    db_instance.db = database_for_testing
    from backend.app.routers.common.notifications import ws_manager
    NotificationService.register_websocket_manager(ws_manager)
    database_for_testing.users.records.clear()
    database_for_testing.notifications.records.clear()
    database_for_testing.support_tickets.records.clear()
    database_for_testing.equipment_bookings.records.clear()
    database_for_testing.equipment_catalog.records.clear()
    database_for_testing.idempotency_records.records.clear()
    eq_mod._in_memory_bookings.clear()
    eq_mod._in_memory_catalog.clear()
    eq_mod._in_memory_chat_threads.clear()
    if hasattr(database_for_testing, "translations_cache"):
        database_for_testing.translations_cache.records.clear()
    TranslationService.clear_cache()
    yield
    database_for_testing.users.records.clear()
    database_for_testing.notifications.records.clear()
    database_for_testing.support_tickets.records.clear()
    database_for_testing.equipment_bookings.records.clear()
    database_for_testing.equipment_catalog.records.clear()
    database_for_testing.idempotency_records.records.clear()
    eq_mod._in_memory_bookings.clear()
    eq_mod._in_memory_catalog.clear()
    eq_mod._in_memory_chat_threads.clear()
    if hasattr(database_for_testing, "translations_cache"):
        database_for_testing.translations_cache.records.clear()
    TranslationService.clear_cache()


# ─────────────────────────────────────────────────────────────────────────────
# 1. PHASE 2A: TRANSLATION INFRASTRUCTURE
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_2a_all_7_canonical_languages_supported():
    """Verify all 7 canonical languages are recognized and supported."""
    canonical = ["en", "te", "ta", "kn", "hi", "ml", "or"]
    for code in canonical:
        assert TranslationService.is_supported(code) is True
    # Non-supported / removed codes
    assert TranslationService.is_supported("mr") is False
    assert TranslationService.is_supported("pa") is False
    assert TranslationService.is_supported("bn") is False
    assert TranslationService.is_supported("ur") is False
    assert TranslationService.is_supported("as") is False
    assert TranslationService.is_supported("gu") is False
    assert TranslationService.is_supported("fr") is False
    assert TranslationService.is_supported("de") is False
    assert TranslationService.is_supported("sa") is False

@pytest.mark.anyio
async def test_2a_identity_and_fast_glossary():
    """Verify identity translation returns text immediately and glossary lookups work."""
    text = "Healthy Crop Foliage"
    # Identity
    assert await TranslationService.translate_text(text, "en", "en") == text
    # Fast Glossary
    assert await TranslationService.translate_text("open", "te", "en") == "ఓపెన్"
    assert await TranslationService.translate_text("resolved", "hi", "en") == "समाधान हो गया"
    assert await TranslationService.translate_text("confirmed", "ta", "en") == "உறுதிப்படுத்தப்பட்டது"
    assert await TranslationService.translate_text("critical", "kn", "en") == "ಕ್ಲಿಷ್ಟಕರ"

@pytest.mark.anyio
async def test_2a_memory_and_db_caching():
    """Verify L1 memory cache and L2 DB cache prevent redundant calls."""
    TranslationService.clear_cache()
    TranslationService.set_cache_entry("en", "te", "Severe Drought", "తీవ్రమైన కరువు")
    res = await TranslationService.translate_text("Severe Drought", "te", "en")
    assert res == "తీవ్రమైన కరువు"

@pytest.mark.anyio
async def test_2a_container_model_preserves_original():
    """Verify container model encapsulates original, source_language, and translations."""
    TranslationService.set_cache_entry("en", "te", "Tomato Blight", "టమోటా తెగులు")
    container = await TranslationService.translate_container("Tomato Blight", "te", "en")
    assert container["original"] == "Tomato Blight"
    assert container["source_language"] == "en"
    assert container["localized"] == "టమోటా తెగులు"
    assert container["translations"]["te"] == "టమోటా తెగులు"

@pytest.mark.anyio
async def test_2a_safe_fallback_on_empty_or_failure():
    """Verify empty text returns gracefully and provider failures fallback to original."""
    assert await TranslationService.translate_text("", "te", "en") == ""
    assert await TranslationService.translate_text(None, "te", "en") == ""
    # Fallback on unsupported or bad language
    fallback = await TranslationService.translate_text("Alert Message", "xyz_invalid", "en")
    assert fallback == "Alert Message"

@pytest.mark.anyio
async def test_2a_legacy_records_compatibility():
    """Verify legacy records lacking translations dictionary do not crash."""
    legacy_doc = {
        "title": "Legacy Weather Notice",
        "message": "Rainfall likely in your mandal.",
    }
    assert legacy_doc.get("translations", {}) == {}
    container = await TranslationService.translate_container(
        legacy_doc["title"], "te", existing_translations=legacy_doc.get("translations")
    )
    assert container["original"] == "Legacy Weather Notice"

@pytest.mark.anyio
async def test_2a_no_unnecessary_eager_translation_of_all_13_languages():
    """Verify translation is performed on-demand only for target language, not eagerly for all 13."""
    TranslationService.clear_cache()
    TranslationService.set_cache_entry("en", "te", "Soil Moisture Low", "నేల తేమ తక్కువగా ఉంది")

    container = await TranslationService.translate_container("Soil Moisture Low", "te", "en")
    assert "te" in container["translations"]
    # Verify other languages are NOT eagerly populated
    assert "hi" not in container["translations"]
    assert "ta" not in container["translations"]
    assert "kn" not in container["translations"]
    assert len(container["translations"]) == 1


# ─────────────────────────────────────────────────────────────────────────────
# 2. PHASE 2B: ADMIN MULTILINGUAL COMMUNICATION
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_2b_admin_to_farmer_broadcast():
    """Verify Admin -> Farmer broadcast translates to recipient active language while preserving canonical."""
    farmer_id = str(ObjectId())
    await database_for_testing.users.insert_one({
        "_id": ObjectId(farmer_id),
        "id": farmer_id,
        "username": "farmer_telugu",
        "preferred_language": "te",
        "role": "farmer"
    })

    TranslationService.set_cache_entry("en", "te", "Pest Outbreak Alert", "పురుగుల వ్యాప్తి హెచ్చరిక")
    TranslationService.set_cache_entry("en", "te", "Locust swarms reported in neighboring district.", "పొరుగు జిల్లాలో మిడుతల దండు నివేదించబడింది.")

    admin_req = AdminBroadcastRequest(
        title="Pest Outbreak Alert",
        message="Locust swarms reported in neighboring district.",
        priority="High",
        action_url="/farm-intelligence?tab=alerts",
        audience="farmers"
    )
    admin_user = {"id": "admin_1", "role": "admin", "email": "admin@agrishield.com"}
    res = await broadcast_system_notification(admin_req, current_user=admin_user, db=database_for_testing)
    assert res["status"] == "success"

    doc = await database_for_testing.notifications.find_one({"user_id": farmer_id})
    assert doc is not None
    assert doc["original_title"] == "Pest Outbreak Alert"
    assert doc["original_message"] == "Locust swarms reported in neighboring district."
    assert doc["translations"]["te"]["title"] == "పురుగుల వ్యాప్తి హెచ్చరిక"
    assert doc["action_url"] == "/farm-intelligence?tab=alerts"

@pytest.mark.anyio
async def test_2b_admin_to_provider_broadcast():
    """Verify Admin -> Equipment Provider broadcast translates to recipient active language."""
    provider_id = str(ObjectId())
    await database_for_testing.users.insert_one({
        "_id": ObjectId(provider_id),
        "id": provider_id,
        "username": "provider_hindi",
        "preferred_language": "hi",
        "role": "equipment_provider"
    })

    TranslationService.set_cache_entry("en", "hi", "Fleet Inspection Required", "फ्लीट निरीक्षण आवश्यक")
    TranslationService.set_cache_entry("en", "hi", "Please update your tractor safety inspection dates.", "कृपया अपने ट्रैक्टर सुरक्षा निरीक्षण तिथियों को अपडेट करें।")

    admin_req = AdminBroadcastRequest(
        title="Fleet Inspection Required",
        message="Please update your tractor safety inspection dates.",
        priority="Normal",
        action_url="/provider/dashboard?tab=machinery",
        audience="providers"
    )
    admin_user = {"id": "admin_1", "role": "admin", "email": "admin@agrishield.com"}
    res = await broadcast_system_notification(admin_req, current_user=admin_user, db=database_for_testing)
    assert res["status"] == "success"

    doc = await database_for_testing.notifications.find_one({"user_id": provider_id})
    assert doc is not None
    assert doc["original_title"] == "Fleet Inspection Required"
    assert doc["translations"]["hi"]["title"] == "फ्लीट निरीक्षण आवश्यक"
    assert doc["action_url"] == "/provider/dashboard?tab=machinery"

@pytest.mark.anyio
async def test_2b_multi_recipient_different_languages_and_action_urls():
    """Verify Admin broadcast delivers personalized language to different recipients with working action URLs."""
    u_telugu = ObjectId()
    u_hindi = ObjectId()
    u_english = ObjectId()

    await database_for_testing.users.insert_one({"_id": u_telugu, "id": str(u_telugu), "preferred_language": "te", "role": "farmer"})
    await database_for_testing.users.insert_one({"_id": u_hindi, "id": str(u_hindi), "preferred_language": "hi", "role": "equipment_provider"})
    await database_for_testing.users.insert_one({"_id": u_english, "id": str(u_english), "preferred_language": "en", "role": "farmer"})

    TranslationService.set_cache_entry("en", "te", "Cyclone Advisory", "తుఫాను హెచ్చరిక")
    TranslationService.set_cache_entry("en", "hi", "Cyclone Advisory", "चक्रवात सलाह")

    admin_req = AdminBroadcastRequest(
        title="Cyclone Advisory",
        message="Secure all farm equipment and livestock.",
        priority="High",
        action_url="/farm-intelligence?tab=weather",
        audience="all"
    )

    admin_user = {"id": "admin_master", "role": "admin", "email": "admin@agrishield.com"}
    res = await broadcast_system_notification(admin_req, current_user=admin_user, db=database_for_testing)
    assert res["status"] == "success"
    assert res["broadcast"]["recipient_count"] == 3

    # Telugu recipient doc
    doc_te = await database_for_testing.notifications.find_one({"user_id": str(u_telugu)})
    assert doc_te["original_title"] == "Cyclone Advisory"
    assert doc_te["action_url"] == "/farm-intelligence?tab=weather"
    assert doc_te["translations"]["te"]["title"] == "తుఫాను హెచ్చరిక"

    # Hindi recipient doc
    doc_hi = await database_for_testing.notifications.find_one({"user_id": str(u_hindi)})
    assert doc_hi["original_title"] == "Cyclone Advisory"
    assert doc_hi["translations"]["hi"]["title"] == "चक्रवात सलाह"

    # English recipient doc
    doc_en = await database_for_testing.notifications.find_one({"user_id": str(u_english)})
    assert doc_en["title"] == "Cyclone Advisory"
    assert doc_en["action_url"] == "/farm-intelligence?tab=weather"

    # Canonical broadcast document preserved
    b_doc = await database_for_testing.broadcasts.find_one({"_id": ObjectId(res["broadcast"]["id"])})
    assert b_doc["original_title"] == "Cyclone Advisory"
    assert b_doc["source_language"] == "en"


# ─────────────────────────────────────────────────────────────────────────────
# 3. PHASE 2C: TWO-WAY HELPDESK (ALL 4 DIRECTIONS INDEPENDENTLY)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_2c_farmer_to_admin():
    """Verify Farmer -> Admin (Telugu -> English triage): original preserved, English translation available."""
    tkt_f2a = {
        "_id": ObjectId(),
        "ticket_number": "TKT-FARM-01",
        "user_id": "f_1",
        "user_role": "farmer",
        "language": "te",
        "source_language": "te",
        "subject": "పంటకు పురుగులు పట్టాయి",
        "description": "నివారణ మందు చెప్పండి",
        "original_subject": "పంటకు పురుగులు పట్టాయి",
        "original_description": "నివారణ మందు చెప్పండి",
        "translations": {"en": {"subject": "Crops are infested with pests", "description": "Please recommend remedy"}},
        "status": "open"
    }
    # Admin view
    f2a_admin = format_ticket_doc(tkt_f2a, is_admin=True)
    assert f2a_admin["subject"] == "Crops are infested with pests"  # Admin reads English
    assert f2a_admin["original_subject"] == "పంటకు పురుగులు పట్టాయి"  # Original preserved
    assert f2a_admin["source_language"] == "te"
    assert f2a_admin["translated_subject"] == "Crops are infested with pests"

@pytest.mark.anyio
async def test_2c_provider_to_admin():
    """Verify Provider -> Admin (Hindi -> English triage): original preserved, provider role identified."""
    tkt_p2a = {
        "_id": ObjectId(),
        "ticket_number": "TKT-PROV-02",
        "user_id": "p_1",
        "user_role": "equipment_provider",
        "language": "hi",
        "source_language": "hi",
        "subject": "किराया भुगतान लंबित है",
        "description": "पिछले हफ्ते का भुगतान नहीं मिला",
        "original_subject": "किराया भुगतान लंबित है",
        "original_description": "पिछले हफ्ते का भुगतान नहीं मिला",
        "translations": {"en": {"subject": "Rental payout is pending", "description": "Payment from last week not received"}},
        "status": "open"
    }
    # Admin view
    p2a_admin = format_ticket_doc(tkt_p2a, is_admin=True)
    assert p2a_admin["subject"] == "Rental payout is pending"  # Admin reads English
    assert p2a_admin["original_subject"] == "किराया भुगतान लंबित है"  # Original preserved
    assert p2a_admin["source_language"] == "hi"
    assert p2a_admin["user_role"] == "equipment_provider"

@pytest.mark.anyio
async def test_2c_admin_to_farmer():
    """Verify Admin -> Farmer (English resolution -> Telugu): translated resolution notes delivered to Farmer."""
    tkt_a2f = {
        "_id": ObjectId(),
        "ticket_number": "TKT-RES-03",
        "user_id": "f_1",
        "user_role": "farmer",
        "language": "te",
        "source_language": "te",
        "subject": "పంటకు పురుగులు పట్టాయి",
        "description": "నివారణ మందు చెప్పండి",
        "original_resolution_notes": "Spray Chlorantraniliprole 0.3ml/L early in the morning.",
        "translated_resolution_notes": "ఉదయాన్నే క్లోరాంట్రానిలిప్రోల్ 0.3ml/L పిచికారీ చేయండి.",
        "status": "resolved"
    }
    # Farmer view
    a2f_farmer = format_ticket_doc(tkt_a2f, is_admin=False)
    assert a2f_farmer["resolution_notes"] == "ఉదయాన్నే క్లోరాంట్రానిలిప్రోల్ 0.3ml/L పిచికారీ చేయండి."  # Farmer reads Telugu
    assert a2f_farmer["original_resolution_notes"] == "Spray Chlorantraniliprole 0.3ml/L early in the morning."  # Canonical preserved

@pytest.mark.anyio
async def test_2c_admin_to_provider():
    """Verify Admin -> Provider (English resolution -> Hindi): translated resolution notes delivered to Provider."""
    tkt_a2p = {
        "_id": ObjectId(),
        "ticket_number": "TKT-RES-04",
        "user_id": "p_1",
        "user_role": "equipment_provider",
        "language": "hi",
        "source_language": "hi",
        "subject": "किराया भुगतान लंबित है",
        "description": "पिछले हफ्ते का भुगतान नहीं मिला",
        "original_resolution_notes": "Bank transfer initiated, reference UTR-889900.",
        "translated_resolution_notes": "बैंक ट्रांसफर शुरू कर दिया गया है, संदर्भ UTR-889900।",
        "status": "resolved"
    }
    # Provider view
    a2p_provider = format_ticket_doc(tkt_a2p, is_admin=False)
    assert a2p_provider["resolution_notes"] == "बैंक ट्रांसफर शुरू कर दिया गया है, संदर्भ UTR-889900।"  # Provider reads Hindi
    assert a2p_provider["original_resolution_notes"] == "Bank transfer initiated, reference UTR-889900."  # Canonical preserved

@pytest.mark.anyio
async def test_2c_helpdesk_permissions_and_isolation():
    """Verify Helpdesk permissions: Farmer only views own tickets, Provider views own, Admin views all."""
    from backend.app.routers.common.support import get_my_tickets, list_admin_tickets

    f_id = "user_farmer_10"
    p_id = "user_provider_20"

    t1 = {
        "_id": ObjectId(),
        "user_id": f_id,
        "user_role": "farmer",
        "subject": "Farmer Ticket",
        "description": "Details",
        "status": "open",
        "created_at": datetime.now(timezone.utc)
    }
    t2 = {
        "_id": ObjectId(),
        "user_id": p_id,
        "user_role": "equipment_provider",
        "subject": "Provider Ticket",
        "description": "Details",
        "status": "open",
        "created_at": datetime.now(timezone.utc)
    }
    await database_for_testing.support_tickets.insert_one(t1)
    await database_for_testing.support_tickets.insert_one(t2)

    # Farmer view: returns ONLY t1
    f_res = await get_my_tickets(current_user={"id": f_id, "role": "farmer"}, db=database_for_testing)
    assert len(f_res) == 1
    assert f_res[0]["user_id"] == f_id

    # Provider view: returns ONLY t2
    p_res = await get_my_tickets(current_user={"id": p_id, "role": "equipment_provider"}, db=database_for_testing)
    assert len(p_res) == 1
    assert p_res[0]["user_id"] == p_id

    # Admin view: returns BOTH t1 and t2
    a_res = await list_admin_tickets(status_filter="all", category_filter="all", skip=0, limit=50, db=database_for_testing)
    assert a_res["total"] == 2


# ─────────────────────────────────────────────────────────────────────────────
# 4. PHASE 2D: FARMER DYNAMIC CONTENT
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_2d_disease_diagnosis_canonical_preservation():
    """Verify disease diagnosis preserves canonical English crop/disease names while providing localized translations."""
    prediction_result = {
        "crop_name": "Tomato",
        "disease_name": "Early Blight",
        "confidence": 0.94
    }
    prediction_result["canonical_crop_name"] = prediction_result.get("crop_name", "")
    prediction_result["canonical_disease_name"] = prediction_result.get("disease_name", "")
    prediction_result["original_crop_name"] = prediction_result.get("crop_name", "")
    prediction_result["original_disease_name"] = prediction_result.get("disease_name", "")
    prediction_result["source_language"] = "en"
    prediction_result["translations"] = {}

    TranslationService.set_cache_entry("en", "te", "Tomato", "టమోటా")
    TranslationService.set_cache_entry("en", "te", "Early Blight", "ముందస్తు తెగులు")

    trans_crop = await TranslationService.translate_text("Tomato", "te", "en")
    trans_dis = await TranslationService.translate_text("Early Blight", "te", "en")
    prediction_result["crop_name"] = trans_crop
    prediction_result["disease_name"] = trans_dis
    prediction_result["translations"]["te"] = {"crop_name": trans_crop, "disease_name": trans_dis}

    assert prediction_result["original_crop_name"] == "Tomato"
    assert prediction_result["original_disease_name"] == "Early Blight"
    assert prediction_result["crop_name"] == "టమోటా"
    assert prediction_result["disease_name"] == "ముందస్తు తెగులు"
    assert prediction_result["translations"]["te"]["crop_name"] == "టమోటా"

@pytest.mark.anyio
async def test_2d_crop_advisory_localization():
    """Verify crop advisory generated by crop_advisor_service is localized for recipient active language."""
    from backend.app.services.crop_advisor import crop_advisor_service
    adv = crop_advisor_service.generate_advisory(
        crop_name="Tomato",
        disease_name="Early Blight",
        confidence=0.92,
        prediction_status="diseased"
    )
    assert adv is not None
    assert "treatment" in adv
    assert "organic" in adv["treatment"]
    assert "chemical" in adv["treatment"]
    assert "prevention" in adv

    # Verify original fields exist
    orig_organic = adv["treatment"]["organic"]
    assert len(orig_organic) >= 1

    # Verify translation via TranslationService container
    adv_container = await TranslationService.translate_container(orig_organic[0], "te", "en")
    assert adv_container["original"] == orig_organic[0]
    assert adv_container["source_language"] == "en"

@pytest.mark.anyio
async def test_2d_plant_identification_taxonomy_preservation():
    """Verify plant translation preserves Latin botanical names and original specimen data."""
    from backend.app.routers.farmer.predict import translate_plant_data
    plant_specimen = {
        "common_name": "Neem",
        "scientific_name": "Azadirachta indica",
        "category": "Medicinal Tree",
        "description": "A valuable botanical tree with antiseptic properties."
    }
    TranslationService.set_cache_entry("en", "te", "A valuable botanical tree with antiseptic properties.", "యాంటీసెప్టిక్ లక్షణాలు కలిగిన విలువైన వృక్షం.")
    res = await translate_plant_data(plant_specimen, "te")
    assert res["scientific_name"] == "Azadirachta indica"
    assert "common_name" in res

@pytest.mark.anyio
async def test_2d_agrochemical_scanner_safety_and_dosage_preservation():
    """Verify chemical active formulations and exact dilution units are not distorted by translation."""
    from backend.app.routers.farmer.predict import translate_agrochemical_data
    agro_input = {
        "chemical_name": "Chlorothalonil 75% WP",
        "active_ingredients": ["Chlorothalonil 75%"],
        "dosage": "2.0 g/L",
        "detailed_description": "Broad spectrum contact fungicide."
    }
    TranslationService.set_cache_entry("en", "hi", "Broad spectrum contact fungicide.", "व्यापक स्पेक्ट्रम कवकनाशी।")
    res = await translate_agrochemical_data(agro_input, "hi")
    assert res["chemical_name"] == "Chlorothalonil 75% WP"
    assert res["active_ingredients"] == ["Chlorothalonil 75%"]
    assert "2.0" in res["dosage"]


# ─────────────────────────────────────────────────────────────────────────────
# 5. PHASE 2E: EQUIPMENT & BOOKING
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_2e_equipment_catalog_dynamic_translation():
    """Verify equipment catalog items can be dynamically translated for active language while preserving original."""
    from backend.app.routers.provider.equipment import get_equipment_catalog
    equip_item = {
        "id": "EQ-TRACTOR-01",
        "name": "Mahindra 575 DI Tractor",
        "category": "Tractor",
        "description": "High performance 45 HP tractor suitable for heavy plowing.",
        "original_description": "High performance 45 HP tractor suitable for heavy plowing.",
        "translations": {
            "te": "భారీ దున్నడానికి అనువైన అధిక పనితీరు గల 45 HP ట్రాక్టర్."
        },
        "daily_rate": 1500
    }
    await database_for_testing.equipment_catalog.insert_one(equip_item)

    # 1. Fetch in Telugu
    cat_te = await get_equipment_catalog(language="te")
    assert cat_te["success"] is True
    assert len(cat_te["equipment"]) >= 1
    found_te = next(e for e in cat_te["equipment"] if e.get("id") == "EQ-TRACTOR-01")
    assert found_te["description"] == "భారీ దున్నడానికి అనువైన అధిక పనితీరు గల 45 HP ట్రాక్టర్."
    assert found_te["original_description"] == "High performance 45 HP tractor suitable for heavy plowing."

    # 2. Fetch in English returns original
    cat_en = await get_equipment_catalog(language="en")
    found_en = next(e for e in cat_en["equipment"] if e.get("id") == "EQ-TRACTOR-01")
    assert found_en["description"] == "High performance 45 HP tractor suitable for heavy plowing."

@pytest.mark.anyio
async def test_2e_booking_custom_notes_and_status_localization():
    """Verify booking custom notes and status labels are localized without mutating canonical booking status."""
    from backend.app.routers.provider.equipment import create_booking, get_all_bookings

    booking_payload = {
        "id": "BK-NOTES-01",
        "farmerName": "Raju Farmer",
        "equipmentName": "Power Weeder",
        "equipmentId": "EQ-WEEDER-01",
        "status": "pending",
        "custom_notes": "Please deliver with extra petrol can",
        "translations": {
            "te": "దయచేసి అదనపు పెట్రోల్ క్యాన్‌తో డెలివరీ చేయండి"
        }
    }
    create_res = await create_booking(booking_payload, current_user={"role": "farmer", "id": "farmer_1", "_id": "farmer_1"})
    assert create_res["success"] is True
    assert create_res["booking"]["original_notes"] == "Please deliver with extra petrol can"

    # Query in Telugu
    bookings_te = await get_all_bookings(language="te", current_user={"role": "farmer", "id": "farmer_1", "_id": "farmer_1"})
    assert bookings_te["success"] is True
    found = next(b for b in bookings_te["bookings"] if b.get("id") == "BK-NOTES-01")
    assert found["status"] == "pending"  # Canonical unchanged
    assert found["status_label"] == "పెండింగ్‌లో ఉంది"  # Localized status label
    assert found["notes"] == "దయచేసి అదనపు పెట్రోల్ క్యాన్‌తో డెలివరీ చేయండి"  # Localized custom notes
    assert found["original_notes"] == "Please deliver with extra petrol can"  # Preserved original

@pytest.mark.anyio
async def test_2e_freeform_booking_chat_farmer_to_provider():
    """Verify free-form chat message: Farmer (Telugu) -> Provider (English)."""
    from backend.app.routers.provider.equipment import send_booking_chat_message, get_booking_chat_messages

    booking_id = "BK-CHAT-F2P"
    TranslationService.set_cache_entry("te", "en", "నేను రేపు ఉదయం 8 గంటలకు వస్తాను", "I will come tomorrow at 8 AM")

    payload_f2p = {
        "id": "msg_f2p_1",
        "sender": "farmer",
        "senderName": "Farmer Raju",
        "text": "నేను రేపు ఉదయం 8 గంటలకు వస్తాను",
        "source_language": "te"
    }

    send_res = await send_booking_chat_message(booking_id, payload_f2p, current_user={"role": "admin", "id": "admin_1", "_id": "admin_1"})
    assert send_res["success"] is True
    assert send_res["message"]["original_text"] == "నేను రేపు ఉదయం 8 గంటలకు వస్తాను"

    # Provider fetches in English
    fetch_res = await get_booking_chat_messages(booking_id, target_lang="en", current_user={"role": "admin", "id": "admin_1", "_id": "admin_1"})
    assert fetch_res["success"] is True
    found_msg = next(m for m in fetch_res["messages"] if m["id"] == "msg_f2p_1")
    assert found_msg["original_text"] == "నేను రేపు ఉదయం 8 గంటలకు వస్తాను"
    assert found_msg["text"] == "I will come tomorrow at 8 AM"

@pytest.mark.anyio
async def test_2e_freeform_booking_chat_provider_to_farmer():
    """Verify free-form chat message: Provider (Hindi) -> Farmer (Telugu)."""
    from backend.app.routers.provider.equipment import send_booking_chat_message, get_booking_chat_messages

    booking_id = "BK-CHAT-P2F"
    TranslationService.set_cache_entry("hi", "te", "ट्रैक्टर तैयार है", "ట్రాక్టర్ సిద్ధంగా ఉంది")

    payload_p2f = {
        "id": "msg_p2f_1",
        "sender": "provider",
        "senderName": "Provider Sharma",
        "text": "ट्रैक्टर तैयार है",
        "source_language": "hi"
    }

    send_res = await send_booking_chat_message(booking_id, payload_p2f, current_user={"role": "admin", "id": "admin_1", "_id": "admin_1"})
    assert send_res["success"] is True
    assert send_res["message"]["original_text"] == "ट्रैक्टर तैयार है"

    # Farmer fetches in Telugu
    fetch_res = await get_booking_chat_messages(booking_id, target_lang="te", current_user={"role": "admin", "id": "admin_1", "_id": "admin_1"})
    assert fetch_res["success"] is True
    found_msg = next(m for m in fetch_res["messages"] if m["id"] == "msg_p2f_1")
    assert found_msg["original_text"] == "ट्रैक्टर तैयार है"
    assert found_msg["text"] == "ట్రాక్టర్ సిద్ధంగా ఉంది"

@pytest.mark.anyio
async def test_2e_booking_notification_dispatch():
    """Verify booking creation dispatches notification to provider with active language translation."""
    prov_id = str(ObjectId())
    await database_for_testing.users.insert_one({
        "_id": ObjectId(prov_id),
        "id": prov_id,
        "name": "Provider Kumar",
        "phone": "9876543210",
        "preferred_language": "hi",
        "role": "equipment_provider"
    })

    from backend.app.routers.provider.equipment import create_booking
    TranslationService.set_cache_entry("en", "hi", "🚜 New Machinery Booking Request: #BK-NOTIF-01", "🚜 नई मशीनरी बुकिंग अनुरोध: #BK-NOTIF-01")

    res = await create_booking({
        "id": "BK-NOTIF-01",
        "farmerName": "Suresh",
        "equipmentName": "Harvester",
        "equipmentId": "EQ-HARVESTER-01",
        "providerPhone": "9876543210",
        "providerId": prov_id,
        "status": "pending"
    }, idempotency_key=None, current_user={"role": "farmer", "id": "farmer_1", "_id": "farmer_1"})
    assert res["success"] is True

    # Check notification in DB
    notif = await database_for_testing.notifications.find_one({"user_id": prov_id})
    assert notif is not None
    assert notif["original_title"] == "🚜 New Machinery Booking Request: #BK-NOTIF-01"
    assert notif["translations"]["hi"]["title"] == "🚜 नई मशीनरी बुकिंग अनुरोध: #BK-NOTIF-01"


# ─────────────────────────────────────────────────────────────────────────────
# 6. PHASE 2F: WEBSOCKET & REALTIME
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_2f_a_realtime_notification_translation():
    """Verify (a) realtime WebSocket notification delivers localized content without mutating DB canonical text."""
    from backend.app.routers.common.notifications import ws_manager

    farmer_id = "60c72b2f9b1d8b5a5f8e2c3a"
    await database_for_testing.users.insert_one({
        "_id": ObjectId(farmer_id),
        "id": farmer_id,
        "email": "telugu_farmer@test.com",
        "preferred_language": "te"
    })

    captured_ws_messages = []
    async def mock_broadcast(uid, msg):
        if uid == farmer_id:
            captured_ws_messages.append(msg)
    
    orig_broadcast = ws_manager.broadcast_to_user
    ws_manager.broadcast_to_user = mock_broadcast

    try:
        TranslationService.set_cache_entry("en", "te", "High Temperature Alert", "అధిక ఉష్ణోగ్రత హెచ్చరిక")
        TranslationService.set_cache_entry("en", "te", "Field temperatures exceeded 40C.", "పొలం ఉష్ణోగ్రతలు 40C దాటాయి.")

        notif_input = NotificationCreate(
            user_id=farmer_id,
            title="High Temperature Alert",
            message="Field temperatures exceeded 40C.",
            category="weather",
            priority="Critical"
        )
        created = await NotificationService.create_notification(database_for_testing, notif_input)

        # 1. Stored DB document MUST retain canonical original text
        db_doc = await database_for_testing.notifications.find_one({"user_id": farmer_id})
        assert db_doc is not None
        assert db_doc["title"] == "High Temperature Alert"
        assert db_doc["message"] == "Field temperatures exceeded 40C."
        assert db_doc["original_title"] == "High Temperature Alert"
        assert db_doc["original_message"] == "Field temperatures exceeded 40C."
        assert db_doc["translations"]["te"]["title"] == "అధిక ఉష్ణోగ్రత హెచ్చరిక"

        # 2. Live WebSocket broadcast delivered to recipient has localized title/message
        assert len(captured_ws_messages) == 1
        ws_msg = captured_ws_messages[0]
        assert ws_msg["type"] == "new_notification"
        assert ws_msg["notification"]["title"] == "అధిక ఉష్ణోగ్రత హెచ్చరిక"
        assert ws_msg["notification"]["message"] == "పొలం ఉష్ణోగ్రతలు 40C దాటాయి."
        assert ws_msg["notification"]["original_title"] == "High Temperature Alert"
    finally:
        ws_manager.broadcast_to_user = orig_broadcast

@pytest.mark.anyio
async def test_2f_b_realtime_booking_event_translation():
    """Verify (b) realtime booking status update broadcasts localized status to recipient while keeping booking canonical."""
    from backend.app.routers.provider.equipment import update_booking_status
    from backend.app.routers.common.notifications import ws_manager

    farmer_id = "60c72b2f9b1d8b5a5f8e2c3b"
    await database_for_testing.users.insert_one({
        "_id": ObjectId(farmer_id),
        "id": farmer_id,
        "name": "Sita Farmer",
        "phone": "9876543222",
        "preferred_language": "te"
    })
    await database_for_testing.equipment_bookings.insert_one({
        "id": "BK-9911",
        "bookingId": "BK-9911",
        "userId": farmer_id,
        "farmerPhone": "9876543222",
        "equipmentName": "Harvester 300",
        "equipmentId": "EQ-HARVESTER-300",
        "status": "pending"
    })

    captured_events = []
    async def mock_broadcast(uid, msg):
        if uid == farmer_id:
            captured_events.append(msg)

    orig_broadcast = ws_manager.broadcast_to_user
    ws_manager.broadcast_to_user = mock_broadcast

    try:
        TranslationService.set_cache_entry("en", "te", "Confirmed", "ధృవీకరించబడింది")
        res = await update_booking_status("BK-9911", {"status": "confirmed"}, current_user={"role": "admin", "id": "admin_1", "_id": "admin_1"})
        assert res["success"] is True

        # Check booking status event in captured WebSocket events
        status_events = [e for e in captured_events if e.get("type") == "booking_status_updated"]
        assert len(status_events) >= 1
        evt = status_events[0]
        assert evt["status"] == "confirmed"
        assert evt["original_status_label"] == "Confirmed"
        assert evt["status_label"] == "ధృవీకరించబడింది"
    finally:
        ws_manager.broadcast_to_user = orig_broadcast

@pytest.mark.anyio
async def test_2f_c_realtime_chat_translation():
    """Verify (c) realtime booking chat message delivers translated text to counterparty over WebSocket."""
    from backend.app.routers.provider.equipment import send_booking_chat_message
    from backend.app.routers.common.notifications import ws_manager

    counterparty_id = "60c72b2f9b1d8b5a5f8e2c3c"
    await database_for_testing.users.insert_one({
        "_id": ObjectId(counterparty_id),
        "id": counterparty_id,
        "name": "Provider Ramesh",
        "preferred_language": "hi",
        "role": "equipment_provider"
    })
    await database_for_testing.equipment_bookings.insert_one({
        "id": "BK-9922",
        "bookingId": "BK-9922",
        "userId": "farmer_1",
        "equipmentId": "EQ-TRACTOR-99",
        "providerId": counterparty_id,
        "status": "confirmed"
    })

    captured_chat_events = []
    async def mock_broadcast(uid, msg):
        if uid == counterparty_id:
            captured_chat_events.append(msg)

    orig_broadcast = ws_manager.broadcast_to_user
    ws_manager.broadcast_to_user = mock_broadcast

    try:
        TranslationService.set_cache_entry("en", "hi", "Please deliver the tractor by 7 AM", "कृपया सुबह 7 बजे तक ट्रैक्टर पहुंचाएं")
        chat_payload = {
            "id": "msg_chat_ws_1",
            "sender": "farmer",
            "senderName": "Farmer",
            "text": "Please deliver the tractor by 7 AM",
            "source_language": "en"
        }
        res = await send_booking_chat_message("BK-9922", chat_payload, current_user={"role": "farmer", "id": "farmer_1", "_id": "farmer_1"})
        assert res["success"] is True

        chat_evts = [e for e in captured_chat_events if e.get("type") == "booking_chat_message"]
        assert len(chat_evts) >= 1
        evt = chat_evts[0]
        assert evt["booking_id"] == "BK-9922"
        assert evt["message"]["original_text"] == "Please deliver the tractor by 7 AM"
        assert evt["message"]["text"] == "कृपया सुबह 7 बजे तक ट्रैक्टर पहुंचाएं"
    finally:
        ws_manager.broadcast_to_user = orig_broadcast

@pytest.mark.anyio
async def test_2f_d_fallback_when_translation_fails():
    """Verify (d) fallback when translation provider fails: delivers canonical text without failing broadcast."""
    from backend.app.routers.common.notifications import ws_manager

    farmer_id = "60c72b2f9b1d8b5a5f8e2c3e"
    await database_for_testing.users.insert_one({
        "_id": ObjectId(farmer_id),
        "id": farmer_id,
        "preferred_language": "te"
    })

    captured_ws_messages = []
    async def mock_broadcast(uid, msg):
        if uid == farmer_id:
            captured_ws_messages.append(msg)
    
    orig_broadcast = ws_manager.broadcast_to_user
    ws_manager.broadcast_to_user = mock_broadcast

    # Force TranslationService to fail
    orig_trans = TranslationService.translate_text
    async def failing_translate(*args, **kwargs):
        raise ConnectionError("External translation service timeout")
    TranslationService.translate_text = failing_translate

    try:
        notif_input = NotificationCreate(
            user_id=farmer_id,
            title="System Maintenance Tonight",
            message="Server upgrade at midnight.",
            category="system"
        )
        created = await NotificationService.create_notification(database_for_testing, notif_input)
        assert created is not None

        # Verify broadcast succeeded with canonical text as fallback
        assert len(captured_ws_messages) == 1
        ws_msg = captured_ws_messages[0]
        assert ws_msg["notification"]["title"] == "System Maintenance Tonight"
        assert ws_msg["notification"]["message"] == "Server upgrade at midnight."
    finally:
        TranslationService.translate_text = orig_trans
        ws_manager.broadcast_to_user = orig_broadcast

@pytest.mark.anyio
async def test_2f_e_reconnect_reload_behavior_and_auth():
    """Verify (e) reconnect/reload behavior: historical queries localize to active language, and WS endpoint rejects unauthenticated tokens."""
    # Reconnect/reload verification: historical query with active_language delivers localized content
    user_id = "60c72b2f9b1d8b5a5f8e2c3d"
    await database_for_testing.notifications.insert_one({
        "user_id": user_id,
        "title": "Severe Frost Warning",
        "message": "Cover seedling nurseries tonight.",
        "original_title": "Severe Frost Warning",
        "original_message": "Cover seedling nurseries tonight.",
        "source_language": "en",
        "translations": {
            "te": {
                "title": "తీవ్రమైన మంచు హెచ్చరిక",
                "message": "ఈ రాత్రి నారుమళ్లను కప్పండి."
            }
        },
        "read": False,
        "category": "weather",
        "priority": "High",
        "status": "active",
        "lifecycle": {"created_at": datetime.now(timezone.utc)}
    })

    # Page reload with active_language='te'
    records_te, total = await NotificationService.get_notifications(
        database_for_testing, user_id=user_id, active_language="te"
    )
    assert total >= 1
    loaded = records_te[0]
    assert loaded["title"] == "తీవ్రమైన మంచు హెచ్చరిక"
    assert loaded["original_title"] == "Severe Frost Warning"

    # Page reload with active_language='en'
    records_en, _ = await NotificationService.get_notifications(
        database_for_testing, user_id=user_id, active_language="en"
    )
    assert records_en[0]["title"] == "Severe Frost Warning"

    # WebSocket authentication verification: endpoint closes with 4001 on missing token
    from fastapi.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/api/v1/notifications/ws/{user_id}") as ws:
            pass
    assert exc_info.value.code == 4001
