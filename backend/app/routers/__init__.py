# AgriShield Role-Based Routers Package
from backend.app.routers.common import auth, notifications, support, intelligence, devices, iot, ai, sync
from backend.app.routers.farmer import predict, farm_profiles, market, agrochemical, plant_id, analytics
from backend.app.routers.provider import equipment
from backend.app.routers.admin import admin, firmware

# Re-export widely used dependencies for backwards compatibility
from backend.app.routers.common.auth import get_current_user, decode_access_token
from backend.app.routers.common.notifications import ws_manager
