"""
D2.5 AI Triple-System Safety & Reliability Test Suite
====================================================
Covers:
- Plant Identification Safety (P1–P5)
- Disease Diagnosis Confidence Safety (D1–D5)
- Agrochemical Scanner Safety (A1–A6)
- Cross-Worker Image Transfer (RC09)
"""

import os
import sys
import tempfile
import base64
import unittest
import numpy as np
import cv2
from unittest.mock import MagicMock, patch, AsyncMock
import asyncio

# Ensure project root in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.services.plant_identifier.identifier import PlantIdentifier, plant_identifier_service
from backend.app.services.plant_identifier.online_provider import NVIDIAOnlinePlantProvider
from backend.app.services.agrochemical_detector import detect_agrochemical, has_distinctive_product_evidence
from backend.app.services.image_resolver import resolve_image_path
from model.predict_pytorch import predict_crop_disease, PipelineConfig
from backend.services.pytorch.taxonomy import get_taxonomy_manager


class TestD25PlantIDSafety(unittest.TestCase):
    """P1–P5: Plant Identification Safety"""

    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = tempfile.mkdtemp()
        # Create a test leaf image
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        img[50:250, 50:250] = [34, 139, 34] # Green block

        cls.tomato_filename_img = os.path.join(cls.tmp_dir, "tomato_leaf.jpg")
        cls.random_filename_img = os.path.join(cls.tmp_dir, "random_xyz.jpg")
        cls.unknown_noise_img = os.path.join(cls.tmp_dir, "synthetic_noise.jpg")

        cv2.imwrite(cls.tomato_filename_img, img)
        cv2.imwrite(cls.random_filename_img, img)
        cv2.imwrite(cls.unknown_noise_img, np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8))

    def test_p1_filename_does_not_identify_tomato(self):
        """P1: Filename 'tomato_leaf.jpg' must NOT identify tomato solely from filename."""
        identifier = PlantIdentifier()
        identifier.online_provider = MagicMock()
        identifier.online_provider.identify = AsyncMock(return_value=None)

        with patch.object(identifier, "_attempt_local_identification", return_value=None):
            result = asyncio.run(identifier.identify_plant(self.tomato_filename_img))
            # Result must NOT claim success just because filename has 'tomato'
            self.assertFalse(result.get("success", False))
            self.assertNotIn("Tomato", str(result.get("plant") or ""))

    def test_p2_identical_image_different_filename_consistent(self):
        """P2: Filename 'random_xyz.jpg' with identical image produces identical output."""
        identifier = PlantIdentifier()
        identifier.online_provider = MagicMock()
        identifier.online_provider.identify = AsyncMock(return_value=None)

        with patch.object(identifier, "_attempt_local_identification", return_value=None):
            res1 = asyncio.run(identifier.identify_plant(self.tomato_filename_img))
            res2 = asyncio.run(identifier.identify_plant(self.random_filename_img))
            self.assertEqual(res1.get("success"), res2.get("success"))
            self.assertEqual(res1.get("error"), res2.get("error"))

    def test_p3_no_artificial_confidence_inflation(self):
        """P3: A genuine 71% model confidence must remain ~71%, never inflated to 96-98%."""
        identifier = PlantIdentifier()
        mock_loader = MagicMock()
        mock_loader.predict_image.return_value = {
            "top_predictions": [{"class_name": "Tomato___healthy", "confidence": 0.712}]
        }
        with patch("model.predict_pytorch.load_resources", return_value=(mock_loader, [])):
            result = identifier._attempt_local_identification(self.tomato_filename_img, organ="leaf")
            self.assertIsNotNone(result)
            self.assertTrue(result.get("success"))
            # Must remain 71.2, not inflated by max(prob, 96.5)
            self.assertEqual(result.get("confidence"), 71.2)
            self.assertLess(result.get("confidence"), 90.0)

    def test_p4_nvidia_provider_cannot_fabricate_visual_id(self):
        """P4: NVIDIA text provider cannot return high-confidence visual identification without image evidence."""
        provider = NVIDIAOnlinePlantProvider()
        result = asyncio.run(provider.identify(self.tomato_filename_img, organ="leaf"))
        # Must return None safely
        self.assertIsNone(result)

    def test_p5_unknown_plant_returns_explicit_uncertainty(self):
        """P5: Unknown plant returns an explicit uncertainty state."""
        identifier = PlantIdentifier()
        identifier.online_provider = MagicMock()
        identifier.online_provider.identify = AsyncMock(return_value=None)

        with patch.object(identifier, "_attempt_local_identification", return_value=None):
            result = asyncio.run(identifier.identify_plant(self.unknown_noise_img))
            self.assertFalse(result.get("success", False))
            self.assertIsNone(result.get("confidence"))


class TestD25DiseaseDiagnosisSafety(unittest.TestCase):
    """D1–D5: Disease Diagnosis Confidence Safety"""

    @classmethod
    def setUpClass(cls):
        cls.taxonomy = get_taxonomy_manager()
        cls.tmp_dir = tempfile.mkdtemp()
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        img[50:250, 50:250] = [34, 139, 34]
        cls.test_leaf_path = os.path.join(cls.tmp_dir, "test_leaf.jpg")
        cv2.imwrite(cls.test_leaf_path, img)

    def test_d1_low_residual_crop_probability_cannot_become_90_percent_confidence(self):
        """D1: Low residual crop probability cannot become artificial 90%+ confidence through subset normalization."""
        mock_probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
        # Put 90% mass on Apple scab
        mock_probs[0] = 0.90
        # Put 10% total mass on Tomato (residual mass = 0.10, below MIN_CROP_MASS_THRESHOLD 0.15)
        tomato_indices = [i for i, c in enumerate(self.taxonomy.classes) if self.taxonomy.matches_crop_filter(c, "Tomato")]
        self.assertGreater(len(tomato_indices), 0)
        # Allocate 0.095 to the top tomato class (95% of the 10% tomato mass)
        mock_probs[tomato_indices[0]] = 0.095
        mock_probs[tomato_indices[1]] = 0.005

        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            mock_loader.predict_image.return_value = {"all_probabilities": mock_probs}
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            res = predict_crop_disease(self.test_leaf_path, explainer_type=None, crop_filter="Tomato")
            # Must NOT report 95% confidence! Must be rejected as OOD / uncertain
            self.assertEqual(res.get("diagnosis_status"), "uncertain")
            self.assertEqual(res.get("prediction_status"), "unsupported")
            self.assertLess(res.get("confidence", 0.0), 0.40)

    def test_d2_unsupported_ood_remains_uncertain(self):
        """D2: Unsupported/OOD diagnosis remains uncertain."""
        mock_probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
        # Uniformly distribute tiny probabilities
        mock_probs[:] = 1.0 / len(self.taxonomy.classes)

        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            mock_loader.predict_image.return_value = {"all_probabilities": mock_probs}
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            res = predict_crop_disease(self.test_leaf_path, explainer_type=None)
            self.assertEqual(res.get("diagnosis_status"), "uncertain")
            self.assertEqual(res.get("confidence"), 0.0)

    def test_d3_gemini_chemical_text_cannot_bypass_validated_database(self):
        """D3: Gemini chemical text cannot directly populate chemical_treatment in predict endpoint."""
        from backend.app.routers.farmer.predict import predict_pytorch_endpoint, PredictRequest
        from backend.tests.test_b31_ai_reliability import get_mock_db

        req = PredictRequest(
            image_path=self.test_leaf_path,
            crop_filter="Tomato",
            explainer_type=None
        )

        mock_local_res = {
            "crop_name": "Tomato",
            "disease_name": "Unrecognized or uncertain",
            "raw_label": "OOD",
            "confidence": 0.20,
            "prediction_status": "unsupported",
            "diagnosis_status": "uncertain",
            "top_predictions": []
        }

        # Mock Gemini opinion returning ungrounded chemical remedies
        mock_vision_opinion = {
            "disease_name": "Tomato Early Blight",
            "confidence": 0.88,
            "is_healthy": False,
            "chemical_remedies": ["Arbitrary Chemical X @ 10 mL/L", "Unverified Fungicide Y"],
            "reasoning": "Observed concentric rings"
        }

        mock_db = get_mock_db()

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_local_res):
            with patch("backend.app.services.gemini_vision.cross_verify_disease_with_vision", new_callable=AsyncMock, return_value=mock_vision_opinion):
                endpoint_res = asyncio.run(predict_pytorch_endpoint(
                    req,
                    current_user={"id": "64b0f9c2d1f7c23456789abc", "preferred_language": "en"},
                    db=mock_db
                ))

                # Arbitrary chemical from vision opinion must NOT be directly set as chemical_treatment
                chem_treat = str(endpoint_res.get("chemical_treatment") or "")
                self.assertNotIn("Arbitrary Chemical X", chem_treat)
                self.assertNotIn("Unverified Fungicide Y", chem_treat)

    def test_d4_gemini_failure_safely_falls_back(self):
        """D4: Gemini failure safely falls back without crashing or fabricating confidence."""
        from backend.app.routers.farmer.predict import predict_pytorch_endpoint, PredictRequest
        from backend.tests.test_b31_ai_reliability import get_mock_db

        req = PredictRequest(
            image_path=self.test_leaf_path,
            crop_filter="Tomato",
            explainer_type=None
        )

        mock_local_res = {
            "crop_name": "Tomato",
            "disease_name": "Tomato Early blight",
            "raw_label": "Tomato_Early_blight",
            "confidence": 0.75,
            "prediction_status": "diseased",
            "diagnosis_status": "confirmed_local",
            "top_predictions": [{"class_name": "Tomato_Early_blight", "crop_name": "Tomato", "disease_name": "Early blight", "confidence": 0.75}]
        }

        mock_db = get_mock_db()

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_local_res):
            with patch("backend.app.services.gemini_vision.cross_verify_disease_with_vision", new_callable=AsyncMock, side_effect=RuntimeError("Gemini API connection error")):
                endpoint_res = asyncio.run(predict_pytorch_endpoint(
                    req,
                    current_user={"id": "64b0f9c2d1f7c23456789abc", "preferred_language": "en"},
                    db=mock_db
                ))
                # Endpoint finishes safely with local prediction
                self.assertEqual(endpoint_res.get("crop_name"), "Tomato")
                self.assertFalse(endpoint_res.get("ensemble_used", False))


class TestD25AgrochemicalScannerSafety(unittest.TestCase):
    """A1–A6: Agrochemical Scanner Safety"""

    def test_a1_bharat_does_not_automatically_match_urea_dap(self):
        """A1: Scanning text containing 'bharat' does NOT automatically identify Urea or DAP."""
        # Distinctive evidence check: generic company/subsidy names must NOT match product identity
        matched = has_distinctive_product_evidence("bharat rasayan general brand pack", "urea")
        self.assertFalse(matched)

        matched_dap = has_distinctive_product_evidence("bharat government subsidized fertilizer bag", "dap")
        self.assertFalse(matched_dap)

        matched_iffco = has_distinctive_product_evidence("iffco multi-purpose agricultural spray", "urea")
        self.assertFalse(matched_iffco)

    def test_a2_unknown_chemical_does_not_receive_default_dosage_or_phi(self):
        """A2: Unknown chemical does NOT receive 2.0 mL/L or 14 days PHI fallback."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            img = np.zeros((200, 200, 3), dtype=np.uint8)
            cv2.imwrite(f.name, img)
            dummy_path = f.name

        try:
            with patch("backend.app.services.gemini_vision.extract_agrochemical_label_vision", return_value=None):
                with patch("backend.app.services.agrochemical_detector._preprocess_and_extract_text", return_value=["Random text xyz unverified"]):
                    with patch("backend.app.services.agrochemical_detector.search_agrochemical_web", return_value=""):
                        with patch("backend.app.services.agrochemical_detector.enrich_agrochemical_with_ai", return_value=None):
                            res = detect_agrochemical(dummy_path, force_scan=False)
                            self.assertFalse(res.get("product_identified"))
                            info = res.get("info", {})
                            self.assertIsNone(info.get("recommended_dosage"))
                            self.assertIsNone(info.get("phi_days"))
        finally:
            if os.path.exists(dummy_path):
                os.remove(dummy_path)

    def test_a3_web_fallback_returns_unverified_with_no_dosage(self):
        """A3: Web search match returns UNVERIFIED with dosage/PHI None."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            img = np.zeros((200, 200, 3), dtype=np.uint8)
            cv2.imwrite(f.name, img)
            dummy_path = f.name

        try:
            mock_web_ai = {
                "product_name": "Exotic Chemical Z",
                "brand_name": "Exotic Chemical Z",
                "active_ingredients": "Exotic Ingredient 50% EC",
                "chemical_category": "Fungicide",
                "action_mode": "Protective Foliar Action",
                "target_crops": ["Vegetables"],
                "target_diseases_and_pests": ["Foliar Spots"],
                "toxicity_hazard": "Green",
                "hazard_color": "#16a34a"
            }
            with patch("backend.app.services.gemini_vision.extract_agrochemical_label_vision", return_value=None):
                with patch("backend.app.services.agrochemical_detector._preprocess_and_extract_text", return_value=["Exotic Chemical Z 50% EC"]):
                    with patch("backend.app.services.agrochemical_detector.search_agrochemical_web", return_value="Exotic Chemical Z is an agricultural formulation"):
                        with patch("backend.app.services.agrochemical_detector.enrich_agrochemical_with_ai", return_value=mock_web_ai):
                            res = detect_agrochemical(dummy_path, force_scan=True)
                            self.assertEqual(res.get("verification_status"), "unverified")
                            self.assertFalse(res.get("product_identified"))
                            info = res.get("info", {})
                            self.assertIsNone(info.get("recommended_dosage"))
                            self.assertIsNone(info.get("phi_days"))
        finally:
            if os.path.exists(dummy_path):
                os.remove(dummy_path)

    def test_a4_verified_catalog_product_retains_valid_behavior(self):
        """A4: Verified catalog product (e.g. Amistar Top) retains valid behavior."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            img = np.zeros((200, 200, 3), dtype=np.uint8)
            cv2.imwrite(f.name, img)
            dummy_path = f.name

        try:
            with patch("backend.app.services.gemini_vision.extract_agrochemical_label_vision", return_value=None):
                with patch("backend.app.services.agrochemical_detector._preprocess_and_extract_text", return_value=["Amistar Top Azoxystrobin Difenoconazole Syngenta"]):
                    res = detect_agrochemical(dummy_path, force_scan=True)
                    self.assertTrue(res.get("product_identified"))
                    self.assertTrue(res.get("is_agrochemical"))
                    self.assertEqual(res.get("verification_status"), "verified_catalog")
                    self.assertIn("amistar top", res["info"]["product_name"].lower())
        finally:
            if os.path.exists(dummy_path):
                os.remove(dummy_path)


class TestD25CrossWorkerImageTransfer(unittest.TestCase):
    """RC09: Cross-Worker Image Resolution via Base64 Payload"""

    def test_base64_data_url_resolution(self):
        """Base64 data URL is safely decoded, magic bytes verified, and cached locally."""
        # Create a 10x10 tiny JPEG in memory
        img = np.zeros((10, 10, 3), dtype=np.uint8)
        _, enc = cv2.imencode(".jpg", img)
        b64_str = base64.b64encode(enc.tobytes()).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{b64_str}"

        resolved_path = resolve_image_path(data_url)
        self.assertIsNotNone(resolved_path)
        self.assertTrue(os.path.exists(resolved_path))
        self.assertTrue(resolved_path.endswith(".jpg"))

    def test_invalid_base64_magic_bytes_rejected(self):
        """Invalid base64 payload failing magic bytes is rejected."""
        fake_bytes = b"This is not a real image binary file format at all 1234567890"
        b64_str = base64.b64encode(fake_bytes).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{b64_str}"

        resolved_path = resolve_image_path(data_url)
        self.assertIsNone(resolved_path)


if __name__ == "__main__":
    unittest.main()
