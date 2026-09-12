import logging
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from typing import List, Dict, Any, Tuple, Optional
import io
import csv

from backend.app.models.notification import (
    NotificationCreate, NotificationResponse, 
    NotificationSettingsResponse, QuietHours
)
from backend.app.core.templates import render_template
from backend.app.services.firebase_service import FirebaseService
from backend.app.services.nvidia_service import NVIDIAService

logger = logging.getLogger(__name__)

# Lazy loading connection manager to prevent circular imports
active_websocket_manager = None

class NotificationService:
    @staticmethod
    def register_websocket_manager(manager):
        global active_websocket_manager
        active_websocket_manager = manager

    @staticmethod
    async def check_duplicate(db, user_id: str, category: str, title: str, window_hours: int = 2) -> bool:
        """Checks if an identical notification was sent to this user within the cooldown window."""
        threshold = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        count = await db.notifications.count_documents({
            "user_id": user_id,
            "category": category,
            "title": title,
            "lifecycle.created_at": {"$gte": threshold}
        })
        return count > 0

    @staticmethod
    async def create_notification(
        db, 
        notification: NotificationCreate, 
        template_key: Optional[str] = None, 
        template_context: Optional[dict] = None
    ) -> Dict[str, Any]:
        """
        Creates, saves, and dispatches a notification:
        1. Query settings to check if category alert is enabled.
        2. Evaluate Quiet Hours (suppress normal priority warnings during quiet hours).
        3. Localize alert message via templates.
        4. (Optional) Enhance messages with NVIDIA Llama-generated agronomic recommendations.
        5. Push live WebSocket popup and update unread count.
        6. Dispatch FCM Push notification.
        """
        user_id = notification.user_id
        category = notification.category
        priority = notification.priority

        # 1. Fetch user notification preferences
        settings_doc = await db.notification_settings.find_one({"user_id": user_id})
        if not settings_doc:
            # Seed default preferences
            settings_doc = {
                "user_id": user_id,
                "disease_alerts": True,
                "soil_alerts": True,
                "weather_alerts": True,
                "battery_alerts": True,
                "device_alerts": True,
                "recommendation_alerts": True,
                "quiet_hours": {"enabled": False, "start": "22:00", "end": "06:00"}
            }
            await db.notification_settings.insert_one(settings_doc)

        # Check category toggle (System broadcasts bypass this)
        cat_lower = str(category or "").lower()
        if cat_lower != "system":
            cat_map = {
                "soil": "soil_alerts",
                "weather": "weather_alerts",
                "battery": "battery_alerts",
                "device": "device_alerts",
                "disease": "disease_alerts",
                "recommendation": "recommendation_alerts"
            }
            pref_field = cat_map.get(cat_lower, "disease_alerts")
            if not settings_doc.get(pref_field, True):
                logger.info(f"Notification category '{category}' disabled for user {user_id}. Skipping alert.")
                return {}

        # 2. Check Quiet Hours (High/Critical bypasses quiet hours)
        quiet_hours = settings_doc.get("quiet_hours", {})
        if quiet_hours.get("enabled", False) and priority not in ["Critical", "High", "Emergency"]:
            start_str = quiet_hours.get("start", "22:00")
            end_str = quiet_hours.get("end", "06:00")
            
            # Simple local time parsing check
            now = datetime.now()  # Context time
            current_time_str = now.strftime("%H:%M")
            
            is_in_quiet_hours = False
            if start_str <= end_str:
                is_in_quiet_hours = (start_str <= current_time_str <= end_str)
            else:  # Quiet hours cross midnight (e.g. 22:00 to 06:00)
                is_in_quiet_hours = (current_time_str >= start_str or current_time_str <= end_str)
                
            if is_in_quiet_hours:
                logger.info(f"Quiet hours active for user {user_id}. Non-critical alert '{notification.title}' suppressed.")
                return {}

        # Fetch user language preference safely
        user_doc = None
        if ObjectId.is_valid(user_id):
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        else:
            user_doc = await db.users.find_one({"$or": [{"id": user_id}, {"username": user_id}]})
        preferred_lang = user_doc.get("preferred_language", "en") if user_doc else "en"

        # 3. Localize alert message
        final_message = notification.message
        if template_key:
            ctx = template_context or {}
            ctx["message"] = notification.message
            final_message = render_template(template_key, preferred_lang, ctx)

        # 4. Asynchronously query NVIDIA Llama 3.1 for recommendations if enabled and LLM key is ready
        if category in ["soil", "disease"] and template_context:
            try:
                llama_service = NVIDIAService()
                ai_advice = await llama_service.generate_smart_alert_recommendation(
                    base_message=final_message,
                    category=category,
                    priority=priority,
                    lang=preferred_lang
                )
                if ai_advice:
                    final_message = f"{final_message} Recommendation: {ai_advice}"
            except Exception as e:
                logger.warning(f"Failed to fetch NVIDIA agronomist recommendations: {e}. Falling back to default localized template.")

        # Build notification document
        now_utc = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "farm_id": notification.farm_id,
            "device_id": notification.device_id,
            "title": notification.title,
            "message": final_message,
            "category": category,
            "priority": priority,
            "status": "active",
            "read": False,
            "confidence_score": notification.confidence_score or 0.9,
            "action_url": notification.action_url,
            "correlated_alert_ids": [],
            "correlation_root": False,
            "lifecycle": {
                "created_at": now_utc,
                "delivered_at": now_utc, # immediately delivered locally
                "opened_at": None,
                "clicked_at": None,
                "acknowledged_at": None,
                "resolved_at": None,
                "ignored_at": None
            },
            "timeline": [
                {
                    "status": "created",
                    "message": "Alert created in system.",
                    "timestamp": now_utc
                }
            ]
        }

        # Save to database
        result = await db.notifications.insert_one(doc)
        notification_id = str(result.inserted_id)
        doc["notification_id"] = notification_id
        if "_id" in doc:
            del doc["_id"]

        # 5. Live WebSocket Push
        if active_websocket_manager:
            try:
                # Broadcast live count and socket payload
                count = await NotificationService.get_unread_count(db, user_id)
                await active_websocket_manager.broadcast_to_user(user_id, {
                    "type": "new_notification",
                    "unread_count": count,
                    "notification": doc
                })
            except Exception as ws_err:
                logger.error(f"WebSocket notification broadcast error: {ws_err}")

        # 6. Dispatch FCM Push
        await FirebaseService.send_push_notification(
            db, 
            user_id=user_id, 
            title=notification.title, 
            body=final_message,
            data={
                "notification_id": notification_id,
                "category": category,
                "priority": priority,
                "action_url": notification.action_url or ""
            }
        )

        return doc

    @staticmethod
    async def get_notifications(
        db, 
        user_id: str, 
        limit: int = 50, 
        page: int = 1, 
        category: Optional[str] = None, 
        priority: Optional[str] = None,
        unread_only: bool = False
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Fetch paginated notification logs for user."""
        query = {"user_id": user_id}
        
        if category:
            query["category"] = category
        if priority:
            query["priority"] = priority
        if unread_only:
            query["read"] = False
            
        total = await db.notifications.count_documents(query)
        skip = (page - 1) * limit
        
        cursor = db.notifications.find(query).sort("lifecycle.created_at", -1).skip(skip).limit(limit)
        records = await cursor.to_list(length=limit)
        
        for r in records:
            r["notification_id"] = str(r["_id"])
            if "_id" in r:
                del r["_id"]
                
        return records, total

    @staticmethod
    async def get_unread_notifications(db, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch unread alerts list."""
        cursor = db.notifications.find({"user_id": user_id, "read": False}).sort("lifecycle.created_at", -1).limit(limit)
        records = await cursor.to_list(length=limit)
        for r in records:
            r["notification_id"] = str(r["_id"])
            if "_id" in r:
                del r["_id"]
        return records

    @staticmethod
    def _build_id_query(notification_id: str, user_id: str) -> dict:
        """Builds a flexible query supporting both MongoDB ObjectId and string IDs (e.g. GEN-*, SIM-*)."""
        base = {"user_id": user_id}
        if ObjectId.is_valid(notification_id):
            base["$or"] = [
                {"_id": ObjectId(notification_id)},
                {"notification_id": notification_id},
                {"id": notification_id}
            ]
        else:
            base["$or"] = [
                {"notification_id": notification_id},
                {"id": notification_id},
                {"_id": notification_id}
            ]
        return base

    @staticmethod
    async def mark_as_read(db, notification_id: str, user_id: str) -> bool:
        """Mark notification as read and register action opened."""
        try:
            now_utc = datetime.now(timezone.utc)
            query = NotificationService._build_id_query(notification_id, user_id)
            result = await db.notifications.update_one(
                query,
                {
                    "$set": {
                        "read": True,
                        "lifecycle.opened_at": now_utc,
                        "lifecycle.clicked_at": now_utc
                    },
                    "$push": {
                        "timeline": {
                            "status": "opened",
                            "message": "Alert opened and marked read.",
                            "timestamp": now_utc
                        }
                    }
                }
            )
            
            # Send live WebSocket update to update notification badges
            if result.modified_count > 0 and active_websocket_manager:
                count = await NotificationService.get_unread_count(db, user_id)
                await active_websocket_manager.broadcast_to_user(user_id, {
                    "type": "unread_count_update",
                    "unread_count": count
                })
                
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error marking notification read: {str(e)}")
            return False

    @staticmethod
    async def mark_all_read(db, user_id: str) -> int:
        """Mark all notifications of the user as read."""
        now_utc = datetime.now(timezone.utc)
        result = await db.notifications.update_many(
            {"user_id": user_id, "read": False},
            {
                "$set": {
                    "read": True,
                    "lifecycle.opened_at": now_utc
                },
                "$push": {
                    "timeline": {
                        "status": "opened",
                        "message": "Alert marked read via bulk read-all.",
                        "timestamp": now_utc
                    }
                }
            }
        )
        if result.modified_count > 0 and active_websocket_manager:
            await active_websocket_manager.broadcast_to_user(user_id, {
                "type": "unread_count_update",
                "unread_count": 0
            })
        return result.modified_count

    @staticmethod
    async def acknowledge_notification(db, notification_id: str, user_id: str, action_taken: str) -> bool:
        """Acknowledge an active notification alert."""
        try:
            now_utc = datetime.now(timezone.utc)
            query = NotificationService._build_id_query(notification_id, user_id)
            result = await db.notifications.update_one(
                query,
                {
                    "$set": {
                        "status": "acknowledged",
                        "read": True,
                        "acknowledged_by": user_id,
                        "acknowledged_time": now_utc,
                        "lifecycle.acknowledged_at": now_utc
                    },
                    "$push": {
                        "timeline": {
                            "status": "acknowledged",
                            "message": f"Alert acknowledged. Action taken: {action_taken}",
                            "timestamp": now_utc
                        }
                    }
                }
            )
            
            if result.modified_count > 0 and active_websocket_manager:
                count = await NotificationService.get_unread_count(db, user_id)
                await active_websocket_manager.broadcast_to_user(user_id, {
                    "type": "unread_count_update",
                    "unread_count": count
                })
                
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error acknowledging notification: {e}")
            return False

    @staticmethod
    async def delete_notification(db, notification_id: str, user_id: str) -> bool:
        """Delete notification log."""
        try:
            query = NotificationService._build_id_query(notification_id, user_id)
            result = await db.notifications.delete_one(query)
            if result.deleted_count > 0 and active_websocket_manager:
                count = await NotificationService.get_unread_count(db, user_id)
                await active_websocket_manager.broadcast_to_user(user_id, {
                    "type": "unread_count_update",
                    "unread_count": count
                })
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting notification: {str(e)}")
            return False

    @staticmethod
    async def clear_all_notifications(db, user_id: str) -> int:
        """Delete all notifications of user."""
        result = await db.notifications.delete_many({"user_id": user_id})
        if result.deleted_count > 0 and active_websocket_manager:
            await active_websocket_manager.broadcast_to_user(user_id, {
                "type": "unread_count_update",
                "unread_count": 0
            })
        return result.deleted_count

    @staticmethod
    async def get_unread_count(db, user_id: str) -> int:
        """Return count of unread notifications."""
        return await db.notifications.count_documents({"user_id": user_id, "read": False})

    @staticmethod
    async def get_notification_settings(db, user_id: str) -> Dict[str, Any]:
        """Fetch notification settings preferences for user."""
        doc = await db.notification_settings.find_one({"user_id": user_id})
        if not doc:
            # Default fallback preferences
            doc = {
                "user_id": user_id,
                "disease_alerts": True,
                "soil_alerts": True,
                "weather_alerts": True,
                "battery_alerts": True,
                "device_alerts": True,
                "recommendation_alerts": True,
                "quiet_hours": {"enabled": False, "start": "22:00", "end": "06:00"}
            }
            await db.notification_settings.insert_one(doc)
        
        # Convert objectId if exists
        if "_id" in doc:
            del doc["_id"]
        return doc

    @staticmethod
    async def update_notification_settings(db, user_id: str, settings: Dict[str, Any]) -> bool:
        """Update notification settings preferences."""
        try:
            # Strip _id from updates
            settings.pop("_id", None)
            settings.pop("user_id", None)
            
            await db.notification_settings.update_one(
                {"user_id": user_id},
                {"$set": settings},
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Error updating settings preferences: {e}")
            return False

    @staticmethod
    async def get_notification_analytics(db, user_id: str) -> Dict[str, Any]:
        """Calculate aggregated analytics metrics and Platform Health Score."""
        try:
            # Basic KPI sums
            total_count = await db.notifications.count_documents({"user_id": user_id})
            active_count = await db.notifications.count_documents({"user_id": user_id, "status": "active"})
            resolved_count = await db.notifications.count_documents({"user_id": user_id, "status": "resolved"})
            acknowledged_count = await db.notifications.count_documents({"user_id": user_id, "status": "acknowledged"})
            
            # Ignite categories aggregations
            categories = ["soil", "weather", "battery", "device", "disease", "recommendation"]
            by_category = {}
            for cat in categories:
                by_category[cat] = await db.notifications.count_documents({"user_id": user_id, "category": cat})

            # Ignite priorities aggregations
            priorities = ["Critical", "High", "Medium", "Low", "Info"]
            by_priority = {}
            for pri in priorities:
                by_priority[pri] = await db.notifications.count_documents({"user_id": user_id, "priority": pri})

            # Average response time calculations
            cursor = db.notifications.find({
                "user_id": user_id,
                "status": {"$in": ["acknowledged", "resolved"]},
                "lifecycle.acknowledged_at": {"$ne": None}
            })
            responded_alerts = await cursor.to_list(length=100)
            
            response_times = []
            for a in responded_alerts:
                created = a["lifecycle"]["created_at"]
                ack = a["lifecycle"].get("acknowledged_at") or a["lifecycle"].get("resolved_at")
                if ack and created:
                    diff = (ack - created).total_seconds() / 60.0  # in minutes
                    response_times.append(diff)
                    
            avg_response_min = sum(response_times) / len(response_times) if response_times else 0.0

            # Calculate Ignored count (unread alerts older than 24 hours)
            threshold = datetime.now(timezone.utc) - timedelta(hours=24)
            ignored_count = await db.notifications.count_documents({
                "user_id": user_id,
                "read": False,
                "lifecycle.created_at": {"$lt": threshold}
            })

            # Platform Effectiveness Health Score Calculator
            # Formula checks ratios of resolved and response speed
            ignored_percentage = (ignored_count / total_count * 100) if total_count > 0 else 0
            acknowledgement_rate = (acknowledged_count / total_count * 100) if total_count > 0 else 100
            
            health_score_label = "Excellent"
            if ignored_percentage > 50 or avg_response_min > 360:
                health_score_label = "Poor"
            elif ignored_percentage > 25 or avg_response_min > 120:
                health_score_label = "Fair"
            elif ignored_percentage > 10 or avg_response_min > 30:
                health_score_label = "Good"

            return {
                "total_alerts": total_count,
                "active_alerts": active_count,
                "resolved_alerts": resolved_count,
                "acknowledged_alerts": acknowledged_count,
                "ignored_alerts": ignored_count,
                "ignored_percentage": round(ignored_percentage, 1),
                "acknowledgement_rate": round(acknowledgement_rate, 1),
                "avg_response_minutes": round(avg_response_min, 1),
                "health_score": health_score_label,
                "by_category": by_category,
                "by_priority": by_priority
            }
        except Exception as e:
            logger.error(f"Error compiling notification analytics: {e}")
            return {}

    @staticmethod
    async def export_notifications(
        db, 
        user_id: str, 
        category: Optional[str] = None, 
        priority: Optional[str] = None
    ) -> str:
        """Generates CSV content of historical notification logs."""
        try:
            query = {"user_id": user_id}
            if category: query["category"] = category
            if priority: query["priority"] = priority
            
            cursor = db.notifications.find(query).sort("lifecycle.created_at", -1)
            records = await cursor.to_list(length=1000)
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header Row
            writer.writerow(["ID", "Title", "Message", "Category", "Priority", "Status", "Read Status", "Created Time", "Acknowledged Time", "Resolution Time"])
            
            for r in records:
                lifecycle = r.get("lifecycle", {})
                created = lifecycle.get("created_at")
                ack = lifecycle.get("acknowledged_at")
                resolved = lifecycle.get("resolved_at")
                
                writer.writerow([
                    str(r["_id"]),
                    r.get("title", ""),
                    r.get("message", ""),
                    r.get("category", ""),
                    r.get("priority", ""),
                    r.get("status", "active"),
                    "Read" if r.get("read", False) else "Unread",
                    created.strftime("%Y-%m-%d %H:%M:%S") if created else "",
                    ack.strftime("%Y-%m-%d %H:%M:%S") if ack else "N/A",
                    resolved.strftime("%Y-%m-%d %H:%M:%S") if resolved else "N/A"
                ])
                
            return output.getvalue()
        except Exception as e:
            logger.error(f"Error exporting CSV: {e}")
            return "Error exporting notifications logs."
