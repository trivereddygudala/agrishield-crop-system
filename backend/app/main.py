from datetime import timezone
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.db.mongodb import connect_to_mongo, close_mongo_connection, db_instance
from backend.app.services.scheduler import start_scheduler, stop_scheduler
from backend.app.routers import auth, predict, ai, iot, devices, farm_profiles, notifications, analytics, intelligence, admin, firmware
from backend.app.core.security_middleware import SecurityHeadersMiddleware
from backend.app.core.config import settings

# Define base directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_path = os.path.join(BACKEND_DIR, "uploads")
os.makedirs(uploads_path, exist_ok=True)

async def init_background_services():
    """Asynchronous background worker to initialize MongoDB and Scheduler without delaying port binding."""
    try:
        await connect_to_mongo()
        if db_instance.db is not None:
            start_scheduler(db_instance.db)
            try:
                await db_instance.db["weather_cache"].delete_many({})
            except Exception:
                pass
            print("🚀 [Startup] MongoDB & Background Scheduler initialized successfully.")
    except Exception as e:
        print(f"⚠️ [Startup] MongoDB / Scheduler initialization notice: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events manager for FastAPI startup and shutdown."""
    import asyncio
    
    # 1. Spawn DB connection & scheduler in background task
    bg_task = asyncio.create_task(init_background_services())
    
    # 2. Start mDNS Auto-Discovery ONLY in local development (skip in Cloud/Render)
    zc = None
    zc_info = None
    is_cloud = bool(os.environ.get("RENDER") or os.environ.get("PORT") or settings.ENV.lower() == "production")
    if not is_cloud:
        try:
            import socket
            from zeroconf import ServiceInfo, Zeroconf
            zc = Zeroconf()
            ip = socket.gethostbyname(socket.gethostname())
            zc_info = ServiceInfo(
                "_http._tcp.local.",
                "agrishield-api._http._tcp.local.",
                addresses=[socket.inet_aton(ip)],
                port=8000,
                server="agrishield-api.local.",
            )
            zc.register_service(zc_info)
            print(f"\n🌐 [mDNS] Auto-Discovery Broadcasting on IP: {ip} as agrishield-api.local")
        except Exception as e:
            print(f"\n⚠️  [WARNING] mDNS Broadcaster skipped: {e}")
        
    # Yield immediately so Uvicorn binds and opens the HTTP port within 10 milliseconds
    yield
    
    # Shutdown mDNS
    if zc and zc_info:
        try:
            zc.unregister_service(zc_info)
            zc.close()
        except Exception:
            pass

    # Stop scheduler background task thread
    stop_scheduler()
    await close_mongo_connection()

app = FastAPI(
    title="AI-Based Crop Disease Detection System API",
    description="Backend services for user authentication, image upload, and AI crop disease diagnosis.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configurations
env_mode = settings.ENV.lower()
if env_mode == "production":
    origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1"
    ]

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if env_mode == "production" else [],
    allow_origin_regex=None if env_mode == "production" else ".*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Serve uploads folder statically
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")

from backend.app.routers import auth, predict, ai, iot, devices, farm_profiles, notifications, analytics, intelligence, admin, firmware, market

# 1. Include legacy routers for frontend backwards compatibility
app.include_router(auth.router)
app.include_router(predict.router)
app.include_router(ai.router)
app.include_router(admin.router)

# 2. Include new Batch 3 Hardware Integration & Market routers
app.include_router(iot.router)
app.include_router(devices.router)
app.include_router(farm_profiles.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(intelligence.router)
app.include_router(firmware.router)
app.include_router(market.router)

# 3. Dynamic V1 Router construction mapping legacy routers to v1 paths
v1_router = APIRouter(prefix="/api/v1")

for router_module in [auth.router, predict.router, ai.router, farm_profiles.router, analytics.router, intelligence.router, admin.router]:
    for route in router_module.routes:
        path_v1 = route.path.replace("/api", "")
        response_model = getattr(route, "response_model", None)
        tags = getattr(route, "tags", [])
        summary = getattr(route, "summary", None)
        description = getattr(route, "description", None)
        
        v1_router.add_api_route(
            path=path_v1,
            endpoint=route.endpoint,
            methods=route.methods,
            response_model=response_model,
            summary=summary,
            description=description,
            tags=tags
        )

app.include_router(v1_router)

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/api/v1/health", methods=["GET", "HEAD"])
async def root():
    """Welcome and health test endpoint for API and hardware nodes."""
    return {
        "status": "healthy",
        "service": "AI Crop Disease Detection System API",
        "phase": 2,
        "docs": "/docs",
        "versioned_api": "/api/v1"
    }

@app.get("/weather/current")
@app.get("/api/weather/current")
@app.get("/api/v1/weather/current")
async def current_weather_endpoint():
    """Live agricultural weather endpoint for frontend widgets."""
    try:
        from backend.app.services.weather_service import WeatherService
        data = await WeatherService.get_weather()
        if data and "main" in data:
            return data
        return {
            "main": {"temp": 28.0, "humidity": 65},
            "weather": [{"main": "Clear", "description": "clear sky"}],
            "wind": {"speed": 3.2}
        }
    except Exception:
        return {
            "main": {"temp": 28.0, "humidity": 65},
            "weather": [{"main": "Clear", "description": "clear sky"}],
            "wind": {"speed": 3.2}
        }
