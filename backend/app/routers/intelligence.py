from datetime import timezone
import logging
from typing import Optional
from fastapi import APIRouter, Query
from backend.app.services.weather import WeatherIntelligenceService
from backend.app.services.irrigation import SmartIrrigationService
from backend.app.services.risk_forecast import DiseaseRiskForecastService
from backend.app.services.recommendations import DailyRecommendationsService
from backend.app.services.crop_calendar import CropCalendarService
from backend.app.services.farm_health import FarmHealthService
from backend.app.services.farm_timeline import FarmTimelineService
from backend.app.services.economics import CropEconomicsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence System"])

weather_service = WeatherIntelligenceService()
irrigation_service = SmartIrrigationService(weather_service=weather_service)
risk_service = DiseaseRiskForecastService(weather_service=weather_service)
economics_service = CropEconomicsService()
recommendations_service = DailyRecommendationsService(
    weather_service=weather_service,
    irrigation_service=irrigation_service,
    risk_service=risk_service
)
crop_calendar_service = CropCalendarService()
farm_health_service = FarmHealthService(weather_service=weather_service)
farm_timeline_service = FarmTimelineService()

@router.get("/weather", summary="Get Weather Intelligence for Farm Location")
async def get_weather(
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    bypass_cache: bool = Query(False, description="Bypass cache for live sync")
):
    return await weather_service.get_weather_for_farm(
        farm_id=farm_id, lat=lat, lon=lon, bypass_cache=bypass_cache
    )

@router.get("/irrigation", summary="Get Smart Irrigation Recommendation")
async def get_irrigation(
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    crop_name: str = Query("Tomato", description="Crop Name"),
    growth_stage: str = Query("Vegetative", description="Growth Stage"),
    farm_size: float = Query(1.0, description="Farm Size in Acres"),
    soil_moisture: Optional[float] = Query(None, description="Soil Moisture %"),
    lat: float = Query(16.5062, description="Latitude"),
    lon: float = Query(80.6480, description="Longitude")
):
    return await irrigation_service.calculate_irrigation_recommendation(
        farm_id=farm_id,
        crop_name=crop_name,
        growth_stage=growth_stage,
        farm_size_acres=farm_size,
        current_soil_moisture=soil_moisture,
        lat=lat,
        lon=lon
    )

@router.get("/disease-risk", summary="Get Explainable Disease Risk Forecast")
async def get_disease_risk(
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    crop_name: Optional[str] = Query("Tomato", description="Crop Name"),
    lat: Optional[float] = Query(16.5062, description="Latitude"),
    lon: Optional[float] = Query(80.6480, description="Longitude"),
    hardware_mode: bool = Query(False, description="Enable Dual-Stream Hardware Sensor Mode"),
    canopy_temp: Optional[float] = Query(None, description="ESP32 Canopy Temp (°C)"),
    canopy_humidity: Optional[float] = Query(None, description="ESP32 Canopy Humidity (%)"),
    soil_moisture: Optional[float] = Query(None, description="ESP32 Soil Moisture (%)")
):
    safe_crop = (crop_name or "").strip() or "Tomato"
    safe_lat = float(lat) if lat is not None else 16.5062
    safe_lon = float(lon) if lon is not None else 80.6480
    hardware_telemetry = None
    if hardware_mode and (canopy_temp is not None or canopy_humidity is not None):
        hardware_telemetry = {
            "canopy_temperature": canopy_temp,
            "canopy_humidity": canopy_humidity,
            "soil_moisture": soil_moisture
        }
    return await risk_service.calculate_disease_risk(
        farm_id=farm_id,
        crop_name=safe_crop,
        lat=safe_lat,
        lon=safe_lon,
        hardware_mode=hardware_mode,
        hardware_telemetry=hardware_telemetry
    )

@router.get("/pathogen-radar", summary="Get Hyperlocal Weather & Pathogen Outbreak Forecast Radar")
async def get_pathogen_radar(
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    crop_name: str = Query("Tomato", description="Crop Name"),
    lat: float = Query(16.5062, description="Latitude"),
    lon: float = Query(80.6480, description="Longitude"),
    hardware_mode: bool = Query(False, description="Enable Dual-Stream Hardware Sensor Mode"),
    canopy_temp: Optional[float] = Query(None, description="ESP32 Canopy Temp (°C)"),
    canopy_humidity: Optional[float] = Query(None, description="ESP32 Canopy Humidity (%)"),
    soil_moisture: Optional[float] = Query(None, description="ESP32 Soil Moisture (%)")
):
    hardware_telemetry = None
    if hardware_mode and (canopy_temp is not None or canopy_humidity is not None):
        hardware_telemetry = {
            "canopy_temperature": canopy_temp,
            "canopy_humidity": canopy_humidity,
            "soil_moisture": soil_moisture
        }
    return await risk_service.calculate_disease_risk(
        farm_id=farm_id,
        crop_name=crop_name,
        lat=lat,
        lon=lon,
        hardware_mode=hardware_mode,
        hardware_telemetry=hardware_telemetry
    )

@router.get("/economic-loss", summary="Get AI Crop Yield Loss & Financial Impact Estimator in ₹")
async def get_economic_loss(
    crop_name: str = Query("Tomato", description="Crop Name"),
    disease_name: str = Query("Early Blight", description="Diagnosed Disease"),
    severity_stage: str = Query("moderate", description="Severity (early, moderate, severe, critical)"),
    farm_size_acres: float = Query(1.0, description="Farm Size in Acres"),
    custom_market_price: Optional[float] = Query(None, description="Custom Market Price per Quintal (₹)")
):
    return economics_service.calculate_economic_impact(
        crop_name=crop_name,
        disease_name=disease_name,
        severity_stage=severity_stage,
        farm_size_acres=farm_size_acres,
        custom_market_price=custom_market_price
    )

@router.get("/recommendations", summary="Get Daily AI Recommendations")
async def get_daily_recommendations(
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    crop_name: str = Query("Tomato", description="Crop Name"),
    growth_stage: str = Query("Vegetative", description="Growth Stage"),
    farm_size: float = Query(1.0, description="Farm Size in Acres"),
    lat: float = Query(16.5062, description="Latitude"),
    lon: float = Query(80.6480, description="Longitude")
):
    return await recommendations_service.generate_daily_recommendations(
        farm_id=farm_id,
        crop_name=crop_name,
        growth_stage=growth_stage,
        farm_size=farm_size,
        lat=lat,
        lon=lon
    )

@router.get("/crop-calendar", summary="Get Crop Lifecycle Calendar")
async def get_crop_calendar(
    crop_name: str = Query("Tomato", description="Crop Name"),
    growth_stage: str = Query("Vegetative", description="Growth Stage"),
    days_since_sowing: int = Query(42, description="Days Since Sowing")
):
    return await crop_calendar_service.get_crop_calendar(
        crop_name=crop_name, current_stage=growth_stage, days_since_sowing=days_since_sowing
    )

@router.get("/health-score", summary="Get Farm Health Score 2.0 Breakdown")
async def get_health_score(
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    diseased_ratio: float = Query(0.15, description="Diseased Ratio"),
    lat: float = Query(16.5062, description="Latitude"),
    lon: float = Query(80.6480, description="Longitude")
):
    return await farm_health_service.calculate_health_score_2(
        farm_id=farm_id, diseased_ratio=diseased_ratio, lat=lat, lon=lon
    )

@router.get("/timeline", summary="Get Filterable Farm Activity Timeline")
async def get_timeline(
    farm_id: Optional[str] = Query(None, description="Farm Profile ID"),
    category: str = Query("All", description="Filter Category"),
    limit: int = Query(20, description="Event Limit")
):
    return await farm_timeline_service.get_farm_timeline(
        farm_id=farm_id, category=category, limit=limit
    )

@router.get("/products", summary="Get Agrochemical Products from MongoDB")
async def get_agrochemical_products(
    category: Optional[str] = Query(None, description="Category: fungicide | pesticide | fertilizer"),
    disease: Optional[str] = Query(None, description="Filter by disease name"),
    crop: Optional[str] = Query(None, description="Filter by crop name"),
    limit: int = Query(50, description="Max items to return")
):
    """Retrieve verified authentic agrochemical products with brand names, companies, and product images."""
    from backend.app.db.mongodb import get_database
    db = get_database()
    query = {}
    if category and category.lower() != "all":
        query["category"] = category.lower()
    if disease:
        query["target_diseases"] = {"$regex": disease, "$options": "i"}
    if crop:
        query["target_crops"] = {"$regex": crop, "$options": "i"}
    
    if db is not None:
        try:
            cursor = db["agrochemical_products"].find(query, {"_id": 0}).limit(limit)
            products = await cursor.to_list(length=limit)
            if products:
                return {"status": "success", "count": len(products), "products": products}
        except Exception as e:
            logger.warning(f"Error querying agrochemical_products in MongoDB: {e}")

    try:
        from backend.scripts.seed_agrochemical_products import PRODUCTS_DATA
        filtered = PRODUCTS_DATA
        if category and category.lower() != "all":
            filtered = [p for p in filtered if p.get("category") == category.lower()]
        if disease:
            filtered = [p for p in filtered if any(disease.lower() in d.lower() for d in p.get("target_diseases", []))]
        return {"status": "success", "count": len(filtered), "products": filtered[:limit]}
    except Exception:
        return {"status": "success", "count": 0, "products": []}

@router.get("/datasets", summary="Get Downloadable Datasets Info and Links")
async def get_datasets_info():
    """Returns downloadable benchmark datasets for crop diseases and agrochemical products."""
    return {
        "status": "success",
        "datasets": [
            {
                "id": "agrochemical-products",
                "title": "AgriShield Agrochemical Products Dataset",
                "description": "Complete dataset of certified Indian Fertilizers, Pesticides (Insecticides), and Fungicides with authentic package photos, dosages, PHI, and chemical compositions.",
                "total_products": 24,
                "categories": ["Fungicide", "Pesticide", "Fertilizer"],
                "zip_download_url": "/datasets/agrishield_agrochemical_products_dataset.zip",
                "json_catalog_url": "/datasets/agrochemical_catalog.json",
                "format": "ZIP (JSON + High-Res Product Photos)",
                "size": "670 KB"
            },
            {
                "id": "crop-disease-benchmark",
                "title": "AgriShield Crop Disease Benchmark Dataset",
                "description": "Curated leaf symptom photos across 15 agricultural crops with diagnostic labels in English, Telugu, and Hindi.",
                "total_samples": 189,
                "crops_covered": 15,
                "zip_download_url": "/datasets/agrishield_crop_disease_dataset.zip",
                "json_catalog_url": "/samples/dataset_catalog.json",
                "format": "ZIP (JSON + JPG Leaf Images)",
                "size": "6.9 MB"
            }
        ]
    }



