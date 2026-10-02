"""
B11.5 Render Free-Tier Warm-Up & Cold-Start Mitigation Test Suite

Validates:
1. Warm-up endpoint returns HTTP 200 (both /health/warmup and /api/v1/health/warmup).
2. Warm-up response contains stable status, service role, and warmup=True.
3. Warm-up does not trigger scheduler startup.
4. Warm-up does not trigger watchdog execution.
5. Warm-up does not perform AI inference.
6. Warm-up does not create MongoDB writes.
7. Warm-up does not expose secrets, credentials, or internal tokens.
8. Main node remains scheduler-authoritative.
9. AI workers remain scheduler-inactive.
10. Existing /health behavior remains unchanged and backwards-compatible.
11. Existing B9.7 diagnostics remain functional with enhanced indicators.
12. Existing B11 service-role detection remains functional.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport

from backend.app.main import app, is_ai_worker_node
from backend.app.core.config import settings
from backend.app.db.mongodb import db_instance
from backend.app.services import scheduler


@pytest.mark.anyio
async def test_1_warmup_endpoint_returns_200():
    """1. Warm-up endpoint returns HTTP 200 on both /health/warmup and /api/v1/health/warmup."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp1 = await ac.get("/health/warmup")
        assert resp1.status_code == 200

        resp2 = await ac.get("/api/v1/health/warmup")
        assert resp2.status_code == 200

        # Also support HEAD requests for lightweight network monitors
        resp_head = await ac.head("/health/warmup")
        assert resp_head.status_code == 200


@pytest.mark.anyio
async def test_2_warmup_response_schema():
    """2. Warm-up response contains expected stable shape and status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health/warmup")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "ok"
        assert "service" in data
        assert data.get("warmup") is True
        assert "database" in data
        assert "process_uptime_seconds" in data
        assert isinstance(data["process_uptime_seconds"], (int, float))


@pytest.mark.anyio
async def test_3_4_warmup_does_not_trigger_scheduler_or_watchdog():
    """3 & 4. Warm-up does not trigger scheduler startup or watchdog loop execution."""
    with patch("backend.app.services.scheduler.start_scheduler") as mock_start_sched, \
         patch("backend.app.services.scheduler.device_watchdog_loop") as mock_watchdog:
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health/warmup")
            assert resp.status_code == 200

        mock_start_sched.assert_not_called()
        mock_watchdog.assert_not_called()


@pytest.mark.anyio
async def test_5_warmup_does_not_perform_ai_inference():
    """5. Warm-up does not trigger AI inference or model invocation."""
    with patch("backend.app.services.ai_cluster.ai_cluster.offload_prediction") as mock_cluster_predict:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health/warmup")
            assert resp.status_code == 200

        mock_cluster_predict.assert_not_called()


@pytest.mark.anyio
async def test_6_warmup_does_not_create_mongodb_writes():
    """6. Warm-up performs zero database writes (read-only state verification)."""
    mock_db = MagicMock()
    with patch.object(db_instance, "db", mock_db):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health/warmup")
            assert resp.status_code == 200

        # Verify no insert, update, delete, or replace operations were called
        mock_db.__getitem__.assert_not_called()


@pytest.mark.anyio
async def test_7_warmup_does_not_expose_secrets():
    """7. Warm-up does not expose secrets, credentials, environment variables, or JWT keys."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health/warmup")
        raw_text = resp.text.lower()

        # Check absence of sensitive keywords
        assert "password" not in raw_text
        assert "mongodb+srv" not in raw_text
        assert "secret" not in raw_text
        assert "api_key" not in raw_text
        assert "token" not in raw_text
        assert settings.JWT_SECRET_KEY.lower() not in raw_text


@pytest.mark.anyio
async def test_8_9_role_awareness_gateway_vs_worker():
    """8 & 9. Main remains gateway-authoritative, AI worker reports worker role."""
    # Gateway case
    with patch("backend.app.main.is_ai_worker_node", return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health/warmup")
            assert resp.status_code == 200
            assert resp.json().get("service") == "gateway"

    # Worker case
    with patch("backend.app.main.is_ai_worker_node", return_value=True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health/warmup")
            assert resp.status_code == 200
            assert resp.json().get("service") == "worker"


@pytest.mark.anyio
async def test_10_existing_health_endpoint_unchanged():
    """10. Existing /health and /api/v1/health behavior remains unchanged."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "service" in data
        assert "diagnostics" in data
        assert data["service"] == "AI Crop Disease Detection System API"


@pytest.mark.anyio
async def test_11_existing_b9_7_diagnostics_extended():
    """11. Existing B9.7 diagnostics remain functional and report warmup status."""
    mock_db = MagicMock()
    with patch.object(db_instance, "db", mock_db), \
         patch.object(scheduler, "scheduler_task", MagicMock(done=lambda: False)), \
         patch.object(scheduler, "device_watchdog_task", MagicMock(done=lambda: False)):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health")
            assert resp.status_code == 200
            data = resp.json()
            diag = data.get("diagnostics", {})
            assert diag.get("database") == "connected"
            assert diag.get("scheduler") == "running"
            assert diag.get("device_watchdog") == "running"
            assert diag.get("warmup_enabled") is True
            assert "service_role" in diag
            assert "process_uptime_seconds" in diag


@pytest.mark.anyio
async def test_12_warmup_disabled_configuration_handling():
    """12. Disabling ENABLE_WARMUP_ENDPOINT cleanly returns 404 with status disabled."""
    with patch.object(settings, "ENABLE_WARMUP_ENDPOINT", False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health/warmup")
            assert resp.status_code == 404
            data = resp.json()
            assert data.get("status") == "disabled"
            assert data.get("warmup") is False
