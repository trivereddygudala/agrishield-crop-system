import os
import time
import hmac
from datetime import timezone
from typing import Dict, Any, Tuple, Optional
from fastapi import Request, HTTPException, status
from backend.app.core.config import settings

DEFAULT_IOT_INSECURE_KEY = "crop_iot_secure_key_2026"

def is_production_mode() -> bool:
    return (
        getattr(settings, "ENV", "").lower() == "production"
        or getattr(settings, "IOT_SECURITY_MODE", "").lower() == "production"
        or os.environ.get("RENDER") is not None
        or os.environ.get("ENV", "").lower() == "production"
    )

# Sensor Physical Bounds Configuration
SENSOR_BOUNDS = {
    "temperature": (-10.0, 65.0),    # Celsius
    "humidity": (0.0, 100.0),         # Percentage
    "soil_moisture": (0.0, 100.0),    # Percentage
    "light_lux": (0.0, 100000.0),     # Lux
    "voltage": (0.0, 15.0),           # Volts
    "pressure": (800.0, 1200.0)       # hPa
}

def validate_sensor_payload(payload: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validate telemetry data ranges against physical limits.
    Rejects physically impossible values (e.g. 500°C temp or -20% humidity).
    """
    if not isinstance(payload, dict):
        return False, "Payload must be a JSON object"

    for sensor_key, (min_val, max_val) in SENSOR_BOUNDS.items():
        if sensor_key in payload and payload[sensor_key] is not None:
            try:
                val = float(payload[sensor_key])
                if val < min_val or val > max_val:
                    return False, f"Sensor '{sensor_key}' value {val} out of physical bounds [{min_val}, {max_val}]."
            except (ValueError, TypeError):
                return False, f"Sensor '{sensor_key}' value must be numeric."

    return True, "Sensor payload valid."

def validate_iot_request(
    request: Request,
    api_key: Optional[str] = None,
    timestamp: Optional[float] = None,
    device_doc: Optional[dict] = None
) -> bool:
    """
    Validate IoT node request authentication and replay protection.
    Fails closed in production:
      - Rejects missing credentials
      - Rejects known default key 'crop_iot_secure_key_2026'
      - Requires a genuinely configured non-default IOT_API_KEY or valid device token
    In development mode:
      - Permissive for local ESP32 simulation, but rejects invalid keys if provided.
    """
    header_key = (
        request.headers.get("X-IoT-API-Key")
        or request.headers.get("X-API-Key")
        or api_key
    )
    auth_header = request.headers.get("Authorization") or ""
    if not header_key and auth_header.startswith("Bearer "):
        header_key = auth_header.split(" ", 1)[1].strip()

    is_prod = is_production_mode()

    if is_prod:
        if not header_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing X-IoT-API-Key"
            )
        if header_key == DEFAULT_IOT_INSECURE_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Default insecure IoT API key is prohibited in production"
            )

        # 1. Device-specific token check
        device_authenticated = False
        if device_doc:
            dev_token = device_doc.get("token") or device_doc.get("api_key") or device_doc.get("device_token")
            if dev_token and dev_token != DEFAULT_IOT_INSECURE_KEY and hmac.compare_digest(header_key, dev_token):
                device_authenticated = True

        if not device_authenticated:
            # 2. Configured settings.IOT_API_KEY check
            configured_key = getattr(settings, "IOT_API_KEY", "") or ""
            if not configured_key or configured_key == DEFAULT_IOT_INSECURE_KEY:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="IoT service is not configured with a secure non-default API key"
                )
            if not hmac.compare_digest(header_key, configured_key):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or missing X-IoT-API-Key"
                )
    else:
        # Development mode
        configured_key = getattr(settings, "IOT_API_KEY", "") or ""
        if header_key and configured_key:
            device_token = (device_doc.get("token") or device_doc.get("api_key") or device_doc.get("device_token")) if device_doc else None
            matches_device = bool(device_token and hmac.compare_digest(header_key, device_token))
            matches_configured = bool(hmac.compare_digest(header_key, configured_key))
            if not (matches_device or matches_configured):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid X-IoT-API-Key"
                )

    # 2. Timestamp Replay Protection Check
    if timestamp:
        now = time.time()
        # Accept timestamps within a 5-minute window
        if abs(now - timestamp) > 300:
            if is_prod:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="IoT request timestamp expired or invalid (Replay attack protection)."
                )

    return True
