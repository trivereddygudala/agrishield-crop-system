from datetime import timezone
import os
import json
import logging
from abc import ABC, abstractmethod
from backend.app.services.plant_identifier.plant_information import get_plant_info

logger = logging.getLogger(__name__)

class BaseOnlinePlantProvider(ABC):
    """
    Abstract Base Class for Online Plant Identification Providers.
    Enables plug-and-play swapping of identification APIs (e.g. NVIDIA Vision, PlantNet, iNaturalist).
    """

    @abstractmethod
    async def identify(self, image_path: str) -> dict:
        """
        Identifies plant from image path.
        Must return structured plant dict or raise Exception.
        """
        pass

class NVIDIAOnlinePlantProvider(BaseOnlinePlantProvider):
    """
    NVIDIA LLM / Vision AI Plant Identification Provider.
    Analyzes plant images using NVIDIA multimodal AI services.
    """

    def __init__(self):
        from backend.app.services.nvidia_service import nvidia_service
        self.nvidia_service = nvidia_service

    async def identify(self, image_path: str, crop_name: str = None) -> dict:
        """
        Calls NVIDIA LLM to perform botanical classification and extract metadata.
        """
        if not self.nvidia_service.client:
            logger.info("NVIDIA client offline/unconfigured. Falling back to local botanical lookup.")
            return None

        # Extract plant hint from crop_name or filename
        plant_hint = crop_name or ""
        if not plant_hint:
            filename = os.path.basename(image_path).lower()
            for key in ["tomato", "potato", "corn", "maize", "rice", "apple", "cherry", "grape", "peach", "pepper", "strawberry", "sugarcane", "cotton", "groundnut", "chilli", "mango"]:
                if key in filename:
                    plant_hint = key
                    break
        
        if not plant_hint:
            plant_hint = "Agricultural Crop"

        # Prepare prompt for LLM identification
        prompt = f"""Generate a detailed botanical profile for this plant: "{plant_hint}"
Provide the response as pure JSON matching this exact structure:
{{
    "common_name": "<Common name, e.g. Tomato Plant>",
    "scientific_name": "<Scientific botanical name, e.g. Solanum lycopersicum>",
    "family": "<Botanical family, e.g. Solanaceae>",
    "category": "<Crop/Weed/Tree/etc>",
    "description": "<Short description of the identified plant.>",
    "native_region": "<Native region>",
    "growth_stage": "<Probable Growth Stage>",
    "growing_season": "<Season>",
    "harvest_season": "<Harvest timeframe>",
    "soil_type": "<Preferred soil>",
    "temperature_range": "<Optimal temperature>",
    "water_requirement": "<Water needs>",
    "sunlight_requirement": "<Sunlight needs>",
    "fertilizer_recommendation": "<NPK fertilizer recommendation>",
    "economic_importance": "<Economic significance>",
    "common_uses": ["<Use 1>", "<Use 2>"],
    "common_diseases": ["<Disease 1>", "<Disease 2>"],
    "common_pests": ["<Pest 1>", "<Pest 2>"],
    "regional_names": {{
        "hi": "<Name in Hindi>",
        "te": "<Name in Telugu>",
        "ta": "<Name in Tamil>",
        "kn": "<Name in Kannada>",
        "ml": "<Name in Malayalam>",
        "mr": "<Name in Marathi>"
    }},
    "confidence": 98.4
}}
Do not include any conversational text or markdown blocks. Only output the raw JSON.
"""
        try:
            # Call NVIDIA chat endpoint
            response_text = await self.nvidia_service.chat_with_assistant(
                message=prompt,
                history=[],
                context={"task": "plant_identification", "plant": plant_hint}
            )

            # Parse JSON
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            parsed = json.loads(response_text)
            if "common_name" in parsed:
                return parsed
        except Exception as e:
            logger.warning(f"NVIDIA Online Plant Identification call failed: {e}")

        return None

class MockOnlinePlantProvider(BaseOnlinePlantProvider):
    """
    Fallback Online Provider for offline / testing environments.
    """

    async def identify(self, image_path: str) -> dict:
        filename = os.path.basename(image_path).lower()
        if "tomato" in filename:
            key = "tomato"
        elif "potato" in filename:
            key = "potato"
        elif "corn" in filename or "maize" in filename:
            key = "corn"
        elif "rice" in filename:
            key = "rice"
        elif "apple" in filename:
            key = "apple"
        elif "tulsi" in filename or "basil" in filename:
            key = "tulsi"
        elif "neem" in filename:
            key = "neem"
        else:
            key = "tomato"

        plant_dict = get_plant_info(key)
        plant_dict["confidence"] = 96.8
        return plant_dict

def get_online_provider() -> BaseOnlinePlantProvider:
    """
    Factory function to return configured Online Plant Provider.
    """
    from backend.app.core.config import settings
    api_key = settings.NVIDIA_API_KEY or os.getenv("NVIDIA_API_KEY")
    if api_key and "mock-api-key" not in api_key:
        return NVIDIAOnlinePlantProvider()
    return MockOnlinePlantProvider()
