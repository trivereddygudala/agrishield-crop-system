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

logger = logging.getLogger("agrishield.image_resolver")

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def resolve_image_path(image_path: str) -> Optional[str]:
    """
    Resolves the absolute filesystem path for an image.
    1. Checks the canonical upload directory (backend/uploads/).
    2. Checks legacy local paths (backend/app/uploads/ and repo-relative paths).
    3. If running in a distributed cluster and the file is missing locally,
       safely streams the image from Worker 1, Worker 3, or Main Backend
       and caches it in the canonical upload directory.
    """
    if not image_path:
        return None

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
