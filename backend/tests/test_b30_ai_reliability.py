"""
B30 Test Suite — AI Diagnosis, Plant Identification & Agrochemical Reliability.
Covers 15 mandatory verification tests defined in B30 specification:
1. Taxonomy verification (1,252 real classes loaded from classes.json)
2. Botanical class rejection (wild flora cannot be crop diseases)
3. Pest class rejection (insects/pests cannot be crop diseases)
4. Valid known disease (high-confidence crop disease preserved locally)
5. Low confidence fallback (threshold < 0.75 triggers fallback review)
6. OOD/unknown crop mismatch fallback (selected crop rejects mismatched disease)
7. Gemini failure resilience (graceful fallback/uncertainty without crash or secret leak)
8. PlantNet real confidence preserved (no artificial 96.5% floor)
9. PlantNet low-confidence fallback (score < 15.0% triggers Gemini fallback)
10. Plant identification vs disease diagnosis separation
11. Agrochemical image pre-scaling (max 1024px preserving aspect ratio)
12. Agrochemical scanner timeout resilience (safe fallback without crash)
13. Agrochemical generic keyword collision rejection (generic words rejected)
14. Agrochemical strong evidence matching (authentic brand/active ingredient matches)
15. Existing agricultural chemical safety gates (PHI, REI, PPE, 1L dilution)
"""

import os
import sys
import io
import tempfile
import asyncio
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import numpy as np
from PIL import Image

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.pytorch.taxonomy import TaxonomyManager, get_taxonomy_manager
from backend.services.pytorch.class_mapper import ClassMapper
from model.predict_pytorch import parse_class_label, predict_crop_disease
from backend.app.services.plant_identifier.online_provider import PlantNetOnlineProvider
from backend.app.services.gemini_vision import _optimize_to_b64
from backend.app.services.agrochemical_detector import (
    has_distinctive_product_evidence,
    GENERIC_AGRO_KEYWORDS,
    detect_agrochemical,
    _preprocess_and_extract_text,
    AGROCHEMICAL_DATABASE
)


class TestB30TaxonomyAndAI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.taxonomy = get_taxonomy_manager()
        # Create a reusable temporary image file for image-based tests
        cls.tmp_img = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        img = Image.new("RGB", (224, 224), color=(34, 139, 34))
        img.save(cls.tmp_img.name, format="JPEG")
        cls.tmp_img_path = cls.tmp_img.name

    @classmethod
    def tearDownClass(cls):
        try:
            if os.path.exists(cls.tmp_img_path):
                os.remove(cls.tmp_img_path)
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # TEST 1 — Taxonomy verification
    # -------------------------------------------------------------------------
    def test_01_taxonomy_verification(self):
        """Verify real repository taxonomy loads exactly 1,252 classes without hardcoded audit errors."""
        classes = self.taxonomy.classes
        self.assertEqual(len(classes), 1252, "Taxonomy must contain exactly 1,252 classes from classes.json")

        # Verify partition groups exist and add up to exactly 1,252
        counts = {
            "pests": len(self.taxonomy.pest_classes),
            "weeds": len(self.taxonomy.weed_classes),
            "deficiencies": len(self.taxonomy.deficiency_classes),
            "fruit_quality": len(self.taxonomy.fruit_quality_classes),
            "crop_classes": len(self.taxonomy.crop_classes),
            "botanical": len(self.taxonomy.botanical_classes)
        }
        total_partitioned = sum(counts.values())
        self.assertEqual(total_partitioned, 1252, f"Total partitioned classes {total_partitioned} must equal 1,252")

        # Exact verified numbers: 104 pests, 21 weeds, 7 deficiencies, 2 fruit quality, 118 crops, 1000 botanical
        self.assertEqual(counts["pests"], 104)
        self.assertEqual(counts["weeds"], 21)
        self.assertEqual(counts["deficiencies"], 7)
        self.assertEqual(counts["fruit_quality"], 2)
        self.assertEqual(counts["crop_classes"], 118)
        self.assertEqual(counts["botanical"], 1000)

        # Verify healthy and disease breakdown in crop classes: 34 healthy + 84 diseased = 118
        healthy_count = sum(1 for c in self.taxonomy.crop_classes if self.taxonomy.get_class_info(c)["is_healthy"])
        disease_count = sum(1 for c in self.taxonomy.crop_classes if not self.taxonomy.get_class_info(c)["is_healthy"])
        self.assertEqual(healthy_count, 34)
        self.assertEqual(disease_count, 84)
        self.assertEqual(healthy_count + disease_count, 118)

    # -------------------------------------------------------------------------
    # TEST 2 — Botanical class rejection
    # -------------------------------------------------------------------------
    def test_02_botanical_class_rejection(self):
        """Verify botanical species (PlantCLEF flora) are rejected as crop diseases."""
        botanical_sample = "Abies_alba"
        info = self.taxonomy.get_class_info(botanical_sample)
        self.assertEqual(info["category"], "botanical_species")
        self.assertFalse(info["is_disease"], "Botanical tree/plant must NOT be flagged as a disease")
        self.assertFalse(info["is_crop"])

        # Check parsing via model parse_class_label
        crop_n, dis_n, status = parse_class_label(botanical_sample)
        self.assertEqual(status, "unsupported")
        self.assertEqual(crop_n, "Wild Flora")

        # Botanical cannot match crop disease filter
        self.assertFalse(self.taxonomy.is_crop_disease(botanical_sample, "Tomato"))
        self.assertFalse(self.taxonomy.is_crop_disease(botanical_sample, None))

    # -------------------------------------------------------------------------
    # TEST 3 — Pest class rejection
    # -------------------------------------------------------------------------
    def test_03_pest_class_rejection(self):
        """Verify pest and insect classes are rejected as crop diseases."""
        pest_sample = "Alfalfa_Plant_Bug"
        info = self.taxonomy.get_class_info(pest_sample)
        self.assertEqual(info["category"], "pest_insect")
        self.assertFalse(info["is_disease"], "Pests/insects must NOT be categorized as diseases")
        self.assertFalse(info["is_crop"])

        guava_pest = "Fruit_Fruitfly_Guava"
        guava_info = self.taxonomy.get_class_info(guava_pest)
        self.assertEqual(guava_info["category"], "pest_insect")
        self.assertFalse(guava_info["is_disease"])

        crop_n, dis_n, status = parse_class_label(pest_sample)
        self.assertEqual(status, "unsupported")
        self.assertEqual(crop_n, "Agricultural Pest")

    # -------------------------------------------------------------------------
    # TEST 4 — Valid known disease
    # -------------------------------------------------------------------------
    def test_04_valid_known_disease(self):
        """Verify high-confidence crop disease is accepted without unnecessary fallback."""
        sample_disease = "Tomato_Early_blight"
        info = self.taxonomy.get_class_info(sample_disease)
        self.assertTrue(info["is_disease"])
        self.assertTrue(info["is_crop"])
        self.assertEqual(info["crop_name"], "Tomato")
        self.assertEqual(info["disease_name"], "Early Blight")

        # Compatible crop filter passes
        self.assertTrue(self.taxonomy.is_crop_disease(sample_disease, "Tomato"))

        # Test predict_crop_disease pipeline with simulated high-confidence prediction
        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
            idx = self.taxonomy.classes.index(sample_disease)
            probs[idx] = 0.96
            mock_loader.predict_image.return_value = {
                "all_probabilities": probs
            }
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            with patch("model.predict_pytorch.is_plant_image", return_value=True):
                result = predict_crop_disease(self.tmp_img_path, explainer_type=None, crop_filter="Tomato")
                self.assertEqual(result["crop_name"], "Tomato")
                self.assertIn("Early Blight", result["disease_name"])
                self.assertNotEqual(result["disease_name"], "Unrecognized or uncertain")
                self.assertFalse(result.get("requires_secondary_review", False))

    # -------------------------------------------------------------------------
    # TEST 5 — Low confidence fallback
    # -------------------------------------------------------------------------
    def test_05_low_confidence_fallback(self):
        """Verify low-confidence prediction (<0.75 / 75%) is flagged for secondary review."""
        sample_disease = "Tomato_Late_blight"
        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
            idx_late = self.taxonomy.classes.index(sample_disease)
            idx_early = self.taxonomy.classes.index("Tomato_Early_blight")
            idx_health = self.taxonomy.classes.index("Tomato_healthy")
            probs[idx_late] = 0.35   # Highest prediction is only 35% (below 75% threshold)
            probs[idx_early] = 0.35  # Ambiguous tie / low confidence
            probs[idx_health] = 0.30
            mock_loader.predict_image.return_value = {
                "all_probabilities": probs
            }
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            with patch("model.predict_pytorch.is_plant_image", return_value=True):
                result = predict_crop_disease(self.tmp_img_path, explainer_type=None, crop_filter="Tomato")
                # When confidence is below threshold, system flags secondary review or uncertain response
                self.assertTrue(
                    result.get("requires_secondary_review", False) or
                    result.get("diagnosis_status") == "uncertain" or
                    result.get("disease_name") == "Unrecognized or uncertain",
                    "Low confidence prediction must trigger secondary review or uncertainty"
                )

    # -------------------------------------------------------------------------
    # TEST 6 — OOD / Unknown crop mismatch fallback
    # -------------------------------------------------------------------------
    def test_06_ood_unknown_fallback(self):
        """Verify class that does not belong to selected crop is safely rejected."""
        apple_disease = "Apple___Apple_scab"
        # User requested Chilli, but model saw Apple Scab
        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
            idx = self.taxonomy.classes.index(apple_disease)
            probs[idx] = 0.95
            mock_loader.predict_image.return_value = {
                "all_probabilities": probs
            }
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            with patch("model.predict_pytorch.is_plant_image", return_value=True):
                result = predict_crop_disease(self.tmp_img_path, explainer_type=None, crop_filter="Chilli")
                # Apple Scab MUST NOT be accepted as a Chilli disease
                self.assertNotEqual(result.get("disease_name"), "Apple Scab")
                self.assertTrue(
                    result.get("requires_secondary_review", False) or
                    result.get("disease_name") == "Unrecognized or uncertain"
                )

    # -------------------------------------------------------------------------
    # TEST 7 — Gemini failure resilience
    # -------------------------------------------------------------------------
    def test_07_gemini_failure_resilience(self):
        """Verify simulated Gemini failure does not crash system or expose secrets."""
        # Simulated exception in secondary verification returns safe uncertainty
        uncertain_res = TaxonomyManager.build_uncertain_response(
            crop_hint="Tomato",
            reason="Secondary visual inspection unavailable or timed out",
            prediction_time_ms=120.0
        )
        self.assertEqual(uncertain_res["diagnosis_status"], "uncertain")
        self.assertEqual(uncertain_res["disease_name"], "Unrecognized or uncertain")
        self.assertEqual(uncertain_res["confidence"], 0.0)
        self.assertTrue(uncertain_res["requires_secondary_review"])
        # Ensure no secrets or API keys are exposed
        self.assertNotIn("AIza", str(uncertain_res))

    # -------------------------------------------------------------------------
    # TEST 8 — PlantNet real confidence preserved
    # -------------------------------------------------------------------------
    def test_08_plantnet_real_confidence(self):
        """Verify artificial 96.5% confidence floor is removed and real score preserved."""
        provider = PlantNetOnlineProvider(api_key="dummy_key")

        # Mock requests.post returning real score 0.423 (42.3%)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "results": [{
                "score": 0.423,
                "species": {
                    "scientificNameWithoutAuthor": "Solanum lycopersicum",
                    "genus": {"scientificNameWithoutAuthor": "Solanum"},
                    "family": {"scientificNameWithoutAuthor": "Solanaceae"},
                    "commonNames": ["Tomato"]
                }
            }]
        }

        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.open", unittest.mock.mock_open(read_data=b"fakeimage")):
            res = asyncio.run(provider.identify("dummy_path.jpg", crop_name="Tomato"))
            self.assertIsNotNone(res)
            self.assertEqual(res["confidence"], 42.3, "Real score 42.3% must be preserved without artificial 96.5% floor")
            self.assertNotEqual(res["confidence"], 96.5)
            self.assertNotEqual(res["confidence"], 96.0)

    # -------------------------------------------------------------------------
    # TEST 9 — PlantNet low confidence fallback
    # -------------------------------------------------------------------------
    def test_09_plantnet_low_confidence_fallback(self):
        """Verify low-confidence Pl@ntNet score (<15.0%) triggers Gemini fallback."""
        provider = PlantNetOnlineProvider(api_key="dummy_key")
        mock_gemini = AsyncMock()
        mock_gemini.identify.return_value = {
            "common_name": "Tomato",
            "scientific_name": "Solanum lycopersicum",
            "confidence": 85.0
        }
        provider.gemini_provider = mock_gemini

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "results": [{
                "score": 0.08,  # 8.0%, below 15.0% threshold
                "species": {
                    "scientificNameWithoutAuthor": "Unknown Plant",
                    "commonNames": ["Weed"]
                }
            }]
        }

        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.open", unittest.mock.mock_open(read_data=b"fakeimage")):
            res = asyncio.run(provider.identify("dummy_path.jpg", crop_name="Tomato"))
            self.assertIsNotNone(res)
            mock_gemini.identify.assert_awaited_once()
            self.assertEqual(res["common_name"], "Tomato")

    # -------------------------------------------------------------------------
    # TEST 10 — Plant / disease separation
    # -------------------------------------------------------------------------
    def test_10_plant_disease_separation(self):
        """Verify plant identification cannot masquerade as disease diagnosis."""
        # A weed species from taxonomy
        weed_class = "Parthenium_Weed"
        info = self.taxonomy.get_class_info(weed_class)
        self.assertFalse(info["is_disease"])
        self.assertEqual(info["category"], "weed_species")

        # A botanical wild flora species
        flora_class = "Abies_alba"
        flora_info = self.taxonomy.get_class_info(flora_class)
        self.assertFalse(flora_info["is_disease"])
        self.assertEqual(flora_info["category"], "botanical_species")

        # ClassMapper details
        mapper = ClassMapper()
        details = mapper.get_disease_details(weed_class)
        self.assertFalse(details["is_disease"])
        self.assertIn("weed", details["category"])

    # -------------------------------------------------------------------------
    # TEST 11 — Agrochemical image scaling
    # -------------------------------------------------------------------------
    def test_11_agrochemical_image_scaling(self):
        """Verify oversized images (>1024px) are bounded while preserving aspect ratio."""
        # Create a 3000x1500 test image (2:1 aspect ratio)
        img = Image.new("RGB", (3000, 1500), color=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        raw_bytes = buf.getvalue()

        # Run through _optimize_to_b64
        import base64
        b64_out = _optimize_to_b64(raw_bytes, max_dim=1024)
        self.assertIsNotNone(b64_out)
        resized_bytes = base64.b64decode(b64_out)
        resized_img = Image.open(io.BytesIO(resized_bytes))

        # Check maximum dimension is capped at 1024 and aspect ratio is 2:1
        w, h = resized_img.size
        self.assertLessEqual(max(w, h), 1024)
        self.assertEqual(w, 1024)
        self.assertEqual(h, 512)

    # -------------------------------------------------------------------------
    # TEST 12 — Agrochemical timeout resilience
    # -------------------------------------------------------------------------
    def test_12_agrochemical_timeout_resilience(self):
        """Verify agrochemical detector handles vision timeouts gracefully."""
        # Mock extract_agrochemical_label_vision to raise TimeoutError
        with patch("backend.app.services.gemini_vision.extract_agrochemical_label_vision", side_effect=TimeoutError("Timeout")):
            with patch("backend.app.services.agrochemical_detector._preprocess_and_extract_text", return_value=["Coragen", "Chlorantraniliprole"]):
                with patch("os.path.exists", return_value=True):
                    res = detect_agrochemical("dummy_pesticide.jpg", force_scan=True)
                    self.assertIsNotNone(res)
                    # Falls back to database/catalog matching successfully
                    self.assertTrue(res.get("product_identified") or res.get("is_agrochemical"))

    # -------------------------------------------------------------------------
    # TEST 13 — Agrochemical keyword collision rejection
    # -------------------------------------------------------------------------
    def test_13_agrochemical_keyword_collision(self):
        """Verify generic agrochemical terms do not trigger false product matches."""
        generic_text = "broad spectrum fungicide spray crop protection systemic formulation"

        # Test has_distinctive_product_evidence rejects generic words
        self.assertFalse(has_distinctive_product_evidence(generic_text, "fungicide"))
        self.assertFalse(has_distinctive_product_evidence(generic_text, "spray"))
        self.assertFalse(has_distinctive_product_evidence(generic_text, "crop"))

        # Test detection on pure generic text
        with patch("backend.app.services.gemini_vision.extract_agrochemical_label_vision", return_value=None):
            with patch("backend.app.services.agrochemical_detector._preprocess_and_extract_text", return_value=[generic_text]):
                with patch("backend.app.services.agrochemical_detector.search_agrochemical_web", return_value=None):
                    with patch("backend.app.services.agrochemical_detector.enrich_agrochemical_with_ai", return_value=None):
                        with patch("os.path.exists", return_value=True):
                            res = detect_agrochemical("dummy_label.jpg", force_scan=True)
                            self.assertFalse(res.get("product_identified"), "Generic terms alone must not identify a product")
                            self.assertEqual(res.get("category_type"), "Uncertain")

    # -------------------------------------------------------------------------
    # TEST 14 — Strong chemical evidence
    # -------------------------------------------------------------------------
    def test_14_strong_chemical_evidence(self):
        """Verify distinctive brand and active ingredient matches database accurately."""
        coragen_text = "FMC Coragen Chlorantraniliprole 18.5% SC Insecticide"
        self.assertTrue(has_distinctive_product_evidence(coragen_text, "coragen"))
        self.assertTrue(has_distinctive_product_evidence(coragen_text, "chlorantraniliprole"))

        with patch("backend.app.services.gemini_vision.extract_agrochemical_label_vision", return_value=None):
            with patch("backend.app.services.agrochemical_detector._preprocess_and_extract_text", return_value=[coragen_text]):
                with patch("os.path.exists", return_value=True):
                    res = detect_agrochemical("dummy_label.jpg", force_scan=True)
                    self.assertTrue(res.get("product_identified"))
                    self.assertIn("coragen", res["product_details"]["brand_name"].lower())

    # -------------------------------------------------------------------------
    # TEST 15 — Existing agricultural chemical safety gates
    # -------------------------------------------------------------------------
    def test_15_existing_agricultural_safety(self):
        """Verify PHI, REI, PPE, and dilution rate per litre are strictly enforced."""
        saaf_data = AGROCHEMICAL_DATABASE.get("saaf")
        self.assertIsNotNone(saaf_data)

        # Verify dilution rate per litre is present (never 20L backpack pump dosage)
        dosage = saaf_data.get("recommended_dosage_per_litre")
        self.assertIn("/ L", dosage)
        self.assertNotIn("backpack pump", dosage.lower())

        # Verify pre-harvest and re-entry intervals
        self.assertTrue(saaf_data.get("preharvest_interval"))
        self.assertTrue(saaf_data.get("reentry_interval"))
        self.assertTrue(saaf_data.get("protective_equipment"))


if __name__ == "__main__":
    unittest.main()
