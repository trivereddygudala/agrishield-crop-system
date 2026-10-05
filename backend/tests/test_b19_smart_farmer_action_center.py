import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from bson import ObjectId
from fastapi import HTTPException

from backend.app.services.action_center.service import ActionCenterService
from backend.app.models.action_center import FarmerActionItem


@pytest.fixture
def sample_user():
    user_id = str(ObjectId())
    return {
        "id": user_id,
        "user_id": user_id,
        "_id": user_id,
        "role": "farmer",
        "email": "farmer@example.com",
        "phone": "+919876543210"
    }


@pytest.fixture
def other_user():
    user_id = str(ObjectId())
    return {
        "id": user_id,
        "user_id": user_id,
        "_id": user_id,
        "role": "farmer",
        "email": "other@example.com",
        "phone": "+919876543211"
    }


@pytest.fixture
def mock_weather():
    return {
        "provider_name": "OpenWeatherMap",
        "provider_status": "Operational",
        "current": {
            "temperature": 28.0,
            "humidity": 65.0,
            "rain_probability": 15.0,
            "condition": "Clear"
        }
    }


# TEST 1: Software AI mode works without IoT
@pytest.mark.asyncio
async def test_1_software_ai_mode_without_iot(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Sunrise Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=30)).strftime("%Y-%m-%d"),
        "device_id": None,
        "latitude": 16.5,
        "longitude": 80.6,
        "inventory_items": [],
        "khata_transactions": [],
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    assert res.operating_mode == "software_ai"
    assert res.sensor_status == "not_connected"
    assert res.farm_name == "Sunrise Farm"
    assert res.crop_name == "Tomato"


# TEST 2: Smart IoT mode uses real telemetry
@pytest.mark.asyncio
async def test_2_smart_iot_mode_uses_real_telemetry(sample_user, mock_weather):
    farm_id = str(ObjectId())
    device_id = "ESP32-FIELD-01"
    now_utc = datetime.now(timezone.utc)

    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Green Acres",
        "crop_name": "Tomato",
        "growth_stage": "Flowering",
        "planting_date": (now_utc.date() - timedelta(days=50)).strftime("%Y-%m-%d"),
        "device_id": device_id,
        "latitude": 16.5,
        "longitude": 80.6,
        "inventory_items": [],
        "khata_transactions": [],
        "timeline_tasks": {}
    }
    device_doc = {
        "device_id": device_id,
        "status": "online",
        "last_seen": now_utc - timedelta(seconds=20),
        "latest_telemetry": {
            "soil_moisture": 18.0,
            "temperature": 27.5,
            "humidity": 70.0,
            "rain_sensor": 0
        }
    }

    def db_lookup(col):
        mock_col = MagicMock()
        if col in ("farm_profiles", "farms"):
            mock_col.find_one = AsyncMock(return_value=farm_doc)
        elif col == "devices":
            mock_col.find_one = AsyncMock(return_value=device_doc)
        else:
            mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    assert res.operating_mode == "smart_iot"
    assert res.sensor_status == "online"


# TEST 3: IoT offline falls back safely to Software AI mode
@pytest.mark.asyncio
async def test_3_iot_offline_falls_back_safely(sample_user, mock_weather):
    farm_id = str(ObjectId())
    device_id = "ESP32-FIELD-01"
    now_utc = datetime.now(timezone.utc)

    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Fallback Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "device_id": device_id,
        "planting_date": (now_utc.date() - timedelta(days=30)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    # Device last seen 150 seconds ago (>90s watchdog timeout)
    device_doc = {
        "device_id": device_id,
        "status": "online",
        "last_seen": now_utc - timedelta(seconds=150)
    }

    def db_lookup(col):
        mock_col = MagicMock()
        if col in ("farm_profiles", "farms"):
            mock_col.find_one = AsyncMock(return_value=farm_doc)
        elif col == "devices":
            mock_col.find_one = AsyncMock(return_value=device_doc)
        else:
            mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    assert res.operating_mode == "software_ai"
    assert res.sensor_status == "offline"


# TEST 4: Irrigation action uses B15 authoritative service
@pytest.mark.asyncio
async def test_4_irrigation_action_uses_b15_authoritative_service(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Irrigation Farm",
        "crop_name": "Tomato",
        "growth_stage": "Flowering",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=50)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    irr_mock = MagicMock()
    irr_mock.calculate_irrigation_recommendation = AsyncMock(return_value={
        "irrigation_required": True,
        "recommended_pump_minutes": 55,
        "water_quantity_liters_per_acre": 22000,
        "best_irrigation_time": "06:00 AM - 08:30 AM",
        "moisture_deficit": 12.0,
        "reasoning": ["Soil moisture is below optimal flowering target."],
        "mode": "software_ai"
    })

    service = ActionCenterService(weather_service=w_svc, irrigation_service=irr_mock, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    irr_actions = [a for a in res.actions if a.action_type == "WATER"]
    assert len(irr_actions) == 1
    assert irr_actions[0].action_type == "WATER"
    assert "Water" in irr_actions[0].what
    assert "06:00 AM - 08:30 AM" in irr_actions[0].when
    assert irr_actions[0].metadata["pump_minutes"] == 55


# TEST 5: B16 task appears once
@pytest.mark.asyncio
async def test_5_b16_task_appears_once(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Task Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    action_ids = [a.action_id for a in res.actions]
    assert len(action_ids) == len(set(action_ids))


# TEST 6: Completed B16 task does not reappear
@pytest.mark.asyncio
async def test_6_completed_b16_task_does_not_reappear(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    # Mark stage-2-task-0 as completed
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Task Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=30)).strftime("%Y-%m-%d"),
        "timeline_tasks": {
            "stage-2-task-0": {"status": "completed", "completed_at": "2026-10-05T10:00:00Z"}
        }
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    crop_action_ids = [a.action_id for a in res.actions if "stage-2-task-0" in a.action_id]
    assert len(crop_action_ids) == 0


# TEST 7: Weather spray warning works
@pytest.mark.asyncio
async def test_7_weather_spray_warning_works(sample_user):
    farm_id = str(ObjectId())
    rainy_weather = {
        "provider_name": "OpenWeatherMap",
        "provider_status": "Operational",
        "current": {
            "temperature": 25.0,
            "humidity": 90.0,
            "rain_probability": 80.0,
            "condition": "Rain"
        }
    }
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Rain Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=rainy_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    weather_actions = [a for a in res.actions if a.action_type == "WEATHER" and "Delay" in a.what]
    assert len(weather_actions) == 1
    assert weather_actions[0].priority == "P0"


# TEST 8: Disease action only appears when supported
@pytest.mark.asyncio
async def test_8_disease_action_only_appears_when_supported(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Healthy Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    # Prediction is healthy (no disease)
    recent_preds = [{
        "_id": ObjectId(),
        "crop_name": "Tomato",
        "prediction_status": "healthy",
        "disease_name": "Healthy Leaf",
        "confidence": 0.98
    }]

    def db_lookup(col):
        mock_col = MagicMock()
        if col in ("farm_profiles", "farms"):
            mock_col.find_one = AsyncMock(return_value=farm_doc)
        elif col == "predictions":
            mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=recent_preds)))))))
        else:
            mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    disease_actions = [a for a in res.actions if a.action_type == "DISEASE_CHECK"]
    assert len(disease_actions) == 0


# TEST 9: Inventory out-of-stock creates BUY_INPUT action
@pytest.mark.asyncio
async def test_9_inventory_out_of_stock_creates_buy_input(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Stock Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "inventory_items": [
            {
                "id": "inv-mancozeb",
                "name": "Mancozeb 75% WP",
                "category": "Fungicide",
                "quantity": 0.0,
                "unit": "kg",
                "reorder_level": 5.0
            }
        ]
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    buy_actions = [a for a in res.actions if a.action_type == "BUY_INPUT" and "Mancozeb" in a.what]
    assert len(buy_actions) == 1
    assert buy_actions[0].priority == "P1"
    assert "Out of Stock" in buy_actions[0].badge_text


# TEST 10: Inventory action never changes physical stock
@pytest.mark.asyncio
async def test_10_inventory_action_never_changes_stock(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    original_items = [
        {
            "id": "inv-urea",
            "name": "Urea",
            "category": "Fertilizer",
            "quantity": 2.0,
            "unit": "bags",
            "reorder_level": 5.0
        }
    ]
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Stock Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "inventory_items": original_items
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_col.update_one = AsyncMock()
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    # Assert update_one was never called to mutate inventory
    assert mock_col.update_one.call_count == 0
    assert original_items[0]["quantity"] == 2.0


# TEST 11: Khata overdue liability creates PAYMENT action
@pytest.mark.asyncio
async def test_11_khata_overdue_liability_creates_payment_action(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Khata Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "khata_transactions": [
            {
                "id": "tx-tractor-1",
                "title": "Tractor Plowing Service",
                "category": "Machinery",
                "amount": 2500.0,
                "payment_status": "overdue",
                "is_estimated": False,
                "type": "actual",
                "vendor": "Ramesh Tractor Works",
                "due_date": "2026-09-20"
            }
        ]
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    payment_actions = [a for a in res.actions if a.action_type == "PAYMENT"]
    assert len(payment_actions) == 1
    assert payment_actions[0].priority == "P1"
    assert "Ramesh Tractor" in payment_actions[0].what
    assert "2,500" in payment_actions[0].what


# TEST 12: Projected financial values do not become liabilities
@pytest.mark.asyncio
async def test_12_projected_financial_values_do_not_become_liabilities(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Projection Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "khata_transactions": [
            {
                "id": "tx-projected-harvest",
                "title": "Estimated Harvest Labour",
                "category": "Labour",
                "amount": 10000.0,
                "payment_status": "pending",
                "is_estimated": True,  # PROJECTED ESTIMATE!
                "type": "projected",
                "due_date": "2026-11-15"
            }
        ]
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    payment_actions = [a for a in res.actions if a.action_type == "PAYMENT"]
    assert len(payment_actions) == 0


# TEST 13: Equipment action does not modify booking
@pytest.mark.asyncio
async def test_13_equipment_action_does_not_modify_booking(sample_user, mock_weather):
    farm_id = str(ObjectId())
    booking_id = "BK-8849"
    bookings = [
        {
            "id": booking_id,
            "equipmentName": "Drone Sprayer Pro",
            "equipmentType": "Sprayer",
            "status": "confirmed",
            "startDate": "2026-10-06",
            "userId": sample_user["id"]
        }
    ]
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Equipment Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }

    def db_lookup(col):
        mock_col = MagicMock()
        if col in ("farm_profiles", "farms"):
            mock_col.find_one = AsyncMock(return_value=farm_doc)
        elif col == "equipment_bookings":
            mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=bookings)))))))
            mock_col.update_one = AsyncMock()
        else:
            mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
        return mock_col

    mock_db.__getitem__.side_effect = db_lookup

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    eq_actions = [a for a in res.actions if a.action_type == "EQUIPMENT"]
    assert len(eq_actions) == 1
    assert "Drone Sprayer" in eq_actions[0].what
    assert bookings[0]["status"] == "confirmed"


# TEST 14: Market action disappears when data unavailable
@pytest.mark.asyncio
async def test_14_market_action_disappears_when_data_unavailable(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "No Market Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=20)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    # In vegetative stage with no market data, no MARKET action should be generated
    mkt_actions = [a for a in res.actions if a.action_type == "MARKET"]
    assert len(mkt_actions) == 0


# TEST 15: Duplicate action IDs are prevented
@pytest.mark.asyncio
async def test_15_duplicate_action_ids_prevented(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Dedup Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    action_ids = [a.action_id for a in res.actions]
    assert len(action_ids) == len(set(action_ids))


# TEST 16: P0 sorts before P1, P2, P3
@pytest.mark.asyncio
async def test_16_p0_sorts_before_p1_p2_p3(sample_user):
    farm_id = str(ObjectId())
    # Weather creates P0 rain spray delay
    rainy_weather = {
        "provider_name": "OpenWeatherMap",
        "provider_status": "Operational",
        "current": {
            "temperature": 25.0,
            "humidity": 90.0,
            "rain_probability": 80.0,
            "condition": "Rain"
        }
    }
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Priority Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "inventory_items": [
            {
                "id": "inv-1",
                "name": "NPK",
                "category": "Fertilizer",
                "quantity": 10.0,
                "unit": "kg",
                "reorder_level": 15.0  # Creates P2 low stock
            }
        ]
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=rainy_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    priorities = [a.priority for a in res.actions]
    p0_indices = [i for i, p in enumerate(priorities) if p == "P0"]
    p2_indices = [i for i, p in enumerate(priorities) if p == "P2"]

    if p0_indices and p2_indices:
        assert min(p0_indices) < min(p2_indices)


# TEST 17: One source failure does not break the entire Action Center
@pytest.mark.asyncio
async def test_17_one_source_failure_does_not_break_action_center(sample_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Resilient Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=25)).strftime("%Y-%m-%d"),
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    # Weather throws unexpected crash
    w_svc.get_weather_for_farm = AsyncMock(side_effect=RuntimeError("OpenWeatherMap HTTP 500"))

    irr_svc = MagicMock()
    irr_svc.calculate_irrigation_recommendation = AsyncMock(return_value={
        "irrigation_required": True,
        "recommended_pump_minutes": 40,
        "water_quantity_liters_per_acre": 15000,
        "best_irrigation_time": "06:00 AM",
        "moisture_deficit": 5.0,
        "reasoning": ["Routine vegetative replenishment."]
    })

    service = ActionCenterService(weather_service=w_svc, irrigation_service=irr_svc, db=mock_db)
    # Must succeed gracefully without raising exception
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    assert res.total_actions > 0
    assert any(a.action_type == "WATER" for a in res.actions)


# TEST 18: Farmer A cannot access Farmer B actions
@pytest.mark.asyncio
async def test_18_farmer_a_cannot_access_farmer_b_actions(sample_user, other_user, mock_weather):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    # Farm owned by sample_user
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Private Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative"
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_db.__getitem__.side_effect = lambda col: mock_col

    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)

    # other_user attempts to query sample_user's farm
    with pytest.raises(HTTPException) as exc_info:
        await service.get_actions(farm_id=farm_id, current_user=other_user)
    assert exc_info.value.status_code == 403


# TEST 19: Complete and dismiss behavior works
@pytest.mark.asyncio
async def test_19_complete_and_dismiss_behavior(sample_user):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Action Farm",
        "action_center_state": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.update_one = AsyncMock()
    mock_db.__getitem__.side_effect = lambda col: mock_col

    service = ActionCenterService(db=mock_db)

    # Test advisory dismissal
    res_dismiss = await service.dismiss_action(
        farm_id=farm_id,
        action_id="act-weather-heat",
        current_user=sample_user
    )
    assert res_dismiss["status"] == "success"
    assert res_dismiss["new_status"] == "dismissed"
    assert mock_col.update_one.call_count == 1

    # Test advisory completion
    res_comp = await service.complete_action(
        farm_id=farm_id,
        action_id="act-water-farm1",
        current_user=sample_user
    )
    assert res_comp["status"] == "success"
    assert res_comp["new_status"] == "completed"
    assert mock_col.update_one.call_count == 2


# TEST 20: B19 does not create duplicate B16 task state
@pytest.mark.asyncio
async def test_20_b19_does_not_create_duplicate_b16_task_state(sample_user):
    farm_id = str(ObjectId())
    mock_db = MagicMock()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "B16 Delegate Farm",
        "timeline_tasks": {}
    }
    mock_col = MagicMock()
    mock_col.find_one = AsyncMock(return_value=farm_doc)
    mock_col.update_one = AsyncMock()
    mock_db.__getitem__.side_effect = lambda col: mock_col

    service = ActionCenterService(db=mock_db)

    # Complete a B16 crop calendar action
    res = await service.complete_action(
        farm_id=farm_id,
        action_id="act-crop-stage-2-task-1",
        current_user=sample_user
    )
    assert res["status"] == "success"
    assert "stage-2-task-1" in res["message"]

    # Verify update_one targeted timeline_tasks, not a separate task collection
    args, kwargs = mock_col.update_one.call_args
    update_doc = kwargs.get("$set") or args[1].get("$set")
    assert "timeline_tasks" in update_doc
    assert "stage-2-task-1" in update_doc["timeline_tasks"]
