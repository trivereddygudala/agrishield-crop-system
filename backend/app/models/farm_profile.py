from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class FarmProfileBase(BaseModel):
    farm_name: str = Field(default="My Farm Sector", min_length=1, max_length=100)
    farm_size: float = Field(default=1.0, gt=0)
    farm_unit: str = Field(default="acres", description="acres or hectares")
    number_of_fields: int = Field(default=1, ge=1)
    crop_name: str = Field(default="Tomato", min_length=1, max_length=100)
    crop_variety: Optional[str] = Field(default=None, max_length=100)
    growth_stage: str = Field(default="Vegetative", description="Seedling, Vegetative, Flowering, Fruiting, Harvesting")
    planting_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    irrigation_method: str = Field(default="Manual", description="Drip, Sprinkler, Flood, Rainfed, Manual")
    water_source: str = Field(default="Rain Water", description="Borewell, Canal, River, Pond, Tank, Rain Water")
    soil_type: Optional[str] = Field(default="Red Loamy", max_length=100, description="Soil classification: Red, Black Cotton, Alluvial, Laterite, Sandy, Clay")
    state: Optional[str] = Field(default="Andhra Pradesh", max_length=100)
    district: Optional[str] = Field(default="Anantapur", max_length=100)
    mandal: Optional[str] = Field(default=None, max_length=100, description="Mandal / Taluka / Block")
    village: Optional[str] = Field(default="Sector 1", max_length=100)
    latitude: Optional[float] = Field(default=16.5062, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=80.6480, ge=-180.0, le=180.0)
    device_id: Optional[str] = Field(default=None, max_length=100)
    is_archived: bool = Field(default=False, description="Soft delete flag")

class FarmProfileCreate(FarmProfileBase):
    pass

class FarmProfileUpdate(BaseModel):
    farm_name: Optional[str] = Field(None, min_length=1, max_length=100)
    farm_size: Optional[float] = Field(None, gt=0)
    farm_unit: Optional[str] = Field(None, description="acres or hectares")
    number_of_fields: Optional[int] = Field(None, ge=1)
    crop_name: Optional[str] = Field(None, min_length=1, max_length=100)
    crop_variety: Optional[str] = Field(None, max_length=100)
    growth_stage: Optional[str] = Field(None, description="Seedling, Vegetative, Flowering, Fruiting, Harvesting")
    planting_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    irrigation_method: Optional[str] = Field(None, description="Drip, Sprinkler, Flood, Rainfed, Manual")
    water_source: Optional[str] = Field(None, description="Borewell, Canal, River, Pond, Tank, Rain Water")
    soil_type: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, min_length=1, max_length=100)
    district: Optional[str] = Field(None, min_length=1, max_length=100)
    mandal: Optional[str] = Field(None, max_length=100, description="Mandal / Taluka / Block")
    village: Optional[str] = Field(None, min_length=1, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    device_id: Optional[str] = Field(None, max_length=100)

class FarmProfileResponse(FarmProfileBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
