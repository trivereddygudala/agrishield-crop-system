from datetime import timezone
import os
import re
import uuid
import io
from fastapi import UploadFile, HTTPException, status
from PIL import Image
import cv2
import numpy as np

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

MAGIC_BYTES = {
    "jpeg": b"\xff\xd8\xff",
    "png": b"\x89PNG\r\n\x1a\n",
    "webp_prefix": b"RIFF",
    "webp_sub": b"WEBP"
}

def sanitize_filename(original_filename: str) -> str:
    """Sanitize original filename to eliminate path traversal, double extensions, and dangerous chars."""
    if not original_filename:
        return f"{uuid.uuid4().hex}.jpg"
    
    # Null byte check
    if "\x00" in original_filename or "%00" in original_filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Null byte in filename detected.")

    # Path traversal check
    if ".." in original_filename or "/" in original_filename or "\\" in original_filename:
        original_filename = os.path.basename(original_filename)

    # Check for multiple dots / double extension attack (e.g. evil.php.jpg)
    parts = original_filename.split(".")
    if len(parts) > 2:
        dangerous_exts = {"php", "exe", "dll", "js", "html", "sh", "py", "pl", "cgi", "svg", "zip"}
        for p in parts[1:-1]:
            if p.lower() in dangerous_exts:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Dangerous double extension .{p} detected in filename."
                )

    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Return secure UUID based filename
    return f"{uuid.uuid4().hex}{ext}"

def verify_magic_bytes(content: bytes, extension: str) -> bool:
    """Verify magic bytes match the stated image format."""
    if not content or len(content) < 12:
        return False

    ext = extension.lower()
    if ext in [".jpg", ".jpeg"]:
        return content.startswith(MAGIC_BYTES["jpeg"])
    elif ext == ".png":
        return content.startswith(MAGIC_BYTES["png"])
    elif ext == ".webp":
        return content.startswith(MAGIC_BYTES["webp_prefix"]) and content[8:12] == MAGIC_BYTES["webp_sub"]

    return False

def scan_file_for_viruses(content_bytes: bytes) -> bool:
    """Placeholder hook for virus scanning integration. Returns True if clean."""
    dangerous_signatures = [b"<?php", b"<script", b"#!/bin/sh", b"eval(", b"system("]
    for sig in dangerous_signatures:
        if sig in content_bytes[:1024]:
            return False
    return True

async def validate_image_upload(file: UploadFile) -> tuple[bytes, str]:
    """
    Comprehensive image upload validation:
    1. Size verification (<= 15MB)
    2. MIME type check
    3. Extension check & sanitization
    4. Magic Bytes check
    5. PIL decode verification
    6. OpenCV decode verification
    7. Antivirus scan check
    Returns (content_bytes, safe_filename).
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided.")

    # 1. MIME check
    content_type = file.content_type or ""
    if content_type.lower() not in ALLOWED_MIME_TYPES and content_type != "application/octet-stream":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid MIME type '{content_type}'. Must be JPEG, PNG, or WEBP."
        )

    # 2. Filename sanitization & Extension check
    safe_filename = sanitize_filename(file.filename)
    ext = os.path.splitext(safe_filename)[1].lower()

    # 3. Read content and check file size limit
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum threshold of 15 MB."
        )

    if len(content) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file: file size is too small."
        )

    # 4. Magic Bytes Verification
    if not verify_magic_bytes(content, ext):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match genuine image magic byte signature."
        )

    # 5. Antivirus / Malicious Script Scan
    if not scan_file_for_viruses(content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File rejected due to suspicious embedded payload."
        )

    # 6. PIL Verification
    try:
        image = Image.open(io.BytesIO(content))
        image.verify()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image decoding failed (PIL): file may be corrupted or malformed. {str(e)}"
        )

    # 7. OpenCV Matrix Decoding Verification
    try:
        nparr = np.frombuffer(content, np.uint8)
        img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_np is None or img_np.size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image decoding failed (OpenCV): invalid image matrix."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image decoding failed (OpenCV): {str(e)}"
        )

    # 8. Leaf Foliage & Dimension Validation (Input Validation)
    # Ensure image has sufficient resolution for CNN feature extraction (at least 64x64)
    height, width = img_np.shape[:2]
    if height < 64 or width < 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image resolution is too low. Please upload a clear photo of at least 64x64 pixels."
        )

    # Note: Rigid green-pixel ratio thresholds are intentionally avoided here because
    # critical crop diseases cause brown blight, necrotic lesions, yellow chlorosis,
    # or white powdery mildew, or may be photographed against soil, tables, or screens.
    # The AI EfficientNetV2 model classifies all pathology variations natively.

    return content, safe_filename
