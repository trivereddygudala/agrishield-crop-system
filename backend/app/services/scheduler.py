import logging
import asyncio
import os
import calendar
from datetime import datetime, timedelta, timezone
import httpx
from backend.app.models.notification import NotificationCreate
from backend.app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

scheduler_task = None
keepalive_task = None

async def scheduler_loop(db):
    """Async scheduler running background telemetry and alert tasks every minute."""
    logger.info("Notification scheduler background loop checking active schedules...")
    while True:
        try:
            now = datetime.now(timezone.utc)
            
            # Query all enabled schedules whose next_run matches or is before the current time
            cursor = db.scheduled_notifications.find({
                "enabled": True,
                "next_run": {"$lte": now}
            })
            schedules = await cursor.to_list(length=100)

            for schedule in schedules:
                schedule_id = schedule["_id"]
                user_id = str(schedule["user_id"])
                title = schedule["title"]
                message = schedule["message"]
                schedule_type = schedule["schedule_type"]
                category = schedule.get("category", "general")
                priority = schedule.get("priority", "Medium")

                logger.info(f"[SCHEDULER EXECUTE] Dispatching warning: '{title}' for user: {user_id}")

                # --- DYNAMIC DAILY SUMMARY INJECTION ---
                if category == "daily_summary":
                    try:
                        start_time = now - timedelta(days=1)
                        # Get user's devices
                        user_devices = await db.devices.find({"user_id": user_id}).to_list(length=10)
                        device_ids = [d["device_id"] for d in user_devices]
                        
                        if device_ids:
                            pipeline = [
                                {"$match": {"device_id": {"$in": device_ids}, "received_at": {"$gte": start_time}}},
                                {"$group": {
                                    "_id": None,
                                    "max_temp": {"$max": "$temperature"},
                                    "min_hum": {"$min": "$humidity"},
                                    "max_lux": {"$max": "$light_intensity"}
                                }}
                            ]
                            cursor = db.iot_telemetry.aggregate(pipeline)
                            results = await cursor.to_list(length=1)
                            
                            if results and results[0] and results[0].get("max_temp") is not None:
                                data = results[0]
                                max_t = data.get("max_temp", 0)
                                min_h = data.get("min_hum", 0)
                                max_l = data.get("max_lux", 0)
                                message = f"Here is your Daily Farm Summary! Max Temp hit {max_t:.1f}°C, Min Humidity dipped to {min_h:.1f}%. Peak Sunlight: {max_l} Lux."
                            else:
                                message = "Daily Farm Summary: No telemetry data was recorded by your devices today."
                        else:
                            message = "Daily Farm Summary: No IoT devices are currently registered to your farm."
                    except Exception as e:
                        logger.error(f"[SCHEDULER] Failed to compute daily summary: {e}")
                # ----------------------------------------

                # 1. Dispatch via NotificationService
                try:
                    await NotificationService.create_notification(
                        db,
                        NotificationCreate(
                            user_id=user_id,
                            title=title,
                            message=message,
                            category=category,
                            priority=priority
                        )
                    )
                except Exception as dispatch_err:
                    logger.error(f"[SCHEDULER ERROR] Failed to dispatch scheduled alert {schedule_id}: {dispatch_err}")

                # 2. Compute next execution time target
                last_run = now
                if schedule_type == "once":
                    # Mute/disable this task
                    await db.scheduled_notifications.update_one(
                        {"_id": schedule_id},
                        {"$set": {
                            "enabled": False,
                            "last_run": last_run
                        }}
                    )
                    logger.info(f"[SCHEDULER COMPLETED] Disable one-shot task: {schedule_id}")
                else:
                    # Increment next_run target
                    next_run = schedule["next_run"]
                    if schedule_type == "daily":
                        next_run = next_run + timedelta(days=1)
                    elif schedule_type == "weekly":
                        next_run = next_run + timedelta(weeks=1)
                    elif schedule_type == "monthly":
                        try:
                            next_month = next_run.month + 1
                            next_year = next_run.year
                            if next_month > 12:
                                next_month = 1
                                next_year += 1
                            # Clamp days (e.g., if day is 31st and next month only has 30, clamp to 30)
                            _, max_day = calendar.monthrange(next_year, next_month)
                            new_day = min(next_run.day, max_day)
                            next_run = next_run.replace(year=next_year, month=next_month, day=new_day)
                        except Exception:
                            next_run = next_run + timedelta(days=30)

                    # Safeguard: if next_run is somehow still in the past, advance relative to current datetime
                    if next_run <= now:
                        if schedule_type == "daily":
                            next_run = now + timedelta(days=1)
                        elif schedule_type == "weekly":
                            next_run = now + timedelta(weeks=1)
                        elif schedule_type == "monthly":
                            next_run = now + timedelta(days=30)

                    await db.scheduled_notifications.update_one(
                        {"_id": schedule_id},
                        {"$set": {
                            "next_run": next_run,
                            "last_run": last_run
                        }}
                    )
                    logger.info(f"[SCHEDULER UPDATE] Recurring task: {schedule_id} moved to: {next_run}")

        except Exception as loop_err:
            logger.error(f"[SCHEDULER CRITICAL] Error in background scheduler loop cycle: {loop_err}")

        # Sleep for exactly 60 seconds
        await asyncio.sleep(60)

async def render_keepalive_loop():
    """
    Pings self via public Render URL every 9 minutes to generate inbound HTTP traffic
    and prevent the Render free-tier container from spinning down.
    """
    public_url = os.getenv("RENDER_EXTERNAL_URL", "https://agrishield-crop-system.onrender.com")
    health_url = f"{public_url.rstrip('/')}/health"
    await asyncio.sleep(45)
    while True:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(health_url)
                logger.info(f"[KEEPALIVE] Sent keep-alive ping to {health_url}, status: {resp.status_code}")
        except Exception as e:
            logger.debug(f"[KEEPALIVE] Keep-alive ping notice: {e}")
        # Render spins down after 15 minutes of inactivity; ping every 9 minutes
        await asyncio.sleep(540)

def start_scheduler(db):
    """Initialize and run the background scheduler task thread."""
    global scheduler_task, keepalive_task
    if scheduler_task is None or scheduler_task.done():
        scheduler_task = asyncio.create_task(scheduler_loop(db))
        logger.info("Notification scheduler background task registered and running.")
    if keepalive_task is None or keepalive_task.done():
        keepalive_task = asyncio.create_task(render_keepalive_loop())
        logger.info("Render keep-alive background task registered and running.")

def stop_scheduler():
    """Clean up and cancel the background scheduler thread."""
    global scheduler_task, keepalive_task
    if scheduler_task and not scheduler_task.done():
        scheduler_task.cancel()
        logger.info("Notification scheduler background task canceled.")
    if keepalive_task and not keepalive_task.done():
        keepalive_task.cancel()
        logger.info("Render keep-alive background task canceled.")
