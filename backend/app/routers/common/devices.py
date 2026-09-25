from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import httpx
from backend.app.db.mongodb import db_instance
from backend.app.routers.notifications import ws_manager
from backend.app.services.firmware_service import is_hardware_compatible, compare_versions, log_ota_audit

router = APIRouter(prefix="/api/v1/devices", tags=["Device Management"])

class ProxyPayload(BaseModel):
    ip: str
    endpoint: str
    method: str = "GET"
    payload: Optional[dict] = None

class DeviceConfig(BaseModel):
    update_interval_ms: int = 60000
    deep_sleep_enabled: bool = False
    sensor_calibration: dict = {}

class DeviceRegistration(BaseModel):
    device_id: str
    firmware_version: Optional[str] = "v2.0"
    hardware_model: Optional[str] = "ESP32 DevKit V1"
    hardware_version: Optional[str] = None
    ota_status: Optional[str] = None
    ota_completion_timestamp: Optional[int] = None
    ota_reboot_reason: Optional[str] = None
    ota_duration_seconds: Optional[int] = None
    ota_checksum_valid: Optional[bool] = None

class HeartbeatPayload(BaseModel):
    device_id: str
    firmware_version: Optional[str] = None
    uptime: Optional[int] = None
    heap: Optional[int] = None
    battery: Optional[float] = None
    wifi: Optional[bool] = None
    ip: Optional[str] = None
    signal: Optional[int] = None

class CommandPayload(BaseModel):
    device_id: str
    command: str

@router.post("/command")
async def enqueue_device_command(payload: CommandPayload):
    """Enqueue a command for a specific device to poll."""
    try:
        doc = await db_instance.db["devices"].find_one({"device_id": payload.device_id}, {"pending_commands": 1})
        if doc and len(doc.get("pending_commands", [])) >= 10:
            raise HTTPException(status_code=429, detail="Command queue full for this device")
            
        await db_instance.db["devices"].update_one(
            {"device_id": payload.device_id},
            {"$push": {"pending_commands": payload.command}},
            upsert=True
        )
        return {"status": "success", "message": "Command queued"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/poll-commands/{device_id}")
async def poll_device_commands(device_id: str):
    """ESP32 calls this endpoint every 3 seconds to get pending commands."""
    try:
        doc = await db_instance.db["devices"].find_one_and_update(
            {"device_id": device_id, "pending_commands.0": {"$exists": True}},
            {"$pop": {"pending_commands": -1}}
        )
        if doc and doc.get("pending_commands"):
            return {"command": doc["pending_commands"][0]}
    except Exception as e:
        print(f"Error polling command for {device_id}: {e}")
    return {"command": None}


@router.post("/heartbeat")
async def device_heartbeat(data: HeartbeatPayload):
    """Heartbeat ping from ESP32 node."""
    try:
        await db_instance.db["devices"].update_one(
            {"device_id": data.device_id},
            {"$set": {
                "last_seen": datetime.now(timezone.utc),
                "status": "online",
                "battery": data.battery,
                "heap": data.heap,
                "uptime": data.uptime,
                "ip": data.ip
            }},
            upsert=True
        )
        try:
            device_doc = await db_instance.db["devices"].find_one({"device_id": data.device_id})
            if device_doc and device_doc.get("user_id"):
                await ws_manager.broadcast_to_user(str(device_doc["user_id"]), {
                    "type": "device_status_update",
                    "device_id": data.device_id,
                    "status": "online",
                    "battery": data.battery,
                    "heap": data.heap,
                    "uptime": data.uptime,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
        except Exception:
            pass
        return {"status": "success", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register")
async def register_device(data: DeviceRegistration):
    """Register a new ESP32 device or update existing registration."""
    try:
        update_doc = {
            "firmware_version": data.firmware_version,
            "hardware_model": data.hardware_model,
            "last_seen": datetime.now(timezone.utc),
            "status": "online"
        }
        
        if data.ota_status:
            update_doc["ota_history"] = {
                "status": data.ota_status,
                "timestamp": data.ota_completion_timestamp,
                "reboot_reason": data.ota_reboot_reason,
                "duration": data.ota_duration_seconds,
                "checksum_valid": data.ota_checksum_valid,
                "version": data.firmware_version
            }
            try:
                await log_ota_audit(db_instance.db, "OTA_SYNC", data.device_id, {
                    "status": data.ota_status,
                    "version": data.firmware_version,
                    "reboot_reason": data.ota_reboot_reason
                })
            except Exception:
                pass

        await db_instance.db["devices"].update_one(
            {"device_id": data.device_id},
            {"$set": update_doc},
            upsert=True
        )
        return {"status": "success", "message": "Device registered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{device_id}/config", response_model=DeviceConfig)
async def get_device_config(device_id: str):
    """Retrieve backend-driven configuration for the ESP32."""
    doc = await db_instance.db["devices"].find_one({"device_id": device_id})
    if doc and "config" in doc:
        return DeviceConfig(**doc["config"])
    return DeviceConfig() # Return defaults

@router.get("/{device_id}/ota")
async def check_ota_update(device_id: str, current_version: str):
    """Check if an OTA firmware update is available for the specified device."""
    device_doc = await db_instance.db["devices"].find_one({"device_id": device_id})
    hardware_model = device_doc.get("hardware_model", "ESP32 DevKit V1") if device_doc else "ESP32 DevKit V1"
    
    cursor = db_instance.db["firmware_releases"].find({"is_active": True})
    releases = await cursor.to_list(length=100)
    
    latest_release = None
    for rel in releases:
        if is_hardware_compatible(hardware_model, rel.get("hardware_model", "ESP32 DevKit V1")):
            if not latest_release or compare_versions(rel["version"], latest_release["version"]) > 0:
                latest_release = rel
                
    if not latest_release:
        return {
            "update_available": False,
            "latest_version": current_version,
            "download_url": "",
            "sha256": "",
            "size_bytes": 0,
            "release_notes": "No firmware releases available for this hardware model.",
            "hardware_model": hardware_model
        }
        
    is_newer = compare_versions(latest_release["version"], current_version) > 0
    
    try:
        await log_ota_audit(db_instance.db, "OTA_QUERY", device_id, {
            "current_version": current_version,
            "latest_version": latest_release["version"],
            "update_available": is_newer,
            "hardware_model": hardware_model
        })
    except Exception:
        pass
        
    download_url = f"/api/v1/firmware/download/{latest_release['version']}?hardware_model={hardware_model}" if is_newer else ""
    return {
        "update_available": is_newer,
        "latest_version": latest_release["version"],
        "download_url": download_url,
        "sha256": latest_release.get("sha256", ""),
        "size_bytes": latest_release.get("size_bytes", 0),
        "release_notes": latest_release.get("release_notes", ""),
        "hardware_model": latest_release.get("hardware_model", hardware_model)
    }

@router.get("/status")
async def get_all_devices():
    """Retrieve status of all registered devices for the frontend dashboard."""
    if not hasattr(db_instance, "db") or db_instance.db is None:
        return []
    try:
        cursor = db_instance.db["devices"].find({}, {"_id": 0}).sort("last_seen", -1)
        devices = await cursor.to_list(length=100)
    except Exception:
        return []
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for dev in devices:
        last_seen = dev.get("last_seen")
        if not last_seen and "latest_telemetry" in dev and "received_at" in dev["latest_telemetry"]:
            last_seen = dev["latest_telemetry"]["received_at"]
        
        parsed_dt = None
        if isinstance(last_seen, datetime):
            parsed_dt = last_seen
            if parsed_dt.tzinfo is not None:
                parsed_dt = parsed_dt.astimezone(timezone.utc).replace(tzinfo=None)
        elif isinstance(last_seen, str):
            try:
                parsed_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00')).replace(tzinfo=None)
            except Exception:
                pass
        
        if parsed_dt:
            seconds_since_seen = (now - parsed_dt).total_seconds()
            if seconds_since_seen > 120:
                dev["status"] = "offline"
            else:
                dev["status"] = "online"
            dev["seconds_since_seen"] = int(seconds_since_seen)
        else:
            dev["status"] = "offline"
            dev["seconds_since_seen"] = 999999
    return devices

@router.post("/proxy")
async def device_proxy(proxy_data: ProxyPayload):
    """Proxy requests from frontend to ESP32 local IP to bypass mixed-content blocks."""
    if not proxy_data.ip:
        raise HTTPException(status_code=400, detail="No IP address provided")
        
    target_url = f"http://{proxy_data.ip}{proxy_data.endpoint}"
    
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            headers = {"X-API-Key": "crop_iot_secure_key_2026"}
            if proxy_data.method.upper() == "POST":
                resp = await client.post(target_url, data=proxy_data.payload, headers=headers)
            else:
                resp = await client.get(target_url, headers=headers)
                
            try:
                return resp.json()
            except Exception:
                return {"status": "success", "raw": resp.text}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Failed to connect to device local IP. Is it online?")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Device timed out.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import Response

@router.get("/proxy-download")
async def device_proxy_download(ip: str, endpoint: str):
    """Proxy file downloads from ESP32 to bypass mixed-content blocks and header issues."""
    target_url = f"http://{ip}{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"X-API-Key": "crop_iot_secure_key_2026"}
            resp = await client.get(target_url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Failed to fetch file from device")
            
            return Response(
                content=resp.content,
                media_type=resp.headers.get("content-type", "application/octet-stream"),
                headers={"Content-Disposition": f'attachment; filename="esp32_logs.csv"'}
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
