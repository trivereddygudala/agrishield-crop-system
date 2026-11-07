import logging
from datetime import datetime, timezone
from bson import ObjectId
from typing import List, Optional, Dict, Any
from backend.app.models.farm_profile import FarmProfileCreate, FarmProfileUpdate

logger = logging.getLogger(__name__)

def _user_id_query(user_id: str):
    obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
    return {"$in": [obj_id, str(user_id)]} if obj_id else str(user_id)

def _farm_id_query(farm_id: str):
    obj_id = ObjectId(farm_id) if ObjectId.is_valid(farm_id) else None
    return {"$in": [obj_id, str(farm_id)]} if obj_id else str(farm_id)

class FarmProfileService:
    @staticmethod
    async def create_farm(db, user_id: str, farm_data: FarmProfileCreate) -> Dict[str, Any]:
        """Create a new farm profile for the user and mark it active."""
        now = datetime.now(timezone.utc)
        farm_dict = farm_data.dict()
        user_obj = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        farm_dict.update({
            "user_id": user_obj,
            "created_at": now,
            "updated_at": now
        })
        
        # Insert into farm_profiles collection
        result = await db["farm_profiles"].insert_one(farm_dict)
        farm_id = result.inserted_id
        
        # Mark profile completed and active farm on user profile
        await db["users"].update_one(
            {"_id": _user_id_query(user_id)},
            {
                "$set": {
                    "farm_profile_completed": True,
                    "active_farm_id": farm_id
                }
            }
        )
        
        farm_dict["id"] = str(farm_id)
        farm_dict["user_id"] = str(user_id)
        return farm_dict

    @staticmethod
    async def get_farm(db, farm_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single farm profile."""
        try:
            doc = await db["farm_profiles"].find_one({
                "_id": _farm_id_query(farm_id),
                "user_id": _user_id_query(user_id)
            })
            if doc:
                doc["id"] = str(doc["_id"])
                doc["user_id"] = str(doc["user_id"])
                return doc
        except Exception as e:
            logger.error(f"Error getting farm {farm_id}: {e}")
        return None

    @staticmethod
    async def list_farms(db, user_id: str) -> List[Dict[str, Any]]:
        """List all farms belonging to a user."""
        farms = []
        try:
            cursor = db["farm_profiles"].find({
                "user_id": _user_id_query(user_id),
                "is_archived": {"$ne": True}
            })
            async for doc in cursor:
                doc["id"] = str(doc["_id"])
                doc["user_id"] = str(doc["user_id"])
                farms.append(doc)
        except Exception as e:
            logger.error(f"Error listing farms for user {user_id}: {e}")
        return farms

    @staticmethod
    async def list_archived_farms(db, user_id: str) -> List[Dict[str, Any]]:
        """List all archived farms belonging to a user."""
        farms = []
        try:
            cursor = db["farm_profiles"].find({
                "user_id": _user_id_query(user_id),
                "is_archived": True
            })
            async for doc in cursor:
                doc["id"] = str(doc["_id"])
                doc["user_id"] = str(doc["user_id"])
                farms.append(doc)
        except Exception as e:
            logger.error(f"Error listing archived farms for user {user_id}: {e}")
        return farms

    @staticmethod
    async def unarchive_farm(db, farm_id: str, user_id: str) -> bool:
        """Unarchive a farm profile."""
        try:
            update_res = await db["farm_profiles"].update_one(
                {"_id": _farm_id_query(farm_id), "user_id": _user_id_query(user_id)},
                {"$set": {"is_archived": False, "updated_at": datetime.now(timezone.utc)}}
            )
            if update_res.modified_count > 0:
                await FarmProfileService.set_active_farm(db, farm_id, user_id)
                return True
        except Exception as e:
            logger.error(f"Error unarchiving farm {farm_id}: {e}")
        return False

    @staticmethod
    async def update_farm(db, farm_id: str, user_id: str, farm_data: FarmProfileUpdate) -> Optional[Dict[str, Any]]:
        """Update an existing farm profile."""
        try:
            update_dict = {k: v for k, v in farm_data.dict(exclude_unset=True).items() if v is not None}
            if not update_dict:
                return await FarmProfileService.get_farm(db, farm_id, user_id)
                
            update_dict["updated_at"] = datetime.now(timezone.utc)
            
            result = await db["farm_profiles"].update_one(
                {"_id": _farm_id_query(farm_id), "user_id": _user_id_query(user_id)},
                {"$set": update_dict}
            )
            if result.modified_count > 0 or result.matched_count > 0:
                return await FarmProfileService.get_farm(db, farm_id, user_id)
        except Exception as e:
            logger.error(f"Error updating farm {farm_id}: {e}")
        return None

    @staticmethod
    async def delete_farm(db, farm_id: str, user_id: str) -> bool:
        """Delete a farm profile and re-assign active farm reference if needed."""
        try:
            update_res = await db["farm_profiles"].update_one(
                {"_id": _farm_id_query(farm_id), "user_id": _user_id_query(user_id)},
                {"$set": {"is_archived": True, "updated_at": datetime.now(timezone.utc)}}
            )
            if update_res.modified_count == 0 and update_res.matched_count == 0:
                return False
                
            # Check user document for active farm
            user = await db["users"].find_one({"_id": _user_id_query(user_id)})
            if user:
                active_id = user.get("active_farm_id")
                if active_id and str(active_id) == farm_id:
                    remaining_farms = await FarmProfileService.list_farms(db, user_id)
                    if remaining_farms:
                        new_active_id = ObjectId(remaining_farms[0]["id"]) if ObjectId.is_valid(remaining_farms[0]["id"]) else remaining_farms[0]["id"]
                        await db["users"].update_one(
                            {"_id": _user_id_query(user_id)},
                            {"$set": {"active_farm_id": new_active_id}}
                        )
                    else:
                        await db["users"].update_one(
                            {"_id": _user_id_query(user_id)},
                            {"$set": {"active_farm_id": None, "farm_profile_completed": False}}
                        )
            return True
        except Exception as e:
            logger.error(f"Error deleting farm {farm_id}: {e}")
        return False

    @staticmethod
    async def get_active_farm(db, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the currently active farm profile for the user with automatic fallback."""
        try:
            user = await db["users"].find_one({"_id": _user_id_query(user_id)})
            if user:
                active_id = user.get("active_farm_id")
                if active_id:
                    farm = await FarmProfileService.get_farm(db, str(active_id), user_id)
                    if farm:
                        return farm
            # Fallback to the user's first unarchived farm
            cursor = db["farm_profiles"].find({
                "user_id": _user_id_query(user_id),
                "is_archived": {"$ne": True}
            }).sort("_id", -1)
            first_farm = await cursor.to_list(1)
            if first_farm and len(first_farm) > 0:
                doc = first_farm[0]
                doc["id"] = str(doc["_id"])
                doc["user_id"] = str(doc["user_id"])
                try:
                    await db["users"].update_one(
                        {"_id": _user_id_query(user_id)},
                        {"$set": {"active_farm_id": doc["_id"], "farm_profile_completed": True}}
                    )
                except Exception:
                    pass
                return doc
        except Exception as e:
            logger.error(f"Error getting active farm for user {user_id}: {e}")
        return None

    @staticmethod
    async def set_active_farm(db, farm_id: str, user_id: str) -> bool:
        """Switch the active farm profile for the user."""
        try:
            # First ensure the farm exists and belongs to the user
            farm = await db["farm_profiles"].find_one({
                "_id": _farm_id_query(farm_id),
                "user_id": _user_id_query(user_id)
            })
            if not farm:
                return False
                
            farm_obj_id = ObjectId(farm_id) if ObjectId.is_valid(farm_id) else farm_id
            await db["users"].update_one(
                {"_id": _user_id_query(user_id)},
                {"$set": {"active_farm_id": farm_obj_id, "farm_profile_completed": True}}
            )
            return True
        except Exception as e:
            logger.error(f"Error setting active farm to {farm_id}: {e}")
        return False
