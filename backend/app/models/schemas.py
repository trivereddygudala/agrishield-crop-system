from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

# Canonical supported Indian regional languages + English (13 total)
SUPPORTED_LANGUAGE_CODES = {
    "en", "hi", "te", "ta", "kn", "ml", "mr", "gu", "pa", "bn", "ur", "or", "as"
}

class UserBase(BaseModel):
    name: str = Field(default="User", max_length=100)
    full_name: Optional[str] = Field(default=None, max_length=100)
    email: str = Field(..., min_length=2, max_length=120)
    role: str = Field(default="farmer")
    farm_location: Optional[str] = Field(default=None)
    preferred_language: Optional[str] = Field(default="en")
    preferred_languages: Optional[List[str]] = Field(default_factory=lambda: ["en"])
    farmer_mode: Optional[bool] = Field(default=False)
    crop_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    selected_crops: Optional[List[str]] = Field(default_factory=list)
    equipment_types: Optional[List[str]] = Field(default_factory=list)
    farming_practices: Optional[str] = Field(default="Conventional")
    farm_profile_completed: Optional[bool] = Field(default=False)
    active_farm_id: Optional[str] = Field(default=None)
    notification_settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    color_theme: Optional[str] = Field(default="agrishield-default")
    navbar_theme: Optional[str] = Field(default="farmer-dynamic")
    phone: Optional[str] = Field(default=None)
    mobile: Optional[str] = Field(default=None)
    provider_profile: Optional[Dict[str, Any]] = Field(default_factory=dict)
    farmer_profile: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @model_validator(mode='before')
    @classmethod
    def populate_name_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            resolved_name = data.get("name") or data.get("full_name") or data.get("username") or "User"
            data["name"] = resolved_name
            if not data.get("full_name"):
                data["full_name"] = resolved_name
            # Backward compatibility: populate preferred_languages if missing or empty
            raw_plangs = data.get("preferred_languages")
            raw_plang = data.get("preferred_language") or "en"
            if not raw_plangs or not isinstance(raw_plangs, list) or len(raw_plangs) == 0:
                data["preferred_languages"] = ["en"] if raw_plang == "en" else ["en", raw_plang]
            elif not data.get("preferred_language"):
                data["preferred_language"] = raw_plangs[0]
        return data

class UserRegister(UserBase):
    password: str = Field(..., min_length=4)
    bot_trap: Optional[str] = None

class UserLogin(BaseModel):
    email: str = Field(..., min_length=2, max_length=120)
    password: str
    remember_me: Optional[bool] = False
    bot_trap: Optional[str] = None

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
    preferred_languages: Optional[List[str]] = None
    farmer_mode: Optional[bool] = None
    crop_history: Optional[List[Dict[str, Any]]] = None
    selected_crops: Optional[List[str]] = None
    farming_practices: Optional[str] = None
    farm_profile_completed: Optional[bool] = None
    active_farm_id: Optional[str] = None
    notification_settings: Optional[Dict[str, Any]] = None
    color_theme: Optional[str] = None
    navbar_theme: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    provider_profile: Optional[Dict[str, Any]] = None
    farmer_profile: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(extra="ignore")

    @field_validator("preferred_language")
    @classmethod
    def validate_preferred_language(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = v.strip().lower()
        if clean not in SUPPORTED_LANGUAGE_CODES:
            sorted_codes = ", ".join(sorted(SUPPORTED_LANGUAGE_CODES))
            raise ValueError(f"Unsupported language code: '{v}'. Supported languages are: {sorted_codes}")
        return clean

    @field_validator("preferred_languages")
    @classmethod
    def validate_preferred_languages(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("preferred_languages must be a list of language codes.")
        if len(v) == 0:
            raise ValueError("preferred_languages cannot be empty. At least one language is required.")

        cleaned = []
        for item in v:
            if not isinstance(item, str) or not item.strip():
                raise ValueError("Each language code must be a non-empty string.")
            code = item.strip().lower()
            cleaned.append(code)

        # Check for duplicates
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Duplicate language codes are not allowed.")

        # Check maximum 3 entries
        if len(cleaned) > 3:
            raise ValueError("Maximum 3 preferred languages allowed.")

        # Supported languages check
        for code in cleaned:
            if code not in SUPPORTED_LANGUAGE_CODES:
                sorted_codes = ", ".join(sorted(SUPPORTED_LANGUAGE_CODES))
                raise ValueError(f"Unsupported language code: '{code}'. Supported languages are: {sorted_codes}")

        # English-first normalization rule:
        # English ('en') must always occupy index 0 as primary/default baseline.
        # Preserve user's regional selections in their relative order.
        regional_codes = [c for c in cleaned if c != "en"]
        if len(regional_codes) > 2:
            raise ValueError("English ('en') is required as the primary language and at most 2 regional languages can be selected.")

        normalized = ["en"] + regional_codes
        return normalized

    @model_validator(mode='after')
    def sync_language_fields(self):
        # Rule 3: When BOTH preferred_languages and preferred_language are supplied,
        # validate that the active language belongs to the normalized language pool.
        if self.preferred_languages is not None and self.preferred_language is not None:
            if self.preferred_language not in self.preferred_languages:
                raise ValueError(
                    f"Active language '{self.preferred_language}' must belong to the selected language pool: {self.preferred_languages}"
                )
        return self

# Prediction schemas
class PredictionBase(BaseModel):
    image_path: str
    image_data_url: Optional[str] = None
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
    ensemble_used: Optional[bool] = False
    ensemble_provider: Optional[str] = None
    ensemble_notes: Optional[str] = None
    multipart_scan_used: Optional[bool] = False

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
    plant_type: Optional[str] = Field(default="crop", description="Plant identification domain: 'crop' or 'tree'")
    tree_filter: Optional[str] = Field(default=None, description="Optional tree species category to filter identification search space")
    organ: Optional[str] = Field(default="leaf", description="Plant organ for identification: 'leaf', 'flower', 'fruit', or 'bark'")
    image_root_path: Optional[str] = Field(default=None, description="Optional path to root/collar photo for subterranean diseases")
    image_stem_path: Optional[str] = Field(default=None, description="Optional path to cut fruit/split stem photo for internal borers")
    wilt_condition: Optional[str] = Field(default=None, description="Wilt symptom: 'none', 'midday', or 'permanent'")
    soil_condition: Optional[str] = Field(default=None, description="Soil moisture: 'normal', 'waterlogged', or 'dry'")
    crop_stage: Optional[str] = Field(default=None, description="Crop stage: 'nursery', 'vegetative', 'flowering', 'mature'")
    image_data_url: Optional[str] = Field(default=None, description="Optional lightweight Plantix-style WebP thumbnail base64 data URL (<30KB) for permanent history retention")

class TranslatePlantRequest(BaseModel):
    plant: dict = Field(..., description="Plant botanical dictionary to translate")
    language: str = Field(default="en", description="Target language code (e.g. te, ta, hi, kn, ml, mr)")

class TranslateAgrochemicalRequest(BaseModel):
    agrochemical: dict = Field(..., description="Agrochemical data dictionary to translate")
    language: str = Field(default="en", description="Target language code (e.g. te, ta, hi, kn, ml, mr)")

class PredictBatchRequest(BaseModel):
    image_paths: List[str] = Field(..., min_length=1, max_length=10, description="List of image paths for multi-leaf field plot scan")
    sample_labels: Optional[List[str]] = Field(default_factory=list, description="Optional labels for samples like 'North-East Corner', 'Center Plot'")
    language: Optional[str] = Field(default="en", description="ISO language code (en, te, hi, ta, kn)")
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
