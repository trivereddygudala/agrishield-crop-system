import os
import re
import json
import base64
import logging
from typing import Optional, Dict, Any
import httpx
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

def safe_parse_json(text: str) -> Optional[dict]:
    """Extracts and parses JSON from markdown code fences or raw strings."""
    if not text:
        return None
    cleaned = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if match:
        cleaned = match.group(1).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        brace_match = re.search(r"(\{[\s\S]*\})", cleaned)
        if brace_match:
            try:
                return json.loads(brace_match.group(1))
            except Exception:
                pass
    return None

async def cross_verify_disease_with_vision(
    image_path: str,
    crop_hint: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Expert multimodal second opinion using Google Gemini Flash Vision.
    Triggers when local PyTorch model confidence is low (<75%), ambiguous, or flagged as OOD.
    Returns structured pathology, exact chemical & organic treatments, and regional naming.
    """
    gemini_key = getattr(settings, "GEMINI_API_KEY", "")
    if not gemini_key or "mock" in gemini_key or "PASTE" in gemini_key:
        logger.debug("Gemini API key not configured for vision cross-verification.")
        return None

    if not os.path.exists(image_path):
        logger.warning(f"Image path for Gemini vision verification does not exist: {image_path}")
        return None

    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        b64_img = base64.b64encode(image_bytes).decode("utf-8")

        prompt = f"""You are a senior agricultural plant pathologist and agronomist.
Analyze this photographed plant/leaf for precise crop identification, pathogen diagnosis, and treatment.
{f'Crop Hint: {crop_hint}' if crop_hint else ''}

Return ONLY a valid JSON object with the following exact keys:
{{
  "crop_name": "<Crop name in English, e.g. Tomato, Chilli, Rice, Cotton, Potato, Maize, Mango, Groundnut, Wheat, Soybean>",
  "disease_name": "<Specific plant disease name or 'Healthy Foliage', e.g. Late Blight, Early Blight, Powdery Mildew, Bacterial Spot, Leaf Curl, Blast, Sheath Blight, Yellow Vein Mosaic>",
  "pathogen_type": "<Fungal / Bacterial / Viral / Pest / Nutrient Deficiency / Healthy>",
  "is_healthy": <true or false>,
  "confidence": <confidence score between 0.85 and 0.99>,
  "severity": "<Mild / Moderate / Severe / Healthy>",
  "symptoms": ["<Observable visual symptom 1>", "<Observable visual symptom 2>"],
  "diagnostic_reasoning": "<1-2 sentence visual pathology reasoning based on lesion shapes, margins, halos, sporulation, or chlorosis>",
  "organic_remedies": ["<Specific organic or biological treatment, e.g. Neem oil spray 10000 ppm @ 5ml/L, Trichoderma viride @ 5g/L, Bordeaux mixture 1%>"],
  "chemical_remedies": ["<Specific active chemical formulation with exact dilution, e.g. Metalaxyl 8% + Mancozeb 64% WP @ 2.5 g/L water, Azoxystrobin 23% SC @ 1 ml/L>"],
  "prevention_steps": ["<Preventive agronomic practice 1>", "<Preventive agronomic practice 2>"],
  "regional_names": {{
    "te": "<Disease or crop condition in Telugu script, e.g. ఆలస్యపు తెగులు (లేట్ బ్లైట్)>",
    "hi": "<Disease or crop condition in Hindi script, e.g. पछेती झुलसा (लेट ब्लाइट)>"
  }}
}}
Do NOT output any conversational text or markdown explanation outside the JSON object."""

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": b64_img}}
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 600
            }
        }

        models_to_try = ["gemini-flash-latest", "gemini-flash-lite-latest"]
        async with httpx.AsyncClient(timeout=12.0) as client:
            for model_name in models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                text = "".join([p.get("text", "") for p in parts]).strip()
                                parsed = safe_parse_json(text)
                                if parsed and isinstance(parsed, dict) and parsed.get("crop_name"):
                                    logger.info(f"Gemini Vision cross-verification succeeded with model {model_name}")
                                    return parsed
                except Exception as m_err:
                    logger.debug(f"Gemini model {model_name} vision attempt: {m_err}")
                    continue

    except Exception as e:
        logger.warning(f"Gemini Vision disease cross-verification failed: {e}")

    return None

async def extract_agrochemical_label_vision(image_path: str) -> Optional[Dict[str, Any]]:
    """
    Reads commercial agrochemical bottle or pouch labels directly using Gemini Vision.
    Activated when local EasyOCR yields fewer than 3 words on crumpled or glossy containers.
    """
    gemini_key = getattr(settings, "GEMINI_API_KEY", "")
    if not gemini_key or "mock" in gemini_key or "PASTE" in gemini_key:
        return None

    if not os.path.exists(image_path):
        return None

    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        b64_img = base64.b64encode(image_bytes).decode("utf-8")

        prompt = """You are an expert agricultural chemist and agrochemical packaging inspector.
Read all visible text on this commercial agrochemical bottle, packet, or canister.

Extract and return ONLY a valid JSON object matching this exact structure:
{
  "brand_name": "<Commercial Brand Name on the package, e.g. Coragen, SAAF, Amistar Top, Tracer>",
  "manufacturer": "<Company / Manufacturer name, e.g. FMC, UPL, Syngenta, Bayer>",
  "active_ingredients": "<Technical Active chemical formulation with %, e.g. Chlorantraniliprole 18.5% SC, Mancozeb 64% + Carbendazim 12% WP>",
  "product_type": "<Fungicide / Insecticide / Herbicide / Fertilizer / Plant Growth Regulator>",
  "target_crops": ["<Crop 1>", "<Crop 2>", "<Crop 3>"],
  "dilution_rate_per_litre": "<Exact dilution per 1 Litre of clean water only, e.g. 0.4 mL / L or 2.0 g / L. Do NOT write per acre or 20L pump>",
  "toxicity_hazard": "<Green (Caution) / Blue (Warning) / Yellow (Danger) / Red (Poison)>",
  "extracted_text_summary": "<Key visible words and text extracted from the label>"
}
Do NOT output conversational text. Output pure JSON only."""

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": b64_img}}
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 600
            }
        }

        models_to_try = ["gemini-flash-lite-latest", "gemini-flash-latest"]
        async with httpx.AsyncClient(timeout=6.0) as client:
            for model_name in models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                text = parts[0].get("text", "").strip()
                                parsed = safe_parse_json(text)
                                if parsed and isinstance(parsed, dict) and parsed.get("brand_name"):
                                    logger.info(f"Gemini Vision agrochemical OCR succeeded with model {model_name}")
                                    return parsed
                except Exception as m_err:
                    logger.debug(f"Gemini model {model_name} agrochemical vision attempt: {m_err}")
                    continue

    except Exception as e:
        logger.warning(f"Gemini Vision agrochemical label OCR failed: {e}")

    return None
