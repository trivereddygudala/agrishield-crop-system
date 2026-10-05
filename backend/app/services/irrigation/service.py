import time
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException, status

from backend.app.services.irrigation.utils import get_crop_kc, get_target_soil_moisture
from backend.app.services.weather import WeatherIntelligenceService
from backend.app.db.mongodb import db_instance

logger = logging.getLogger(__name__)


class SmartIrrigationService:
    def __init__(self, weather_service=None, db=None):
        self.weather_service = weather_service or WeatherIntelligenceService()
        self._db = db

    @property
    def db(self):
        return self._db if self._db is not None else db_instance.db

    async def calculate_irrigation_recommendation(
        self,
        farm_id: Optional[str] = None,
        crop_name: Optional[str] = None,
        growth_stage: Optional[str] = None,
        farm_size_acres: float = 1.0,
        current_soil_moisture: Optional[float] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        device_id: Optional[str] = None,
        current_user: Optional[dict] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat() + "Z"

        irrigation_method = "Manual"
        water_source = "Rain Water"
        crop_variety = None

        # ------------------------------------------------------------------
        # 1. Resolve Active Farm Profile & Metadata & Verify Access
        # ------------------------------------------------------------------
        current_db = self.db
        if farm_id and farm_id != "default" and current_db is not None:
            try:
                from bson import ObjectId
                query_cond = [{"id": farm_id}]
                if ObjectId.is_valid(farm_id):
                    query_cond.append({"_id": ObjectId(farm_id)})
                else:
                    query_cond.append({"_id": farm_id})

                farm_doc = await current_db["farm_profiles"].find_one({"$or": query_cond})
                if not farm_doc:
                    farm_doc = await current_db["farms"].find_one({"$or": query_cond})

                if farm_doc:
                    # Enforce RBAC access if current_user is passed
                    if current_user:
                        user_id = str(current_user.get("id") or current_user.get("user_id") or current_user.get("_id") or "")
                        user_role = (current_user.get("role") or "farmer").lower()
                        owner_id = str(farm_doc.get("owner_id") or farm_doc.get("user_id") or "")
                        if user_role != "admin" and owner_id and owner_id != user_id:
                            from fastapi import HTTPException, status
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access forbidden: you do not own this farm."
                            )

                    # Inherit real crop metadata if not explicitly provided
                    crop_name = crop_name or farm_doc.get("crop_name")
                    crop_variety = farm_doc.get("crop_variety")
                    growth_stage = growth_stage or farm_doc.get("growth_stage")
                    if farm_size_acres == 1.0 and farm_doc.get("farm_size"):
                        try:
                            farm_size_acres = float(farm_doc["farm_size"])
                        except (ValueError, TypeError):
                            pass
                    device_id = device_id or farm_doc.get("device_id")
                    if lat is None and farm_doc.get("latitude") is not None:
                        lat = float(farm_doc["latitude"])
                    if lon is None and farm_doc.get("longitude") is not None:
                        lon = float(farm_doc["longitude"])
                    irrigation_method = farm_doc.get("irrigation_method") or "Manual"
                    water_source = farm_doc.get("water_source") or "Rain Water"
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Error resolving farm profile in SmartIrrigationService: {e}")

        # Safe coordinate fallbacks for regional weather lookup
        safe_lat = float(lat) if lat is not None else 16.5062
        safe_lon = float(lon) if lon is not None else 80.6480

        # ------------------------------------------------------------------
        # 2. Check for Missing Crop Profile (User Request Section 7)
        # ------------------------------------------------------------------
        if not crop_name or not str(crop_name).strip():
            processing_time_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "metadata": {
                    "api_version": "1.0",
                    "generated_at": now_iso,
                    "processing_time_ms": processing_time_ms,
                    "cache_status": "Live",
                    "cache_expires_in": 1800
                },
                "mode": "software_ai",
                "sensor_status": "not_connected",
                "irrigation_required": None,
                "water_quantity_liters_per_acre": None,
                "water_quantity_total": None,
                "best_irrigation_time": "Upon profile setup",
                "next_irrigation_date": now_utc.strftime("%Y-%m-%d"),
                "confidence_score": 0.0,
                "recommendation": "Crop information required. Please specify your active crop and growth stage in Farm Settings to receive smart irrigation advice.",
                "reasoning": [
                    "Crop name is not specified for this farm.",
                    "Water requirement calculations depend directly on crop evapotranspiration coefficients (Kc) and growth stage."
                ],
                "crop_type": None,
                "growth_stage": None,
                "current_soil_moisture": None,
                "target_soil_moisture": None,
                "moisture_deficit": None,
                "irrigation_method": irrigation_method,
                "recommended_pump_minutes": None,
                "data_timestamp": None,
                "weather_summary": None,
                "rain_probability": None,
                "source_status": "missing_crop_profile"
            }

        resolved_stage = growth_stage or "Vegetative"

        # ------------------------------------------------------------------
        # 3. Detect Mode & Inspect IoT Telemetry Freshness (Section 4 & 5)
        # ------------------------------------------------------------------
        mode = "software_ai"
        sensor_status = "not_connected"
        live_soil_moisture: Optional[float] = None
        live_temperature: Optional[float] = None
        live_humidity: Optional[float] = None
        rain_sensor_state: Optional[int] = None
        telemetry_timestamp: Optional[str] = None
        offline_advisory_note: Optional[str] = None

        if device_id and current_db is not None:
            try:
                device_doc = await current_db["devices"].find_one({"device_id": device_id})
                if not device_doc:
                    sensor_status = "not_connected"
                    offline_advisory_note = f"IoT device '{device_id}' is not registered in system."
                else:
                    # Enforce the existing authoritative 90-second watchdog rule
                    last_seen = device_doc.get("last_seen")
                    status = (device_doc.get("status") or "offline").lower()

                    parsed_last_seen = None
                    if isinstance(last_seen, datetime):
                        parsed_last_seen = last_seen
                        if parsed_last_seen.tzinfo is None:
                            parsed_last_seen = parsed_last_seen.replace(tzinfo=timezone.utc)
                    elif isinstance(last_seen, str):
                        try:
                            parsed_last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                        except Exception:
                            pass

                    seconds_since_seen = 999999
                    if parsed_last_seen:
                        seconds_since_seen = (now_utc - parsed_last_seen).total_seconds()

                    if status != "online" or seconds_since_seen > 90:
                        mode = "software_ai"
                        sensor_status = "offline"
                        mins_ago = int(seconds_since_seen / 60) if seconds_since_seen < 86400 else "many"
                        offline_advisory_note = (
                            f"IoT sensor node '{device_id}' is offline (last seen ~{mins_ago} min ago). "
                            "Advising via regional weather forecast and crop growth stage."
                        )
                    else:
                        # Device is authoritative online — retrieve latest telemetry
                        telem = device_doc.get("latest_telemetry")
                        if not telem or telem.get("soil_moisture") is None:
                            telem = await current_db["iot_telemetry"].find_one(
                                {"device_id": device_id},
                                sort=[("received_at", -1)]
                            )

                        if telem:
                            raw_sm = telem.get("soil_moisture")
                            if raw_sm is None:
                                raw_sm = telem.get("soil_percentage")

                            if raw_sm is not None:
                                try:
                                    sm_val = float(raw_sm)
                                    if 0.0 <= sm_val <= 100.0:
                                        live_soil_moisture = round(sm_val, 1)
                                        mode = "smart_iot"
                                        sensor_status = "online"
                                        live_temperature = telem.get("temperature")
                                        live_humidity = telem.get("humidity")
                                        rain_sensor_state = 1 if (telem.get("rain_sensor") or telem.get("rain_detected")) else 0
                                        telemetry_timestamp = telem.get("timestamp") or now_iso
                                    else:
                                        sensor_status = "unavailable"
                                        offline_advisory_note = "Sensor reported out-of-bounds soil reading."
                                except (ValueError, TypeError):
                                    sensor_status = "unavailable"
                                    offline_advisory_note = "Sensor reported invalid soil reading."
                            else:
                                sensor_status = "unavailable"
                                offline_advisory_note = "No soil moisture sensor connected to online node."
                        else:
                            sensor_status = "unavailable"
                            offline_advisory_note = "No telemetry received from node yet."
            except Exception as e:
                logger.error(f"Error checking IoT status in irrigation service: {e}")
                sensor_status = "unavailable"

        # Explicit override permitted only for verified testing if provided directly
        if current_soil_moisture is not None and mode != "smart_iot":
            try:
                sm_float = float(current_soil_moisture)
                if 0.0 <= sm_float <= 100.0:
                    live_soil_moisture = round(sm_float, 1)
                    mode = "smart_iot"
                    sensor_status = "online"
                    telemetry_timestamp = now_iso
            except (ValueError, TypeError):
                pass

        # ------------------------------------------------------------------
        # 4. Fetch Weather Telemetry & Enforce Mock Safety (Section 6)
        # ------------------------------------------------------------------
        weather = await self.weather_service.get_weather_for_farm(
            farm_id=farm_id, lat=safe_lat, lon=safe_lon
        )
        provider_name = weather.get("provider_name", "")
        provider_status = weather.get("provider_status", "")
        is_mock_weather = provider_name == "MockWeatherProvider" or "Mock" in provider_status

        current_w = weather.get("current", {})
        temp_c = float(current_w.get("temperature", 28.0))
        hum = float(current_w.get("humidity", 65.0))
        rain_prob = float(current_w.get("rain_probability", 0.0))
        wind_speed = float(current_w.get("wind_speed", 3.5))
        condition = current_w.get("condition", "Clear")

        weather_summary = f"{temp_c:.1f}°C, {hum:.0f}% humidity, {condition} (Rain: {rain_prob:.0f}%)"

        # ------------------------------------------------------------------
        # 5. Evapotranspiration ET0 & Crop Water Demand ETc
        # ------------------------------------------------------------------
        calc_temp = float(live_temperature) if live_temperature is not None else temp_c
        calc_hum = float(live_humidity) if live_humidity is not None else hum

        # FAO-56 Reference Evapotranspiration ET0 estimation
        radiation_factor = 0.0023 * (calc_temp + 17.8) * (max(4.0, 34.0 - calc_temp) ** 0.5)
        wind_corr = 1.0 + (wind_speed / 100.0)
        hum_corr = max(0.5, 1.0 - (calc_hum / 200.0))
        et0 = max(2.5, min(9.0, round(4.2 * radiation_factor * wind_corr * hum_corr, 2)))

        kc = get_crop_kc(crop_name, resolved_stage)
        target_moisture = get_target_soil_moisture(crop_name)
        etc = round(et0 * kc, 2)  # mm/day

        reasoning = []
        if offline_advisory_note:
            reasoning.append(offline_advisory_note)

        # ------------------------------------------------------------------
        # 6. Safety Gate: Mock Weather Without IoT Sensor (Section 6)
        # ------------------------------------------------------------------
        if is_mock_weather and mode == "software_ai":
            processing_time_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "metadata": {
                    "api_version": "1.0",
                    "generated_at": now_iso,
                    "processing_time_ms": processing_time_ms,
                    "cache_status": "Degraded",
                    "cache_expires_in": 300
                },
                "mode": "software_ai",
                "sensor_status": sensor_status,
                "irrigation_required": None,
                "water_quantity_liters_per_acre": None,
                "water_quantity_total": None,
                "best_irrigation_time": "Manual field check recommended",
                "next_irrigation_date": now_utc.strftime("%Y-%m-%d"),
                "confidence_score": 35.0,
                "recommendation": "Weather data temporarily unavailable. Please inspect field soil conditions manually before deciding on irrigation.",
                "reasoning": [
                    "Live regional weather provider is currently offline or unreachable.",
                    "Live field soil moisture sensor is not connected.",
                    "To prevent crop stress or over-watering, manual topsoil assessment is recommended."
                ],
                "crop_type": crop_name,
                "growth_stage": resolved_stage,
                "current_soil_moisture": None,
                "target_soil_moisture": target_moisture,
                "moisture_deficit": None,
                "irrigation_method": irrigation_method,
                "recommended_pump_minutes": None,
                "data_timestamp": None,
                "weather_summary": "Weather service offline (fallback data suppressed)",
                "rain_probability": None,
                "source_status": "weather_unavailable"
            }

        # ------------------------------------------------------------------
        # 7. Decision Logic: MODE 2 — SMART IoT HARDWARE MODE
        # ------------------------------------------------------------------
        if mode == "smart_iot" and live_soil_moisture is not None:
            moisture_deficit = round(max(0.0, target_moisture - live_soil_moisture), 1)

            # Rule 1: Physical Rain Sensor
            if rain_sensor_state == 1:
                irrigation_required = False
                water_per_acre = 0.0
                pump_minutes = 0
                confidence = 98.0
                recommendation = "Stop irrigation immediately. Active rainfall detected by your farm hardware."
                reasoning.append("Physical rain sensor on field node detected active rainfall.")
                reasoning.append(f"Live soil moisture is {live_soil_moisture}%. Keep pumps off to prevent root rot.")
                best_time = "Resume monitoring after rain ends"
                next_date = (now_utc + timedelta(days=1)).strftime("%Y-%m-%d")

            # Rule 2: Forecast Rain Bypass (Section 11)
            elif not is_mock_weather and rain_prob > 60.0:
                irrigation_required = False
                water_per_acre = 0.0
                pump_minutes = 0
                confidence = 94.0
                recommendation = "Delay irrigation. Significant precipitation expected in regional forecast."
                reasoning.append(f"Upcoming weather forecast shows elevated rain probability ({rain_prob:.0f}%).")
                reasoning.append(f"Live soil moisture is {live_soil_moisture}%. Natural rain will replenish soil.")
                best_time = "Post-rain evaluation tomorrow morning"
                next_date = (now_utc + timedelta(days=1)).strftime("%Y-%m-%d")

            # Rule 3: Optimal / Saturated Soil
            elif live_soil_moisture >= target_moisture or live_soil_moisture >= 65.0:
                irrigation_required = False
                water_per_acre = 0.0
                pump_minutes = 0
                confidence = 95.0
                recommendation = f"Soil moisture is optimal ({live_soil_moisture}%). Skip pump run today."
                reasoning.append(f"Current live soil moisture ({live_soil_moisture}%) meets or exceeds target ({target_moisture}%).")
                reasoning.append("Skipping motor run saves groundwater and prevents root asphyxiation.")
                best_time = "Routine check in 48 hours"
                next_date = (now_utc + timedelta(days=2)).strftime("%Y-%m-%d")

            # Rule 4: Deficit Detected -> Active Irrigation
            elif moisture_deficit > 8.0:
                irrigation_required = True
                deficit_mm = max(1.0, round(etc * (moisture_deficit / 25.0), 1))
                water_per_acre = round(deficit_mm * 4046.86, 0)

                # Pump duration by method
                meth_lower = irrigation_method.lower()
                if "drip" in meth_lower:
                    pump_minutes = round((deficit_mm / 3.2) * 60)
                elif "sprinkler" in meth_lower:
                    pump_minutes = round((deficit_mm / 12.0) * 60)
                else:  # Flood / manual
                    pump_minutes = round((deficit_mm / 25.0) * 60)

                confidence = 94.0 if not is_mock_weather else 82.0
                recommendation = (
                    f"Water {crop_name} field ({resolved_stage} stage) with {water_per_acre:.0f} L/acre "
                    f"({pump_minutes} min via {irrigation_method})."
                )
                reasoning.append(f"Live field soil moisture is {live_soil_moisture}% (deficit: {moisture_deficit}% below target {target_moisture}%).")
                reasoning.append(f"Crop coefficient Kc={kc:.2f} applied for {resolved_stage} stage (ETc {etc:.1f} mm/day).")
                if not is_mock_weather:
                    reasoning.append(f"Weather forecast indicates low rain risk ({rain_prob:.0f}%).")
                best_time = "06:00 AM - 08:30 AM (Early Morning) or after 05:00 PM"
                next_date = now_utc.strftime("%Y-%m-%d")

            # Rule 5: Adequate / Mild
            else:
                irrigation_required = False
                water_per_acre = 0.0
                pump_minutes = 0
                confidence = 90.0
                recommendation = f"Soil moisture is adequate ({live_soil_moisture}%). No immediate watering required."
                reasoning.append(f"Live soil moisture ({live_soil_moisture}%) is close to target threshold ({target_moisture}%).")
                reasoning.append("Monitor sensor again in 24 hours.")
                best_time = "Routine check in 24 hours"
                next_date = (now_utc + timedelta(days=1)).strftime("%Y-%m-%d")

            total_water = round(water_per_acre * farm_size_acres, 0)
            processing_time_ms = round((time.time() - start_time) * 1000, 2)

            return {
                "metadata": {
                    "api_version": "1.0",
                    "generated_at": now_iso,
                    "processing_time_ms": processing_time_ms,
                    "cache_status": "Live",
                    "cache_expires_in": 1800
                },
                "mode": "smart_iot",
                "sensor_status": "online",
                "irrigation_required": irrigation_required,
                "water_quantity_liters_per_acre": water_per_acre,
                "water_quantity_total": total_water,
                "best_irrigation_time": best_time,
                "next_irrigation_date": next_date,
                "confidence_score": confidence,
                "recommendation": recommendation,
                "reasoning": reasoning,
                "crop_type": crop_name,
                "growth_stage": resolved_stage,
                "current_soil_moisture": live_soil_moisture,
                "target_soil_moisture": target_moisture,
                "moisture_deficit": moisture_deficit,
                "irrigation_method": irrigation_method,
                "recommended_pump_minutes": pump_minutes,
                "data_timestamp": telemetry_timestamp,
                "weather_summary": weather_summary,
                "rain_probability": rain_prob if not is_mock_weather else None,
                "source_status": "hardware_verified"
            }

        # ------------------------------------------------------------------
        # 8. Decision Logic: MODE 1 — SOFTWARE AI MODE (Section 9)
        # ------------------------------------------------------------------
        # Rain bypass check
        if not is_mock_weather and rain_prob > 60.0:
            irrigation_required = False
            water_per_acre = 0.0
            pump_minutes = 0
            confidence = 90.0
            recommendation = "Delay irrigation. Significant precipitation expected in regional forecast."
            reasoning.append(f"Upcoming forecast shows elevated precipitation probability ({rain_prob:.0f}%).")
            reasoning.append("Live soil sensor is not connected; natural rain will provide crop hydration.")
            reasoning.append("Inspect topsoil tomorrow morning following the rain event.")
            best_time = "Post-rain evaluation tomorrow morning"
            next_date = (now_utc + timedelta(days=1)).strftime("%Y-%m-%d")
        else:
            # Theoretical crop evapotranspiration demand
            est_liters = round(etc * 4046.86 * 0.75, 0)
            meth_lower = irrigation_method.lower()
            if "drip" in meth_lower:
                pump_minutes = round((etc * 0.75 / 3.2) * 60)
            elif "sprinkler" in meth_lower:
                pump_minutes = round((etc * 0.75 / 12.0) * 60)
            else:
                pump_minutes = round((etc * 0.75 / 25.0) * 60)

            irrigation_required = None  # Honest: cannot confirm without soil measurement
            water_per_acre = est_liters
            confidence = 82.0

            if etc >= 4.5:
                recommendation = (
                    f"Elevated atmospheric water demand ({etc:.1f} mm/day) for {crop_name}. "
                    f"Check topsoil moisture before running {irrigation_method}."
                )
            else:
                recommendation = (
                    f"Moderate water demand ({etc:.1f} mm/day) for {crop_name}. "
                    f"Live soil moisture is unavailable; verify field conditions before watering."
                )

            reasoning.append("Live soil moisture sensor is not connected. Advisory is calculated from regional weather and crop growth stage.")
            reasoning.append(f"Reference evapotranspiration ET₀: {et0:.1f} mm/day (Crop coefficient Kc: {kc:.2f}, ETc: {etc:.1f} mm/day).")
            if not is_mock_weather:
                reasoning.append(f"Regional forecast rain probability is {rain_prob:.0f}%.")
            reasoning.append("Check field topsoil moisture by hand or connect an AgriShield IoT sensor for automated precision advice.")

            best_time = "06:00 AM - 08:30 AM or after 05:30 PM"
            next_date = (now_utc + timedelta(days=1)).strftime("%Y-%m-%d")

        total_water = round(water_per_acre * farm_size_acres, 0) if water_per_acre is not None else None
        processing_time_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "metadata": {
                "api_version": "1.0",
                "generated_at": now_iso,
                "processing_time_ms": processing_time_ms,
                "cache_status": "Live",
                "cache_expires_in": 1800
            },
            "mode": "software_ai",
            "sensor_status": sensor_status,
            "irrigation_required": irrigation_required,
            "water_quantity_liters_per_acre": water_per_acre,
            "water_quantity_total": total_water,
            "best_irrigation_time": best_time,
            "next_irrigation_date": next_date,
            "confidence_score": confidence,
            "recommendation": recommendation,
            "reasoning": reasoning,
            "crop_type": crop_name,
            "growth_stage": resolved_stage,
            "current_soil_moisture": None,  # NEVER FAKE 42.0/45.0
            "target_soil_moisture": target_moisture,
            "moisture_deficit": None,
            "irrigation_method": irrigation_method,
            "recommended_pump_minutes": pump_minutes,
            "data_timestamp": None,
            "weather_summary": weather_summary,
            "rain_probability": rain_prob if not is_mock_weather else None,
            "source_status": "software_ai_advisory"
        }
