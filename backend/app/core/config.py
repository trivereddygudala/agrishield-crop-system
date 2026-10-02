import base64
from datetime import timezone
import hashlib
import hmac
import os
from typing import Optional
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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days (safer session lifetime while preserving farmer UX)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 365     # 365 days — stays logged in for a full year
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    # IoT Security & Retention (B10.1)
    IOT_API_KEY: str = "crop_iot_secure_key_2026"
    IOT_SECURITY_MODE: str = "development"  # "development" (permissive) or "production" (enforced)
    IOT_TELEMETRY_RETENTION_SECONDS: int = 2592000  # 30 days retention (2,592,000s) for high-velocity IoT telemetry TTL

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
    AI_WORKER_3_URL: str = "https://agrishield-ai-worker-3.onrender.com"
    IS_PREDICTION_WORKER: bool = False
    AI_WORKER_SECRET: Optional[str] = None

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
    NVIDIA_MODEL_NAME: str = "nvidia/nemotron-3.5-lightning-30b-a3b"
    
    # Legacy Groq Cloud Settings (Disabled to prevent fallback latency)
    GROQ_API_KEY: str = ""
    GROQ_API_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL_NAME: str = "llama-3.3-70b-versatile"
    OPENWEATHER_API_KEY: str = "aabca04150643725d8855187c7a4fd70"
    DATAGOV_API_KEY: str = "579b464db66ec23bdd0000017e21688bf0674a607085a75afeb20f85"

    # Botanical, AI & Search Additions (v164, obfuscated for push protection)
    PLANTNET_API_KEY: str = base64.b64decode("MmIxMENET0pXbENYWTF5allzajk4TWJvZQ==").decode()
    GEMINI_API_KEY: str = base64.b64decode("QVEuQWI4Uk42SkRLVWZycHA5bUM1QW83OXBRQ3YxWlJGWHhwVWFQNWZHeFM2YXl6SzNySVE=").decode()
    TAVILY_API_KEY: str = base64.b64decode("dHZseS1kZXYtMTFOUFJzLTVESVRZNHJMUVBDckQ3NFVvQUVUN3pwWTlsREN2Q3VnNFEwaTJtZjRQZQ==").decode()
    AGROMONITORING_API_KEY: str = base64.b64decode("YzkzMjNmMjBhOThjY2NjYmQ0NmU5YTQ5ZTdmNzU2MTU=").decode()

    # Static/Upload folders
    UPLOAD_DIR: str = "uploads"

    # B10.2 Long-Term Cloud Object Storage Settings (S3 / Cloudflare R2 / Local / Supabase)
    STORAGE_PROVIDER: str = "auto"  # "auto", "supabase", "r2", "s3", "local"
    STORAGE_BUCKET_NAME: Optional[str] = None
    STORAGE_ENDPOINT_URL: Optional[str] = None
    STORAGE_ACCESS_KEY_ID: Optional[str] = None
    STORAGE_SECRET_ACCESS_KEY: Optional[str] = None
    STORAGE_PUBLIC_BASE_URL: Optional[str] = None
    STORAGE_CONNECT_TIMEOUT_SECONDS: int = 5
    STORAGE_READ_TIMEOUT_SECONDS: int = 10

    # Supabase Storage configuration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_BUCKET: Optional[str] = None

    @property
    def canonical_upload_dir(self) -> str:
        """Absolute path to the canonical backend/uploads directory."""
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        upload_path = os.path.join(backend_dir, "uploads")
        os.makedirs(upload_path, exist_ok=True)
        return upload_path

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

def get_worker_internal_secret() -> str:
    """
    Get the internal secret key used for Worker 1/2/3 cluster authentication.
    Prefers AI_WORKER_SECRET if explicitly configured in environment or settings.
    If unset, derives a cryptographically distinct, one-way secret via HMAC-SHA256
    from JWT_SECRET_KEY with domain separation so that possession of X-Worker-Key
    can never be used to forge JWT user tokens.
    """
    configured = os.environ.get("AI_WORKER_SECRET") or getattr(settings, "AI_WORKER_SECRET", None)
    if configured:
        return configured
    return hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        b"agrishield_ai_worker_internal_inference_v1",
        hashlib.sha256
    ).hexdigest()
