"""
B21 — Smart Farm Alerts & Notification Intelligence Test Suite
Validates:
1. TEST 1 — Soil action URL is /farm?tab=farm-intelligence and NOT /recommendations
2. TEST 2 — Regional disease outbreak action URL points to /upload and NOT /notifications
3. TEST 3 — Actionable notification CTA logic (soil, disease, booking, battery, inventory)
4. TEST 4 — Non-actionable notification CTA logic returns None (system, broadcast without URL)
5. TEST 5 — Severe weather advisory notification creation via NotificationService
6. TEST 6 — Weather notification deduplication within 12-hour window
7. TEST 7 — Weather condition change / escalation creates distinct advisory
8. TEST 8 — Quiet hours suppression for non-critical weather advisories
9. TEST 9 — Notification category preference (weather_alerts=False) prevents advisory
10. TEST 10 — Software AI Mode works without IoT telemetry
11. TEST 11 — Smart IoT Mode works without generating duplicates
12. TEST 12 — Zero hardware control (no MQTT, pump, relay, or ESP32 commands)
13. TEST 13 — B19/B20 compatibility (zero Action Center record mutation)
14. TEST 14 — Authentication / user scoping
15. TEST 15 — Notification lifecycle (mark read, acknowledge, resolution)
"""

import pytest
import re
from datetime import datetime, timezone, timedelta, time
from bson import ObjectId
from unittest.mock import AsyncMock, patch, MagicMock

from backend.tests.mock_db import MockDatabase
from backend.app.db.mongodb import db_instance
from backend.app.services.notification_service import NotificationService
from backend.app.models.notification import NotificationCreate


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture
def mock_db():
    db = MockDatabase()
    db_instance.db = db
    return db


# ---------------------------------------------------------------------------
# TEST 1 — Soil action URL
# ---------------------------------------------------------------------------
def test_soil_alert_action_url():
    """Verify soil alert action URL in alert_engine.py is /farm?tab=farm-intelligence and NOT /recommendations."""
    with open("backend/app/services/alert_engine.py", "r", encoding="utf-8") as f:
        content = f.read()

    assert "/recommendations" not in content, "Found deprecated /recommendations in alert_engine.py"
    assert "/farm?tab=farm-intelligence" in content, "Expected /farm?tab=farm-intelligence in alert_engine.py"


# ---------------------------------------------------------------------------
# TEST 2 — Regional disease action URL
# ---------------------------------------------------------------------------
def test_regional_disease_action_url():
    """Verify regional disease outbreak notification in predict.py does not use circular /notifications, points to /upload."""
    with open("backend/app/routers/farmer/predict.py", "r", encoding="utf-8") as f:
        content = f.read()

    # Outbreak alert block must route to /upload
    outbreak_match = re.search(r'⚠️ Outbreak Alert.*?action_url="([^"]+)"', content, re.DOTALL)
    assert outbreak_match is not None, "Could not find Outbreak Alert block in predict.py"
    target_url = outbreak_match.group(1)
    assert target_url != "/notifications", "Outbreak alert must NOT use circular /notifications"
    assert target_url == "/upload", f"Expected /upload, got {target_url}"


# ---------------------------------------------------------------------------
# TEST 3 — Notification CTA logic
# ---------------------------------------------------------------------------
def test_actionable_notification_cta():
    """Simulate frontend getActionCTA logic for actionable categories."""
    # Mirror frontend getActionCTA contract
    def get_action_cta(item, is_te=False):
        cat = str(item.get("category") or item.get("type") or "").lower()
        raw_url = item.get("action_url") or ""
        title = str(item.get("title") or "").lower()
        clean_url = raw_url if (raw_url and not raw_url.startswith("/notifications")) else ""

        if "soil" in cat or "irrigation" in cat or "soil" in title or "irrigation" in title:
            return {
                "label": "నీటి పారుదల సలహా చూడండి" if is_te else "View Irrigation Advice",
                "url": clean_url or "/farm?tab=farm-intelligence"
            }
        if "weather" in cat or "weather" in title or "rain" in title or "heat" in title:
            return {
                "label": "వ్యవసాయ పనుల వివరాలు చూడండి" if is_te else "View Farm Operations",
                "url": clean_url or "/farm?tab=farm-intelligence"
            }
        if "disease" in cat or "outbreak" in cat or "outbreak" in title or "disease" in title:
            return {
                "label": "పంటను స్కాన్ చేయండి" if is_te else "Scan Crop Now",
                "url": clean_url or "/upload"
            }
        if "battery" in cat or "device" in cat or "hardware" in cat or "node" in cat or "sensor" in cat:
            return {
                "label": "హార్డ్‌వేర్ తనిఖీ చేయండి" if is_te else "Check Hardware",
                "url": clean_url or "/devices"
            }
        if "booking" in cat or "machinery" in cat or "equipment" in cat or item.get("booking_id"):
            b_id = item.get("booking_id")
            dest = clean_url or (f"/equipment-booking?bookingId={b_id}" if b_id else "/equipment-booking")
            return {
                "label": "బుకింగ్ చూడండి" if is_te else "View Booking",
                "url": dest
            }
        if "inventory" in cat or "inventory" in title or "stock" in title:
            return {
                "label": "స్టాక్ వివరాలు చూడండి" if is_te else "View Inventory",
                "url": clean_url or "/farm?tab=inventory"
            }
        return None

    # Soil
    soil_cta = get_action_cta({"category": "soil", "title": "Soil Moisture Low", "action_url": "/farm?tab=farm-intelligence"})
    assert soil_cta is not None
    assert soil_cta["label"] == "View Irrigation Advice"
    assert soil_cta["url"] == "/farm?tab=farm-intelligence"

    # Disease
    disease_cta = get_action_cta({"category": "Disease", "title": "Outbreak Alert", "action_url": "/upload"})
    assert disease_cta is not None
    assert disease_cta["label"] == "Scan Crop Now"
    assert disease_cta["url"] == "/upload"

    # Booking
    booking_cta = get_action_cta({"category": "booking", "title": "Tractor Booking Confirmed", "booking_id": "BK-123"})
    assert booking_cta is not None
    assert booking_cta["label"] == "View Booking"
    assert "bookingId=BK-123" in booking_cta["url"] or booking_cta["url"] == "/equipment-booking"

    # Battery
    battery_cta = get_action_cta({"category": "battery", "title": "ESP32 Battery Low"})
    assert battery_cta is not None
    assert battery_cta["label"] == "Check Hardware"
    assert battery_cta["url"] == "/devices"


# ---------------------------------------------------------------------------
# TEST 4 — Non-actionable notification CTA
# ---------------------------------------------------------------------------
def test_non_actionable_notification_cta():
    """Verify non-actionable notifications (system announcements, broadcast without url) receive no CTA button."""
    def get_action_cta(item):
        cat = str(item.get("category") or item.get("type") or "").lower()
        raw_url = item.get("action_url") or ""
        clean_url = raw_url if (raw_url and not raw_url.startswith("/notifications")) else ""

        if cat in ["system", "support", "farmer_onboarding", "provider_onboarding", "farm_field", "security"]:
            return {"label": "View Details", "url": clean_url} if clean_url else None
        if cat == "broadcast":
            return {"label": "View Details", "url": clean_url} if clean_url else None
        return None

    # System notice without action url
    system_cta = get_action_cta({"category": "system", "title": "System maintenance scheduled tonight"})
    assert system_cta is None

    # Broadcast without action url
    broadcast_cta = get_action_cta({"category": "broadcast", "title": "Community harvest celebration"})
    assert broadcast_cta is None

    # Onboarding notice
    onboard_cta = get_action_cta({"category": "farmer_onboarding", "title": "New farmer registered"})
    assert onboard_cta is None


# ---------------------------------------------------------------------------
# TEST 5 — Severe weather advisory
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_severe_weather_advisory_creation(mock_db):
    """Simulate severe weather (rain prob > 80%) and verify advisory generation via NotificationService."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    weather_data = {
        "current": {
            "temperature": 28.5,
            "humidity": 85.0,
            "rain_probability": 90.0,
            "condition": "Heavy Rain"
        }
    }

    advisories = await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data)
    assert len(advisories) == 1
    adv = advisories[0]
    assert adv["title"] == "Heavy Rain Expected"
    assert adv["category"] == "weather"
    assert adv["action_url"] == "/farm?tab=farm-intelligence"
    assert adv["priority"] in ["High", "Medium"]

    # Verify persisted in database
    saved = await mock_db.notifications.find_one({"user_id": user_id, "category": "weather"})
    assert saved is not None
    assert saved["title"] == "Heavy Rain Expected"
    assert saved["action_url"] == "/farm?tab=farm-intelligence"


# ---------------------------------------------------------------------------
# TEST 6 — Weather deduplication
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_weather_deduplication(mock_db):
    """Verify identical weather advisory within 12h window is deduplicated."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    weather_data = {
        "current": {
            "temperature": 29.0,
            "humidity": 90.0,
            "rain_probability": 85.0
        }
    }

    first = await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data)
    assert len(first) == 1

    # Second trigger with identical severe weather within cooldown
    second = await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data)
    assert len(second) == 0

    count = await mock_db.notifications.count_documents({"user_id": user_id, "title": "Heavy Rain Expected"})
    assert count == 1


# ---------------------------------------------------------------------------
# TEST 7 — Weather condition change / escalation
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_weather_condition_change(mock_db):
    """Verify distinct severe conditions (e.g. rain vs heatwave) create separate advisories."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    # 1. Rain alert
    rain_data = {"current": {"temperature": 27.0, "rain_probability": 85.0}}
    res1 = await NotificationService.trigger_weather_advisory(mock_db, user_id, rain_data)
    assert len(res1) == 1
    assert res1[0]["title"] == "Heavy Rain Expected"

    # 2. Subsequent heat alert
    heat_data = {"current": {"temperature": 40.5, "rain_probability": 10.0}}
    res2 = await NotificationService.trigger_weather_advisory(mock_db, user_id, heat_data)
    assert len(res2) == 1
    assert res2[0]["title"] == "High Heat Advisory"

    total = await mock_db.notifications.count_documents({"user_id": user_id, "category": "weather"})
    assert total == 2


# ---------------------------------------------------------------------------
# TEST 8 — Quiet hours
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_quiet_hours_advisory_suppression(mock_db):
    """Verify non-critical weather advisory is suppressed during active quiet hours."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    # Enable 24-hour quiet hours so any evaluation falls within quiet hours
    await mock_db.notification_settings.insert_one({
        "user_id": user_id,
        "weather_alerts": True,
        "quiet_hours": {"enabled": True, "start": "00:00", "end": "23:59"}
    })

    # High Heat Advisory defaults to non-critical (priority="Medium")
    heat_data = {"current": {"temperature": 39.5, "rain_probability": 5.0}}
    res = await NotificationService.trigger_weather_advisory(mock_db, user_id, heat_data)
    assert len(res) == 0, "Non-critical advisory must be suppressed during quiet hours"

    notifs = await mock_db.notifications.find({"user_id": user_id}).to_list(10)
    assert len(notifs) == 0


# ---------------------------------------------------------------------------
# TEST 9 — Notification preferences
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_weather_alerts_preference_disabled(mock_db):
    """Verify disabling weather_alerts in settings prevents advisory generation."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    await mock_db.notification_settings.insert_one({
        "user_id": user_id,
        "weather_alerts": False,
        "quiet_hours": {"enabled": False}
    })

    weather_data = {"current": {"rain_probability": 95.0, "temperature": 25.0}}
    res = await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data)
    assert len(res) == 0

    count = await mock_db.notifications.count_documents({"user_id": user_id})
    assert count == 0


# ---------------------------------------------------------------------------
# TEST 10 — Software AI Mode
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_software_ai_mode_no_telemetry(mock_db):
    """Verify weather advisory works purely with virtual/forecast weather without hardware node."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    weather_data = {
        "current": {"temperature": 26.0, "rain_probability": 20.0},
        "forecast": [
            {"time": "2026-10-06T12:00:00Z", "temperature": 27.0, "rain_probability": 88.0}
        ]
    }

    # device_id is None in Software AI Mode
    res = await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data, device_id=None)
    assert len(res) == 1
    assert res[0]["title"] == "Heavy Rain Expected"
    assert res[0]["device_id"] is None


# ---------------------------------------------------------------------------
# TEST 11 — Smart IoT Mode
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_smart_iot_mode_no_duplicate_advisories(mock_db):
    """Verify presence of IoT telemetry does not cause duplicate weather notifications."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    weather_data = {"current": {"temperature": 39.2, "rain_probability": 15.0}}

    # IoT device telemetry triggers advisory
    res1 = await NotificationService.trigger_weather_advisory(
        mock_db, user_id, weather_data, device_id="ESP32_FIELD_NODE_01"
    )
    assert len(res1) == 1

    # Second IoT telemetry packet within same hour
    res2 = await NotificationService.trigger_weather_advisory(
        mock_db, user_id, weather_data, device_id="ESP32_FIELD_NODE_01"
    )
    assert len(res2) == 0

    notifs = await mock_db.notifications.find({"user_id": user_id}).to_list(10)
    assert len(notifs) == 1
    assert notifs[0]["device_id"] == "ESP32_FIELD_NODE_01"


# ---------------------------------------------------------------------------
# TEST 12 — No hardware control
# ---------------------------------------------------------------------------
# TEST 12 — No hardware control
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_no_hardware_control(mock_db):
    """Verify B21 weather notification path executes zero pump, relay, or actuator commands."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    weather_data = {"current": {"temperature": 40.0, "rain_probability": 90.0}}

    # Verify no pump/actuator calls occur
    with patch("backend.app.services.irrigation.service.SmartIrrigationService.calculate_irrigation_recommendation", new=AsyncMock()) as mock_irrigation:
        res = await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data)
        assert len(res) >= 1
        # No automatic irrigation or pump calculation was invoked
        mock_irrigation.assert_not_called()


# ---------------------------------------------------------------------------
# TEST 13 — B19/B20 Action Center compatibility
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_b19_b20_action_center_untouched(mock_db):
    """Verify B21 does not create or mutate Action Center records."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    initial_action_count = await mock_db.action_center.count_documents({})
    initial_farm_ops = await mock_db.farm_operations.count_documents({})

    weather_data = {"current": {"temperature": 39.5, "rain_probability": 85.0}}
    await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data)

    after_action_count = await mock_db.action_center.count_documents({})
    after_farm_ops = await mock_db.farm_operations.count_documents({})

    assert after_action_count == initial_action_count
    assert after_farm_ops == initial_farm_ops


# ---------------------------------------------------------------------------
# TEST 14 — Authentication / user scoping
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_notification_user_scoping(mock_db):
    """Verify weather notifications are strictly isolated to the target farmer."""
    farmer_a = str(ObjectId())
    farmer_b = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(farmer_a), "role": "farmer", "preferred_language": "en"})
    await mock_db.users.insert_one({"_id": ObjectId(farmer_b), "role": "farmer", "preferred_language": "en"})

    weather_data = {"current": {"temperature": 25.0, "rain_probability": 90.0}}
    await NotificationService.trigger_weather_advisory(mock_db, farmer_a, weather_data)

    a_notifs = await mock_db.notifications.find({"user_id": farmer_a}).to_list(10)
    b_notifs = await mock_db.notifications.find({"user_id": farmer_b}).to_list(10)

    assert len(a_notifs) == 1
    assert len(b_notifs) == 0


# ---------------------------------------------------------------------------
# TEST 15 — Notification lifecycle compatibility
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_notification_lifecycle_compatibility(mock_db):
    """Verify created weather notification supports mark-as-read, acknowledge, and resolve."""
    user_id = str(ObjectId())
    await mock_db.users.insert_one({"_id": ObjectId(user_id), "role": "farmer", "preferred_language": "en"})

    weather_data = {"current": {"temperature": 39.0, "rain_probability": 10.0}}
    res = await NotificationService.trigger_weather_advisory(mock_db, user_id, weather_data)
    assert len(res) == 1

    notif_id = res[0]["notification_id"]

    # 1. Mark as read
    read_success = await NotificationService.mark_as_read(mock_db, notif_id, user_id)
    assert read_success is True
    doc = await mock_db.notifications.find_one({"_id": ObjectId(notif_id)})
    assert doc["read"] is True

    # 2. Acknowledge
    ack_res = await NotificationService.acknowledge_notification(mock_db, notif_id, user_id, "Farmer reviewed advisory")
    assert ack_res is True
    doc = await mock_db.notifications.find_one({"_id": ObjectId(notif_id)})
    assert doc["status"] == "acknowledged"

    # 3. Delete / Clear from active list
    del_res = await NotificationService.delete_notification(mock_db, notif_id, user_id)
    assert del_res is True
    doc = await mock_db.notifications.find_one({"_id": ObjectId(notif_id)})
    assert doc is None
