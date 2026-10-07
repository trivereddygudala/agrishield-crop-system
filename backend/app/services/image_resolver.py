"""
AgriShield Cross-Worker Image Resolver Service
=============================================
Provides unified local image resolution and secure cluster-wide cross-worker image streaming.
Decouples AI worker nodes (Worker 2 Plant-ID, Worker 3 Agrochemical OCR) from the upload worker
(Worker 1) filesystem isolation on Render without requiring external object storage.
"""

import os
import urllib.request
import logging
from typing import Optional
from backend.app.core.config import settings

import base64
import hashlib

logger = logging.getLogger("agrishield.image_resolver")

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def _decode_base64_image(b64_str: str) -> Optional[str]:
    """
    Safely decodes and validates a base64 or data-URL image payload.
    Caches the decoded image in canonical_upload_dir and returns the local path.
    Enforces maximum size (15MB) and strict magic-byte validation.
    """
    try:
        if "," in b64_str:
            _, b64_data = b64_str.split(",", 1)
        else:
            b64_data = b64_str

        raw_bytes = base64.b64decode(b64_data.strip())
        if not raw_bytes or len(raw_bytes) < 32 or len(raw_bytes) > 15 * 1024 * 1024:
            logger.warning("[IMAGE RESOLVER] Base64 payload invalid size.")
            return None

        ext = None
        if raw_bytes.startswith(b"\xff\xd8\xff"):
            ext = ".jpg"
        elif raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            ext = ".png"
        elif raw_bytes.startswith(b"RIFF") and len(raw_bytes) >= 12 and raw_bytes[8:12] == b"WEBP":
            ext = ".webp"
        else:
            logger.warning("[IMAGE RESOLVER] Base64 image payload failed magic bytes validation.")
            return None

        h = hashlib.sha256(raw_bytes).hexdigest()[:16]
        filename = f"b64_{h}{ext}"
        canonical_dir = settings.canonical_upload_dir
        os.makedirs(canonical_dir, exist_ok=True)
        local_path = os.path.join(canonical_dir, filename)
        if not os.path.exists(local_path):
            with open(local_path, "wb") as f:
                f.write(raw_bytes)
            logger.info(f"[IMAGE RESOLVER] Decoded and cached cross-worker base64 payload to {local_path} ({len(raw_bytes)} bytes)")
        return local_path
    except Exception as e:
        logger.warning(f"[IMAGE RESOLVER] Failed to decode base64 image: {e}")
        return None

def resolve_image_path(image_path: str) -> Optional[str]:
    """
    Resolves the absolute filesystem path for an image.
    1. Checks if payload is base64 data URL and caches it locally.
    2. Checks the canonical upload directory (backend/uploads/).
    3. Checks legacy local paths (backend/app/uploads/ and repo-relative paths).
    4. If running in a distributed cluster and the file is missing locally,
       safely streams the image from Worker 1, Worker 3, or Main Backend
       and caches it in the canonical upload directory.
    """
    if not image_path or not isinstance(image_path, str):
        return None

    path_lower = image_path.lower().strip()

    # D2.5 RC09: Cross-worker base64 image resolution
    if path_lower.startswith("data:image/") or path_lower.startswith("data:application/octet-stream;base64,"):
        return _decode_base64_image(image_path)
    if path_lower.startswith("/9j/") or path_lower.startswith("ivborw") or path_lower.startswith("uklgr"):
        return _decode_base64_image(image_path)

    # Reject dangerous / unsupported URL schemes (B10.2 Security)
    unsupported_schemes = ("file:", "ftp:", "javascript:", "http:")
    for scheme in unsupported_schemes:
        if path_lower.startswith(scheme):
            logger.warning(f"[IMAGE RESOLVER SECURITY] Rejected unsupported scheme: {image_path}")
            return None

    # Handle Trusted Remote Cloud Storage URLs (B10.2)
    if path_lower.startswith("https://"):
        from backend.app.services.storage_service import StorageService
        if not StorageService.is_trusted_remote_url(image_path):
            logger.warning(f"[IMAGE RESOLVER SECURITY] Rejected untrusted remote image URL: {image_path}")
            return None
        # Return valid remote URL directly without downloading
        return image_path

    clean_rel = image_path.replace("/", os.sep).lstrip(os.sep)
    filename = os.path.basename(clean_rel)

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        logger.warning(f"Unsupported image extension for resolution: {filename}")
        return None

    canonical_dir = settings.canonical_upload_dir
    local_canonical_path = os.path.join(canonical_dir, filename)
    if os.path.exists(local_canonical_path):
        return local_canonical_path

    # Secondary local legacy candidates
    backend_dir = os.path.dirname(canonical_dir)
    repo_root = os.path.dirname(backend_dir)
    legacy_candidates = [
        os.path.join(backend_dir, "app", "uploads", filename),
        os.path.join(backend_dir, clean_rel),
        os.path.join(repo_root, clean_rel),
        os.path.abspath(image_path)
    ]
    for p in legacy_candidates:
        if os.path.exists(p):
            return p

    # Cluster Cross-Worker Authenticated Fetch Fallback
    from backend.app.core.config import get_worker_internal_secret
    internal_secret = get_worker_internal_secret()

    candidate_urls = [
        f"{settings.AI_WORKER_1_URL.rstrip('/')}/api/worker/image/{filename}",
        f"{settings.AI_WORKER_1_URL.rstrip('/')}/worker/image/{filename}",
        f"{settings.AI_WORKER_3_URL.rstrip('/')}/api/worker/image/{filename}",
        f"{settings.AI_WORKER_3_URL.rstrip('/')}/worker/image/{filename}",
        f"https://agrishield-crop-system.onrender.com/api/worker/image/{filename}",
        f"{settings.AI_WORKER_1_URL.rstrip('/')}/uploads/{filename}",
        f"{settings.AI_WORKER_3_URL.rstrip('/')}/uploads/{filename}",
    ]

    for url in candidate_urls:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "AgriShield-Cluster-ImageResolver/1.0",
                    "X-Worker-Key": internal_secret
                }
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if data and len(data) > 32:
                        # Validate genuine image magic bytes (JPEG, PNG, WebP)
                        is_valid_img = (
                            data.startswith(b"\xff\xd8\xff") or
                            data.startswith(b"\x89PNG\r\n\x1a\n") or
                            (data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP")
                        )
                        if not is_valid_img:
                            logger.warning(f"Downloaded payload for {filename} from {url} failed magic byte validation.")
                            continue

                        with open(local_canonical_path, "wb") as f:
                            f.write(data)
                        logger.info(f"Resolved and cached {filename} from cluster node {url} ({len(data)} bytes)")
                        return local_canonical_path
        except Exception as e:
            logger.debug(f"Could not fetch {filename} from {url}: {e}")
    return None
