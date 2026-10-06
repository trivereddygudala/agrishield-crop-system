"""
B31 Test Suite — Image Suitability Gating & Crop-Filter OOD Rejection.
Covers the 15 mandatory verification tests defined in B31 specification:
1. Valid leaf accepted (not image_unsuitable)
2. Blank image rejected (diagnosis_status = image_unsuitable)
3. Clearly non-plant image rejected (image_unsuitable, no disease)
4. Extremely blurry image rejected (image_unsuitable)
5. Extremely dark / overexposed image rejected (image_unsuitable)
6. Diseased / dry leaf is not falsely rejected (chlorotic/necrotic foliage accepted)
7. Crop filter normal evidence (sufficient probability mass ranks normally)
8. Crop filter tiny probability mass (low mass prevents OOD bypass -> OOD/uncertain)
9. Crop filter strong probability mass (high mass succeeds normally)
10. Confidence is never artificially raised (0.25 remains 0.25, never 0.70)
11. Existing B30 taxonomy safety preserved (botanical/pest/weed rejected)
12. Gemini is not called for unsuitable image (gate saves secondary call)
13. Valid low-confidence image handled as uncertain without inflation
14. Healthy valid leaf preserves healthy behavior
15. Existing prediction regression (end-to-end inference passes)
"""

import os
import sys
import tempfile
import unittest
import numpy as np
import cv2
from PIL import Image
from unittest.mock import MagicMock, patch, AsyncMock

# Ensure project root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.services.image_preprocessor import evaluate_image_suitability
from model.predict_pytorch import predict_crop_disease, is_plant_image
from backend.services.pytorch.taxonomy import get_taxonomy_manager


def get_mock_db():
    mock_db = MagicMock()
    mock_db.predictions = MagicMock()
    mock_db.predictions.insert_one = AsyncMock(return_value=MagicMock(inserted_id="64b0f9c2d1f7c23456789abc"))
    mock_db.notification_settings = MagicMock()
    mock_db.notification_settings.find_one = AsyncMock(return_value=None)
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


class TestB31ImageSuitabilityAndOOD(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.taxonomy = get_taxonomy_manager()
        cls.tmp_dir = tempfile.mkdtemp()

        # Helper to save test images
        def save_img(arr, name):
            p = os.path.join(cls.tmp_dir, name)
            cv2.imwrite(p, arr)
            return p

        # 1. Valid healthy green leaf
        green_leaf = np.zeros((300, 300, 3), dtype=np.uint8)
        green_leaf[50:250, 50:250] = [34, 139, 34] # BGR Forest Green
        cls.green_leaf_path = save_img(green_leaf, "green_leaf.jpg")

        # 2. Valid diseased brown/chlorotic leaf
        brown_leaf = np.zeros((300, 300, 3), dtype=np.uint8)
        brown_leaf[50:250, 50:250] = [19, 69, 139] # BGR Saddle Brown / Necrotic
        cls.brown_leaf_path = save_img(brown_leaf, "brown_leaf.jpg")

        # 3. Pure blank white
        blank_white = np.ones((300, 300, 3), dtype=np.uint8) * 255
        cls.blank_white_path = save_img(blank_white, "blank_white.jpg")

        # 4. Pure blank black
        blank_black = np.zeros((300, 300, 3), dtype=np.uint8)
        cls.blank_black_path = save_img(blank_black, "blank_black.jpg")

        # 5. Non-plant image (metallic blue / red synthetic block)
        non_plant = np.zeros((300, 300, 3), dtype=np.uint8)
        non_plant[50:250, 50:250] = [220, 20, 20] # BGR Blue/Cyan object
        cls.non_plant_path = save_img(non_plant, "non_plant.jpg")

        # 6. Severely blurry image
        blurred = cv2.GaussianBlur(np.random.randint(40, 200, (300, 300, 3), dtype=np.uint8), (71, 71), 0)
        cls.blurred_path = save_img(blurred, "blurred.jpg")

        # 7. Extremely dark image
        dark_img = np.ones((300, 300, 3), dtype=np.uint8) * 5
        cls.dark_path = save_img(dark_img, "dark.jpg")

        # 8. Severely overexposed image
        overexposed = np.ones((300, 300, 3), dtype=np.uint8) * 252
        cls.overexposed_path = save_img(overexposed, "overexposed.jpg")

    @classmethod
    def tearDownClass(cls):
        import shutil
        try:
            shutil.rmtree(cls.tmp_dir)
        except Exception:
            pass

    # --- Test 1: Valid Leaf Accepted ---
    def test_01_valid_leaf_accepted(self):
        res = evaluate_image_suitability(self.green_leaf_path)
        self.assertTrue(res["is_suitable"])
        self.assertEqual(res["reason"], "Image passed suitability criteria")

        # Through predict_crop_disease
        pred = predict_crop_disease(self.green_leaf_path, explainer_type=None)
        self.assertNotEqual(pred.get("diagnosis_status"), "image_unsuitable")

    # --- Test 2: Blank Image Rejected ---
    def test_02_blank_image_rejected(self):
        res_w = evaluate_image_suitability(self.blank_white_path)
        self.assertFalse(res_w["is_suitable"])

        res_b = evaluate_image_suitability(self.blank_black_path)
        self.assertFalse(res_b["is_suitable"])

        pred = predict_crop_disease(self.blank_white_path, explainer_type=None)
        self.assertEqual(pred.get("diagnosis_status"), "image_unsuitable")
        self.assertEqual(pred.get("confidence"), 0.0)
        self.assertEqual(pred.get("prediction_status"), "unsupported")

    # --- Test 3: Clearly Non-Plant Image Rejected ---
    def test_03_clearly_non_plant_image_rejected(self):
        res = evaluate_image_suitability(self.non_plant_path)
        self.assertFalse(res["is_suitable"])
        self.assertIn("No agricultural plant or crop leaf foliage detected", res["reason"])

        pred = predict_crop_disease(self.non_plant_path, explainer_type=None)
        self.assertEqual(pred.get("diagnosis_status"), "image_unsuitable")
        self.assertEqual(pred.get("disease_name"), "Image Unsuitable for Analysis")

    # --- Test 4: Extremely Blurry Image Rejected ---
    def test_04_extremely_blurry_image_rejected(self):
        res = evaluate_image_suitability(self.blurred_path)
        self.assertFalse(res["is_suitable"])
        pred = predict_crop_disease(self.blurred_path, explainer_type=None)
        self.assertEqual(pred.get("diagnosis_status"), "image_unsuitable")

    # --- Test 5: Extremely Dark / Overexposed Image Rejected ---
    def test_05_extreme_exposure_rejected(self):
        res_dark = evaluate_image_suitability(self.dark_path)
        self.assertFalse(res_dark["is_suitable"])
        self.assertIn("dark or underexposed", res_dark["reason"])

        res_over = evaluate_image_suitability(self.overexposed_path)
        self.assertFalse(res_over["is_suitable"])
        self.assertIn("overexposed or washed out", res_over["reason"])

    # --- Test 6: Diseased / Dry Leaf Not Falsely Rejected ---
    def test_06_diseased_dry_leaf_not_falsely_rejected(self):
        res = evaluate_image_suitability(self.brown_leaf_path)
        self.assertTrue(res["is_suitable"], f"Diseased brown leaf falsely rejected: {res['reason']}")
        pred = predict_crop_disease(self.brown_leaf_path, explainer_type=None)
        self.assertNotEqual(pred.get("diagnosis_status"), "image_unsuitable")

    # --- Test 7: Crop Filter Normal Evidence ---
    def test_07_crop_filter_normal_evidence(self):
        # When model has sufficient mass for the crop filter, ranking operates normally
        mock_probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
        tomato_indices = [i for i, c in enumerate(self.taxonomy.classes) if self.taxonomy.matches_crop_filter(c, "Tomato")]
        self.assertGreater(len(tomato_indices), 0)
        # Allocate 85% probability mass on dominant Tomato class
        mock_probs[tomato_indices[0]] = 0.85

        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            mock_loader.predict_image.return_value = {"all_probabilities": mock_probs}
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            res = predict_crop_disease(self.green_leaf_path, explainer_type=None, crop_filter="Tomato")
            self.assertEqual(res["crop_name"], "Tomato")
            self.assertNotEqual(res.get("diagnosis_status"), "uncertain")
            self.assertEqual(res.get("diagnosis_status"), "confirmed_local")
            self.assertGreater(res["confidence"], 0.70)

    # --- Test 8: Crop Filter Tiny Probability Mass Triggers OOD ---
    def test_08_crop_filter_tiny_probability_mass_triggers_ood(self):
        # Simulate negligible probability mass for Tomato (0.005 total mass), but non-zero
        mock_probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
        # Set 99% mass on an unrelated class (e.g. Apple___Apple_scab at index 0)
        mock_probs[0] = 0.99
        # Set 0.005 total mass on a Tomato class (0.5% mass, well below 3.5% threshold)
        tomato_indices = [i for i, c in enumerate(self.taxonomy.classes) if self.taxonomy.matches_crop_filter(c, "Tomato")]
        self.assertGreater(len(tomato_indices), 0)
        mock_probs[tomato_indices[0]] = 0.005

        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            mock_loader.predict_image.return_value = {"all_probabilities": mock_probs}
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            res = predict_crop_disease(self.green_leaf_path, explainer_type=None, crop_filter="Tomato")
            # Must NOT renormalize 0.005 into 1.0 confidence! Must trigger OOD / uncertain
            self.assertEqual(res.get("prediction_status"), "unsupported")
            self.assertEqual(res.get("diagnosis_status"), "uncertain")
            self.assertEqual(res.get("confidence"), 0.0)

    # --- Test 9: Crop Filter Strong Probability Mass ---
    def test_09_crop_filter_strong_probability_mass(self):
        mock_probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
        rice_indices = [i for i, c in enumerate(self.taxonomy.classes) if self.taxonomy.matches_crop_filter(c, "Rice")]
        self.assertGreater(len(rice_indices), 0)
        mock_probs[rice_indices[0]] = 0.85

        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            mock_loader.predict_image.return_value = {"all_probabilities": mock_probs}
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            res = predict_crop_disease(self.green_leaf_path, explainer_type=None, crop_filter="Rice")
            self.assertEqual(res["crop_name"], "Rice")
            self.assertNotEqual(res.get("diagnosis_status"), "uncertain")
            self.assertEqual(res.get("diagnosis_status"), "confirmed_local")

    # --- Test 10: Confidence Never Artificially Raised to 0.70 ---
    def test_10_confidence_never_artificially_raised(self):
        # Test endpoint logic: when confidence is 0.25 with user_crop_filter, it must NOT be boosted to 0.70
        from backend.app.routers.farmer.predict import predict_pytorch_endpoint, PredictRequest
        import asyncio

        req = PredictRequest(
            image_path=self.green_leaf_path,
            crop_filter="Tomato",
            explainer_type="gradcam++"
        )

        mock_local_res = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_Early_blight",
            "raw_label": "Tomato_Early_blight",
            "confidence": 0.25, # Weak confidence (<0.40)
            "prediction_status": "diseased",
            "diagnosis_status": "confirmed_local",
            "top_predictions": [{"class_name": "Tomato_Early_blight", "crop_name": "Tomato", "disease_name": "Early blight", "confidence": 0.25}]
        }

        mock_db = get_mock_db()

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_local_res):
            with patch("backend.app.services.gemini_vision.cross_verify_disease_with_vision", new_callable=AsyncMock, return_value=None):
                endpoint_res = asyncio.run(predict_pytorch_endpoint(
                    req,
                    current_user={"id": "64b0f9c2d1f7c23456789abc", "preferred_language": "en"},
                    db=mock_db
                ))

                # Verification: Confidence must NOT be forced to 0.70
                self.assertNotEqual(endpoint_res["confidence"], 0.70)
                self.assertEqual(endpoint_res["confidence"], 0.25)
                self.assertEqual(endpoint_res["diagnosis_status"], "uncertain")
                self.assertEqual(endpoint_res["prediction_status"], "unsupported")

    # --- Test 11: Existing B30 Taxonomy Safety Preserved ---
    def test_11_existing_b30_taxonomy_safety(self):
        self.assertFalse(self.taxonomy.is_valid_crop_candidate("Parthenium_hysterophorus"))
        self.assertFalse(self.taxonomy.is_valid_crop_candidate("Spodoptera_litura"))
        self.assertFalse(self.taxonomy.is_valid_crop_candidate("Mangifera_indica"))
        self.assertTrue(self.taxonomy.is_valid_crop_candidate("Tomato_Early_blight"))

    # --- Test 12: Gemini Not Called for Unsuitable Image ---
    def test_12_gemini_not_called_for_unsuitable_image(self):
        from backend.app.routers.farmer.predict import predict_pytorch_endpoint, PredictRequest
        import asyncio

        req = PredictRequest(
            image_path=self.blank_white_path,
            crop_filter="Tomato"
        )
        mock_db = get_mock_db()

        with patch("backend.app.services.gemini_vision.cross_verify_disease_with_vision", new_callable=AsyncMock) as mock_gemini:
            res = asyncio.run(predict_pytorch_endpoint(
                req,
                current_user={"id": "64b0f9c2d1f7c23456789abc"},
                db=mock_db
            ))

            # Gemini must NOT be called for blank/unsuitable image
            mock_gemini.assert_not_called()
            self.assertEqual(res["diagnosis_status"], "image_unsuitable")
            self.assertEqual(res["disease_name"], "Image Unsuitable for Analysis")

    # --- Test 13: Valid Low-Confidence Image Handled Safely ---
    def test_13_valid_low_confidence_image(self):
        from backend.app.routers.farmer.predict import predict_pytorch_endpoint, PredictRequest
        import asyncio

        req = PredictRequest(
            image_path=self.green_leaf_path,
            crop_filter="Tomato"
        )

        mock_pred = {
            "crop_name": "Tomato",
            "disease_name": "Tomato_Septoria_leaf_spot",
            "raw_label": "Tomato_Septoria_leaf_spot",
            "confidence": 0.32,
            "prediction_status": "diseased",
            "diagnosis_status": "confirmed_local",
            "top_predictions": [{"class_name": "Tomato_Septoria_leaf_spot", "confidence": 0.32}]
        }
        mock_db = get_mock_db()

        with patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=mock_pred):
            with patch("backend.app.services.gemini_vision.cross_verify_disease_with_vision", new_callable=AsyncMock, return_value=None):
                res = asyncio.run(predict_pytorch_endpoint(
                    req,
                    current_user={"id": "64b0f9c2d1f7c23456789abc"},
                    db=mock_db
                ))
                self.assertEqual(res["confidence"], 0.32)
                self.assertEqual(res["diagnosis_status"], "uncertain")

    # --- Test 14: Healthy Valid Leaf Preserves Healthy Behavior ---
    def test_14_healthy_valid_leaf_preserves_healthy_behavior(self):
        mock_probs = np.zeros(len(self.taxonomy.classes), dtype=np.float32)
        # Find Tomato_healthy class
        tomato_healthy_idx = self.taxonomy.classes.index("Tomato_healthy")
        mock_probs[tomato_healthy_idx] = 0.95

        with patch("model.predict_pytorch.load_resources") as mock_res:
            mock_loader = MagicMock()
            mock_loader.predict_image.return_value = {"all_probabilities": mock_probs}
            mock_res.return_value = (mock_loader, self.taxonomy.classes)

            res = predict_crop_disease(self.green_leaf_path, explainer_type=None, crop_filter="Tomato")
            self.assertEqual(res["crop_name"], "Tomato")
            self.assertEqual(res["prediction_status"], "healthy")
            self.assertIn("healthy", res["disease_name"].lower())

    # --- Test 15: Existing Prediction Regression ---
    def test_15_existing_prediction_regression(self):
        # End-to-end inference execution without errors
        res = predict_crop_disease(self.green_leaf_path, explainer_type=None)
        self.assertIn("crop_name", res)
        self.assertIn("disease_name", res)
        self.assertIn("confidence", res)
        self.assertIn("diagnosis_status", res)


if __name__ == "__main__":
    unittest.main()
