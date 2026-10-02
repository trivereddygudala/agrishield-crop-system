"""
B9.2 Backend Failure Recovery & Database Degradation Tests
Validates:
- Test 1: Database unavailable dependency raises DatabaseUnavailableException when db is None
- Test 2: Global PyMongoError and DatabaseUnavailableException handlers return HTTP 503 + Retry-After: 5
- Test 3: Authentication database failure returns HTTP 503 instead of false 401
- Test 4: Invalid credentials return HTTP 401
- Test 5: Prediction history write failure preserves AI diagnosis with history_saved=False
- Test 6: Normal prediction history write success sets history_saved=True
"""

import pytest
import asyncio
from unittest.mock import patch
from bson import ObjectId
from httpx import ASGITransport, AsyncClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError, AutoReconnect
from fastapi import APIRouter

from backend.app.main import app
from backend.app.core.exceptions import DatabaseUnavailableException
from backend.app.db.mongodb import db_instance, get_database
from backend.app.core.security import create_access_token
from backend.tests.mock_db import MockDatabase
from backend.app.routers.farmer.predict import predict_pytorch_endpoint, PredictRequest

# Mount test routes for verifying global exception handlers
_b92_test_router = APIRouter()

@_b92_test_router.get("/api/test-b92-pymongo-error")
async def _faulty_pymongo_route():
    raise ServerSelectionTimeoutError("No replica set members found")

@_b92_test_router.get("/api/test-b92-db-unavailable")
async def _faulty_db_unavailable_route():
    raise DatabaseUnavailableException("Database service is temporarily unavailable.")

app.include_router(_b92_test_router)


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture
def mock_db():
    db = MockDatabase()
    db_instance.db = db
    return db


def test_database_unavailable_dependency():
    """Test 1: Verify get_database() raises DatabaseUnavailableException when db is None and cannot recover."""
    original_db = db_instance.db
    original_client = db_instance.client
    try:
        # Case A: db is None, client is set (recovery skipped, uninitialized DB)
        db_instance.db = None
        db_instance.client = "client_marker"
        with pytest.raises(DatabaseUnavailableException) as exc_info:
            get_database()
        assert "Database service is temporarily unavailable" in str(exc_info.value)

        # Case B: db is None, client is None, and AsyncIOMotorClient throws error
        db_instance.db = None
        db_instance.client = None
        with patch("backend.app.db.mongodb.AsyncIOMotorClient", side_effect=Exception("Connection refused")):
            with pytest.raises(DatabaseUnavailableException):
                get_database()
    finally:
        db_instance.db = original_db
        db_instance.client = original_client


@pytest.mark.anyio
async def test_global_pymongo_exception_handler():
    """Test 2A: Verify unhandled PyMongoError returns HTTP 503 with Retry-After: 5 and DATABASE_UNAVAILABLE."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/test-b92-pymongo-error")
        assert res.status_code == 503
        assert res.headers.get("retry-after") == "5"
        body = res.json()
        assert body["status"] == "error"
        assert body["code"] == "DATABASE_UNAVAILABLE"
        assert "temporarily unavailable" in body["detail"]
        assert body["retry_after"] == 5


@pytest.mark.anyio
async def test_global_database_unavailable_handler():
    """Test 2B: Verify DatabaseUnavailableException returns HTTP 503 with Retry-After: 5 and DATABASE_UNAVAILABLE."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/test-b92-db-unavailable")
        assert res.status_code == 503
        assert res.headers.get("retry-after") == "5"
        body = res.json()
        assert body["status"] == "error"
        assert body["code"] == "DATABASE_UNAVAILABLE"
        assert body["retry_after"] == 5


@pytest.mark.anyio
async def test_auth_database_failure_returns_503_not_401():
    """Test 3: Verify that when a valid token is provided but db.users.find_one raises PyMongoError, HTTP 503 is returned, NOT 401."""
    user_id = str(ObjectId())
    token = create_access_token(subject=user_id, role="farmer")

    class FaultyUserDB(MockDatabase):
        def __init__(self):
            super().__init__()
            async def failing_find_one(*args, **kwargs):
                raise AutoReconnect("Connection lost to replica set")
            self.users.find_one = failing_find_one

    async def get_faulty_db():
        return FaultyUserDB()

    app.dependency_overrides[get_database] = get_faulty_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 503
            assert res.headers.get("retry-after") == "5"
            body = res.json()
            assert body["code"] == "DATABASE_UNAVAILABLE"
            assert body["retry_after"] == 5
    finally:
        app.dependency_overrides.pop(get_database, None)


@pytest.mark.anyio
async def test_invalid_credentials_returns_401():
    """Test 4: Verify normal invalid credentials return HTTP 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(
            "/api/auth/profile",
            headers={"Authorization": "Bearer invalid_malformed_token"}
        )
        assert res.status_code == 401
        assert "Could not validate credentials" in res.json().get("detail", "")


@pytest.mark.anyio
async def test_prediction_history_persistence_failure_preserves_diagnosis():
    """Test 5: Verify when db.predictions.insert_one raises PyMongoError, prediction succeeds with history_saved=False."""
    user_id = str(ObjectId())
    mock_user = {"id": user_id, "_id": ObjectId(user_id), "role": "farmer", "name": "Test Farmer"}

    faulty_db = MockDatabase()
    async def faulty_insert_one(record):
        raise ServerSelectionTimeoutError("Atlas connection timed out during insert")
    faulty_db.predictions.insert_one = faulty_insert_one

    with patch("backend.app.routers.farmer.predict.predict_crop_disease") as mock_predict, \
         patch("backend.app.routers.farmer.predict.resolve_image_path", return_value="dummy_leaf.jpg"):
        mock_predict.return_value = {
            "crop_name": "Tomato",
            "disease_name": "Tomato Early Blight",
            "confidence": 0.94,
            "prediction_status": "diseased",
            "disease_severity": "Moderate",
            "symptoms": "Dark brown circular spots with concentric rings",
            "organic_treatment": "Copper fungicide spray",
            "chemical_treatment": "Mancozeb 75 WP"
        }

        req = PredictRequest(image_path="dummy_leaf.jpg", language="en")
        result = await predict_pytorch_endpoint(req=req, current_user=mock_user, db=faulty_db)

        # Validate that inference diagnosis is preserved
        assert result["crop_name"] == "Tomato"
        assert result["disease_name"] == "Tomato Early Blight"
        assert result["confidence"] == 0.94
        assert result.get("disease_severity") is not None
        # Validate graceful degradation flags
        assert result["history_saved"] is False
        assert str(result["id"]).startswith("temp-")
        assert "history_error" in result
        assert "Database service unavailable" in result["history_error"]


@pytest.mark.anyio
async def test_prediction_history_persistence_success(mock_db):
    """Test 6: Verify normal successful persistence sets history_saved=True."""
    user_id = str(ObjectId())
    mock_user = {"id": user_id, "_id": ObjectId(user_id), "role": "farmer", "name": "Test Farmer"}

    with patch("backend.app.routers.farmer.predict.predict_crop_disease") as mock_predict, \
         patch("backend.app.routers.farmer.predict.resolve_image_path", return_value="dummy_leaf.jpg"):
        mock_predict.return_value = {
            "crop_name": "Rice",
            "disease_name": "Rice Blast",
            "confidence": 0.91,
            "prediction_status": "diseased",
            "disease_severity": "High",
            "symptoms": "Spindle-shaped lesions on leaves",
            "organic_treatment": "Pseudomonas fluorescens",
            "chemical_treatment": "Tricyclazole 75 WP"
        }

        req = PredictRequest(image_path="dummy_leaf.jpg", language="en")
        result = await predict_pytorch_endpoint(req=req, current_user=mock_user, db=mock_db)

        # Validate that inference diagnosis is saved
        assert result["crop_name"] == "Rice"
        assert result["disease_name"] == "Rice Blast"
        assert result["confidence"] == 0.91
        assert result["history_saved"] is True
        assert not str(result["id"]).startswith("temp-")
