import logging
from datetime import datetime, timedelta, timezone, time
import zoneinfo
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

# Application configured timezone for quiet hours evaluation
APP_TIMEZONE = zoneinfo.ZoneInfo("Asia/Kolkata")

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
        cat_match = {"$in": [category, category.lower(), category.capitalize(), category.upper()]} if isinstance(category, str) else category
        count = await db.notifications.count_documents({
            "user_id": user_id,
            "category": cat_match,
            "title": title,
            "created_at": {"$gte": threshold}
        })
        if count == 0:
            count = await db.notifications.count_documents({
                "user_id": user_id,
                "category": cat_match,
                "title": title,
                "lifecycle.created_at": {"$gte": threshold}
            })
        return count > 0

    @staticmethod
    async def trigger_weather_advisory(
        db,
        user_id: str,
        weather_data: Dict[str, Any],
        farm_id: Optional[str] = None,
        device_id: Optional[str] = None,
        override_priority: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        B21 Smart Farm Alert Intelligence: Evaluates authoritative weather data against
        severe advisory thresholds (rain probability > 80%, heatwave > 38°C) and dispatches
        actionable, quiet-hours aware, deduplicated farmer notifications.
        Deduplication window: 12 hours.
        Action URL: /farm?tab=farm-intelligence
        """
        if not weather_data or not user_id:
            return []

        advisories = []
        current = weather_data.get("current") if isinstance(weather_data.get("current"), dict) else weather_data

        # 1. Rain probability evaluation (>80%)
        rain_prob = current.get("rain_probability")
        if rain_prob is None:
            rain_prob = current.get("pop")
            if rain_prob is not None and isinstance(rain_prob, (int, float)) and rain_prob <= 1.0:
                rain_prob = rain_prob * 100

        # Also inspect forecast items if current rain probability is not severe
        if (rain_prob is None or float(rain_prob) <= 80) and isinstance(weather_data.get("forecast"), list):
            for fc in weather_data.get("forecast", []):
                if isinstance(fc, dict):
                    f_prob = fc.get("rain_probability")
                    if f_prob is None:
                        f_prob = fc.get("pop")
                        if f_prob is not None and isinstance(f_prob, (int, float)) and f_prob <= 1.0:
                            f_prob = f_prob * 100
                    if f_prob is not None and float(f_prob) > 80:
                        rain_prob = f_prob
                        break

        if rain_prob is not None and float(rain_prob) > 80:
            rain_priority = override_priority if override_priority is not None else "High"
            advisories.append({
                "title": "Heavy Rain Expected",
                "message": "Heavy rain is expected soon. Consider delaying irrigation or foliar spraying.",
                "priority": rain_priority
            })

        # 2. Temperature / Heatwave evaluation (>38°C)
        temp = current.get("temperature")
        if temp is None:
            temp = current.get("temp")

        if temp is not None and float(temp) > 38.0:
            heat_priority = override_priority if override_priority is not None else "Medium"
            advisories.append({
                "title": "High Heat Advisory",
                "message": "High temperatures are expected. Check your crop and irrigation plan.",
                "priority": heat_priority
            })

        created_results = []
        for adv in advisories:
            adv_title = adv["title"]
            adv_message = adv["message"]
            adv_priority = adv["priority"]

            # 12-hour deduplication window per advisory type and user
            is_dup = await NotificationService.check_duplicate(
                db, user_id=user_id, category="weather", title=adv_title, window_hours=12
            )
            if is_dup:
                logger.info(f"Weather advisory '{adv_title}' deduplicated for user {user_id} within 12h cooldown window.")
                continue

            notif_create = NotificationCreate(
                user_id=user_id,
                title=adv_title,
                message=adv_message,
                category="weather",
                priority=adv_priority,
                action_url="/farm?tab=farm-intelligence",
                farm_id=farm_id,
                device_id=device_id
            )
            created = await NotificationService.create_notification(db, notif_create)
            if created and isinstance(created, dict) and created.get("notification_id"):
                created_results.append(created)

        return created_results

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
        if cat_lower not in ["system", "booking", "support", "machinery_listing", "equipment", "chat", "message", "fleet", "broadcast"]:
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
            start_str = str(quiet_hours.get("start", "22:00") or "22:00").strip()
            end_str = str(quiet_hours.get("end", "06:00") or "06:00").strip()
            
            # Evaluate using application configured timezone (Asia/Kolkata)
            now = datetime.now(APP_TIMEZONE)
            current_time = now.time()

            def _parse_time(t_str: str, default_h: int, default_m: int) -> time:
                for fmt in ("%H:%M", "%H:%M:%S"):
                    try:
                        return datetime.strptime(t_str, fmt).time()
                    except (ValueError, TypeError):
                        pass
                return time(default_h, default_m)

            start_time = _parse_time(start_str, 22, 0)
            end_time = _parse_time(end_str, 6, 0)
            
            is_in_quiet_hours = False
            if start_time <= end_time:
                is_in_quiet_hours = (start_time <= current_time <= end_time)
            else:  # Quiet hours cross midnight (e.g. 22:00 to 06:00)
                is_in_quiet_hours = (current_time >= start_time or current_time <= end_time)
                
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

        # 3. Localize alert message & title
        original_title = notification.title
        original_message = notification.message
        source_lang = getattr(notification, "source_language", "en") or "en"
        translations = dict(getattr(notification, "translations", {}) or {})

        final_title = original_title
        final_message = notification.message
        if template_key:
            ctx = template_context or {}
            ctx["message"] = notification.message
            final_message = render_template(template_key, preferred_lang, ctx)
        elif preferred_lang in translations and isinstance(translations[preferred_lang], dict):
            final_title = translations[preferred_lang].get("title", original_title)
            final_message = translations[preferred_lang].get("message", original_message)
        elif preferred_lang != source_lang and preferred_lang != "en":
            try:
                from backend.app.services.translation_service import TranslationService
                final_title = await TranslationService.translate_text(
                    original_title, preferred_lang, source_lang=source_lang, db=db
                )
                final_message = await TranslationService.translate_text(
                    notification.message, preferred_lang, source_lang=source_lang, db=db
                )
                translations[preferred_lang] = {
                    "title": final_title,
                    "message": final_message
                }
            except Exception as tr_err:
                logger.debug(f"Notification translation notice: {tr_err}")

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
            "title": original_title,
            "message": original_message,
            "original_title": original_title,
            "original_message": original_message,
            "source_language": source_lang,
            "translations": translations,
            "category": category,
            "priority": priority,
            "status": "active",
            "created_at": now_utc,
            "read": False,
            "confidence_score": notification.confidence_score or 0.9,
            "action_url": notification.action_url,
            "booking_id": getattr(notification, "booking_id", None),
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
                # Derive recipient role from already-fetched user_doc for role-aware unread count (ISSUE-03)
                recipient_role = user_doc.get("role") if user_doc else None
                count = await NotificationService.get_unread_count(db, user_id, role=recipient_role)
                ws_notification = dict(doc)
                if preferred_lang in translations:
                    ws_notification["translated_title"] = translations[preferred_lang].get("title", original_title)
                    ws_notification["translated_message"] = translations[preferred_lang].get("message", original_message)
                    ws_notification["title"] = ws_notification["translated_title"]
                    ws_notification["message"] = ws_notification["translated_message"]
                elif final_title != original_title or final_message != original_message:
                    ws_notification["title"] = final_title
                    ws_notification["message"] = final_message
                await active_websocket_manager.broadcast_to_user(user_id, {
                    "type": "new_notification",
                    "unread_count": count,
                    "notification": ws_notification
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
    async def create_broadcast_notifications(
        db,
        recipients: List[Dict[str, Any]],
        title: str,
        message: str,
        translations: Optional[Dict[str, Dict[str, str]]] = None,
        priority: str = "High",
        action_url: str = "/dashboard",
        batch_size: int = 500,
        broadcast_id: Optional[str] = None,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        B6-P7-03 Optimized Fanout Helper:
        Persists broadcast notifications to MongoDB in bounded batches using insert_many,
        preserving translations, action URLs, and role-aware unread counts without
        redundant per-recipient user/settings database queries.
        Includes resume deduplication by checking existing broadcast_id records.
        """
        if not recipients:
            return {"persisted_count": 0, "total_recipients": 0, "status": "success"}

        translations_bundle = dict(translations or {})
        now_utc = datetime.now(timezone.utc)

        # Check already delivered users for this broadcast (handles safe resume after crash)
        already_delivered_users = set()
        if broadcast_id:
            cursor = db.notifications.find({"broadcast_id": broadcast_id}, {"user_id": 1})
            existing_docs = await cursor.to_list(length=10000)
            already_delivered_users = {d["user_id"] for d in existing_docs if "user_id" in d}

        docs = []
        for r in recipients:
            uid_str = str(r.get("user_id") or r.get("_id") or r.get("id"))
            if uid_str in already_delivered_users:
                continue

            doc = {
                "user_id": uid_str,
                "broadcast_id": broadcast_id,
                "idempotency_key": idempotency_key,
                "farm_id": None,
                "device_id": None,
                "title": title,
                "message": message,
                "original_title": title,
                "original_message": message,
                "source_language": "en",
                "translations": translations_bundle,
                "category": "broadcast",
                "priority": priority,
                "status": "active",
                "read": False,
                "confidence_score": 0.9,
                "action_url": action_url or "/dashboard",
                "booking_id": None,
                "correlated_alert_ids": [],
                "correlation_root": False,
                "lifecycle": {
                    "created_at": now_utc,
                    "delivered_at": now_utc,
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
            docs.append(doc)

        persisted_count = len(already_delivered_users)
        persisted_records = []

        # Bounded batch persistence using insert_many
        if docs:
            for i in range(0, len(docs), batch_size):
                batch = docs[i : i + batch_size]
                try:
                    result = await db.notifications.insert_many(batch, ordered=False)
                    batch_inserted_ids = getattr(result, "inserted_ids", [])
                except Exception as insert_err:
                    from pymongo.errors import BulkWriteError
                    if isinstance(insert_err, BulkWriteError):
                        # With ordered=False, extract successful inserted IDs if any
                        batch_inserted_ids = []
                    else:
                        raise insert_err

                for idx, doc_item in enumerate(batch):
                    doc_copy = dict(doc_item)
                    if idx < len(batch_inserted_ids):
                        doc_copy["notification_id"] = str(batch_inserted_ids[idx])
                    if "_id" in doc_copy:
                        del doc_copy["_id"]
                    persisted_records.append(doc_copy)
                persisted_count += len(batch_inserted_ids)

        # Real-time WebSocket delivery for users with active connections
        if active_websocket_manager and persisted_records:
            active_conns = getattr(active_websocket_manager, "active_connections", None)
            for prec in persisted_records:
                prec_uid = prec["user_id"]
                # Skip unread-count DB query and dispatch for offline recipients
                if active_conns is not None and prec_uid not in active_conns:
                    continue

                try:
                    rec_info = next((r for r in recipients if str(r.get("user_id") or r.get("_id") or r.get("id")) == prec_uid), {})
                    recipient_role = rec_info.get("role")
                    preferred_lang = rec_info.get("preferred_language", "en") or "en"

                    count = await NotificationService.get_unread_count(db, prec_uid, role=recipient_role)
                    ws_notification = dict(prec)
                    if preferred_lang in translations_bundle and isinstance(translations_bundle[preferred_lang], dict):
                        ws_notification["translated_title"] = translations_bundle[preferred_lang].get("title", title)
                        ws_notification["translated_message"] = translations_bundle[preferred_lang].get("message", message)
                        ws_notification["title"] = ws_notification["translated_title"]
                        ws_notification["message"] = ws_notification["translated_message"]

                    await active_websocket_manager.broadcast_to_user(prec_uid, {
                        "type": "new_notification",
                        "unread_count": count,
                        "notification": ws_notification
                    })
                except Exception as ws_err:
                    logger.error(f"WebSocket broadcast error for user {prec_uid}: {ws_err}")

        # Batch FCM Token Lookup & Dispatch
        try:
            recipient_uids = [r["user_id"] for r in persisted_records]
            if recipient_uids:
                fcm_cursor = db.fcm_tokens.find({"user_id": {"$in": recipient_uids}})
                fcm_docs = await fcm_cursor.to_list(length=max(100, len(recipient_uids) * 2))
                uids_with_tokens = {d.get("user_id") for d in fcm_docs if d.get("token")}
                for prec in persisted_records:
                    if prec["user_id"] in uids_with_tokens:
                        rec_info = next((r for r in recipients if str(r.get("user_id") or r.get("_id") or r.get("id")) == prec["user_id"]), {})
                        preferred_lang = rec_info.get("preferred_language", "en") or "en"
                        final_msg = message
                        if preferred_lang in translations_bundle and isinstance(translations_bundle[preferred_lang], dict):
                            final_msg = translations_bundle[preferred_lang].get("message", message)
                        await FirebaseService.send_push_notification(
                            db,
                            user_id=prec["user_id"],
                            title=title,
                            body=final_msg,
                            data={
                                "notification_id": prec.get("notification_id", ""),
                                "category": "broadcast",
                                "priority": priority,
                                "action_url": action_url or ""
                            }
                        )
        except Exception as fcm_err:
            logger.warning(f"Batch FCM dispatch warning: {fcm_err}")

        return {
            "persisted_count": persisted_count,
            "total_recipients": len(recipients),
            "status": "success" if persisted_count == len(recipients) else "partial"
        }

    @staticmethod
    async def get_notifications(
        db, 
        user_id: str, 
        limit: int = 50, 
        page: int = 1, 
        category: Optional[str] = None, 
        priority: Optional[str] = None,
        unread_only: bool = False,
        role: Optional[str] = None,
        active_language: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Fetch paginated notification logs for user with strict role isolation and active language localization."""
        query = {"user_id": user_id}
        
        if role == "equipment_provider":
            # Equipment providers should never receive agronomic soil moisture, crop disease, or field telemetry alerts
            query["category"] = {"$in": ["booking", "equipment", "fleet", "system", "provider", "message", "chat", "broadcast"]}
        elif category:
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
            r["notification_id"] = str(r.get("_id") or r.get("id") or r.get("notification_id", ""))
            if "_id" in r:
                del r["_id"]
            orig_t = r.get("original_title") or r.get("title", "")
            orig_m = r.get("original_message") or r.get("message", "")
            r["original_title"] = orig_t
            r["original_message"] = orig_m
            r["source_language"] = r.get("source_language", "en")
            translations = r.get("translations") or {}
            r["translations"] = translations

            # Ensure canonical presentation by default
            r["title"] = orig_t
            r["message"] = orig_m

            if active_language and active_language != "en":
                if active_language in translations and isinstance(translations[active_language], dict):
                    r["title"] = translations[active_language].get("title", orig_t)
                    r["message"] = translations[active_language].get("message", orig_m)
                
        return records, total

    @staticmethod
    async def get_unread_notifications(
        db,
        user_id: str,
        limit: int = 10,
        role: Optional[str] = None,
        active_language: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch unread alerts list with role-based category filtering and active language localization."""
        query: Dict[str, Any] = {"user_id": user_id, "read": False}
        if role == "equipment_provider":
            query["category"] = {"$in": ["booking", "equipment", "fleet", "system", "provider", "message", "chat", "broadcast"]}
        cursor = db.notifications.find(query).sort("lifecycle.created_at", -1).limit(limit)
        records = await cursor.to_list(length=limit)
        for r in records:
            r["notification_id"] = str(r.get("_id") or r.get("id") or "")
            if "_id" in r:
                del r["_id"]
            orig_t = r.get("original_title") or r.get("title", "")
            orig_m = r.get("original_message") or r.get("message", "")
            r["original_title"] = orig_t
            r["original_message"] = orig_m
            r["source_language"] = r.get("source_language", "en")
            r["title"] = orig_t
            r["message"] = orig_m
            translations = r.get("translations") or {}
            r["translations"] = translations
            if active_language and active_language != "en":
                if active_language in translations and isinstance(translations[active_language], dict):
                    r["title"] = translations[active_language].get("title", orig_t)
                    r["message"] = translations[active_language].get("message", orig_m)
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
    async def mark_as_read(db, notification_id: str, user_id: str, role: Optional[str] = None) -> bool:
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
            
            # Send live WebSocket update to update notification badges (role-filtered)
            if result.modified_count > 0 and active_websocket_manager:
                count = await NotificationService.get_unread_count(db, user_id, role=role)
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
        uid_query = [{"user_id": user_id}]
        if ObjectId.is_valid(user_id):
            uid_query.append({"user_id": ObjectId(user_id)})
        result = await db.notifications.update_many(
            {"$or": uid_query, "read": False},
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
    async def acknowledge_notification(db, notification_id: str, user_id: str, action_taken: str, role: Optional[str] = None) -> bool:
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
                count = await NotificationService.get_unread_count(db, user_id, role=role)
                await active_websocket_manager.broadcast_to_user(user_id, {
                    "type": "unread_count_update",
                    "unread_count": count
                })
                
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error acknowledging notification: {e}")
            return False

    @staticmethod
    async def delete_notification(db, notification_id: str, user_id: str, role: Optional[str] = None) -> bool:
        """Delete notification log."""
        try:
            query = NotificationService._build_id_query(notification_id, user_id)
            result = await db.notifications.delete_one(query)
            if result.deleted_count > 0 and active_websocket_manager:
                count = await NotificationService.get_unread_count(db, user_id, role=role)
                await active_websocket_manager.broadcast_to_user(user_id, {
                    "type": "unread_count_update",
                    "unread_count": count
                })
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting notification: {str(e)}")
            return False

    @staticmethod
    async def clear_all_notifications(db, user_id: str, preserve_booking: bool = True, role: Optional[str] = None) -> int:
        """Delete alert notifications of user, preserving transactional booking notifications by default."""
        query: Dict[str, Any] = {"user_id": user_id}
        if preserve_booking:
            query["category"] = {"$nin": ["booking"]}
        result = await db.notifications.delete_many(query)
        if result.deleted_count > 0 and active_websocket_manager:
            count = await NotificationService.get_unread_count(db, user_id, role=role)
            await active_websocket_manager.broadcast_to_user(user_id, {
                "type": "unread_count_update",
                "unread_count": count
            })
        return result.deleted_count

    @staticmethod
    async def get_unread_count(db, user_id: str, role: Optional[str] = None) -> int:
        """Return count of unread notifications filtered by role (mirrors get_notifications filter)."""
        query: Dict[str, Any] = {"user_id": user_id, "read": False}
        if role == "equipment_provider":
            query["category"] = {"$in": ["booking", "equipment", "fleet", "system", "provider", "message", "chat", "broadcast"]}
        return await db.notifications.count_documents(query)

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
