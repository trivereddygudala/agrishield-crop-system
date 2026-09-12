import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from backend.app.db.mongodb import db_instance

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1800 # 30 minutes
RAM_TTL_SECONDS = 900 # 15 minutes in memory

_RAM_CACHE: Dict[str, Any] = {}

class WeatherCache:
    @staticmethod
    async def get_cached_weather(farm_id: str, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        cache_key = f"{farm_id or ''}_{round(lat, 4)}_{round(lon, 4)}"
        
        # 1. Ultra-fast RAM lookup (< 0.1ms)
        ram_entry = _RAM_CACHE.get(cache_key)
        if ram_entry:
            age = (datetime.now(timezone.utc) - ram_entry["timestamp"]).total_seconds()
            if age < RAM_TTL_SECONDS:
                cached_copy = dict(ram_entry["payload"])
                cached_copy["cache_status"] = "RAM_Cached"
                cached_copy["cache_expires_in"] = int(RAM_TTL_SECONDS - age)
                return cached_copy

        # 2. Fallback to MongoDB cache
        try:
            if db_instance.db is None:
                return None

            col = db_instance.db["weather_cache"]
            query = {"farm_id": farm_id} if farm_id else {"lat": lat, "lon": lon}
            doc = await col.find_one(query)

            if doc:
                last_updated = doc.get("last_updated")
                if last_updated:
                    if getattr(last_updated, "tzinfo", None) is None:
                        last_updated = last_updated.replace(tzinfo=timezone.utc)
                    age_seconds = (datetime.now(timezone.utc) - last_updated).total_seconds()
                    if age_seconds < CACHE_TTL_SECONDS:
                        cached_payload = doc.get("weather_data", {})
                        cached_payload["cache_status"] = "Cached"
                        cached_payload["cache_expires_in"] = int(CACHE_TTL_SECONDS - age_seconds)
                        # Warm RAM cache
                        _RAM_CACHE[cache_key] = {
                            "payload": cached_payload,
                            "timestamp": datetime.now(timezone.utc)
                        }
                        return cached_payload
        except Exception as e:
            logger.warn(f"Weather cache retrieval failed: {e}")
        return None

    @staticmethod
    async def set_cached_weather(farm_id: str, lat: float, lon: float, weather_data: Dict[str, Any]) -> None:
        cache_key = f"{farm_id or ''}_{round(lat, 4)}_{round(lon, 4)}"
        _RAM_CACHE[cache_key] = {
            "payload": weather_data,
            "timestamp": datetime.now(timezone.utc)
        }
        try:
            if db_instance.db is None:
                return

            col = db_instance.db["weather_cache"]
            doc_filter = {"farm_id": farm_id} if farm_id else {"lat": lat, "lon": lon}
            
            update_doc = {
                "$set": {
                    "farm_id": farm_id,
                    "lat": lat,
                    "lon": lon,
                    "weather_data": weather_data,
                    "last_updated": datetime.now(timezone.utc)
                }
            }
            await col.update_one(doc_filter, update_doc, upsert=True)
            logger.info("Successfully updated weather cache in MongoDB.")
        except Exception as e:
            logger.warn(f"Weather cache write failed: {e}")
