from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from backend.app.db.mongodb import db_instance, get_database
from backend.app.services.weather_service import WeatherService
from backend.app.services.recommendation_engine import IrrigationRecommendationEngine
from backend.app.routers.auth import get_current_user
from backend.app.services.farm_profile_service import FarmProfileService
from backend.app.services.notification_service import NotificationService
from backend.app.services.alert_engine import AlertEngine
from backend.app.routers.notifications import ws_manager
from backend.app.models.notification import NotificationCreate

from backend.app.core.iot_security import validate_sensor_payload, validate_iot_request
from backend.app.core.rate_limiter import rate_limit, IOT_LIMIT

router = APIRouter(prefix="/api/v1/iot", tags=["IoT Hardware"])

class IoTTelemetry(BaseModel):
    device_id: str = Field(..., description="Unique ESP32 MAC or Node ID")
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat() + "Z")
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    vpd: Optional[float] = None
    pressure: Optional[float] = None
    soil_moisture: Optional[float] = Field(default=None, description="Soil moisture percentage")
    soil_percentage: Optional[float] = None
    light_intensity: Optional[float] = Field(default=None, description="Light intensity lux")
    light_lux: Optional[float] = None
    rain_sensor: Optional[int] = Field(default=0, description="0 for no rain, 1 for rain")
    rain_detected: Optional[int] = None
    rain_intensity: Optional[str] = None
    battery_percentage: Optional[float] = None
    battery_voltage: Optional[float] = None
    sd_card_status: Optional[str] = "mounted"
    sd_mounted: Optional[int] = 0
    sd_used_mb: Optional[float] = 0.0
    sd_total_mb: Optional[float] = 0.0
    wifi_rssi: Optional[int] = -65
    signal: Optional[int] = None
    wifi_connected: Optional[bool] = True
    bluetooth_connected: Optional[bool] = False
    firmware_version: Optional[str] = "v2.0"
    device_status: Optional[str] = "online"
    sensor_health: Optional[Dict[str, Any]] = Field(default_factory=dict)
    sleep_interval_min: Optional[int] = None   # How many minutes the ESP32 sleeps between readings
    is_night_mode: Optional[bool] = None        # True if recorded during autonomous night sleep cycle

class IoTHeartbeat(BaseModel):
    device_id: str
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat() + "Z")
    status: Optional[str] = "online"
    uptime_ms: Optional[int] = 0

async def is_iot_ingestion_enabled(db) -> bool:
    """Check if the admin has enabled IoT telemetry ingestion."""
    if db is None:
        return False
    try:
        setting = await db["system_settings"].find_one({"key": "iot_telemetry_ingestion"})
        if setting is not None:
            return bool(setting.get("enabled", False))
    except Exception:
        pass
    return False

@router.post("/telemetry", status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit(IOT_LIMIT, 60))])
async def ingest_telemetry(request: Request, data: IoTTelemetry, background_tasks: BackgroundTasks):
    """Ingest sensor data from the ESP32 hardware with security and range validation."""
    validate_iot_request(request)
    
    # Gate check: Telemetry ingestion is paused unless explicitly enabled by Administrator in Admin Panel
    if not await is_iot_ingestion_enabled(db_instance.db):
        return {
            "status": "paused",
            "message": "IoT telemetry ingestion is currently paused by Administrator.",
            "ingested": False
        }
    
    telemetry_doc = data.model_dump()
    # Validate physical bounds
    valid_bounds, bound_msg = validate_sensor_payload(telemetry_doc)
    if not valid_bounds:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=bound_msg)

    try:
        now_utc = datetime.now(timezone.utc)
        IST = timezone(timedelta(hours=5, minutes=30))
        now_ist = now_utc.astimezone(IST)
        telemetry_doc["received_at"] = now_utc

        # Validate incoming timestamp from ESP32 to prevent clock drift / future timestamps
        orig_ts = data.timestamp
        is_valid_ts = False
        if orig_ts and isinstance(orig_ts, str) and orig_ts.lower() != "null":
            try:
                clean_ts = orig_ts.replace("Z", "+00:00").strip()
                if "+05:30" not in clean_ts and "+" not in clean_ts:
                    clean_ts = clean_ts.replace(" ", "T") + "+05:30"
                parsed_dt = datetime.fromisoformat(clean_ts)
                time_diff = (parsed_dt.astimezone(timezone.utc) - now_utc).total_seconds()
                if -604800 <= time_diff <= 900:  # Within past 7 days and not in the future
                    telemetry_doc["timestamp"] = clean_ts
                    is_valid_ts = True
            except Exception:
                is_valid_ts = False

        if not is_valid_ts:
            telemetry_doc["timestamp"] = now_ist.strftime("%Y-%m-%dT%H:%M:%S+05:30")
        
        # Map aliases to standard fields if provided by hardware
        if data.soil_percentage is not None:
            telemetry_doc["soil_moisture"] = data.soil_percentage
        if data.light_lux is not None:
            # Store under BOTH keys so frontend can read either light_lux or light_intensity
            telemetry_doc["light_intensity"] = data.light_lux
            telemetry_doc["light_lux"] = data.light_lux
        if data.rain_detected is not None:
            telemetry_doc["rain_sensor"] = data.rain_detected
        if data.signal is not None:
            telemetry_doc["wifi_rssi"] = data.signal
            
        await db_instance.db["iot_telemetry"].insert_one(telemetry_doc)
        
        # Remove Mongo _id if injected during insertion before embedding into device doc
        telemetry_doc_clean = {k: v for k, v in telemetry_doc.items() if k != "_id"}

        update_fields = {
            "last_seen": datetime.now(timezone.utc), 
            "status": "online",
            "latest_telemetry": telemetry_doc_clean,
            "firmware_version": data.firmware_version
        }

        # Update device last_seen status
        await db_instance.db["devices"].update_one(
            {"device_id": data.device_id},
            {"$set": update_fields},
            upsert=True
        )

        # --- Auto-Notification Engine & Real-time WebSocket Broadcast ---
        now_iso = datetime.now(timezone.utc).isoformat()
        telemetry_payload = {
            "type": "telemetry_update",
            "device_id": data.device_id,
            "status": "online",
            "telemetry": telemetry_doc_clean,
            "data": telemetry_doc_clean,
            "timestamp": now_iso
        }
        status_payload = {
            "type": "device_status_update",
            "device_id": data.device_id,
            "status": "online",
            "timestamp": now_iso
        }

        # Broadcast to all connected WebSockets
        try:
            await ws_manager.broadcast_all(telemetry_payload)
            await ws_manager.broadcast_all(status_payload)
        except Exception:
            pass

        # Look up which user owns this device for notifications and alert evaluation
        device_doc = await db_instance.db["devices"].find_one({"device_id": data.device_id})
        owner_id = device_doc.get("user_id") if device_doc else None
        if owner_id:
            try:
                background_tasks.add_task(
                    AlertEngine.evaluate_device_telemetry,
                    db_instance.db,
                    device_id=data.device_id,
                    telemetry=telemetry_doc
                )
            except Exception as e:
                pass  # Never block telemetry ingestion

        display_lang = "TE"
        if device_doc:
            display_lang = device_doc.get("display_language", "TE")
            if not display_lang and owner_id:
                user_doc = await db_instance.db["users"].find_one({"_id": owner_id})
                if user_doc:
                    display_lang = user_doc.get("preferred_language", "TE")

        return {
            "status": "success", 
            "message": "Telemetry ingested",
            "display_language": display_lang or "TE"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest telemetry: {str(e)}")

@router.post("/telemetry/bulk", status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit(IOT_LIMIT, 60))])
async def ingest_telemetry_bulk(request: Request):
    """Ingest a bulk array or json-lines of sensor data from the ESP32 offline SD card sync."""
    validate_iot_request(request)
    
    # Gate check: Telemetry ingestion is paused unless explicitly enabled by Administrator in Admin Panel
    if not await is_iot_ingestion_enabled(db_instance.db):
        return {
            "status": "paused",
            "message": "IoT telemetry ingestion is currently paused by Administrator.",
            "ingested_count": 0
        }
    
    body_bytes = await request.body()
    body_str = body_bytes.decode('utf-8').strip()
    
    data_list = []
    if body_str.startswith("["):
        # Parse as JSON array
        try:
            import json
            raw_list = json.loads(body_str)
            data_list = [IoTTelemetry(**item) for item in raw_list]
        except Exception:
            pass
    elif body_str:
        # Parse as JSON Lines
        import json
        for line in body_str.split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                data_list.append(IoTTelemetry(**item))
            except Exception:
                continue
                
    final_payload = data_list if data_list else []
    docs_to_insert = []
    
    if not final_payload:
        return {"status": "success", "message": "No valid data to insert", "count": 0}
    
    total_items = len(final_payload)
    now_utc = datetime.now(timezone.utc)
    IST = timezone(timedelta(hours=5, minutes=30))

    seen_timestamps = {}

    for idx, data in enumerate(final_payload):
        telemetry_doc = data.model_dump()
        valid_bounds, bound_msg = validate_sensor_payload(telemetry_doc)
        if not valid_bounds:
            continue
            
        try:
            orig_ts = telemetry_doc.get("timestamp")
            is_valid_ts = False
            if orig_ts and isinstance(orig_ts, str) and orig_ts.lower() != "null":
                try:
                    clean_ts = orig_ts.replace("Z", "+00:00").strip()
                    if "+05:30" not in clean_ts and "+" not in clean_ts:
                        clean_ts = clean_ts.replace(" ", "T") + "+05:30"
                    parsed_dt = datetime.fromisoformat(clean_ts)
                    time_diff = (parsed_dt.astimezone(timezone.utc) - now_utc).total_seconds()
                    if -604800 <= time_diff <= 900:
                        # Prevent duplicate identical timestamps from frozen offline sleep clocks
                        if clean_ts in seen_timestamps:
                            seen_timestamps[clean_ts] += 1
                            repeat_count = seen_timestamps[clean_ts]
                            adjusted_dt = parsed_dt - timedelta(seconds=repeat_count * 60)
                            clean_ts = adjusted_dt.astimezone(IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")
                            telemetry_doc["received_at"] = adjusted_dt.astimezone(timezone.utc)
                        else:
                            seen_timestamps[clean_ts] = 0
                            telemetry_doc["received_at"] = parsed_dt.astimezone(timezone.utc)
                            
                        telemetry_doc["timestamp"] = clean_ts
                        is_valid_ts = True
                except Exception:
                    is_valid_ts = False

            if not is_valid_ts:
                offset_sec = (total_items - 1 - idx) * 60
                estimated_dt = now_utc - timedelta(seconds=offset_sec)
                telemetry_doc["timestamp"] = estimated_dt.astimezone(IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")
                telemetry_doc["received_at"] = estimated_dt
                
            if data.soil_percentage is not None:
                telemetry_doc["soil_moisture"] = data.soil_percentage
            if data.light_lux is not None:
                telemetry_doc["light_intensity"] = data.light_lux
                telemetry_doc["light_lux"] = data.light_lux
            if data.rain_detected is not None:
                telemetry_doc["rain_sensor"] = data.rain_detected
            if data.signal is not None:
                telemetry_doc["wifi_rssi"] = data.signal
                
            docs_to_insert.append(telemetry_doc)
        except Exception:
            continue
            
    if not docs_to_insert:
        return {"status": "success", "message": "No valid data to insert"}
        
    try:
        await db_instance.db["iot_telemetry"].insert_many(docs_to_insert)
        
        # Pick the most recent document in the batch to update device status
        latest_doc = docs_to_insert[-1]
        latest_clean = {k: v for k, v in latest_doc.items() if k != "_id"}
        target_device_id = latest_doc.get("device_id", "ESP32-NODE-ALPHA")

        await db_instance.db["devices"].update_one(
            {"device_id": target_device_id},
            {"$set": {
                "last_seen": datetime.now(timezone.utc),
                "status": "online",
                "latest_telemetry": latest_clean
            }},
            upsert=True
        )

        # Real-time WebSocket Broadcast to all connected frontend clients
        now_iso = datetime.now(timezone.utc).isoformat()
        sync_payload = {
            "type": "telemetry_batch_synced",
            "device_id": target_device_id,
            "count": len(docs_to_insert),
            "latest_telemetry": latest_clean,
            "timestamp": now_iso
        }
        telemetry_update_payload = {
            "type": "telemetry_update",
            "device_id": target_device_id,
            "status": "online",
            "telemetry": latest_clean,
            "data": latest_clean,
            "timestamp": now_iso
        }
        try:
            await ws_manager.broadcast_all(sync_payload)
            await ws_manager.broadcast_all(telemetry_update_payload)
        except Exception:
            pass

        return {
            "status": "success", 
            "message": f"Successfully ingested {len(docs_to_insert)} offline telemetry records",
            "count": len(docs_to_insert)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database bulk insertion failed: {str(e)}")

@router.post("/heartbeat")
async def device_heartbeat(data: IoTHeartbeat):
    """Receive heartbeat from ESP32 to monitor uptime."""
    try:
        await db_instance.db["devices"].update_one(
            {"device_id": data.device_id},
            {"$set": {
                "last_seen": datetime.now(timezone.utc), 
                "status": data.status,
                "uptime_ms": data.uptime_ms
            }},
            upsert=True
        )
        try:
            device_doc = await db_instance.db["devices"].find_one({"device_id": data.device_id})
            if device_doc and device_doc.get("user_id"):
                await ws_manager.broadcast_to_user(str(device_doc["user_id"]), {
                    "type": "device_status_update",
                    "device_id": data.device_id,
                    "status": data.status,
                    "uptime_ms": data.uptime_ms,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
        except Exception:
            pass
        return {"status": "success", "message": "Heartbeat acknowledged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Heartbeat failed: {str(e)}")

def parse_date(date_str: str) -> datetime:
    try:
        clean_str = date_str.replace("Z", "")
        if "T" in clean_str:
            if "." in clean_str:
                return datetime.strptime(clean_str.split(".")[0], "%Y-%m-%dT%H:%M:%S")
            return datetime.strptime(clean_str, "%Y-%m-%dT%H:%M:%S")
        else:
            return datetime.strptime(clean_str, "%Y-%m-%d")
    except Exception as e:
        raise ValueError(f"Invalid date format: {date_str}. Must be ISO 8601 format.")

def get_timeframe_bounds(timeframe: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    now = datetime.now(timezone.utc)
    group_id = {
        "year": {"$year": "$received_at"},
        "month": {"$month": "$received_at"},
        "day": {"$dayOfMonth": "$received_at"}
    }
    
    if timeframe == "today":
        start = datetime(now.year, now.month, now.day)
        end = now
        group_id["hour"] = {"$hour": "$received_at"}
        group_id["minute"] = {
            "$subtract": [
                {"$minute": "$received_at"},
                {"$mod": [{"$minute": "$received_at"}, 30]}
            ]
        }
    elif timeframe == "24h":
        start = now - timedelta(hours=24)
        end = now
        group_id["hour"] = {"$hour": "$received_at"}
        group_id["minute"] = {
            "$subtract": [
                {"$minute": "$received_at"},
                {"$mod": [{"$minute": "$received_at"}, 30]}
            ]
        }
    elif timeframe == "7d":
        start = now - timedelta(days=7)
        end = now
        group_id["hour"] = {
            "$subtract": [
                {"$hour": "$received_at"},
                {"$mod": [{"$hour": "$received_at"}, 2]}
            ]
        }
    elif timeframe == "30d":
        start = now - timedelta(days=30)
        end = now
    elif timeframe == "custom":
        if not start_date:
            raise HTTPException(status_code=400, detail="start_date is required for custom timeframe")
        start = parse_date(start_date)
        end = parse_date(end_date) if end_date else now
        delta = end - start
        if delta.days <= 1:
            group_id["hour"] = {"$hour": "$received_at"}
            group_id["minute"] = {
                "$subtract": [
                    {"$minute": "$received_at"},
                    {"$mod": [{"$minute": "$received_at"}, 30]}
                ]
            }
        elif delta.days <= 7:
            group_id["hour"] = {
                "$subtract": [
                    {"$hour": "$received_at"},
                    {"$mod": [{"$hour": "$received_at"}, 2]}
                ]
            }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe: {timeframe}")
        
    return start, end, group_id

@router.get("/telemetry/history")
async def get_telemetry_history(
    device_id: Optional[str] = None,
    timeframe: str = "7d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 5000
):
    """Retrieve historical sensor data points, automatically downsampled based on timeframe."""
    try:
        if timeframe == "raw":
            filter_query = {"device_id": device_id} if device_id else {}
            raw_docs = await db_instance.db["iot_telemetry"].find(filter_query).sort([("received_at", -1), ("_id", -1)]).to_list(length=limit)
            
            # Fetch farmer names for devices
            device_owner_map = {}
            user_cache = {}
            if raw_docs:
                unique_devices = list(set([d.get("device_id") for d in raw_docs if d.get("device_id")]))
                if unique_devices:
                    try:
                        devices = await db_instance.db["devices"].find({"device_id": {"$in": unique_devices}}).to_list(length=None)
                        unique_users = []
                        for dev in devices:
                            if dev.get("user_id"):
                                device_owner_map[dev["device_id"]] = dev["user_id"]
                                unique_users.append(dev["user_id"])
                        
                        if unique_users:
                            object_ids = [ObjectId(uid) for uid in set(unique_users) if ObjectId.is_valid(uid)]
                            users = await db_instance.db["users"].find({"_id": {"$in": object_ids}}).to_list(length=None)
                            for u in users:
                                user_cache[str(u["_id"])] = {
                                    "name": u.get("name") or u.get("full_name") or "Unknown Farmer",
                                    "email": u.get("email") or ""
                                }
                    except Exception:
                        pass

            IST = timezone(timedelta(hours=5, minutes=30))
            result = []
            seen_keys = set()
            for d in raw_docs:
                ts_str = ""
                orig_ts = d.get("timestamp")
                if orig_ts and isinstance(orig_ts, str) and orig_ts.lower() != "null":
                    if "+05:30" in orig_ts:
                        ts_str = orig_ts
                    else:
                        clean_ts = orig_ts.replace("Z", "").replace("z", "").strip()
                        if "T" in clean_ts:
                            ts_str = clean_ts + "+05:30"
                        elif " " in clean_ts:
                            ts_str = clean_ts.replace(" ", "T") + "+05:30"
                        else:
                            ts_str = clean_ts
                elif orig_ts and isinstance(orig_ts, datetime):
                    ist_dt = orig_ts.astimezone(IST) if orig_ts.tzinfo else orig_ts.replace(tzinfo=timezone.utc).astimezone(IST)
                    ts_str = ist_dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")
                elif d.get("received_at"):
                    rec_at = d.get("received_at")
                    ist_dt = rec_at.astimezone(IST) if rec_at.tzinfo else rec_at.replace(tzinfo=timezone.utc).astimezone(IST)
                    ts_str = ist_dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")
                elif isinstance(d.get("_id"), ObjectId):
                    gen_time = d["_id"].generation_time
                    ist_dt = gen_time.astimezone(IST)
                    ts_str = ist_dt.strftime("%Y-%m-%dT%H:%M:%S+05:30")
                else:
                    ts_str = datetime.now(IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")

                dev_id = d.get("device_id", "Unknown")
                temp_val = round(float(d.get("temperature") or 0.0), 2)
                hum_val = round(float(d.get("humidity") or 0.0), 2)

                # Deduplicate records by device_id + timestamp or within the same minute
                dedup_key = f"{dev_id}_{ts_str[:16]}_{temp_val}_{hum_val}"
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)

                rec_at_val = d.get("received_at")
                rec_at_str = rec_at_val.isoformat() if isinstance(rec_at_val, datetime) else str(rec_at_val or ts_str)

                rec = {
                    "id": str(d.get("_id", "")),
                    "device_id": dev_id,
                    "timestamp": ts_str,
                    "received_at": rec_at_str,
                    "temperature": temp_val,
                    "humidity": hum_val,
                    "soil_moisture": round(float(d.get("soil_moisture") or d.get("soil_percentage") or 0.0), 2),
                    "light_intensity": round(float(d.get("light_intensity") or d.get("light_lux") or 0.0), 2),
                    "pressure": round(float(d.get("pressure") or 0.0), 2),
                    "rain_sensor": 1 if (d.get("rain_sensor") or d.get("rain_detected")) else 0,
                    "battery_percentage": round(float(d.get("battery_percentage") or 0.0), 2),
                    "wifi_rssi": round(float(d.get("wifi_rssi") or d.get("signal") or -65), 2)
                }
                
                if dev_id in device_owner_map and device_owner_map[dev_id] in user_cache:
                    u_info = user_cache[device_owner_map[dev_id]]
                    rec["farmer_name"] = u_info["name"]
                    rec["farmer_email"] = u_info["email"]
                
                result.append(rec)
            return result

        start, end, group_id = get_timeframe_bounds(timeframe, start_date, end_date)
        
        query = {
            "received_at": {"$gte": start, "$lte": end}
        }
        if device_id:
            query["device_id"] = device_id
        
        date_parts = {
            "year": "$_id.year",
            "month": "$_id.month",
            "day": "$_id.day"
        }
        if "hour" in group_id:
            date_parts["hour"] = "$_id.hour"
        if "minute" in group_id:
            date_parts["minute"] = "$_id.minute"
            
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": group_id,
                "temperature": {"$avg": "$temperature"},
                "humidity": {"$avg": "$humidity"},
                "soil_moisture": {"$avg": "$soil_moisture"},
                "light_intensity": {"$avg": "$light_intensity"},
                "rain_sensor": {"$max": "$rain_sensor"},
                "battery_percentage": {"$avg": "$battery_percentage"},
                "wifi_rssi": {"$avg": "$wifi_rssi"}
            }},
            {"$project": {
                "_id": 0,
                "timestamp": {"$dateFromParts": date_parts},
                "temperature": {"$round": ["$temperature", 2]},
                "humidity": {"$round": ["$humidity", 2]},
                "soil_moisture": {"$round": ["$soil_moisture", 2]},
                "light_intensity": {"$round": ["$light_intensity", 2]},
                "rain_sensor": 1,
                "battery_percentage": {"$round": ["$battery_percentage", 2]},
                "wifi_rssi": {"$round": ["$wifi_rssi", 2]}
            }},
            {"$sort": {"timestamp": 1}}
        ]
        
        cursor = db_instance.db["iot_telemetry"].aggregate(pipeline)
        result = await cursor.to_list(length=1000)
        
        # Ensure proper UTC ISO strings for frontend parsing
        for r in result:
            if "timestamp" in r and isinstance(r["timestamp"], datetime):
                dt = r["timestamp"]
                r["timestamp"] = dt.isoformat() + ("Z" if dt.tzinfo is None else "")

        # Robust Fallback: If aggregation returns empty, fetch raw recent telemetry
        if not result:
            filter_query = {"device_id": device_id} if device_id else {}
            raw_docs = await db_instance.db["iot_telemetry"].find(filter_query).sort("_id", -1).to_list(length=100)
            result = []
            for d in reversed(raw_docs):
                rec_at = d.get("received_at")
                if not rec_at:
                    rec_at = datetime.now(timezone.utc)
                result.append({
                    "timestamp": (rec_at.isoformat() + ("Z" if rec_at.tzinfo is None else "")) if isinstance(rec_at, datetime) else str(rec_at),
                    "temperature": round(float(d.get("temperature") or 0.0), 2),
                    "humidity": round(float(d.get("humidity") or 0.0), 2),
                    "soil_moisture": round(float(d.get("soil_moisture") or d.get("soil_percentage") or 0.0), 2),
                    "light_intensity": round(float(d.get("light_intensity") or d.get("light_lux") or 0.0), 2),
                    "rain_sensor": 1 if (d.get("rain_sensor") or d.get("rain_detected")) else 0,
                    "battery_percentage": round(float(d.get("battery_percentage") or 0.0), 2),
                    "wifi_rssi": round(float(d.get("wifi_rssi") or d.get("signal") or -65), 2)
                })

        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch telemetry history: {str(e)}")

@router.get("/telemetry/summary")
async def get_telemetry_summary(
    device_id: str,
    timeframe: str = "7d",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Retrieve aggregated summary statistics for the selected timeframe."""
    try:
        start, end, _ = get_timeframe_bounds(timeframe, start_date, end_date)
        
        query = {
            "device_id": device_id,
            "received_at": {"$gte": start, "$lte": end}
        }
        
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": None,
                "avg_temp": {"$avg": "$temperature"},
                "max_temp": {"$max": "$temperature"},
                "min_temp": {"$min": "$temperature"},
                "avg_humidity": {"$avg": "$humidity"},
                "avg_soil": {"$avg": "$soil_moisture"},
                "total_rain_events": {"$sum": "$rain_sensor"},
                "latest_battery": {"$last": "$battery_percentage"}
            }}
        ]
        
        cursor = db_instance.db["iot_telemetry"].aggregate(pipeline)
        summaries = await cursor.to_list(length=1)
        
        if not summaries:
            # Fallback to computing summary over all telemetry for device
            raw_docs = await db_instance.db["iot_telemetry"].find({"device_id": device_id}).to_list(length=500)
            if raw_docs:
                temps = [d.get("temperature", 0.0) for d in raw_docs if d.get("temperature") is not None]
                hums = [d.get("humidity", 0.0) for d in raw_docs if d.get("humidity") is not None]
                soils = [d.get("soil_moisture") or d.get("soil_percentage") or 0.0 for d in raw_docs]
                rains = [1 if (d.get("rain_sensor") or d.get("rain_detected")) else 0 for d in raw_docs]
                last_batt = raw_docs[-1].get("battery_percentage", 0.0) if raw_docs else 0.0

                return {
                    "avg_temp": round(sum(temps)/len(temps), 1) if temps else 0.0,
                    "max_temp": round(max(temps), 1) if temps else 0.0,
                    "min_temp": round(min(temps), 1) if temps else 0.0,
                    "avg_humidity": round(sum(hums)/len(hums), 1) if hums else 0.0,
                    "avg_soil": round(sum(soils)/len(soils), 1) if soils else 0.0,
                    "total_rain_events": sum(rains),
                    "latest_battery": round(last_batt, 1),
                    "battery_status": "Good" if last_batt > 70 else ("Fair" if last_batt > 30 else "External Power")
                }
            return {
                "avg_temp": None,
                "max_temp": None,
                "min_temp": None,
                "avg_humidity": None,
                "avg_soil": None,
                "total_rain_events": 0,
                "latest_battery": None,
                "battery_status": "Unknown"
            }
            
        summary = summaries[0]
        battery = summary.get("latest_battery")
        
        battery_status = "Unknown"
        if battery is not None:
            if battery > 70:
                battery_status = "Good"
            elif battery > 30:
                battery_status = "Fair"
            else:
                battery_status = "Critical"
                
        return {
            "avg_temp": round(summary["avg_temp"], 2) if summary["avg_temp"] is not None else None,
            "max_temp": round(summary["max_temp"], 2) if summary["max_temp"] is not None else None,
            "min_temp": round(summary["min_temp"], 2) if summary["min_temp"] is not None else None,
            "avg_humidity": round(summary["avg_humidity"], 2) if summary["avg_humidity"] is not None else None,
            "avg_soil": round(summary["avg_soil"], 2) if summary["avg_soil"] is not None else None,
            "total_rain_events": summary["total_rain_events"],
            "latest_battery": round(battery, 2) if battery is not None else None,
            "battery_status": battery_status
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch telemetry summary: {str(e)}")

@router.get("/weather")
async def get_weather_forecast(
    device_id: str, 
    lat: float = 16.5062, 
    lon: float = 80.6480,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve weather forecast for the device location (prefers active farm coordinates)."""
    try:
        active_farm = await FarmProfileService.get_active_farm(db, current_user["id"])
        if active_farm:
            lat = active_farm.get("latitude", lat)
            lon = active_farm.get("longitude", lon)
            
        data = await WeatherService.get_weather(device_id, lat, lon)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather: {str(e)}")

@router.get("/irrigation/recommendation")
async def get_irrigation_recommendation(
    device_id: str, 
    lat: float = 16.5062, 
    lon: float = 80.6480,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Generate smart, personalized irrigation recommendations based on latest sensor telemetry and weather forecast."""
    try:
        active_farm = await FarmProfileService.get_active_farm(db, current_user["id"])
        if active_farm:
            lat = active_farm.get("latitude", lat)
            lon = active_farm.get("longitude", lon)
            
        # 1. Fetch latest telemetry
        telemetry = await db["iot_telemetry"].find_one(
            {"device_id": device_id},
            sort=[("received_at", -1)]
        )
        
        # Default fallback values if no telemetry exists yet
        if not telemetry:
            telemetry = {
                "temperature": 25.0,
                "humidity": 60.0,
                "soil_moisture": 50.0,
                "light_intensity": 10000.0,
                "rain_sensor": 0
            }
            device_status = "offline"
        else:
            device_status = "online"
            
        # 2. Fetch cached weather forecast
        weather_data = await WeatherService.get_weather(device_id, lat, lon)
        
        # 3. Call recommendation engine with personalized inputs
        crop_name = active_farm.get("crop_name") if active_farm else None
        growth_stage = active_farm.get("growth_stage") if active_farm else None
        irrigation_method = active_farm.get("irrigation_method") if active_farm else None
        water_source = active_farm.get("water_source") if active_farm else None

        recommendation = IrrigationRecommendationEngine.generate_recommendation(
            soil_moisture=telemetry.get("soil_moisture", 50.0),
            rain_sensor=telemetry.get("rain_sensor", 0),
            temperature=telemetry.get("temperature", 25.0),
            humidity=telemetry.get("humidity", 60.0),
            light_intensity=telemetry.get("light_intensity", 10000.0),
            forecast_list=weather_data.get("forecast", []),
            crop_name=crop_name,
            growth_stage=growth_stage,
            irrigation_method=irrigation_method,
            water_source=water_source
        )
        
        # Add metadata
        recommendation["device_status"] = device_status
        recommendation["last_updated"] = telemetry.get("timestamp", datetime.now(timezone.utc).isoformat() + "Z")
        
        return recommendation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate irrigation recommendation: {str(e)}")
