import logging
from motor.motor_asyncio import AsyncIOMotorClient
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    """Create MongoDB database connection client."""
    if db_instance.db is not None and (
        type(db_instance.db).__name__.startswith("Mock") or 
        "mock" in str(type(db_instance.db)).lower()
    ):
        logger.info("Database is already mocked. Skipping connection to MongoDB.")
        return
    logger.info("Connecting to MongoDB...")
    db_instance.client = AsyncIOMotorClient(settings.mongo_connection_url)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    
    # Simple check to confirm connection is successful
    try:
        await db_instance.client.admin.command('ping')
        logger.info("Connected to MongoDB successfully.")
        # Ensure compound index on iot_telemetry for analytics querying
        await db_instance.db["iot_telemetry"].create_index([("device_id", 1), ("received_at", -1)])
        
        # Ensure notifications indexes
        await db_instance.db["notifications"].create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
        await db_instance.db["notifications"].create_index([("device_id", 1), ("category", 1), ("created_at", -1)])
        await db_instance.db["notification_cooldowns"].create_index([("device_id", 1), ("category", 1)])
        
        # Additional Indexes for rules, scheduler, and FCM tokens
        await db_instance.db["notification_rules"].create_index([("category", 1), ("enabled", 1)])
        await db_instance.db["scheduled_notifications"].create_index([("next_run", 1), ("enabled", 1)])
        await db_instance.db["fcm_tokens"].create_index([("user_id", 1)])
        await db_instance.db["fcm_tokens"].create_index([("token", 1)], unique=True)
        
        logger.info("MongoDB indexes verified.")
        
        # Seed default notification rules if collection is empty
        await seed_default_notification_rules(db_instance.db)
        
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}. Starting in degraded mode.")
        db_instance.db = None

async def seed_default_notification_rules(db):
    """Seed base dynamic notification rules if none exist."""
    try:
        count = await db.notification_rules.count_documents({})
        if count == 0:
            from datetime import datetime, timezone
            default_rules = [
                {
                    "rule_name": "Low Soil Moisture",
                    "enabled": True,
                    "category": "soil",
                    "conditions": [
                        {"field": "soil_moisture", "operator": "<", "value": 25.0}
                    ],
                    "logic": "AND",
                    "priority": "High",
                    "title": "Soil Moisture Low",
                    "message_template": "Soil moisture dropped to {{soil_moisture}}%. Recommended irrigation: 5 L/m².",
                    "cooldown_minutes": 60,
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "rule_name": "High Temperature Heat Stress",
                    "enabled": True,
                    "category": "device",
                    "conditions": [
                        {"field": "temperature", "operator": ">", "value": 40.0}
                    ],
                    "logic": "AND",
                    "priority": "High",
                    "title": "High Heat Stress Detected",
                    "message_template": "Temperature has reached {{temperature}}°C. Increase irrigation frequency.",
                    "cooldown_minutes": 60,
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "rule_name": "High Humidity Risk",
                    "enabled": True,
                    "category": "device",
                    "conditions": [
                        {"field": "humidity", "operator": ">", "value": 90.0}
                    ],
                    "logic": "AND",
                    "priority": "Medium",
                    "title": "High Fungal Favorable Humidity",
                    "message_template": "Humidity is {{humidity}}%. Fungal disease transmission risk increased.",
                    "cooldown_minutes": 60,
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "rule_name": "Battery Low Warning",
                    "enabled": True,
                    "category": "battery",
                    "conditions": [
                        {"field": "battery_percentage", "operator": "<", "value": 20.0}
                    ],
                    "logic": "AND",
                    "priority": "High",
                    "title": "Battery Low Warning",
                    "message_template": "ESP32 node battery level is low ({{battery_percentage}}%). Recharge device soon.",
                    "cooldown_minutes": 60,
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "rule_name": "Critical Battery Warning",
                    "enabled": True,
                    "category": "battery",
                    "conditions": [
                        {"field": "battery_percentage", "operator": "<", "value": 10.0}
                    ],
                    "logic": "AND",
                    "priority": "Critical",
                    "title": "Critical Battery Alert",
                    "message_template": "ESP32 node battery level is critically low ({{battery_percentage}}%). Recharge device immediately.",
                    "cooldown_minutes": 60,
                    "created_at": datetime.now(timezone.utc)
                }
            ]
            await db.notification_rules.insert_many(default_rules)
            logger.info("Seeded default notification rules into MongoDB.")
    except Exception as e:
        logger.error(f"Failed to seed default notification rules: {e}")

async def close_mongo_connection():
    """Close MongoDB database connection client."""
    if db_instance.client:
        logger.info("Closing connection to MongoDB...")
        db_instance.client.close()
        logger.info("MongoDB connection closed.")

def get_database():
    """Retrieve database instance."""
    return db_instance.db
