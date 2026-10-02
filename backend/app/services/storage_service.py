"""
AgriShield Persistent Cloud Storage Service (B10.2)
===================================================
Provides modular, provider-agnostic object storage with S3-compatible protocol (Cloudflare R2,
AWS S3, MinIO, Supabase S3) and automatic zero-disruption local filesystem fallback.

Guarantees:
1. Secure UUID-based object naming with zero client-controlled key injection.
2. Durable HTTPS CDN URLs on cloud success; local 'uploads/...' relative paths on fallback.
3. Transactional integrity: AI inference proceeds seamlessly even during transient cloud outages.
4. Idempotent deletion across cloud objects and legacy local disk files.
5. Strict SSRF protection and URL validation for remote references.
"""

import os
import uuid
import logging
import urllib.parse
import urllib.request
from typing import Optional, Tuple
from dataclasses import dataclass

from backend.app.core.config import settings
from backend.app.core.request_id_middleware import get_current_request_id

logger = logging.getLogger("agrishield.storage")

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
}

MAGIC_BYTES = {
    "jpeg": b"\xff\xd8\xff",
    "png": b"\x89PNG\r\n\x1a\n",
    "webp_prefix": b"RIFF",
    "webp_sub": b"WEBP"
}


class StorageException(Exception):
    """Raised when both primary cloud storage and local storage fail."""
    pass


@dataclass
class StorageUploadResult:
    """Encapsulates the persistent storage outcome."""
    image_path: str         # Authoritative reference stored in MongoDB (HTTPS URL or uploads/...)
    is_cloud: bool          # True if successfully uploaded to cloud object storage
    filename: str           # Unique UUID-based object filename
    content_type: str       # MIME type
    size_bytes: int         # Payload size in bytes
    local_path: Optional[str] = None  # Local filesystem path if available locally
    error: Optional[str] = None       # Error message if local fallback occurred


class StorageService:
    """
    Unified Object Storage Adapter.
    Supports:
    - Provider 'local': Standard local container storage (canonical_upload_dir)
    - Provider 'r2' / 's3': S3-compatible cloud object storage via boto3
    """

    def __init__(self):
        self._s3_client = None

    def is_cloud_configured(self) -> bool:
        """Determines if valid cloud storage credentials are configured."""
        provider = (settings.STORAGE_PROVIDER or "local").lower().strip()
        if provider not in ("r2", "s3"):
            return False

        has_bucket = bool(settings.STORAGE_BUCKET_NAME)
        has_keys = bool(settings.STORAGE_ACCESS_KEY_ID and settings.STORAGE_SECRET_ACCESS_KEY)
        return has_bucket and has_keys

    def _get_s3_client(self):
        """Lazy initialization of boto3 S3 client with strict bounded timeouts."""
        if self._s3_client is not None:
            return self._s3_client

        if not self.is_cloud_configured():
            return None

        try:
            import boto3
            import botocore.config

            connect_timeout = getattr(settings, "STORAGE_CONNECT_TIMEOUT_SECONDS", 5)
            read_timeout = getattr(settings, "STORAGE_READ_TIMEOUT_SECONDS", 10)

            client_config = botocore.config.Config(
                connect_timeout=connect_timeout,
                read_timeout=read_timeout,
                retries={"max_attempts": 2, "mode": "standard"},
                s3={"addressing_style": "path"}
            )

            client_kwargs = {
                "service_name": "s3",
                "aws_access_key_id": settings.STORAGE_ACCESS_KEY_ID,
                "aws_secret_access_key": settings.STORAGE_SECRET_ACCESS_KEY,
                "config": client_config
            }

            if settings.STORAGE_ENDPOINT_URL:
                client_kwargs["endpoint_url"] = settings.STORAGE_ENDPOINT_URL

            self._s3_client = boto3.client(**client_kwargs)
            logger.info(f"Initialized S3 storage client for provider '{settings.STORAGE_PROVIDER}' (Bucket: {settings.STORAGE_BUCKET_NAME})")
            return self._s3_client
        except Exception as e:
            req_id = get_current_request_id()
            logger.error(f"[STORAGE INIT ERROR] [{req_id}] Failed to initialize boto3 S3 client: {e.__class__.__name__}: {str(e)}")
            return None

    @staticmethod
    def detect_extension(content_bytes: bytes, original_filename: str = "") -> str:
        """Determines genuine image extension via magic bytes signature."""
        if content_bytes.startswith(MAGIC_BYTES["jpeg"]):
            return ".jpg"
        elif content_bytes.startswith(MAGIC_BYTES["png"]):
            return ".png"
        elif content_bytes.startswith(MAGIC_BYTES["webp_prefix"]) and len(content_bytes) >= 12 and content_bytes[8:12] == MAGIC_BYTES["webp_sub"]:
            return ".webp"

        # Fallback to sanitized extension of original filename
        if original_filename:
            _, ext = os.path.splitext(original_filename.lower().strip())
            if ext in ALLOWED_IMAGE_EXTENSIONS:
                return ".jpg" if ext == ".jpeg" else ext

        return ".jpg"

    @classmethod
    def generate_object_name(cls, content_bytes: bytes, original_filename: str = "") -> str:
        """Generates an unguessable 128-bit UUID-based object key."""
        ext = cls.detect_extension(content_bytes, original_filename)
        return f"{uuid.uuid4().hex}{ext}"

    def build_public_url(self, object_name: str) -> str:
        """Constructs the durable public HTTPS CDN URL for the uploaded object."""
        if settings.STORAGE_PUBLIC_BASE_URL:
            return f"{settings.STORAGE_PUBLIC_BASE_URL.rstrip('/')}/{object_name}"
        elif settings.STORAGE_ENDPOINT_URL:
            endpoint = settings.STORAGE_ENDPOINT_URL.rstrip('/')
            bucket = settings.STORAGE_BUCKET_NAME
            return f"{endpoint}/{bucket}/{object_name}"
        else:
            bucket = settings.STORAGE_BUCKET_NAME or "agrishield"
            return f"https://{bucket}.s3.amazonaws.com/{object_name}"

    def _save_local_file(self, content_bytes: bytes, object_name: str) -> Tuple[str, str]:
        """Saves image bytes to the canonical local upload directory."""
        upload_dir = settings.canonical_upload_dir
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, object_name)
        with open(local_path, "wb") as f:
            f.write(content_bytes)
        relative_path = f"uploads/{object_name}"
        return relative_path, local_path

    async def upload_image(
        self,
        content_bytes: bytes,
        original_filename: str = "",
        content_type: str = "image/jpeg"
    ) -> StorageUploadResult:
        """
        Uploads image to cloud object storage if configured, with automatic local fallback.
        Returns a StorageUploadResult containing the authoritative image_path.
        """
        object_name = self.generate_object_name(content_bytes, original_filename)
        size_bytes = len(content_bytes)
        req_id = get_current_request_id()

        # Normalize content type
        normalized_content_type = content_type or "image/jpeg"
        if normalized_content_type == "application/octet-stream":
            ext = os.path.splitext(object_name)[1].lower()
            if ext == ".png":
                normalized_content_type = "image/png"
            elif ext == ".webp":
                normalized_content_type = "image/webp"
            else:
                normalized_content_type = "image/jpeg"

        # Path 1: Cloud Storage Configured
        if self.is_cloud_configured():
            client = self._get_s3_client()
            if client is not None:
                try:
                    import asyncio
                    # Run blocking boto3 upload in threadpool with bounded timeout
                    await asyncio.to_thread(
                        client.put_object,
                        Bucket=settings.STORAGE_BUCKET_NAME,
                        Key=object_name,
                        Body=content_bytes,
                        ContentType=normalized_content_type
                    )
                    public_url = self.build_public_url(object_name)
                    logger.info(f"[STORAGE UPLOAD] [{req_id}] Successfully uploaded {object_name} to cloud storage ({size_bytes} bytes)")
                    return StorageUploadResult(
                        image_path=public_url,
                        is_cloud=True,
                        filename=object_name,
                        content_type=normalized_content_type,
                        size_bytes=size_bytes,
                        local_path=None
                    )
                except Exception as cloud_err:
                    logger.error(
                        f"[STORAGE FALLBACK] [{req_id}] Cloud storage upload failed: "
                        f"{cloud_err.__class__.__name__}: {str(cloud_err)}. Falling back to local storage."
                    )
                    # Proceed to local fallback

        # Path 2: Local Storage (Default or Fallback)
        try:
            rel_path, local_path = self._save_local_file(content_bytes, object_name)
            logger.info(f"[STORAGE LOCAL] [{req_id}] Stored {object_name} locally at {rel_path} ({size_bytes} bytes)")
            return StorageUploadResult(
                image_path=rel_path,
                is_cloud=False,
                filename=object_name,
                content_type=normalized_content_type,
                size_bytes=size_bytes,
                local_path=local_path,
                error="Cloud storage unavailable; stored on local filesystem." if self.is_cloud_configured() else None
            )
        except Exception as local_err:
            logger.critical(
                f"[STORAGE CATASTROPHIC] [{req_id}] Both cloud and local storage writes failed: "
                f"{local_err.__class__.__name__}: {str(local_err)}"
            )
            raise StorageException(f"Failed to persist image to storage: {local_err}")

    def delete_image(self, image_path: str) -> bool:
        """
        Deletes an image by path (Cloud URL or legacy relative path).
        Idempotent: returns True even if object was already deleted.
        """
        if not image_path:
            return False

        req_id = get_current_request_id()

        # Case A: Remote Cloud URL
        if image_path.startswith("http://") or image_path.startswith("https://"):
            try:
                parsed = urllib.parse.urlparse(image_path)
                key = os.path.basename(parsed.path)
                client = self._get_s3_client()
                if client is not None and key and settings.STORAGE_BUCKET_NAME:
                    client.delete_object(Bucket=settings.STORAGE_BUCKET_NAME, Key=key)
                    logger.info(f"[STORAGE DELETE] [{req_id}] Deleted cloud object {key}")
                    return True
            except Exception as e:
                logger.warning(f"[STORAGE DELETE WARNING] [{req_id}] Failed to delete cloud object for {image_path}: {e}")
                return False
            return True

        # Case B: Legacy Local Path (uploads/filename)
        clean_rel = image_path.replace("/", os.sep).lstrip(os.sep)
        filename = os.path.basename(clean_rel)
        local_path = os.path.join(settings.canonical_upload_dir, filename)

        if os.path.exists(local_path):
            try:
                os.remove(local_path)
                logger.info(f"[STORAGE DELETE] [{req_id}] Removed local file {local_path}")
                return True
            except Exception as e:
                logger.warning(f"[STORAGE DELETE WARNING] [{req_id}] Could not delete local file {local_path}: {e}")
                return False

        return True

    @staticmethod
    def is_trusted_remote_url(url: str) -> bool:
        """
        Validates remote image URL against SSRF and untrusted host attacks.
        Rules:
        - Scheme must be strictly HTTPS.
        - Host must not be localhost, private IPs, or internal cloud metadata services.
        - Extension must be an allowed image format.
        - Host must match configured trusted storage domains.
        """
        if not url or not isinstance(url, str):
            return False

        if not url.startswith("https://"):
            return False

        try:
            parsed = urllib.parse.urlparse(url)
            host = (parsed.hostname or "").lower()
            if not host:
                return False

            # Block SSRF: localhost, loopback, private ranges, link-local, AWS/Render metadata
            forbidden_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "metadata.google.internal"}
            if host in forbidden_hosts or host.endswith(".local") or host.endswith(".internal"):
                return False

            # Check valid image extension in path
            ext = os.path.splitext(parsed.path.lower())[1]
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                return False

            # Match against configured trusted storage domains
            trusted_domains = set()
            for conf_url in (settings.STORAGE_PUBLIC_BASE_URL, settings.STORAGE_ENDPOINT_URL, getattr(settings, "SUPABASE_URL", None)):
                if conf_url:
                    p = urllib.parse.urlparse(conf_url)
                    if p.hostname:
                        trusted_domains.add(p.hostname.lower())

            # If R2/S3 bucket name is set, also trust {bucket}.s3.amazonaws.com or {account}.r2.cloudflarestorage.com
            if settings.STORAGE_BUCKET_NAME:
                trusted_domains.add(f"{settings.STORAGE_BUCKET_NAME.lower()}.s3.amazonaws.com")

            if not trusted_domains:
                # If no cloud storage is configured, remote URLs cannot be trusted blindly
                return False

            for trusted in trusted_domains:
                if host == trusted or host.endswith(f".{trusted}"):
                    return True

            return False
        except Exception:
            return False

    @classmethod
    def ensure_local_cache_for_inference(cls, image_path: str) -> Optional[str]:
        """
        Ensures an image is accessible on local disk for PyTorch / OpenCV neural inference.
        If image is an HTTPS URL, downloads and verifies magic bytes, caching in canonical_upload_dir.
        """
        if not image_path:
            return None

        # 1. Local path
        if not (image_path.startswith("http://") or image_path.startswith("https://")):
            clean_rel = image_path.replace("/", os.sep).lstrip(os.sep)
            filename = os.path.basename(clean_rel)
            local_path = os.path.join(settings.canonical_upload_dir, filename)
            if os.path.exists(local_path):
                return local_path
            # Check secondary paths
            from backend.app.services.image_resolver import resolve_image_path
            return resolve_image_path(image_path)

        # 2. Remote URL: Validate security
        if not cls.is_trusted_remote_url(image_path):
            logger.warning(f"[STORAGE SECURITY] Rejected untrusted remote image URL: {image_path}")
            return None

        # Check if already cached locally
        parsed = urllib.parse.urlparse(image_path)
        filename = os.path.basename(parsed.path)
        cached_path = os.path.join(settings.canonical_upload_dir, filename)
        if os.path.exists(cached_path) and os.path.getsize(cached_path) > 32:
            return cached_path

        # Stream and cache locally
        try:
            req = urllib.request.Request(
                image_path,
                headers={"User-Agent": "AgriShield-Storage-Inference/1.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if data and len(data) > 32:
                        # Verify genuine image magic bytes
                        is_valid = (
                            data.startswith(MAGIC_BYTES["jpeg"]) or
                            data.startswith(MAGIC_BYTES["png"]) or
                            (data.startswith(MAGIC_BYTES["webp_prefix"]) and len(data) >= 12 and data[8:12] == MAGIC_BYTES["webp_sub"])
                        )
                        if not is_valid:
                            logger.warning(f"Downloaded image {filename} failed magic bytes verification.")
                            return None

                        os.makedirs(settings.canonical_upload_dir, exist_ok=True)
                        with open(cached_path, "wb") as f:
                            f.write(data)
                        return cached_path
        except Exception as e:
            logger.error(f"Failed to cache remote image {image_path} for inference: {e}")
            return None

        return None


# Global singleton instance
storage_service = StorageService()
