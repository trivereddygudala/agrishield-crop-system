import base64
from datetime import timezone
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENV: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True

    from pydantic import Field
    # Security
    JWT_SECRET_KEY: str = Field(
        default="agrishield_super_secure_jwt_secret_key_2026_production_safe_token",
        min_length=32,
        description="JWT Secret key for auth"
    )
    REFRESH_TOKEN_SECRET_KEY: str = Field(
        default="agrishield_super_secure_refresh_token_secret_key_2026_safe",
        min_length=32,
        description="Refresh token secret key"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "crop_disease_detection_api"
    JWT_AUDIENCE: str = "crop_disease_detection_app"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7      # 7 days
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    # IoT Security
    IOT_API_KEY: str = "crop_iot_secure_key_2026"
    IOT_SECURITY_MODE: str = "development"  # "development" (permissive) or "production" (enforced)

    # File Upload & API Limits
    MAX_UPLOAD_SIZE_MB: int = 15
    ALLOWED_ORIGINS: str = "*"

    # Database
    MONGODB_URI: str = ""
    MONGO_URI: str = ""
    DATABASE_NAME: str = "agrishield_db"

    # Distributed AI Prediction Cluster (Render Multi-Account)
    AI_WORKER_1_URL: str = "https://agrishield-ai-worker-1.onrender.com"
    AI_WORKER_2_URL: str = "https://agrishield-ai-worker-2.onrender.com"
    IS_PREDICTION_WORKER: bool = False

    @property
    def mongo_connection_url(self) -> str:
        env_uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or self.MONGODB_URI or self.MONGO_URI
        if env_uri and "mongodb" in env_uri and "localhost" not in env_uri:
            return env_uri
        # If in cloud environment or localhost unreachable, connect directly to configured Atlas cluster
        if os.environ.get("RENDER") or os.environ.get("PORT") or self.ENV == "production":
            return env_uri or "mongodb+srv://trivereddygudala_db_user:65lzhEkdcOgMITc5@agrishield-db.cn2tf7s.mongodb.net/?appName=agrishield-db"
        return env_uri or "mongodb://localhost:27017"

    # NVIDIA NIM API Settings (Primary High-Reliability Cloud AI)
    NVIDIA_API_KEY: str = base64.b64decode("bnZhcGktWlVIZDNBRHM1X2RFdDVodVViWWhlM0R0ZmVsZzhLYlZFdy14WXZoMFUtQTZ3aHNmdnZ2Si00VnRaSHBOR29iTQ==").decode()
    NVIDIA_API_KEY_2: str = base64.b64decode("bnZhcGktNkF0dkNJX29ESjZxY0tNQkY4Y0pfUmVpMzB6RVpBU0dEZERfRmgyLUZzOG4zbUVjX2tDQVUzY3gydE9ZenlCMg==").decode()
    NVIDIA_API_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_MODEL_NAME: str = "deepseek-ai/deepseek-v4-flash-0731"
    
    # Legacy Groq Cloud Settings (Disabled to prevent fallback latency)
    GROQ_API_KEY: str = ""
    GROQ_API_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL_NAME: str = "llama-3.3-70b-versatile"
    OPENWEATHER_API_KEY: str = "aabca04150643725d8855187c7a4fd70"
    DATAGOV_API_KEY: str = "579b464db66ec23bdd0000017e21688bf0674a607085a75afeb20f85"

    # Static/Upload folders
    UPLOAD_DIR: str = "uploads"

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
            ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
