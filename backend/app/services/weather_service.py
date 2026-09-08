import logging
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.db.mongodb import db_instance

logger = logging.getLogger(__name__)

class WeatherService:
    @staticmethod
    def get_mock_weather(lat: float, lon: float, location_name: str = "Mock Farm, Haryana") -> Dict[str, Any]:
        """Generate high-fidelity realistic weather data as a fallback."""
        logger.info(f"Generating mock weather forecast for lat: {lat}, lon: {lon}")
        
        # Use dynamic values based on hour to look realistic
        now = datetime.now(timezone.utc)
        current_hour = now.hour
        
        # Base temperature varies by time of day and latitude (warmer towards equator)
        lat_offset = max(0.0, (30.0 - abs(lat)) * 0.4)
        base_temp = 22.0 + lat_offset - abs(current_hour - 14) * 0.5 # Peak at 14:00
        
        # Setup mock weather: 40% probability of rain in forecast to test recommendations
        current_weather = {
            "temperature": round(base_temp, 1),
            "humidity": 65 + (current_hour % 5),
            "wind_speed": 4.2,
            "pressure": 1012,
            "condition": "Rain" if current_hour % 4 == 0 else "Clouds",
            "description": "light intensity shower rain" if current_hour % 4 == 0 else "broken clouds",
            "rain_probability": 75 if current_hour % 4 == 0 else 20,
            "rain_amount": 2.5 if current_hour % 4 == 0 else 0.0,
            "uv_index": 5.8 if 8 <= current_hour <= 16 else 0.0,
            "sunrise": (now.replace(hour=6, minute=10, second=0)).isoformat() + "Z",
            "sunset": (now.replace(hour=18, minute=45, second=0)).isoformat() + "Z"
        }
        
        # Generate 24-hour forecast (8 points, 3 hours apart)
        forecast_list = []
        for i in range(8):
            f_time = now + timedelta(hours=(i + 1) * 3)
            f_hour = f_time.hour
            f_temp = 22.0 + lat_offset - abs(f_hour - 14) * 0.5
            
            # Expected rain probability peak in 6 hours
            rain_prob = 80 if i in [1, 2] else (30 if i in [0, 3] else 10)
            rain_amt = 4.0 if i in [1, 2] else (0.5 if i in [0, 3] else 0.0)
            
            forecast_list.append({
                "time": f_time.isoformat() + "Z",
                "temperature": round(f_temp, 1),
                "condition": "Rain" if rain_prob > 50 else "Clouds",
                "description": "moderate rain" if rain_prob > 50 else "scattered clouds",
                "rain_probability": rain_prob,
                "rain_amount": rain_amt
            })
            
        return {
            "current": current_weather,
            "forecast": forecast_list,
            "location": location_name,
            "status": "Weather Offline (Mock Data)"
        }

    @staticmethod
    async def get_weather(device_id: str, lat: float = 16.5062, lon: float = 80.6480) -> Dict[str, Any]:
        """Fetch weather telemetry, serving from MongoDB cache if less than 30 minutes old and location matches."""
        try:
            # 1. Check cache in MongoDB
            if db_instance.db is not None:
                cache_col = db_instance.db["weather_cache"]
                cached_doc = await cache_col.find_one({"device_id": device_id})
                
                if cached_doc:
                    last_updated = cached_doc.get("last_updated")
                    cached_lat = cached_doc.get("lat")
                    cached_lon = cached_doc.get("lon")
                    
                    # Check if coordinates match closely (within ~5km) and cache is fresh
                    coords_match = False
                    if last_updated:
                        if last_updated.tzinfo is None:
                            last_updated = last_updated.replace(tzinfo=timezone.utc)
                        
                        # Just a basic coordinate check (exact match for now since ESP32 doesn't have GPS)
                        if abs(cached_lat - lat) < 0.05 and abs(cached_lon - lon) < 0.05:
                            coords_match = True

                        if coords_match and (datetime.now(timezone.utc) - last_updated < timedelta(minutes=30)):
                            logger.info(f"Serving weather forecast from cache for device: {device_id} (lat: {lat}, lon: {lon})")
                            return cached_doc["weather_data"]

            # 2. Try fetching from OpenWeatherMap API if key is available
            api_key = settings.OPENWEATHER_API_KEY
            weather_data = None
            
            if api_key and api_key != "" and api_key != "YOUR_OPENWEATHERMAP_API_KEY":
                logger.info(f"Fetching live weather forecast for lat: {lat}, lon: {lon} from OpenWeatherMap")
                # 5-day/3-hour forecast API
                url = "https://api.openweathermap.org/data/2.5/forecast"
                params = {
                    "lat": lat,
                    "lon": lon,
                    "appid": api_key,
                    "units": "metric", # Celsius
                    "cnt": 8 # 24 hours of forecast (8 * 3h = 24h)
                }
                
                async with httpx.AsyncClient() as client:
                    res = await client.get(url, params=params, timeout=8.0)
                    
                if res.status_code == 200:
                    data = res.json()
                    
                    # Parse API response
                    current_item = data["list"][0]
                    
                    current_weather = {
                        "temperature": current_item["main"]["temp"],
                        "humidity": current_item["main"]["humidity"],
                        "wind_speed": current_item["wind"]["speed"],
                        "pressure": current_item["main"]["pressure"],
                        "condition": current_item["weather"][0]["main"],
                        "description": current_item["weather"][0]["description"],
                        "rain_probability": int(current_item.get("pop", 0) * 100),
                        "rain_amount": current_item.get("rain", {}).get("3h", 0.0),
                        "uv_index": 0.0, # Not available on free forecast API
                        "sunrise": datetime.fromtimestamp(data["city"]["sunrise"]).isoformat() + "Z",
                        "sunset": datetime.fromtimestamp(data["city"]["sunset"]).isoformat() + "Z"
                    }
                    
                    forecast_list = []
                    for item in data["list"][1:]:
                        forecast_list.append({
                            "time": datetime.fromtimestamp(item["dt"]).isoformat() + "Z",
                            "temperature": item["main"]["temp"],
                            "condition": item["weather"][0]["main"],
                            "description": item["weather"][0]["description"],
                            "rain_probability": int(item.get("pop", 0) * 100),
                            "rain_amount": item.get("rain", {}).get("3h", 0.0)
                        })
                        
                    weather_data = {
                        "current": current_weather,
                        "forecast": forecast_list,
                        "location": f"{data['city']['name']}, {data['city']['country']}",
                        "status": "Online"
                    }
                    logger.info("Successfully fetched live weather data.")
                else:
                    logger.warning(f"OpenWeatherMap returned code {res.status_code}: {res.text}")
            
            # 3. Fallback if API key missing or request failed
            if not weather_data:
                # Keyless reverse geocoding to find the user's city name
                location_name = "Mock Farm, Haryana"
                try:
                    logger.info(f"Reverse geocoding lat: {lat}, lon: {lon} via Nominatim")
                    async with httpx.AsyncClient() as client:
                        headers = {"User-Agent": "AgriShieldApp/1.0"}
                        geo_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
                        geo_res = await client.get(geo_url, headers=headers, timeout=3.0)
                        if geo_res.status_code == 200:
                            geo_data = geo_res.json()
                            address = geo_data.get("address", {})
                            city = address.get("city") or address.get("town") or address.get("suburb") or address.get("state")
                            country = address.get("country")
                            if city and country:
                                location_name = f"{city}, {country}"
                            elif city:
                                location_name = city
                except Exception as ge:
                    logger.warning(f"Reverse geocoding failed: {str(ge)}")
                    
                weather_data = WeatherService.get_mock_weather(lat, lon, location_name)
                
            # 4. Save/Update cache in MongoDB
            if db_instance.db is not None:
                cache_col = db_instance.db["weather_cache"]
                await cache_col.update_one(
                    {"device_id": device_id},
                    {"$set": {
                        "weather_data": weather_data,
                        "last_updated": datetime.now(timezone.utc),
                        "lat": lat,
                        "lon": lon
                    }},
                    upsert=True
                )
            
            return weather_data
            
        except Exception as e:
            logger.error(f"WeatherService error: {str(e)}")
            # Guaranteed fallback so backend never crashes
            return WeatherService.get_mock_weather(lat, lon)

    @staticmethod
    async def get_weather_for_query(query: str, farm_profile: Optional[dict] = None) -> Optional[dict]:
        """
        Dynamically extracts location from chat query or farm profile, geocodes it,
        and retrieves live OpenWeatherMap data.
        """
        import re
        api_key = settings.OPENWEATHER_API_KEY
        if not api_key:
            return None

        # Extract location keyword from query (e.g., 'weather in Pasupugallu', 'climate at Guntur')
        target_loc = None
        match = re.search(r'\b(?:in|at|for|near|around)\s+([A-Za-z0-9\s,\-]+)', query, re.IGNORECASE)
        if match:
            target_loc = match.group(1).strip().rstrip('?.,!')
        elif farm_profile and farm_profile.get("location"):
            target_loc = farm_profile.get("location")

        lat, lon = None, None
        display_name = target_loc or "Your Farm"

        async with httpx.AsyncClient(timeout=6.0) as client:
            if target_loc:
                try:
                    geo_url = f"https://nominatim.openstreetmap.org/search?q={target_loc}&format=json&limit=1"
                    geo_res = await client.get(geo_url, headers={"User-Agent": "AgriShield/1.0"})
                    if geo_res.status_code == 200 and geo_res.json():
                        first_match = geo_res.json()[0]
                        lat = float(first_match["lat"])
                        lon = float(first_match["lon"])
                        display_name = first_match.get("display_name", target_loc).split(",")[0]
                except Exception as ge:
                    logger.warning(f"Geocoding failed for {target_loc}: {ge}")

            if lat is None and farm_profile:
                lat = farm_profile.get("latitude")
                lon = farm_profile.get("longitude")
                if lat and lon:
                    display_name = farm_profile.get("farm_name") or target_loc or "Your Farm"

            if lat is not None and lon is not None:
                try:
                    w_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
                    w_res = await client.get(w_url)
                    if w_res.status_code == 200:
                        d = w_res.json()
                        main = d.get("main", {})
                        weather_info = d.get("weather", [{}])[0]
                        wind = d.get("wind", {})
                        city_name = d.get("name") or display_name
                        return {
                            "location": f"{city_name} (near {display_name})",
                            "temperature": f"{round(main.get('temp', 28.0), 1)}°C (feels like {round(main.get('feels_like', 29.0), 1)}°C)",
                            "humidity": f"{main.get('humidity', 60)}%",
                            "condition": weather_info.get("main", "Clear"),
                            "description": weather_info.get("description", "clear sky").capitalize(),
                            "wind_speed": f"{wind.get('speed', 2.0)} m/s",
                            "pressure": f"{main.get('pressure', 1010)} hPa",
                            "source": "OpenWeatherMap Live Satellite Data"
                        }
                except Exception as we:
                    logger.warning(f"OpenWeather request failed for {display_name}: {we}")

        return None
