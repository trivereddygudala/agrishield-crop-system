"""
Dedicated Agrochemical Product Scanner & Comparison Router (agrochemical.py)
Provides OCR packaging analysis, chemical formula classification (Pesticide, Fungicide,
Insecticide, Fertilizer), multi-product comparisons, and vernacular language translation.
"""
import os
import sys
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger("agrochemical")

from backend.app.db.mongodb import get_database
from backend.app.routers.auth import get_current_user
from backend.app.models.schemas import PredictRequest, TranslateAgrochemicalRequest, AgrochemicalCompareRequest

# Translation helper
from backend.app.routers.predict import translate_agrochemical_data

router = APIRouter(tags=["Agrochemical Product Scanner & Safety"])


@router.post("/agrochemical-scan")
@router.post("/scan-agrochemical")
@router.post("/scan")
async def agrochemical_scan_endpoint(
    req: PredictRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Intelligent Agrochemical Product Scanner Endpoint.
    Extracts OCR text, matches botanical/chemical database, saves scan history to MongoDB,
    and returns structured product intelligence.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    clean_rel = req.image_path.replace("/", os.sep).lstrip(os.sep)
    candidate_paths = [
        os.path.join(base_dir, clean_rel),
        os.path.abspath(req.image_path)
    ]
    full_image_path = next((p for p in candidate_paths if os.path.exists(p)), None)

    if not full_image_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specified image file does not exist on server."
        )

    try:
        from backend.app.services.agrochemical_detector import detect_agrochemical
        agro_res = await asyncio.to_thread(detect_agrochemical, full_image_path, True)
        info = agro_res.get("info", {})
        extracted_text = agro_res.get("extracted_text", "")

        now = datetime.now(timezone.utc)

        # Save scan to MongoDB predictions history
        scan_record = {
            "user_id": str(current_user["id"]),
            "image_path": req.image_path,
            "crop_name": "Agrochemical Product",
            "disease_name": info.get("product_name", "Scanned Agrochemical"),
            "confidence": float(agro_res.get("confidence", 95.0) / 100.0 if agro_res.get("confidence", 95.0) > 1.0 else agro_res.get("confidence", 0.95)),
            "prediction_date": now.strftime("%Y-%m-%d"),
            "prediction_time": now.strftime("%H:%M:%S"),
            "prediction_status": "agrochemical",
            "created_at": now,
            "brand": info.get("brand", "AgriShield Certified"),
            "product_type": info.get("product_type", "Agrochemical"),
            "active_ingredients": info.get("active_ingredients", "N/A"),
            "language": req.language or "en",
            "extracted_text": extracted_text,
            "symptoms": f"Category: {info.get('product_type', 'Agrochemical')}\nBrand: {info.get('brand', 'Standard')}",
            "organic_treatment": f"Usage Protocol:\n{info.get('recommended_dosage', 'Apply as directed.')}",
            "chemical_treatment": f"Active Formulation: {info.get('active_ingredients', 'N/A')}"
        }
        try:
            if db is not None:
                await db.predictions.insert_one(scan_record)
        except Exception as db_err:
            logger.warning(f"Failed to record agrochemical scan history: {db_err}")

        # Assemble full analytical response
        target_crops = info.get("target_crops", [])
        if isinstance(target_crops, str):
            target_crops = [c.strip() for c in target_crops.split(",") if c.strip()]

        target_diseases = info.get("target_diseases", [])
        if isinstance(target_diseases, str):
            target_diseases = [d.strip() for d in target_diseases.split(",") if d.strip()]

        target_pests = info.get("target_pests", [])
        if isinstance(target_pests, str):
            target_pests = [p.strip() for p in target_pests.split(",") if p.strip()]

        scan_result = {
            "success": True,
            "is_agrochemical": True,
            "product_name": info.get("product_name", "Identified Agricultural Formulation"),
            "brand": info.get("brand", "AgriShield Verified"),
            "category": info.get("category", "Pesticide"),
            "product_type": info.get("product_type", "Broad Spectrum Formulation"),
            "active_ingredients": info.get("active_ingredients", "Formulation Matrix"),
            "formulation": info.get("formulation", "EC/SC/WP Liquid Concentrate"),
            "target_crops": target_crops,
            "target_diseases": target_diseases,
            "target_pests": target_pests,
            "recommended_dosage": info.get("recommended_dosage", "Dilute 2.0 mL per Litre of clean water."),
            "mixing_ratio": info.get("mixing_ratio", "2.0 mL / L water"),
            "spray_interval": info.get("spray_interval", "Repeat after 10-14 days if pest pressure persists."),
            "toxicity_class": info.get("toxicity_class", "Green Label (Slightly Toxic)"),
            "hazard_level": info.get("hazard_level", "Caution"),
            "antidote": info.get("antidote", "Treat symptomatically. Contact medical professional immediately."),
            "protective_equipment": info.get("protective_equipment", [
                "Wear nitrile gloves during preparation.",
                "Wear N95 respiratory mask while spraying.",
                "Wash exposed skin thoroughly with soap."
            ]),
            "storage": info.get("storage_instructions", "Store below 25°C in a dry place."),
            "disposal": info.get("disposal_instructions", "Dispose according to local regulations."),
            "compatibleProducts": info.get("compatible_products", []),
            "incompatibleProducts": info.get("incompatible_products", []),
            "extracted_text": extracted_text,
            "gemini_vision_used": agro_res.get("gemini_vision_used", False),
            "source": agro_res.get("source", "gemini_vision_ocr"),
            # 3 Structured Agrochemical Intelligence Sections
            "product_details": agro_res.get("product_details", info.get("product_details", {})),
            "user_instructions": agro_res.get("user_instructions", info.get("user_instructions", {})),
            "chemical_explanation": agro_res.get("chemical_explanation", info.get("chemical_explanation", {})),
            # Structured AI Assistant Breakdown
            "product_overview": f"{info.get('product_name')} by {info.get('brand')}. {info.get('product_type')}.",
            "suitable_crops": target_crops,
            "suitable_diseases": target_diseases,
            "suitable_pests": target_pests,
            "recommended_dosage": info.get("recommended_dosage"),
            "mixing_instructions": f"Dissolve {info.get('mixing_ratio')} in clean water. Stir thoroughly before spraying.",
            "application_timing": info.get("spray_interval"),
            "safety_instructions": info.get("protective_equipment"),
            "farmer_tips": [
                "Always spray during early morning or late evening hours to protect beneficial pollinators.",
                "Ensure uniform foliar coverage on both upper and lower leaf surfaces.",
                "Do not mix with incompatible chemicals to prevent precipitation or crop injury."
            ]
        }

        # Automatic Multilingual Translation for Agrochemical Scan
        target_lang = (req.language or "en").lower().split("-")[0].strip()
        if target_lang != "en":
            scan_result = await translate_agrochemical_data(scan_result, target_lang)

        return scan_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agrochemical scan error: {str(e)}"
        )


@router.post("/translate-agrochemical")
async def translate_agrochemical_endpoint(
    req: TranslateAgrochemicalRequest
):
    """
    On-demand translation endpoint for active agrochemical scan results.
    Enables instantaneous UI language switching for farmers on scanned agricultural products.
    """
    try:
        target_lang = (req.language or "en").lower().split("-")[0].strip()
        if target_lang == "en":
            if "translations" in req.agrochemical and "en" in req.agrochemical["translations"]:
                return {"success": True, "agrochemical": req.agrochemical["translations"]["en"]}
            return {"success": True, "agrochemical": req.agrochemical}

        translated = await translate_agrochemical_data(req.agrochemical, target_lang)
        return {"success": True, "agrochemical": translated}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agrochemical translation error: {str(e)}"
        )


@router.post("/agrochemical-compare")
async def compare_agrochemical_endpoint(
    req: AgrochemicalCompareRequest,
    current_user: dict = Depends(get_current_user)
):
    """Side-by-side comparison endpoint for two agrochemical products."""
    from backend.app.services.agrochemical_detector import compare_agrochemical_products
    return compare_agrochemical_products(req.product1, req.product2)


@router.get("/agrochemical-recommendations/{disease_name}")
async def agrochemical_recommendations_endpoint(
    disease_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Returns agrochemical product recommendations linked to a diagnosed crop disease."""
    from backend.app.services.agrochemical_detector import get_recommended_agrochemicals_for_disease
    return get_recommended_agrochemicals_for_disease(disease_name)
