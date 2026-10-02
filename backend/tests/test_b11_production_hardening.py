"""
B11 Production Hardening Test Suite
===================================
Validates all confirmed B11 findings (F01–F07):
- B11-F01: Worker 3 & AI Worker scheduler suppression / split-brain prevention
- B11-F02: High-performance MongoDB indexes on devices collection
- B11-F03: Tuned AI cluster timeout profile & bounded ~60s failover cooldown
- B11-F04: Local inference cache pruning (cleanup_local_inference_cache)
- B11-F05: Concurrent execution of 6 MongoDB analytics aggregations via asyncio.gather
- B11-F06: Rollup manualChunks code splitting configuration
- B11-F07: Modernized test assertions compatibility
"""

import os
import time
import pytest
import asyncio
import tempfile
from unittest.mock import patch, MagicMock, AsyncMock

from backend.app.core.config import settings
from backend.tests.mock_db import MockDatabase


# =========================================================================
# B11-F01: Worker Node Detection & Scheduler Suppression
# =========================================================================

def test_b11_f01_is_ai_worker_node_detection():
    """Verify is_ai_worker_node accurately identifies all worker scenarios and protects Main."""
    from backend.app.main import is_ai_worker_node

    # Case 1: Main Gateway in production (should be False)
    with patch.dict(os.environ, {
        "RENDER_SERVICE_NAME": "agrishield-crop-system",
        "RENDER_EXTERNAL_URL": "https://agrishield-crop-system.onrender.com",
        "IS_PREDICTION_WORKER": "false",
        "DISABLE_SCHEDULER": "false"
    }):
        with patch.object(settings, "IS_PREDICTION_WORKER", False):
            assert is_ai_worker_node() is False

    # Case 2: Worker 1 (explicit flag)
    with patch.dict(os.environ, {"IS_PREDICTION_WORKER": "true"}):
        assert is_ai_worker_node() is True

    # Case 3: Worker 2 (DISABLE_SCHEDULER flag)
    with patch.dict(os.environ, {"DISABLE_SCHEDULER": "true"}):
        assert is_ai_worker_node() is True

    # Case 4: Worker 3 (Render service name safeguard)
    with patch.dict(os.environ, {
        "RENDER_SERVICE_NAME": "agrishield-ai-worker-3",
        "IS_PREDICTION_WORKER": "false",
        "DISABLE_SCHEDULER": "false"
    }):
        with patch.object(settings, "IS_PREDICTION_WORKER", False):
            assert is_ai_worker_node() is True

    # Case 5: Worker 3 (Render external URL safeguard)
    with patch.dict(os.environ, {
        "RENDER_SERVICE_NAME": "custom-service",
        "RENDER_EXTERNAL_URL": "https://agrishield-ai-worker-3.onrender.com",
        "IS_PREDICTION_WORKER": "false"
    }):
        with patch.object(settings, "IS_PREDICTION_WORKER", False):
            assert is_ai_worker_node() is True

    # Case 6: Future Worker 4
    with patch.dict(os.environ, {
        "RENDER_SERVICE_NAME": "agrishield-ai-worker-4",
        "IS_PREDICTION_WORKER": "false"
    }):
        with patch.object(settings, "IS_PREDICTION_WORKER", False):
            assert is_ai_worker_node() is True


@pytest.mark.asyncio
async def test_b11_f01_init_background_services_worker_omission():
    """Verify init_background_services omits scheduler on AI workers."""
    from backend.app.main import init_background_services
    from backend.app.db.mongodb import db_instance

    mock_db = MockDatabase()
    db_instance.db = mock_db

    # Simulate AI worker node
    with patch("backend.app.main.is_ai_worker_node", return_value=True), \
         patch("backend.app.main.connect_to_mongo", new_callable=AsyncMock), \
         patch("backend.app.main.start_scheduler") as mock_start_sched:
        await init_background_services()
        mock_start_sched.assert_not_called()

    # Simulate Main Gateway
    with patch("backend.app.main.is_ai_worker_node", return_value=False), \
         patch("backend.app.main.connect_to_mongo", new_callable=AsyncMock), \
         patch("backend.app.main.start_scheduler") as mock_start_sched:
        await init_background_services()
        mock_start_sched.assert_called_once_with(mock_db)


# =========================================================================
# B11-F02: MongoDB Devices Collection Indexes
# =========================================================================

@pytest.mark.asyncio
async def test_b11_f02_devices_indexes_created():
    """Verify devices collection indexes are registered with exact names and uniqueness."""
    from backend.app.db.mongodb import db_instance, connect_to_mongo

    created_indexes = []

    async def mock_create_index(keys, **kwargs):
        created_indexes.append({
            "keys": keys,
            "kwargs": kwargs
        })

    mock_devices = MagicMock()
    mock_devices.create_index = AsyncMock(side_effect=mock_create_index)

    mock_db = MagicMock()
    mock_db.__getitem__.side_effect = lambda name: mock_devices if name == "devices" else MagicMock(create_index=AsyncMock())

    old_db = db_instance.db
    db_instance.db = None

    try:
        with patch("backend.app.db.mongodb.AsyncIOMotorClient") as mock_client:
            mock_instance = MagicMock()
            mock_instance.admin.command = AsyncMock(return_value={"ok": 1})
            mock_instance.__getitem__.return_value = mock_db
            mock_client.return_value = mock_instance

            with patch("backend.app.db.mongodb.seed_default_notification_rules", new_callable=AsyncMock):
                await connect_to_mongo()
    finally:
        db_instance.db = old_db

    assert len(created_indexes) >= 3

    # Check 1: Unique index on device_id
    idx_uid = next((i for i in created_indexes if i["kwargs"].get("name") == "idx_devices_device_id_unique"), None)
    assert idx_uid is not None
    assert idx_uid["keys"] == [("device_id", 1)]
    assert idx_uid["kwargs"].get("unique") is True

    # Check 2: Status/last_seen compound index
    idx_status = next((i for i in created_indexes if i["kwargs"].get("name") == "idx_devices_status_last_seen"), None)
    assert idx_status is not None
    assert idx_status["keys"] == [("status", 1), ("last_seen", -1)]

    # Check 3: Farmer user_id index
    idx_user = next((i for i in created_indexes if i["kwargs"].get("name") == "idx_devices_user_id"), None)
    assert idx_user is not None
    assert idx_user["keys"] == [("user_id", 1)]


# =========================================================================
# B11-F03: AI Cluster Timeout & Bounded Cooldown
# =========================================================================

def test_b11_f03_ai_cluster_timeout_and_cooldown():
    """Verify cluster timeout profile and bounded ~60s failure cooldown."""
    from backend.app.services.ai_cluster import AIClusterDispatcher

    dispatcher = AIClusterDispatcher()
    w1 = "https://agrishield-ai-worker-1.onrender.com"

    # 1. First failure -> exactly 60.0s cooldown
    cooldown1, count1 = dispatcher._record_worker_failure(w1)
    assert count1 == 1
    assert cooldown1 == 60.0
    assert dispatcher._worker_cooldowns[w1] > time.time() + 50.0

    # 2. Second consecutive failure -> 90.0s cooldown (60 * 1.5)
    cooldown2, count2 = dispatcher._record_worker_failure(w1)
    assert count2 == 2
    assert cooldown2 == 90.0

    # 3. Repeated failures capped at 300.0s (5m)
    for _ in range(5):
        cooldown_cap, _ = dispatcher._record_worker_failure(w1)
    assert cooldown_cap == 300.0

    # 4. Success resets failure count and clears cooldown
    dispatcher._record_worker_success(w1)
    assert dispatcher._worker_failure_counts.get(w1) == 0
    assert w1 not in dispatcher._worker_cooldowns


@pytest.mark.asyncio
async def test_b11_f03_offload_prediction_timeout_profile():
    """Verify offload_prediction uses tuned timeout (connect=2.0, read=6.0, write=3.0, pool=2.0)."""
    import httpx
    from backend.app.services.ai_cluster import ai_cluster

    captured_timeouts = []

    class MockAsyncClient:
        def __init__(self, timeout=None, **kwargs):
            captured_timeouts.append(timeout)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def post(self, *args, **kwargs):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"success": True, "result": {"crop_name": "Tomato"}}
            return mock_resp

    with patch.object(ai_cluster, "get_worker_nodes", return_value=["https://mock-worker-1.onrender.com"]), \
         patch.object(settings, "IS_PREDICTION_WORKER", False), \
         patch("httpx.AsyncClient", MockAsyncClient):
        result = await ai_cluster.offload_prediction(image_bytes=b"dummy", filename="leaf.jpg")
        assert result == {"crop_name": "Tomato"}
        assert len(captured_timeouts) == 1
        t = captured_timeouts[0]
        assert t.connect == 2.0
        assert t.read == 6.0
        assert t.write == 3.0
        assert t.pool == 2.0


# =========================================================================
# B11-F04: Local Inference Image Cache Pruning
# =========================================================================

def test_b11_f04_cleanup_local_inference_cache():
    """Verify cleanup_local_inference_cache removes files older than cutoff and keeps fresh files."""
    from backend.app.services.storage_service import cleanup_local_inference_cache

    with tempfile.TemporaryDirectory() as temp_upload_dir:
        cluster_temp = os.path.join(temp_upload_dir, "cluster_temp")
        os.makedirs(cluster_temp, exist_ok=True)

        # 1. Stale file (2 days old)
        stale_file = os.path.join(cluster_temp, "infer_stale.jpg")
        with open(stale_file, "wb") as f:
            f.write(b"stale_bytes")
        stale_mtime = time.time() - (2 * 86400)
        os.utime(stale_file, (stale_mtime, stale_mtime))

        # 2. Fresh file (10 minutes old)
        fresh_file = os.path.join(cluster_temp, "infer_fresh.jpg")
        with open(fresh_file, "wb") as f:
            f.write(b"fresh_bytes")

        # 3. Unrelated permanent upload in root canonical dir (should NEVER be touched)
        permanent_upload = os.path.join(temp_upload_dir, "leaf_user_upload.jpg")
        with open(permanent_upload, "wb") as f:
            f.write(b"permanent_bytes")
        os.utime(permanent_upload, (stale_mtime, stale_mtime))

        pruned = cleanup_local_inference_cache(max_age_seconds=86400, target_dir=cluster_temp)
        assert pruned == 1

        assert not os.path.exists(stale_file)
        assert os.path.exists(fresh_file)
        assert os.path.exists(permanent_upload)


# =========================================================================
# B11-F05: Parallelized Farmer Analytics Aggregations
# =========================================================================

@pytest.mark.asyncio
async def test_b11_f05_analytics_gather_concurrent_execution():
    """Verify get_full_analytics executes aggregations via asyncio.gather and preserves response structure."""
    from backend.app.services.analytics import analytics_service

    mock_db = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[{"name": "Tomato", "count": 5}])
    mock_db.predictions.aggregate.return_value = mock_cursor

    mock_summary_stats = {
        "counts": {
            "total_scans": 1,
            "healthy_plants": 0,
            "diseased_plants": 1,
            "plant_identification": 0,
            "disease_diagnosis": 1,
            "agrochemical_scans": 0
        },
        "performance": {
            "average_confidence": 0.95,
            "average_inference_time_ms": 45.0,
            "scan_success_rate": 1.0
        }
    }

    # Clear analytics cache for fresh evaluation
    from backend.app.services.analytics.cache import analytics_cache
    analytics_cache.clear()

    # Track concurrent execution
    gather_called = False
    original_gather = asyncio.gather

    async def tracking_gather(*aws, **kwargs):
        nonlocal gather_called
        gather_called = True
        return await original_gather(*aws, **kwargs)

    with patch("backend.app.services.analytics.analytics_service.calculate_summary_stats", new_callable=AsyncMock) as mock_calc:
        mock_calc.return_value = mock_summary_stats
        with patch("asyncio.gather", side_effect=tracking_gather):
            result = await analytics_service.get_full_analytics(
                db=mock_db,
                user_id="test_farmer_99",
                time_range="all"
            )

    assert gather_called is True
    assert "summary" in result
    assert "top_crops" in result
    assert "top_diseases" in result
    assert "top_agrochemicals" in result
    assert "time_series" in result
    assert "insights" in result
    assert "metadata" in result


# =========================================================================
# B11-F06: Vite Configuration Code Splitting Verification
# =========================================================================

def test_b11_f06_vite_config_manual_chunks():
    """Verify vite.config.js declares Rollup manualChunks for vendor splitting."""
    vite_config_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend",
        "vite.config.js"
    )
    assert os.path.exists(vite_config_path)
    with open(vite_config_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "manualChunks" in content
    assert "vendor-react" in content
    assert "vendor-ui" in content
    assert "vendor-charts" in content
    assert "vendor-pdf" in content
