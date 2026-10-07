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
    async def identify(self, image_path: str, crop_name: str = None, plant_type: str = "crop", tree_filter: str = None, organ: str = "leaf") -> dict:
        pass

class NVIDIAOnlinePlantProvider(BaseOnlinePlantProvider):
    """
    NVIDIA LLM botanical classification stub.
    D2.5 Safety Compliance (RC06): Text-only LLM cannot claim visual plant identification without image pixels.
    Returns None to ensure safe exit without inventing data.
    """
    async def identify(self, image_path: str, crop_name: str = None, plant_type: str = "crop", tree_filter: str = None, organ: str = "leaf") -> dict:
        logger.info("NVIDIA text-only LLM cannot perform genuine image-based plant identification without visual pixels. Returning None.")
        return None

class NullOnlinePlantProvider(BaseOnlinePlantProvider):
    """
    Fallback provider when no online vision API is configured.
    Returns None to ensure safe exit without inventing data.
    """
    async def identify(self, image_path: str, crop_name: str = None, plant_type: str = "crop", tree_filter: str = None, organ: str = "leaf") -> dict:
        return None

class GeminiVisionOnlineProvider(BaseOnlinePlantProvider):
    """
    Google Gemini Multimodal Vision Plant Identification Provider.
    Leverages gemini-flash-lite-latest / gemini-flash-latest with 1,000,000 TPM
    to identify plants, weeds, trees, flowers, and fruits from photographs.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def identify(self, image_path: str, crop_name: str = None, plant_type: str = "crop", tree_filter: str = None, organ: str = "leaf") -> dict:
        import httpx
        import base64
        from backend.app.services.gemini_vision import safe_parse_json

        if not self.api_key or "mock" in self.api_key or "PASTE" in self.api_key:
            return None

        if not os.path.exists(image_path):
            return None

        try:
            with open(image_path, "rb") as f:
                image_bytes = f.read()
            b64_img = base64.b64encode(image_bytes).decode("utf-8")

            valid_organ = (organ or "leaf").lower().strip()
            prompt = f"""You are a world-class senior botanist, plant taxonomist, and agricultural agronomist.
Accurately identify the plant, tree, flower, fruit, crop, or weed in this photograph.
Focused organ inspected: {valid_organ}.
{f'Additional Context / Hint: {crop_name or tree_filter}' if (crop_name or tree_filter) else ''}

Return ONLY a valid JSON object matching this exact structure:
{{
  "common_name": "<Common name in English, e.g. Bird's Eye Chilli / Chilli Plant, Hibiscus, Mango Tree, Parthenium Weed>",
  "scientific_name": "<Binomial scientific name in italics, e.g. Capsicum frutescens>",
  "genus": "<Genus name, e.g. Capsicum>",
  "species": "<Specific epithet, e.g. frutescens>",
  "family": "<Botanical family, e.g. Solanaceae>",
  "identified_type": "<Tree / Weed / Medicinal Plant / Crop / Ornamental>",
  "category": "<Tree / Weed / Medicinal Plant / Crop / Ornamental>",
  "is_weed": <true or false>,
  "description": "<A medium 5 to 10 sentence overview of the plant's physical characteristics, regional presence, and distinct botanical features>",
  "primary_use_impact": "<Specify if it is a cultivated food crop, a therapeutic/medicinal herb, an invasive weed requiring management, or a native tree>",
  "suitable_soil_type": "<Specify ideal soil textures like Loamy, Sandy, Clay, or Black soil, along with optimal pH ranges and drainage needs>",
  "ideal_weather_climate": "<Detail temperature ranges, annual rainfall requirements, and sunlight levels needed for optimal growth, e.g., Tropical, Semi-arid, Full Sun>",
  "native_region": "<Geographic origin & native regions, e.g. Central and South America / Widely grown across India>",
  "growth_stage": "<Vegetative / Flowering / Fruiting / Mature Canopy>",
  "leaf_type": "<Leaf morphology: shape, arrangement, margins, and venation>",
  "soil_type": "<Optimal soil type and pH range, e.g. Well-drained Loamy Soil (pH 6.0 - 6.8)>",
  "temperature_range": "<Ideal temperature range, e.g. 20°C - 35°C>",
  "water_requirement": "<Watering / irrigation need: Low / Moderate / High / Drip>",
  "sunlight_requirement": "<Sunlight requirement: Full Sun / Partial Shade>",
  "fertilizer_recommendation": "<Recommended NPK or organic manure schedule>",
  "economic_importance": "<Economic, medicinal, ecological, or timber value>",
  "common_uses": ["<Use 1>", "<Use 2>"],
  "common_diseases": ["<Disease 1>", "<Disease 2>"],
  "common_pests": ["<Pest 1>", "<Pest 2>"],
  "weed_eradication_advice": "<If is_weed is true, specify exact chemical herbicide & cultural control methods. Else write 'Not applicable - cultivated plant.'>",
  "regional_names": {{
    "te": "<Name in Telugu with Telugu script, e.g. మందార (Mandara)>",
    "hi": "<Name in Hindi with Devanagari script, e.g. गुड़हल (Gudhal)>",
    "ta": "<Name in Tamil>",
    "kn": "<Name in Kannada>",
    "ml": "<Name in Malayalam>",
    "mr": "<Name in Marathi>"
  }},
  "confidence": 98.4
}}
Output pure JSON only. Do not add markdown or extra conversational text."""

            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": b64_img}}
                    ]
                }],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 900}
            }

            models = ["gemini-flash-lite-latest", "gemini-flash-latest"]
            async with httpx.AsyncClient(timeout=8.0) as client:
                for model_name in models:
                    try:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                                parsed = safe_parse_json(text)
                                if parsed and isinstance(parsed, dict) and parsed.get("scientific_name"):
                                    parsed["identification_source"] = "gemini_vision_ai"
                                    parsed["model"] = "Google Gemini Multimodal Vision AI"
                                    logger.info(f"Gemini Vision successfully identified plant: {parsed.get('scientific_name')}")
                                    return parsed
                    except Exception as me:
                        logger.debug(f"Gemini model {model_name} plant identification attempt: {me}")
                        continue
        except Exception as e:
            logger.warning(f"Gemini Vision plant identification failed: {e}")

        return None

class PlantNetOnlineProvider(BaseOnlinePlantProvider):
    """
    Pl@ntNet Research Botanical Identification Provider.
    Queries the Pl@ntNet international flora vision API (300,000+ species) using the official API key,
    extracting scientific name, family, genus, and confidence, with seamless fallback to Gemini Vision.
    """

    def __init__(self, api_key: str, gemini_key: str = None, min_confidence: float = 15.0):
        self.api_key = api_key
        self.gemini_key = gemini_key
        self.min_confidence = min_confidence
        self.gemini_provider = GeminiVisionOnlineProvider(gemini_key) if gemini_key else None
        self.base_url = "https://my-api.plantnet.org/v2/identify/all"

    async def identify(self, image_path: str, crop_name: str = None, plant_type: str = "crop", tree_filter: str = None, organ: str = "leaf") -> dict:
        import asyncio
        import requests
        from backend.app.services.plant_identifier.plant_information import get_plant_info, PLANT_DATABASE, get_authentic_regional_names

        valid_organ = (organ or "leaf").lower().strip()
        if valid_organ not in ["leaf", "flower", "fruit", "bark"]:
            valid_organ = "leaf"

        def _sync_plantnet_call():
            try:
                with open(image_path, "rb") as f:
                    files = [("images", (os.path.basename(image_path), f, "image/jpeg"))]
                    data = {"organs": [valid_organ]}
                    url = f"{self.base_url}?api-key={self.api_key}&lang=en"
                    resp = requests.post(url, files=files, data=data, timeout=8.0)
                    if resp.status_code == 200:
                        payload = resp.json()
                        results = payload.get("results", [])
                        if results:
                            top = results[0]
                            species_obj = top.get("species", {})
                            sci_name = species_obj.get("scientificNameWithoutAuthor", "")
                            genus_name = species_obj.get("genus", {}).get("scientificNameWithoutAuthor", "") or (sci_name.split()[0] if sci_name else "")
                            species_epithet = sci_name.split()[1] if len(sci_name.split()) > 1 else ""
                            family_name = species_obj.get("family", {}).get("scientificNameWithoutAuthor", "")
                            common_names = species_obj.get("commonNames", [])
                            score = float(top.get("score", 0.0)) * 100.0

                            # If confidence is below threshold, return None to trigger Gemini Vision second opinion
                            min_conf = getattr(self, "min_confidence", 15.0)
                            if score < min_conf:
                                logger.info(f"Pl@ntNet score too low ({score:.1f}% < {min_conf}%), deferring to Gemini Vision")
                                return None

                            # Check if local database matches this scientific name, genus, or common name
                            matched_dict = None
                            sci_lower = sci_name.lower()
                            for key in [sci_name, genus_name, sci_lower]:
                                info = get_plant_info(key)
                                if info and info.get("scientific_name", "").lower() in sci_lower:
                                    matched_dict = info
                                    break

                            if not matched_dict and common_names:
                                for cname in common_names:
                                    info = get_plant_info(cname)
                                    if info:
                                        matched_dict = info
                                        break

                            best_common = common_names[0].title() if common_names else sci_name

                            is_weed = any(w in sci_lower or w in best_common.lower() for w in [
                                "weed", "parthenium", "cyperus", "trianthema", "amaranthus",
                                "chenopodium", "portulaca", "echinochloa", "digitaria", "eclipta",
                                "achyranthes", "commelina", "argemone", "tridax", "acalypha", "digera", "leucas"
                            ])

                            if matched_dict:
                                plant_dict = matched_dict.copy()
                                plant_dict["scientific_name"] = sci_name
                                plant_dict["genus"] = genus_name
                                plant_dict["species"] = species_epithet
                                if family_name:
                                    plant_dict["family"] = family_name
                                plant_dict["is_weed"] = is_weed
                                plant_dict["identified_type"] = matched_dict.get("identified_type", "Weed" if is_weed else ("Tree" if plant_type == "tree" else "Crop"))
                                plant_dict["confidence"] = round(score, 1)
                            else:
                                plant_dict = {
                                    "common_name": f"{best_common}",
                                    "scientific_name": sci_name,
                                    "genus": genus_name,
                                    "species": species_epithet,
                                    "family": family_name or "Botanical Family",
                                    "identified_type": "Weed" if is_weed else ("Tree" if plant_type == "tree" else "Crop"),
                                    "category": "Agricultural Weed" if is_weed else ("Normal Tree" if plant_type == "tree" else "Agricultural Plant / Flora"),
                                    "is_weed": is_weed,
                                    "description": f"Botanical specimen identified as {sci_name} ({best_common}) belonging to family {family_name} via Pl@ntNet Global Flora research database.",
                                    "native_region": "Global & Indian Subcontinent",
                                    "growth_stage": "Vegetative / Foliage / Active Flowering",
                                    "growing_season": "Kharif & Rabi Seasons",
                                    "harvest_season": "Standard Cultivation / Growth Period",
                                    "soil_type": "Well-drained Loamy Farm Soil (pH 6.0 - 7.5)",
                                    "temperature_range": "20°C - 35°C",
                                    "water_requirement": "Moderate Irrigation / Moisture",
                                    "sunlight_requirement": "Full Sunlight (6-8 hours daily)",
                                    "fertilizer_recommendation": "Balanced Organic Compost & Recommended NPK based on soil testing",
                                    "economic_importance": "Invasive agricultural weed - reduce crop competition" if is_weed else "Cultivated agricultural crop / ecological flora",
                                    "common_uses": ["Weed control target to protect crop yield"] if is_weed else ["Agricultural produce", "Foliar biomass", "Ecological biodiversity"],
                                    "common_diseases": ["Foliar Leaf Spots", "Blight Pathogens"],
                                    "common_pests": ["Thrips", "Aphids", "Caterpillars"],
                                    "weed_eradication_advice": "Apply selective post-emergence herbicide (e.g., 2,4-D or Pendimethalin) or perform timely manual weeding before seed dispersal." if is_weed else "Not applicable - cultivated plant.",
                                    "regional_names": get_authentic_regional_names(best_common or sci_name),
                                    "confidence": round(score, 1)
                                }

                            plant_dict["identification_source"] = "plantnet_botanical_ai"
                            plant_dict["model"] = "Pl@ntNet Global Flora AI (300,000+ Species)"
                            return plant_dict
            except Exception as e:
                logger.warning(f"Pl@ntNet identification exception: {e}")
            return None

        # 1. Primary: Pl@ntNet Research API
        p_res = await asyncio.to_thread(_sync_plantnet_call)
        if p_res and p_res.get("scientific_name"):
            return p_res

        # 2. Seamless Fallback: Gemini Vision Multimodal AI
        if self.gemini_provider:
            logger.info("Engaging Gemini Vision AI as botanical second opinion...")
            g_res = await self.gemini_provider.identify(
                image_path=image_path,
                crop_name=crop_name,
                plant_type=plant_type,
                tree_filter=tree_filter,
                organ=valid_organ
            )
            if g_res and g_res.get("scientific_name"):
                return g_res

        return None

def get_online_provider() -> BaseOnlinePlantProvider:
    """
    Factory function to return configured Online Plant Provider.
    Prioritizes Pl@ntNet official botanical API backed by Google Gemini Vision fallback,
    then standalone Gemini Vision, then NVIDIA NIM Vision AI, then Mock fallback.
    """
    from backend.app.core.config import settings
    plantnet_key = getattr(settings, "PLANTNET_API_KEY", "") or os.getenv("PLANTNET_API_KEY", "")
    gemini_key = getattr(settings, "GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")

    if plantnet_key and "mock" not in plantnet_key and "PASTE" not in plantnet_key:
        return PlantNetOnlineProvider(api_key=plantnet_key, gemini_key=gemini_key)

    if gemini_key and "mock" not in gemini_key and "PASTE" not in gemini_key:
        return GeminiVisionOnlineProvider(api_key=gemini_key)

    api_key = settings.NVIDIA_API_KEY or os.getenv("NVIDIA_API_KEY")
    if api_key and "mock-api-key" not in api_key:
        return NVIDIAOnlinePlantProvider()

    return NullOnlinePlantProvider()
