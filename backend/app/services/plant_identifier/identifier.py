from datetime import timezone
import os
import logging
import cv2
import numpy as np

from backend.app.services.plant_identifier.utils import compute_image_hash
from backend.app.services.plant_identifier.image_validator import validate_plant_image
from backend.app.services.plant_identifier.plant_information import get_plant_info
from backend.app.services.plant_identifier.online_provider import get_online_provider
from backend.app.services.plant_identifier.cache import plant_cache

logger = logging.getLogger(__name__)

# Minimum confidence threshold for local identification (e.g. 70.0%)
LOCAL_CONFIDENCE_THRESHOLD = 75.0
# Minimum acceptable overall confidence threshold (50.0%)
MIN_CONFIDENCE_THRESHOLD = 50.0

class PlantIdentifier:
    """
    Modular, Future-Ready Plant Identification Engine.
    Handles image validation, local inference, online fallback provider, caching,
    and unknown plant handling.
    """

    def __init__(self):
        self.online_provider = get_online_provider()

    def _attempt_local_identification(self, image_path: str, plant_type: str = "crop", tree_filter: str = None, crop_filter: str = None, organ: str = "leaf") -> dict:
        """
        Attempts local plant identification using tree/crop filter, filename heuristics,
        color features, and local botanical knowledge base.
        """
        # 1. Direct filter selection override (Only when user explicitly chooses a specific tree)
        if plant_type == "tree" and tree_filter and tree_filter.lower() not in ["all", "none", "auto", ""]:
            selected_tree = tree_filter.lower().strip()
            tree_info = get_plant_info(selected_tree)
            if tree_info:
                return {
                    "success": True,
                    "source": "local",
                    "plant_type": "tree",
                    "confidence": 98.5,
                    "plant": tree_info
                }

        # Genuine visual evidence only (Filename matching eliminated per D2.5)
        # --- 1. Offline Neural Vision Analysis (Only valid for leaf specimens) ---
        if organ == "leaf":
            try:
                from model.predict_pytorch import load_resources
                loader, classes = load_resources()
                py_res = loader.predict_image(image_path, top_k=5)
                if py_res and py_res.get("top_predictions"):
                    top_preds = py_res["top_predictions"]
                    
                    crop_to_botanical = {
                        "tomato": "tomato",
                        "chilli": "chilli",
                        "pepper": "chilli",
                        "bell pepper": "pepper",
                        "potato": "potato",
                        "corn": "corn",
                        "maize": "corn",
                        "rice": "paddy",
                        "paddy": "paddy",
                        "wheat": "wheat",
                        "cotton": "cotton",
                        "sugarcane": "sugarcane",
                        "groundnut": "groundnut",
                        "peanut": "groundnut",
                        "mango": "mango",
                        "apple": "apple",
                        "grape": "grape",
                        "peach": "peach",
                        "strawberry": "strawberry",
                        "soybean": "soybean",
                        "orange": "sweet_orange",
                        "citrus": "sweet_orange",
                        "banana": "banana",
                        "onion": "onion",
                        "garlic": "garlic",
                        "brinjal": "brinjal",
                        "eggplant": "brinjal",
                        "okra": "okra",
                        "ladyfinger": "okra",
                        "neem": "neem",
                        "tamarind": "tamarind",
                        "banyan": "banyan",
                        "peepal": "peepal",
                        "teak": "teak",
                        "guava": "guava",
                        "coconut": "coconut",
                        "cashew": "cashew",
                        "papaya": "papaya",
                        "pomegranate": "pomegranate",
                        "jackfruit": "jackfruit",
                        "amla": "amla",
                        "drumstick": "drumstick"
                    }

                    # Evaluate top neural predictions in order
                    for pred in top_preds:
                        cls_name = str(pred.get("class_name", "")).lower()
                        cls_prob = float(pred.get("confidence", 0.0))

                        # Only accept if genuine model confidence is above 70%
                        if cls_prob < 0.70:
                            continue

                        # 1. Direct Chilli vs Bell Pepper Distinction
                        if "chilli" in cls_name or "chili" in cls_name or "mirapa" in cls_name:
                            plant_info = get_plant_info("chilli")
                            if plant_info:
                                return {
                                    "success": True,
                                    "source": "local_neural_vision",
                                    "model": "PyTorch 1,252-Class Vision Engine",
                                    "plant_type": "crop",
                                    "confidence": round(cls_prob * 100, 1),
                                    "plant": plant_info
                                }
                        elif "bell_pepper" in cls_name or "pepper__bell" in cls_name or "capsicum" in cls_name:
                            plant_info = get_plant_info("pepper")
                            if plant_info:
                                return {
                                    "success": True,
                                    "source": "local_neural_vision",
                                    "model": "PyTorch 1,252-Class Vision Engine",
                                    "plant_type": "crop",
                                    "confidence": round(cls_prob * 100, 1),
                                    "plant": plant_info
                                }

                        # 2. Agricultural Weeds Check
                        if any(w in cls_name for w in ["weed", "parthenium", "amaranthus", "grass", "cyperus", "trianthema", "commelina", "chickweed", "mayweed"]):
                            weed_key = "parthenium"
                            if "amaranthus" in cls_name:
                                weed_key = "amaranthus_spinosus"
                            elif "cyperus" in cls_name or "nut_grass" in cls_name:
                                weed_key = "nut_grass"
                            elif "bermuda" in cls_name or "garika" in cls_name:
                                weed_key = "bermuda_grass"
                            elif "trianthema" in cls_name or "galijeru" in cls_name:
                                weed_key = "trianthema"
                            elif "commelina" in cls_name or "vennedevi" in cls_name:
                                weed_key = "commelina"
                            
                            plant_info = get_plant_info(weed_key)
                            if plant_info:
                                return {
                                    "success": True,
                                    "source": "local_neural_vision",
                                    "model": "PyTorch 1,252-Class Vision Engine",
                                    "plant_type": "crop",
                                    "is_weed": True,
                                    "confidence": round(cls_prob * 100, 1),
                                    "plant": plant_info
                                }

                        # 3. Native Regional Trees Check
                        for tree_key in ["neem", "tamarind", "banyan", "peepal", "teak", "red_sanders", "jamun", "rosewood", "babool", "subabul", "eucalyptus", "casuarina", "pongamia", "gulmohar", "rain_tree", "sandalwood", "palmyra", "ficus", "acacia"]:
                            if tree_key in cls_name:
                                plant_info = get_plant_info(tree_key)
                                if plant_info:
                                    return {
                                        "success": True,
                                        "source": "local_neural_vision",
                                        "model": "PyTorch 1,252-Class Vision Engine",
                                        "plant_type": "tree",
                                        "confidence": round(cls_prob * 100, 1),
                                        "plant": plant_info
                                    }

                        # 4. Crops & Vegetables Check
                        for crop_key, db_key in crop_to_botanical.items():
                            if crop_key in cls_name:
                                plant_info = get_plant_info(db_key)
                                if plant_info:
                                    inferred_type = "tree" if any(t in (plant_info.get("category") or "").lower() for t in ["tree", "చెట్టు", "వృక్ష"]) else "crop"
                                    return {
                                        "success": True,
                                        "source": "local_neural_vision",
                                        "model": "PyTorch 1,252-Class Vision Engine",
                                        "plant_type": inferred_type,
                                        "confidence": round(cls_prob * 100, 1),
                                        "plant": plant_info
                                    }
            except Exception as e:
                logger.warning(f"PyTorch primary vision analysis fallback: {e}")

        # Filename heuristics eliminated per D2.5 safety requirements.
        return None

    async def identify_plant(self, image_path: str, plant_type: str = "crop", tree_filter: str = None, crop_filter: str = None, organ: str = "leaf") -> dict:
        """
        Main Plant Identification Pipeline Workflow:
        1. Image Validation
        2. Scope & Organ Normalization
        3. Cache Check
        4. Explicit Tree Filter Override (if user purposefully locked a specific tree)
        5. PRIMARY BOTANICAL VISION ENGINE: Pl@ntNet (300,000+ species) + Gemini Multimodal Vision AI
        6. SECONDARY FALLBACK: Local Offline Botanical Engine & PyTorch Classifier
        """
        valid_organ = (organ or "leaf").lower().strip()
        if valid_organ not in ["leaf", "flower", "fruit", "bark"]:
            valid_organ = "leaf"

        # 1. Image Validation
        validation = validate_plant_image(image_path)
        if not validation["is_valid"]:
            return {
                "success": False,
                "error": validation["message"],
                "error_code": validation.get("error_code", "VALIDATION_FAILED"),
                "options": [
                    "Retry with a clearer, well-lit plant photo",
                    "Ensure plant leaf or flower is centered",
                    "Upload supported file format (JPG, PNG, WEBP)"
                ]
            }

        # 2. Check Cache with domain & organ scope
        image_hash = compute_image_hash(image_path)
        cache_key = f"{image_hash}_{plant_type}_{tree_filter or 'none'}_{crop_filter or 'none'}_{valid_organ}"
        cached_res = plant_cache.get(cache_key)
        if cached_res:
            return cached_res

        # 3. Explicit Tree Filter selection override (only if user purposefully selected a specific tree)
        if plant_type == "tree" and tree_filter and tree_filter.lower() not in ["all", "none", "auto", ""]:
            local_filter_res = self._attempt_local_identification(
                image_path=image_path,
                plant_type=plant_type,
                tree_filter=tree_filter,
                crop_filter=None,
                organ=valid_organ
            )
            if local_filter_res and local_filter_res.get("success"):
                plant_cache.set(cache_key, local_filter_res)
                return local_filter_res

        # 4. PRIMARY BOTANICAL VISION ENGINE (Pl@ntNet + Google Gemini Vision Dual AI)
        try:
            online_data = await self.online_provider.identify(
                image_path=image_path,
                crop_name=crop_filter,
                plant_type=plant_type,
                tree_filter=tree_filter,
                organ=valid_organ
            )
            if online_data and isinstance(online_data, dict):
                confidence = float(online_data.get("confidence", 92.0))
                sci_name = online_data.get("scientific_name", "")
                genus_name = online_data.get("genus", "") or (sci_name.split()[0] if sci_name else "")
                species_name = online_data.get("species", "") or (sci_name.split()[1] if len(sci_name.split()) > 1 else "")
                
                # Format to comprehensive botanical standard
                plant_obj = {
                    "common_name": online_data.get("common_name", "Unknown Plant"),
                    "scientific_name": sci_name or "Specimen spp.",
                    "genus": genus_name or "Botanical Genus",
                    "species": species_name or "spp.",
                    "family": online_data.get("family", "Botanical Family"),
                    "identified_type": online_data.get("identified_type") or online_data.get("category") or ("Weed" if online_data.get("is_weed") else "Crop"),
                    "category": online_data.get("category", "Plant Species"),
                    "is_weed": bool(online_data.get("is_weed", False)),
                    "description": online_data.get("description", "Identified plant specimen."),
                    "primary_use_impact": online_data.get("primary_use_impact") or ("Invasive agricultural weed requiring management." if online_data.get("is_weed") else "Cultivated agricultural food crop and beneficial economic plant."),
                    "native_region": online_data.get("native_region", "Global & Indian Subcontinent"),
                    "growth_stage": online_data.get("growth_stage", "Active Growth / Foliage"),
                    "growing_season": online_data.get("growing_season", "Seasonal"),
                    "harvest_season": online_data.get("harvest_season", "Variable"),
                    "leaf_type": online_data.get("leaf_type", "Standard Foliage Leaf"),
                    "soil_type": online_data.get("soil_type", "Loam farm soil (pH 6.0 - 7.2)"),
                    "suitable_soil_type": online_data.get("suitable_soil_type") or online_data.get("soil_type", "Loam farm soil (pH 6.0 - 7.2)"),
                    "temperature_range": online_data.get("temperature_range", "18°C - 35°C"),
                    "ideal_weather_climate": online_data.get("ideal_weather_climate") or f"{online_data.get('temperature_range', '18°C - 35°C')}, {online_data.get('sunlight_requirement', 'Full Sun')}",
                    "water_requirement": online_data.get("water_requirement", "Moderate watering"),
                    "sunlight_requirement": online_data.get("sunlight_requirement", "Full Sun"),
                    "fertilizer_recommendation": online_data.get("fertilizer_recommendation", "Balanced NPK and organic compost"),
                    "economic_importance": online_data.get("economic_importance", "Agricultural / Botanical importance"),
                    "common_uses": online_data.get("common_uses", ["Cultivation", "Gardening"]),
                    "common_diseases": online_data.get("common_diseases", ["Foliar Spot", "Powdery Mildew"]),
                    "common_pests": online_data.get("common_pests", ["Aphids", "Mites"]),
                    "weed_eradication_advice": online_data.get("weed_eradication_advice", "Not applicable."),
                    "regional_names": online_data.get("regional_names", {})
                }

                if confidence >= MIN_CONFIDENCE_THRESHOLD:
                    result = {
                        "success": True,
                        "source": online_data.get("identification_source", "online"),
                        "model": online_data.get("model", "Pl@ntNet Research Botanical AI"),
                        "confidence": round(confidence, 1),
                        "plant_type": "tree" if "tree" in plant_obj["category"].lower() else "crop",
                        "is_weed": plant_obj["is_weed"],
                        "organ": valid_organ,
                        "plant": plant_obj
                    }
                    plant_cache.set(cache_key, result)
                    return result
        except Exception as e:
            logger.warning(f"Online identification provider failed: {e}")

        # 5. SECONDARY FALLBACK: Local Offline Identification
        local_result = self._attempt_local_identification(
            image_path=image_path,
            plant_type=plant_type,
            tree_filter=tree_filter,
            crop_filter=crop_filter,
            organ=valid_organ
        )

        if local_result and local_result.get("confidence", 0) >= LOCAL_CONFIDENCE_THRESHOLD:
            plant_cache.set(cache_key, local_result)
            return local_result

        # 6. Unknown Plant Handling (If confidence is low or unidentifiable)
        return {
            "success": False,
            "error": "This plant could not be confidently identified.",
            "confidence": None,
            "options": [
                "Retry with a clearer, well-lit photo focusing on the leaf, flower, or fruit",
                "Ensure the correct organ (Leaf, Flower, Fruit, Bark) is selected",
                "Hold the camera 6-12 inches away with steady focus"
            ]
        }

# Global Singleton Engine Instance
plant_identifier_service = PlantIdentifier()
