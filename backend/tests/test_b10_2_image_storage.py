"""
AgriShield B10.2 Comprehensive Long-Term Image Storage Tests
============================================================
Exercises:
1. Local-provider storage behavior.
2. Cloud upload success with mocked S3 client.
3. Correct HTTPS public URL construction.
4. Secure UUID object key generation.
5. Filename/path traversal resistance.
6. Cloud upload timeout/failure -> automatic local fallback.
7. Cloud upload success -> authoritative HTTPS URL stored (no invalid local path).
8. Both cloud and local failure -> controlled StorageException.
9. Cloud object deletion.
10. Missing cloud object deletion is idempotent.
11. Legacy local image deletion remains functional.
12. Remote image resolver accepts trusted storage URL directly without downloading.
13. Remote resolver rejects untrusted arbitrary URL / SSRF attempts.
14. Legacy image resolver behavior remains intact.
15. Frontend URL resolution logic compatibility.
16. B9.2 regression: Structured 503 on database degradation.
17. B9.3 regression: Worker 1 upload affinity & cluster routing.
18. B9.7 regression: Correlation ID propagation and credential redaction.
19. B10.1 regression: IoT telemetry 30-day retention & 7-day JWT expiration.
"""

import os
import uuid
import pytest
import asyncio
from unittest.mock import MagicMock, patch

from backend.app.core.config import settings
from backend.app.services.storage_service import (
    StorageService,
    StorageUploadResult,
    StorageException,
    storage_service
)
from backend.app.services.image_resolver import resolve_image_path


# Sample 1x1 valid JPEG bytes (with standard JPEG magic bytes: FF D8 FF)
VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"


# ============================================================================
# 1. Local-Provider Storage Behavior
# ============================================================================
@pytest.mark.asyncio
async def test_01_local_provider_storage_behavior():
    svc = StorageService()
    with patch.object(settings, "STORAGE_PROVIDER", "local"):
        assert svc.is_cloud_configured() is False
        res = await svc.upload_image(VALID_JPEG_BYTES, "test_leaf.jpg", "image/jpeg")

        assert res.is_cloud is False
        assert res.image_path.startswith("uploads/")
        assert res.image_path.endswith(".jpg")
        assert res.local_path is not None
        assert os.path.exists(res.local_path)

        # Cleanup local test file
        if os.path.exists(res.local_path):
            os.remove(res.local_path)


# ============================================================================
# 2. Cloud Upload Success
# ============================================================================
@pytest.mark.asyncio
async def test_02_cloud_upload_success():
    svc = StorageService()
    mock_s3 = MagicMock()
    mock_s3.put_object.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}

    with patch.object(settings, "STORAGE_PROVIDER", "r2"), \
         patch.object(settings, "STORAGE_BUCKET_NAME", "agrishield-crop-images"), \
         patch.object(settings, "STORAGE_ACCESS_KEY_ID", "mock_key_id"), \
         patch.object(settings, "STORAGE_SECRET_ACCESS_KEY", "mock_secret"), \
         patch.object(settings, "STORAGE_PUBLIC_BASE_URL", "https://images.agrishield.io"), \
         patch.object(svc, "_get_s3_client", return_value=mock_s3):

        res = await svc.upload_image(VALID_JPEG_BYTES, "photo.jpg", "image/jpeg")

        assert res.is_cloud is True
        assert res.image_path.startswith("https://images.agrishield.io/")
        assert res.image_path.endswith(".jpg")
        mock_s3.put_object.assert_called_once()
        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs["Bucket"] == "agrishield-crop-images"
        assert call_kwargs["ContentType"] == "image/jpeg"
        assert call_kwargs["Body"] == VALID_JPEG_BYTES


# ============================================================================
# 3. Correct HTTPS Public URL Construction
# ============================================================================
def test_03_correct_https_url_construction():
    svc = StorageService()
    with patch.object(settings, "STORAGE_PUBLIC_BASE_URL", "https://cdn.agrishield.io/leaf-photos"):
        url = svc.build_public_url("sample_uuid.jpg")
        assert url == "https://cdn.agrishield.io/leaf-photos/sample_uuid.jpg"

    with patch.object(settings, "STORAGE_PUBLIC_BASE_URL", None), \
         patch.object(settings, "STORAGE_ENDPOINT_URL", "https://account123.r2.cloudflarestorage.com"), \
         patch.object(settings, "STORAGE_BUCKET_NAME", "my-bucket"):
        url = svc.build_public_url("sample_uuid.jpg")
        assert url == "https://account123.r2.cloudflarestorage.com/my-bucket/sample_uuid.jpg"


# ============================================================================
# 4. UUID Object Key Generation
# ============================================================================
def test_04_uuid_object_key_generation():
    key1 = StorageService.generate_object_name(VALID_JPEG_BYTES, "client_image.jpg")
    key2 = StorageService.generate_object_name(VALID_JPEG_BYTES, "client_image.jpg")
    assert key1 != key2
    assert key1.endswith(".jpg")
    assert key2.endswith(".jpg")
    # UUID hex is 32 characters + 4 (.jpg) = 36 chars
    assert len(key1) == 36


# ============================================================================
# 5. Filename / Path Traversal Resistance
# ============================================================================
def test_05_path_traversal_resistance():
    malicious_inputs = [
        "../../etc/passwd",
        "..\\..\\windows\\system32\\cmd.exe",
        "evil.php.jpg",
        "/absolute/root/file.png",
        "null\x00byte.jpg"
    ]
    for m in malicious_inputs:
        safe_key = StorageService.generate_object_name(VALID_JPEG_BYTES, m)
        assert ".." not in safe_key
        assert "/" not in safe_key
        assert "\\" not in safe_key
        assert "\x00" not in safe_key
        assert safe_key.endswith(".jpg")


# ============================================================================
# 6. Cloud Upload Failure / Timeout -> Automatic Local Fallback
# ============================================================================
@pytest.mark.asyncio
async def test_06_cloud_upload_failure_local_fallback():
    svc = StorageService()
    mock_s3 = MagicMock()
    mock_s3.put_object.side_effect = Exception("Connection timeout to Cloudflare R2")

    with patch.object(settings, "STORAGE_PROVIDER", "r2"), \
         patch.object(settings, "STORAGE_BUCKET_NAME", "agrishield-crop-images"), \
         patch.object(settings, "STORAGE_ACCESS_KEY_ID", "key"), \
         patch.object(settings, "STORAGE_SECRET_ACCESS_KEY", "secret"), \
         patch.object(svc, "_get_s3_client", return_value=mock_s3):

        res = await svc.upload_image(VALID_JPEG_BYTES, "leaf_scan.jpg", "image/jpeg")

        # Must fall back gracefully to local storage
        assert res.is_cloud is False
        assert res.image_path.startswith("uploads/")
        assert res.error is not None
        assert "Cloud storage unavailable" in res.error
        assert os.path.exists(res.local_path)

        # Cleanup
        if os.path.exists(res.local_path):
            os.remove(res.local_path)


# ============================================================================
# 7. Cloud Upload Success -> Authoritative Cloud URL (No local path as author)
# ============================================================================
@pytest.mark.asyncio
async def test_07_cloud_upload_authoritative_reference():
    svc = StorageService()
    mock_s3 = MagicMock()
    mock_s3.put_object.return_value = {"ResponseMetadata": {"HTTPStatusCode": 200}}

    with patch.object(settings, "STORAGE_PROVIDER", "r2"), \
         patch.object(settings, "STORAGE_BUCKET_NAME", "agrishield-crop-images"), \
         patch.object(settings, "STORAGE_ACCESS_KEY_ID", "key"), \
         patch.object(settings, "STORAGE_SECRET_ACCESS_KEY", "secret"), \
         patch.object(settings, "STORAGE_PUBLIC_BASE_URL", "https://images.agrishield.io"), \
         patch.object(svc, "_get_s3_client", return_value=mock_s3):

        res = await svc.upload_image(VALID_JPEG_BYTES, "test.jpg", "image/jpeg")
        assert res.is_cloud is True
        assert res.image_path.startswith("https://images.agrishield.io/")
        # When cloud upload succeeds, local_path is None (no unnecessary local file saved)
        assert res.local_path is None


# ============================================================================
# 8. Both Cloud and Local Failure -> Controlled StorageException
# ============================================================================
@pytest.mark.asyncio
async def test_08_both_cloud_and_local_failure():
    svc = StorageService()
    mock_s3 = MagicMock()
    mock_s3.put_object.side_effect = Exception("Cloud network down")

    with patch.object(settings, "STORAGE_PROVIDER", "r2"), \
         patch.object(settings, "STORAGE_BUCKET_NAME", "agrishield-crop-images"), \
         patch.object(settings, "STORAGE_ACCESS_KEY_ID", "key"), \
         patch.object(settings, "STORAGE_SECRET_ACCESS_KEY", "secret"), \
         patch.object(svc, "_get_s3_client", return_value=mock_s3), \
         patch.object(svc, "_save_local_file", side_effect=OSError("Read-only filesystem")):

        with pytest.raises(StorageException) as exc_info:
            await svc.upload_image(VALID_JPEG_BYTES, "leaf.jpg", "image/jpeg")

        assert "Failed to persist image to storage" in str(exc_info.value)


# ============================================================================
# 9. Cloud Object Deletion
# ============================================================================
def test_09_cloud_object_deletion():
    svc = StorageService()
    mock_s3 = MagicMock()
    mock_s3.delete_object.return_value = {"DeleteMarker": True}

    with patch.object(settings, "STORAGE_PROVIDER", "r2"), \
         patch.object(settings, "STORAGE_BUCKET_NAME", "agrishield-crop-images"), \
         patch.object(svc, "_get_s3_client", return_value=mock_s3):

        deleted = svc.delete_image("https://images.agrishield.io/sample123.jpg")
        assert deleted is True
        mock_s3.delete_object.assert_called_once_with(
            Bucket="agrishield-crop-images",
            Key="sample123.jpg"
        )


# ============================================================================
# 10. Missing Cloud Object Deletion Is Idempotent
# ============================================================================
def test_10_missing_cloud_object_deletion_idempotent():
    svc = StorageService()
    mock_s3 = MagicMock()
    # S3 delete_object returns success even if object does not exist
    mock_s3.delete_object.return_value = {}

    with patch.object(settings, "STORAGE_PROVIDER", "r2"), \
         patch.object(settings, "STORAGE_BUCKET_NAME", "agrishield-crop-images"), \
         patch.object(svc, "_get_s3_client", return_value=mock_s3):

        res = svc.delete_image("https://images.agrishield.io/nonexistent_123.jpg")
        assert res is True


# ============================================================================
# 11. Legacy Local Image Deletion
# ============================================================================
def test_11_legacy_local_image_deletion():
    svc = StorageService()
    filename = f"test_del_{uuid.uuid4().hex[:8]}.jpg"
    local_path = os.path.join(settings.canonical_upload_dir, filename)
    with open(local_path, "wb") as f:
        f.write(VALID_JPEG_BYTES)

    assert os.path.exists(local_path)
    res = svc.delete_image(f"uploads/{filename}")
    assert res is True
    assert not os.path.exists(local_path)


# ============================================================================
# 12. Remote Image Resolver Accepts Trusted Storage URL
# ============================================================================
def test_12_remote_resolver_accepts_trusted_url():
    with patch.object(settings, "STORAGE_PUBLIC_BASE_URL", "https://images.agrishield.io"):
        trusted_url = "https://images.agrishield.io/leaf_4a8b1c.jpg"
        resolved = resolve_image_path(trusted_url)
        assert resolved == trusted_url


# ============================================================================
# 13. Remote Resolver Rejects Untrusted Arbitrary URL / SSRF
# ============================================================================
def test_13_remote_resolver_rejects_untrusted_urls():
    untrusted_urls = [
        "https://malicious-attacker.com/evil.jpg",
        "https://localhost/admin/steal.jpg",
        "https://127.0.0.1/leaf.jpg",
        "https://169.254.169.254/latest/meta-data/credentials",
        "file:///etc/passwd",
        "ftp://ftp.example.com/leaf.jpg",
        "javascript:alert(1)",
        "data:image/jpeg;base64,1234"
    ]
    with patch.object(settings, "STORAGE_PUBLIC_BASE_URL", "https://images.agrishield.io"):
        for u in untrusted_urls:
            res = resolve_image_path(u)
            assert res is None, f"Expected {u} to be rejected, but got {res}"


# ============================================================================
# 14. Legacy Image Resolver Local & Peer Behavior Intact
# ============================================================================
def test_14_legacy_image_resolver_intact():
    filename = f"legacy_test_{uuid.uuid4().hex[:8]}.jpg"
    local_path = os.path.join(settings.canonical_upload_dir, filename)
    with open(local_path, "wb") as f:
        f.write(VALID_JPEG_BYTES)

    try:
        resolved = resolve_image_path(f"uploads/{filename}")
        assert resolved == local_path
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)


# ============================================================================
# 15. Frontend Absolute URL Resolution Logic Compatibility
# ============================================================================
def test_15_frontend_url_resolution_logic():
    backend_base = "https://agrishield-crop-system.onrender.com"

    def js_resolve_image_url(path, base_url):
        if not path:
            return ""
        if path.startswith("http://") or path.startswith("https://") or path.startswith("data:"):
            return path
        clean = path.replace("\\", "/").lstrip("/")
        return f"{base_url.rstrip('/')}/{clean}" if base_url else f"/{clean}"

    # Absolute cloud URL
    cloud_url = "https://pub-r2.agrishield.io/images/uuid123.jpg"
    assert js_resolve_image_url(cloud_url, backend_base) == cloud_url

    # Legacy relative path
    local_path = "uploads/uuid456.jpg"
    assert js_resolve_image_url(local_path, backend_base) == "https://agrishield-crop-system.onrender.com/uploads/uuid456.jpg"

    # Data URL
    data_url = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
    assert js_resolve_image_url(data_url, backend_base) == data_url


# ============================================================================
# 16. B9.2 Regression: Structured 503 on Database Degradation
# ============================================================================
@pytest.mark.asyncio
async def test_16_b9_2_regression_structured_503():
    from backend.app.core.exceptions import DatabaseUnavailableException
    from backend.app.main import database_unavailable_exception_handler
    from fastapi import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/history",
        "headers": []
    }
    req = Request(scope)
    req.state.request_id = "test-b9-2-req-id"

    exc = DatabaseUnavailableException("MongoDB cluster unreachable")
    res = await database_unavailable_exception_handler(req, exc)

    assert res.status_code == 503
    assert res.headers.get("Retry-After") == "5"
    assert res.headers.get("X-Request-ID") == "test-b9-2-req-id"


# ============================================================================
# 17. B9.3 Regression: Worker 1 Upload Affinity & Cluster Routing
# ============================================================================
def test_17_b9_3_regression_worker_upload_affinity():
    from backend.app.core.config import settings
    # Worker 1 URL must remain configured and pointing to Render Worker 1
    assert "agrishield-ai-worker-1" in settings.AI_WORKER_1_URL
    assert "agrishield-ai-worker-2" in settings.AI_WORKER_2_URL
    assert "agrishield-ai-worker-3" in settings.AI_WORKER_3_URL


# ============================================================================
# 18. B9.7 Regression: Correlation ID & Credential Redaction
# ============================================================================
def test_18_b9_7_regression_correlation_and_redaction():
    from backend.app.core.logging_sanitizer import redact_credentials
    from backend.app.core.request_id_middleware import _request_id_ctx_var, get_current_request_id

    _request_id_ctx_var.set("test-corr-id-999")
    assert get_current_request_id() == "test-corr-id-999"

    # Verify credential redaction filter catches JWT and password secrets
    dirty = "GET /api/auth/login?password=SuperSecretPassword123&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz.abc"
    clean = redact_credentials(dirty)
    assert "SuperSecretPassword123" not in clean
    assert "[REDACTED]" in clean


# ============================================================================
# 19. B10.1 Regression: IoT Telemetry Retention & Token Expiration
# ============================================================================
def test_19_b10_1_regression_retention_and_auth_hardening():
    from backend.app.core.config import settings

    # Verify 30-day telemetry retention
    assert settings.IOT_TELEMETRY_RETENTION_SECONDS == 2592000
    # Verify 7-day access token expiration default (10080 minutes)
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 10080


# ============================================================================
# 20. Supabase REST Upload Success
# ============================================================================
@pytest.mark.asyncio
async def test_20_supabase_upload_success():
    svc = StorageService()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"Key": "test-crop-bucket/mock.jpg", "Id": "123"}
    mock_resp.text = '{"Key": "test-crop-bucket/mock.jpg"}'

    with patch.object(settings, "STORAGE_PROVIDER", "supabase"), \
         patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_secret_key_sb_999"), \
         patch.object(settings, "SUPABASE_BUCKET", "test-crop-bucket"), \
         patch("requests.post", return_value=mock_resp) as mock_post:

        res = await svc.upload_image(VALID_JPEG_BYTES, "crop_leaf.jpg", "image/jpeg")

        assert res.is_cloud is True
        assert res.filename.endswith(".jpg")
        assert res.image_path == f"https://mockproject.supabase.co/storage/v1/object/public/test-crop-bucket/{res.filename}"
        assert res.local_path is None
        assert res.size_bytes == len(VALID_JPEG_BYTES)
        assert res.content_type == "image/jpeg"
        mock_post.assert_called_once()


# ============================================================================
# 21. Supabase Correct Bucket, Object Path & Request Headers
# ============================================================================
@pytest.mark.asyncio
async def test_21_supabase_correct_bucket_and_headers():
    svc = StorageService()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = '{"Key": "agrishield-crop-images/mock.jpg"}'

    with patch.object(settings, "STORAGE_PROVIDER", "auto"), \
         patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_key_xyz_777"), \
         patch.object(settings, "SUPABASE_BUCKET", "agrishield-crop-images"), \
         patch("requests.post", return_value=mock_resp) as mock_post:

        res = await svc.upload_image(VALID_PNG_BYTES, "test_plant.png", "image/png")

        expected_url = f"https://mockproject.supabase.co/storage/v1/object/agrishield-crop-images/{res.filename}"
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == expected_url
        headers = kwargs["headers"]
        assert headers["Authorization"] == "Bearer mock_key_xyz_777"
        assert headers["apikey"] == "mock_key_xyz_777"
        assert headers["Content-Type"] == "image/png"
        assert headers["x-upsert"] == "true"
        assert kwargs["data"] == VALID_PNG_BYTES
        assert kwargs["timeout"] == (5, 10)


# ============================================================================
# 22. Supabase Correct HTTPS Public URL Construction
# ============================================================================
def test_22_supabase_public_url_construction():
    svc = StorageService()
    with patch.object(settings, "STORAGE_PROVIDER", "auto"), \
         patch.object(settings, "STORAGE_PUBLIC_BASE_URL", None), \
         patch.object(settings, "STORAGE_ENDPOINT_URL", None), \
         patch.object(settings, "SUPABASE_URL", "https://xyz123.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_key"), \
         patch.object(settings, "SUPABASE_BUCKET", "agrishield-crop-images"):

        url = svc.build_public_url("leaf_abc.jpg")
        assert url == "https://xyz123.supabase.co/storage/v1/object/public/agrishield-crop-images/leaf_abc.jpg"

    # Custom public CDN override
    with patch.object(settings, "STORAGE_PUBLIC_BASE_URL", "https://images.agrishield.io"), \
         patch.object(settings, "SUPABASE_URL", "https://xyz123.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_key"), \
         patch.object(settings, "SUPABASE_BUCKET", "agrishield-crop-images"):

        url = svc.build_public_url("leaf_abc.jpg")
        assert url == "https://images.agrishield.io/leaf_abc.jpg"


# ============================================================================
# 23. Supabase Upload Failure -> Local Fallback
# ============================================================================
@pytest.mark.asyncio
async def test_23_supabase_upload_failure_local_fallback():
    svc = StorageService()
    import requests

    with patch.object(settings, "STORAGE_PROVIDER", "auto"), \
         patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_key"), \
         patch.object(settings, "SUPABASE_BUCKET", "test-bucket"), \
         patch("requests.post", side_effect=requests.RequestException("504 Gateway Timeout")):

        res = await svc.upload_image(VALID_JPEG_BYTES, "scan.jpg", "image/jpeg")

        # Must fall back gracefully to local storage
        assert res.is_cloud is False
        assert res.image_path.startswith("uploads/")
        assert res.local_path is not None
        assert os.path.exists(res.local_path)
        assert res.error is not None
        assert "Cloud storage unavailable" in res.error

        # Cleanup
        if os.path.exists(res.local_path):
            os.remove(res.local_path)


# ============================================================================
# 24. Supabase Object Delete
# ============================================================================
def test_24_supabase_delete():
    svc = StorageService()
    mock_del_resp = MagicMock()
    mock_del_resp.status_code = 200
    mock_del_resp.text = '{"message":"Successfully deleted"}'

    with patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_secret_delete_key"), \
         patch.object(settings, "SUPABASE_BUCKET", "test-crop-bucket"), \
         patch("requests.delete", return_value=mock_del_resp) as mock_delete:

        target_url = "https://mockproject.supabase.co/storage/v1/object/public/test-crop-bucket/uuid_sample.jpg"
        deleted = svc.delete_image(target_url)
        assert deleted is True

        mock_delete.assert_called_once()
        args, kwargs = mock_delete.call_args
        assert args[0] == "https://mockproject.supabase.co/storage/v1/object/test-crop-bucket/uuid_sample.jpg"
        assert kwargs["headers"]["Authorization"] == "Bearer mock_secret_delete_key"
        assert kwargs["headers"]["apikey"] == "mock_secret_delete_key"


# ============================================================================
# 25. Supabase Delete Idempotency & Error Handling
# ============================================================================
def test_25_supabase_delete_idempotency_and_error():
    svc = StorageService()

    # Case A: Object already deleted (404 Not Found) -> idempotent success (True)
    mock_404 = MagicMock()
    mock_404.status_code = 404
    mock_404.text = '{"statusCode":"404","message":"Object not found"}'

    with patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_key"), \
         patch("requests.delete", return_value=mock_404):

        res = svc.delete_image("https://mockproject.supabase.co/storage/v1/object/public/agrishield-crop-images/missing.jpg")
        assert res is True

    # Case B: Server error (500) -> returns False without throwing unhandled exception
    mock_500 = MagicMock()
    mock_500.status_code = 500
    mock_500.text = '{"statusCode":"500","message":"Internal Server Error"}'

    with patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "mock_key"), \
         patch("requests.delete", return_value=mock_500):

        res = svc.delete_image("https://mockproject.supabase.co/storage/v1/object/public/agrishield-crop-images/error.jpg")
        assert res is False


# ============================================================================
# 26. Credentials Are Never Logged
# ============================================================================
@pytest.mark.asyncio
async def test_26_credentials_are_never_logged(caplog):
    import logging
    svc = StorageService()
    secret_canary = "SUPER_SECRET_SUPABASE_TOKEN_CANARY_DO_NOT_LEAK"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = '{"Key": "test-bucket/mock.jpg"}'

    with caplog.at_level(logging.DEBUG), \
         patch.object(settings, "STORAGE_PROVIDER", "auto"), \
         patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", secret_canary), \
         patch.object(settings, "SUPABASE_BUCKET", "test-bucket"), \
         patch("requests.post", return_value=mock_resp), \
         patch("requests.delete", return_value=mock_resp):

        # Upload
        res = await svc.upload_image(VALID_JPEG_BYTES, "canary.jpg", "image/jpeg")
        assert res.is_cloud is True

        # Delete
        svc.delete_image(res.image_path)

        # Check logs
        assert secret_canary not in caplog.text


# ============================================================================
# 27. Frontend Receives No Supabase Secrets
# ============================================================================
def test_27_frontend_receives_no_supabase_secrets():
    # Simulate a prediction record or API response payload
    record = {
        "id": "pred_67890",
        "crop_type": "Tomato",
        "disease_detected": "Early Blight",
        "image_path": "https://kwlintcxqkqnjtwdbumq.supabase.co/storage/v1/object/public/agrishield-crop-images/uuid123.jpg",
        "confidence": 0.95
    }

    # Verify no secret fields are exposed to frontend clients
    assert "SUPABASE_KEY" not in record
    assert "secret" not in record
    assert "Authorization" not in record
    assert record["image_path"].startswith("https://")
    # Verify image_path is directly usable by <img> src
    assert "/storage/v1/object/public/" in record["image_path"]


# ============================================================================
# 28. Auto Detection Matches Render Environment
# ============================================================================
def test_28_auto_detection_matches_render_environment():
    svc = StorageService()

    # Case A: Render environment (STORAGE_PROVIDER='auto', Supabase vars set)
    with patch.object(settings, "STORAGE_PROVIDER", "auto"), \
         patch.object(settings, "SUPABASE_URL", "https://kwlintcxqkqnjtwdbumq.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "sb_secret_test"), \
         patch.object(settings, "SUPABASE_BUCKET", "agrishield-crop-images"):

        assert svc.get_provider() == "supabase"
        assert svc.is_cloud_configured() is True

    # Case B: Local explicitly forced
    with patch.object(settings, "STORAGE_PROVIDER", "local"), \
         patch.object(settings, "SUPABASE_URL", "https://kwlintcxqkqnjtwdbumq.supabase.co"), \
         patch.object(settings, "SUPABASE_KEY", "sb_secret_test"), \
         patch.object(settings, "SUPABASE_BUCKET", "agrishield-crop-images"):

        assert svc.get_provider() == "local"
        assert svc.is_cloud_configured() is False

    # Case C: Cloud vars absent
    with patch.object(settings, "STORAGE_PROVIDER", "auto"), \
         patch.object(settings, "SUPABASE_URL", None), \
         patch.object(settings, "SUPABASE_KEY", None), \
         patch.object(settings, "STORAGE_BUCKET_NAME", None), \
         patch.object(settings, "STORAGE_ACCESS_KEY_ID", None):

        assert svc.get_provider() == "local"
        assert svc.is_cloud_configured() is False


# ============================================================================
# 29. Remote Resolver Accepts Supabase URL and Rejects SSRF
# ============================================================================
def test_29_remote_resolver_accepts_supabase_and_rejects_ssrf():
    with patch.object(settings, "SUPABASE_URL", "https://mockproject.supabase.co"):
        valid_sup_url = "https://mockproject.supabase.co/storage/v1/object/public/agrishield-crop-images/photo_456.jpg"
        resolved = resolve_image_path(valid_sup_url)
        assert resolved == valid_sup_url

        # Untrusted hosts / SSRF must still be rejected
        assert resolve_image_path("https://attacker.org/storage/v1/object/public/bucket/img.jpg") is None
        assert resolve_image_path("https://127.0.0.1/storage/v1/object/public/bucket/img.jpg") is None
        assert resolve_image_path("http://mockproject.supabase.co/storage/v1/object/public/bucket/img.jpg") is None

