from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    name: str = Field(default="User", max_length=100)
    full_name: Optional[str] = Field(default=None, max_length=100)
    email: str = Field(..., min_length=2, max_length=120)
    role: str = Field(default="farmer")
    farm_location: Optional[str] = Field(default=None)
    preferred_language: Optional[str] = Field(default="en")
    farmer_mode: Optional[bool] = Field(default=False)
    crop_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    farming_practices: Optional[str] = Field(default="Conventional")
    farm_profile_completed: Optional[bool] = Field(default=False)
    active_farm_id: Optional[str] = Field(default=None)
    notification_settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    color_theme: Optional[str] = Field(default="agrishield-default")
    navbar_theme: Optional[str] = Field(default="farmer-dynamic")

    @model_validator(mode='before')
    @classmethod
    def populate_name_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            resolved_name = data.get("name") or data.get("full_name") or data.get("username") or "User"
            data["name"] = resolved_name
            if not data.get("full_name"):
                data["full_name"] = resolved_name
        return data

class UserRegister(UserBase):
    password: str = Field(..., min_length=4)

class UserLogin(BaseModel):
    email: str = Field(..., min_length=2, max_length=120)
    password: str
    remember_me: Optional[bool] = False

class UserResponse(UserBase):
    id: str
    created_at: Optional[Any] = Field(default_factory=lambda: datetime.now())

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, arbitrary_types_allowed=True)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    farm_location: Optional[str] = None
    preferred_language: Optional[str] = None
    farmer_mode: Optional[bool] = None
    crop_history: Optional[List[Dict[str, Any]]] = None
    farming_practices: Optional[str] = None
    farm_profile_completed: Optional[bool] = None
    active_farm_id: Optional[str] = None
    notification_settings: Optional[Dict[str, Any]] = None
    color_theme: Optional[str] = None
    navbar_theme: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

# Prediction schemas
class PredictionBase(BaseModel):
    image_path: str
    crop_name: str
    disease_name: str
    confidence: float
    prediction_date: str
    prediction_time: str

class PredictionCreate(PredictionBase):
    user_id: str

class TopPrediction(BaseModel):
    class_name: str
    crop_name: str
    disease_name: str
    confidence: float

class PredictionResponse(PredictionBase):
    id: str
    prediction_status: str  # e.g., "healthy" or "diseased"
    created_at: datetime
    farmer_name: Optional[str] = None
    farmer_email: Optional[str] = None
    top_predictions: List[TopPrediction] = Field(default_factory=list)
    prediction_time_ms: float = 0.0
    gradcam_base64: Optional[str] = None
    heatmap_base64: Optional[str] = None
    comparison_base64: Optional[str] = None
    uncertainty_score: Optional[float] = 0.0
    disease_severity: Optional[str] = "Unknown"
    most_affected_region: Optional[str] = "None"
    possible_causes: List[str] = Field(default_factory=list)
    similar_diseases: List[str] = Field(default_factory=list)
    symptoms: Optional[str] = "None"
    disease_stage: Optional[str] = "Early"
    prevention_methods: List[str] = Field(default_factory=list)
    organic_treatment: Optional[str] = "None"
    chemical_treatment: Optional[str] = "None"
    recommended_pesticides: List[str] = Field(default_factory=list)
    recommended_fertilizers: List[str] = Field(default_factory=list)
    safety_precautions: Optional[str] = "None"
    estimated_recovery_probability: Optional[float] = 1.0
    recommended_follow_up_actions: List[str] = Field(default_factory=list)
    irrigation_suggestions: Optional[str] = "None"
    environmental_recommendations: Optional[str] = "None"
    advisor: Optional[Dict[str, Any]] = None
    disease_explanation: Optional[str] = None
    farmer_friendly_advice: Optional[str] = None
    prescription_calendar: Optional[List[Dict[str, Any]]] = None
    financial_metrics: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, extra="allow", arbitrary_types_allowed=True)

class PredictionHistoryResponse(BaseModel):
    predictions: List[PredictionResponse]
    total: int
    page: int
    pages: int

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, extra="allow", arbitrary_types_allowed=True)

class PredictRequest(BaseModel):
    image_path: str
    explainer_type: Optional[str] = Field(default="gradcam++", description="Visual explainer type: 'gradcam', 'gradcam++', or 'scorecam'")
    language: Optional[str] = Field(default="en", description="ISO language code for translated diagnosis output (en, hi, te, ta)")
    crop_filter: Optional[str] = Field(default=None, description="Optional crop category to filter prediction search space")

class CropAdvisorRequest(BaseModel):
    crop_name: str
    disease_name: str
    confidence: float
    prediction_status: Optional[str] = "diseased"
    uncertainty_score: Optional[float] = 0.0
    image_path: Optional[str] = None

# NVIDIA NIM Farming Assistant Schemas
class FarmingAssistantRequest(BaseModel):
    crop_name: str
    disease_name: str
    confidence: float
    language: Optional[str] = None

class FarmingAssistantResponse(BaseModel):
    disease_explanation: str
    possible_causes: List[str]
    severity: str
    organic_treatment: str
    chemical_treatment: str
    prevention_methods: List[str]
    best_farming_practices: List[str]
    farmer_friendly_advice: str

# Chat Interface Schemas
class ChatMessage(BaseModel):
    role: str # "user" or "assistant" or "system"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)
    language: Optional[str] = "en"
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional context like sensor data or recent predictions")
    image_base64: Optional[str] = Field(default=None, description="Optional base64-encoded leaf photo for in-chat diagnosis")
    image_url: Optional[str] = Field(default=None, description="Optional image URL or path for in-chat diagnosis")

class ChatResponse(BaseModel):
    reply: str

class AgrochemicalCompareRequest(BaseModel):
    product1: str
    product2: str

class ChatSessionMessage(BaseModel):
    id: float
    role: str
    content: str

class ChatSessionCreate(BaseModel):
    id: str
    title: str
    createdAt: str
    messages: List[ChatSessionMessage]

class ChatSessionUpdate(BaseModel):
    title: Optional[str] = None
    messages: Optional[List[ChatSessionMessage]] = None

class ChatSessionResponse(ChatSessionCreate):
    user_id: str
    db_created_at: datetime
    
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
