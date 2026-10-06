"""
B33 Test Suite — AI Safety, Security & Backend Hardening.
Covers all 7 confirmed B33 safety/security fixes:
- B33-1: Agrochemical scan false identification / dosage prevention
- B33-2: Gemini OOD secondary assessment taxonomy gating
- B33-3: Batch field scan safety for corrupted/unsuitable samples
- B33-4: Elimination of hardcoded remote MongoDB credentials
- B33-5: Internal worker endpoint authorization restriction (reject normal user JWTs)
- B33-6: Plant identification fallback removal (no fabricated 78.5% confidence)
- B33-7: Deprecated datetime.utcnow() cleanup to timezone-aware UTC
"""

import os
import sys
import unittest
import asyncio
import tempfile
import subprocess
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import HTTPException

# Ensure project root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.routers.farmer.agrochemical import agrochemical_scan_endpoint
from backend.app.routers.farmer.predict import (
    predict_pytorch_endpoint,
    PredictRequest,
    identify_plant_endpoint,
    verify_worker_internal_auth,
    predict_batch_endpoint,
    PredictBatchRequest,
)
from backend.app.core.config import Settings
from backend.app.routers.farmer.market import get_msp_benchmarks
from backend.app.routers.common.iot import get_timeframe_bounds


class TestB33SafetyFixes(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.mock_user = {
            "id": "test_farmer_123",
            "name": "Ramesh Patel",
            "phone": "9876543210",
            "role": "farmer"
        }
        self.mock_db = MagicMock()
        self.mock_db.predictions = MagicMock()
        self.mock_db.predictions.insert_one = AsyncMock(return_value=MagicMock(inserted_id="obj_123"))
        self.mock_db.__getitem__ = MagicMock(return_value=self.mock_db.predictions)

    # -------------------------------------------------------------------------
    # B33-1: Agrochemical Scan Safety
    # -------------------------------------------------------------------------
    async def test_b33_1_unverified_agrochemical_scan_safety(self):
        """Unverified/unreadable agrochemical scan must return failure with zero dosage."""
        unverified_detector_res = {
            "success": False,
            "product_identified": False,
            "is_agrochemical": False,
            "confidence": 0.0,
            "extracted_text": "unreadable label blur"
        }

        req = PredictRequest(
            image_path="test_blur.jpg",
            crop_filter="Tomato"
        )

        with patch("backend.app.services.image_resolver.resolve_image_path", return_value="C:/tmp/test_blur.jpg"), \
             patch("backend.app.services.agrochemical_detector.detect_agrochemical", return_value=unverified_detector_res):
            result = await agrochemical_scan_endpoint(
                req=req,
                current_user=self.mock_user,
                db=self.mock_db
            )

        self.assertFalse(result["success"])
        self.assertFalse(result["product_identified"])
        self.assertFalse(result["is_agrochemical"])
        self.assertEqual(result["confidence"], 0.0)
        self.assertIsNone(result["recommended_dosage"])
        self.assertIsNone(result["mixing_ratio"])
        self.assertIsNone(result["spray_interval"])
        self.assertIsNone(result["active_ingredients"])
        self.assertIn("could not be verified", result["message"].lower())

    async def test_b33_1_verified_agrochemical_scan_success(self):
        """Verified agrochemical scan returns legitimate product details."""
        verified_detector_res = {
            "success": True,
            "product_identified": True,
            "is_agrochemical": True,
            "confidence": 0.94,
            "product_name": "Chlorpyrifos 20% EC",
            "brand": "Dursban",
            "category": "Insecticide",
            "product_type": "Synthetic Organophosphate",
            "active_ingredients": "Chlorpyrifos 20%",
            "formulation": "Emulsifiable Concentrate",
            "target_crops": ["Paddy", "Cotton"],
            "target_diseases": [],
            "target_pests": ["Stem Borer"],
            "recommended_dosage": "2.5 mL per Litre",
            "mixing_ratio": "50 mL per 20L spray tank",
            "spray_interval": "14 days",
            "toxicity_class": "Class II (Moderately Hazardous)",
            "hazard_level": "Warning",
            "antidote": "Atropine sulphate",
            "protective_equipment": ["Gloves", "Mask"],
            "storage": "Store cool and dry",
            "disposal": "Incinerate",
            "extracted_text": "Dursban Chlorpyrifos 20% EC",
            "info": {
                "product_name": "Chlorpyrifos 20% EC",
                "brand": "Dursban",
                "category": "Insecticide",
                "product_type": "Synthetic Organophosphate",
                "active_ingredients": "Chlorpyrifos 20%",
                "formulation": "Emulsifiable Concentrate",
                "target_crops": ["Paddy", "Cotton"],
                "target_diseases": [],
                "target_pests": ["Stem Borer"],
                "recommended_dosage": "2.5 mL per Litre",
                "mixing_ratio": "50 mL per 20L spray tank",
                "spray_interval": "14 days",
            }
        }

        req = PredictRequest(
            image_path="dursban.jpg",
            crop_filter="Rice"
        )

        with patch("backend.app.services.image_resolver.resolve_image_path", return_value="C:/tmp/dursban.jpg"), \
             patch("backend.app.services.agrochemical_detector.detect_agrochemical", return_value=verified_detector_res):
            result = await agrochemical_scan_endpoint(
                req=req,
                current_user=self.mock_user,
                db=self.mock_db
            )

        self.assertTrue(result["success"])
        self.assertTrue(result["product_identified"])
        self.assertTrue(result["is_agrochemical"])
        self.assertEqual(result["product_name"], "Chlorpyrifos 20% EC")
        self.assertEqual(result["recommended_dosage"], "2.5 mL per Litre")

    # -------------------------------------------------------------------------
    # B33-2: Gemini OOD Taxonomy Safety
    # -------------------------------------------------------------------------
    async def test_b33_2_gemini_unsupported_candidate_preserves_ood(self):
        """When local model detects OOD and Gemini returns an unsupported taxonomy candidate, retain OOD and zero chemicals."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
            tf.write(b"\xff\xd8\xff\xe0" + b"\x00" * 2048 + b"\xff\xd9")
            temp_img = tf.name

        try:
            req = PredictRequest(
                image_path=os.path.basename(temp_img),
                crop_filter="Tomato"
            )

            # Local prediction detects OOD / non-crop candidate
            local_pred = {
                "raw_label": "OOD",
                "crop_name": "Wild Flora",
                "disease_name": "Unrecognized or uncertain",
                "confidence": 0.12,
                "prediction_status": "unsupported",
                "diagnosis_status": "uncertain",
                "top_predictions": [{"class_name": "OOD", "confidence": 0.12}]
            }

            # Gemini attempts to diagnose an unsupported non-taxonomy condition
            gemini_opinion = {
                "crop_name": "Tomato",
                "disease_name": "Oak Wilt Fungal Infection",  # Oak wilt does not exist on Tomato taxonomy
                "confidence": 0.88,
                "is_healthy": False,
                "severity": "High",
                "diagnostic_reasoning": "Gemini saw severe leaf necrosis resembling oak wilt.",
                "chemical_remedies": ["Apply Propiconazole fungicide spray @ 2g/L"]
            }

            with patch("backend.app.routers.farmer.predict.resolve_image_path", return_value=temp_img), \
                 patch("backend.app.services.image_preprocessor.evaluate_image_suitability", return_value={"is_suitable": True, "metrics": {}}), \
                 patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=local_pred), \
                 patch("backend.app.services.ai_cluster.ai_cluster.offload_prediction", new_callable=AsyncMock, return_value=local_pred), \
                 patch("backend.app.services.gemini_vision.cross_verify_disease_with_vision", new_callable=AsyncMock, return_value=gemini_opinion):

                result = await predict_pytorch_endpoint(
                    req=req,
                    current_user=self.mock_user,
                    db=self.mock_db
                )

            # Assert OOD / uncertain state was preserved
            self.assertEqual(result["diagnosis_status"], "uncertain")
            self.assertEqual(result["prediction_status"], "unsupported")
            self.assertTrue(result["requires_secondary_review"])
            chem = str(result.get("chemical_treatment", "")).lower()
            self.assertNotIn("propiconazole", chem)
            self.assertTrue("none" in chem or result.get("chemical_treatment") is None)
            self.assertFalse(result.get("prescription_calendar"))
            self.assertEqual(result["confidence"], 0.0)
        finally:
            if os.path.exists(temp_img):
                os.remove(temp_img)

    async def test_b33_2_gemini_valid_candidate_accepted(self):
        """When local model detects OOD but Gemini identifies an authentic supported crop disease, allow provisional secondary assessment."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
            tf.write(b"\xff\xd8\xff\xe0" + b"\x00" * 2048 + b"\xff\xd9")
            temp_img = tf.name

        try:
            req = PredictRequest(
                image_path=os.path.basename(temp_img),
                crop_filter="Tomato"
            )

            local_pred = {
                "raw_label": "OOD",
                "crop_name": "Unknown",
                "disease_name": "Uncertain",
                "confidence": 0.20,
                "prediction_status": "unsupported",
                "diagnosis_status": "uncertain"
            }

            # Authentic supported disease in Tomato taxonomy
            gemini_opinion = {
                "crop_name": "Tomato",
                "disease_name": "Early Blight",
                "confidence": 0.89,
                "is_healthy": False,
                "severity": "Moderate",
                "diagnostic_reasoning": "Concentric rings indicative of Alternaria solani.",
                "chemical_remedies": ["Mancozeb 75 WP @ 2.5g/L"],
                "organic_remedies": ["Neem cake extract"]
            }

            with patch("backend.app.routers.farmer.predict.resolve_image_path", return_value=temp_img), \
                 patch("backend.app.services.image_preprocessor.evaluate_image_suitability", return_value={"is_suitable": True, "metrics": {}}), \
                 patch("backend.app.routers.farmer.predict.predict_crop_disease", return_value=local_pred), \
                 patch("backend.app.services.ai_cluster.ai_cluster.offload_prediction", new_callable=AsyncMock, return_value=local_pred), \
                 patch("backend.app.services.gemini_vision.cross_verify_disease_with_vision", new_callable=AsyncMock, return_value=gemini_opinion):

                result = await predict_pytorch_endpoint(
                    req=req,
                    current_user=self.mock_user,
                    db=self.mock_db
                )

            self.assertEqual(result["diagnosis_status"], "provisional_secondary_assessment")
            self.assertEqual(result["crop_name"], "Tomato")
            self.assertEqual(result["disease_name"], "Early Blight")
            self.assertFalse(result["requires_secondary_review"])
        finally:
            if os.path.exists(temp_img):
                os.remove(temp_img)

    # -------------------------------------------------------------------------
    # B33-3: Batch Field Scan Safety
    # -------------------------------------------------------------------------
    async def test_b33_3_batch_scan_unsuitable_sample_handling(self):
        """Corrupted/unsuitable sample in batch scan must not be classified as diseased or count in infection denominator."""
        # 10 samples total: 2 unsuitable, 5 healthy, 3 diseased
        samples_spec = [
            ("s1.jpg", True, False, "Tomato___healthy"),
            ("s2.jpg", True, False, "Tomato___healthy"),
            ("s3.jpg", True, False, "Tomato___healthy"),
            ("s4.jpg", True, False, "Tomato___healthy"),
            ("s5.jpg", True, False, "Tomato___healthy"),
            ("s6.jpg", True, True, "Tomato___Early_blight"),
            ("s7.jpg", True, True, "Tomato___Early_blight"),
            ("s8.jpg", True, True, "Tomato___Early_blight"),
            ("s9.jpg", False, False, "Unsuitable_Blur"),
            ("s10.jpg", False, False, "Corrupted_File"),
        ]

        async def mock_offload(image_bytes, filename, **kwargs):
            if "s9" in filename:
                raise RuntimeError("Corrupted image stream")
            if "s6" in filename or "s7" in filename or "s8" in filename:
                return {"disease_name": "Early Blight", "crop_name": "Tomato", "confidence": 0.85, "prediction_status": "diseased"}
            return {"disease_name": "Healthy", "crop_name": "Tomato", "confidence": 0.90, "prediction_status": "healthy"}

        def mock_suitability(path):
            if "s10" in path or "s9" in path:
                return {"is_suitable": False, "reason": "Severe blur / non-leaf frame"}
            return {"is_suitable": True, "metrics": {}}

        req = PredictBatchRequest(
            image_paths=[s[0] for s in samples_spec],
            crop_filter="Tomato"
        )

        with patch("os.path.exists", return_value=True), \
             patch("builtins.open", MagicMock()), \
             patch("backend.app.services.image_preprocessor.evaluate_image_suitability", side_effect=mock_suitability), \
             patch("backend.app.services.ai_cluster.ai_cluster.offload_prediction", side_effect=mock_offload):

            batch_res = await predict_batch_endpoint(
                req=req,
                current_user=self.mock_user,
                db=self.mock_db
            )

        self.assertEqual(batch_res["total_samples"], 10)
        self.assertEqual(batch_res["analyzable_count"], 8)
        self.assertEqual(batch_res["unsuitable_count"], 2)
        self.assertEqual(batch_res["healthy_count"], 5)
        self.assertEqual(batch_res["infected_count"], 3)
        # 3 infected out of 8 analyzable = 37.5% (NOT 3 / 10 = 30.0%)
        self.assertEqual(batch_res["plot_infection_rate"], 37.5)

        # Verify unsuitable samples have 0 confidence and None treatment
        unsuitable_results = [s for s in batch_res["samples"] if s.get("is_unsuitable")]
        self.assertEqual(len(unsuitable_results), 2)
        for u in unsuitable_results:
            self.assertEqual(u["confidence"], 0.0)
            self.assertIsNone(u["treatment"])
            self.assertEqual(u["status"], "unsuitable")

    # -------------------------------------------------------------------------
    # B33-4: MongoDB Credential Removal
    # -------------------------------------------------------------------------
    def test_b33_4_no_hardcoded_mongodb_credentials(self):
        """Configuration must not expose hardcoded remote Atlas credentials."""
        # 1. Cloud environment without MONGODB_URI raises ValueError
        with patch.dict(os.environ, {"RENDER": "true", "MONGODB_URI": "", "MONGO_URI": ""}, clear=False):
            s = Settings(MONGODB_URI="", MONGO_URI="")
            with self.assertRaises(ValueError):
                _ = s.mongo_connection_url

        # 2. Local dev environment without MONGODB_URI falls back cleanly to localhost
        env_copy = os.environ.copy()
        env_copy.pop("RENDER", None)
        env_copy.pop("PORT", None)
        env_copy["MONGODB_URI"] = ""
        env_copy["MONGO_URI"] = ""
        with patch.dict(os.environ, env_copy, clear=True):
            s = Settings(MONGODB_URI="", MONGO_URI="")
            uri = s.mongo_connection_url
            self.assertEqual(uri, "mongodb://localhost:27017")
            self.assertNotIn("mongodb+srv", uri)

        # 3. Seed script without MONGODB_URI fails cleanly
        env = os.environ.copy()
        env.pop("MONGODB_URI", None)
        env.pop("MONGO_URI", None)
        res = subprocess.run(
            [sys.executable, "backend/scripts/seed_1000_bookings.py"],
            env=env,
            capture_output=True,
            text=True
        )
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("ValueError", res.stderr)

    # -------------------------------------------------------------------------
    # B33-5: Worker Endpoint Authorization
    # -------------------------------------------------------------------------
    async def test_b33_5_worker_endpoint_authorization(self):
        """Worker endpoints must deny normal user/farmer JWTs with 403 Forbidden, but accept valid worker keys."""
        mock_request = MagicMock()

        # 1. Valid worker key header -> allowed
        with patch("backend.app.core.config.settings.JWT_SECRET_KEY", "test_jwt_secret"), \
             patch("backend.app.routers.farmer.predict.hmac.compare_digest", return_value=True):
            auth_res = await verify_worker_internal_auth(
                request=mock_request,
                x_worker_key="valid_worker_shared_secret"
            )
            self.assertEqual(auth_res["type"], "worker_internal")

        # 2. Farmer JWT token -> must be DENIED (HTTP 403)
        farmer_payload = {"sub": "farmer_1", "role": "farmer", "name": "Ramesh"}
        with patch("backend.app.routers.farmer.predict.hmac.compare_digest", return_value=False), \
             patch("backend.app.core.security.decode_access_token", new_callable=AsyncMock, return_value=farmer_payload):
            with self.assertRaises(HTTPException) as ctx:
                await verify_worker_internal_auth(
                    request=mock_request,
                    authorization="Bearer mock_farmer_jwt_token"
                )
            self.assertEqual(ctx.exception.status_code, 403)

        # 3. Provider JWT token -> must be DENIED (HTTP 403)
        provider_payload = {"sub": "provider_1", "role": "provider", "name": "AgriEquip"}
        with patch("backend.app.routers.farmer.predict.hmac.compare_digest", return_value=False), \
             patch("backend.app.core.security.decode_access_token", new_callable=AsyncMock, return_value=provider_payload):
            with self.assertRaises(HTTPException) as ctx:
                await verify_worker_internal_auth(
                    request=mock_request,
                    authorization="Bearer mock_provider_jwt_token"
                )
            self.assertEqual(ctx.exception.status_code, 403)

        # 4. Admin JWT token -> allowed
        admin_payload = {"sub": "admin_1", "role": "admin", "name": "SuperAdmin"}
        with patch("backend.app.routers.farmer.predict.hmac.compare_digest", return_value=False), \
             patch("backend.app.core.security.decode_access_token", new_callable=AsyncMock, return_value=admin_payload):
            auth_res = await verify_worker_internal_auth(
                request=mock_request,
                authorization="Bearer mock_admin_jwt_token"
            )
            self.assertEqual(auth_res["type"], "admin")

    # -------------------------------------------------------------------------
    # B33-6: Plant Identification Safety
    # -------------------------------------------------------------------------
    async def test_b33_6_plant_identification_failure_safety(self):
        """Plant identification failure must return confidence 0.0 with no fabricated crop identity."""
        req = PredictRequest(
            image_path="test_plant.jpg",
            crop_filter="cotton"
        )

        unidentified_res = {
            "success": False,
            "error": "Species could not be established."
        }

        with patch("backend.app.routers.farmer.predict.resolve_image_path", return_value="C:/tmp/test_plant.jpg"), \
             patch("backend.app.services.plant_identifier.plant_identifier_service.identify_plant", new_callable=AsyncMock, return_value=unidentified_res):

            res = await identify_plant_endpoint(req=req)

        self.assertFalse(res["success"])
        self.assertEqual(res["confidence"], 0.0)
        self.assertIsNone(res["plant"])
        self.assertNotIn("botanical_triage_fallback", res.get("source", ""))
        self.assertIn("could not be confidently identified", res["message"])

    # -------------------------------------------------------------------------
    # B33-7: Datetime Cleanup
    # -------------------------------------------------------------------------
    async def test_b33_7_datetime_clean_utc(self):
        """Datetime operations must produce timezone-aware UTC values."""
        # 1. MSP benchmark returns formatted date
        msp_res = await get_msp_benchmarks()
        self.assertEqual(msp_res["status"], "success")
        self.assertIn("updated_at", msp_res)

        # 2. IoT timeframe bounds produce timezone-aware boundaries
        bounds_today = get_timeframe_bounds("today")
        start_dt, end_dt, _ = bounds_today
        self.assertIsNotNone(start_dt.tzinfo)
        self.assertIsNotNone(end_dt.tzinfo)
        self.assertEqual(start_dt.tzinfo, timezone.utc)
        self.assertEqual(end_dt.tzinfo, timezone.utc)


if __name__ == "__main__":
    unittest.main()
