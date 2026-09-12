import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from backend.app.db.mongodb import db_instance

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1800 # 30 minutes

class WeatherCache:
    @staticmethod
    async def get_cached_weather(farm_id: str, lat: float, lon: float) -> Optional[Dict[str, Any]]:
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
                        logger.info(f"Serving weather payload from cache (age: {age_seconds:.1f}s)")
                        cached_payload = doc.get("weather_data", {})
                        cached_payload["cache_status"] = "Cached"
                        cached_payload["cache_expires_in"] = int(CACHE_TTL_SECONDS - age_seconds)
                        return cached_payload
        except Exception as e:
            logger.warn(f"Weather cache retrieval failed: {e}")
        return None

    @staticmethod
    async def set_cached_weather(farm_id: str, lat: float, lon: float, weather_data: Dict[str, Any]) -> None:
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
