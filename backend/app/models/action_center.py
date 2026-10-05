from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field, ConfigDict


ActionType = Literal[
    "WATER",
    "INSPECT",
    "SPRAY",
    "FERTILIZE",
    "DISEASE_CHECK",
    "HARVEST",
    "BUY_INPUT",
    "PAYMENT",
    "EQUIPMENT",
    "MARKET",
    "DEVICE",
    "WEATHER",
    "CROP_TASK"
]

ActionPriority = Literal["P0", "P1", "P2", "P3"]
ActionStatus = Literal["pending", "completed", "dismissed", "delayed"]
OperatingMode = Literal["smart_iot", "software_ai"]


class FarmerActionItem(BaseModel):
    action_id: str = Field(..., description="Deterministic unique action identifier")
    action_type: ActionType = Field(..., description="Categorical action type")
    priority: ActionPriority = Field(..., description="P0 (Urgent), P1 (High), P2 (Normal), P3 (Info)")
    what: str = Field(..., description="Human-friendly action title")
    why: str = Field(..., description="Plain-language justification/reasoning")
    when: str = Field(..., description="Human-readable timing window or due description")
    due_date: Optional[str] = Field(None, description="ISO date YYYY-MM-DD")
    source: str = Field(..., description="Authoritative origin subsystem name")
    operating_mode: OperatingMode = Field(default="software_ai", description="smart_iot | software_ai")
    status: ActionStatus = Field(default="pending", description="pending | completed | dismissed | delayed")
    action_url: str = Field(..., description="Client navigation path")
    action_label: str = Field(..., description="Button call-to-action text")
    badge_text: Optional[str] = Field(None, description="Optional highlight badge text")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Domain-specific payload")

    model_config = ConfigDict(populate_by_name=True)


class FarmerActionsResponse(BaseModel):
    farm_id: Optional[str] = None
    farm_name: Optional[str] = None
    crop_name: Optional[str] = None
    operating_mode: OperatingMode = "software_ai"
    sensor_status: str = "not_connected"
    total_actions: int = 0
    urgent_count: int = 0  # P0
    high_count: int = 0    # P1
    actions: List[FarmerActionItem] = Field(default_factory=list)
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat() + "Z")

    model_config = ConfigDict(populate_by_name=True)


class ActionStatusUpdateResponse(BaseModel):
    status: str = "success"
    action_id: str
    new_status: ActionStatus
    message: str
