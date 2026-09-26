from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime

# --- Quiet Hours & Settings ---
class QuietHours(BaseModel):
    enabled: bool = Field(default=False)
    start: str = Field(default="22:00", description="HH:MM format")
    end: str = Field(default="06:00", description="HH:MM format")

class NotificationSettingsResponse(BaseModel):
    user_id: str
    disease_alerts: bool = True
    soil_alerts: bool = True
    weather_alerts: bool = True
    battery_alerts: bool = True
    device_alerts: bool = True
    recommendation_alerts: bool = True
    quiet_hours: QuietHours = Field(default_factory=QuietHours)

class NotificationSettingsUpdate(BaseModel):
    disease_alerts: Optional[bool] = None
    soil_alerts: Optional[bool] = None
    weather_alerts: Optional[bool] = None
    battery_alerts: Optional[bool] = None
    device_alerts: Optional[bool] = None
    recommendation_alerts: Optional[bool] = None
    quiet_hours: Optional[QuietHours] = None

# --- Notification Rules ---
class NotificationRuleCondition(BaseModel):
    field: str = Field(..., description="Field in telemetry (e.g. soil_moisture, temperature)")
    operator: str = Field(..., description="Operator (e.g. <, >, ==, >=, <=)")
    value: Any = Field(..., description="Value to compare against")

class NotificationRuleBase(BaseModel):
    rule_name: str = Field(..., max_length=150)
    enabled: bool = True
    category: str = Field(..., description="soil | weather | battery | device | disease | recommendation")
    conditions: List[NotificationRuleCondition]
    logic: str = Field(default="AND", description="AND | OR")
    priority: str = Field(default="Medium", description="Critical | High | Medium | Low | Info")
    title: str = Field(..., max_length=200)
    message_template: str
    cooldown_minutes: int = 60

class NotificationRuleCreate(NotificationRuleBase):
    pass

class NotificationRuleResponse(NotificationRuleBase):
    rule_id: str
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

# --- Scheduled Notifications ---
class ScheduledNotificationBase(BaseModel):
    title: str = Field(..., max_length=200)
    message: str
    schedule_type: str = Field(..., description="once | daily | weekly | monthly")
    schedule_time: str = Field(..., description="HH:MM format or cron string")
    enabled: bool = True
    category: str = Field(default="general")
    priority: str = Field(default="Medium")

class ScheduledNotificationCreate(ScheduledNotificationBase):
    pass

class ScheduledNotificationResponse(ScheduledNotificationBase):
    schedule_id: str
    user_id: str
    next_run: datetime
    last_run: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

# --- Notification Lifecycle & Timeline ---
class NotificationTimelineEvent(BaseModel):
    status: str = Field(..., description="created | delivered | opened | clicked | acknowledged | resolved | ignored")
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class NotificationLifecycle(BaseModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    ignored_at: Optional[datetime] = None

# --- Core Notification Models ---
class NotificationBase(BaseModel):
    title: str = Field(..., max_length=200)
    message: str
    category: str = Field(..., description="soil | weather | battery | device | disease | recommendation | system")
    priority: str = Field(default="Medium", description="Critical | High | Medium | Low | Info")
    device_id: Optional[str] = None
    farm_id: Optional[str] = None
    action_url: Optional[str] = None
    booking_id: Optional[str] = None
    confidence_score: Optional[float] = None

class NotificationCreate(NotificationBase):
    user_id: str

class NotificationResponse(NotificationBase):
    notification_id: str
    user_id: str
    status: str = "active"  # active | resolved | expired | acknowledged
    read: bool = False
    correlated_alert_ids: List[str] = Field(default_factory=list)
    correlation_root: bool = False
    lifecycle: NotificationLifecycle = Field(default_factory=NotificationLifecycle)
    timeline: List[NotificationTimelineEvent] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class NotificationHistoryResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    page: int
    pages: int

class NotificationAcknowledge(BaseModel):
    acknowledged_action: str = Field(default="Acknowledged by farmer")

class FCMTokenRegister(BaseModel):
    token: str
    device_type: str = "web"
