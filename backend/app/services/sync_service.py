"""
AgriShield Master Data Synchronization & Deletion Tombstone Service
Guarantees permanent, multi-device cross-synchronization of deletions across
all web, mobile, and tablet clients. Prevents deleted records from resurrecting
across devices, database caches, workers, or disk fallbacks.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set
from backend.app.db.mongodb import db_instance

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
TOMBSTONES_FILE = os.path.join(DATA_DIR, "deleted_tombstones.json")

# In-memory tombstone cache: key is f"{entity_type}:{clean_id}"
_in_memory_tombstones: Dict[str, Dict[str, Any]] = {}
_initialized: bool = False


def _normalize_id(entity_id: Any) -> str:
    if entity_id is None:
        return ""
    return str(entity_id).strip()


def _make_key(entity_type: str, entity_id: str) -> str:
    return f"{entity_type.lower().strip()}:{_normalize_id(entity_id)}"


def _load_disk_tombstones() -> Dict[str, Dict[str, Any]]:
    global _in_memory_tombstones, _initialized
    if os.path.exists(TOMBSTONES_FILE):
        try:
            with open(TOMBSTONES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _in_memory_tombstones = data
                elif isinstance(data, list):
                    _in_memory_tombstones = {
                        _make_key(item.get("entity_type", "generic"), item.get("entity_id", "")): item
                        for item in data if item.get("entity_id")
                    }
        except Exception as e:
            logger.warning(f"⚠️ [SyncService] Failed loading tombstones from disk: {e}")
    _initialized = True
    return _in_memory_tombstones


def _save_disk_tombstones():
    global _in_memory_tombstones
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(TOMBSTONES_FILE, "w", encoding="utf-8") as f:
            json.dump(_in_memory_tombstones, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"⚠️ [SyncService] Failed saving tombstones to disk: {e}")


# Initialize cache at startup
_load_disk_tombstones()


class SyncService:
    @staticmethod
    async def record_deletion(
        entity_type: str,
        entity_id: str,
        deleted_by: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Permanently record a deletion tombstone in memory, on disk, and in MongoDB.
        Any subsequent query across all devices will strictly filter out this record.
        """
        global _in_memory_tombstones
        if not entity_id or not entity_type:
            return False

        clean_id = _normalize_id(entity_id)
        now_iso = datetime.now(timezone.utc).isoformat()
        key = _make_key(entity_type, clean_id)

        tombstone_entry = {
            "entity_type": entity_type.lower().strip(),
            "entity_id": clean_id,
            "deleted_at": now_iso,
            "deleted_by": deleted_by or "client_user",
            "reason": reason or "User deletion",
            "metadata": metadata or {}
        }

        # 1. Update in-memory cache
        _in_memory_tombstones[key] = tombstone_entry

        # Also store variations (e.g. numeric ID variants for equipment/bookings)
        if clean_id.startswith("BK-"):
            clean_num = clean_id.replace("BK-", "")
            _in_memory_tombstones[_make_key(entity_type, clean_num)] = tombstone_entry
        elif clean_id.startswith("EQ-") or clean_id.startswith("FL-"):
            prefix, num = clean_id.split("-", 1)
            _in_memory_tombstones[_make_key(entity_type, num)] = tombstone_entry

        # 2. Persist to disk JSON
        _save_disk_tombstones()

        # 3. Persist to MongoDB if active
        if db_instance.db is not None:
            try:
                await db_instance.db["tombstones"].update_one(
                    {"entity_type": tombstone_entry["entity_type"], "entity_id": clean_id},
                    {"$set": tombstone_entry},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"⚠️ [SyncService] Mongo tombstone upsert notice: {e}")

        logger.info(f"🗑️ [SyncService] Permanent deletion tombstone registered: {entity_type} -> {clean_id}")
        return True

    @staticmethod
    def is_deleted(entity_type: str, entity_id: Any) -> bool:
        """
        Synchronous fast check if an entity ID has been marked deleted.
        """
        global _in_memory_tombstones
        if not entity_id or not entity_type:
            return False
        clean_id = _normalize_id(entity_id)
        key = _make_key(entity_type, clean_id)
        if key in _in_memory_tombstones:
            return True

        # Check numeric variants
        if clean_id.startswith("BK-"):
            num = clean_id.replace("BK-", "")
            if _make_key(entity_type, num) in _in_memory_tombstones:
                return True
        elif clean_id.startswith("EQ-") or clean_id.startswith("FL-"):
            parts = clean_id.split("-", 1)
            if len(parts) == 2 and _make_key(entity_type, parts[1]) in _in_memory_tombstones:
                return True

        return False

    @staticmethod
    def get_deleted_id_set(entity_type: Optional[str] = None) -> Set[str]:
        """
        Returns a set of all deleted IDs for a given entity type (or all types).
        """
        global _in_memory_tombstones
        clean_type = entity_type.lower().strip() if entity_type else None
        deleted_set = set()
        for key, entry in _in_memory_tombstones.items():
            if not clean_type or entry.get("entity_type") == clean_type:
                eid = entry.get("entity_id")
                if eid:
                    deleted_set.add(str(eid))
                    # Add numeric variant
                    if str(eid).startswith("BK-"):
                        deleted_set.add(str(eid).replace("BK-", ""))
                    elif str(eid).startswith("EQ-") or str(eid).startswith("FL-"):
                        parts = str(eid).split("-", 1)
                        if len(parts) == 2:
                            deleted_set.add(parts[1])
        return deleted_set

    @staticmethod
    def filter_out_deleted(
        entity_type: str,
        items: List[Dict[str, Any]],
        id_keys: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Clean, reusable function that guarantees deleted records are filtered out
        from any collection before sending to clients.
        """
        if not items:
            return []
        keys_to_check = id_keys or ["id", "bookingId", "equipment_id", "notification_id", "_id"]
        deleted_ids = SyncService.get_deleted_id_set(entity_type)
        if not deleted_ids:
            return items

        clean_items = []
        for item in items:
            if not isinstance(item, dict):
                clean_items.append(item)
                continue
            is_item_deleted = False
            for k in keys_to_check:
                val = item.get(k)
                if val and str(val).strip() in deleted_ids:
                    is_item_deleted = True
                    break
            if not is_item_deleted:
                clean_items.append(item)
        return clean_items

    @staticmethod
    async def get_all_tombstones(
        entity_type: Optional[str] = None,
        since: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch all active tombstones from MongoDB and local disk so client devices
        can instantly synchronize and purge their local state/localStorage.
        """
        global _in_memory_tombstones
        _load_disk_tombstones()

        # Merge with MongoDB if available
        if db_instance.db is not None:
            try:
                query = {}
                if entity_type:
                    query["entity_type"] = entity_type.lower().strip()
                if since:
                    query["deleted_at"] = {"$gte": since}
                docs = await db_instance.db["tombstones"].find(query).to_list(length=5000)
                for doc in docs:
                    doc.pop("_id", None)
                    k = _make_key(doc.get("entity_type", "generic"), doc.get("entity_id", ""))
                    if k:
                        _in_memory_tombstones[k] = doc
            except Exception as e:
                logger.warning(f"⚠️ [SyncService] Mongo tombstones fetch notice: {e}")

        clean_type = entity_type.lower().strip() if entity_type else None
        results = []
        for entry in _in_memory_tombstones.values():
            if clean_type and entry.get("entity_type") != clean_type:
                continue
            if since and entry.get("deleted_at") and entry.get("deleted_at") < since:
                continue
            results.append(entry)

        # Sort newest first
        results.sort(key=lambda x: x.get("deleted_at", ""), reverse=True)
        return results
