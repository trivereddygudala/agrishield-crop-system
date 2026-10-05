import time
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

from backend.app.db.mongodb import db_instance
from backend.app.models.action_center import FarmerActionItem, FarmerActionsResponse
from backend.app.services.weather import WeatherIntelligenceService
from backend.app.services.irrigation import SmartIrrigationService
from backend.app.services.crop_calendar import CropCalendarService
from backend.app.services.risk_forecast import DiseaseRiskForecastService

logger = logging.getLogger(__name__)

PRIORITY_SORT_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


class ActionCenterService:
    def __init__(
        self,
        weather_service=None,
        irrigation_service=None,
        crop_calendar_service=None,
        risk_service=None,
        db=None
    ):
        self.weather_service = weather_service or WeatherIntelligenceService()
        self.irrigation_service = irrigation_service or SmartIrrigationService(weather_service=self.weather_service)
        self.crop_calendar_service = crop_calendar_service or CropCalendarService(
            weather_service=self.weather_service,
            irrigation_service=self.irrigation_service
        )
        self.risk_service = risk_service or DiseaseRiskForecastService(weather_service=self.weather_service)
        self._db = db

    @property
    def db(self):
        return self._db if self._db is not None else db_instance.db

    async def get_actions(
        self,
        farm_id: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 20,
        current_user: Optional[dict] = None
    ) -> FarmerActionsResponse:
        now_utc = datetime.now(timezone.utc)
        today_str = now_utc.strftime("%Y-%m-%d")
        current_db = self.db

        farm_doc = None
        user_id = str(current_user.get("id") or current_user.get("user_id") or current_user.get("_id") or "") if current_user else ""
        user_role = (current_user.get("role") or "farmer").lower() if current_user else "farmer"

        # ------------------------------------------------------------------
        # 1. Resolve Active Farm Profile & Metadata & Verify Access
        # ------------------------------------------------------------------
        if current_db is not None:
            if farm_id and farm_id != "default":
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

                    if farm_doc and current_user and user_role != "admin":
                        owner_id = str(farm_doc.get("owner_id") or farm_doc.get("user_id") or "")
                        if owner_id and owner_id != user_id:
                            from fastapi import HTTPException, status
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access forbidden: you do not own this farm."
                            )
                except Exception as e:
                    from fastapi import HTTPException
                    if isinstance(e, HTTPException):
                        raise
                    logger.warning(f"Error resolving farm in ActionCenterService: {e}")
            elif user_id:
                # Omitted farm_id: default to farmer's primary farm profile
                try:
                    farm_doc = await current_db["farm_profiles"].find_one({"user_id": user_id})
                    if not farm_doc:
                        farm_doc = await current_db["farms"].find_one({"user_id": user_id})
                except Exception as e:
                    logger.warning(f"Error resolving default farm for user in ActionCenterService: {e}")

        # Extract farm context
        farm_name = farm_doc.get("farm_name") or "My Farm" if farm_doc else "My Farm"
        crop_name = farm_doc.get("crop_name") if farm_doc else None
        growth_stage = farm_doc.get("growth_stage") if farm_doc else None
        planting_date = farm_doc.get("planting_date") if farm_doc else None
        device_id = farm_doc.get("device_id") if farm_doc else None
        farm_size_acres = float(farm_doc.get("farm_size", 1.0)) if farm_doc and farm_doc.get("farm_size") else 1.0
        lat = float(farm_doc["latitude"]) if farm_doc and farm_doc.get("latitude") is not None else 16.5062
        lon = float(farm_doc["longitude"]) if farm_doc and farm_doc.get("longitude") is not None else 80.6480
        resolved_farm_id = str(farm_doc.get("id") or farm_doc.get("_id") or farm_id or "default") if farm_doc else (farm_id or "default")

        # Farmer action interaction state (completed / dismissed)
        action_state = (farm_doc.get("action_center_state") or {}) if farm_doc else {}
        timeline_tasks = (farm_doc.get("timeline_tasks") or {}) if farm_doc else {}

        # ------------------------------------------------------------------
        # 2. Two-Mode IoT Telemetry Inspection (Watchdog <= 90s)
        # ------------------------------------------------------------------
        operating_mode = "software_ai"
        sensor_status = "not_connected"

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
                        operating_mode = "smart_iot"
                        sensor_status = "online"
                    else:
                        operating_mode = "software_ai"
                        sensor_status = "offline"
            except Exception as e:
                logger.warning(f"Error checking IoT status in ActionCenterService: {e}")

        # ------------------------------------------------------------------
        # 3. Concurrent Signal Aggregation with Per-Source Failure Isolation
        # ------------------------------------------------------------------
        irrigation_data = None
        crop_calendar_data = None
        weather_data = None
        risk_data = None
        recent_predictions = []
        equipment_bookings = []

        async def fetch_irrigation():
            try:
                return await self.irrigation_service.calculate_irrigation_recommendation(
                    farm_id=resolved_farm_id,
                    crop_name=crop_name,
                    growth_stage=growth_stage,
                    farm_size_acres=farm_size_acres,
                    lat=lat,
                    lon=lon,
                    device_id=device_id,
                    current_user=current_user
                )
            except Exception as e:
                logger.warning(f"[ActionCenter] Irrigation source unavailable: {e}")
                return None

        async def fetch_crop_calendar():
            try:
                return await self.crop_calendar_service.get_crop_calendar(
                    farm_id=resolved_farm_id,
                    crop_name=crop_name,
                    growth_stage=growth_stage,
                    planting_date=planting_date,
                    current_user=current_user
                )
            except Exception as e:
                logger.warning(f"[ActionCenter] Crop calendar source unavailable: {e}")
                return None

        async def fetch_weather():
            try:
                return await self.weather_service.get_weather_for_farm(
                    farm_id=resolved_farm_id,
                    lat=lat,
                    lon=lon
                )
            except Exception as e:
                logger.warning(f"[ActionCenter] Weather source unavailable: {e}")
                return None

        async def fetch_risk():
            try:
                return await self.risk_service.calculate_disease_risk(
                    farm_id=resolved_farm_id,
                    crop_name=crop_name or "Tomato",
                    lat=lat,
                    lon=lon
                )
            except Exception as e:
                logger.warning(f"[ActionCenter] Disease risk source unavailable: {e}")
                return None

        async def fetch_predictions():
            if not current_db or not user_id:
                return []
            try:
                cursor = current_db["predictions"].find(
                    {"user_id": user_id},
                    {"gradcam_base64": 0, "heatmap_base64": 0, "comparison_base64": 0}
                ).sort("created_at", -1).limit(5)
                return await cursor.to_list(length=5)
            except Exception as e:
                logger.warning(f"[ActionCenter] Prediction history source unavailable: {e}")
                return []

        async def fetch_bookings():
            if not current_db or not user_id:
                return []
            try:
                clean_phone = "".join(filter(str.isdigit, str(current_user.get("phone") or ""))) if current_user else ""
                q_or = [{"userId": user_id}, {"user_id": user_id}]
                if clean_phone:
                    q_or.append({"farmerPhone": clean_phone})
                cursor = current_db["equipment_bookings"].find(
                    {
                        "$or": q_or,
                        "status": {"$in": ["pending", "confirmed"]}
                    }
                ).sort("createdAt", -1).limit(5)
                return await cursor.to_list(length=5)
            except Exception as e:
                logger.warning(f"[ActionCenter] Equipment booking source unavailable: {e}")
                return []

        # Execute all sources in parallel
        results = await asyncio.gather(
            fetch_irrigation(),
            fetch_crop_calendar(),
            fetch_weather(),
            fetch_risk(),
            fetch_predictions(),
            fetch_bookings(),
            return_exceptions=True
        )

        irrigation_data = results[0] if not isinstance(results[0], Exception) else None
        crop_calendar_data = results[1] if not isinstance(results[1], Exception) else None
        weather_data = results[2] if not isinstance(results[2], Exception) else None
        risk_data = results[3] if not isinstance(results[3], Exception) else None
        recent_predictions = results[4] if not isinstance(results[4], Exception) else []
        equipment_bookings = results[5] if not isinstance(results[5], Exception) else []

        # ------------------------------------------------------------------
        # 4. Action Synthesis Layer
        # ------------------------------------------------------------------
        raw_actions: List[FarmerActionItem] = []

        # ── SOURCE 1: B15 Smart Irrigation ──
        if irrigation_data and irrigation_data.get("irrigation_required") is True:
            pump_mins = irrigation_data.get("recommended_pump_minutes") or 45
            water_per_acre = irrigation_data.get("water_quantity_liters_per_acre") or 0
            best_time = irrigation_data.get("best_irrigation_time") or "Early Morning"
            moisture_deficit = irrigation_data.get("moisture_deficit") or 0.0
            reasons = irrigation_data.get("reasoning") or []
            primary_reason = reasons[0] if reasons else "Soil moisture is below optimal threshold."

            irr_priority = "P1"
            if operating_mode == "smart_iot" and moisture_deficit > 15.0:
                irr_priority = "P0"
            elif operating_mode == "smart_iot" and moisture_deficit > 8.0:
                irr_priority = "P1"
            elif operating_mode == "software_ai":
                irr_priority = "P1"

            raw_actions.append(
                FarmerActionItem(
                    action_id=f"act-water-{resolved_farm_id}",
                    action_type="WATER",
                    priority=irr_priority,
                    what=f"Water {crop_name or 'Field'} ({farm_name})",
                    why=primary_reason,
                    when=f"Today — {best_time}",
                    due_date=today_str,
                    source="Smart Irrigation",
                    operating_mode=operating_mode,
                    status="pending",
                    action_url="/farm?tab=farm-intelligence",
                    action_label="View Irrigation Advice",
                    badge_text=f"{pump_mins} min run" if pump_mins else None,
                    metadata={
                        "pump_minutes": pump_mins,
                        "water_liters_per_acre": water_per_acre,
                        "soil_moisture": irrigation_data.get("current_soil_moisture"),
                        "deficit": moisture_deficit
                    }
                )
            )

        # ── SOURCE 2: B16 Crop Calendar (Active Today Tasks) ──
        if crop_calendar_data and crop_calendar_data.get("today_tasks"):
            for t_item in crop_calendar_data["today_tasks"]:
                t_id = t_item.get("task_id", "")
                # Skip if already handled by irrigation card above
                if t_id == "b15-irrigation-action":
                    continue

                t_cat = (t_item.get("category") or "Agronomic Care").lower()
                act_type = "SPRAY" if "spray" in t_cat or "pest" in t_cat else (
                    "FERTILIZE" if "nutrition" in t_cat or "fertilizer" in t_cat else "CROP_TASK"
                )

                # Map B16 priority
                orig_prio = (t_item.get("priority") or "Medium").lower()
                p_level = "P0" if orig_prio == "critical" else ("P1" if orig_prio == "high" else "P2")

                stg_name = t_item.get("stage_name") or growth_stage or "Current"
                weather_warn = t_item.get("weather_warning")
                why_text = f"{crop_name or 'Crop'} is in {stg_name} stage"
                if weather_warn:
                    why_text += f" • {weather_warn}"

                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-crop-{t_id}",
                        action_type=act_type,
                        priority=p_level,
                        what=t_item.get("title") or "Scheduled Crop Activity",
                        why=why_text,
                        when=t_item.get("due_date") or "Today",
                        due_date=t_item.get("due_date") or today_str,
                        source="Crop Calendar",
                        operating_mode=operating_mode,
                        status=t_item.get("status", "pending"),
                        action_url="/farm?tab=crop-lifecycle",
                        action_label="Open Crop Calendar",
                        badge_text=stg_name,
                        metadata={
                            "b16_task_id": t_id,
                            "stage_name": stg_name,
                            "category": t_item.get("category")
                        }
                    )
                )

        # ── SOURCE 3: Weather & Spray Safety ──
        if weather_data and weather_data.get("current"):
            curr_w = weather_data["current"]
            rain_prob = float(curr_w.get("rain_probability", 0.0))
            temp_c = float(curr_w.get("temperature", 28.0))

            if rain_prob > 60.0:
                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-weather-rain-{resolved_farm_id}",
                        action_type="WEATHER",
                        priority="P0",
                        what="Delay Foliar Chemical Sprays",
                        why=f"Rain forecast is elevated ({rain_prob:.0f}% chance). Foliar chemicals would be washed off.",
                        when="Next 24 hours",
                        due_date=today_str,
                        source="Weather Forecast",
                        operating_mode=operating_mode,
                        status="pending",
                        action_url="/farm?tab=farm-intelligence",
                        action_label="View Weather Forecast",
                        badge_text=f"{rain_prob:.0f}% Rain Risk"
                    )
                )

            if temp_c > 38.0:
                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-weather-heat-{resolved_farm_id}",
                        action_type="WEATHER",
                        priority="P1",
                        what="Schedule Field Work for Early Morning / Twilight",
                        why=f"Extreme heat ({temp_c:.1f}°C) forecast today. Avoid peak mid-day heat stress.",
                        when="06:00 AM – 09:00 AM or after 05:00 PM",
                        due_date=today_str,
                        source="Weather Forecast",
                        operating_mode=operating_mode,
                        status="pending",
                        action_url="/farm?tab=farm-intelligence",
                        action_label="View Weather Details",
                        badge_text=f"{temp_c:.1f}°C Heat"
                    )
                )

        # ── SOURCE 4: Disease / Pathology Intelligence ──
        # Check active diagnosis history from past 7 days
        for pred in recent_predictions:
            pred_status = (pred.get("prediction_status") or "").lower()
            if pred_status == "diseased":
                dis_name = pred.get("disease_name") or pred.get("predicted_class") or "Plant Infection"
                pred_crop = pred.get("crop_name") or crop_name or "Crop"
                conf = float(pred.get("confidence") or pred.get("confidence_score") or 0.8)

                if conf >= 0.70:
                    pred_id = str(pred.get("_id") or pred.get("id") or "pred")
                    raw_actions.append(
                        FarmerActionItem(
                            action_id=f"act-disease-followup-{pred_id}",
                            action_type="DISEASE_CHECK",
                            priority="P0" if conf >= 0.85 else "P1",
                            what=f"Inspect & Treat {pred_crop} for {dis_name}",
                            why=f"Diagnosed recently with {round(conf * 100)}% match. Follow-up leaf check and treatment recommended.",
                            when="Today — Morning scouting window",
                            due_date=today_str,
                            source="AI Health Scan",
                            operating_mode=operating_mode,
                            status="pending",
                            action_url="/history",
                            action_label="View Diagnosis & Treatment",
                            badge_text=f"{round(conf * 100)}% Match",
                            metadata={"disease_name": dis_name, "crop_name": pred_crop}
                        )
                    )
                    # Limit to 1 most recent disease action to prevent alert fatigue
                    break

        # Check regional pathogen outbreak radar
        if risk_data and risk_data.get("risk_percentage", 0) >= 75:
            raw_actions.append(
                FarmerActionItem(
                    action_id=f"act-pathogen-radar-{resolved_farm_id}",
                    action_type="INSPECT",
                    priority="P0",
                    what=f"High Pathogen Risk: Scout {crop_name or 'Field'} Canopy",
                    why="Regional weather conditions are creating optimal humidity and temperature for fungal spore germination.",
                    when="Today",
                    due_date=today_str,
                    source="Pathogen Radar",
                    operating_mode=operating_mode,
                    status="pending",
                    action_url="/upload",
                    action_label="Scan Crop Leaf",
                    badge_text=f"{risk_data.get('risk_percentage')}% Outbreak Risk"
                )
            )

        # ── SOURCE 5: B18 Smart Farm Inventory ──
        # Inspect inventory from farm profile document or dedicated collection
        inventory_items = []
        if farm_doc and farm_doc.get("inventory_items"):
            inventory_items = farm_doc.get("inventory_items")
        elif current_db is not None and resolved_farm_id != "default":
            try:
                inv_cursor = current_db["farm_inventory"].find(
                    {"farm_id": resolved_farm_id, "is_archived": {"$ne": True}}
                ).limit(50)
                inventory_items = await inv_cursor.to_list(length=50)
            except Exception as e:
                logger.warning(f"[ActionCenter] Error querying farm_inventory: {e}")

        for item in inventory_items:
            item_id = str(item.get("id") or item.get("_id") or "")
            item_name = item.get("name") or "Agricultural Input"
            cat = item.get("category") or "Input"
            qty = float(item.get("quantity") or 0.0)
            unit = item.get("unit") or "units"
            reorder_lvl = float(item.get("reorder_level") or 0.0)

            # Determine B18 status
            if qty <= 0:
                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-inv-out-{item_id}",
                        action_type="BUY_INPUT",
                        priority="P1",
                        what=f"Procure {item_name} ({cat})",
                        why=f"Current physical stock is 0 {unit} (Out of Stock). Restock before upcoming crop applications.",
                        when="Before next spray",
                        due_date=today_str,
                        source="Farm Inventory",
                        operating_mode=operating_mode,
                        status="pending",
                        action_url="/farm?tab=farm-inventory",
                        action_label="Open Farm Inventory",
                        badge_text="Out of Stock",
                        metadata={"item_id": item_id, "category": cat}
                    )
                )
            elif reorder_lvl > 0 and qty <= reorder_lvl:
                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-inv-low-{item_id}",
                        action_type="BUY_INPUT",
                        priority="P2",
                        what=f"Restock {item_name} ({cat})",
                        why=f"Stock ({qty} {unit}) is below reorder threshold ({reorder_lvl} {unit}).",
                        when="This week",
                        due_date=today_str,
                        source="Farm Inventory",
                        operating_mode=operating_mode,
                        status="pending",
                        action_url="/farm?tab=farm-inventory",
                        action_label="View Inventory",
                        badge_text="Low Stock",
                        metadata={"item_id": item_id, "quantity": qty, "unit": unit}
                    )
                )

            # Expiry check
            exp_date_str = item.get("expiry_date")
            if exp_date_str:
                try:
                    exp_date = datetime.strptime(str(exp_date_str).strip(), "%Y-%m-%d").date()
                    days_to_exp = (exp_date - now_utc.date()).days
                    if days_to_exp < 0:
                        raw_actions.append(
                            FarmerActionItem(
                                action_id=f"act-inv-exp-{item_id}",
                                action_type="BUY_INPUT",
                                priority="P2",
                                what=f"Dispose / Replace Expired {item_name}",
                                why=f"Input expired on {exp_date_str}. Using expired chemicals may damage crop foliage or fail efficacy.",
                                when="Immediate check",
                                due_date=today_str,
                                source="Farm Inventory",
                                operating_mode=operating_mode,
                                status="pending",
                                action_url="/farm?tab=farm-inventory",
                                action_label="Review Inventory",
                                badge_text="Expired",
                                metadata={"item_id": item_id}
                            )
                        )
                    elif days_to_exp <= 30:
                        raw_actions.append(
                            FarmerActionItem(
                                action_id=f"act-inv-exps-{item_id}",
                                action_type="BUY_INPUT",
                                priority="P2",
                                what=f"Check Expiring {item_name} Batch",
                                why=f"Stock expires in {days_to_exp} days ({exp_date_str}). Utilize before expiration.",
                                when=f"Within {days_to_exp} days",
                                due_date=exp_date_str,
                                source="Farm Inventory",
                                operating_mode=operating_mode,
                                status="pending",
                                action_url="/farm?tab=farm-inventory",
                                action_label="Review Inventory",
                                badge_text=f"{days_to_exp}d left",
                                metadata={"item_id": item_id}
                            )
                        )
                except Exception:
                    pass

        # ── SOURCE 6: B17 Farm Khata (Pending Financial Liabilities) ──
        # Inspect genuine actual liabilities only (no estimated/projected values)
        khata_txs = []
        if farm_doc and farm_doc.get("khata_transactions"):
            khata_txs = farm_doc.get("khata_transactions")
        elif current_db is not None and resolved_farm_id != "default":
            try:
                khata_cursor = current_db["farm_khata"].find(
                    {
                        "farm_id": resolved_farm_id,
                        "type": {"$ne": "projected"},
                        "is_estimated": {"$ne": True},
                        "payment_status": {"$in": ["pending", "unpaid", "overdue"]}
                    }
                ).limit(20)
                khata_txs = await khata_cursor.to_list(length=20)
            except Exception as e:
                logger.warning(f"[ActionCenter] Error querying farm_khata: {e}")

        for tx in khata_txs:
            # Enforce actual vs estimated distinction
            is_est = tx.get("is_estimated") is True or tx.get("type") == "projected"
            if is_est:
                continue

            pay_stat = (tx.get("payment_status") or "paid").lower()
            if pay_stat in ("pending", "unpaid", "overdue"):
                tx_id = str(tx.get("id") or tx.get("_id") or "")
                title = tx.get("title") or tx.get("category") or "Farm Expense"
                amount = float(tx.get("amount") or 0.0)
                vendor = tx.get("vendor") or ""
                due_d = tx.get("due_date") or tx.get("date")

                is_overdue = pay_stat == "overdue"
                if due_d:
                    try:
                        parsed_d = datetime.strptime(str(due_d).strip(), "%Y-%m-%d").date()
                        if parsed_d < now_utc.date():
                            is_overdue = True
                    except Exception:
                        pass

                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-khata-pay-{tx_id}",
                        action_type="PAYMENT",
                        priority="P1" if is_overdue else "P2",
                        what=f"Pay {vendor + ' for ' if vendor else ''}{title} (₹{amount:,.0f})",
                        why=f"Unpaid farming liability of ₹{amount:,.0f} due {due_d or 'soon'}.",
                        when="Overdue" if is_overdue else f"Due {due_d or 'Today'}",
                        due_date=due_d or today_str,
                        source="Farm Khata",
                        operating_mode=operating_mode,
                        status="pending",
                        action_url="/farm?tab=farm-khata",
                        action_label="Open Farm Khata",
                        badge_text="Overdue" if is_overdue else "Pending Payment",
                        metadata={"tx_id": tx_id, "amount": amount, "vendor": vendor}
                    )
                )

        # ── SOURCE 7: Equipment Bookings ──
        for b in equipment_bookings:
            b_id = str(b.get("id") or b.get("_id") or b.get("bookingId") or "")
            b_stat = (b.get("status") or "").lower()
            eq_name = b.get("equipmentName") or b.get("equipmentType") or "Machinery"
            start_d = b.get("startDate") or b.get("bookingDate")

            if b_stat == "confirmed":
                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-eq-confirmed-{b_id}",
                        action_type="EQUIPMENT",
                        priority="P1",
                        what=f"Prepare Field for {eq_name} Arrival",
                        why=f"Rental confirmed for {start_d or 'today'}. Clear field borders and verify water access.",
                        when=start_d or "Today",
                        due_date=start_d or today_str,
                        source="Equipment Rental",
                        operating_mode=operating_mode,
                        status="pending",
                        action_url="/equipment-booking",
                        action_label="View Equipment Booking",
                        badge_text="Confirmed Booking",
                        metadata={"booking_id": b_id}
                    )
                )
            elif b_stat == "pending":
                raw_actions.append(
                    FarmerActionItem(
                        action_id=f"act-eq-pending-{b_id}",
                        action_type="EQUIPMENT",
                        priority="P2",
                        what=f"Check Status of {eq_name} Booking",
                        why="Rental request is awaiting provider confirmation. Follow up if urgent.",
                        when="Pending Confirmation",
                        due_date=start_d or today_str,
                        source="Equipment Rental",
                        operating_mode=operating_mode,
                        status="pending",
                        action_url="/equipment-booking",
                        action_label="Check Booking Status",
                        badge_text="Awaiting Provider",
                        metadata={"booking_id": b_id}
                    )
                )

        # ------------------------------------------------------------------
        # 5. Apply Farmer Interaction State & Deduplication
        # ------------------------------------------------------------------
        seen_ids = set()
        active_actions: List[FarmerActionItem] = []

        for item in raw_actions:
            # Enforce deterministic deduplication
            if item.action_id in seen_ids:
                continue
            seen_ids.add(item.action_id)

            # Check B16 crop calendar timeline state for crop tasks
            if item.action_type in ("CROP_TASK", "SPRAY", "FERTILIZE") and item.metadata and "b16_task_id" in item.metadata:
                b16_tid = item.metadata["b16_task_id"]
                t_state = timeline_tasks.get(b16_tid)
                if t_state is True:
                    continue
                elif isinstance(t_state, dict):
                    s_val = t_state.get("status")
                    if s_val in ("completed", "skipped"):
                        continue
                    elif s_val == "delayed":
                        item.status = "delayed"

            # Check general action center interaction state
            saved_state = action_state.get(item.action_id)
            if isinstance(saved_state, dict):
                s_val = saved_state.get("status")
                if s_val in ("completed", "dismissed"):
                    continue
                elif s_val:
                    item.status = s_val

            # Filter by priority parameter if supplied
            if priority and item.priority.upper() != priority.upper():
                continue

            active_actions.append(item)

        # ------------------------------------------------------------------
        # 6. Sort by Priority (P0 -> P1 -> P2 -> P3) and Truncate to Limit
        # ------------------------------------------------------------------
        active_actions.sort(key=lambda a: PRIORITY_SORT_ORDER.get(a.priority, 99))
        urgent_count = sum(1 for a in active_actions if a.priority == "P0")
        high_count = sum(1 for a in active_actions if a.priority == "P1")

        final_actions = active_actions[:limit]

        return FarmerActionsResponse(
            farm_id=resolved_farm_id,
            farm_name=farm_name,
            crop_name=crop_name,
            operating_mode=operating_mode,
            sensor_status=sensor_status,
            total_actions=len(active_actions),
            urgent_count=urgent_count,
            high_count=high_count,
            actions=final_actions,
            generated_at=now_utc.isoformat() + "Z"
        )

    async def complete_action(
        self,
        farm_id: str,
        action_id: str,
        current_user: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Marks an action as completed.
        - If B16 crop calendar task: updates farm_profiles.timeline_tasks directly through the existing mechanism.
        - If advisory action: saves completion into farm_profiles.action_center_state.
        Never mutates inventory quantities, financial records, or bookings.
        """
        current_db = self.db
        if current_db is None:
            return {"status": "success", "action_id": action_id, "new_status": "completed", "message": "Action marked completed (in-memory)"}

        from bson import ObjectId
        query_cond = [{"id": farm_id}]
        if ObjectId.is_valid(farm_id):
            query_cond.append({"_id": ObjectId(farm_id)})
        else:
            query_cond.append({"_id": farm_id})

        farm_doc = await current_db["farm_profiles"].find_one({"$or": query_cond})
        if not farm_doc:
            farm_doc = await current_db["farms"].find_one({"$or": query_cond})
        if not farm_doc:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm profile not found.")

        # RBAC verification
        if current_user and (current_user.get("role") or "").lower() != "admin":
            user_id = str(current_user.get("id") or current_user.get("user_id") or current_user.get("_id") or "")
            owner_id = str(farm_doc.get("owner_id") or farm_doc.get("user_id") or "")
            if owner_id and owner_id != user_id:
                from fastapi import HTTPException, status
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: you do not own this farm.")

        now_iso = datetime.now(timezone.utc).isoformat() + "Z"

        # Check if this corresponds to a B16 crop task (e.g. act-crop-stage-1-task-0)
        if action_id.startswith("act-crop-"):
            b16_tid = action_id[len("act-crop-"):]
            timeline_tasks = farm_doc.get("timeline_tasks") or {}
            timeline_tasks[b16_tid] = {
                "status": "completed",
                "completed_at": now_iso
            }
            await current_db["farm_profiles"].update_one(
                {"_id": farm_doc["_id"]},
                {"$set": {"timeline_tasks": timeline_tasks, "updated_at": datetime.now(timezone.utc)}}
            )
            return {
                "status": "success",
                "action_id": action_id,
                "new_status": "completed",
                "message": f"Crop task '{b16_tid}' marked completed in crop calendar."
            }

        # Otherwise, persist to action_center_state
        action_state = farm_doc.get("action_center_state") or {}
        action_state[action_id] = {
            "status": "completed",
            "completed_at": now_iso
        }
        await current_db["farm_profiles"].update_one(
            {"_id": farm_doc["_id"]},
            {"$set": {"action_center_state": action_state, "updated_at": datetime.now(timezone.utc)}}
        )

        return {
            "status": "success",
            "action_id": action_id,
            "new_status": "completed",
            "message": "Action marked completed."
        }

    async def dismiss_action(
        self,
        farm_id: str,
        action_id: str,
        current_user: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Dismisses an advisory card without altering source data.
        """
        current_db = self.db
        if current_db is None:
            return {"status": "success", "action_id": action_id, "new_status": "dismissed", "message": "Action dismissed (in-memory)"}

        from bson import ObjectId
        query_cond = [{"id": farm_id}]
        if ObjectId.is_valid(farm_id):
            query_cond.append({"_id": ObjectId(farm_id)})
        else:
            query_cond.append({"_id": farm_id})

        farm_doc = await current_db["farm_profiles"].find_one({"$or": query_cond})
        if not farm_doc:
            farm_doc = await current_db["farms"].find_one({"$or": query_cond})
        if not farm_doc:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm profile not found.")

        # RBAC verification
        if current_user and (current_user.get("role") or "").lower() != "admin":
            user_id = str(current_user.get("id") or current_user.get("user_id") or current_user.get("_id") or "")
            owner_id = str(farm_doc.get("owner_id") or farm_doc.get("user_id") or "")
            if owner_id and owner_id != user_id:
                from fastapi import HTTPException, status
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden: you do not own this farm.")

        now_iso = datetime.now(timezone.utc).isoformat() + "Z"

        action_state = farm_doc.get("action_center_state") or {}
        action_state[action_id] = {
            "status": "dismissed",
            "dismissed_at": now_iso
        }
        await current_db["farm_profiles"].update_one(
            {"_id": farm_doc["_id"]},
            {"$set": {"action_center_state": action_state, "updated_at": datetime.now(timezone.utc)}}
        )

        return {
            "status": "success",
            "action_id": action_id,
            "new_status": "dismissed",
            "message": "Action dismissed."
        }
