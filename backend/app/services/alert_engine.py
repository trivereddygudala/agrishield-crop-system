import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from backend.app.models.notification import NotificationCreate
from backend.app.services.weather_service import WeatherService

logger = logging.getLogger(__name__)

class AlertEngine:
    @staticmethod
    def evaluate_condition(telemetry: Dict[str, Any], field: str, operator: str, value: Any) -> bool:
        """Helper to compare telemetry metrics against a rule condition."""
        val = telemetry.get(field)
        if val is None:
            return False
        try:
            # Convert values to comparable types
            if isinstance(val, (int, float)) or isinstance(value, (int, float)):
                val = float(val)
                value = float(value)
            
            if operator == "<": return val < value
            elif operator == ">": return val > value
            elif operator == "==": return val == value
            elif operator == "!=": return val != value
            elif operator == ">=": return val >= value
            elif operator == "<=": return val <= value
        except Exception as e:
            logger.error(f"Error evaluating condition: {field} {operator} {value} against {val}. Error: {e}")
        return False

    @staticmethod
    async def evaluate_device_telemetry(db, device_id: str, telemetry: Dict[str, Any]):
        """
        Evaluate incoming ESP32 telemetry data:
        1. Calculate & update Device Health Score
        2. Evaluate dynamic rules from notification_rules
        3. Enforce smart context-aware priority upgrades/downgrades
        4. Apply cooldowns, priority escalation, correlation, and auto-resolution
        5. Trigger farm-level aggregated alerts
        """
        try:
            # Fetch device and owner user details
            device_doc = await db.devices.find_one({"device_id": device_id})
            if not device_doc:
                logger.warning(f"Device {device_id} not registered in db. Skipping telemetry alerts.")
                return
            
            user_id = str(device_doc.get("user_id"))
            farm_id = str(device_doc.get("farm_id") or "")
            if not user_id:
                logger.warning(f"Device {device_id} has no registered owner. Skipping telemetry alerts.")
                return

            # 1. Calculate & update Device Health Score
            health_score = await AlertEngine.calculate_device_health(db, device_id, telemetry)
            await db.devices.update_one(
                {"device_id": device_id},
                {"$set": {
                    "health_score": health_score,
                    "last_seen": datetime.now(timezone.utc),
                    "status": "online"
                }}
            )

            # Fetch active user language settings
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
            user_lang = user_doc.get("preferred_language", "en") if user_doc else "en"

            # 2. Evaluate dynamic notification rules
            cursor = db.notification_rules.find({"enabled": True})
            rules = await cursor.to_list(length=100)

            for rule in rules:
                rule_name = rule["rule_name"]
                category = rule["category"]
                logic = rule.get("logic", "AND")
                conditions = rule.get("conditions", [])
                base_priority = rule.get("priority", "Medium")
                cooldown_minutes = rule.get("cooldown_minutes", 60)
                template_key = rule_name.lower().replace(" ", "_")

                # Evaluate rule logic matches
                match_results = [
                    AlertEngine.evaluate_condition(telemetry, cond["field"], cond["operator"], cond["value"])
                    for cond in conditions
                ]

                rule_matched = False
                if conditions:
                    if logic == "AND":
                        rule_matched = all(match_results)
                    else:
                        rule_matched = any(match_results)

                if rule_matched:
                    # 3. Smart Priority Engine Heuristics (Environment & Weather Context)
                    final_priority = base_priority
                    if category == "soil" and farm_id:
                        final_priority = await AlertEngine.adjust_soil_priority_with_weather(
                            db, device_id, farm_id, telemetry, base_priority
                        )

                    # 4. Check Cooldowns to prevent duplicate spam
                    cooldown_key = f"{device_id}_{category}_{rule_name}"
                    cooldown_doc = await db.notification_cooldowns.find_one({"_id": cooldown_key})
                    if cooldown_doc:
                        last_time = cooldown_doc.get("last_notification_time")
                        if last_time.tzinfo is None:
                            last_time = last_time.replace(tzinfo=timezone.utc)
                        if datetime.now(timezone.utc) - last_time < timedelta(minutes=cooldown_minutes):
                            logger.info(f"Alert '{rule_name}' for device {device_id} suppressed by cooldown.")
                            continue

                    # 5. Escalation / Updates to active alerts in place
                    active_alert = await db.notifications.find_one({
                        "user_id": user_id,
                        "device_id": device_id,
                        "category": category,
                        "title": rule["title"],
                        "status": "active"
                    })

                    if active_alert:
                        # Escalation Logic: If priority increases, upgrade active alert
                        priority_order = {"Info": 0, "Low": 1, "Medium": 2, "High": 3, "Critical": 4, "Emergency": 5}
                        active_pri = active_alert.get("priority", "Medium")
                        if priority_order.get(final_priority, 2) > priority_order.get(active_pri, 2):
                            # Escalate alert
                            msg = f"Escalated from {active_pri} to {final_priority}. {rule['message_template']}"
                            # Interpolate telemetry variables
                            for cond in conditions:
                                fld = cond["field"]
                                msg = msg.replace(f"{{{{{fld}}}}}", str(telemetry.get(fld, "")))
                            
                            timeline_entry = {
                                "status": "active",
                                "message": f"Alert escalated to {final_priority}.",
                                "timestamp": datetime.now(timezone.utc)
                            }
                            await db.notifications.update_one(
                                {"_id": active_alert["_id"]},
                                {
                                    "$set": {
                                        "priority": final_priority,
                                        "message": msg,
                                        "updated_at": datetime.now(timezone.utc)
                                    },
                                    "$push": {"timeline": timeline_entry}
                                }
                            )
                            logger.info(f"Escalated alert in-place for device {device_id}: {rule_name}")
                        continue

                    # 6. Correlation Engine Checks
                    # If multiple warnings exist on this device within 5m, group them
                    await AlertEngine.check_and_correlate_device_alerts(db, user_id, device_id, telemetry)

                    # Import NotificationService locally to avoid circular dependencies
                    from backend.app.services.notification_service import NotificationService
                    
                    # Create a new alert
                    # Build dynamic message values
                    rendered_msg = rule["message_template"]
                    for cond in conditions:
                        fld = cond["field"]
                        rendered_msg = rendered_msg.replace(f"{{{{{fld}}}}}", str(telemetry.get(fld, "")))

                    action_url = "/dashboard"
                    if category == "soil": action_url = "/farm?tab=farm-intelligence"
                    elif category == "battery": action_url = "/devices"

                    await NotificationService.create_notification(db, NotificationCreate(
                        user_id=user_id,
                        device_id=device_id,
                        farm_id=farm_id,
                        title=rule["title"],
                        message=rendered_msg,
                        category=category,
                        priority=final_priority,
                        action_url=action_url,
                        confidence_score=0.90 # high confidence metrics rule evaluation
                    ), template_key=template_key, template_context=telemetry)

                    # Write cooldown record
                    await db.notification_cooldowns.update_one(
                        {"_id": cooldown_key},
                        {"$set": {"last_notification_time": datetime.now(timezone.utc)}},
                        upsert=True
                    )

                else:
                    # 7. Automatic Alert Resolution
                    # If rule does NOT match but there is an active alert for it, resolve it
                    active_alert = await db.notifications.find_one({
                        "user_id": user_id,
                        "device_id": device_id,
                        "category": category,
                        "title": rule["title"],
                        "status": "active"
                    })
                    if active_alert:
                        timeline_entry = {
                            "status": "resolved",
                            "message": "Resolved automatically: telemetry variables returned to safe thresholds.",
                            "timestamp": datetime.now(timezone.utc)
                        }
                        await db.notifications.update_one(
                            {"_id": active_alert["_id"]},
                            {
                                "$set": {
                                    "status": "resolved",
                                    "resolved_at": datetime.now(timezone.utc),
                                    "read": True
                                },
                                "$push": {"timeline": timeline_entry}
                            }
                        )
                        logger.info(f"Automatically resolved notification {active_alert['_id']} for device {device_id}")

            # 8. Farm-Level Aggregation Alerts
            if farm_id:
                await AlertEngine.evaluate_farm_level_aggregation(db, user_id, farm_id)

        except Exception as e:
            logger.error(f"Error in AlertEngine dynamic telemetry evaluation: {e}")

    @staticmethod
    async def adjust_soil_priority_with_weather(db, device_id: str, farm_id: str, telemetry: dict, base_priority: str) -> str:
        """Dynamic Smart Priority: adjust alert priority based on rain forecasts."""
        try:
            farm = await db.farms.find_one({"_id": ObjectId(farm_id)})
            if farm:
                lat = farm.get("latitude", 28.6139)
                lon = farm.get("longitude", 77.2090)
                
                # Fetch cached/live weather forecast
                weather = await WeatherService.get_weather(device_id, lat, lon)
                if weather and "forecast" in weather:
                    forecast = weather["forecast"]
                    # Check next 6 hours (first 2 intervals) rain probability
                    rain_prob = max([f.get("rain_probability", 0) for f in forecast[:2]] or [0])
                    
                    if rain_prob > 80:
                        logger.info(f"Rain probability is high ({rain_prob}%). Downgrading soil moisture warning to Low.")
                        return "Low"
                    
                    # If high temp stress is present
                    temp = telemetry.get("temperature", 25)
                    if temp > 40:
                        logger.info(f"Extreme heat stress ({temp}°C) detected. Upgrading soil alert to Critical.")
                        return "Critical"
        except Exception as e:
            logger.error(f"Error adjusting priority with weather: {e}")
        return base_priority

    @staticmethod
    async def check_and_correlate_device_alerts(db, user_id: str, device_id: str, telemetry: dict):
        """Correlation Engine: Groups multiple warnings into 'Possible Power Failure Detected'."""
        try:
            # Check active device warnings
            active_alerts = await db.notifications.find({
                "user_id": user_id,
                "device_id": device_id,
                "status": "active"
            }).to_list(length=10)
            
            offline_metrics = 0
            if telemetry.get("battery_percentage", 100) < 15: offline_metrics += 1
            if telemetry.get("wifi_rssi", 0) < -85: offline_metrics += 1
            if telemetry.get("sd_card_status") == "error": offline_metrics += 1

            if len(active_alerts) >= 2 or offline_metrics >= 2:
                # Atomic MongoDB cooldown claim (safe across concurrent requests & multiple Render workers)
                cooldown_key = f"{device_id}_device_power_failure_correlation"
                now = datetime.now(timezone.utc)
                cutoff = now - timedelta(minutes=60)
                from pymongo.errors import DuplicateKeyError

                # 1. Attempt to claim an expired cooldown slot atomically
                claimed_doc = await db.notification_cooldowns.find_one_and_update(
                    {"_id": cooldown_key, "last_notification_time": {"$lt": cutoff}},
                    {"$set": {"last_notification_time": now}},
                    return_document=False
                )

                is_claimed = False
                was_inserted = False
                old_notification_time = None

                if claimed_doc:
                    is_claimed = True
                    old_notification_time = claimed_doc.get("last_notification_time")
                else:
                    # 2. If no expired doc matched, either:
                    #    a) Record does not exist yet -> insert atomically using unique _id constraint
                    #    b) Cooldown is still active (<60m) -> insert will fail with DuplicateKeyError
                    try:
                        await db.notification_cooldowns.insert_one({
                            "_id": cooldown_key,
                            "last_notification_time": now
                        })
                        is_claimed = True
                        was_inserted = True
                    except DuplicateKeyError:
                        is_claimed = False

                if not is_claimed:
                    logger.info(f"Correlated power failure alert for device {device_id} suppressed by active cooldown.")
                    return

                # Correlate alerts
                correlated_ids = [str(a["_id"]) for a in active_alerts]
                
                # Create correlated Alert
                from backend.app.services.notification_service import NotificationService
                try:
                    await NotificationService.create_notification(db, NotificationCreate(
                        user_id=user_id,
                        device_id=device_id,
                        title="Possible Power Failure Detected",
                        message=f"Possible Power Failure: Multiple offline or warning metrics detected for device {device_id}.",
                        category="device",
                        priority="Critical",
                        action_url="/devices"
                    ), template_key="possible_power_failure", template_context={"device_id": device_id})
                except Exception as notify_err:
                    # Roll back cooldown claim if notification creation fails
                    try:
                        if was_inserted:
                            await db.notification_cooldowns.delete_one({"_id": cooldown_key})
                        elif old_notification_time is not None:
                            await db.notification_cooldowns.update_one(
                                {"_id": cooldown_key},
                                {"$set": {"last_notification_time": old_notification_time}}
                            )
                        else:
                            await db.notification_cooldowns.delete_one({"_id": cooldown_key})
                    except Exception as rb_err:
                        logger.warning(f"Failed to rollback cooldown claim for {cooldown_key}: {rb_err}")
                    raise notify_err
                
                # Mark child alerts as resolved (correlated)
                for alert in active_alerts:
                    timeline_entry = {
                        "status": "resolved",
                        "message": "Resolved & correlated into 'Possible Power Failure' parent alert.",
                        "timestamp": datetime.now(timezone.utc)
                    }
                    await db.notifications.update_one(
                        {"_id": alert["_id"]},
                        {
                            "$set": {"status": "resolved", "resolved_at": datetime.now(timezone.utc)},
                            "$push": {"timeline": timeline_entry}
                        }
                    )
                logger.info(f"Correlated {len(active_alerts)} alerts on device {device_id} into power failure notification.")
        except Exception as e:
            logger.error(f"Error in AlertEngine correlation checks: {e}")

    @staticmethod
    async def evaluate_farm_level_aggregation(db, user_id: str, farm_id: str):
        """Aggregates sensor metrics across all devices in a farm and creates a single alert."""
        try:
            # Fetch devices belonging to this farm
            cursor = db.devices.find({"farm_id": farm_id})
            devices = await cursor.to_list(length=50)
            if len(devices) <= 1:
                return # No need to aggregate if only 1 device

            moisture_vals = []
            for d in devices:
                latest = d.get("latest_telemetry")
                if latest and latest.get("soil_moisture") is not None:
                    moisture_vals.append(latest["soil_moisture"])

            if moisture_vals:
                avg_moisture = sum(moisture_vals) / len(moisture_vals)
                if avg_moisture < 25.0:
                    # Trigger farm level notification
                    from backend.app.services.notification_service import NotificationService
                    farm_doc = await db.farms.find_one({"_id": ObjectId(farm_id)})
                    farm_name = farm_doc.get("farm_name", "Your Farm")
                    
                    title = "Entire Farm Soil Moisture is Low"
                    msg = f"Soil moisture average across all {len(devices)} nodes in '{farm_name}' is critically low ({avg_moisture:.1f}%)."
                    
                    cooldown_key = f"farm_soil_moisture_{farm_id}"
                    cooldown = await db.notification_cooldowns.find_one({"_id": cooldown_key})
                    if cooldown:
                        if datetime.now(timezone.utc) - cooldown["last_notification_time"] < timedelta(minutes=120):
                            return
                    
                    await NotificationService.create_notification(db, NotificationCreate(
                        user_id=user_id,
                        farm_id=farm_id,
                        title=title,
                        message=msg,
                        category="soil",
                        priority="High",
                        action_url="/farm?tab=farm-intelligence"
                    ), template_key="soil_moisture_low", template_context={"soil_moisture": avg_moisture, "liters": 5})

                    # Update cooldown
                    await db.notification_cooldowns.update_one(
                        {"_id": cooldown_key},
                        {"$set": {"last_notification_time": datetime.now(timezone.utc)}},
                        upsert=True
                    )

                    # Suppress/Resolve individual node alerts
                    await db.notifications.update_many(
                        {
                            "user_id": user_id,
                            "farm_id": farm_id,
                            "category": "soil",
                            "status": "active"
                        },
                        {"$set": {"status": "resolved", "resolved_at": datetime.now(timezone.utc)}}
                    )
        except Exception as e:
            logger.error(f"Error in farm-level alert aggregation: {e}")

    @staticmethod
    async def calculate_device_health(db, device_id: str, telemetry: Dict[str, Any]) -> str:
        """Determine device health status from telemetry metrics."""
        battery = telemetry.get("battery_percentage", 100)
        wifi = telemetry.get("wifi_rssi", 0)
        sensor_health = telemetry.get("sensor_health", {})
        
        has_sensor_error = any(status == "error" or status is False for status in sensor_health.values())

        if battery < 10 or has_sensor_error:
            return "Critical"
        elif battery < 20 or wifi < -85:
            return "Warning"
        elif battery < 50 or wifi < -75:
            return "Good"
        return "Excellent"
