"""
B9.7 Production Observability, Correlation IDs & Health Diagnostics Tests
========================================================================
Test Coverage:
1. Valid incoming X-Request-ID is preserved in request state and response headers.
2. Missing X-Request-ID generates a unique request ID.
3. Invalid / oversized / malformed X-Request-ID is safely sanitized and replaced.
4. Response contains X-Request-ID header on all standard endpoints.
5. 503 database degradation response contains request_id in JSON payload and headers.
6. Generic 500 response contains request_id without exposing internals or tracebacks.
7. AI cluster dispatch propagates X-Request-ID in worker request headers.
8. Health endpoint exposes database connectivity diagnostic status.
9. Health endpoint exposes scheduler background task status.
10. Health endpoint exposes device watchdog background task status.
11. B9.2 invariants remain intact (503 status, Retry-After header, error code).
"""

import pytest
import asyncio
from unittest.mock import patch, MagicMock
from httpx import ASGITransport, AsyncClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from fastapi import APIRouter

from backend.app.main import app
from backend.app.core.exceptions import DatabaseUnavailableException
from backend.app.core.request_id_middleware import (
    sanitize_request_id,
    generate_request_id,
    _request_id_ctx_var,
    SAFE_REQUEST_ID_REGEX
)
from backend.app.db.mongodb import db_instance
from backend.app.services.ai_cluster import AIClusterDispatcher
from backend.app.services import scheduler


@pytest.mark.anyio
async def test_1_valid_incoming_request_id_preserved():
    """1. Verify valid incoming X-Request-ID is preserved and echoed in response headers."""
    custom_id = "test-client-req-12345"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health", headers={"X-Request-ID": custom_id})
        assert resp.status_code == 200
        assert resp.headers.get("X-Request-ID") == custom_id


@pytest.mark.anyio
async def test_2_missing_request_id_generates_unique():
    """2. Verify missing X-Request-ID automatically generates a unique ID matching safe pattern."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp1 = await ac.get("/health")
        resp2 = await ac.get("/health")
        
        req_id1 = resp1.headers.get("X-Request-ID")
        req_id2 = resp2.headers.get("X-Request-ID")
        
        assert req_id1 is not None
        assert req_id2 is not None
        assert req_id1 != req_id2
        assert SAFE_REQUEST_ID_REGEX.match(req_id1)
        assert SAFE_REQUEST_ID_REGEX.match(req_id2)
        assert req_id1.startswith("req_")


def test_3_sanitization_rules():
    """3. Verify dangerous, oversized, or malformed request IDs are rejected."""
    # Control character / CRLF injection attempts
    assert sanitize_request_id("injected\r\nHeader: bad") is None
    assert sanitize_request_id("bad\nheader") is None
    
    # Too short (< 4 chars)
    assert sanitize_request_id("abc") is None
    
    # Oversized (> 64 chars)
    assert sanitize_request_id("a" * 65) is None
    
    # Valid 64 chars
    assert sanitize_request_id("a" * 64) == "a" * 64
    
    # Special characters not allowed
    assert sanitize_request_id("req<script>") is None
    assert sanitize_request_id("req; DROP TABLE") is None
    
    # Valid alphanumeric with dash and underscore
    assert sanitize_request_id("req_1234-abcd_EFGH") == "req_1234-abcd_EFGH"


@pytest.mark.anyio
async def test_3b_invalid_incoming_request_id_replaced():
    """3b. Verify invalid incoming X-Request-ID is safely replaced with a valid generated ID."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health", headers={"X-Request-ID": "bad\r\ninjection"})
        assert resp.status_code == 200
        header_val = resp.headers.get("X-Request-ID")
        assert header_val is not None
        assert "bad" not in header_val
        assert header_val.startswith("req_")


@pytest.mark.anyio
async def test_4_all_endpoints_contain_request_id_header():
    """4. Verify standard endpoints return X-Request-ID header."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/health")
        assert "X-Request-ID" in resp.headers


@pytest.mark.anyio
async def test_5_database_503_contains_request_id():
    """5. Verify DatabaseUnavailableException returns 503 with request_id in body and header."""
    test_router = APIRouter(prefix="/test-b9-7")

    @test_router.get("/trigger-db-503")
    async def trigger_503():
        raise DatabaseUnavailableException("Simulated Atlas DB disconnection")

    app.include_router(test_router)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/test-b9-7/trigger-db-503", headers={"X-Request-ID": "db-outage-probe-99"})
        assert resp.status_code == 503
        assert resp.headers.get("Retry-After") == "5"
        assert resp.headers.get("X-Request-ID") == "db-outage-probe-99"
        
        data = resp.json()
        assert data.get("status") == "error"
        assert data.get("code") == "DATABASE_UNAVAILABLE"
        assert data.get("request_id") == "db-outage-probe-99"
        assert "Database service is temporarily unavailable" in data.get("detail", "")


@pytest.mark.anyio
async def test_6_generic_500_contains_request_id_safely():
    """6. Verify generic 500 error returns request_id without exposing internals or tracebacks."""
    test_router = APIRouter(prefix="/test-b9-7")

    @test_router.get("/trigger-500")
    async def trigger_500():
        # Raise unexpected internal error
        raise RuntimeError("SecretDatabaseKey_XYZ internal state corrupted")

    app.include_router(test_router)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/test-b9-7/trigger-500", headers={"X-Request-ID": "crash-probe-001"})
        assert resp.status_code == 500
        assert resp.headers.get("X-Request-ID") == "crash-probe-001"
        
        data = resp.json()
        assert data.get("status") == "error"
        assert data.get("code") == "INTERNAL_SERVER_ERROR"
        assert data.get("request_id") == "crash-probe-001"
        # Verify no secret or internal message leaked in response body
        assert "SecretDatabaseKey" not in data.get("detail", "")
        assert "traceback" not in data


@pytest.mark.anyio
async def test_7_ai_cluster_propagates_request_id():
    """7. Verify AI cluster offload_prediction passes X-Request-ID to worker."""
    dispatcher = AIClusterDispatcher()
    
    # Mock settings and workers
    with patch("backend.app.services.ai_cluster.settings") as mock_settings,          patch.object(dispatcher, "get_worker_nodes", return_value=["https://mock-worker-1.internal"]),          patch("backend.app.services.ai_cluster.get_worker_internal_secret", return_value="mock_worker_secret"):
        
        mock_settings.IS_PREDICTION_WORKER = False
        captured_headers = {}

        class MockAsyncClient:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def post(self, url, files=None, data=None, headers=None):
                captured_headers.update(headers or {})
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = {"success": True, "result": {"disease": "Healthy"}}
                return mock_resp

        with patch("backend.app.services.ai_cluster.httpx.AsyncClient", MockAsyncClient):
            # Set context request ID
            token = _request_id_ctx_var.set("trace-ai-scan-9988")
            try:
                res = await dispatcher.offload_prediction(b"fake_image_bytes")
                assert res is not None
                assert captured_headers.get("X-Worker-Key") == "mock_worker_secret"
                assert captured_headers.get("X-Request-ID") == "trace-ai-scan-9988"
            finally:
                _request_id_ctx_var.reset(token)


@pytest.mark.anyio
async def test_8_9_10_health_endpoint_diagnostics():
    """8, 9, 10. Verify /health returns diagnostic status for database, scheduler, and device_watchdog."""
    # Test with db connected
    mock_db = MagicMock()
    with patch.object(db_instance, "db", mock_db),          patch.object(scheduler, "scheduler_task", MagicMock(done=lambda: False)),          patch.object(scheduler, "device_watchdog_task", MagicMock(done=lambda: False)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("status") == "healthy"
            diagnostics = data.get("diagnostics", {})
            assert diagnostics.get("database") == "connected"
            assert diagnostics.get("scheduler") == "running"
            assert diagnostics.get("device_watchdog") == "running"

    # Test with db disconnected & inactive tasks
    with patch.object(db_instance, "db", None),          patch.object(scheduler, "scheduler_task", None),          patch.object(scheduler, "device_watchdog_task", None):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health")
            data = resp.json()
            assert data.get("status") == "degraded"
            diagnostics = data.get("diagnostics", {})
            assert diagnostics.get("database") == "disconnected"
            assert diagnostics.get("scheduler") == "inactive"
            assert diagnostics.get("device_watchdog") == "inactive"


@pytest.mark.anyio
async def test_11_b9_2_pymongo_error_preserves_semantics():
    """11. Verify PyMongoError preserves B9.2 503 behavior while including request_id."""
    test_router = APIRouter(prefix="/test-b9-7")

    @test_router.get("/trigger-pymongo-error")
    async def trigger_pymongo():
        raise ServerSelectionTimeoutError("No replica set members found")

    app.include_router(test_router)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/test-b9-7/trigger-pymongo-error", headers={"X-Request-ID": "pymongo-outage-01"})
        assert resp.status_code == 503
        assert resp.headers.get("Retry-After") == "5"
        assert resp.headers.get("X-Request-ID") == "pymongo-outage-01"
        data = resp.json()
        assert data.get("code") == "DATABASE_UNAVAILABLE"
        assert data.get("request_id") == "pymongo-outage-01"
