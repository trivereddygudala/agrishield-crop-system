"""
B32 Test Suite — Diagnostic Advisory & Chemical Safety Gating.
Covers the 16 mandatory verification tests defined in B32 specification:
1. Test 1 — Unsuitable image has no chemical treatment (safe empty/none)
2. Test 2 — Unsuitable image has no prescription calendar (empty)
3. Test 3 — Unsuitable image has no disease symptoms
4. Test 4 — Uncertain diagnosis has no chemical treatment (safe empty/none)
5. Test 5 — Uncertain diagnosis has no prescription calendar (empty)
6. Test 6 — Uncertain confidence is not inflated (0.0 remains 0.0, never inflated)
7. Test 7 — Healthy result is recognized as healthy (prediction_status == 'healthy')
8. Test 8 — Healthy result has no disease symptoms (no necrotic/blight lesions)
9. Test 9 — Healthy result has no chemical treatment (safe empty/none)
10. Test 10 — Healthy result has no prescription calendar (empty)
11. Test 11 — Uncertain notification is not Critical (priority Low, no immediate treatment)
12. Test 12 — Unsuitable notification is informational (priority Low, no disease alert)
13. Test 13 — requires_secondary_review is returned in prediction record contract
14. Test 14 — Confirmed disease remains functional (advisory and chemical path intact)
15. Test 15 — Gemini fallback healthy behavior (zero fungicides, no disease lesions)
16. Test 16 — Gemini fallback uncertain behavior (confidence 0.0, zero chemicals)
"""

import os
import sys
import unittest
import asyncio
import tempfile
import numpy as np
from PIL import Image
from unittest.mock import MagicMock, patch, AsyncMock

# Ensure project root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.services.gemini_vision import generate_fallback_extension_officer_report
from backend.app.routers.farmer.predict import predict_pytorch_endpoint, PredictRequest


def get_mock_db():
    mock_db = MagicMock()
    mock_db.predictions = MagicMock()
    mock_db.predictions.insert_one = AsyncMock(return_value=MagicMock(inserted_id="64b0f9c2d1f7c23456789abc"))
    mock_db.notification_settings = MagicMock()
    mock_db.notification_settings.find_one = AsyncMock(return_value=None)
    mock_db.notification_settings.insert_one = AsyncMock(return_value=MagicMock(inserted_id="64b0f9c2d1f7c23456789abe"))
    mock_db.notifications = MagicMock()
    mock_db.notifications.insert_one = AsyncMock(return_value=MagicMock(inserted_id="64b0f9c2d1f7c23456789abd"))
    mock_db.farms = MagicMock()
    mock_db.farms.find_one = AsyncMock(return_value={"id": "farm_1", "village": "Adilabad", "district": "Adilabad"})
    cursor = MagicMock()
    cursor.__aiter__ = MagicMock(return_value=iter([]))
    mock_db.farms.find = MagicMock(return_value=cursor)
    mock_db.users = MagicMock()
    mock_db.users.find_one = AsyncMock(return_value={"id": "64b0f9c2d1f7c23456789abc", "preferred_language": "en"})
    return mock_db


class TestB32AdvisorySafety(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Create a temporary dummy leaf image
        cls.temp_dir = tempfile.TemporaryDirectory()
        leaf_arr = np.full((300, 300, 3), [34, 139, 34], dtype=np.uint8)
        cls.sample_leaf_path = os.path.join(cls.temp_dir.name, "sample_leaf.jpg")
        Image.fromarray(leaf_arr).save(cls.sample_leaf_path)

        # Create a blank (unsuitable) image
        blank_arr = np.zeros((300, 300, 3), dtype=np.uint8)
        cls.blank_img_path = os.path.join(cls.temp_dir.name, "blank.jpg")
        Image.fromarray(blank_arr).save(cls.blank_img_path)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def setUp(self):
        self.gemini_patcher = patch(
            "backend.app.services.gemini_vision.cross_verify_disease_with_vision",
            new_callable=AsyncMock,
            return_value=None
        )
        self.mock_gemini = self.gemini_patcher.start()
        self.farm_patcher = patch(
            "backend.app.services.farm_profile_service.FarmProfileService.get_active_farm",
            new_callable=AsyncMock,
            return_value={"land_size": 2.0, "district": "Adilabad"}
        )
        self.mock_farm = self.farm_patcher.start()

    def tearDown(self):
        self.gemini_patcher.stop()
        self.farm_patcher.stop()

    # --- Test 1: Unsuitable image has no chemical treatment ---
    def test_01_unsuitable_image_no_chemical_treatment(self):
        req = PredictRequest(image_path=self.blank_img_path)
        mock_db = get_mock_db()

        res = asyncio.run(predict_pytorch_endpoint(
            req,
            current_user={"id": "64b0f9c2d1f7c23456789abc"},
            db=mock_db
        ))

        self.assertEqual(res["diagnosis_status"], "image_unsuitable")
        chem = str(res.get("chemical_treatment", "")).lower()
        self.assertTrue("none" in chem or not chem, f"Unexpected chemical treatment for unsuitable image: {chem}")
        self.assertNotIn("mancozeb", chem)
        self.assertNotIn("carbendazim", chem)
        self.assertNotIn("copper", chem)

    # --- Test 2: Unsuitable image has no prescription ---
    def test_02_unsuitable_image_no_prescription(self):
        req = PredictRequest(image_path=self.blank_img_path)
        mock_db = get_mock_db()

        res = asyncio.run(predict_pytorch_endpoint(
            req,
            current_user={"id": "64b0f9c2d1f7c23456789abc"},
            db=mock_db
        ))

        self.assertEqual(res["diagnosis_status"], "image_unsuitable")
        self.assertEqual(res.get("prescription_calendar"), [])

    # --- Test 3: Unsuitable image has no disease symptoms ---
    def test_03_unsuitable_image_no_disease_symptoms(self):
        req = PredictRequest(image_path=self.blank_img_path)
        mock_db = get_mock_db()

        res = asyncio.run(predict_pytorch_endpoint(
            req,
            current_user={"id": "64b0f9c2d1f7c23456789abc"},
            db=mock_db
        ))

        symptoms = str(res.get("symptoms", "")).lower()
        self.assertNotIn("lesions", symptoms)
        self.assertNotIn("blight", symptoms)
        self.assertNotIn("chlorosis", symptoms)
        self.assertIn("could not be reliably analyzed", symptoms)

    # --- Test 4: Uncertain diagnosis has no chemical treatment ---
    def test_04_uncertain_diagnosis_no_chemical_treatment(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Unrecognized or uncertain",
            "raw_label": "OOD",
            "confidence": 0.0,
            "prediction_status": "unsupported",
            "diagnosis_status": "uncertain",
            "top_predictions": []
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            self.assertEqual(res["diagnosis_status"], "uncertain")
            chem = str(res.get("chemical_treatment", "")).lower()
            self.assertTrue("none" in chem or not chem, f"Unexpected chemical treatment for uncertain diagnosis: {chem}")
            self.assertNotIn("mancozeb", chem)
            self.assertNotIn("fungicide", chem.replace("no chemical fungicides", ""))

    # --- Test 5: Uncertain diagnosis has no prescription ---
    def test_05_uncertain_diagnosis_no_prescription(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Unrecognized or uncertain",
            "raw_label": "OOD",
            "confidence": 0.0,
            "prediction_status": "unsupported",
            "diagnosis_status": "uncertain",
            "top_predictions": []
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            self.assertEqual(res.get("prescription_calendar"), [])

    # --- Test 6: Uncertain confidence is not inflated ---
    def test_06_uncertain_confidence_not_inflated(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Unrecognized or uncertain",
            "raw_label": "OOD",
            "confidence": 0.0,
            "prediction_status": "unsupported",
            "diagnosis_status": "uncertain",
            "top_predictions": []
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            self.assertEqual(res["confidence"], 0.0)
            self.assertNotEqual(res["confidence"], 0.75)
            self.assertLess(res["confidence"], 0.40)

    # --- Test 7: Healthy result is recognized as healthy ---
    def test_07_healthy_result_recognized_as_healthy(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_healthy",
            "raw_label": "Tomato_healthy",
            "confidence": 0.95,
            "prediction_status": "healthy",
            "diagnosis_status": "confirmed_local",
            "top_predictions": [{"class_name": "Tomato_healthy", "confidence": 0.95}]
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            self.assertEqual(res["prediction_status"], "healthy")
            self.assertEqual(res["disease_name"], "Healthy")

    # --- Test 8: Healthy result has no disease symptoms ---
    def test_08_healthy_result_no_disease_symptoms(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_healthy",
            "raw_label": "Tomato_healthy",
            "confidence": 0.95,
            "prediction_status": "healthy",
            "diagnosis_status": "confirmed_local",
            "top_predictions": [{"class_name": "Tomato_healthy", "confidence": 0.95}]
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            symptoms = str(res.get("symptoms", "")).lower()
            self.assertIn("healthy vigor", symptoms)
            self.assertNotIn("necrotic", symptoms)
            self.assertNotIn("blight", symptoms)
            self.assertNotIn("lesions observed", symptoms)

    # --- Test 9: Healthy result has no chemical treatment ---
    def test_09_healthy_result_no_chemical_treatment(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_healthy",
            "raw_label": "Tomato_healthy",
            "confidence": 0.95,
            "prediction_status": "healthy",
            "diagnosis_status": "confirmed_local",
            "top_predictions": [{"class_name": "Tomato_healthy", "confidence": 0.95}]
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            chem = str(res.get("chemical_treatment", "")).lower()
            self.assertIn("no chemical fungicides or bactericides required", chem)
            self.assertNotIn("mancozeb", chem)
            self.assertNotIn("carbendazim", chem)
            self.assertNotIn("copper oxychloride", chem)

    # --- Test 10: Healthy result has no prescription ---
    def test_10_healthy_result_no_prescription(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_healthy",
            "raw_label": "Tomato_healthy",
            "confidence": 0.95,
            "prediction_status": "healthy",
            "diagnosis_status": "confirmed_local",
            "top_predictions": [{"class_name": "Tomato_healthy", "confidence": 0.95}]
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            self.assertEqual(res.get("prescription_calendar"), [])

    # --- Test 11: Uncertain notification is not Critical ---
    def test_11_uncertain_notification_not_critical(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Unrecognized or uncertain",
            "raw_label": "OOD",
            "confidence": 0.0,
            "prediction_status": "unsupported",
            "diagnosis_status": "uncertain",
            "top_predictions": []
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            with patch("backend.app.services.notification_service.NotificationService.create_notification", new_callable=AsyncMock) as mock_create_notif:
                asyncio.run(predict_pytorch_endpoint(
                    req,
                    current_user={"id": "64b0f9c2d1f7c23456789abc"},
                    db=mock_db
                ))

                if mock_create_notif.called:
                    call_args = mock_create_notif.call_args[0]
                    notif_data = call_args[1]
                    self.assertNotEqual(notif_data.priority, "Critical")
                    self.assertEqual(notif_data.priority, "Low")
                    self.assertNotIn("Immediate treatment recommended", notif_data.message)

    # --- Test 12: Unsuitable notification is informational ---
    def test_12_unsuitable_notification_informational(self):
        req = PredictRequest(image_path=self.blank_img_path)
        mock_db = get_mock_db()

        with patch("backend.app.services.notification_service.NotificationService.create_notification", new_callable=AsyncMock) as mock_create_notif:
            asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            if mock_create_notif.called:
                call_args = mock_create_notif.call_args[0]
                notif_data = call_args[1]
                self.assertEqual(notif_data.priority, "Low")
                self.assertNotIn("Disease Alert", notif_data.title)
                self.assertIn("Unsuitable", notif_data.title)

    # --- Test 13: requires_secondary_review is returned ---
    def test_13_requires_secondary_review_contract(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()

        # For uncertain:
        mock_pred_uncertain = {
            "crop_name": "Tomato",
            "disease_name": "Unrecognized or uncertain",
            "raw_label": "OOD",
            "confidence": 0.0,
            "prediction_status": "unsupported",
            "diagnosis_status": "uncertain",
            "top_predictions": []
        }
        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred_uncertain):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))
            self.assertIn("requires_secondary_review", res)
            self.assertTrue(res["requires_secondary_review"])

        # For healthy:
        mock_pred_healthy = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_healthy",
            "raw_label": "Tomato_healthy",
            "confidence": 0.95,
            "prediction_status": "healthy",
            "diagnosis_status": "confirmed_local",
            "top_predictions": []
        }
        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred_healthy):
            res_h = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))
            self.assertIn("requires_secondary_review", res_h)
            self.assertFalse(res_h["requires_secondary_review"])

    # --- Test 14: Confirmed disease remains functional ---
    def test_14_confirmed_disease_remains_functional(self):
        req = PredictRequest(image_path=self.sample_leaf_path, crop_filter="Tomato")
        mock_db = get_mock_db()
        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_Early_blight",
            "raw_label": "Tomato_Early_blight",
            "confidence": 0.92,
            "prediction_status": "diseased",
            "diagnosis_status": "confirmed_local",
            "disease_severity": "High",
            "top_predictions": [{"class_name": "Tomato_Early_blight", "confidence": 0.92}]
        }

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            self.assertEqual(res["diagnosis_status"], "confirmed_local")
            self.assertEqual(res["disease_name"], "Tomato_Early_blight")
            # Symptoms and advisory must remain functional
            self.assertTrue(len(res.get("symptoms", "")) > 0)
            self.assertIsNotNone(res.get("advisor"))

    # --- Test 15: Gemini fallback healthy behavior ---
    def test_15_gemini_fallback_healthy_behavior(self):
        report = generate_fallback_extension_officer_report(
            crop="Tomato",
            disease="Healthy",
            confidence=0.95
        )

        obs = report.get("observed_symptoms", "").lower()
        self.assertNotIn("necrotic", obs)
        self.assertNotIn("blight", obs)
        self.assertIn("healthy", obs)

        chem = report.get("pro_chemical_plan", {})
        chem_str = str(chem).lower()
        self.assertIn("no chemical fungicides", chem.get("targeted_solution", "").lower())
        self.assertNotIn("mancozeb", chem_str)
        self.assertNotIn("copper", chem_str)
        self.assertNotIn("carbendazim", chem_str)

    # --- Test 16: Gemini fallback uncertain behavior ---
    def test_16_gemini_fallback_uncertain_behavior(self):
        report = generate_fallback_extension_officer_report(
            crop="Tomato",
            disease="Unrecognized or uncertain",
            confidence=0.0
        )

        chem = report.get("pro_chemical_plan", {})
        chem_str = str(chem).lower()
        self.assertIn("no chemical fungicides", chem.get("targeted_solution", "").lower())
        self.assertNotIn("mancozeb", chem_str)
        self.assertNotIn("copper", chem_str)
        self.assertNotIn("carbendazim", chem_str)

        # Check that candidates have 0.0 confidence, not inflated to 75%
        for cand in report.get("differential_candidates", []):
            self.assertEqual(cand["confidence"], 0.0)


if __name__ == "__main__":
    unittest.main()
