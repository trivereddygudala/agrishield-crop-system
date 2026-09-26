import pytest
import asyncio
import io
import os
import jwt
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.mongodb import get_database, db_instance
from backend.tests.mock_db import MockDatabase
from backend.app.services.firmware_service import calculate_sha256, get_firmware_storage_dir

mock_db = MockDatabase()
db_instance.db = mock_db

async def override_get_database():
    return mock_db

app.dependency_overrides[get_database] = override_get_database
client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    app.dependency_overrides[get_database] = override_get_database
    db_instance.db = mock_db
    mock_db.firmware_releases.records = []
    mock_db.users.records = []
    yield
    mock_db.firmware_releases.records = []
    mock_db.users.records = []

def get_token(role: str = "admin", email: str = "user@test.com", user_id: str = "user123"):
    expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "exp": expire,
        "type": "access"
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def get_auth_headers(role: str = "admin"):
    return {"Authorization": f"Bearer {get_token(role)}"}

# ============================================================================
# 1. RBAC Tests: /history
# ============================================================================

def test_firmware_history_rbac():
    """Verify /history denies anonymous and non-admin, allows admin."""
    # 1. Anonymous -> denied
    res_anon = client.get("/api/v1/firmware/history")
    assert res_anon.status_code in [401, 403], f"Expected 401/403, got {res_anon.status_code}"

    # 2. Non-admin (farmer) -> denied (403)
    res_farmer = client.get("/api/v1/firmware/history", headers=get_auth_headers("farmer"))
    assert res_farmer.status_code == 403, f"Expected 403, got {res_farmer.status_code}"

    # 3. Non-admin (provider) -> denied (403)
    res_provider = client.get("/api/v1/firmware/history", headers=get_auth_headers("provider"))
    assert res_provider.status_code == 403, f"Expected 403, got {res_provider.status_code}"

    # 4. Admin -> allowed (200)
    res_admin = client.get("/api/v1/firmware/history", headers=get_auth_headers("admin"))
    assert res_admin.status_code == 200, f"Expected 200, got {res_admin.status_code}"

# ============================================================================
# 2. RBAC Tests: /latest
# ============================================================================

def test_firmware_latest_rbac():
    """Verify /latest denies anonymous and non-admin, allows admin."""
    # Seed an active release in mock DB
    mock_db.firmware_releases.records.append({
        "version": "v1.0.0",
        "filename": "ESP32_v1_0_0.bin",
        "sha256": "abc123sha",
        "size_bytes": 1024,
        "hardware_model": "ESP32 DevKit V1",
        "release_notes": "Test notes",
        "is_active": True,
        "uploaded_at": datetime.now(timezone.utc),
        "uploaded_by": "admin"
    })

    # 1. Anonymous -> denied
    res_anon = client.get("/api/v1/firmware/latest")
    assert res_anon.status_code in [401, 403]

    # 2. Non-admin (farmer) -> denied (403)
    res_farmer = client.get("/api/v1/firmware/latest", headers=get_auth_headers("farmer"))
    assert res_farmer.status_code == 403

    # 3. Admin -> allowed (200)
    res_admin = client.get("/api/v1/firmware/latest", headers=get_auth_headers("admin"))
    assert res_admin.status_code == 200
    assert res_admin.json()["version"] == "v1.0.0"

# ============================================================================
# 3. RBAC & Functionality Tests: /download/{version}
# ============================================================================

def test_firmware_download_rbac_and_functionality():
    """Verify /download denies anonymous and non-admin, allows admin, and streams file."""
    storage_dir = get_firmware_storage_dir()
    os.makedirs(storage_dir, exist_ok=True)
    test_bin_path = os.path.join(storage_dir, "test_dl_binary.bin")
    dummy_bytes = b"\xE9" + (b"\x00" * 511)
    with open(test_bin_path, "wb") as f:
        f.write(dummy_bytes)

    try:
        mock_db.firmware_releases.records.append({
            "version": "v2.0.0",
            "filename": "test_dl_binary.bin",
            "sha256": calculate_sha256(dummy_bytes),
            "size_bytes": len(dummy_bytes),
            "hardware_model": "ESP32 DevKit V1",
            "is_active": True,
            "file_path": test_bin_path
        })

        # 1. Anonymous -> denied
        res_anon = client.get("/api/v1/firmware/download/v2.0.0")
        assert res_anon.status_code in [401, 403]

        # 2. Non-admin (farmer) -> denied (403)
        res_farmer = client.get("/api/v1/firmware/download/v2.0.0", headers=get_auth_headers("farmer"))
        assert res_farmer.status_code == 403

        # 3. Admin -> functional download (200)
        res_admin = client.get("/api/v1/firmware/download/v2.0.0", headers=get_auth_headers("admin"))
        assert res_admin.status_code == 200
        assert res_admin.content == dummy_bytes
        assert res_admin.headers.get("X-Checksum-Sha256") == calculate_sha256(dummy_bytes)
    finally:
        if os.path.exists(test_bin_path):
            os.remove(test_bin_path)

# ============================================================================
# 4. Legacy Data Compatibility & File Path Exposure Tests
# ============================================================================

def test_legacy_firmware_documents_do_not_crash_and_do_not_expose_file_path():
    """
    Verify:
    1. Legacy documents missing release_notes, uploaded_by, or file_path do NOT cause HTTP 500.
    2. Internal filesystem path (file_path) is NEVER exposed in the JSON response.
    3. Existing valid metadata remains intact.
    """
    # Seed legacy document missing release_notes, uploaded_by, file_path, and size_bytes
    mock_db.firmware_releases.records.append({
        "version": "v0.9.0-legacy",
        "filename": "legacy_firmware.bin",
        "sha256": "abcdef1234567890",
        "hardware_model": "ESP32 DevKit V1",
        "is_active": True,
        # Intentionally missing release_notes
        # Intentionally missing uploaded_by
        # Intentionally missing file_path
        # Extra secret field in MongoDB that must not leak
        "file_path": "C:\\secret\\internal\\system\\path\\legacy_firmware.bin"
    })

    # Test GET /history with legacy document
    res_hist = client.get("/api/v1/firmware/history", headers=get_auth_headers("admin"))
    assert res_hist.status_code == 200, f"Expected 200 for legacy doc, got {res_hist.status_code}: {res_hist.text}"
    data = res_hist.json()
    assert data["total"] == 1
    rel = data["releases"][0]
    assert rel["version"] == "v0.9.0-legacy"
    assert rel["filename"] == "legacy_firmware.bin"
    assert rel["sha256"] == "abcdef1234567890"
    assert rel["release_notes"] == ""  # Safe default fallback
    assert rel["uploaded_by"] == "admin"  # Safe default fallback
    assert "file_path" not in rel, "SECURITY VIOLATION: Internal filesystem path exposed in API response!"

    # Test GET /latest with legacy document
    res_latest = client.get("/api/v1/firmware/latest", headers=get_auth_headers("admin"))
    assert res_latest.status_code == 200, f"Expected 200 for latest, got {res_latest.status_code}"
    latest_data = res_latest.json()
    assert latest_data["version"] == "v0.9.0-legacy"
    assert "file_path" not in latest_data, "SECURITY VIOLATION: Internal filesystem path exposed in API response!"
