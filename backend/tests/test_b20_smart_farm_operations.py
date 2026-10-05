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


def create_mock_db(farm_doc, device_doc=None):
    mock_db = MagicMock()
    collections = {}

    def db_lookup(col):
        if col not in collections:
            mock_col = MagicMock()
            if col in ("farm_profiles", "farms"):
                mock_col.find_one = AsyncMock(return_value=farm_doc)
                mock_col.update_one = AsyncMock()
            elif col == "devices":
                mock_col.find_one = AsyncMock(return_value=device_doc)
                mock_col.update_one = AsyncMock()
            else:
                cursor_mock = MagicMock()
                cursor_mock.sort = MagicMock(return_value=cursor_mock)
                cursor_mock.limit = MagicMock(return_value=cursor_mock)
                cursor_mock.to_list = AsyncMock(return_value=[])
                mock_col.find = MagicMock(return_value=cursor_mock)
                mock_col.find_one = AsyncMock(return_value=None)
                mock_col.update_one = AsyncMock()
            collections[col] = mock_col
        return collections[col]

    mock_db.__getitem__.side_effect = db_lookup
    return mock_db


# TEST 1: Today bucket
@pytest.mark.asyncio
async def test_1_today_bucket(sample_user, mock_weather):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Today Test Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=20)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="today")

    assert all(a.operational_bucket == "today" for a in res.actions)
    assert res.today_count >= 1


# TEST 2: Overdue bucket
@pytest.mark.asyncio
async def test_2_overdue_bucket(sample_user, mock_weather):
    farm_id = str(ObjectId())
    past_due = (datetime.now(timezone.utc).date() - timedelta(days=3)).strftime("%Y-%m-%d")
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Overdue Test Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=20)).strftime("%Y-%m-%d"),
        "khata_transactions": [
            {
                "id": "tx-overdue-1",
                "title": "Seed Store Liability",
                "party_name": "Agro Suppliers",
                "vendor": "Agro Suppliers",
                "category": "Seeds",
                "amount": 2500,
                "due_date": past_due,
                "payment_status": "overdue",
                "type": "actual"
            }
        ],
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="overdue")

    assert res.overdue_count >= 1
    assert any(a.action_id == "act-khata-pay-tx-overdue-1" and a.operational_bucket == "overdue" for a in res.actions)


# TEST 3: Upcoming bucket
@pytest.mark.asyncio
async def test_3_upcoming_bucket(sample_user, mock_weather):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Upcoming Test Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=10)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    mock_cal_svc = MagicMock()
    future_date = (datetime.now(timezone.utc).date() + timedelta(days=3)).strftime("%Y-%m-%d")
    mock_cal_svc.get_crop_calendar = AsyncMock(return_value={
        "stages": [],
        "today_tasks": [],
        "upcoming_activities": [
            {
                "task_id": "stage-2-task-1",
                "title": "Secondary Weeding",
                "stage_name": "Vegetative",
                "scheduled_date": future_date,
                "category": "weeding"
            }
        ]
    })

    service = ActionCenterService(weather_service=w_svc, crop_calendar_service=mock_cal_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="upcoming")

    assert res.upcoming_count >= 1
    assert any(a.action_id == "act-crop-upcoming-stage-2-task-1" and a.operational_bucket == "upcoming" for a in res.actions)


# TEST 4: Completed bucket
@pytest.mark.asyncio
async def test_4_completed_bucket(sample_user, mock_weather):
    farm_id = str(ObjectId())
    recent_done = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Completed Test Farm",
        "timeline_tasks": {
            "stage-1-task-0": {
                "completed": True,
                "completed_at": recent_done,
                "title": "Soil Preparation"
            }
        },
        "action_center_state": {
            "act-weather-heat": {
                "status": "completed",
                "completed_at": recent_done,
                "title": "Heatwave Shield"
            }
        }
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="completed")

    assert res.completed_count >= 2
    assert all(a.operational_bucket == "completed" for a in res.actions)


# TEST 5: Upcoming 7-day boundary
@pytest.mark.asyncio
async def test_5_upcoming_7_day_boundary(sample_user, mock_weather):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Boundary Test Farm",
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    mock_cal_svc = MagicMock()
    day_7_date = (datetime.now(timezone.utc).date() + timedelta(days=7)).strftime("%Y-%m-%d")
    mock_cal_svc.get_crop_calendar = AsyncMock(return_value={
        "stages": [],
        "today_tasks": [],
        "upcoming_activities": [
            {
                "task_id": "boundary-task-7",
                "title": "Day 7 Irrigation Check",
                "scheduled_date": day_7_date,
                "category": "irrigation"
            }
        ]
    })

    service = ActionCenterService(weather_service=w_svc, crop_calendar_service=mock_cal_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="upcoming")

    assert any(a.action_id == "act-crop-upcoming-boundary-task-7" for a in res.actions)


# TEST 6: Older-than-7-day upcoming activity excluded
@pytest.mark.asyncio
async def test_6_older_than_7_day_upcoming_excluded(sample_user, mock_weather):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Exclusion Test Farm",
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    mock_cal_svc = MagicMock()
    day_10_date = (datetime.now(timezone.utc).date() + timedelta(days=10)).strftime("%Y-%m-%d")
    mock_cal_svc.get_crop_calendar = AsyncMock(return_value={
        "stages": [],
        "today_tasks": [],
        "upcoming_activities": [
            {
                "task_id": "future-task-10",
                "title": "Harvest in 10 Days",
                "scheduled_date": day_10_date,
                "category": "harvest"
            }
        ]
    })

    service = ActionCenterService(weather_service=w_svc, crop_calendar_service=mock_cal_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="upcoming")

    assert not any(a.action_id == "act-crop-upcoming-future-task-10" for a in res.actions)


# TEST 7: Completed history bounded to 7 days
@pytest.mark.asyncio
async def test_7_completed_history_bounded(sample_user, mock_weather):
    farm_id = str(ObjectId())
    old_done = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
    recent_done = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Bounded History Farm",
        "timeline_tasks": {
            "old-task": {
                "completed": True,
                "completed_at": old_done,
                "title": "Old Completed Task"
            },
            "recent-task": {
                "completed": True,
                "completed_at": recent_done,
                "title": "Recent Completed Task"
            }
        },
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="completed")

    action_ids = [a.action_id for a in res.actions]
    assert "act-crop-recent-task" in action_ids
    assert "act-crop-old-task" not in action_ids


# TEST 8: Dismissed actions excluded from completed
@pytest.mark.asyncio
async def test_8_dismissed_actions_excluded_from_completed(sample_user, mock_weather):
    farm_id = str(ObjectId())
    recent = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Dismissed Filter Farm",
        "timeline_tasks": {},
        "action_center_state": {
            "act-dismissed-1": {
                "status": "dismissed",
                "dismissed_at": recent,
                "title": "Dismissed Item"
            },
            "act-completed-1": {
                "status": "completed",
                "completed_at": recent,
                "title": "Completed Item"
            }
        }
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="completed")

    action_ids = [a.action_id for a in res.actions]
    assert "act-completed-1" in action_ids
    assert "act-dismissed-1" not in action_ids


# TEST 9: Field/crop/growth-stage context populated
@pytest.mark.asyncio
async def test_9_field_crop_growth_stage_context(sample_user, mock_weather):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "North Field Farm",
        "field_name": "Field North",
        "crop_name": "Wheat",
        "growth_stage": "Flowering",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=40)).strftime("%Y-%m-%d"),
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="today")

    assert len(res.actions) > 0
    for a in res.actions:
        assert a.crop_name == "Wheat"
        assert a.growth_stage == "Flowering"
        assert a.field_name == "Field North"


# TEST 10: Bucket filtering
@pytest.mark.asyncio
async def test_10_bucket_filtering(sample_user, mock_weather):
    farm_id = str(ObjectId())
    past_due = (datetime.now(timezone.utc).date() - timedelta(days=2)).strftime("%Y-%m-%d")
    recent_done = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Filter Test Farm",
        "crop_name": "Rice",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=15)).strftime("%Y-%m-%d"),
        "khata_transactions": [
            {
                "id": "tx-filter-1",
                "title": "Seed Store Liability",
                "category": "Seeds",
                "vendor": "Seed Store",
                "amount": 1000,
                "due_date": past_due,
                "payment_status": "overdue",
                "type": "actual"
            }
        ],
        "timeline_tasks": {
            "task-done": {
                "completed": True,
                "completed_at": recent_done,
                "title": "Nursery Preparation"
            }
        },
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)

    # Filter 'overdue'
    res_overdue = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="overdue")
    assert all(a.operational_bucket == "overdue" for a in res_overdue.actions)

    # Filter 'completed'
    res_completed = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="completed")
    assert all(a.operational_bucket == "completed" for a in res_completed.actions)

    # Filter default (active items: today, overdue, upcoming)
    res_default = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket=None)
    assert all(a.operational_bucket in ("today", "overdue", "upcoming") for a in res_default.actions)
    assert not any(a.operational_bucket == "completed" for a in res_default.actions)


# TEST 11: Response counts
@pytest.mark.asyncio
async def test_11_response_counts(sample_user, mock_weather):
    farm_id = str(ObjectId())
    past_due = (datetime.now(timezone.utc).date() - timedelta(days=2)).strftime("%Y-%m-%d")
    recent_done = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Counts Farm",
        "crop_name": "Rice",
        "growth_stage": "Vegetative",
        "planting_date": (datetime.now(timezone.utc).date() - timedelta(days=15)).strftime("%Y-%m-%d"),
        "khata_transactions": [
            {
                "id": "tx-count-1",
                "title": "Fertilizer Depot Payable",
                "category": "Fertilizer",
                "vendor": "Fertilizer Depot",
                "amount": 1200,
                "due_date": past_due,
                "payment_status": "overdue",
                "type": "actual"
            }
        ],
        "timeline_tasks": {
            "task-done": {
                "completed": True,
                "completed_at": recent_done,
                "title": "Weeding Done"
            }
        },
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user, bucket="overdue")

    # Counts should reflect all buckets even when filtered to 'overdue'
    assert res.overdue_count >= 1
    assert res.completed_count >= 1
    assert isinstance(res.today_count, int)
    assert isinstance(res.upcoming_count, int)


# TEST 12: Reopen completed advisory action
@pytest.mark.asyncio
async def test_12_reopen_completed_advisory_action(sample_user):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Reopen Advisory Farm",
        "timeline_tasks": {},
        "action_center_state": {
            "act-weather-heat": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    }
    mock_db = create_mock_db(farm_doc)
    service = ActionCenterService(db=mock_db)
    res = await service.reopen_action(farm_id=farm_id, action_id="act-weather-heat", current_user=sample_user)

    assert res["status"] == "success"
    assert res["new_status"] == "pending"
    mock_col = mock_db["farm_profiles"]
    assert mock_col.update_one.call_count == 1
    call_args = mock_col.update_one.call_args[0]
    update_doc = call_args[1]["$set"]
    assert update_doc["action_center_state"]["act-weather-heat"]["status"] == "pending"


# TEST 13: Reopen completed B16 timeline task
@pytest.mark.asyncio
async def test_13_reopen_completed_b16_timeline_task(sample_user):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Reopen B16 Farm",
        "timeline_tasks": {
            "stage-2-task-1": {
                "completed": True,
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        },
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    service = ActionCenterService(db=mock_db)
    res = await service.reopen_action(farm_id=farm_id, action_id="act-crop-stage-2-task-1", current_user=sample_user)

    assert res["status"] == "success"
    assert res["new_status"] == "pending"
    mock_col = mock_db["farm_profiles"]
    assert mock_col.update_one.call_count == 1
    call_args = mock_col.update_one.call_args[0]
    update_doc = call_args[1]["$set"]
    assert update_doc["timeline_tasks"]["stage-2-task-1"]["completed"] is False
    assert update_doc["timeline_tasks"]["stage-2-task-1"]["status"] == "pending"


# TEST 14: Reopen idempotency
@pytest.mark.asyncio
async def test_14_reopen_idempotency(sample_user):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Idempotent Farm",
        "timeline_tasks": {},
        "action_center_state": {
            "act-advisory-1": {
                "status": "pending"
            }
        }
    }
    mock_db = create_mock_db(farm_doc)
    service = ActionCenterService(db=mock_db)
    res = await service.reopen_action(farm_id=farm_id, action_id="act-advisory-1", current_user=sample_user)

    assert res["status"] == "success"
    assert res["new_status"] == "pending"
    assert "already pending" in res["message"]
    # Ensure no DB mutation occurred
    mock_col = mock_db["farm_profiles"]
    mock_col.update_one.assert_not_called()


# TEST 15: Cross-farmer access rejected
@pytest.mark.asyncio
async def test_15_cross_farmer_access_rejected(sample_user, other_user):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Private Farm",
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    service = ActionCenterService(db=mock_db)

    # Attempt get_actions by other farmer
    with pytest.raises(HTTPException) as exc_info:
        await service.get_actions(farm_id=farm_id, current_user=other_user)
    assert exc_info.value.status_code == 403

    # Attempt reopen_action by other farmer
    with pytest.raises(HTTPException) as exc_info2:
        await service.reopen_action(farm_id=farm_id, action_id="act-any", current_user=other_user)
    assert exc_info2.value.status_code == 403


# TEST 16: Existing B19 completion still works
@pytest.mark.asyncio
async def test_16_existing_b19_completion_still_works(sample_user):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "B19 Completion Farm",
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    service = ActionCenterService(db=mock_db)
    res = await service.complete_action(farm_id=farm_id, action_id="act-irrigation-check", current_user=sample_user)

    assert res["status"] == "success"
    assert res["new_status"] == "completed"
    mock_col = mock_db["farm_profiles"]
    assert mock_col.update_one.call_count == 1


# TEST 17: Existing B19 dismissal still works
@pytest.mark.asyncio
async def test_17_existing_b19_dismissal_still_works(sample_user):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "B19 Dismissal Farm",
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    service = ActionCenterService(db=mock_db)
    res = await service.dismiss_action(farm_id=farm_id, action_id="act-market-tip", current_user=sample_user)

    assert res["status"] == "success"
    assert res["new_status"] == "dismissed"
    mock_col = mock_db["farm_profiles"]
    assert mock_col.update_one.call_count == 1


# TEST 18: IoT offline fallback preserved
@pytest.mark.asyncio
async def test_18_iot_offline_fallback_preserved(sample_user, mock_weather):
    farm_id = str(ObjectId())
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=45)
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Stale IoT Farm",
        "device_id": "ESP32-STALE-99",
        "timeline_tasks": {},
        "action_center_state": {}
    }
    stale_device = {
        "device_id": "ESP32-STALE-99",
        "status": "offline",
        "last_seen": stale_time,
        "latest_telemetry": {
            "soil_moisture": 30.0,
            "temperature": 25.0,
            "humidity": 60.0
        }
    }
    mock_db = create_mock_db(farm_doc, device_doc=stale_device)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    assert res.operating_mode == "software_ai"
    assert res.sensor_status == "offline"


# TEST 19: No fabricated telemetry
@pytest.mark.asyncio
async def test_19_no_fabricated_telemetry(sample_user, mock_weather):
    farm_id = str(ObjectId())
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "No Telemetry Farm",
        "device_id": None,
        "timeline_tasks": {},
        "action_center_state": {}
    }
    mock_db = create_mock_db(farm_doc)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    service = ActionCenterService(weather_service=w_svc, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    assert res.operating_mode == "software_ai"
    assert res.sensor_status == "not_connected"


# TEST 20: No actuator/hardware mutation
@pytest.mark.asyncio
async def test_20_no_actuator_hardware_mutation(sample_user, mock_weather):
    farm_id = str(ObjectId())
    now_utc = datetime.now(timezone.utc)
    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": sample_user["id"],
        "farm_name": "Actuator Safety Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": (now_utc.date() - timedelta(days=20)).strftime("%Y-%m-%d"),
        "device_id": "ESP32-SAFE-01",
        "timeline_tasks": {},
        "action_center_state": {}
    }
    fresh_device = {
        "device_id": "ESP32-SAFE-01",
        "status": "online",
        "last_seen": now_utc - timedelta(seconds=20),
        "latest_telemetry": {
            "device_id": "ESP32-SAFE-01",
            "soil_moisture": 18.0,
            "temperature": 27.0,
            "humidity": 65.0,
            "rain_sensor": 0
        }
    }
    mock_db = create_mock_db(farm_doc, device_doc=fresh_device)
    w_svc = MagicMock()
    w_svc.get_weather_for_farm = AsyncMock(return_value=mock_weather)

    irr_mock = MagicMock()
    irr_mock.calculate_irrigation_recommendation = AsyncMock(return_value={
        "irrigation_required": True,
        "recommended_pump_minutes": 45,
        "water_quantity_liters_per_acre": 18000,
        "best_irrigation_time": "06:00 AM",
        "moisture_deficit": 14.0,
        "reasoning": ["Soil moisture is below optimal threshold."],
        "mode": "smart_iot"
    })

    service = ActionCenterService(weather_service=w_svc, irrigation_service=irr_mock, db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=sample_user)

    # Actions are strictly advisory; no DB mutation or command dispatch was issued
    mock_db["farm_profiles"].update_one.assert_not_called()
    assert res.operating_mode == "smart_iot"
    assert any(a.action_type == "WATER" for a in res.actions)
    for action in res.actions:
        assert "actuator" not in action.action_id
        assert "command" not in action.action_id
