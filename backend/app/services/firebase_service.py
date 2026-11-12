import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

# Global flag to track if Firebase Admin SDK is successfully initialized
FIREBASE_INITIALIZED = False

try:
    # 1. Check for inline JSON string in environment variable (Render / Cloud deployment)
    raw_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or os.getenv("FIREBASE_CREDENTIALS_JSON")
    if raw_json and raw_json.strip().startswith("{"):
        import json
        cert_dict = json.loads(raw_json)
        cred = credentials.Certificate(cert_dict)
        firebase_admin.initialize_app(cred)
        FIREBASE_INITIALIZED = True
        logger.info("Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT_JSON env var.")
    else:
        # 2. Check for service account credentials file in common locations
        search_paths = [
            os.getenv("FIREBASE_CREDENTIALS_PATH", ""),
            "backend/firebase-service-account.json",
            "firebase-service-account.json",
            "backend/app/core/firebase-service-account.json",
            "../backend/firebase-service-account.json"
        ]
        cred_path = next((p for p in search_paths if p and os.path.exists(p)), None)
        
        if cred_path:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            FIREBASE_INITIALIZED = True
            logger.info(f"Firebase Admin SDK initialized successfully from file: {cred_path}")
        else:
            logger.warning("Firebase service account credentials file not found. Running Firebase Service in Simulation/Development mode.")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}. Running in Simulation mode.")

class FirebaseService:
    @staticmethod
    async def register_fcm_token(db, user_id: str, token: str, device_type: str = "web") -> bool:
        """Register or update an FCM token for a user."""
        try:
            await db.fcm_tokens.update_one(
                {"user_id": user_id, "token": token},
                {"$set": {
                    "device_type": device_type,
                    "updated_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
            logger.info(f"Registered FCM token for user: {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error registering FCM token: {e}")
            return False

    @staticmethod
    async def unregister_fcm_token(db, user_id: str, token: str) -> bool:
        """Unregister/delete a specific FCM token for a user."""
        try:
            result = await db.fcm_tokens.delete_one({"user_id": user_id, "token": token})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error unregistering FCM token: {e}")
            return False

    @staticmethod
    async def send_push_notification(db, user_id: str, title: str, body: str, data: Optional[Dict[str, str]] = None) -> bool:
        """Send push notifications to all registered FCM devices of a user. Fallback to retry queue on failure."""
        try:
            # Query all active FCM tokens for this user
            cursor = db.fcm_tokens.find({"user_id": user_id})
            tokens_doc = await cursor.to_list(length=100)
            tokens = [d["token"] for d in tokens_doc]

            if not tokens:
                logger.info(f"No registered FCM tokens found for user {user_id}. Simulating notification delivery.")
                return True

            if not FIREBASE_INITIALIZED:
                # Simulation Mode
                logger.info(f"[SIMULATION PUSH] To user {user_id} on {len(tokens)} devices:")
                logger.info(f"  Title: {title}")
                logger.info(f"  Body: {body}")
                logger.info(f"  Data: {data}")
                return True

            # Firebase Real Delivery
            message_data = data or {}
            # Ensure all values in data dictionary are strings
            message_data = {k: str(v) for k, v in message_data.items()}

            multicast_message = messaging.MulticastMessage(
                tokens=tokens,
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=message_data
            )
            
            if hasattr(messaging, "send_each_for_multicast"):
                response = messaging.send_each_for_multicast(multicast_message)
            else:
                response = messaging.send_multicast(multicast_message)
            logger.info(f"FCM multicast sent: {response.success_count} success, {response.failure_count} failures.")
            
            # If there are failures (e.g. invalid tokens), clean them up
            if response.failure_count > 0:
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        bad_token = tokens[idx]
                        logger.warning(f"Failed to deliver FCM to token: {bad_token}. Error: {resp.exception}")
                        # Optionally remove bad token
                        await db.fcm_tokens.delete_one({"token": bad_token})
            
            return response.success_count > 0
        except Exception as e:
            logger.error(f"FCM delivery exception for user {user_id}: {e}. Queuing in Retry Queue.")
            # Put notification in retry queue
            try:
                await db.notification_retry_queue.insert_one({
                    "user_id": user_id,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "status": "Pending",
                    "retry_count": 0,
                    "last_attempt": datetime.now(timezone.utc),
                    "error_message": str(e)
                })
            except Exception as queue_err:
                logger.error(f"Failed to queue failed FCM in retry collection: {queue_err}")
            return False

    @staticmethod
    async def process_retry_queue(db):
        """Process pending notification deliveries in the retry queue."""
        try:
            cursor = db.notification_retry_queue.find({"status": "Pending"}).limit(20)
            pending_items = await cursor.to_list(length=20)
            
            for item in pending_items:
                user_id = item["user_id"]
                title = item["title"]
                body = item["body"]
                data = item.get("data", {})
                retry_count = item.get("retry_count", 0)
                
                logger.info(f"Retrying FCM delivery for notification {item['_id']} (Attempt {retry_count + 1})")
                
                # Try sending again
                success = await FirebaseService.send_push_notification(db, user_id, title, body, data)
                
                if success:
                    await db.notification_retry_queue.update_one(
                        {"_id": item["_id"]},
                        {"$set": {"status": "Sent", "last_attempt": datetime.now(timezone.utc)}}
                    )
                else:
                    new_status = "Failed" if retry_count >= 3 else "Pending"
                    await db.notification_retry_queue.update_one(
                        {"_id": item["_id"]},
                        {
                            "$set": {
                                "status": new_status,
                                "retry_count": retry_count + 1,
                                "last_attempt": datetime.now(timezone.utc)
                            }
                        }
                    )
        except Exception as e:
            logger.error(f"Error processing FCM retry queue: {e}")
