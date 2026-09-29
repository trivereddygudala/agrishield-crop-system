import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch, AsyncMock

from backend.app.main import app
from backend.app.core.security import create_access_token

@pytest.fixture
def anyio_backend():
    return 'asyncio'

# Helper tokens
@pytest.fixture
def admin_token():
    return create_access_token(subject="admin_user_01", role="admin")

@pytest.fixture
def farmer_token():
    return create_access_token(subject="farmer_user_01", role="farmer")

@pytest.fixture
def provider_token():
    return create_access_token(subject="provider_user_01", role="equipment_provider")

# ---------------------------------------------------------------------------
# 1. GET /summary security tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_diagnostics_summary_anonymous_rejected():
    """Verify anonymous callers receive 401 Unauthorized for diagnostics summary."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/system/diagnostics/summary")
        assert res.status_code == 401
        assert "Authentication required" in res.json().get("detail", "")

@pytest.mark.anyio
async def test_diagnostics_summary_farmer_rejected(farmer_token):
    """Verify farmer callers receive 403 Forbidden for diagnostics summary."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/system/diagnostics/summary",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert res.status_code == 403
        assert "Access forbidden" in res.json().get("detail", "")

@pytest.mark.anyio
async def test_diagnostics_summary_provider_rejected(provider_token):
    """Verify equipment provider callers receive 403 Forbidden for diagnostics summary."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/system/diagnostics/summary",
            headers={"Authorization": f"Bearer {provider_token}"}
        )
        assert res.status_code == 403
        assert "Access forbidden" in res.json().get("detail", "")

@pytest.mark.anyio
async def test_diagnostics_summary_admin_allowed(admin_token):
    """Verify admin callers successfully receive diagnostics summary."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/system/diagnostics/summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "OPERATIONAL"
        assert "subsystems" in data

# ---------------------------------------------------------------------------
# 2. POST /run security tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_diagnostics_run_anonymous_rejected():
    """Verify anonymous callers receive 401 Unauthorized for running diagnostics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/system/diagnostics/run")
        assert res.status_code == 401

@pytest.mark.anyio
async def test_diagnostics_run_farmer_rejected(farmer_token):
    """Verify farmer callers receive 403 Forbidden for running diagnostics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/system/diagnostics/run",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert res.status_code == 403

@pytest.mark.anyio
async def test_diagnostics_run_provider_rejected(provider_token):
    """Verify equipment provider callers receive 403 Forbidden for running diagnostics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/system/diagnostics/run",
            headers={"Authorization": f"Bearer {provider_token}"}
        )
        assert res.status_code == 403

@pytest.mark.anyio
async def test_diagnostics_run_admin_allowed_mocked(admin_token):
    """Verify admin can run diagnostics with mocked probe to protect external quotas."""
    mock_report = {
        "timestamp": "2026-09-29 17:00:00",
        "overall_status": "HEALTHY",
        "diagnostic_execution_time_ms": 12.5,
        "quota_shield": {"gemini_daily_calls": 0, "gemini_shield_active": False},
        "probes": {},
        "root_causes": [],
        "recent_traces_count": 0
    }
    with patch("backend.app.routers.common.diagnostics.run_full_diagnostics", new=AsyncMock(return_value=mock_report)):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/system/diagnostics/run",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert res.status_code == 200
            assert res.json()["overall_status"] == "HEALTHY"

# ---------------------------------------------------------------------------
# 3. GET /traces security tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_diagnostics_traces_anonymous_rejected():
    """Verify anonymous callers receive 401 Unauthorized for diagnostic traces."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/system/diagnostics/traces")
        assert res.status_code == 401

@pytest.mark.anyio
async def test_diagnostics_traces_farmer_rejected(farmer_token):
    """Verify farmer callers receive 403 Forbidden for diagnostic traces."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/system/diagnostics/traces",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert res.status_code == 403

@pytest.mark.anyio
async def test_diagnostics_traces_provider_rejected(provider_token):
    """Verify equipment provider callers receive 403 Forbidden for diagnostic traces."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/system/diagnostics/traces",
            headers={"Authorization": f"Bearer {provider_token}"}
        )
        assert res.status_code == 403

@pytest.mark.anyio
async def test_diagnostics_traces_admin_allowed(admin_token):
    """Verify admin callers successfully receive diagnostic traces."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/system/diagnostics/traces",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        assert "traces" in res.json()

# ---------------------------------------------------------------------------
# 4. POST /auto-heal security tests
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_diagnostics_auto_heal_anonymous_rejected():
    """Verify anonymous callers cannot trigger auto-heal."""
    with patch("backend.app.routers.common.diagnostics.execute_auto_heal") as mock_heal:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/system/diagnostics/auto-heal", json={"issue_id": "rca_translation_failure"})
            assert res.status_code == 401
            mock_heal.assert_not_called()

@pytest.mark.anyio
async def test_diagnostics_auto_heal_farmer_rejected(farmer_token):
    """Verify farmer callers cannot trigger auto-heal."""
    with patch("backend.app.routers.common.diagnostics.execute_auto_heal") as mock_heal:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/system/diagnostics/auto-heal",
                headers={"Authorization": f"Bearer {farmer_token}"},
                json={"issue_id": "rca_translation_failure"}
            )
            assert res.status_code == 403
            mock_heal.assert_not_called()

@pytest.mark.anyio
async def test_diagnostics_auto_heal_provider_rejected(provider_token):
    """Verify equipment provider callers cannot trigger auto-heal."""
    with patch("backend.app.routers.common.diagnostics.execute_auto_heal") as mock_heal:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/system/diagnostics/auto-heal",
                headers={"Authorization": f"Bearer {provider_token}"},
                json={"issue_id": "rca_translation_failure"}
            )
            assert res.status_code == 403
            mock_heal.assert_not_called()

@pytest.mark.anyio
async def test_diagnostics_auto_heal_admin_allowed(admin_token):
    """Verify admin can trigger auto-heal with mocked execution to prevent state side-effects."""
    mock_heal_res = {
        "success": True,
        "issue_id": "rca_translation_failure",
        "actions_taken": ["Cleared translation LRU in-memory RAM cache."],
        "timestamp": "2026-09-29 17:00:00"
    }
    with patch("backend.app.routers.common.diagnostics.execute_auto_heal", return_value=mock_heal_res) as mock_heal:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/system/diagnostics/auto-heal",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"issue_id": "rca_translation_failure"}
            )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["issue_id"] == "rca_translation_failure"
            mock_heal.assert_called_once_with("rca_translation_failure")

# ---------------------------------------------------------------------------
# 5. Dual route prefix parity tests (/api/v1 vs /api)
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_diagnostics_legacy_api_prefix_security_parity(farmer_token, admin_token):
    """Verify /api/system/diagnostics/* without /v1 enforces exact same RBAC rules."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Anonymous on /api
        res_anon = await ac.get("/api/system/diagnostics/summary")
        assert res_anon.status_code == 401

        # Farmer on /api
        res_farmer = await ac.get(
            "/api/system/diagnostics/summary",
            headers={"Authorization": f"Bearer {farmer_token}"}
        )
        assert res_farmer.status_code == 403

        # Admin on /api
        res_admin = await ac.get(
            "/api/system/diagnostics/summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res_admin.status_code == 200
