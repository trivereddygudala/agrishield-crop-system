import logging
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

# Create dedicated security logger
security_logger = logging.getLogger("security_audit")
security_logger.setLevel(logging.INFO)

# Setup log directory and file handler (resilient to container read-only filesystems)
log_handler = None
try:
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "security_audit.log")
    log_handler = logging.FileHandler(log_file, encoding="utf-8")
except (OSError, PermissionError):
    try:
        # Fallback to standard temp directory writable in containerized environments (Hostless Cloud, Docker)
        tmp_dir = os.environ.get("TMPDIR") or os.environ.get("TEMP") or "/tmp"
        os.makedirs(tmp_dir, exist_ok=True)
        log_file = os.path.join(tmp_dir, "security_audit.log")
        log_handler = logging.FileHandler(log_file, encoding="utf-8")
    except Exception:
        # If filesystem is strictly read-only, stream directly to stdout
        import sys
        log_handler = logging.StreamHandler(sys.stdout)

log_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
log_handler.setFormatter(formatter)

if not security_logger.handlers:
    security_logger.addHandler(log_handler)

SENSITIVE_KEYS = {"password", "password_hash", "access_token", "refresh_token", "jwt", "api_key", "secret", "token"}

def mask_sensitive_data(data: Any) -> Any:
    """Recursively mask sensitive values in dictionaries or lists."""
    if isinstance(data, dict):
        masked = {}
        for k, v in data.items():
            if k.lower() in SENSITIVE_KEYS:
                masked[k] = "***REDACTED***"
            else:
                masked[k] = mask_sensitive_data(v)
        return masked
    elif isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    return data

def log_security_event(event_type: str, details: Dict[str, Any], level: str = "INFO", client_ip: str = "127.0.0.1"):
    """
    Log a structured security audit event.
    Events: LOGIN_SUCCESS, LOGIN_FAILED, ACCOUNT_LOCKED, PREDICTION_REQUEST,
            AI_PROMPT_BLOCKED, FILE_UPLOAD_BLOCKED, RATE_LIMIT_EXCEEDED, IOT_DATA_RECEIVED.
    """
    masked_details = mask_sensitive_data(details)
    event_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "event_type": event_type,
        "client_ip": client_ip,
        "details": masked_details
    }
    log_msg = json.dumps(event_payload)
    
    if level == "WARNING":
        security_logger.warning(log_msg)
    elif level == "ERROR":
        security_logger.error(log_msg)
    else:
        security_logger.info(log_msg)

    # Asynchronously write to MongoDB if event loop is running
    try:
        import asyncio
        from backend.app.db.mongodb import db_instance
        if db_instance.db is not None:
            db_payload = {
                "timestamp": datetime.now(timezone.utc),
                "level": level,
                "event_type": event_type,
                "client_ip": client_ip,
                "details": masked_details
            }
            loop = asyncio.get_running_loop()
            loop.create_task(db_instance.db.audit_logs.insert_one(db_payload))
    except RuntimeError:
        pass  # Not running in an async event loop, fallback to file-only log
    except Exception as e:
        security_logger.error(f"Failed to write audit log to database: {e}")
