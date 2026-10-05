import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from bson import ObjectId

from backend.app.services.crop_calendar.service import CropCalendarService


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


@pytest.fixture
def sample_real_weather():
    return {
        "provider_name": "OpenWeatherMap",
        "provider_status": "Operational",
        "current": {
            "temperature": 32.0,
            "humidity": 60.0,
            "rain_probability": 15.0,
            "condition": "Clear"
        }
    }


@pytest.fixture
def sample_rainy_weather():
    return {
        "provider_name": "OpenWeatherMap",
        "provider_status": "Operational",
        "current": {
            "temperature": 26.0,
            "humidity": 85.0,
            "rain_probability": 85.0,
            "condition": "Heavy Rain"
        }
    }


# TEST 1 — SOFTWARE AI MODE: Task generation without IoT hardware
@pytest.mark.asyncio
async def test_software_ai_mode_task_generation(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "planting_date": "2026-08-01",
                "device_id": None,
                "timeline_tasks": {}
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={"irrigation_required": False})

    service = CropCalendarService(weather_service=mock_weather, irrigation_service=mock_irrigation, db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    assert res["status"] == "ready"
    assert res["mode"] == "software_ai"
    assert res["sensor_status"] == "not_connected"
    assert len(res["today_tasks"]) > 0
    assert "weather" in res["mode_description"].lower()


# TEST 2 — SMART IoT MODE: Online device reflects in context
@pytest.mark.asyncio
async def test_smart_iot_mode_with_online_device(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    device_id = "ESP32_NODE_01"
    now = datetime.now(timezone.utc)

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "planting_date": "2026-08-01",
                "device_id": device_id,
                "timeline_tasks": {}
            })
        elif col == "devices":
            mock_col.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "status": "online",
                "last_seen": now - timedelta(seconds=20),
                "latest_telemetry": {
                    "soil_moisture": 30.0,
                    "temperature": 31.0,
                    "humidity": 55.0,
                    "rain_sensor": 0
                }
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={"irrigation_required": True, "recommended_pump_minutes": 45})

    service = CropCalendarService(weather_service=mock_weather, irrigation_service=mock_irrigation, db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    assert res["mode"] == "smart_iot"
    assert res["sensor_status"] == "online"
    assert res["iot_context"] is not None
    assert res["iot_context"]["soil_moisture"] == 30.0
    # Consumed B15 irrigation action
    assert any(t.get("source") == "B15_Smart_Irrigation" for t in res["today_tasks"])


# TEST 3 — IoT OFFLINE FALLBACK: Device last seen > 90s falls back to software_ai
@pytest.mark.asyncio
async def test_iot_offline_fallback(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    device_id = "ESP32_OFFLINE"
    now = datetime.now(timezone.utc)

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "planting_date": "2026-08-01",
                "device_id": device_id
            })
        elif col == "devices":
            mock_col.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "status": "online",
                "last_seen": now - timedelta(seconds=120)  # > 90s watchdog
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)
    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={"irrigation_required": False})

    service = CropCalendarService(weather_service=mock_weather, irrigation_service=mock_irrigation, db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    assert res["mode"] == "software_ai"
    assert res["sensor_status"] == "offline"
    assert "offline" in res["iot_context"]["note"].lower()


# TEST 4 — WEATHER RAIN FORECAST DELAYS CHEMICAL SPRAYS
@pytest.mark.asyncio
async def test_weather_rain_forecast_warning(mock_db, sample_rainy_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "planting_date": "2026-08-01",
                "device_id": None
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value=sample_rainy_weather)
    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={"irrigation_required": False})

    service = CropCalendarService(weather_service=mock_weather, irrigation_service=mock_irrigation, db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    assert res["weather_context"]["spray_delayed"] is True
    assert "rain" in res["weather_context"]["note"].lower()


# TEST 5 — MISSING PLANTING DATE: Returns clear setup state
@pytest.mark.asyncio
async def test_missing_planting_date_prompt(mock_db):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "planting_date": None
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    service = CropCalendarService(db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    assert res["status"] == "missing_planting_date"
    assert "planting" in res["recommendation"].lower()
    assert res["days_since_sowing"] is None


# TEST 6 — MISSING CROP PROFILE: Returns clear setup state
@pytest.mark.asyncio
async def test_missing_crop_profile_prompt(mock_db):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": None,
                "planting_date": "2026-08-01"
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    service = CropCalendarService(db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    assert res["status"] == "missing_crop_profile"
    assert "crop" in res["recommendation"].lower()


# TEST 7 — RBAC FARM ACCESS SECURITY
@pytest.mark.asyncio
async def test_rbac_farm_access_security(mock_db):
    farm_id = str(ObjectId())
    farmer_a = str(ObjectId())
    farmer_b = str(ObjectId())

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": farmer_b,
                "crop_name": "Chilli"
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    service = CropCalendarService(db=mock_db)

    with pytest.raises(Exception) as exc_info:
        await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": farmer_a, "role": "farmer"})

    assert "403" in str(exc_info.value) or "forbidden" in str(exc_info.value).lower()


# TEST 8, 9, 10, 11 — TASK COMPLETION, SKIP, DELAY & LEGACY BOOLEAN COMPATIBILITY
@pytest.mark.asyncio
async def test_task_states_and_legacy_boolean_compatibility(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    # Mixed task state: legacy bool + rich status dicts
    tasks_map = {
        "stage-1-task-0": True,  # Legacy boolean completed
        "stage-1-task-1": {"status": "skipped", "note": "Already done manually"},
        "stage-2-task-0": {"status": "delayed", "note": "Waiting for rain to stop"},
        "stage-2-task-1": {"status": "completed", "completed_at": "2026-10-01T10:00:00Z"}
    }

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "planting_date": "2026-08-01",
                "timeline_tasks": tasks_map
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)
    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={"irrigation_required": False})

    service = CropCalendarService(weather_service=mock_weather, irrigation_service=mock_irrigation, db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    completed_ids = [t["task_id"] for t in res["completed_activities"]]
    assert "stage-1-task-0" in completed_ids  # Legacy true treated as completed
    assert "stage-2-task-1" in completed_ids  # Rich status completed


# TEST 12 — B15 IRRIGATION INTEGRATION: Consumes recommendation without re-calculating
@pytest.mark.asyncio
async def test_b15_irrigation_result_consumed_directly(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(col):
        mock_col = MagicMock()
        if col == "farm_profiles":
            mock_col.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "planting_date": "2026-08-01",
                "timeline_tasks": {}
            })
        else:
            mock_col.find_one = AsyncMock(return_value=None)
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={
        "irrigation_required": True,
        "recommendation": "Authoritative B15: Run drip for 45 mins.",
        "recommended_pump_minutes": 45
    })

    service = CropCalendarService(weather_service=mock_weather, irrigation_service=mock_irrigation, db=mock_db)

    res = await service.get_crop_calendar(farm_id=farm_id, current_user={"user_id": user_id, "role": "farmer"})

    mock_irrigation.calculate_irrigation_recommendation.assert_called_once()
    irrigation_tasks = [t for t in res["today_tasks"] if t.get("source") == "B15_Smart_Irrigation"]
    assert len(irrigation_tasks) == 1
    assert "Authoritative B15" in irrigation_tasks[0]["description"]
