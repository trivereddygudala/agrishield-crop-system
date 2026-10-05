import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from bson import ObjectId

from backend.app.services.irrigation.service import SmartIrrigationService
from backend.app.services.irrigation.schemas import IrrigationRecommendationResponse


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
            "temperature": 31.0,
            "humidity": 55.0,
            "wind_speed": 10.0,
            "condition": "Sunny",
            "rain_probability": 15.0
        },
        "forecast": [
            {
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "temp_min": 22.0,
                "temp_max": 34.0,
                "humidity": 50.0,
                "rain_probability": 15.0,
                "condition": "Sunny"
            }
        ]
    }


@pytest.fixture
def sample_rainy_weather():
    return {
        "provider_name": "OpenWeatherMap",
        "provider_status": "Operational",
        "current": {
            "temperature": 26.0,
            "humidity": 85.0,
            "wind_speed": 18.0,
            "condition": "Heavy Rain",
            "rain_probability": 85.0
        },
        "forecast": [
            {
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "temp_min": 20.0,
                "temp_max": 27.0,
                "humidity": 85.0,
                "rain_probability": 85.0,
                "condition": "Heavy Rain"
            }
        ]
    }


@pytest.fixture
def sample_mock_weather():
    return {
        "provider_name": "MockWeatherProvider",
        "provider_status": "Fallback",
        "current": {
            "temperature": 30.0,
            "humidity": 60.0,
            "wind_speed": 5.0,
            "condition": "Partly Cloudy",
            "rain_probability": 20.0
        },
        "forecast": []
    }


# TEST 1 — SOFTWARE AI MODE: Farm has no device
@pytest.mark.asyncio
async def test_software_ai_mode_no_device(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    # Farm has no device_id
    mock_db.__getitem__.side_effect = lambda key: mock_db
    mock_db.find_one = AsyncMock(return_value={
        "_id": ObjectId(farm_id),
        "owner_id": user_id,
        "crop_name": "Tomato",
        "growth_stage": "Flowering",
        "irrigation_method": "Drip",
        "soil_type": "Loam",
        "farm_size": 2.5,
        "device_id": None
    })

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    assert validated.mode == "software_ai"
    assert validated.sensor_status == "not_connected"
    assert validated.current_soil_moisture is None
    assert validated.moisture_deficit is None
    assert validated.target_soil_moisture == 65.0
    assert "Live soil moisture" in response["recommendation"] or "Check topsoil" in response["recommendation"] or "water demand" in response["recommendation"].lower()


# TEST 2 — SMART IoT MODE: Farm has authoritative online device
@pytest.mark.asyncio
async def test_smart_iot_mode_online_device(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    device_id = "ESP32_PUMP_01"

    now = datetime.now(timezone.utc)

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "growth_stage": "Flowering",
                "irrigation_method": "Drip",
                "soil_type": "Loam",
                "device_id": device_id
            })
        elif collection_name == "devices":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "owner_id": user_id,
                "status": "online",
                "last_seen": now - timedelta(seconds=20)
            })
        elif collection_name == "iot_telemetry":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "soil_moisture": 35.0,  # Below target 65%
                "temperature": 32.5,
                "humidity": 48.0,
                "rain_sensor": 0,
                "timestamp": (now - timedelta(seconds=20)).isoformat()
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    assert validated.mode == "smart_iot"
    assert validated.sensor_status == "online"
    assert validated.current_soil_moisture == 35.0
    assert validated.target_soil_moisture == 65.0
    assert validated.moisture_deficit == 30.0
    assert validated.irrigation_required is True
    assert validated.recommended_pump_minutes > 0


# TEST 3 — DEVICE OFFLINE: Watchdog threshold > 90 seconds
@pytest.mark.asyncio
async def test_device_offline_fallback(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    device_id = "ESP32_STALE_01"

    now = datetime.now(timezone.utc)

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "growth_stage": "Flowering",
                "irrigation_method": "Drip",
                "device_id": device_id
            })
        elif collection_name == "devices":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "owner_id": user_id,
                "status": "online",
                "last_seen": now - timedelta(seconds=150)  # > 90s watchdog
            })
        elif collection_name == "iot_telemetry":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "soil_moisture": 25.0,
                "timestamp": (now - timedelta(seconds=150)).isoformat()
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    assert validated.mode == "software_ai"
    assert validated.sensor_status == "offline"
    assert validated.current_soil_moisture is None
    assert validated.moisture_deficit is None
    assert any("offline" in r.lower() for r in validated.reasoning)


# TEST 4 — MISSING TELEMETRY: Device exists online but soil_moisture field is missing
@pytest.mark.asyncio
async def test_missing_telemetry_sensor_unavailable(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    device_id = "ESP32_NO_MOISTURE"

    now = datetime.now(timezone.utc)

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "growth_stage": "Flowering",
                "device_id": device_id
            })
        elif collection_name == "devices":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "owner_id": user_id,
                "status": "online",
                "last_seen": now - timedelta(seconds=10)
            })
        elif collection_name == "iot_telemetry":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "temperature": 30.0,
                "soil_moisture": None,
                "timestamp": (now - timedelta(seconds=10)).isoformat()
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    # Must fall back to software_ai and never invent a value
    assert validated.mode == "software_ai"
    assert validated.sensor_status == "unavailable"
    assert validated.current_soil_moisture is None
    assert validated.moisture_deficit is None


# TEST 5 — WEATHER FAILURE: MockWeatherProvider should not give false confident advice
@pytest.mark.asyncio
async def test_mock_weather_degraded_safety(mock_db, sample_mock_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "growth_stage": "Flowering",
                "device_id": None
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_mock_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    assert validated.metadata.cache_status == "Degraded"
    assert "temporarily unavailable" in validated.recommendation or "inspect field" in validated.recommendation.lower()
    assert validated.irrigation_required is None


# TEST 6 — MISSING CROP PROFILE: Do not silently use Tomato
@pytest.mark.asyncio
async def test_missing_crop_profile_warning(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": None,
                "growth_stage": None,
                "device_id": None
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    assert validated.irrigation_required is None
    assert "Crop information required" in validated.recommendation
    assert validated.crop_type is None


# TEST 7 — FARM ACCESS SECURITY: Farmer A cannot access Farmer B's irrigation data
@pytest.mark.asyncio
async def test_farm_access_security(mock_db):
    farm_id = str(ObjectId())
    farmer_a = str(ObjectId())
    farmer_b = str(ObjectId())

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": farmer_b,
                "crop_name": "Rice"
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    service = SmartIrrigationService(db=mock_db)

    # Farmer A requests Farmer B's farm
    with pytest.raises(Exception) as exc_info:
        await service.calculate_irrigation_recommendation(
            farm_id=farm_id,
            current_user={"user_id": farmer_a, "role": "farmer"}
        )

    assert "403" in str(exc_info.value) or "Forbidden" in str(exc_info.value) or "forbidden" in str(exc_info.value).lower()


# TEST 8 — RAIN BYPASS: Expected heavy rain delays irrigation
@pytest.mark.asyncio
async def test_rain_bypass_delays_irrigation(mock_db, sample_rainy_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    device_id = "ESP32_RAIN_TEST"
    now = datetime.now(timezone.utc)

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Tomato",
                "growth_stage": "Flowering",
                "irrigation_method": "Drip",
                "device_id": device_id
            })
        elif collection_name == "devices":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "owner_id": user_id,
                "status": "online",
                "last_seen": now - timedelta(seconds=15)
            })
        elif collection_name == "iot_telemetry":
            coll.find_one = AsyncMock(return_value={
                "device_id": device_id,
                "soil_moisture": 30.0,
                "rain_sensor": 1,
                "timestamp": (now - timedelta(seconds=15)).isoformat()
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_rainy_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    assert validated.mode == "smart_iot"
    assert validated.irrigation_required is False
    assert validated.recommended_pump_minutes == 0
    assert "Stop irrigation" in validated.recommendation or "rainfall detected" in validated.recommendation.lower() or "delay" in validated.recommendation.lower()


# TEST 9 — NO SYNTHETIC VALUES: Verify current_soil_moisture is never a synthetic 42, 45, or 50
@pytest.mark.asyncio
async def test_no_synthetic_soil_moisture_leak(mock_db, sample_real_weather):
    farm_id = str(ObjectId())
    user_id = str(ObjectId())

    def db_lookup(collection_name):
        coll = MagicMock()
        if collection_name == "farm_profiles":
            coll.find_one = AsyncMock(return_value={
                "_id": ObjectId(farm_id),
                "owner_id": user_id,
                "crop_name": "Wheat",
                "growth_stage": "Tillering",
                "device_id": None
            })
        else:
            coll.find_one = AsyncMock(return_value=None)
        return coll

    mock_db.__getitem__.side_effect = db_lookup

    mock_weather_service = MagicMock()
    mock_weather_service.get_weather_for_farm = AsyncMock(return_value=sample_real_weather)

    service = SmartIrrigationService(weather_service=mock_weather_service, db=mock_db)

    response = await service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        current_user={"user_id": user_id, "role": "farmer"}
    )

    validated = IrrigationRecommendationResponse(**response)
    assert validated.current_soil_moisture is None
    assert validated.current_soil_moisture not in [42.0, 45.0, 50.0]
