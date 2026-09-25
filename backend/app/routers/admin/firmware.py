import os
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Query
from fastapi.responses import FileResponse
from bson import ObjectId

from backend.app.db.mongodb import get_database
from backend.app.core.security import require_role
from backend.app.models.firmware import (
    FirmwareMetadata, FirmwareUploadResponse, FirmwareListResponse, OtaAuditLogEntry
)
from backend.app.services.firmware_service import (
    get_firmware_storage_dir, compare_versions, calculate_sha256,
    is_hardware_compatible, validate_firmware_file, log_ota_audit
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/firmware", tags=["Firmware & OTA Management"])

@router.post("/upload", response_model=FirmwareUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_firmware(
    file: UploadFile = File(..., description="ESP32 firmware binary file (.bin)"),
    version: str = Form(..., description="Semantic version string (e.g., v2.1.0)"),
    hardware_model: str = Form("ESP32 DevKit V1", description="Target hardware model or '*'"),
    release_notes: str = Form("", description="Description of new features or fixes"),
    is_active: bool = Form(True, description="Make release immediately active for OTA"),
    current_user: dict = Depends(require_role("admin")),
    db = Depends(get_database)
):
    """
    Secure Admin Endpoint: Upload a new OTA firmware release binary.
    """
    content = await file.read()
    validate_firmware_file(file.filename, content)
    
    version_clean = version.strip()
    hw_model_clean = hardware_model.strip()
    
    # Check if version already exists for this hardware model
    existing = await db["firmware_releases"].find_one({
        "version": version_clean,
        "hardware_model": hw_model_clean
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Firmware release version {version_clean} already exists for hardware model '{hw_model_clean}'."
        )
        
    sha256_hash = calculate_sha256(content)
    
    # Save file securely to storage directory
    storage_dir = get_firmware_storage_dir()
    safe_filename = f"ESP32_{version_clean.replace('.', '_')}_{sha256_hash[:8]}.bin"
    file_path = os.path.join(storage_dir, safe_filename)
    
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to save firmware binary to disk: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to write firmware binary file to storage."
        )
        
    uploader = current_user.get("email", str(current_user.get("sub", "admin")))
    now = datetime.now(timezone.utc)
    
    doc = {
        "version": version_clean,
        "filename": safe_filename,
        "sha256": sha256_hash,
        "size_bytes": len(content),
        "hardware_model": hw_model_clean,
        "release_notes": release_notes,
        "is_active": is_active,
        "uploaded_at": now,
        "uploaded_by": uploader,
        "file_path": file_path
    }
    
    await db["firmware_releases"].insert_one(doc)
    
    await log_ota_audit(db, "FIRMWARE_UPLOAD", uploader, {
        "version": version_clean,
        "filename": safe_filename,
        "sha256": sha256_hash,
        "size_bytes": len(content),
        "hardware_model": hw_model_clean
    })
    
    return FirmwareUploadResponse(
        status="success",
        message="Firmware release uploaded and indexed successfully.",
        firmware=FirmwareMetadata(**doc)
    )

@router.get("/latest", response_model=FirmwareMetadata)
async def get_latest_firmware(
    hardware_model: Optional[str] = Query(None, description="Filter by hardware model"),
    db = Depends(get_database)
):
    """Retrieve metadata of the latest active firmware release for the specified hardware model."""
    cursor = db["firmware_releases"].find({"is_active": True})
    releases = await cursor.to_list(length=100)
    
    latest_rel = None
    for rel in releases:
        if is_hardware_compatible(hardware_model, rel.get("hardware_model", "ESP32 DevKit V1")):
            if not latest_rel or compare_versions(rel["version"], latest_rel["version"]) > 0:
                latest_rel = rel
                
    if not latest_rel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active firmware releases found compatible with hardware model '{hardware_model or 'ESP32 DevKit V1'}'."
        )
        
    return FirmwareMetadata(**latest_rel)

@router.get("/history", response_model=FirmwareListResponse)
async def list_firmware_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db = Depends(get_database)
):
    """Retrieve complete history of uploaded firmware releases."""
    total = await db["firmware_releases"].count_documents({})
    cursor = db["firmware_releases"].find({}).sort("uploaded_at", -1).skip(skip).limit(limit)
    releases_list = await cursor.to_list(length=limit)
    
    metadata_list = [FirmwareMetadata(**rel) for rel in releases_list]
    return FirmwareListResponse(total=total, releases=metadata_list)

@router.get("/download/{version}")
async def download_firmware(
    version: str,
    hardware_model: Optional[str] = Query(None, description="Filter by target hardware model"),
    db = Depends(get_database)
):
    """
    Stream the requested firmware binary file.
    Includes X-Checksum-Sha256 header for client-side cryptographic verification.
    """
    query = {"version": version.strip(), "is_active": True}
    if hardware_model:
        query["hardware_model"] = hardware_model.strip()
        
    doc = await db["firmware_releases"].find_one(query)
    if not doc:
        # Fallback without hardware_model if exact match failed
        doc = await db["firmware_releases"].find_one({"version": version.strip(), "is_active": True})
        
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active firmware release version '{version}' not found."
        )
        
    file_path = doc.get("file_path", "")
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Firmware binary file is missing from server disk storage."
        )
        
    await log_ota_audit(db, "FIRMWARE_DOWNLOAD", "client", {
        "version": doc["version"],
        "sha256": doc["sha256"],
        "hardware_model": doc["hardware_model"]
    })
    
    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        headers={
            "X-Checksum-Sha256": doc["sha256"],
            "Content-Disposition": f'attachment; filename="{doc["filename"]}"'
        }
    )

@router.delete("/{version}", dependencies=[Depends(require_role("admin"))])
async def delete_firmware(
    version: str,
    hardware_model: Optional[str] = Query(None, description="Target hardware model"),
    db = Depends(get_database)
):
    """
    Strict Admin Endpoint: Delete a firmware release version and remove its binary from storage.
    """
    query = {"version": version.strip()}
    if hardware_model:
        query["hardware_model"] = hardware_model.strip()
        
    doc = await db["firmware_releases"].find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Firmware release version '{version}' not found."
        )
        
    await db["firmware_releases"].delete_one({"_id": doc["_id"]})
    
    file_path = doc.get("file_path", "")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Could not remove physical firmware file '{file_path}': {e}")
            
    await log_ota_audit(db, "FIRMWARE_DELETE", "admin", {
        "version": doc["version"],
        "filename": doc.get("filename", ""),
        "hardware_model": doc.get("hardware_model", "")
    })
    
    return {"status": "success", "message": f"Firmware version '{version}' deleted successfully."}

@router.get("/audit-logs", dependencies=[Depends(require_role("admin"))])
async def get_ota_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db = Depends(get_database)
):
    """Strict Admin Endpoint: Retrieve audit logs of firmware uploads, downloads, and deletions."""
    cursor = db["ota_audit_logs"].find({}).sort("timestamp", -1).skip(skip).limit(limit)
    logs_list = await cursor.to_list(length=limit)
    
    sanitized_logs = []
    for entry in logs_list:
        sanitized_logs.append({
            "id": str(entry.get("_id", "")),
            "action": entry.get("action", ""),
            "timestamp": entry.get("timestamp"),
            "actor": entry.get("actor", ""),
            "details": entry.get("details", {})
        })
    return {"total": len(sanitized_logs), "logs": sanitized_logs}
