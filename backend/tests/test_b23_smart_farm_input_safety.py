"""
Test Suite for B23 Correction: Smart Farm Input Safety, Advisory Trust & Farmer Decision Quality
Covers:
1. Authoritative agrochemical safety extraction (PHI, REI, PPE, toxicity) strictly from database
2. Zero hallucination: Missing safety info returns None, never synthetic data
3. Expired inventory rejection: Expired chemicals flagged as unusable, never valid stock
4. Expired inventory reasoning warning: Explicit alert in advisory reasoning with neutral wording
5. Test A: No universal 200 L/acre assumption; returns None without authoritative application volume
6. Test B: Authoritative application volume calculation when explicitly present in data
7. Farm-size stock sufficiency matching when authoritative volume is present
8. Farm-size stock shortfall matching when authoritative volume is present
9. Zero or invalid dosage returns None (no synthetic calculation)
10. Test C: No unsupported authority claims (ICAR, CIBRC, FAO-56, IMD, Certified, Approved, Verified, Official) when absent
11. Test D: Existing source metadata preserved when present in data
12. Action Center disease safety metadata propagation (PHI, REI, PPE in action metadata)
13. Action Center expired inventory priority elevation (P1) and neutral advisory metadata
14. Software AI and Smart IoT compatibility (identical advisory intelligence)
15. Zero hardware actuation guarantee
16. Backward compatibility defaults (all B22 and prior fields intact)
17. Regression immutability across B20-B22
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock
from bson import ObjectId

from backend.app.services.recommendations.service import (
    DailyRecommendationsService,
    get_stage_nutrition_recommendation,
    _match_inventory_stock,
    _is_item_expired,
    extract_safety_protocols,
    calculate_farm_application,
)
from backend.app.services.agrochemical_detector import AGROCHEMICAL_DATABASE, get_recommended_agrochemicals_for_disease
from backend.app.services.action_center.service import ActionCenterService


# 1. Authoritative Safety Protocols Extraction
def test_authoritative_safety_protocols_extraction():
    saaf_data = AGROCHEMICAL_DATABASE.get("saaf")
    assert saaf_data is not None
    safety = extract_safety_protocols(saaf_data)
    assert safety is not None
    assert safety["product_name"] == "SAAF Broad Spectrum Fungicide"
    assert safety["preharvest_interval"] == "14 days before harvest"
    assert "24 hours" in safety["reentry_interval"]
    assert "Class III" in safety["toxicity_level"]
    assert "gloves" in safety["protective_equipment"].lower()
    assert safety["dosage_per_litre"] == "2.0 g / L of clean water"


# 2. Safety Protocols: No Hallucination
def test_safety_protocols_no_hallucination():
    assert extract_safety_protocols(None) is None
    assert extract_safety_protocols({}) is None
    assert extract_safety_protocols({"irrelevant_key": 123}) is None
    # If core fields are missing, returns None
    assert extract_safety_protocols({"product_name": "Unknown Powder"}) is None


# 3. Expired Inventory Rejection
def test_expired_inventory_rejection():
    expired_date = (datetime.now().date() - timedelta(days=60)).strftime("%Y-%m-%d")
    is_exp, exp_str = _is_item_expired({"expiry_date": expired_date})
    assert is_exp is True
    assert exp_str == expired_date

    inventory = [
        {
            "id": "inv_1",
            "name": "Mancozeb 75% WP",
            "quantity": 5.0,
            "unit": "kg",
            "expiry_date": expired_date,
            "status": "expired"
        }
    ]
    res = _match_inventory_stock(["Mancozeb 75% WP"], inventory)
    assert res["in_stock"] is False
    assert res["is_expired"] is True
    assert res["badge"] == "Expired Stock (Do Not Apply)"
    assert res["badge_variant"] == "destructive"


# 4. Expired Inventory Warning in Reasoning (Neutral wording, no unsupported chemical-degradation claims)
@pytest.mark.asyncio
async def test_expired_inventory_reasoning_warning():
    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value={
        "current": {"rain_probability": 10.0, "wind_speed": 2.0, "temperature": 27.0}
    })
    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={
        "recommendation": "Maintain standard schedule",
        "confidence_score": 90.0,
        "reasoning": ["Soil moisture optimal"],
        "irrigation_required": False
    })
    mock_risk = MagicMock()
    mock_risk.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 75.0,
        "dominant_pathogen": {"name": "Early Blight", "risk_percentage": 75.0},
        "spray_window": {"recommended": True, "best_time": "06:30 AM – 09:30 AM"},
        "confidence_score": 94.0
    })

    expired_date = (datetime.now().date() - timedelta(days=30)).strftime("%Y-%m-%d")
    service = DailyRecommendationsService(
        weather_service=mock_weather,
        irrigation_service=mock_irrigation,
        risk_service=mock_risk
    )

    expired_inv_list = [
        {
            "name": "SAAF Broad Spectrum Fungicide",
            "quantity": 4.0,
            "unit": "kg",
            "expiry_date": expired_date,
            "is_expired": True
        }
    ]
    mock_inv_col = MagicMock()
    inv_cursor = MagicMock()
    inv_cursor.limit.return_value = inv_cursor
    inv_cursor.to_list = AsyncMock(return_value=expired_inv_list)
    mock_inv_col.find.return_value = inv_cursor

    mock_db = {
        "farm_inventory": mock_inv_col,
        "farm_profiles": MagicMock(find_one=AsyncMock(return_value={"inventory_items": expired_inv_list}))
    }

    result = await service.generate_daily_recommendations(
        farm_id="farm_123",
        crop_name="Tomato",
        growth_stage="Vegetative",
        farm_size=2.0,
        db=mock_db
    )

    rec_items = result["recommendations"]
    spray_item = next((r for r in rec_items if r["id"] == "rec_spray_optimal"), None)
    assert spray_item is not None
    assert spray_item["inventory_status"]["is_expired"] is True
    assert spray_item["inventory_status"]["in_stock"] is False
    assert any("STORAGE WARNING" in reason for reason in spray_item["reasoning"])
    assert any("not counted as usable stock" in reason for reason in spray_item["reasoning"])


# 5. Test A — No universal 200 L/acre assumption
def test_a_no_universal_200l_per_acre():
    """
    Given farm_size = 2.5 acres and dosage = 2 g/L with NO authoritative
    application-volume field: verify calculate_farm_application returns None
    and does NOT calculate 500 L or 1 kg.
    """
    calc = calculate_farm_application("2.0 g / L of clean water", 2.5)
    assert calc is None, "Should be None when authoritative volume is absent"

    # Also verify with plain dosage string
    calc2 = calculate_farm_application("2 g/L", 2.5)
    assert calc2 is None


# 6. Test B — Authoritative volume calculation
def test_b_authoritative_volume_calculation():
    """
    If existing application data genuinely provides an authoritative volume,
    verify calculation strictly uses that actual value.
    """
    # Authoritative volume = 150.0 L/acre, farm = 2.5 acres -> total_volume = 375.0 L
    # dosage = 2.0 g/L -> 375 * 2.0 = 750 g
    calc = calculate_farm_application(
        dosage_str="2.0 g / L of clean water",
        farm_size_acres=2.5,
        authoritative_volume_per_acre=150.0
    )
    assert calc is not None
    assert calc["farm_size_acres"] == 2.5
    assert calc["water_volume_litres"] == 375.0
    assert calc["water_volume_display"] == "375 L"
    assert "750 g" in calc["required_input_display"]
    assert calc["authoritative_volume_per_acre"] == 150.0


# 7. Farm-Size Stock Sufficiency Matching with Authoritative Volume
def test_farm_size_stock_sufficiency_matching():
    inv_match = {
        "in_stock": True,
        "is_expired": False,
        "available_qty": 3.0,
        "unit": "kg",
        "item_name": "SAAF Broad Spectrum Fungicide"
    }
    # 2.5 acres * 150 L/acre = 375 L -> 375 * 2 g/L = 750 g needed. 3.0 kg available -> sufficient!
    calc = calculate_farm_application(
        dosage_str="2.0 g / L of clean water",
        farm_size_acres=2.5,
        inventory_match=inv_match,
        authoritative_volume_per_acre=150.0
    )
    assert calc is not None
    assert calc["stock_sufficiency"] == "sufficient"
    assert "Sufficient Stock" in calc["stock_message"]
    assert "3.0 kg available in storage" in calc["stock_message"]


# 8. Farm-Size Stock Shortfall Matching with Authoritative Volume
def test_farm_size_stock_shortfall_matching():
    inv_match = {
        "in_stock": True,
        "is_expired": False,
        "available_qty": 0.4,
        "unit": "kg",
        "item_name": "SAAF Broad Spectrum Fungicide"
    }
    # 2.5 acres * 150 L/acre = 375 L -> 750 g needed. 400 g available -> shortfall of 350 g!
    calc = calculate_farm_application(
        dosage_str="2.0 g / L of clean water",
        farm_size_acres=2.5,
        inventory_match=inv_match,
        authoritative_volume_per_acre=150.0
    )
    assert calc is not None
    assert calc["stock_sufficiency"] == "shortfall"
    assert "Stock Shortfall" in calc["stock_message"]
    assert "0.4 kg" in calc["stock_message"]


# 9. Zero or Missing Dosage Returns None
def test_farm_size_zero_or_missing_dosage():
    assert calculate_farm_application(None, 2.5, authoritative_volume_per_acre=150.0) is None
    assert calculate_farm_application("2.0 g / L", 0.0, authoritative_volume_per_acre=150.0) is None
    assert calculate_farm_application("2.0 g / L", -1.5, authoritative_volume_per_acre=150.0) is None
    assert calculate_farm_application("spray as needed without dosage", 2.5, authoritative_volume_per_acre=150.0) is None


# 10. Test C — No unsupported authority claims when source metadata is absent
@pytest.mark.asyncio
async def test_c_no_unsupported_authority_claims():
    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value={
        "current": {"rain_probability": 85.0, "wind_speed": 2.0, "temperature": 26.0}
    })
    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={
        "recommendation": "Apply 15mm drip irrigation",
        "confidence_score": 92.0,
        "reasoning": ["Soil depletion at 45%"],
        "irrigation_required": True
    })
    mock_risk = MagicMock()
    mock_risk.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 80.0,
        "dominant_pathogen": {"name": "Late Blight", "risk_percentage": 80.0},
        "spray_window": {"recommended": False, "best_time": None},
        "confidence_score": 93.0
    })

    service = DailyRecommendationsService(
        weather_service=mock_weather,
        irrigation_service=mock_irrigation,
        risk_service=mock_risk
    )

    result = await service.generate_daily_recommendations(
        farm_id="farm_test",
        crop_name="Tomato",
        growth_stage="Flowering",
        farm_size=1.5
    )

    items = result["recommendations"]
    weather_item = next(r for r in items if r["id"] == "rec_rain_warning")
    spray_item = next(r for r in items if r["id"] == "rec_spray_delayed")
    irrig_item = next(r for r in items if r["id"] == "rec_irrigation")
    nutr_item = next(r for r in items if r["id"] == "rec_fertilizer")

    # When source metadata is absent in application data, source_authority must be None
    assert weather_item["source_authority"] is None
    assert spray_item["source_authority"] is None
    assert irrig_item["source_authority"] is None
    assert nutr_item["source_authority"] is None

    # Verify forbidden unsupported authority claims never appear
    forbidden_claims = ["CIBRC", "ICAR", "FAO-56", "IMD", "Certified", "Approved", "Verified", "Official"]
    for item in items:
        source_auth_val = str(item.get("source_authority") or "")
        for claim in forbidden_claims:
            assert claim.lower() not in source_auth_val.lower(), f"Forbidden claim '{claim}' found in {item['id']}"


# 11. Test D — Existing source metadata preserved
@pytest.mark.asyncio
async def test_d_existing_source_metadata_preserved():
    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value={
        "current": {"rain_probability": 75.0, "wind_speed": 1.0, "temperature": 26.0},
        "source": "State Agro-Met Center"
    })
    mock_irrigation = MagicMock()
    mock_irrigation.calculate_irrigation_recommendation = AsyncMock(return_value={
        "recommendation": "Irrigate field",
        "confidence_score": 90.0,
        "reasoning": ["Low moisture"],
        "irrigation_required": True,
        "source_authority": "Station Soil Water Balance"
    })
    mock_risk = MagicMock()
    mock_risk.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 20.0,
        "dominant_pathogen": "Healthy",
        "confidence_score": 90.0
    })

    service = DailyRecommendationsService(
        weather_service=mock_weather,
        irrigation_service=mock_irrigation,
        risk_service=mock_risk
    )

    result = await service.generate_daily_recommendations(
        farm_id="farm_meta",
        crop_name="Tomato",
        growth_stage="Vegetative",
        farm_size=1.0
    )

    items = result["recommendations"]
    weather_item = next((r for r in items if r["id"] == "rec_rain_warning"), None)
    assert weather_item is not None
    assert weather_item["source_authority"] == "State Agro-Met Center"

    irrig_item = next((r for r in items if r["id"] == "rec_irrigation"), None)
    assert irrig_item is not None
    assert irrig_item["source_authority"] == "Station Soil Water Balance"


# 12. Action Center Disease Safety Propagation
@pytest.mark.asyncio
async def test_action_center_disease_safety_propagation():
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    current_user = {"id": user_id, "user_id": user_id, "role": "farmer"}
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": user_id,
        "farm_name": "Safety Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": today_str,
        "device_id": None,
        "latitude": 16.5,
        "longitude": 80.6,
        "inventory_items": [],
        "khata_transactions": [],
        "timeline_tasks": {}
    }

    pred_data = [
        {
            "_id": "pred_789",
            "prediction_status": "diseased",
            "disease_name": "Early Blight",
            "crop_name": "Tomato",
            "confidence": 0.88,
            "created_at": today_str
        }
    ]

    mock_db = {}
    mock_db["farm_profiles"] = MagicMock(find_one=AsyncMock(return_value=farm_doc))
    mock_db["farms"] = MagicMock(find_one=AsyncMock(return_value=farm_doc))
    mock_db["predictions"] = MagicMock(find=MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=pred_data))))))))
    mock_db["equipment_bookings"] = MagicMock(find=MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[]))))))))
    mock_db["farmer_actions"] = MagicMock(find=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[]))))
    mock_db["farm_inventory"] = MagicMock(find=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[]))))))
    mock_db["farm_khata"] = MagicMock(find=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[]))))))
    mock_db["devices"] = MagicMock(find_one=AsyncMock(return_value=None))

    service = ActionCenterService(db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=current_user)

    disease_action = next((a for a in res.actions if a.action_type == "DISEASE_CHECK"), None)
    assert disease_action is not None
    assert disease_action.metadata.get("recommended_product") is not None
    assert disease_action.metadata.get("preharvest_interval") is not None
    assert disease_action.metadata.get("reentry_interval") is not None
    assert disease_action.metadata.get("toxicity_level") is not None


# 13. Action Center Expired Inventory Handling
@pytest.mark.asyncio
async def test_action_center_expired_inventory_handling():
    farm_id = str(ObjectId())
    user_id = str(ObjectId())
    current_user = {"id": user_id, "user_id": user_id, "role": "farmer"}
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    expired_date = (datetime.now().date() - timedelta(days=45)).strftime("%Y-%m-%d")

    farm_doc = {
        "_id": ObjectId(farm_id),
        "id": farm_id,
        "user_id": user_id,
        "farm_name": "Expired Stock Farm",
        "crop_name": "Tomato",
        "growth_stage": "Vegetative",
        "planting_date": today_str,
        "device_id": None,
        "latitude": 16.5,
        "longitude": 80.6,
        "inventory_items": [
            {
                "id": "inv_item_exp",
                "name": "Old Indofil M-45",
                "category": "Fungicide",
                "quantity": 2.0,
                "unit": "kg",
                "expiry_date": expired_date,
                "status": "expired"
            }
        ],
        "khata_transactions": [],
        "timeline_tasks": {}
    }

    mock_db = MagicMock()
    mock_db["farm_profiles"].find_one = AsyncMock(return_value=farm_doc)
    mock_db["farms"].find_one = AsyncMock(return_value=farm_doc)
    mock_db["predictions"].find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db["equipment_bookings"].find = MagicMock(return_value=MagicMock(sort=MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))))
    mock_db["farmer_actions"].find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    mock_db["farm_inventory"].find = MagicMock(return_value=MagicMock(limit=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))))

    service = ActionCenterService(db=mock_db)
    res = await service.get_actions(farm_id=farm_id, current_user=current_user)

    exp_action = next((a for a in res.actions if a.action_id == "act-inv-exp-inv_item_exp"), None)
    assert exp_action is not None
    assert exp_action.priority == "P1"
    assert exp_action.operational_bucket == "overdue"
    assert exp_action.metadata.get("is_expired") is True
    assert "This inventory item is expired and is not counted as usable stock" in exp_action.metadata.get("safety_advisory", "")
    assert "Do not apply expired stock" in exp_action.why


# 14. Software AI and Smart IoT Compatibility
@pytest.mark.asyncio
async def test_software_ai_and_smart_iot_compatibility():
    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value={
        "current": {"rain_probability": 20.0, "wind_speed": 2.5, "temperature": 27.0}
    })
    mock_irr = MagicMock()
    mock_irr.calculate_irrigation_recommendation = AsyncMock(return_value={
        "recommendation": "Optimal soil moisture", "confidence_score": 90.0, "reasoning": [], "irrigation_required": False
    })
    mock_risk = MagicMock()
    mock_risk.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 65.0,
        "dominant_pathogen": {"name": "Early Blight", "risk_percentage": 65.0},
        "spray_window": {"recommended": True},
        "confidence_score": 91.0
    })

    service = DailyRecommendationsService(weather_service=mock_weather, irrigation_service=mock_irr, risk_service=mock_risk)
    res_ai = await service.generate_daily_recommendations(farm_id="farm_a", crop_name="Tomato", growth_stage="Flowering", farm_size=2.0)
    res_iot = await service.generate_daily_recommendations(farm_id="farm_b", crop_name="Tomato", growth_stage="Flowering", farm_size=2.0)

    assert len(res_ai["recommendations"]) == len(res_iot["recommendations"])
    for item_ai, item_iot in zip(res_ai["recommendations"], res_iot["recommendations"]):
        assert item_ai["id"] == item_iot["id"]
        assert item_ai["category"] == item_iot["category"]


# 15. Zero Hardware Actuation Guarantee
def test_zero_hardware_actuation_guarantee():
    service = DailyRecommendationsService()
    forbidden = ["mqtt", "relay", "actuator", "gpio", "turn_pump_on", "pump_control", "esp32"]
    for attr in dir(service):
        assert not any(f in attr.lower() for f in forbidden), f"Forbidden hardware actuator found: {attr}"


# 16. Backward Compatibility Defaults
@pytest.mark.asyncio
async def test_backward_compatibility_defaults():
    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value={
        "current": {"rain_probability": 15.0, "wind_speed": 2.0, "temperature": 28.0}
    })
    mock_irr = MagicMock()
    mock_irr.calculate_irrigation_recommendation = AsyncMock(return_value={
        "recommendation": "Apply light irrigation", "confidence_score": 88.0, "reasoning": ["Standard cycle"], "irrigation_required": True
    })
    mock_risk = MagicMock()
    mock_risk.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 30.0,
        "dominant_pathogen": "Leaf Spot",
        "spray_window": {"recommended": True},
        "confidence_score": 85.0
    })

    service = DailyRecommendationsService(weather_service=mock_weather, irrigation_service=mock_irr, risk_service=mock_risk)
    result = await service.generate_daily_recommendations(crop_name="Chilli", growth_stage="Vegetative")

    assert "metadata" in result
    assert "recommendations" in result
    for rec in result["recommendations"]:
        assert "id" in rec
        assert "recommendation" in rec
        assert "confidence" in rec
        assert "reasoning" in rec
        assert "priority" in rec
        assert "category" in rec
        assert "generated_at" in rec


# 17. Regression Immutability Across B20-B22
@pytest.mark.asyncio
async def test_regression_immutability_b20_b22():
    mock_weather = MagicMock()
    mock_weather.get_weather_for_farm = AsyncMock(return_value={
        "current": {"rain_probability": 70.0, "wind_speed": 1.5, "temperature": 25.0}
    })
    mock_irr = MagicMock()
    mock_irr.calculate_irrigation_recommendation = AsyncMock(return_value={
        "recommendation": "No irrigation needed", "confidence_score": 90.0, "reasoning": [], "irrigation_required": False
    })
    mock_risk = MagicMock()
    mock_risk.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 70.0,
        "dominant_pathogen": {"name": "Late Blight", "risk_percentage": 70.0},
        "spray_window": {"recommended": False},
        "confidence_score": 90.0
    })

    service = DailyRecommendationsService(weather_service=mock_weather, irrigation_service=mock_irr, risk_service=mock_risk)
    res = await service.generate_daily_recommendations(crop_name="Tomato", growth_stage="Vegetative")
    spray_item = next(r for r in res["recommendations"] if r["category"] == "Disease Risk")
    assert spray_item["action_delayed"] is True
    assert "High Washout Risk" in spray_item["spray_window_status"]
