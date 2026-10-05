import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from backend.app.services.recommendations.service import (
    DailyRecommendationsService,
    get_stage_nutrition_recommendation,
    _match_inventory_stock
)

@pytest.fixture
def mock_weather_service():
    service = MagicMock()
    service.get_weather_for_farm = AsyncMock(return_value={
        "current": {
            "temperature": 28.0,
            "humidity": 65.0,
            "rain_probability": 20.0,
            "wind_speed": 3.0,
            "condition": "Clear"
        }
    })
    return service

@pytest.fixture
def mock_irrigation_service():
    service = MagicMock()
    service.calculate_irrigation_recommendation = AsyncMock(return_value={
        "recommendation": "Soil moisture is optimal. No irrigation required today.",
        "confidence_score": 95.0,
        "reasoning": ["Optimal field capacity."],
        "irrigation_required": False
    })
    return service

@pytest.fixture
def mock_risk_service():
    service = MagicMock()
    service.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 78.0,
        "risk_percentage": 78.0,
        "confidence_score": 93.0,
        "dominant_pathogen": {
            "name": "Tomato Early Blight (Alternaria solani)",
            "risk_percentage": 78.0,
            "preventive_actions": ["Apply Chlorothalonil or Mancozeb 75% WP."]
        },
        "spray_window": {
            "status": "Optimal Protection Window",
            "recommended": True,
            "badge": "Safe Window Open",
            "color": "#10b981",
            "best_time": "Early morning 06:30 AM – 09:30 AM"
        }
    })
    return service

# ── TEST 1: Spray Window Rain Washout Gating (No Conflicting Advice) ──
@pytest.mark.asyncio
async def test_spray_window_rain_washout_gating(mock_irrigation_service, mock_risk_service):
    rain_weather_service = MagicMock()
    rain_weather_service.get_weather_for_farm = AsyncMock(return_value={
        "current": {
            "temperature": 24.0,
            "humidity": 88.0,
            "rain_probability": 75.0,
            "wind_speed": 3.0,
            "condition": "Rain"
        }
    })

    # High disease risk with rain incoming
    mock_risk_service.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 82.0,
        "risk_percentage": 82.0,
        "confidence_score": 94.0,
        "dominant_pathogen": {
            "name": "Tomato Late Blight (Phytophthora)",
            "risk_percentage": 82.0
        },
        "spray_window": {
            "status": "Hazardous / High Washout Risk",
            "recommended": False,
            "badge": "Rain Incoming",
            "best_time": "After rain ceases"
        }
    })

    service = DailyRecommendationsService(
        weather_service=rain_weather_service,
        irrigation_service=mock_irrigation_service,
        risk_service=mock_risk_service
    )

    result = await service.generate_daily_recommendations(crop_name="Tomato", growth_stage="Vegetative")
    recs = result["recommendations"]

    # Must contain rain warning
    rain_rec = next((r for r in recs if r["id"] == "rec_rain_warning"), None)
    assert rain_rec is not None
    assert "75%" in rain_rec["recommendation"]

    # Disease recommendation must be GATED with delay, NOT "Spray now"
    disease_rec = next((r for r in recs if r["category"] == "Disease Risk"), None)
    assert disease_rec is not None
    assert disease_rec["id"] == "rec_spray_delayed"
    assert disease_rec["action_delayed"] is True
    assert "Delay Spraying" in disease_rec["recommendation"]
    assert disease_rec["spray_window_status"] == "High Washout Risk"

# ── TEST 2: Spray Window Wind Drift Gating ──
@pytest.mark.asyncio
async def test_spray_window_wind_drift_gating(mock_weather_service, mock_irrigation_service, mock_risk_service):
    wind_weather_service = MagicMock()
    wind_weather_service.get_weather_for_farm = AsyncMock(return_value={
        "current": {
            "temperature": 27.0,
            "humidity": 55.0,
            "rain_probability": 10.0,
            "wind_speed": 7.2,  # > 5.5 m/s threshold
            "condition": "Windy"
        }
    })

    mock_risk_service.calculate_disease_risk = AsyncMock(return_value={
        "overall_risk_percentage": 65.0,
        "risk_percentage": 65.0,
        "dominant_pathogen": {
            "name": "Tomato Powdery Mildew",
            "risk_percentage": 65.0
        },
        "spray_window": {
            "status": "High Drift Risk",
            "recommended": False,
            "badge": "High Wind"
        }
    })

    service = DailyRecommendationsService(
        weather_service=wind_weather_service,
        irrigation_service=mock_irrigation_service,
        risk_service=mock_risk_service
    )

    result = await service.generate_daily_recommendations(crop_name="Tomato")
    recs = result["recommendations"]

    disease_rec = next((r for r in recs if r["category"] == "Disease Risk"), None)
    assert disease_rec is not None
    assert disease_rec["action_delayed"] is True
    assert disease_rec["spray_window_status"] == "High Drift Risk"

# ── TEST 3: Optimal Safe Spray Window ──
@pytest.mark.asyncio
async def test_spray_window_optimal_safe_open(mock_weather_service, mock_irrigation_service, mock_risk_service):
    service = DailyRecommendationsService(
        weather_service=mock_weather_service,
        irrigation_service=mock_irrigation_service,
        risk_service=mock_risk_service
    )

    result = await service.generate_daily_recommendations(crop_name="Tomato")
    recs = result["recommendations"]

    disease_rec = next((r for r in recs if r["category"] == "Disease Risk"), None)
    assert disease_rec is not None
    assert disease_rec["action_delayed"] is False
    assert disease_rec["spray_window_status"] == "Safe Window Open"
    assert "Spray" in disease_rec["recommendation"]

# ── TEST 4: ICAR Nutrition - Seedling Stage ──
def test_icar_stage_nutrition_seedling():
    nutr = get_stage_nutrition_recommendation("Chilli", "Seedling")
    assert "seedlings" in nutr["recommendation"].lower()
    assert "19-19-19" in nutr["formulation"]
    assert "root" in nutr["target_nutrients"].lower()

# ── TEST 5: ICAR Nutrition - Vegetative Stage ──
def test_icar_stage_nutrition_vegetative():
    nutr = get_stage_nutrition_recommendation("Tomato", "Vegetative")
    assert "nitrogen-rich" in nutr["recommendation"].lower() or "vegetative" in nutr["recommendation"].lower()
    assert "canopy" in nutr["target_nutrients"].lower() or "chlorophyll" in nutr["target_nutrients"].lower()

# ── TEST 6: ICAR Nutrition - Flowering Stage (No Excess Nitrogen) ──
def test_icar_stage_nutrition_flowering():
    nutr = get_stage_nutrition_recommendation("Tomato", "Flowering")
    assert "phosphorus-rich" in nutr["recommendation"].lower()
    assert "boron" in nutr["formulation"].lower() or "12-61-0" in nutr["formulation"]
    # Verify explicit warning against excess nitrogen
    nitrogen_warning = any("excess nitrogen" in r.lower() for r in nutr["reasoning"])
    assert nitrogen_warning is True

# ── TEST 7: ICAR Nutrition - Fruiting Stage ──
def test_icar_stage_nutrition_fruiting():
    nutr = get_stage_nutrition_recommendation("Tomato", "Fruiting")
    assert "potassium-rich" in nutr["recommendation"].lower()
    assert "0-0-50" in nutr["formulation"] or "potassium" in nutr["formulation"].lower()
    assert "calcium" in nutr["target_nutrients"].lower()

# ── TEST 8: ICAR Nutrition - Maturity / Harvest (PHI Withholding) ──
def test_icar_stage_nutrition_harvest():
    nutr = get_stage_nutrition_recommendation("Tomato", "Harvest")
    assert "halt chemical fertilization" in nutr["recommendation"].lower()
    assert "phi" in nutr["target_nutrients"].lower() or "phi" in nutr["reasoning"][1].lower()

# ── TEST 9: Crop Pathogen & Agrochemical Mapping ──
@pytest.mark.asyncio
async def test_crop_pathogen_chemical_mapping(mock_weather_service, mock_irrigation_service, mock_risk_service):
    service = DailyRecommendationsService(
        weather_service=mock_weather_service,
        irrigation_service=mock_irrigation_service,
        risk_service=mock_risk_service
    )
    result = await service.generate_daily_recommendations(crop_name="Tomato", growth_stage="Flowering")
    recs = result["recommendations"]

    disease_rec = next((r for r in recs if r["category"] == "Disease Risk"), None)
    assert disease_rec is not None
    # Must recommend certified agrochemicals (e.g. Saaf, Kavach, Mancozeb, Neem)
    rec_lower = disease_rec["recommendation"].lower()
    assert any(c in rec_lower for c in ["mancozeb", "saaf", "kavach", "neem", "copper"])

# ── TEST 10: B18 Inventory In-Stock Matching ──
def test_b18_inventory_in_stock_matching():
    inventory = [
        {"name": "Mancozeb 75% WP", "quantity": 3.5, "unit": "kg", "category": "Fungicide"}
    ]
    match = _match_inventory_stock(["Mancozeb 75% WP", "Neem Oil"], inventory)
    assert match["in_stock"] is True
    assert match["available_qty"] == 3.5
    assert match["unit"] == "kg"
    assert "In Stock" in match["badge"]
    assert match["badge_variant"] == "success"

# ── TEST 11: B18 Inventory Out-of-Stock Matching ──
def test_b18_inventory_out_of_stock_matching():
    inventory = [
        {"name": "Mancozeb 75% WP", "quantity": 0.0, "unit": "kg", "category": "Fungicide"}
    ]
    match = _match_inventory_stock(["Mancozeb 75% WP"], inventory)
    assert match["in_stock"] is False
    assert match["available_qty"] == 0.0
    assert "Out of Stock" in match["badge"]
    assert match["badge_variant"] == "destructive"

# ── TEST 12: B18 Inventory Not Found ──
def test_b18_inventory_not_found():
    inventory = [
        {"name": "Urea", "quantity": 50.0, "unit": "kg"}
    ]
    match = _match_inventory_stock(["Chlorothalonil"], inventory)
    assert match["in_stock"] is False
    assert "Not in Inventory" in match["badge"]
    assert match["badge_variant"] == "warning"

# ── TEST 13: Repaired Test Notification Action URL ──
def test_notifications_action_url_repaired():
    with open("backend/app/routers/common/notifications.py", "r", encoding="utf-8") as f:
        content = f.read()
    # /recommendations should NOT appear as an action_url anywhere in notifications.py
    assert 'action_url="/recommendations"' not in content
    assert 'action_url="/farm?tab=farm-intelligence"' in content

# ── TEST 14: Backward Compatibility with Default / None DB and User ──
@pytest.mark.asyncio
async def test_backward_compatibility_defaults(mock_weather_service, mock_irrigation_service, mock_risk_service):
    service = DailyRecommendationsService(
        weather_service=mock_weather_service,
        irrigation_service=mock_irrigation_service,
        risk_service=mock_risk_service
    )
    # Calling without db and current_user must execute cleanly without error
    result = await service.generate_daily_recommendations(
        farm_id="farm_123",
        crop_name="Cotton",
        growth_stage="Vegetative",
        db=None,
        current_user=None
    )
    assert "recommendations" in result
    assert len(result["recommendations"]) >= 3
    assert result["metadata"]["api_version"] == "2.2"

# ── TEST 15: Zero Hardware Actuation or Automatic Transactions ──
@pytest.mark.asyncio
async def test_protected_systems_immutability(mock_weather_service, mock_irrigation_service, mock_risk_service):
    # Verify that DailyRecommendationsService is strictly advisory and produces 0 DB mutations or hardware actuations
    mock_db = MagicMock()
    mock_db.__getitem__.return_value.update_one = AsyncMock()
    mock_db.__getitem__.return_value.delete_one = AsyncMock()

    service = DailyRecommendationsService(
        weather_service=mock_weather_service,
        irrigation_service=mock_irrigation_service,
        risk_service=mock_risk_service
    )
    await service.generate_daily_recommendations(
        farm_id="farm_demo",
        crop_name="Tomato",
        growth_stage="Fruiting",
        db=mock_db
    )

    # Ensure no write operations were performed on any collections
    assert mock_db["farm_inventory"].update_one.call_count == 0
    assert mock_db["farm_inventory"].delete_one.call_count == 0
