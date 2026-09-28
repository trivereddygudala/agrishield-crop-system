"""
AgriShield Canonical WebSocket Manager Re-Export

The canonical WebSocketManager implementation and active singleton are maintained
in backend.app.routers.common.notifications. Re-exported here to prevent duplicate
implementations and split-brain WebSocket connections.
"""
from backend.app.routers.common.notifications import WebSocketManager, ws_manager

__all__ = ["WebSocketManager", "ws_manager"]
