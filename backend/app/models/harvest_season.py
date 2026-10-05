from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime

# Standard supported units in Indian Agriculture
VALID_HARVEST_UNITS = [
    "kg",
    "quintal",
    "qtl",
    "tonne",
    "tonnes",
    "tons",
    "bags",
    "crates",
    "boxes"
]

# Units that can safely be normalized to quintals and kg without ambiguous assumptions
CONVERTIBLE_TO_QUINTAL = {
    "kg": 0.01,
    "kilogram": 0.01,
    "kilograms": 0.01,
    "quintal": 1.0,
    "quintals": 1.0,
    "qtl": 1.0,
    "tonne": 10.0,
    "tonnes": 10.0,
    "tons": 10.0,
    "ton": 10.0
}


def normalize_to_quintals(quantity: float, unit: str) -> Optional[float]:
    """Safely convert quantity to standard quintals if unit is convertible.

    Returns None if unit cannot safely be normalized (e.g. bags, crates).
    """
    if quantity is None or quantity <= 0:
        return None
    u = (unit or "").lower().strip()
    multiplier = CONVERTIBLE_TO_QUINTAL.get(u)
    if multiplier is not None:
        return round(float(quantity) * multiplier, 4)
    return None


class HarvestCreate(BaseModel):
    season_id: Optional[str] = Field(None, max_length=100, description="Target season ID. If omitted, uses active season.")
    harvest_date: str = Field(..., min_length=10, max_length=10, description="Harvest date in YYYY-MM-DD format")
    quantity: float = Field(..., gt=0, description="Harvested quantity (must be greater than 0)")
    unit: str = Field(..., min_length=1, max_length=30, description="Measurement unit (e.g. quintal, kg, tonne, crates, bags)")
    grade: Optional[str] = Field(None, max_length=50, description="Optional quality grade (e.g. Grade A, Standard, Export)")
    picking_number: Optional[int] = Field(None, ge=1, description="Picking sequence number (1, 2, 3...)")
    field_id: Optional[str] = Field(None, max_length=100, description="Field reference or identifier")
    variety: Optional[str] = Field(None, max_length=100, description="Crop variety")
    notes: Optional[str] = Field(None, max_length=500, description="Optional farmer observations")
    idempotency_key: Optional[str] = Field(None, max_length=100, description="Client idempotency key to prevent double submits")


class HarvestRecord(BaseModel):
    harvest_id: str
    season_id: str
    farm_id: str
    field_id: Optional[str] = None
    crop_name: str
    variety: Optional[str] = None
    harvest_date: str
    quantity: float
    unit: str
    normalized_quintals: Optional[float] = None
    grade: Optional[str] = None
    picking_number: Optional[int] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SaleCreate(BaseModel):
    season_id: Optional[str] = Field(None, max_length=100, description="Target season ID. If omitted, uses active season.")
    harvest_id: Optional[str] = Field(None, max_length=100, description="Optional reference to a specific harvest batch")
    sale_date: str = Field(..., min_length=10, max_length=10, description="Actual sale date in YYYY-MM-DD format")
    quantity_sold: float = Field(..., gt=0, description="Actual quantity sold (must be greater than 0)")
    unit: str = Field(..., min_length=1, max_length=30, description="Measurement unit (e.g. quintal, kg, crates)")
    price_per_unit: float = Field(..., ge=0, description="Actual realized price per unit (₹)")
    buyer: Optional[str] = Field(None, max_length=150, description="Trader, middleman, buyer, or entity name")
    mandi: Optional[str] = Field(None, max_length=150, description="APMC mandi or market yard name")
    field_id: Optional[str] = Field(None, max_length=100, description="Field reference or identifier")
    record_in_khata: bool = Field(default=False, description="Whether to explicitly log this sale as an income transaction in Farm Khata")
    notes: Optional[str] = Field(None, max_length=500, description="Optional transaction notes")
    idempotency_key: Optional[str] = Field(None, max_length=100, description="Client idempotency key to prevent duplicate sales/income")


class SaleRecord(BaseModel):
    sale_id: str
    season_id: str
    harvest_id: Optional[str] = None
    farm_id: str
    field_id: Optional[str] = None
    sale_date: str
    quantity_sold: float
    unit: str
    price_per_unit: float
    total_sale_value: float
    buyer: Optional[str] = None
    mandi: Optional[str] = None
    record_in_khata: bool = False
    khata_tx_id: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SeasonCreate(BaseModel):
    season_name: Optional[str] = Field(None, max_length=100, description="Name of season (e.g. Kharif 2026, Rabi 2026-27)")
    crop_name: str = Field(..., min_length=1, max_length=100, description="Crop name (e.g. Tomato, Rice, Chilli)")
    variety: Optional[str] = Field(None, max_length=100, description="Crop variety")
    field_id: Optional[str] = Field(None, max_length=100, description="Field identifier or number")
    area: float = Field(..., gt=0, description="Cultivated land area for this season")
    area_unit: str = Field(default="acres", max_length=30, description="Area unit (acres or hectares)")
    planting_date: Optional[str] = Field(None, description="Planting / sowing date in YYYY-MM-DD format")
    season_start_date: Optional[str] = Field(None, description="Season official start date in YYYY-MM-DD format")
    close_previous_active: bool = Field(default=True, description="Whether to safely close any currently active season before starting this one")


class SeasonCloseRequest(BaseModel):
    season_end_date: Optional[str] = Field(None, description="Season closure date in YYYY-MM-DD format")
    notes: Optional[str] = Field(None, max_length=500, description="Optional season conclusion notes")


class SeasonScorecardResponse(BaseModel):
    season_id: str
    farm_id: str
    season_name: str
    crop_name: str
    variety: Optional[str] = None
    historical_area: float
    area_unit: str
    planting_date: Optional[str] = None
    season_start_date: str
    season_end_date: Optional[str] = None
    status: str  # "active" | "closed"

    # Harvest Metrics
    total_harvest_records_count: int = 0
    total_harvest_quantity: Optional[float] = None
    total_harvest_quintals: Optional[float] = None
    harvest_status: str = "not_available"  # "actual" | "not_available"
    total_pickings_count: int = 0
    yield_per_acre_quintal: Optional[float] = None
    yield_per_acre_kg: Optional[float] = None
    yield_status: str = "not_available"  # "actual" | "not_available"

    # Financial Metrics
    actual_cultivation_cost: Optional[float] = None
    expense_status: str = "not_available"  # "actual" | "incomplete" | "not_available"
    actual_sales_income: Optional[float] = None
    revenue_status: str = "not_available"  # "actual" | "not_available"
    net_profit: Optional[float] = None
    profit_status: str = "not_available"  # "actual" | "not_available"
    cost_per_quintal: Optional[float] = None
    cost_per_quintal_status: str = "not_available"  # "actual" | "not_available"
    profit_per_acre: Optional[float] = None
    profit_per_acre_status: str = "not_available"  # "actual" | "not_available"
    actual_roi_percentage: Optional[float] = None
    roi_status: str = "not_available"  # "actual" | "not_available"

    # Summaries
    harvests_summary: List[Dict[str, Any]] = []
    sales_summary: List[Dict[str, Any]] = []

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class SeasonResponse(BaseModel):
    id: str
    season_id: str
    farm_id: str
    user_id: str
    season_name: str
    crop_name: str
    variety: Optional[str] = None
    field_id: Optional[str] = None
    area: float
    area_unit: str
    planting_date: Optional[str] = None
    season_start_date: str
    season_end_date: Optional[str] = None
    status: str  # "active" | "closed"
    harvests: List[Dict[str, Any]] = []
    sales: List[Dict[str, Any]] = []
    scorecard: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str
    closed_at: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
