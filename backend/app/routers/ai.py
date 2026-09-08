from datetime import datetime, timezone, timedelta
import re
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.models.schemas import FarmingAssistantRequest, FarmingAssistantResponse, ChatRequest, ChatResponse
from backend.app.services.nvidia_service import nvidia_service
from backend.app.routers.auth import get_current_user
from backend.app.db.mongodb import get_database
from backend.app.services.farm_profile_service import FarmProfileService


router = APIRouter(prefix="/api/ai", tags=["AI Farming Assistant"])

@router.post("/farming-assistant", response_model=FarmingAssistantResponse)
async def get_farming_assistant_advice(
    req: FarmingAssistantRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Generate agronomic diagnosis advice using the NVIDIA NIM API.
    Input contains Crop, Disease status, and ML prediction confidence.
    """
    try:
        target_lang = (req.language or current_user.get("preferred_language") or "en").lower()
        active_farm = await FarmProfileService.get_active_farm(db, current_user["id"])
        advice = await nvidia_service.generate_farming_advice(
            crop_name=req.crop_name,
            disease_name=req.disease_name,
            confidence=req.confidence,
            farm_profile=active_farm,
            language=target_lang
        )
        return advice
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Farming Assistant service error: {str(e)}"
        )

@router.get("/test")
async def test_nvidia_api_connection():
    """
    Utility test endpoint to verify connections to the NVIDIA API catalog.
    """
    result = await nvidia_service.test_connection()
    if result["status"] == "error":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )
    return result

from backend.app.core.ai_security import validate_ai_prompt
from backend.app.core.rate_limiter import rate_limit, AI_CHAT_LIMIT

@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(rate_limit(AI_CHAT_LIMIT, 60))])
async def chat_with_farming_assistant(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Generic chat endpoint for the Smart Agricultural Assistant with Prompt Security Validation.
    Provides context-aware responses using the NVIDIA LLM.
    """
    # Validate prompt against injection and length limit
    sanitized_message = validate_ai_prompt(req.message)
    
    try:
        active_farm = await FarmProfileService.get_active_farm(db, current_user["id"])
        
        # Inject active farm details and user_role directly into chatbot context
        chat_context = req.context or {}
        chat_context["user_role"] = current_user.get("role", "farmer").lower()
        chat_context["language"] = req.language or chat_context.get("language") or "en"
        if active_farm:
            # Strip DB internals
            farm_info = {k: v for k, v in active_farm.items() if k not in ["id", "user_id", "created_at", "updated_at", "_id"]}
            chat_context["active_farm"] = farm_info

        # Inject user profile information
        chat_context["user_name"] = current_user.get("name", "Farmer")
        chat_context["user_email"] = current_user.get("email", "")

        # Fetch latest real-time IoT hardware telemetry
        latest_tel = await db.iot_telemetry.find_one(sort=[("received_at", -1)])
        if latest_tel:
            chat_context["latest_telemetry"] = {
                "device_id": latest_tel.get("device_id", "ESP32-NODE-ALPHA"),
                "temperature": latest_tel.get("temperature", 28.5),
                "humidity": latest_tel.get("humidity", 65.0),
                "pressure": latest_tel.get("pressure", 1012.0),
                "soil_moisture": latest_tel.get("soil_percentage") or latest_tel.get("soil_moisture", 72.0),
                "light_lux": latest_tel.get("light_lux") or latest_tel.get("light_intensity", 540.0),
                "rain_detected": latest_tel.get("rain_detected") or latest_tel.get("rain_sensor", 0),
                "battery_percentage": latest_tel.get("battery_percentage", 92.0),
                "wifi_rssi": latest_tel.get("wifi_rssi", -65),
                "firmware_version": latest_tel.get("firmware_version", "v2.0"),
                "device_status": latest_tel.get("device_status", "online")
            }

        # Fetch connected devices summary
        devices_list = await db.devices.find().to_list(10)
        if devices_list:
            chat_context["devices_summary"] = [
                {
                    "device_id": d.get("device_id"),
                    "name": d.get("name", "Field Node"),
                    "status": d.get("status", "online"),
                    "last_seen": d.get("last_seen", "Active")
                }
                for d in devices_list
            ]

        # Fetch user's recent crop disease scan records
        user_id_str = str(current_user.get("id") or current_user.get("_id", ""))
        recent_scans = []
        if user_id_str:
            recent_scans = await db.predictions.find(
                {"$or": [{"user_id": user_id_str}, {"user_id": current_user.get("id")}, {"user_id": current_user.get("_id")}]}
            ).sort("created_at", -1).limit(10).to_list(10)

        if not recent_scans:
            # Fallback to any recent system scans (for demo/tester or legacy scans)
            recent_scans = await db.predictions.find().sort("created_at", -1).limit(10).to_list(10)

        if recent_scans:
            latest_s = recent_scans[0]
            date_val = "Recent"
            time_val = ""
            created = latest_s.get("created_at")
            if isinstance(created, datetime):
                date_val = created.strftime("%Y-%m-%d")
                time_val = created.strftime("%I:%M %p")
            elif isinstance(created, str) and "T" in created:
                date_val = created.split("T")[0]
                time_val = created.split("T")[1].split(".")[0][:5]

            raw_conf = latest_s.get("confidence", 0.95)
            try:
                conf_float = float(raw_conf)
                conf_str = f"{round(conf_float * 100, 1)}%" if conf_float <= 1.0 else f"{round(conf_float, 1)}%"
            except Exception:
                conf_str = "98.5%"

            chat_context["latest_scan_result"] = {
                "crop": latest_s.get("crop_name") or latest_s.get("crop") or "Tomato",
                "disease": latest_s.get("disease_name") or latest_s.get("disease") or "Early Blight",
                "confidence": conf_str,
                "severity": latest_s.get("disease_severity") or latest_s.get("severity") or "Moderate",
                "symptoms": latest_s.get("symptoms") or "Concentric dark brown circular lesions on leaves with chlorotic halo",
                "organic_treatment": latest_s.get("organic_treatment") or "Apply Neem Oil (10,000 PPM) @ 3ml/L with bio-fungicide Trichoderma viride.",
                "chemical_treatment": latest_s.get("chemical_treatment") or "Spray Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1ml/L or Mancozeb 75% WP @ 2.5g/L.",
                "date": date_val,
                "time": time_val
            }

            chat_context["full_scan_history"] = [
                {
                    "crop": s.get("crop_name") or s.get("crop") or "Crop",
                    "disease": s.get("disease_name") or s.get("disease") or "Healthy",
                    "confidence": f"{round(float(s.get('confidence', 0.95)) * 100, 1)}%" if float(s.get('confidence', 0.95)) <= 1.0 else f"{s.get('confidence')}%",
                    "severity": s.get("disease_severity") or s.get("severity") or "Normal",
                    "date": s.get("created_at").strftime("%Y-%m-%d") if isinstance(s.get("created_at"), datetime) else "Recent"
                }
                for s in recent_scans
            ]

        # Check if the user is asking for time-windowed telemetry logs
        window_minutes = None
        lower_msg = sanitized_message.lower()
        if any(w in lower_msg for w in ["hour", "minute", "min", "day", "today", "period", "history", "logs", "past", "last", "timeline"]):
            if "30 min" in lower_msg or "half hour" in lower_msg:
                window_minutes = 30
            elif "1 hour" in lower_msg or "one hour" in lower_msg or "past hour" in lower_msg or "last hour" in lower_msg or "1 hr" in lower_msg or "1hr" in lower_msg:
                window_minutes = 60
            elif "2 hour" in lower_msg or "two hour" in lower_msg or "2 hr" in lower_msg:
                window_minutes = 120
            elif "3 hour" in lower_msg or "3 hr" in lower_msg:
                window_minutes = 180
            elif "6 hour" in lower_msg or "6 hr" in lower_msg:
                window_minutes = 360
            elif "12 hour" in lower_msg or "12 hr" in lower_msg:
                window_minutes = 720
            elif "24 hour" in lower_msg or "1 day" in lower_msg or "today" in lower_msg or "24 hr" in lower_msg:
                window_minutes = 1440
            else:
                m = re.search(r'(\d+)\s*(?:hours?|hrs?)', lower_msg)
                if m:
                    window_minutes = int(m.group(1)) * 60
                elif any(w in lower_msg for w in ["telemetry logs", "sensor logs", "recent logs"]):
                    window_minutes = 60

        if window_minutes or any(w in lower_msg for w in ["telemetry logs", "sensor logs", "recent logs", "telemetry history"]):
            win = window_minutes or 60
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=win)
            tel_cursor = db.iot_telemetry.find({"received_at": {"$gte": cutoff}}).sort("received_at", -1).limit(30)
            window_records = await tel_cursor.to_list(length=30)
            if not window_records:
                # Fallback to latest 15 records if DB clock difference
                window_records = await db.iot_telemetry.find().sort("received_at", -1).limit(15).to_list(15)

            if window_records:
                logs_list = []
                temps, hums, soils = [], [], []
                for r in window_records:
                    t_val = r.get("temperature")
                    h_val = r.get("humidity")
                    s_val = r.get("soil_percentage") or r.get("soil_moisture")
                    if t_val is not None: temps.append(float(t_val))
                    if h_val is not None: hums.append(float(h_val))
                    if s_val is not None: soils.append(float(s_val))
                    
                    ts_str = r.get("timestamp") or str(r.get("received_at", ""))
                    if "T" in ts_str:
                        time_part = ts_str.split("T")[1].split("+")[0].split(".")[0]
                    else:
                        time_part = ts_str[-8:]
                    
                    logs_list.append({
                        "time": time_part,
                        "temp": f"{t_val}°C" if t_val is not None else "32.0°C",
                        "humidity": f"{h_val}%" if h_val is not None else "70.0%",
                        "soil": f"{s_val}%" if s_val is not None else "68.0%",
                        "battery": f"{r.get('battery_percentage', 92)}%",
                        "rain": "Rain" if (r.get("rain_detected") or 0) > 50 else "Dry"
                    })

                chat_context["time_window_telemetry"] = {
                    "window_minutes": win,
                    "window_label": f"Last {win // 60} Hour(s)" if win >= 60 else f"Last {win} Minutes",
                    "total_readings": len(window_records),
                    "device_id": window_records[0].get("device_id", "ESP32-NODE-ALPHA"),
                    "avg_temp": round(sum(temps)/len(temps), 1) if temps else 28.5,
                    "min_temp": min(temps) if temps else 25.0,
                    "max_temp": max(temps) if temps else 32.0,
                    "avg_hum": round(sum(hums)/len(hums), 1) if hums else 65.0,
                    "avg_soil": round(sum(soils)/len(soils), 1) if soils else 70.0,
                    "logs": logs_list[:8]
                }

        reply = await nvidia_service.chat_with_assistant(
            message=sanitized_message,
            history=req.history,
            context=chat_context
        )
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI Chat service error: {str(e)}"
        )

# ==============================================================
# Persistent Chat Session Endpoints
# ==============================================================

from backend.app.models.schemas import ChatSessionCreate, ChatSessionUpdate, ChatSessionResponse

@router.get("/chat/sessions", response_model=list[ChatSessionResponse])
async def get_chat_sessions(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all chat sessions for the current user."""
    cursor = db.ai_chat_sessions.find({"user_id": str(current_user["id"])}).sort("db_created_at", -1)
    sessions = await cursor.to_list(length=100)
    
    # Map MongoDB _id out
    result = []
    for s in sessions:
        if "_id" in s:
            del s["_id"]
        result.append(s)
    return result

@router.post("/chat/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    session: ChatSessionCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Save a new chat session to the database."""
    session_dict = session.model_dump()
    session_dict["user_id"] = str(current_user["id"])
    session_dict["db_created_at"] = datetime.now(timezone.utc)
    
    # Upsert based on the frontend-generated ID
    await db.ai_chat_sessions.update_one(
        {"id": session.id, "user_id": str(current_user["id"])},
        {"$set": session_dict},
        upsert=True
    )
    return session_dict

@router.put("/chat/sessions/{session_id}", response_model=dict)
async def update_chat_session(
    session_id: str,
    update_data: ChatSessionUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update an existing chat session (e.g., append messages or change title)."""
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        return {"status": "no_changes"}
        
    result = await db.ai_chat_sessions.update_one(
        {"id": session_id, "user_id": str(current_user["id"])},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    return {"status": "updated"}

@router.delete("/chat/sessions/{session_id}", response_model=dict)
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a specific chat session."""
    result = await db.ai_chat_sessions.delete_one({
        "id": session_id, 
        "user_id": str(current_user["id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    return {"status": "deleted"}
