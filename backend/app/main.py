import time
from datetime import timezone
import os
import logging
from contextlib import asynccontextmanager

APP_START_TIME = time.time()
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pymongo.errors import PyMongoError

from backend.app.core.exceptions import DatabaseUnavailableException
from backend.app.db.mongodb import connect_to_mongo, close_mongo_connection, db_instance
from backend.app.services.scheduler import start_scheduler, stop_scheduler
from backend.app.routers import auth, predict, ai, iot, devices, farm_profiles, notifications, analytics, intelligence, admin, firmware, support
from backend.app.core.security_middleware import SecurityHeadersMiddleware
from backend.app.core.request_id_middleware import RequestIdMiddleware, get_current_request_id
from backend.app.core.logging_sanitizer import install_credential_redaction_filter
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize credential redaction filters for zero-leak access logging
install_credential_redaction_filter()

# Define base directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
uploads_path = settings.canonical_upload_dir
os.makedirs(uploads_path, exist_ok=True)

def is_ai_worker_node() -> bool:
    """
    B11-F01: Architectural safeguard to identify if the current node is an AI worker.
    Ensures Worker 1, Worker 2, Worker 3 (and any future AI cluster nodes) never start
    the background scheduler or IoT device watchdog loops, preserving Main Gateway
    as the authoritative master.
    """
    if getattr(settings, "IS_PREDICTION_WORKER", False) or os.environ.get("IS_PREDICTION_WORKER", "").lower() == "true":
        return True
    if os.environ.get("DISABLE_SCHEDULER", "").lower() == "true":
        return True

    # Check Render service metadata
    service_name = (os.environ.get("RENDER_SERVICE_NAME", "") or os.environ.get("SERVICE_NAME", "")).lower()
    if "ai-worker" in service_name or "worker" in service_name:
        return True

    # Check external URLs / hostnames configured in Render or settings
    external_url = (
        os.environ.get("RENDER_EXTERNAL_URL", "") or 
        os.environ.get("RENDER_EXTERNAL_HOSTNAME", "") or 
        os.environ.get("EXTERNAL_URL", "")
    ).lower()
    if "ai-worker" in external_url or "worker" in external_url:
        return True

    worker_urls = [
        getattr(settings, "AI_WORKER_1_URL", ""),
        getattr(settings, "AI_WORKER_2_URL", ""),
        getattr(settings, "AI_WORKER_3_URL", "")
    ]
    for w_url in worker_urls:
        if w_url:
            clean = w_url.lower().replace("https://", "").replace("http://", "").rstrip("/")
            if clean and clean in external_url:
                return True

    return False

async def init_background_services():
    """Asynchronous background worker to initialize MongoDB and Scheduler without delaying port binding."""
    try:
        await connect_to_mongo()
        if db_instance.db is not None:
            is_prediction_worker = is_ai_worker_node()
            if not is_prediction_worker:
                start_scheduler(db_instance.db)
                print("🚀 [Startup] Background Scheduler initialized on Main Backend node.")
            else:
                print("ℹ️ [Startup] Dedicated AI Worker node: Background Scheduler omitted.")
            try:
                await db_instance.db["weather_cache"].delete_many({})
            except Exception:
                pass
            try:
                from backend.app.core.security_walls import sync_banned_ips_from_db
                await sync_banned_ips_from_db()
            except Exception as e:
                print(f"⚠️ [Startup] Security Walls sync notice: {e}")
            print("🚀 [Startup] MongoDB, Security Walls initialized successfully.")
    except Exception as e:
        print(f"⚠️ [Startup] MongoDB / Scheduler initialization notice: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Re-verify credential redaction filters after Uvicorn logger setup
    install_credential_redaction_filter()
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

# Global Database Availability & Internal Exception Handlers with Correlation IDs (B9.7)
@app.exception_handler(DatabaseUnavailableException)
async def database_unavailable_exception_handler(request: Request, exc: DatabaseUnavailableException):
    request_id = getattr(request.state, "request_id", "") or get_current_request_id()
    logger.error(f"[DB UNAVAILABLE] [{request_id}] {request.method} {request.url.path} - MongoDB error: {exc.__class__.__name__}")
    headers = {"Retry-After": "5"}
    if request_id:
        headers["X-Request-ID"] = request_id
    return JSONResponse(
        status_code=503,
        headers=headers,
        content={
            "status": "error",
            "code": "DATABASE_UNAVAILABLE",
            "detail": "Database service is temporarily unavailable. Please retry in a few moments.",
            "retry_after": 5,
            "request_id": request_id
        }
    )

@app.exception_handler(PyMongoError)
async def pymongo_error_exception_handler(request: Request, exc: PyMongoError):
    request_id = getattr(request.state, "request_id", "") or get_current_request_id()
    logger.error(f"[DB UNAVAILABLE] [{request_id}] {request.method} {request.url.path} - MongoDB error: {exc.__class__.__name__}")
    headers = {"Retry-After": "5"}
    if request_id:
        headers["X-Request-ID"] = request_id
    return JSONResponse(
        status_code=503,
        headers=headers,
        content={
            "status": "error",
            "code": "DATABASE_UNAVAILABLE",
            "detail": "Database service is temporarily unavailable. Please retry in a few moments.",
            "retry_after": 5,
            "request_id": request_id
        }
    )

@app.exception_handler(Exception)
async def generic_500_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "") or get_current_request_id()
    logger.error(f"[INTERNAL ERROR] [{request_id}] {request.method} {request.url.path} - {exc.__class__.__name__}: {str(exc)}", exc_info=True)
    headers = {}
    if request_id:
        headers["X-Request-ID"] = request_id
    return JSONResponse(
        status_code=500,
        headers=headers,
        content={
            "status": "error",
            "code": "INTERNAL_SERVER_ERROR",
            "detail": "An unexpected internal server error occurred.",
            "request_id": request_id
        }
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

app.add_middleware(RequestIdMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Serve uploads folder statically
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")

from backend.app.routers import auth, predict, ai, iot, devices, farm_profiles, notifications, analytics, intelligence, admin, firmware, market, support, equipment, plant_id, agrochemical, sync

# 1. Include core and AI routers
app.include_router(auth.router)
app.include_router(predict.router)
app.include_router(ai.router)
app.include_router(admin.router)

# 2. Include Hardware Integration, Farm Profiles & Support routers
app.include_router(iot.router)
app.include_router(devices.router)
if hasattr(devices, "devices_alias_router"):
    app.include_router(devices.devices_alias_router)
app.include_router(farm_profiles.router)
app.include_router(notifications.router)
app.include_router(analytics.router)
app.include_router(intelligence.router)
app.include_router(firmware.router)
app.include_router(support.router)

# 3. Dual-Mount Dedicated Domain Routers (/api/v1/* AND /api/*) for Zero-Error Compatibility
# Master Cross-Device Data Sync & Deletions Router
app.include_router(sync.router, prefix="/api/v1/sync")
app.include_router(sync.router, prefix="/api/sync")

# Equipment Rental & Booking Router
app.include_router(equipment.router, prefix="/api/v1/equipment")
app.include_router(equipment.router, prefix="/api/equipment")

# Agricultural Marketplace & Stores Router
app.include_router(market.router, prefix="/api/v1/market")
app.include_router(market.router, prefix="/api/market")

# Botanical Plant & Weed Identification Router
app.include_router(plant_id.router, prefix="/api/v1")
app.include_router(plant_id.router, prefix="/api")

# Agrochemical OCR Scanning, Comparison & Recommendation Router
app.include_router(agrochemical.router, prefix="/api/v1")
app.include_router(agrochemical.router, prefix="/api")

# Autonomous Root-Cause Analysis (RCA) & Diagnostics Sentinel Router
from backend.app.routers.common import diagnostics
app.include_router(diagnostics.router, prefix="/api/v1")
app.include_router(diagnostics.router, prefix="/api")

# Smart Farmer Action Center Router (B19)
from backend.app.routers.farmer import action_center
app.include_router(action_center.router, prefix="/api/v1/farmer/actions")
app.include_router(action_center.router, prefix="/api/farmer/actions")

# 3. Dynamic V1 Router construction mapping legacy routers to v1 paths
v1_router = APIRouter(prefix="/api/v1")


for router_module in [auth.router, predict.router, ai.router, farm_profiles.router, analytics.router, intelligence.router, admin.router, support.router]:
    for route in router_module.routes:
        path_v1 = route.path.replace("/api", "")
        response_model = getattr(route, "response_model", None)
        tags = getattr(route, "tags", [])
        summary = getattr(route, "summary", None)
        description = getattr(route, "description", None)
        dependencies = getattr(route, "dependencies", None)
        
        v1_router.add_api_route(
            path=path_v1,
            endpoint=route.endpoint,
            methods=route.methods,
            response_model=response_model,
            summary=summary,
            description=description,
            tags=tags,
            dependencies=dependencies
        )

app.include_router(v1_router)

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/api/v1/health", methods=["GET", "HEAD"])
async def root():
    """Welcome and health test endpoint for API and hardware nodes with diagnostic liveness (B9.7 & B11.5)."""
    from backend.app.services import scheduler
    is_db_connected = db_instance.db is not None
    sched_task = getattr(scheduler, "scheduler_task", None)
    watchdog_task = getattr(scheduler, "device_watchdog_task", None)

    scheduler_status = "running" if (sched_task is not None and not sched_task.done()) else "inactive"
    watchdog_status = "running" if (watchdog_task is not None and not watchdog_task.done()) else "inactive"
    service_role = "worker" if is_ai_worker_node() else "gateway"

    return {
        "status": "healthy" if is_db_connected else "degraded",
        "service": "AI Crop Disease Detection System API",
        "phase": 2,
        "docs": "/docs",
        "versioned_api": "/api/v1",
        "diagnostics": {
            "database": "connected" if is_db_connected else "disconnected",
            "scheduler": scheduler_status,
            "device_watchdog": watchdog_status,
            "service_role": service_role,
            "warmup_enabled": getattr(settings, "ENABLE_WARMUP_ENDPOINT", True),
            "process_uptime_seconds": round(time.time() - APP_START_TIME, 2)
        }
    }

@app.api_route("/health/warmup", methods=["GET", "HEAD"])
@app.api_route("/api/v1/health/warmup", methods=["GET", "HEAD"])
async def warmup_endpoint():
    """
    B11.5: Safe Render Free-tier warm-up / cold-start mitigation endpoint.
    Designed for lightweight inbound polling by external monitors/schedulers (e.g. cron-job.org).
    Does NOT execute AI inference, analytics, DB writes, or trigger background tasks.
    """
    if not getattr(settings, "ENABLE_WARMUP_ENDPOINT", True):
        return JSONResponse(
            status_code=404,
            content={
                "status": "disabled",
                "warmup": False,
                "detail": "Warmup endpoint is disabled in configuration."
            }
        )

    service_role = "worker" if is_ai_worker_node() else "gateway"
    is_db_connected = db_instance.db is not None
    uptime = round(time.time() - APP_START_TIME, 2)

    return {
        "status": "ok",
        "service": service_role,
        "warmup": True,
        "database": "connected" if is_db_connected else "disconnected",
        "process_uptime_seconds": uptime
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

@app.get("/cluster/status")
@app.get("/api/cluster/status")
@app.get("/api/v1/cluster/status")
async def cluster_status_endpoint():
    """Returns status of the distributed multi-account AI prediction cluster."""
    from backend.app.services.ai_cluster import ai_cluster
    nodes = ai_cluster.get_worker_nodes()
    is_worker = is_ai_worker_node()
    return {
        "role": "worker" if is_worker else "primary_load_balancer",
        "worker_nodes": nodes,
        "worker_count": len(nodes),
        "cluster_enabled": len(nodes) > 0 and not is_worker
    }
