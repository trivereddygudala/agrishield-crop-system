from datetime import timezone
import os
import pytest
import asyncio
from httpx import ASGITransport, AsyncClient
from backend.app.main import app
from backend.app.db.mongodb import get_database
from backend.tests.mock_db import MockDatabase

# Setup Mock database configuration
database_for_testing = MockDatabase()

# Override the database dependency
async def override_get_database():
    return database_for_testing

app.dependency_overrides[get_database] = override_get_database

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def clean_database():
    app.dependency_overrides[get_database] = override_get_database
    # Clean database before and after each test
    await database_for_testing.users.delete_many({})
    await database_for_testing.predictions.delete_many({})
    yield
    await database_for_testing.users.delete_many({})
    await database_for_testing.predictions.delete_many({})

@pytest.mark.anyio
async def test_auth_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register user
        register_payload = {
            "name": "Farmer John",
            "email": "john@farmer.com",
            "password": "FarmerPassword123!",
            "role": "farmer"
        }
        res = await ac.post("/api/auth/register", json=register_payload)
        assert res.status_code == 201
        res_data = res.json()
        assert res_data["name"] == "Farmer John"
        assert res_data["email"] == "john@farmer.com"
        assert "password_hash" not in res_data
        assert "id" in res_data

        # 2. Register same user again (should fail)
        res_duplicate = await ac.post("/api/auth/register", json=register_payload)
        assert res_duplicate.status_code == 400

        # 3. Login
        login_payload = {
            "email": "john@farmer.com",
            "password": "FarmerPassword123!"
        }
        res_login = await ac.post("/api/auth/login", json=login_payload)
        assert res_login.status_code == 200
        token_data = res_login.json()
        assert "access_token" in token_data
        token = token_data["access_token"]

        # 4. Access profile (authenticated)
        headers = {"Authorization": f"Bearer {token}"}
        res_profile = await ac.get("/api/auth/profile", headers=headers)
        assert res_profile.status_code == 200
        profile_data = res_profile.json()
        assert profile_data["email"] == "john@farmer.com"

        # 5. Access profile (unauthenticated - should fail)
        res_profile_fail = await ac.get("/api/auth/profile")
        assert res_profile_fail.status_code == 401

@pytest.mark.anyio
async def test_upload_and_prediction(monkeypatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a user to get token
        register_payload = {
            "name": "Farmer Joe",
            "email": "joe@farmer.com",
            "password": "JoePassword123!",
            "role": "farmer"
        }
        await ac.post("/api/auth/register", json=register_payload)
        login_res = await ac.post("/api/auth/login", json={
            "email": "joe@farmer.com",
            "password": "JoePassword123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Mock predict_crop_disease to return a high-confidence result
        def mock_predict_high(image_path: str, explainer_type: str = "gradcam++"):
            return {
                "crop_name": "Tomato",
                "disease_name": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
                "confidence": 0.942,
                "prediction_status": "diseased",
                "prediction_time_ms": 120.5,
                "gradcam_base64": "data:image/jpeg;base64,mockedbase64string",
                "top_predictions": [
                    {
                        "class_name": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
                        "crop_name": "Tomato",
                        "disease_name": "Tomato Yellow Leaf Curl Virus",
                        "confidence": 0.942
                    },
                    {
                        "class_name": "Tomato___Bacterial_spot",
                        "crop_name": "Tomato",
                        "disease_name": "Bacterial spot",
                        "confidence": 0.05
                    },
                    {
                        "class_name": "Tomato___healthy",
                        "crop_name": "Tomato",
                        "disease_name": "healthy",
                        "confidence": 0.008
                    }
                ]
            }
        monkeypatch.setattr("backend.app.routers.predict.predict_crop_disease", mock_predict_high)

        # Create dummy image file using Pillow
        from PIL import Image
        dummy_file_path = "test_leaf.png"
        img = Image.new("RGB", (224, 224), color="green")
        img.save(dummy_file_path, "PNG")


        try:
            # 1. Upload the image
            with open(dummy_file_path, "rb") as img:
                res_upload = await ac.post(
                    "/api/upload", 
                    files={"file": (dummy_file_path, img, "image/png")},
                    headers=headers
                )
            assert res_upload.status_code == 201
            image_path = res_upload.json()["image_path"]
            assert image_path.startswith("uploads/")

            # 2. Run prediction
            res_predict = await ac.post(
                "/api/predict",
                json={"image_path": image_path},
                headers=headers
            )
            assert res_predict.status_code == 200
            pred_data = res_predict.json()
            assert "crop_name" in pred_data
            assert "disease_name" in pred_data
            assert "confidence" in pred_data
            assert "prediction_status" in pred_data
            assert "top_predictions" in pred_data
            assert "prediction_time_ms" in pred_data
            assert "gradcam_base64" in pred_data
            prediction_id = pred_data["id"]

            # 3. Check history
            res_history = await ac.get("/api/history", headers=headers)
            assert res_history.status_code == 200
            history_data = res_history.json()
            assert history_data["total"] == 1
            assert history_data["predictions"][0]["id"] == prediction_id

            # 4. Search history
            res_search = await ac.get(f"/api/history?search={pred_data['crop_name']}", headers=headers)
            assert res_search.status_code == 200
            assert res_search.json()["total"] == 1

            # 5. Delete record
            res_delete = await ac.delete(f"/api/history/{prediction_id}", headers=headers)
            assert res_delete.status_code == 200

            # Verify deleted from history
            res_history_after = await ac.get("/api/history", headers=headers)
            assert res_history_after.json()["total"] == 0

        finally:
            if os.path.exists(dummy_file_path):
                os.remove(dummy_file_path)
            
            # Clean uploads folder from dummy images created during tests
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            if 'image_path' in locals() and image_path:
                full_saved_path = os.path.join(base_dir, image_path)
                if os.path.exists(full_saved_path):
                    os.remove(full_saved_path)

@pytest.mark.anyio
async def test_low_confidence_rejection(monkeypatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a user to get token
        register_payload = {
            "name": "Farmer Tim",
            "email": "tim@farmer.com",
            "password": "TimPassword123!",
            "role": "farmer"
        }
        await ac.post("/api/auth/register", json=register_payload)
        login_res = await ac.post("/api/auth/login", json={
            "email": "tim@farmer.com",
            "password": "TimPassword123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Mock predict_crop_disease to return confidence of 0.25 (below threshold of 0.40)
        def mock_predict_low(image_path: str, explainer_type: str = "gradcam++"):
            return {
                "crop_name": "Tomato",
                "disease_name": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
                "confidence": 0.25,
                "prediction_status": "diseased",
                "prediction_time_ms": 50.0,
                "gradcam_base64": None,
                "top_predictions": [
                    {
                        "class_name": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
                        "crop_name": "Tomato",
                        "disease_name": "Tomato Yellow Leaf Curl Virus",
                        "confidence": 0.25
                    }
                ]
            }
        monkeypatch.setattr("model.configs.config.PipelineConfig.CONFIDENCE_REJECTION_THRESHOLD", 0.40)
        monkeypatch.setattr("backend.app.routers.predict.predict_crop_disease", mock_predict_low)

        # Create dummy image to test with
        from PIL import Image
        dummy_file_path = "test_low_conf_leaf.png"
        img = Image.new("RGB", (224, 224), color="green")
        img.save(dummy_file_path, "PNG")

        try:
            with open(dummy_file_path, "rb") as img_file:
                res_upload = await ac.post(
                    "/api/upload",
                    files={"file": (dummy_file_path, img_file, "image/png")},
                    headers=headers
                )
            assert res_upload.status_code == 201
            image_path = res_upload.json()["image_path"]

            # Run prediction - should return 422
            res_predict = await ac.post(
                "/api/predict",
                json={"image_path": image_path},
                headers=headers
            )
            assert res_predict.status_code == 422
            assert "Low confidence" in res_predict.json()["detail"]

        finally:
            if os.path.exists(dummy_file_path):
                os.remove(dummy_file_path)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            if 'image_path' in locals() and image_path:
                full_saved_path = os.path.join(base_dir, image_path)
                if os.path.exists(full_saved_path):
                    os.remove(full_saved_path)

@pytest.mark.anyio
async def test_nvidia_ai_endpoints(monkeypatch):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a user to get token
        register_payload = {
            "name": "Farmer Sam",
            "email": "sam@farmer.com",
            "password": "SamPassword123!",
            "role": "farmer"
        }
        await ac.post("/api/auth/register", json=register_payload)
        login_res = await ac.post("/api/auth/login", json={
            "email": "sam@farmer.com",
            "password": "SamPassword123!"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Mock generate_farming_advice
        async def mock_generate_advice(crop_name, disease_name, confidence, **kwargs):
            return {
                "disease_explanation": "Mocked explanation.",
                "possible_causes": ["Mocked cause"],
                "severity": "Medium",
                "organic_treatment": "Mocked organic.",
                "chemical_treatment": "Mocked chemical.",
                "prevention_methods": ["Mocked prevention"],
                "best_farming_practices": ["Mocked practices"],
                "farmer_friendly_advice": "Mocked advice."
            }
        monkeypatch.setattr("backend.app.services.nvidia_service.nvidia_service.generate_farming_advice", mock_generate_advice)

        # Mock test_connection
        async def mock_test_conn():
            return {
                "status": "connected",
                "model": "meta/llama-3.1-8b-instruct",
                "response": "pong"
            }
        monkeypatch.setattr("backend.app.routers.ai.nvidia_service.test_connection", mock_test_conn)

        # 1. Test /api/ai/test
        res_test = await ac.get("/api/ai/test")
        assert res_test.status_code == 200
        assert res_test.json()["status"] == "connected"

        # 2. Test /api/ai/farming-assistant (with auth headers)
        assistant_payload = {
            "crop_name": "Tomato",
            "disease_name": "Tomato___Early_blight",
            "confidence": 0.95
        }
        res_assistant = await ac.post(
            "/api/ai/farming-assistant", 
            json=assistant_payload, 
            headers=headers
        )
        assert res_assistant.status_code == 200
        data = res_assistant.json()
        assert data["disease_explanation"] == "Mocked explanation."
        assert data["severity"] == "Medium"

        # 3. Test /api/ai/farming-assistant (unauthorized should fail)
        res_fail = await ac.post("/api/ai/farming-assistant", json=assistant_payload)
        assert res_fail.status_code == 401

