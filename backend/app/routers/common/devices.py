from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import httpx
import ipaddress
import urllib.parse
import hmac
import os
from bson import ObjectId


from backend.app.core.config import settings
from backend.app.db.mongodb import db_instance
from backend.app.routers.auth import get_current_user
from backend.app.routers.common.notifications import ws_manager
from backend.app.services.firmware_service import is_hardware_compatible, compare_versions, log_ota_audit

router = APIRouter(prefix="/api/v1/devices", tags=["Device Management"])

DANGEROUS_HOSTNAMES = {"localhost", "metadata.google.internal", "instance-data", "metadata"}

def validate_proxy_destination(ip_str: str) -> str:
    """Validate destination address to prevent SSRF against loopback, cloud metadata, and link-local ranges."""
    if not ip_str or not isinstance(ip_str, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No IP address provided")

    clean = ip_str.strip().lower()
    if "://" in clean:
        clean = urllib.parse.urlparse(clean).hostname or clean

    if clean in DANGEROUS_HOSTNAMES or clean.endswith(".localhost"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access to loopback or cloud metadata hostnames is forbidden."
        )

    try:
        ip_obj = ipaddress.ip_address(clean)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid IP address format. Hostnames are not allowed."
        )

    if ip_obj.is_loopback:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access to loopback IP addresses (127.0.0.0/8, ::1) is forbidden."
        )
    if ip_obj.is_link_local:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access to link-local and cloud metadata addresses (169.254.0.0/16) is forbidden."
        )
    if ip_obj.is_multicast:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access to multicast IP addresses is forbidden."
        )
    if ip_obj.is_reserved or ip_obj.is_unspecified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access to reserved or unspecified IP addresses is forbidden."
        )
    return clean

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

DEFAULT_IOT_INSECURE_KEY = "crop_iot_secure_key_2026"

def _verify_device_poll_auth(request: Request, device_id: str, device_doc: Optional[dict] = None) -> bool:
    """
    Authenticate ESP32 / IoT device polling.
    Accepts:
      1. Valid device-specific token (device_doc.get("token") or device_doc.get("api_key") or device_doc.get("device_token"))
      2. Valid configured settings.IOT_API_KEY.
         In production (ENV='production', IOT_SECURITY_MODE='production', or RENDER detected),
         the publicly known default key 'crop_iot_secure_key_2026' is strictly REJECTED.
    Returns True if authenticated, False otherwise.
    """
    api_key = request.headers.get("X-IoT-API-Key") or request.headers.get("X-API-Key")
    auth_header = request.headers.get("Authorization") or ""
    bearer_token = auth_header.split(" ", 1)[1].strip() if auth_header.startswith("Bearer ") else None

    candidate_key = api_key or bearer_token
    if not candidate_key:
        return False

    is_prod = (
        getattr(settings, "ENV", "").lower() == "production"
        or getattr(settings, "IOT_SECURITY_MODE", "").lower() == "production"
        or os.environ.get("RENDER") is not None
        or os.environ.get("ENV", "").lower() == "production"
    )

    # 1. Device-specific token check
    if device_doc:
        dev_token = device_doc.get("token") or device_doc.get("api_key") or device_doc.get("device_token")
        if dev_token:
            if is_prod and dev_token == DEFAULT_IOT_INSECURE_KEY:
                pass  # Disallow default insecure key in production even if stored as device token
            elif hmac.compare_digest(candidate_key, dev_token):
                return True

    # 2. Configured settings.IOT_API_KEY check
    configured_key = getattr(settings, "IOT_API_KEY", "") or ""

    if is_prod:
        # In production, the publicly known default key must NEVER be accepted
        if candidate_key == DEFAULT_IOT_INSECURE_KEY or configured_key == DEFAULT_IOT_INSECURE_KEY:
            return False
        if configured_key and hmac.compare_digest(candidate_key, configured_key):
            return True
        return False
    else:
        # In development/testing, accept configured key (even if default)
        if configured_key and hmac.compare_digest(candidate_key, configured_key):
            return True
        return False



@router.post("/command")
async def enqueue_device_command(
    payload: CommandPayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Enqueue a command for a specific device to poll.
    Strict RBAC: JWT authentication + device ownership / admin authorization.
    """
    user_role = (current_user.get("role") or "farmer").lower()
    user_id = str(current_user.get("id") or current_user.get("_id") or "")

    if user_role not in ["admin", "farmer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Device command is restricted to farmers and administrators."
        )

    if not hasattr(db_instance, "db") or db_instance.db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")

    device_doc = await db_instance.db["devices"].find_one({"device_id": payload.device_id})

    # Device ownership check for non-admin
    if user_role != "admin":
        if not device_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device '{payload.device_id}' not found."
            )
        dev_uid = str(device_doc.get("user_id") or "")
        is_owner = (dev_uid == user_id)
        if not is_owner and ObjectId.is_valid(user_id) and device_doc.get("user_id") == ObjectId(user_id):
            is_owner = True

        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: this device belongs to another farmer or is unassigned."
            )

    # Command queue capacity check
    if device_doc and len(device_doc.get("pending_commands", [])) >= 10:
        raise HTTPException(status_code=429, detail="Command queue full for this device")

    try:
        await db_instance.db["devices"].update_one(
            {"device_id": payload.device_id},
            {"$push": {"pending_commands": payload.command}},
            upsert=True if user_role == "admin" else False
        )
        return {"status": "success", "message": "Command queued"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/poll-commands/{device_id}")
async def poll_device_commands(device_id: str, request: Request):
    """
    ESP32 calls this endpoint to retrieve pending commands.
    Requires device authentication (X-IoT-API-Key, X-API-Key, or device Bearer token).
    Unauthenticated requests are rejected with 401 without draining pending commands.
    """
    if not hasattr(db_instance, "db") or db_instance.db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")

    device_doc = await db_instance.db["devices"].find_one({"device_id": device_id})

    # Device authentication check
    if not _verify_device_poll_auth(request, device_id, device_doc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Invalid or missing device credentials (X-IoT-API-Key)."
        )

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
async def get_all_devices(current_user: dict = Depends(get_current_user)):
    """Retrieve status of devices for authorized users (Admin sees all; Farmer sees own devices only)."""
    if not hasattr(db_instance, "db") or db_instance.db is None:
        return []

    user_role = current_user.get("role", "farmer").lower()
    user_id = current_user.get("id") or str(current_user.get("_id", ""))

    if user_role == "admin":
        query = {}
    elif user_role == "farmer":
        query_conditions = [{"user_id": user_id}]
        if ObjectId.is_valid(user_id):
            query_conditions.append({"user_id": ObjectId(user_id)})
        query = {"$or": query_conditions}
    else:
        # Equipment providers or other roles have no associated farmer IoT devices
        return []

    try:
        cursor = db_instance.db["devices"].find(query, {"_id": 0}).sort("last_seen", -1)
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
async def device_proxy(
    proxy_data: ProxyPayload,
    current_user: dict = Depends(get_current_user)
):
    """Proxy requests from frontend to ESP32 local IP with authentication, ownership, and SSRF validation."""
    user_role = current_user.get("role", "farmer").lower()
    if user_role not in ["admin", "farmer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: IoT device proxy is restricted to farmers and administrators."
        )

    if not proxy_data.ip:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No IP address provided")

    # SSRF destination validation
    validated_ip = validate_proxy_destination(proxy_data.ip)

    # Scoped device ownership check for farmers
    if user_role == "farmer" and hasattr(db_instance, "db") and db_instance.db is not None:
        user_id = current_user.get("id") or str(current_user.get("_id", ""))
        foreign_device = await db_instance.db["devices"].find_one({
            "ip": validated_ip,
            "user_id": {"$nin": [user_id, ObjectId(user_id)]} if ObjectId.is_valid(user_id) else {"$ne": user_id}
        })
        if foreign_device:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: this device belongs to another farmer."
            )

    clean_endpoint = (proxy_data.endpoint or "").strip()
    if not clean_endpoint.startswith("/"):
        clean_endpoint = "/" + clean_endpoint

    target_url = f"http://{validated_ip}{clean_endpoint}"

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

@router.get("/proxy-download")
async def device_proxy_download(
    ip: str = Query(..., description="Target device IP"),
    endpoint: str = Query(..., description="Device download endpoint"),
    current_user: dict = Depends(get_current_user)
):
    """Proxy file downloads from ESP32 with authentication, ownership, and SSRF validation."""
    user_role = current_user.get("role", "farmer").lower()
    if user_role not in ["admin", "farmer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: IoT device proxy is restricted to farmers and administrators."
        )

    validated_ip = validate_proxy_destination(ip)

    if user_role == "farmer" and hasattr(db_instance, "db") and db_instance.db is not None:
        user_id = current_user.get("id") or str(current_user.get("_id", ""))
        foreign_device = await db_instance.db["devices"].find_one({
            "ip": validated_ip,
            "user_id": {"$nin": [user_id, ObjectId(user_id)]} if ObjectId.is_valid(user_id) else {"$ne": user_id}
        })
        if foreign_device:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: this device belongs to another farmer."
            )

    clean_endpoint = (endpoint or "").strip()
    if not clean_endpoint.startswith("/"):
        clean_endpoint = "/" + clean_endpoint

    target_url = f"http://{validated_ip}{clean_endpoint}"
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


devices_alias_router = APIRouter(tags=["Device Management Aliases"])
devices_alias_router.add_api_route("/devices/command", enqueue_device_command, methods=["POST"])
devices_alias_router.add_api_route("/api/devices/command", enqueue_device_command, methods=["POST"])
devices_alias_router.add_api_route("/devices/poll-commands/{device_id}", poll_device_commands, methods=["GET"])
devices_alias_router.add_api_route("/api/devices/poll-commands/{device_id}", poll_device_commands, methods=["GET"])

