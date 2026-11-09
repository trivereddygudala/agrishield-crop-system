import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from backend.app.core.config import settings

logger = logging.getLogger("agrishield.local_backup")

BACKUP_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "local_predictions_backup.json")

def _ensure_dir():
    os.makedirs(os.path.dirname(BACKUP_FILE), exist_ok=True)
    if not os.path.exists(BACKUP_FILE):
        try:
            with open(BACKUP_FILE, "w", encoding="utf-8") as f:
                json.dump([], f)
        except Exception:
            pass

def save_local_prediction(record: Dict[str, Any]) -> bool:
    """Saves a copy of the prediction record to local durable disk storage."""
    try:
        _ensure_dir()
        clean = {}
        for k, v in record.items():
            if k in ("gradcam_base64", "heatmap_base64", "comparison_base64"):
                continue  # Skip heavy base64 to keep file light
            if isinstance(v, datetime):
                clean[k] = v.isoformat()
            else:
                try:
                    json.dumps({k: v})
                    clean[k] = v
                except Exception:
                    clean[k] = str(v)

        data = []
        if os.path.exists(BACKUP_FILE):
            try:
                with open(BACKUP_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = []

        # Deduplicate by id or image_path
        record_id = clean.get("id") or clean.get("_id")
        data = [r for r in data if (r.get("id") or r.get("_id")) != record_id]
        data.insert(0, clean)
        # Cap local backup at last 500 records
        data = data[:500]

        with open(BACKUP_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.warning(f"Failed to save local prediction backup: {e}")
        return False

def get_local_predictions(user_id: Optional[str] = None, limit: int = 150) -> List[Dict[str, Any]]:
    """Fetches local durable prediction records."""
    try:
        if not os.path.exists(BACKUP_FILE):
            return []
        with open(BACKUP_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if user_id:
            data = [r for r in data if str(r.get("user_id")) == str(user_id) or not r.get("user_id")]
        return data[:limit]
    except Exception as e:
        logger.warning(f"Failed to read local prediction backup: {e}")
        return []

async def sync_local_predictions_to_mongo(db):
    """Background task to push local unsynced records to MongoDB Atlas."""
    if db is None:
        return
    try:
        records = get_local_predictions()
        if not records:
            return
        for r in records:
            if not r.get("history_saved", False):
                try:
                    copy_r = dict(r)
                    copy_r["history_saved"] = True
                    if "id" in copy_r and copy_r["id"].startswith("temp-"):
                        del copy_r["id"]
                    await db.predictions.insert_one(copy_r)
                    r["history_saved"] = True
                except Exception:
                    pass
    except Exception as e:
        logger.debug(f"Local backup sync bypassed: {e}")

