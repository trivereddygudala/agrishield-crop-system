"""
B9.4 Unit & Integration Test Suite — Translation Concurrency, Latency & Delimiter Batching
Validates that:
1. Plant translation structure and mirrored keys are preserved.
2. Agrochemical translation structure and nested sections are preserved.
3. List ordering is strictly preserved.
4. Empty strings remain empty and un-translated.
5. Non-string values remain intact.
6. Delimiter batching produces correct order and segment count.
7. Delimiter mismatch/corruption falls back safely to original text without field corruption.
8. Synchronous translation runs off the Uvicorn event loop via asyncio.to_thread.
9. GoogleTranslator instances are isolated and never shared between threads.
10. _TRANSLATION_CACHE eliminates duplicate provider calls.
11. Provider fallback chain (Gemini Flash -> NVIDIA NIM -> DeepTranslator) remains intact.
12. Supported regional languages and English identity behavior remain valid.
13. B9.3 routing and failover contract boundaries remain intact.
"""

import sys
import os
import copy
import asyncio
import threading
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

# Add repository root to search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.routers.farmer.predict import (
    translate_plant_data,
    translate_agrochemical_data,
    _batch_translate_deep_fallback,
    _sync_deep_translate_batch,
    _is_translatable_string,
    TRANSLATION_DELIMITER,
    TRANSLATION_SPLIT_REGEX,
    _TRANSLATION_CACHE
)


@pytest.fixture(autouse=True)
def clean_translation_cache():
    """Ensure a clean in-memory cache before each test."""
    _TRANSLATION_CACHE.clear()
    yield
    _TRANSLATION_CACHE.clear()


# =========================================================================
# TEST 1: Plant Translation Structure Preserved (DeepTranslator Fallback)
# =========================================================================
@pytest.mark.asyncio
async def test_plant_translation_structure_preserved():
    sample_plant = {
        "common_name": "Tomato",
        "scientific_name": "Solanum lycopersicum",
        "description": "A widely cultivated edible berry.",
        "soil_type": "Well-drained loamy soil",
        "temperature_range": "20-25 C",
        "water_requirement": "Moderate",
        "sunlight_requirement": "Full sun",
        "fertilizer_recommendation": "NPK 10-10-10",
        "economic_importance": "High commercial cash crop",
        "weed_eradication_advice": "Mulching and hand weeding",
        "native_region": "South America",
        "growth_stage": "Vegetative",
        "leaf_type": "Compound",
        "translations": {}
    }

    def mock_worker(text, target):
        items = text.split(TRANSLATION_DELIMITER)
        return TRANSLATION_DELIMITER.join(f"{target.upper()}_{it}" for it in items)

    with patch("backend.app.services.nvidia_service.nvidia_service._call_gemini_flash", side_effect=Exception("Mocked Gemini off")),          patch("backend.app.services.nvidia_service.nvidia_service.translate_diagnosis", side_effect=Exception("Mocked NIM off")),          patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_worker):
        result = await translate_plant_data(copy.deepcopy(sample_plant), "te")

    # Verify original keys present
    assert result["scientific_name"] == "Solanum lycopersicum"
    # Verify translated keys
    assert "TE_" in result["description"]
    assert "TE_" in result["soil_type"]
    assert "TE_" in result["temperature_range"]
    # Verify mirrored camelCase keys
    assert result["suitableSoilType"] == result["soil_type"]
    assert result["idealWeatherClimate"] == result["temperature_range"]
    assert result["waterNeed"] == result["water_requirement"]
    assert result["sunlight"] == result["sunlight_requirement"]
    assert result["fertilizerAdvice"] == result["fertilizer_recommendation"]
    assert result["economicSignificance"] == result["economic_importance"]
    assert result["weedEradicationAdvice"] == result["weed_eradication_advice"]
    assert result["nativeRegion"] == result["native_region"]
    assert result["growthHabit"] == result["growth_stage"]
    assert result["leafType"] == result["leaf_type"]
    assert result["botanicalDescription"] == result["description"]
    # Verify translations map attached
    assert "te" in result["translations"]
    assert "en" in result["translations"]


# =========================================================================
# TEST 2: Agrochemical Translation Structure Preserved (DeepTranslator Fallback)
# =========================================================================
@pytest.mark.asyncio
async def test_agrochemical_translation_structure_preserved():
    sample_agro = {
        "name": "Mancozeb 75% WP",
        "product_details": {
            "detailed_description": "Contact fungicide with broad spectrum activity.",
            "primary_function": "Disease prevention"
        },
        "user_instructions": {
            "best_spray_timing": "Early morning or late afternoon",
            "spray_interval": "7 to 10 days",
            "mixing_guide": ["Add 2.5g per liter of water", "Stir thoroughly"],
            "ppe_precautions": ["Wear gloves", "Wear face mask"]
        },
        "chemical_explanation": {
            "action_mode": "Multisite activity",
            "utility_and_benefits": "Prevents spore germination",
            "preharvest_interval": "14 days",
            "approved_crops": ["Potato", "Tomato", "Rice"],
            "target_diseases_and_pests": ["Late blight", "Early blight"],
            "fertilizer_growth_stages": {
                "vegetative_stage": "Apply at first sign of leaf spot",
                "flowering_stage": "Repeat spray",
                "fruiting_stage": "Do not spray 14 days before harvest"
            }
        },
        "info": {},
        "dosage": "2.5 g / L",
        "safety_instructions": "Keep away from children",
        "mixing_instructions": "Mix with clean water",
        "farmer_tips": ["Ensure complete spray coverage on lower leaf surfaces"],
        "translations": {}
    }

    def mock_worker(text, target):
        items = text.split(TRANSLATION_DELIMITER)
        return TRANSLATION_DELIMITER.join(f"{target.upper()}_{it}" for it in items)

    with patch("backend.app.services.nvidia_service.nvidia_service._call_gemini_flash", side_effect=Exception("Mocked Gemini off")),          patch("backend.app.services.nvidia_service.nvidia_service.translate_diagnosis", side_effect=Exception("Mocked NIM off")),          patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_worker):
        result = await translate_agrochemical_data(copy.deepcopy(sample_agro), "ta")

    # Verify nested structures intact
    assert "TA_" in result["product_details"]["detailed_description"]
    assert "TA_" in result["product_details"]["primary_function"]
    assert "TA_" in result["user_instructions"]["best_spray_timing"]
    assert "TA_" in result["user_instructions"]["spray_interval"]
    assert len(result["user_instructions"]["mixing_guide"]) == 2
    assert "TA_" in result["user_instructions"]["mixing_guide"][0]
    assert len(result["chemical_explanation"]["approved_crops"]) == 3
    assert "TA_" in result["chemical_explanation"]["approved_crops"][0]
    assert "TA_" in result["dosage"]
    assert "TA_" in result["safety_instructions"]
    assert len(result["farmer_tips"]) == 1
    # Check translations map
    assert "ta" in result["translations"]
    assert "en" in result["translations"]


# =========================================================================
# TEST 3: List Ordering Strictly Preserved
# =========================================================================
@pytest.mark.asyncio
async def test_list_ordering_preserved():
    items = ["First step: rinse equipment", "Second step: add water", "Third step: add chemical", "Fourth step: mix"]
    fields = {"instructions": items}

    def mock_worker(text, target):
        parts = text.split(TRANSLATION_DELIMITER)
        return TRANSLATION_DELIMITER.join(f"HI_{p}" for p in parts)

    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_worker):
        res = await _batch_translate_deep_fallback(fields, "hi")

    assert len(res["instructions"]) == 4
    for idx, orig in enumerate(items):
        assert res["instructions"][idx] == f"HI_{orig}"


# =========================================================================
# TEST 4: Empty Strings Preserved Unchanged
# =========================================================================
@pytest.mark.asyncio
async def test_empty_strings_preserved():
    fields = {
        "empty_one": "",
        "empty_spaces": "   ",
        "none_str": "None",
        "na_str": "N/A",
        "valid_text": "Apply during active growth"
    }

    def mock_worker(text, target):
        return f"KN_{text}"

    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_worker) as mock_sync:
        res = await _batch_translate_deep_fallback(fields, "kn")

    assert res["empty_one"] == ""
    assert res["empty_spaces"] == "   "
    assert res["none_str"] == "None"
    assert res["na_str"] == "N/A"
    assert res["valid_text"] == "KN_Apply during active growth"
    # Ensure only 1 item was sent to translator
    assert mock_sync.call_count == 1
    call_payload = mock_sync.call_args[0][0]
    assert call_payload == "Apply during active growth"


# =========================================================================
# TEST 5: Non-String Values Preserved
# =========================================================================
@pytest.mark.asyncio
async def test_non_string_values_preserved():
    fields = {
        "text": "Foliar spray",
        "quantity": 500,
        "ratio": 2.5,
        "is_organic": False,
        "metadata": {"source": "ICAR", "verified": True}
    }

    def mock_worker(text, target):
        return f"ML_{text}"

    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_worker):
        res = await _batch_translate_deep_fallback(fields, "ml")

    assert res["text"] == "ML_Foliar spray"
    assert res["quantity"] == 500
    assert res["ratio"] == 2.5
    assert res["is_organic"] is False
    assert res["metadata"] == {"source": "ICAR", "verified": True}


# =========================================================================
# TEST 6: Delimiter Batching Produces Correct Outputs
# =========================================================================
@pytest.mark.asyncio
async def test_delimiter_batching_correct_number_and_order():
    fields = {
        "f1": "Field One",
        "f2": "Field Two",
        "f3": ["Item A", "Item B", "Item C"]
    }

    captured_payloads = []

    def mock_worker(text, target):
        captured_payloads.append(text)
        parts = text.split(TRANSLATION_DELIMITER)
        return TRANSLATION_DELIMITER.join(f"MR_{p}" for p in parts)

    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_worker):
        res = await _batch_translate_deep_fallback(fields, "mr")

    # Single batch call made
    assert len(captured_payloads) == 1
    assert TRANSLATION_DELIMITER in captured_payloads[0]
    expected_items = ["Field One", "Field Two", "Item A", "Item B", "Item C"]
    assert captured_payloads[0].split(TRANSLATION_DELIMITER) == expected_items
    assert res["f1"] == "MR_Field One"
    assert res["f2"] == "MR_Field Two"
    assert res["f3"] == ["MR_Item A", "MR_Item B", "MR_Item C"]


# =========================================================================
# TEST 7: Delimiter Mismatch Does NOT Corrupt Field Mapping
# =========================================================================
@pytest.mark.asyncio
async def test_delimiter_mismatch_fallback():
    fields = {
        "title": "Blast Disease Prevention",
        "crops": ["Paddy", "Maize"],
        "advice": "Spray Tricyclazole"
    }

    # Return only 2 segments when 4 items were requested
    def mock_corrupt_worker(text, target):
        return f"Corrupted Part 1{TRANSLATION_DELIMITER}Corrupted Part 2"

    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_corrupt_worker):
        res = await _batch_translate_deep_fallback(fields, "te")

    # Mismatch detected: fields must safely keep their pristine original values
    assert res["title"] == "Blast Disease Prevention"
    assert res["crops"] == ["Paddy", "Maize"]
    assert res["advice"] == "Spray Tricyclazole"
    # Ensure cache was NOT poisoned with corrupted data
    assert "te:Blast Disease Prevention" not in _TRANSLATION_CACHE


# =========================================================================
# TEST 8: DeepTranslator Execution Occurs Off Event Loop
# =========================================================================
@pytest.mark.asyncio
async def test_deep_translator_executed_off_event_loop():
    event_loop_thread = threading.get_ident()
    worker_threads = []

    def mock_thread_worker(text, target):
        worker_threads.append(threading.get_ident())
        return f"TE_{text}"

    fields = {"desc": "Offload test to threadpool"}

    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_thread_worker):
        res = await _batch_translate_deep_fallback(fields, "te")

    assert len(worker_threads) == 1
    # Worker thread ID must NOT be the event loop thread ID
    assert worker_threads[0] != event_loop_thread
    assert res["desc"] == "TE_Offload test to threadpool"


# =========================================================================
# TEST 9: GoogleTranslator Instances Are Isolated and Not Shared
# =========================================================================
def test_google_translator_isolated_instances():
    created_instances = []

    class MockGoogleTranslator:
        def __init__(self, source="auto", target="te"):
            self.source = source
            self.target = target
            created_instances.append(self)

        def translate(self, text):
            return f"TRANS_{text}"

    with patch("deep_translator.GoogleTranslator", side_effect=MockGoogleTranslator):
        res1 = _sync_deep_translate_batch("Hello", "te")
        res2 = _sync_deep_translate_batch("World", "ta")

    # Must create two distinct, independent instances
    assert len(created_instances) == 2
    assert created_instances[0] is not created_instances[1]
    assert created_instances[0].target == "te"
    assert created_instances[1].target == "ta"
    assert res1 == "TRANS_Hello"
    assert res2 == "TRANS_World"


# =========================================================================
# TEST 10: Existing Translation Cache Behavior Preserved
# =========================================================================
@pytest.mark.asyncio
async def test_translation_cache_behavior():
    fields = {"item": "Potassium deficiency"}
    call_count = 0

    def mock_worker(text, target):
        nonlocal call_count
        call_count += 1
        return f"TE_{text}"

    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", side_effect=mock_worker):
        # First call: cache miss, worker called
        res1 = await _batch_translate_deep_fallback(fields, "te")
        assert res1["item"] == "TE_Potassium deficiency"
        assert call_count == 1
        assert _TRANSLATION_CACHE["te:Potassium deficiency"] == "TE_Potassium deficiency"

        # Second call: cache hit, worker NOT called
        res2 = await _batch_translate_deep_fallback(fields, "te")
        assert res2["item"] == "TE_Potassium deficiency"
        assert call_count == 1  # Still 1, 0 network calls!


# =========================================================================
# TEST 11: Provider Fallback Chain Intact
# =========================================================================
@pytest.mark.asyncio
async def test_provider_fallback_chain():
    base_plant = {
        "common_name": "Rice",
        "description": "Cereal grain",
        "soil_type": "Clayey loam"
    }

    # Scenario A: Gemini Flash succeeds -> DeepTranslator is NOT called
    with patch("backend.app.services.nvidia_service.nvidia_service._call_gemini_flash", new_callable=AsyncMock) as mock_gemini,          patch("backend.app.routers.farmer.predict._batch_translate_deep_fallback", new_callable=AsyncMock) as mock_deep:
        mock_gemini.return_value = '{"description": "GEMINI_Cereal grain", "soil_type": "GEMINI_Clayey loam"}'
        res_gemini = await translate_plant_data(copy.deepcopy(base_plant), "te")
        assert res_gemini["description"] == "GEMINI_Cereal grain"
        assert mock_deep.call_count == 0

    # Scenario B: Gemini fails, NVIDIA succeeds -> DeepTranslator is NOT called
    with patch("backend.app.services.nvidia_service.nvidia_service._call_gemini_flash", side_effect=Exception("Gemini quota error")),          patch("backend.app.services.nvidia_service.nvidia_service.translate_diagnosis", new_callable=AsyncMock) as mock_nim,          patch("backend.app.routers.farmer.predict._batch_translate_deep_fallback", new_callable=AsyncMock) as mock_deep:
        mock_nim.return_value = {"description": "NIM_Cereal grain", "soil_type": "NIM_Clayey loam"}
        res_nim = await translate_plant_data(copy.deepcopy(base_plant), "te")
        assert res_nim["description"] == "NIM_Cereal grain"
        assert mock_deep.call_count == 0

    # Scenario C: Gemini fails, NVIDIA fails -> DeepTranslator fallback is executed
    with patch("backend.app.services.nvidia_service.nvidia_service._call_gemini_flash", side_effect=Exception("Gemini down")),          patch("backend.app.services.nvidia_service.nvidia_service.translate_diagnosis", side_effect=Exception("NIM down")),          patch("backend.app.routers.farmer.predict._sync_deep_translate_batch") as mock_sync:
        mock_sync.return_value = f"DEEP_Cereal grain{TRANSLATION_DELIMITER}DEEP_Clayey loam"
        res_deep = await translate_plant_data(copy.deepcopy(base_plant), "te")
        assert "DEEP_" in res_deep["description"] or "DEEP_" in res_deep["soil_type"]


# =========================================================================
# TEST 12: Supported Language and English Identity Behavior
# =========================================================================
@pytest.mark.asyncio
async def test_supported_language_and_english_identity():
    sample_plant = {"common_name": "Wheat", "description": "Wheat crop"}
    sample_agro = {"name": "Urea", "dosage": "50 kg/acre"}

    # English identity: return directly without modifying or calling providers
    with patch("backend.app.routers.farmer.predict._batch_translate_deep_fallback", new_callable=AsyncMock) as mock_deep:
        p_en = await translate_plant_data(copy.deepcopy(sample_plant), "en")
        p_en_us = await translate_plant_data(copy.deepcopy(sample_plant), "en-US")
        a_en = await translate_agrochemical_data(copy.deepcopy(sample_agro), "en")
        assert p_en == sample_plant
        assert p_en_us == sample_plant
        assert a_en == sample_agro
        assert mock_deep.call_count == 0

    # Regional language code normalization: "te-IN" -> "te"
    with patch("backend.app.routers.farmer.predict._sync_deep_translate_batch", return_value="TELUGU_DESC"):
        res = await _batch_translate_deep_fallback({"desc": "Test"}, "te-IN".split("-")[0])
        assert res["desc"] == "TELUGU_DESC"


# =========================================================================
# TEST 13: B9.3 Worker Routing Contract Boundaries Untouched
# =========================================================================
def test_b9_3_worker_contract_boundaries_intact():
    from backend.tests.test_b9_3_routing_resilience import (
        test_b9_3_image_resolver_intact,
        test_b9_3_worker_contract_boundaries,
        test_b9_3_transient_error_status_codes
    )
    test_b9_3_image_resolver_intact()
    test_b9_3_worker_contract_boundaries()
    test_b9_3_transient_error_status_codes()
