from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime

VALID_INVENTORY_CATEGORIES = [
    "seeds",
    "fertilizer",
    "pesticide",
    "irrigation",
    "tools",
    "machinery",
    "packaging",
    "other"
]

VALID_INVENTORY_UNITS = [
    "bags",
    "kg",
    "grams",
    "litres",
    "ml",
    "packets",
    "bottles",
    "crates",
    "pieces",
    "metres"
]

class InventoryUsageRecord(BaseModel):
    log_id: str
    date: str
    quantity_used: float = Field(..., gt=0)
    activity: Optional[str] = None
    field_id: Optional[str] = None
    crop_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: str

class InventoryItemCreate(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=150)
    category: str = Field(..., min_length=1, max_length=50)
    quantity: float = Field(..., ge=0)
    unit: str = Field(..., min_length=1, max_length=30)
    brand: Optional[str] = Field(None, max_length=100)
    active_ingredient: Optional[str] = Field(None, max_length=200)
    minimum_quantity: Optional[float] = Field(None, ge=0)
    purchase_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    expiry_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    batch_number: Optional[str] = Field(None, max_length=100)
    vendor: Optional[str] = Field(None, max_length=150)
    purchase_price: Optional[float] = Field(None, ge=0)
    field_id: Optional[str] = Field(None, max_length=100)
    crop_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)
    record_in_khata: bool = Field(default=False)
    khata_tx_id: Optional[str] = Field(None, max_length=100)

class InventoryItemUpdate(BaseModel):
    item_name: Optional[str] = Field(None, min_length=1, max_length=150)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    brand: Optional[str] = Field(None, max_length=100)
    active_ingredient: Optional[str] = Field(None, max_length=200)
    minimum_quantity: Optional[float] = Field(None, ge=0)
    expiry_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    batch_number: Optional[str] = Field(None, max_length=100)
    vendor: Optional[str] = Field(None, max_length=150)
    field_id: Optional[str] = Field(None, max_length=100)
    crop_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

class InventoryRestockCreate(BaseModel):
    quantity: float = Field(..., gt=0)
    purchase_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    purchase_price: Optional[float] = Field(None, ge=0)
    vendor: Optional[str] = Field(None, max_length=150)
    batch_number: Optional[str] = Field(None, max_length=100)
    expiry_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    notes: Optional[str] = Field(None, max_length=500)
    record_in_khata: bool = Field(default=False)

class InventoryUsageCreate(BaseModel):
    quantity_used: float = Field(..., gt=0)
    activity: Optional[str] = Field(None, max_length=150)
    field_id: Optional[str] = Field(None, max_length=100)
    crop_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

class InventoryAdjustCreate(BaseModel):
    new_quantity: float = Field(..., ge=0)
    reason: str = Field(..., min_length=1, max_length=200)
    notes: Optional[str] = Field(None, max_length=500)
