import pytest
import asyncio
import io
import os
import jwt
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from bson import ObjectId

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.mongodb import get_database, db_instance
from backend.tests.mock_db import MockDatabase
from backend.app.services.firmware_service import calculate_sha256, get_firmware_storage_dir

database_for_testing = MockDatabase()
db_instance.db = database_for_testing

async def override_get_database():
    return database_for_testing

app.dependency_overrides[get_database] = override_get_database

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_ota_db():
    app.dependency_overrides[get_database] = override_get_database
    db_instance.db = database_for_testing
    asyncio.run(database_for_testing.firmware_releases.delete_many({}))
    asyncio.run(database_for_testing.ota_audit_logs.delete_many({}))
    asyncio.run(database_for_testing.devices.delete_many({}))
    yield
    asyncio.run(database_for_testing.firmware_releases.delete_many({}))
    asyncio.run(database_for_testing.ota_audit_logs.delete_many({}))
    asyncio.run(database_for_testing.devices.delete_many({}))

def generate_jwt(user_id: str, email: str, role: str):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": int((now + timedelta(hours=1)).timestamp()),
        "iat": int(now.timestamp()),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def get_auth_headers(role: str = "admin"):
    token = generate_jwt(str(ObjectId()), f"{role}@farm.com", role)
    return {"Authorization": f"Bearer {token}"}

def create_mock_firmware_bytes(magic_byte: int = 0xE9, size: int = 1024) -> bytes:
    """Create mock ESP32 binary content starting with the specified magic byte."""
    content = bytearray([magic_byte]) + bytearray(os.urandom(size - 1))
    return bytes(content)

def test_1_admin_authorization_required():
    """Verify non-admin users and unauthenticated requests cannot upload or delete firmware."""
    content = create_mock_firmware_bytes()
    files = {"file": ("test.bin", io.BytesIO(content), "application/octet-stream")}
    data = {"version": "v1.0.0", "hardware_model": "ESP32 DevKit V1"}
    
    # 1. Unauthenticated request
    res_no_auth = client.post("/api/v1/firmware/upload", files=files, data=data)
    assert res_no_auth.status_code == 401
    
    # 2. Farmer role request (should be forbidden 403)
    files = {"file": ("test.bin", io.BytesIO(content), "application/octet-stream")}
    res_farmer = client.post("/api/v1/firmware/upload", files=files, data=data, headers=get_auth_headers("farmer"))
    assert res_farmer.status_code == 403

def test_2_firmware_upload_and_checksum():
    """Verify admin can upload valid .bin firmware and SHA-256 checksum is accurately generated."""
    content = create_mock_firmware_bytes(0xE9, 2048)
    expected_sha256 = calculate_sha256(content)
    
    files = {"file": ("ESP32_v2.0.0.bin", io.BytesIO(content), "application/octet-stream")}
    data = {
        "version": "v2.0.0",
        "hardware_model": "ESP32 DevKit V1",
        "release_notes": "Initial stable release with telemetry support."
    }
    
    res = client.post("/api/v1/firmware/upload", files=files, data=data, headers=get_auth_headers("admin"))
    assert res.status_code == 201, res.text
    payload = res.json()
    assert payload["status"] == "success"
    assert payload["firmware"]["version"] == "v2.0.0"
    assert payload["firmware"]["sha256"] == expected_sha256
    assert payload["firmware"]["size_bytes"] == 2048
    assert payload["firmware"]["hardware_model"] == "ESP32 DevKit V1"
    
    # Verify file was written to disk
    file_path = payload["firmware"]["file_path"]
    assert os.path.exists(file_path)
    if os.path.exists(file_path):
        os.remove(file_path)

def test_3_firmware_download():
    """Verify downloading uploaded firmware returns correct stream and X-Checksum-Sha256 header."""
    content = create_mock_firmware_bytes(0xE9, 1024)
    expected_sha = calculate_sha256(content)
    
    files = {"file": ("download_test.bin", io.BytesIO(content), "application/octet-stream")}
    data = {"version": "v2.1.0", "hardware_model": "ESP32 DevKit V1"}
    upload_res = client.post("/api/v1/firmware/upload", files=files, data=data, headers=get_auth_headers("admin"))
    assert upload_res.status_code == 201
    file_path = upload_res.json()["firmware"]["file_path"]
    
    try:
        # Download firmware via endpoint
        res = client.get("/api/v1/firmware/download/v2.1.0?hardware_model=ESP32 DevKit V1")
        assert res.status_code == 200
        assert res.headers.get("X-Checksum-Sha256") == expected_sha
        assert len(res.content) == 1024
        assert res.content[0] == 0xE9
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

def test_4_semantic_version_comparison_and_ota_check():
    """Verify dynamic OTA endpoint compares versions and advertises updates when available."""
    content1 = create_mock_firmware_bytes(0xE9, 512)
    content2 = create_mock_firmware_bytes(0xE9, 1024)
    
    headers = get_auth_headers("admin")
    import uuid
    v1 = f"v2.0.0-{uuid.uuid4().hex[:6]}"
    v2 = f"v2.5.0-{uuid.uuid4().hex[:6]}"
    
    # Upload v2.0.0
    res1 = client.post("/api/v1/firmware/upload", files={"file": ("v2.0.bin", io.BytesIO(content1), "application/octet-stream")}, data={"version": v1, "hardware_model": "ESP32 DevKit V1"}, headers=headers)
    if res1.status_code not in (200, 201):
        print("Upload failed for res1:", res1.json())
    path1 = res1.json()["firmware"]["file_path"]
    
    # Upload v2.5.0
    res2 = client.post("/api/v1/firmware/upload", files={"file": ("v2.5.bin", io.BytesIO(content2), "application/octet-stream")}, data={"version": v2, "hardware_model": "ESP32 DevKit V1"}, headers=headers)
    if res2.status_code not in (200, 201):
        print("Upload failed for res2:", res2.json())
    path2 = res2.json()["firmware"]["file_path"]
    
    try:
        # Pre-register device in mock DB
        asyncio.run(database_for_testing.devices.insert_one({
            "device_id": "ESP32-TEST-01",
            "hardware_model": "ESP32 DevKit V1",
            "status": "online"
        }))
        
        # 1. Device with old queries OTA -> should see v2.5.0 update available
        res_check1 = client.get(f"/api/v1/devices/ESP32-TEST-01/ota?current_version={v1}", headers=get_auth_headers("tester"))
        assert res_check1.status_code == 200
        data1 = res_check1.json()
        assert data1["update_available"] is True
        assert data1["latest_version"] == v2
        assert v2 in data1["download_url"]
        
        # 2. Device with new queries OTA -> should NOT see update
        res_check2 = client.get(f"/api/v1/devices/ESP32-TEST-01/ota?current_version={v2}", headers=get_auth_headers("tester"))
        assert res_check2.status_code == 200
        data2 = res_check2.json()
        assert data2["update_available"] is False
        assert data2["download_url"] == ""
    finally:
        if os.path.exists(path1): os.remove(path1)
        if os.path.exists(path2): os.remove(path2)

def test_5_unsupported_hardware_rejection():
    """Verify firmware targeted for a specific hardware model is not offered to unsupported devices."""
    content = create_mock_firmware_bytes(0xE9, 512)
    res = client.post("/api/v1/firmware/upload", files={"file": ("agri.bin", io.BytesIO(content), "application/octet-stream")}, data={"version": "v3.0.0", "hardware_model": "AgriShield_ESP32"}, headers=get_auth_headers("admin"))
    path = res.json()["firmware"]["file_path"]
    
    try:
        asyncio.run(database_for_testing.devices.insert_one({
            "device_id": "DEV-8266-01",
            "hardware_model": "ESP8266 NodeMCU",
            "status": "online"
        }))
        
        # Query OTA for ESP8266 -> should not see AgriShield_ESP32 firmware
        ota_res = client.get("/api/v1/devices/DEV-8266-01/ota?current_version=v2.0.0")
        assert ota_res.status_code == 200
        assert ota_res.json()["update_available"] is False
    finally:
        if os.path.exists(path): os.remove(path)

def test_6_invalid_firmware_rejection():
    """Verify rejecting files with invalid extensions or missing ESP32 magic byte (0xE9)."""
    headers = get_auth_headers("admin")
    
    # 1. Invalid file extension (.txt)
    res_ext = client.post("/api/v1/firmware/upload", files={"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}, data={"version": "v1.0.0", "hardware_model": "ESP32 DevKit V1"}, headers=headers)
    assert res_ext.status_code == 400
    assert "extension" in res_ext.text.lower()
    
    # 2. Missing ESP32 magic byte 0xE9 at start of binary
    bad_bin = bytearray([0x00, 0x01, 0x02, 0x03])
    res_magic = client.post("/api/v1/firmware/upload", files={"file": ("bad_magic.bin", io.BytesIO(bad_bin), "application/octet-stream")}, data={"version": "v1.0.0", "hardware_model": "ESP32 DevKit V1"}, headers=headers)
    assert res_magic.status_code == 400
    assert "magic byte" in res_magic.text.lower()

def test_7_oversized_file_rejection():
    """Verify rejecting firmware files exceeding the 4MB partition limit."""
    # Create 4MB + 10 bytes content
    oversized_content = create_mock_firmware_bytes(0xE9, (4 * 1024 * 1024) + 10)
    files = {"file": ("oversized.bin", io.BytesIO(oversized_content), "application/octet-stream")}
    data = {"version": "v9.9.9", "hardware_model": "ESP32 DevKit V1"}
    
    res = client.post("/api/v1/firmware/upload", files=files, data=data, headers=get_auth_headers("admin"))
    assert res.status_code == 400
    assert "exceeds maximum limit" in res.text.lower()

def test_8_firmware_history_and_delete():
    """Verify listing firmware release history and admin deletion of firmware binary & metadata."""
    content = create_mock_firmware_bytes(0xE9, 512)
    headers = get_auth_headers("admin")
    
    upload_res = client.post("/api/v1/firmware/upload", files={"file": ("hist.bin", io.BytesIO(content), "application/octet-stream")}, data={"version": "v1.5.0", "hardware_model": "ESP32 DevKit V1"}, headers=headers)
    assert upload_res.status_code == 201
    file_path = upload_res.json()["firmware"]["file_path"]
    assert os.path.exists(file_path)
    
    # 1. Check history
    hist_res = client.get("/api/v1/firmware/history")
    assert hist_res.status_code == 200
    hist_payload = hist_res.json()
    assert hist_payload["total"] >= 1
    assert any(rel["version"] == "v1.5.0" for rel in hist_payload["releases"])
    
    # 2. Delete firmware release as admin
    del_res = client.delete("/api/v1/firmware/v1.5.0?hardware_model=ESP32 DevKit V1", headers=headers)
    assert del_res.status_code == 200
    assert not os.path.exists(file_path)
    
    # 3. Verify audit log recorded upload and delete
    audit_res = client.get("/api/v1/firmware/audit-logs", headers=headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()["logs"]
    actions = [l["action"] for l in logs]
    assert "FIRMWARE_UPLOAD" in actions
    assert "FIRMWARE_DELETE" in actions
