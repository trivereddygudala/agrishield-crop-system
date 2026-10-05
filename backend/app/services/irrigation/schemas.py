from datetime import timezone
from pydantic import BaseModel
from typing import List, Optional

class StandardAPIMetadata(BaseModel):
    api_version: str = "1.0"
    generated_at: str
    processing_time_ms: float
    cache_status: str = "Live"
    cache_expires_in: Optional[int] = 1800

class IrrigationRecommendationResponse(BaseModel):
    metadata: StandardAPIMetadata
    mode: str = "software_ai"  # "software_ai" | "smart_iot"
    sensor_status: str = "not_connected"  # "not_connected" | "offline" | "online" | "unavailable"
    irrigation_required: Optional[bool] = None
    water_quantity_liters_per_acre: Optional[float] = None
    water_quantity_total: Optional[float] = None
    best_irrigation_time: str
    next_irrigation_date: str
    confidence_score: float
    recommendation: str
    reasoning: List[str]
    crop_type: Optional[str] = None
    growth_stage: Optional[str] = None
    current_soil_moisture: Optional[float] = None
    target_soil_moisture: Optional[float] = None
    moisture_deficit: Optional[float] = None
    irrigation_method: Optional[str] = "Manual"
    recommended_pump_minutes: Optional[int] = None
    data_timestamp: Optional[str] = None
    weather_summary: Optional[str] = None
    rain_probability: Optional[float] = None
    source_status: Optional[str] = None
