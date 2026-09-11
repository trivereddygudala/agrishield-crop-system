import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.app.services.weather.provider import OpenWeatherMapProvider, MockWeatherProvider
from backend.app.services.weather.cache import WeatherCache
from backend.app.services.weather.utils import generate_standard_metadata

logger = logging.getLogger(__name__)

class WeatherIntelligenceService:
    def __init__(self, provider=None):
        self.provider = provider or OpenWeatherMapProvider()

    async def get_weather_for_farm(
        self,
        farm_id: Optional[str] = None,
        lat: Optional[float] = 16.5062,
        lon: Optional[float] = 80.6480,
        bypass_cache: bool = False
    ) -> Dict[str, Any]:
        start_time = time.time()
        if lat is None:
            lat = 16.5062
        if lon is None:
            lon = 80.6480

        location_name_override = None
        # 0. Lookup coordinates from active farm profile if farm_id provided
        if farm_id and farm_id != "default":
            try:
                from bson import ObjectId
                from backend.app.db.mongodb import db_instance
                farm_doc = None
                try:
                    farm_doc = await db_instance.db["farm_profiles"].find_one({"_id": ObjectId(farm_id)})
                except Exception:
                    pass
                if not farm_doc:
                    try:
                        farm_doc = await db_instance.db["farms"].find_one({"_id": ObjectId(farm_id)})
                    except Exception:
                        pass
                if farm_doc:
                    if farm_doc.get("latitude") is not None and farm_doc.get("longitude") is not None:
                        lat = float(farm_doc["latitude"])
                        lon = float(farm_doc["longitude"])
                    village = farm_doc.get("village")
                    district = farm_doc.get("district")
                    farm_name = farm_doc.get("farm_name")
                    if village and district:
                        location_name_override = f"{village}, {district}"
                    elif village:
                        location_name_override = village
                    elif district:
                        location_name_override = district
                    elif farm_name:
                        location_name_override = farm_name
            except Exception as e:
                logger.error(f"Error resolving farm coordinates: {e}")

        # 1. Check MongoDB Cache if not bypassed
        if not bypass_cache:
            cached_data = await WeatherCache.get_cached_weather(farm_id, lat, lon)
            if cached_data:
                cached_data["metadata"] = generate_standard_metadata(
                    start_time,
                    cache_status="Cached",
                    cache_expires_in=cached_data.get("cache_expires_in", 1800)
                )
                return cached_data

        # 2. Fetch from Weather Provider abstraction
        raw_payload, provider_name, provider_status = await self.provider.fetch_weather(lat, lon)

        metadata = generate_standard_metadata(start_time, cache_status="Live", cache_expires_in=1800)
        
        response_payload = {
            "metadata": metadata,
            "provider_name": provider_name,
            "provider_status": provider_status,
            "last_successful_sync": datetime.now(timezone.utc).isoformat() + "Z",
            "location": location_name_override or raw_payload.get("location_name", f"Farm Sector ({lat:.2f}°, {lon:.2f}°)"),
            "latitude": lat,
            "longitude": lon,
            "current": raw_payload["current"],
            "hourly_forecast": raw_payload["hourly_forecast"],
            "daily_forecast": raw_payload["daily_forecast"],
            "recommendations": raw_payload.get("recommendations", [])
        }

        # 3. Save to MongoDB Cache asynchronously
        await WeatherCache.set_cached_weather(farm_id, lat, lon, response_payload)

        return response_payload
