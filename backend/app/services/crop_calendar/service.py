import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

from backend.app.db.mongodb import db_instance
from backend.app.services.weather import WeatherIntelligenceService
from backend.app.services.irrigation import SmartIrrigationService

logger = logging.getLogger(__name__)

# Standard agronomic phenology database by crop
CROP_PHENOLOGY_DATABASE = {
    "tomato": [
        {
            "id": "stage-1",
            "stage_name": "Nursery & Seedling",
            "min_das": 0,
            "max_das": 20,
            "duration_days": 20,
            "activities": [
                "Select certified disease-resistant hybrid seed variety.",
                "Trichoderma viride root drenching against damping-off.",
                "Maintain light nursery soil moisture."
            ],
            "fertilizer_schedule": ["Bio-fertilizer seed treatment with Azotobacter."],
            "irrigation_schedule": "Pre-sowing soil moistening (100 L/acre)",
            "pest_monitoring": ["Monitor for soil-borne cutworms and ants."],
            "disease_monitoring": ["Inspect for damping-off fungal spores."]
        },
        {
            "id": "stage-2",
            "stage_name": "Vegetative Canopy",
            "min_das": 21,
            "max_das": 45,
            "duration_days": 25,
            "activities": [
                "Apply second split Nitrogen and Potash.",
                "Scout lower leaf canopy for Whitefly and Aphids.",
                "Prune lower suckers touching soil and stake plants."
            ],
            "fertilizer_schedule": ["Apply N-P-K 19-19-19 foliar spray (5g/L) weekly."],
            "irrigation_schedule": "Drip irrigation 45 mins every 2 days",
            "pest_monitoring": ["Trap whiteflies using yellow sticky sheets."],
            "disease_monitoring": ["AI Disease Scan for Early/Late Blight leaf spots."]
        },
        {
            "id": "stage-3",
            "stage_name": "Flowering & Budding",
            "min_das": 46,
            "max_das": 65,
            "duration_days": 20,
            "activities": [
                "Foliar spray: Boron 20% @ 1g/L to prevent flower drop.",
                "Install yellow and blue sticky traps for Thrips.",
                "Maintain consistent root-zone moisture; avoid water stress."
            ],
            "fertilizer_schedule": ["Apply Calcium Nitrate + Boron foliar spray (2g/L)."],
            "irrigation_schedule": "Consistent moisture: Drip irrigation 60 mins every 2 days",
            "pest_monitoring": ["Check blossom clusters for thrips and mites."],
            "disease_monitoring": ["Inspect flowers for Botrytis gray mold."]
        },
        {
            "id": "stage-4",
            "stage_name": "Fruit Set & Sizing",
            "min_das": 66,
            "max_das": 90,
            "duration_days": 25,
            "activities": [
                "Spray 0-0-50 Potassium Sulphate for fruit shine & weight.",
                "Install pheromone traps for Fruit Borer (Helicoverpa).",
                "Inspect for Alternaria fruit rot and early blight."
            ],
            "fertilizer_schedule": ["Apply High Potassium dose (MOP 25kg/acre)."],
            "irrigation_schedule": "Deep drip irrigation 60 mins every 3 days",
            "pest_monitoring": ["Monitor for fruit borer larvae."],
            "disease_monitoring": ["Scan fruit surface for Alternaria rot spots."]
        },
        {
            "id": "stage-5",
            "stage_name": "Harvest & Picking",
            "min_das": 91,
            "max_das": 120,
            "duration_days": 30,
            "activities": [
                "Pick fruits at breaker stage for long transport.",
                "Maintain 3-day harvest picking intervals.",
                "Grade by size and pack in ventilated crates for APMC mandi."
            ],
            "fertilizer_schedule": ["Post-harvest compost replenishment."],
            "irrigation_schedule": "Taper off irrigation 5 days prior to final pick",
            "pest_monitoring": ["Check storage crates for fruit flies."],
            "disease_monitoring": ["Inspect harvested fruit for post-harvest rot."]
        }
    ],
    "default": [
        {
            "id": "stage-1",
            "stage_name": "Sowing & Germination",
            "min_das": 0,
            "max_das": 20,
            "duration_days": 20,
            "activities": [
                "Seed treatment with bio-fungicide or Trichoderma.",
                "Prepare field beds with adequate organic compost.",
                "Ensure proper initial soil moisture."
            ],
            "fertilizer_schedule": ["Apply basal dose: Single Super Phosphate (SSP)."],
            "irrigation_schedule": "Gentle moistening daily morning",
            "pest_monitoring": ["Inspect seedbed border rows."],
            "disease_monitoring": ["Ensure seed treatment fungicide coating."]
        },
        {
            "id": "stage-2",
            "stage_name": "Active Vegetative",
            "min_das": 21,
            "max_das": 45,
            "duration_days": 25,
            "activities": [
                "First weeding and inter-cultivation.",
                "Top-dress Nitrogen fertilizer split.",
                "Scout lower leaves for early pest vectors."
            ],
            "fertilizer_schedule": ["Apply balanced N-P-K fertilizer."],
            "irrigation_schedule": "Regular irrigation every 2-3 days",
            "pest_monitoring": ["Monitor for sucking pests."],
            "disease_monitoring": ["Scan for leaf spot lesions."]
        },
        {
            "id": "stage-3",
            "stage_name": "Flowering & Reproductive",
            "min_das": 46,
            "max_das": 75,
            "duration_days": 30,
            "activities": [
                "Micronutrient foliar spray (Zinc + Boron).",
                "Monitor for pest attacks and flower drop.",
                "Maintain steady moisture during bloom."
            ],
            "fertilizer_schedule": ["Apply micronutrient foliar booster."],
            "irrigation_schedule": "Optimal moisture maintenance",
            "pest_monitoring": ["Scout flower clusters for thrips."],
            "disease_monitoring": ["Inspect for blossom blight."]
        },
        {
            "id": "stage-4",
            "stage_name": "Maturity & Harvest",
            "min_das": 76,
            "max_das": 110,
            "duration_days": 35,
            "activities": [
                "Stop chemical applications ahead of statutory Pre-Harvest Interval (PHI).",
                "Stop irrigation 7 days before final harvest.",
                "Timely harvesting and clean storage."
            ],
            "fertilizer_schedule": ["Post-harvest field conditioning."],
            "irrigation_schedule": "Taper off irrigation prior to harvest",
            "pest_monitoring": ["Check storage crates."],
            "disease_monitoring": ["Inspect produce for storage rot."]
        }
    ]
}


class CropCalendarService:
    def __init__(self, weather_service=None, irrigation_service=None, db=None):
        self.weather_service = weather_service or WeatherIntelligenceService()
        self.irrigation_service = irrigation_service or SmartIrrigationService(weather_service=self.weather_service)
        self._db = db

    @property
    def db(self):
        return self._db if self._db is not None else db_instance.db

    async def get_crop_calendar(
        self,
        farm_id: Optional[str] = None,
        crop_name: Optional[str] = None,
        growth_stage: Optional[str] = None,
        planting_date: Optional[str] = None,
        days_since_sowing: Optional[int] = None,
        current_user: Optional[dict] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat() + "Z"
        current_date_str = now_utc.strftime("%Y-%m-%d")

        current_db = self.db
        farm_doc = None
        device_id = None
        lat = 16.5062
        lon = 80.6480
        completed_tasks_map = {}

        # ------------------------------------------------------------------
        # 1. Resolve Active Farm Profile & Metadata & Verify Access
        # ------------------------------------------------------------------
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

                    crop_name = crop_name or farm_doc.get("crop_name")
                    growth_stage = growth_stage or farm_doc.get("growth_stage")
                    planting_date = planting_date or farm_doc.get("planting_date")
                    device_id = farm_doc.get("device_id")
                    if farm_doc.get("latitude") is not None:
                        lat = float(farm_doc["latitude"])
                    if farm_doc.get("longitude") is not None:
                        lon = float(farm_doc["longitude"])
                    completed_tasks_map = farm_doc.get("timeline_tasks") or {}
            except Exception as e:
                from fastapi import HTTPException
                if isinstance(e, HTTPException):
                    raise
                logger.warning(f"Error resolving farm in CropCalendarService: {e}")

        # ------------------------------------------------------------------
        # 2. Check for Missing Crop Profile
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
                "status": "missing_crop_profile",
                "mode": "software_ai",
                "crop_name": None,
                "current_stage": None,
                "days_since_sowing": None,
                "recommendation": "Crop profile information required. Please configure your crop in Farm Settings.",
                "today_tasks": [],
                "upcoming_activities": [],
                "completed_activities": [],
                "stages": []
            }

        # ------------------------------------------------------------------
        # 3. Check for Missing Planting Date
        # ------------------------------------------------------------------
        parsed_planting_date = None
        if planting_date and str(planting_date).strip():
            try:
                parsed_planting_date = datetime.strptime(str(planting_date).strip(), "%Y-%m-%d").date()
            except ValueError:
                pass

        if not parsed_planting_date and days_since_sowing is None:
            processing_time_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "metadata": {
                    "api_version": "1.0",
                    "generated_at": now_iso,
                    "processing_time_ms": processing_time_ms,
                    "cache_status": "Live",
                    "cache_expires_in": 1800
                },
                "status": "missing_planting_date",
                "mode": "software_ai",
                "crop_name": crop_name,
                "current_stage": growth_stage or "Vegetative",
                "days_since_sowing": None,
                "recommendation": "Planting / sowing date required. Please set the planting date in Field Setup to generate your calendar.",
                "today_tasks": [],
                "upcoming_activities": [],
                "completed_activities": [],
                "stages": []
            }

        # Calculate DAS
        today_date = now_utc.date()
        if parsed_planting_date:
            das = max(1, (today_date - parsed_planting_date).days)
        else:
            das = int(days_since_sowing or 35)

        # ------------------------------------------------------------------
        # 4. Phenology Resolution & Stage Matching
        # ------------------------------------------------------------------
        crop_key = crop_name.lower().strip()
        stages_def = CROP_PHENOLOGY_DATABASE.get(crop_key, CROP_PHENOLOGY_DATABASE["default"])
        total_lifecycle_days = max(s["max_das"] for s in stages_def)

        # Determine active stage from DAS or user override
        active_stage = None
        for s in stages_def:
            if s["min_das"] <= das <= s["max_das"]:
                active_stage = s
                break
        if not active_stage:
            active_stage = stages_def[-1] if das > total_lifecycle_days else stages_def[0]

        resolved_stage_name = active_stage["stage_name"]

        # ------------------------------------------------------------------
        # 5. Two-Mode IoT Telemetry Inspection (Watchdog <= 90s)
        # ------------------------------------------------------------------
        mode = "software_ai"
        sensor_status = "not_connected"
        iot_context = None

        if device_id and current_db is not None:
            try:
                device_doc = await current_db["devices"].find_one({"device_id": device_id})
                if device_doc:
                    last_seen = device_doc.get("last_seen")
                    status_str = (device_doc.get("status") or "offline").lower()

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

                    seconds_since_seen = (now_utc - parsed_last_seen).total_seconds() if parsed_last_seen else 999999
                    if status_str == "online" and seconds_since_seen <= 90:
                        mode = "smart_iot"
                        sensor_status = "online"
                        telem = device_doc.get("latest_telemetry")
                        if not telem:
                            telem = await current_db["iot_telemetry"].find_one(
                                {"device_id": device_id},
                                sort=[("received_at", -1)]
                            )
                        if telem:
                            iot_context = {
                                "device_id": device_id,
                                "soil_moisture": telem.get("soil_moisture"),
                                "temperature": telem.get("temperature"),
                                "humidity": telem.get("humidity"),
                                "rain_sensor": telem.get("rain_sensor", 0),
                                "status": "online"
                            }
                    else:
                        mode = "software_ai"
                        sensor_status = "offline"
                        mins_ago = int(seconds_since_seen / 60) if seconds_since_seen < 86400 else "many"
                        iot_context = {
                            "device_id": device_id,
                            "status": "offline",
                            "note": f"Field sensor node offline (last seen ~{mins_ago} min ago). Schedule adapted using weather forecast."
                        }
            except Exception as e:
                logger.warning(f"Error checking IoT status in CropCalendarService: {e}")

        # ------------------------------------------------------------------
        # 6. Weather Context & Agricultural Risk Warnings
        # ------------------------------------------------------------------
        weather_context = None
        spray_delayed_by_weather = False
        heat_warning = False

        try:
            w_res = await self.weather_service.get_weather_for_farm(farm_id=farm_id, lat=lat, lon=lon)
            provider_name = w_res.get("provider_name", "")
            is_mock_weather = provider_name == "MockWeatherProvider" or "Mock" in w_res.get("provider_status", "")

            if is_mock_weather and mode == "software_ai":
                weather_context = {
                    "status": "unavailable",
                    "note": "Weather forecast unavailable. Inspect field manually."
                }
            else:
                curr = w_res.get("current", {})
                rain_prob = float(curr.get("rain_probability", 0.0))
                temp_c = float(curr.get("temperature", 28.0))
                cond = curr.get("condition", "Clear")

                if rain_prob > 60.0:
                    spray_delayed_by_weather = True
                if temp_c > 38.0:
                    heat_warning = True

                weather_context = {
                    "status": "operational",
                    "temperature": temp_c,
                    "condition": cond,
                    "rain_probability": rain_prob,
                    "spray_delayed": spray_delayed_by_weather,
                    "heat_warning": heat_warning,
                    "note": "Rain forecast elevated (>60%). Delay foliar chemical sprays." if spray_delayed_by_weather else (
                        "Extreme heat (>38°C). Schedule field operations during cooler morning or twilight hours." if heat_warning else "Weather conditions favorable for field operations."
                    )
                }
        except Exception as e:
            logger.warning(f"Error fetching weather in CropCalendarService: {e}")
            weather_context = {
                "status": "unavailable",
                "note": "Weather forecast unavailable. Inspect field manually."
            }

        # ------------------------------------------------------------------
        # 7. Consume B15 Irrigation Recommendation
        # ------------------------------------------------------------------
        irrigation_task_item = None
        try:
            irr_res = await self.irrigation_service.calculate_irrigation_recommendation(
                farm_id=farm_id,
                crop_name=crop_name,
                growth_stage=resolved_stage_name,
                lat=lat,
                lon=lon,
                device_id=device_id
            )
            if irr_res.get("irrigation_required") is True:
                pump_mins = irr_res.get("recommended_pump_minutes") or 45
                irrigation_task_item = {
                    "task_id": "b15-irrigation-action",
                    "title": "Irrigation Action Required",
                    "category": "Irrigation",
                    "description": irr_res.get("recommendation") or f"Run irrigation for {pump_mins} minutes based on moisture deficit.",
                    "priority": "Critical" if mode == "smart_iot" else "High",
                    "due_date": current_date_str,
                    "source": "B15_Smart_Irrigation",
                    "status": "pending",
                    "mode_badge": "Smart IoT Verified" if mode == "smart_iot" else "Weather Mode"
                }
        except Exception as e:
            logger.warning(f"Error querying B15 irrigation in CropCalendarService: {e}")

        # ------------------------------------------------------------------
        # 8. Dynamic Date Mapping: Today, Upcoming, and Completed Tasks
        # ------------------------------------------------------------------
        today_tasks: List[Dict[str, Any]] = []
        upcoming_activities: List[Dict[str, Any]] = []
        completed_activities: List[Dict[str, Any]] = []

        if irrigation_task_item:
            # Check if farmer marked it done/skipped in timeline_tasks
            task_state = completed_tasks_map.get("b15-irrigation-action")
            if task_state is True:
                irrigation_task_item["status"] = "completed"
                completed_activities.append(irrigation_task_item)
            elif isinstance(task_state, dict) and task_state.get("status") in ("completed", "skipped", "delayed"):
                irrigation_task_item["status"] = task_state.get("status")
                irrigation_task_item["note"] = task_state.get("note")
                irrigation_task_item["completed_at"] = task_state.get("completed_at")
                if task_state.get("status") == "completed":
                    completed_activities.append(irrigation_task_item)
                elif task_state.get("status") == "delayed":
                    today_tasks.append(irrigation_task_item)
            else:
                today_tasks.append(irrigation_task_item)

        # Map each phenology stage's activities
        for stg in stages_def:
            stg_id = stg["id"]
            stg_name = stg["stage_name"]
            stg_min = stg["min_das"]
            stg_max = stg["max_das"]

            # Estimate calendar dates based on planting date
            if parsed_planting_date:
                stage_start_date = parsed_planting_date + timedelta(days=stg_min)
                stage_end_date = parsed_planting_date + timedelta(days=stg_max)
            else:
                stage_start_date = today_date + timedelta(days=(stg_min - das))
                stage_end_date = today_date + timedelta(days=(stg_max - das))

            for idx, act in enumerate(stg["activities"]):
                task_id = f"{stg_id}-task-{idx}"
                task_state = completed_tasks_map.get(task_id)

                is_done = task_state is True or (isinstance(task_state, dict) and task_state.get("status") == "completed")
                is_skipped = isinstance(task_state, dict) and task_state.get("status") == "skipped"
                is_delayed = isinstance(task_state, dict) and task_state.get("status") == "delayed"

                status_val = "completed" if is_done else ("skipped" if is_skipped else ("delayed" if is_delayed else "pending"))
                completed_at = task_state.get("completed_at") if isinstance(task_state, dict) else (now_iso if is_done else None)
                farmer_note = task_state.get("note") if isinstance(task_state, dict) else None

                task_obj = {
                    "task_id": task_id,
                    "title": act,
                    "stage_name": stg_name,
                    "stage_id": stg_id,
                    "category": "Pest" if "pest" in act.lower() or "spray" in act.lower() else ("Nutrition" if "fertilizer" in act.lower() or "potash" in act.lower() else "Agronomic Care"),
                    "priority": "High" if "spray" in act.lower() or "boron" in act.lower() else "Medium",
                    "due_date": stage_start_date.strftime("%Y-%m-%d"),
                    "status": status_val,
                    "completed_at": completed_at,
                    "note": farmer_note
                }

                # Apply weather spray delay context
                if spray_delayed_by_weather and ("spray" in act.lower() or "chemical" in act.lower()):
                    task_obj["weather_warning"] = "Rain expected. Delay application until foliage dries."
                    task_obj["priority"] = "Medium"

                if status_val == "completed":
                    completed_activities.append(task_obj)
                elif stg["id"] == active_stage["id"]:
                    today_tasks.append(task_obj)
                elif das < stg_min:
                    upcoming_activities.append(task_obj)
                else:
                    # Past uncompleted task
                    if not is_skipped:
                        today_tasks.append(task_obj)

        processing_time_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "metadata": {
                "api_version": "1.0",
                "generated_at": now_iso,
                "processing_time_ms": processing_time_ms,
                "cache_status": "Live",
                "cache_expires_in": 1800
            },
            "status": "ready",
            "mode": mode,
            "sensor_status": sensor_status,
            "crop_name": crop_name,
            "current_stage": resolved_stage_name,
            "days_since_sowing": das,
            "total_lifecycle_days": total_lifecycle_days,
            "planting_date": parsed_planting_date.strftime("%Y-%m-%d") if parsed_planting_date else None,
            "mode_description": "Validated with live field telemetry" if mode == "smart_iot" else "Based on crop phenology and regional weather forecast",
            "weather_context": weather_context,
            "iot_context": iot_context,
            "today_tasks": today_tasks,
            "upcoming_activities": upcoming_activities,
            "completed_activities": completed_activities,
            "stages": [
                {
                    **s,
                    "is_active": s["stage_name"].lower() == resolved_stage_name.lower()
                }
                for s in stages_def
            ]
        }
