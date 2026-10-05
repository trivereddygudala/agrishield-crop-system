import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from backend.app.services.weather import WeatherIntelligenceService
from backend.app.services.irrigation import SmartIrrigationService
from backend.app.services.risk_forecast import DiseaseRiskForecastService

logger = logging.getLogger(__name__)

# Agronomic Stage Nutrition Guidance
def get_stage_nutrition_recommendation(crop_name: str, growth_stage: str) -> Dict[str, Any]:
    norm_stage = (growth_stage or "Vegetative").strip().lower()
    crop_display = crop_name.title() if crop_name else "Crop"

    if any(s in norm_stage for s in ["seedling", "germination", "nursery", "transplant"]):
        return {
            "recommendation": f"Apply light starter fertilizer & root stimulant for {crop_display} seedlings.",
            "formulation": "19-19-19 (Water Soluble) + Humic Acid",
            "target_nutrients": "Balanced N-P-K with root development stimulator",
            "reasoning": [
                f"{crop_display} is in {growth_stage} stage with delicate root systems.",
                "Provide light phosphorus for secondary root establishment; avoid high-salinity granular urea."
            ],
            "dosage": "1.5 g/L foliar spray or fertigation",
            "priority": "Medium"
        }
    elif any(s in norm_stage for s in ["flower", "bud", "bloom", "anthesis"]):
        return {
            "recommendation": f"Apply Phosphorus-rich fertilizer & Boron for {crop_display} flowering.",
            "formulation": "12-61-0 (Monoammonium Phosphate) + 0.1% Solubor (Boron)",
            "target_nutrients": "High Phosphorus (P) & Boron, Low/Zero excess Nitrogen",
            "reasoning": [
                f"{crop_display} is in {growth_stage} stage. High phosphorus promotes vigorous floral retention.",
                "Avoid high nitrogen fertilization at this stage, as excess nitrogen causes flower abortion and vegetative runaway.",
                "Foliar Boron (1g/L) aids pollen tube elongation and improves fruit set percentage."
            ],
            "dosage": "3-4 g/L foliar or fertigation",
            "priority": "High"
        }
    elif any(s in norm_stage for s in ["fruit", "pod", "grain", "bulking", "tuber", "milking", "dough"]):
        return {
            "recommendation": f"Apply Potassium-rich fertilizer for {crop_display} fruit development.",
            "formulation": "0-0-50 (Sulfate of Potash / Potassium Sulfate) or 13-0-45",
            "target_nutrients": "High Potassium (K) & Calcium for fruit bulking and cell-wall density",
            "reasoning": [
                f"{crop_display} is actively in {growth_stage} stage. Potassium drives sugar translocation and fruit sizing.",
                "Calcium nitrate co-application prevents blossom end rot and strengthens epidermal cell walls against fungal penetration.",
                "Improves post-harvest shelf life and market grade."
            ],
            "dosage": "4-5 g/L foliar or fertigation",
            "priority": "High"
        }
    elif any(s in norm_stage for s in ["harvest", "matur", "ripen", "senesc"]):
        return {
            "recommendation": f"Halt chemical fertilization for {crop_display} maturity & observe harvest PHI.",
            "formulation": "None (Pre-Harvest Withholding Interval)",
            "target_nutrients": "Zero chemical inputs (Pre-Harvest Interval - PHI); taper soil moisture",
            "reasoning": [
                f"{crop_display} has reached {growth_stage} stage and is approaching harvest.",
                "Strictly observe Pre-Harvest Intervals (PHI) to ensure chemical residues remain within MRL safety limits.",
                "Taper off heavy irrigation to prevent fruit cracking and enhance soluble solid (Brix) concentration."
            ],
            "dosage": "0 (Withholding period)",
            "priority": "Low"
        }
    else:  # Vegetative / Default
        return {
            "recommendation": f"Apply Nitrogen-rich balanced fertilizer for {crop_display} vegetative canopy vigor.",
            "formulation": "Balanced 19-19-19 or Urea (1-2% foliar) + Micronutrient Mix",
            "target_nutrients": "Nitrogen (N) for chlorophyll synthesis and leaf canopy expansion",
            "reasoning": [
                f"{crop_display} is actively in {growth_stage} stage requiring nitrogen support for vegetative growth.",
                "Adequate canopy development is essential to intercept solar radiation before the reproductive phase.",
                "Combine with zinc sulfate (0.5g/L) to prevent interveinal chlorosis in younger leaves."
            ],
            "dosage": "3 g/L foliar or 25-30 kg/acre soil application",
            "priority": "Medium"
        }


def _is_item_expired(item: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Determines if an inventory item is past its expiration date or explicitly marked expired.
    """
    if not item or not isinstance(item, dict):
        return False, None

    if item.get("status") == "expired" or item.get("is_expired") is True:
        return True, str(item.get("expiry_date") or "Past date")

    exp_str = item.get("expiry_date")
    if exp_str:
        try:
            exp_date = datetime.strptime(str(exp_str).strip()[:10], "%Y-%m-%d").date()
            if exp_date < datetime.now().date():
                return True, str(exp_str)[:10]
        except Exception:
            pass
    return False, None


def _match_inventory_stock(recommended_names: List[str], inventory_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Cross-reference recommended chemical or fertilizer names against physical inventory.
    Explicitly checks expiration dates to ensure expired inputs are never validated as usable stock.
    """
    if not inventory_items:
        return {
            "in_stock": False,
            "is_expired": False,
            "badge": "Not in Inventory (Procure Input)",
            "badge_variant": "warning"
        }

    for target in recommended_names:
        clean_target = target.lower().strip()
        # Look for partial keyword matches in inventory
        for item in inventory_items:
            item_name = str(item.get("name") or "").lower().strip()
            item_cat = str(item.get("category") or "").lower().strip()
            item_active = str(item.get("active_ingredients") or "").lower().strip()

            # Direct or keyword match
            keywords = [k for k in clean_target.replace("/", " ").replace("-", " ").split() if len(k) > 3]
            match_found = clean_target in item_name or item_name in clean_target
            if not match_found and keywords:
                match_found = any(k in item_name or k in item_active for k in keywords)

            if match_found:
                qty = float(item.get("quantity") or 0.0)
                unit = str(item.get("unit") or "units")
                real_name = item.get("name") or target
                is_expired, exp_date_str = _is_item_expired(item)

                if is_expired:
                    return {
                        "in_stock": False,
                        "is_expired": True,
                        "expiry_date": exp_date_str,
                        "available_qty": qty,
                        "unit": unit,
                        "item_name": real_name,
                        "badge": "Expired Stock (Do Not Apply)",
                        "badge_variant": "destructive"
                    }
                elif qty > 0:
                    return {
                        "in_stock": True,
                        "is_expired": False,
                        "available_qty": qty,
                        "unit": unit,
                        "item_name": real_name,
                        "badge": f"In Stock ({qty} {unit} available)",
                        "badge_variant": "success"
                    }
                else:
                    return {
                        "in_stock": False,
                        "is_expired": False,
                        "available_qty": 0.0,
                        "unit": unit,
                        "item_name": real_name,
                        "badge": "Out of Stock (Restock Needed)",
                        "badge_variant": "destructive"
                    }

    return {
        "in_stock": False,
        "is_expired": False,
        "badge": "Not in Inventory (Procure Input)",
        "badge_variant": "warning"
    }


def extract_safety_protocols(agro_dict: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Extracts authoritative agrochemical safety and regulatory information.
    CRITICAL SAFETY REQUIREMENT: Extracts strictly fields present in authoritative database.
    Never invents or hallucinates safety intervals, application volumes, or certification standards.
    """
    if not agro_dict or not isinstance(agro_dict, dict):
        return None

    phi = agro_dict.get("preharvest_interval")
    rei = agro_dict.get("reentry_interval")
    tox = agro_dict.get("toxicity_level")
    ppe = agro_dict.get("protective_equipment")
    dosage = agro_dict.get("recommended_dosage_per_litre")
    interval = agro_dict.get("spray_interval")
    hazard_color = agro_dict.get("hazard_color")
    active_ing = agro_dict.get("active_ingredients")
    product_name = agro_dict.get("product_name")

    # If all core safety attributes are missing, return None
    if not any([phi, rei, tox, ppe]):
        return None

    authoritative_vol = agro_dict.get("authoritative_volume_per_acre") or agro_dict.get("spray_volume_litres_per_acre") or agro_dict.get("water_volume_per_acre_l")
    if authoritative_vol is not None:
        try:
            authoritative_vol = float(authoritative_vol)
            if authoritative_vol <= 0:
                authoritative_vol = None
        except (ValueError, TypeError):
            authoritative_vol = None

    source_val = agro_dict.get("source") or agro_dict.get("source_authority")

    res = {
        "product_name": product_name,
        "active_ingredients": active_ing,
        "preharvest_interval": phi,
        "reentry_interval": rei,
        "toxicity_level": tox,
        "hazard_color": hazard_color,
        "protective_equipment": ppe,
        "dosage_per_litre": dosage,
        "spray_interval": interval
    }
    if authoritative_vol is not None:
        res["authoritative_volume_per_acre"] = authoritative_vol
    if source_val:
        res["source_authority"] = source_val
    return res


def calculate_farm_application(
    dosage_str: Optional[str],
    farm_size_acres: float,
    inventory_match: Optional[Dict[str, Any]] = None,
    authoritative_volume_per_acre: Optional[float] = None,
    volume_unit: str = "L"
) -> Optional[Dict[str, Any]]:
    """
    Calculates total spray solution volume and required agrochemical product
    for the farmer's acreage ONLY when an authoritative application-volume value
    is explicitly provided in the application data.
    If no authoritative application volume exists (None or <= 0), returns None.
    NEVER uses universal assumptions or invented benchmarks.
    """
    if not dosage_str or not isinstance(dosage_str, str) or farm_size_acres <= 0:
        return None

    if authoritative_volume_per_acre is None or authoritative_volume_per_acre <= 0:
        return None

    import re
    match = re.search(r"(\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(\d+(?:\.\d+)?))?\s*(g|ml|mL|gram|grams)", dosage_str, re.IGNORECASE)
    if not match:
        return None

    low_val = float(match.group(1))
    high_val = float(match.group(2)) if match.group(2) else low_val
    unit_raw = match.group(3).lower()
    is_liquid = unit_raw in ["ml"]
    base_unit = "mL" if is_liquid else "g"
    bulk_unit = "L" if is_liquid else "kg"

    total_volume = round(farm_size_acres * float(authoritative_volume_per_acre), 1)
    min_chemical_needed = round(total_volume * low_val, 1)
    max_chemical_needed = round(total_volume * high_val, 1)

    if min_chemical_needed >= 1000:
        min_display = f"{min_chemical_needed / 1000:.2f} {bulk_unit}"
        max_display = f"{max_chemical_needed / 1000:.2f} {bulk_unit}" if high_val != low_val else min_display
        needed_summary = min_display if high_val == low_val else f"{min_display} – {max_display}"
    else:
        min_display = f"{min_chemical_needed:.0f} {base_unit}"
        max_display = f"{max_chemical_needed:.0f} {base_unit}" if high_val != low_val else min_display
        needed_summary = min_display if high_val == low_val else f"{min_display} – {max_display}"

    calc_res = {
        "farm_size_acres": farm_size_acres,
        "water_volume_litres": total_volume,
        "water_volume_display": f"{total_volume:.0f} {volume_unit}",
        "dosage_rate": dosage_str,
        "required_input_display": needed_summary,
        "authoritative_volume_per_acre": authoritative_volume_per_acre
    }

    if inventory_match and inventory_match.get("available_qty") is not None and not inventory_match.get("is_expired"):
        avail_qty = float(inventory_match.get("available_qty", 0.0))
        inv_unit = str(inventory_match.get("unit", "")).lower()

        avail_normalized = avail_qty
        if inv_unit in ["kg", "l", "litre", "litres", "kilogram", "kilograms"]:
            avail_normalized = avail_qty * 1000.0

        needed_for_comparison = max_chemical_needed
        if avail_qty <= 0:
            calc_res["stock_sufficiency"] = "out_of_stock"
            calc_res["stock_message"] = f"Stock Shortfall: You need {needed_summary} for {farm_size_acres} acres, but current inventory is 0."
        elif avail_normalized >= needed_for_comparison:
            rounds = int(avail_normalized // needed_for_comparison)
            calc_res["stock_sufficiency"] = "sufficient"
            calc_res["stock_message"] = f"Sufficient Stock: {needed_summary} required for {farm_size_acres} acres ({avail_qty} {inventory_match.get('unit')} available in storage — covers {rounds} spray application{'s' if rounds > 1 else ''})."
        else:
            calc_res["stock_sufficiency"] = "shortfall"
            deficit = needed_for_comparison - avail_normalized
            def_str = f"{deficit / 1000:.2f} {bulk_unit}" if deficit >= 1000 else f"{deficit:.0f} {base_unit}"
            calc_res["stock_message"] = f"Stock Shortfall: {needed_summary} needed for {farm_size_acres} acres, but only {avail_qty} {inventory_match.get('unit')} available. Procure ~{def_str} more before preparing solution."

    return calc_res



class DailyRecommendationsService:
    def __init__(self, weather_service=None, irrigation_service=None, risk_service=None):
        self.weather_service = weather_service or WeatherIntelligenceService()
        self.irrigation_service = irrigation_service or SmartIrrigationService(weather_service=self.weather_service)
        self.risk_service = risk_service or DiseaseRiskForecastService(weather_service=self.weather_service)

    async def generate_daily_recommendations(
        self,
        farm_id: Optional[str] = None,
        crop_name: str = "Tomato",
        growth_stage: str = "Vegetative",
        farm_size: float = 1.0,
        lat: float = 28.6139,
        lon: float = 77.2090,
        db: Optional[Any] = None,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        now_iso = datetime.now(timezone.utc).isoformat() + "Z"

        # 1. Gather inputs from intelligence services
        weather = await self.weather_service.get_weather_for_farm(farm_id=farm_id, lat=lat, lon=lon)
        irrigation = await self.irrigation_service.calculate_irrigation_recommendation(
            farm_id=farm_id, crop_name=crop_name, growth_stage=growth_stage, farm_size_acres=farm_size, lat=lat, lon=lon
        )
        risk = await self.risk_service.calculate_disease_risk(farm_id=farm_id, crop_name=crop_name, lat=lat, lon=lon)

        # 2. Extract inventory if DB and farm_id are available
        inventory_items: List[Dict[str, Any]] = []
        if db is not None and farm_id and farm_id != "default":
            try:
                from bson import ObjectId
                query_cond = [{"farm_id": farm_id}, {"farm_id": str(farm_id)}]
                if ObjectId.is_valid(farm_id):
                    query_cond.append({"farm_id": ObjectId(farm_id)})
                cursor = db["farm_inventory"].find({"$or": query_cond, "is_archived": {"$ne": True}}).limit(50)
                inventory_items = await cursor.to_list(length=50)

                # Fallback: check farm profile doc
                if not inventory_items:
                    farm_doc = await db["farm_profiles"].find_one({
                        "$or": [{"id": farm_id}, {"_id": ObjectId(farm_id) if ObjectId.is_valid(farm_id) else farm_id}]
                    })
                    if farm_doc and farm_doc.get("inventory_items"):
                        inventory_items = farm_doc.get("inventory_items")
            except Exception as e:
                logger.warning(f"Error querying inventory in DailyRecommendationsService: {e}")

        # 3. Weather telemetry and spray window analysis
        ambient_weather = weather.get("current", {})
        rain_prob = float(ambient_weather.get("rain_probability", 20.0))
        wind_speed = float(ambient_weather.get("wind_speed", 3.5))

        spray_window = risk.get("spray_window") or {}
        spray_allowed = bool(spray_window.get("recommended", rain_prob <= 50.0 and wind_speed <= 5.5))

        # Dominant pathogen details
        dominant = risk.get("dominant_pathogen") or {}
        if isinstance(dominant, str):
            dominant_name = dominant
            dominant_risk = float(risk.get("overall_risk_percentage", risk.get("risk_percentage", 45.0)))
        elif isinstance(dominant, dict):
            dominant_name = dominant.get("name") or f"{crop_name} Fungal Risk"
            dominant_risk = float(dominant.get("risk_percentage") or risk.get("overall_risk_percentage", risk.get("risk_percentage", 45.0)))
        else:
            dominant_name = f"{crop_name} Fungal Risk"
            dominant_risk = float(risk.get("overall_risk_percentage", risk.get("risk_percentage", 45.0)))

        # Determine recommended chemical based on dominant pathogen & crop
        recommended_chemicals = ["Mancozeb 75% WP", "Neem Oil 0.5% EC"]
        primary_safety = None
        source_authority_chem = None
        try:
            from backend.app.services.agrochemical_detector import get_recommended_agrochemicals_for_disease
            rec_result = get_recommended_agrochemicals_for_disease(dominant_name)
            if rec_result and rec_result.get("recommendations"):
                top_recs = rec_result["recommendations"]
                recommended_chemicals = [
                    r.get("product_name") or r.get("active_ingredients") or "Fungicide"
                    for r in top_recs[:2]
                ]
                if top_recs:
                    primary_safety = extract_safety_protocols(top_recs[0])
                    source_authority_chem = top_recs[0].get("source") or top_recs[0].get("source_authority")
        except Exception:
            pass

        items: List[Dict[str, Any]] = []

        # ── ITEM 1: Weather & Rain Alert Recommendation ──
        weather_source = weather.get("source") or weather.get("source_authority")
        if rain_prob > 50:
            items.append({
                "id": "rec_rain_warning",
                "recommendation": f"Rain Expected Today ({rain_prob:.0f}% chance). Delay chemical sprays.",
                "confidence": 96.0,
                "reasoning": [
                    f"Precipitation probability is elevated at {rain_prob:.0f}%.",
                    "Foliar chemical sprays would be washed off before plant absorption.",
                    "Ensure drainage channels are clear to prevent water stagnation around roots."
                ],
                "priority": "High",
                "category": "Weather",
                "source_authority": weather_source,
                "generated_at": now_iso
            })

        # ── ITEM 2: Disease Prevention & Spray Window Gated Recommendation ──
        chem_name_str = " or ".join(recommended_chemicals[:2])
        inv_match_chem = _match_inventory_stock(recommended_chemicals, inventory_items)
        dosage_rate_chem = primary_safety.get("dosage_per_litre") if primary_safety else None
        auth_vol_chem = primary_safety.get("authoritative_volume_per_acre") if primary_safety else None
        farm_app_chem = calculate_farm_application(
            dosage_rate_chem, farm_size, inv_match_chem, authoritative_volume_per_acre=auth_vol_chem
        )

        if dominant_risk >= 50.0:
            if not spray_allowed:
                # Gated: High disease risk, but weather window prevents safe spraying (No conflicting advice!)
                if rain_prob > 50.0:
                    status_reason = f"Precipitation probability is {rain_prob:.0f}%, causing immediate chemical washout."
                    status_badge = "High Washout Risk"
                else:
                    status_reason = f"Wind velocity is {wind_speed * 3.6:.1f} km/h (threshold: 20 km/h), causing excessive drift."
                    status_badge = "High Drift Risk"

                disease_reasoning = [
                    f"High outbreak probability for {dominant_name} ({dominant_risk:.0f}%).",
                    f"SPRAY DELAYED: {status_reason}",
                    f"Prepare {chem_name_str} solution to apply immediately once leaf canopy dries and winds calm."
                ]
                if inv_match_chem.get("is_expired"):
                    disease_reasoning.append(
                        f"⚠️ STORAGE WARNING: {inv_match_chem['item_name']} in farm inventory expired on {inv_match_chem.get('expiry_date')}. This inventory item is expired and is not counted as usable stock. Do not apply expired stock."
                    )
                elif inv_match_chem["in_stock"]:
                    disease_reasoning.append(f"Storage check: {inv_match_chem['item_name']} ({inv_match_chem['available_qty']} {inv_match_chem['unit']}) is ready in farm inventory.")
                elif inv_match_chem.get("badge"):
                    disease_reasoning.append(f"Storage check: {inv_match_chem['badge']}.")

                if primary_safety:
                    phi = primary_safety.get("preharvest_interval")
                    rei = primary_safety.get("reentry_interval")
                    if phi and rei:
                        disease_reasoning.append(f"Safety Protocols: Pre-Harvest Interval (PHI) is {phi}; Field Re-entry Interval (REI) is {rei}.")
                    if primary_safety.get("protective_equipment"):
                        disease_reasoning.append(f"Mandatory PPE: {primary_safety.get('protective_equipment')}")

                if farm_app_chem and farm_app_chem.get("stock_message"):
                    disease_reasoning.append(farm_app_chem["stock_message"])

                items.append({
                    "id": "rec_spray_delayed",
                    "recommendation": f"Delay Spraying {chem_name_str} on {crop_name} — {status_badge}.",
                    "confidence": float(risk.get("confidence_score", 92.0)),
                    "reasoning": disease_reasoning,
                    "priority": "High",
                    "category": "Disease Risk",
                    "spray_window_status": status_badge,
                    "action_delayed": True,
                    "inventory_status": inv_match_chem,
                    "safety_protocols": primary_safety,
                    "farm_application_calc": farm_app_chem,
                    "source_authority": source_authority_chem,
                    "generated_at": now_iso
                })
            else:
                # Safe spray window is open
                best_timing = spray_window.get("best_time") or "Early morning (06:30 AM – 09:30 AM) or late afternoon"
                disease_reasoning = [
                    f"High outbreak probability for {dominant_name} ({dominant_risk:.0f}%).",
                    f"Safe atmospheric window is open (Rain: {rain_prob:.0f}%, Wind: {wind_speed * 3.6:.1f} km/h).",
                    f"Optimal spray timing: {best_timing}."
                ]
                if inv_match_chem.get("is_expired"):
                    disease_reasoning.append(
                        f"⚠️ STORAGE WARNING: {inv_match_chem['item_name']} in farm inventory expired on {inv_match_chem.get('expiry_date')}. This inventory item is expired and is not counted as usable stock. Do not apply expired stock."
                    )
                elif inv_match_chem["in_stock"]:
                    disease_reasoning.append(f"Available in farm inventory: {inv_match_chem['available_qty']} {inv_match_chem['unit']} of {inv_match_chem['item_name']}.")
                elif inv_match_chem.get("badge"):
                    disease_reasoning.append(f"Inventory status: {inv_match_chem['badge']}.")

                if primary_safety:
                    phi = primary_safety.get("preharvest_interval")
                    rei = primary_safety.get("reentry_interval")
                    if phi and rei:
                        disease_reasoning.append(f"Safety Protocols: Pre-Harvest Interval (PHI) is {phi}; Field Re-entry Interval (REI) is {rei}.")
                    if primary_safety.get("protective_equipment"):
                        disease_reasoning.append(f"Mandatory PPE: {primary_safety.get('protective_equipment')}")

                if farm_app_chem and farm_app_chem.get("stock_message"):
                    disease_reasoning.append(farm_app_chem["stock_message"])

                items.append({
                    "id": "rec_spray_optimal",
                    "recommendation": f"Spray {chem_name_str} on {crop_name} — Safe Window Open.",
                    "confidence": float(risk.get("confidence_score", 94.0)),
                    "reasoning": disease_reasoning,
                    "priority": "Critical" if dominant_risk >= 75.0 else "High",
                    "category": "Disease Risk",
                    "spray_window_status": "Safe Window Open",
                    "action_delayed": False,
                    "inventory_status": inv_match_chem,
                    "safety_protocols": primary_safety,
                    "farm_application_calc": farm_app_chem,
                    "source_authority": source_authority_chem,
                    "generated_at": now_iso
                })
        else:
            # Low / Moderate Risk: Monitoring
            items.append({
                "id": "rec_monitor_foliage",
                "recommendation": f"Monitor {crop_name} lower leaf canopy for early signs of {dominant_name}.",
                "confidence": 91.0,
                "reasoning": [
                    f"Disease outbreak risk is currently within moderate/low baseline threshold ({dominant_risk:.0f}%).",
                    "Inspect underside of bottom leaves and field border rows during routine scouting."
                ],
                "priority": "Low",
                "category": "Monitoring",
                "spray_window_status": "Monitoring Window",
                "action_delayed": False,
                "safety_protocols": None,
                "farm_application_calc": None,
                "source_authority": None,
                "generated_at": now_iso
            })

        # ── ITEM 3: Irrigation Recommendation ──
        irr_source = irrigation.get("source") or irrigation.get("source_authority")
        items.append({
            "id": "rec_irrigation",
            "recommendation": irrigation["recommendation"],
            "confidence": irrigation["confidence_score"],
            "reasoning": irrigation["reasoning"],
            "priority": "High" if irrigation["irrigation_required"] else "Medium",
            "category": "Irrigation",
            "source_authority": irr_source,
            "generated_at": now_iso
        })

        # ── ITEM 4: Stage-Specific Agronomic Nutrition ──
        stage_nutrition = get_stage_nutrition_recommendation(crop_name=crop_name, growth_stage=growth_stage)
        nutr_formulation = stage_nutrition.get("formulation", "Balanced N-P-K")
        inv_match_nutr = _match_inventory_stock([nutr_formulation, "Urea", "19-19-19", "DAP", "Potash"], inventory_items)
        nutr_dosage = stage_nutrition.get("dosage")
        auth_vol_nutr = stage_nutrition.get("authoritative_volume_per_acre")
        farm_app_nutr = calculate_farm_application(
            nutr_dosage, farm_size, inv_match_nutr, authoritative_volume_per_acre=auth_vol_nutr
        )

        nutr_reasoning = list(stage_nutrition.get("reasoning", []))
        if inv_match_nutr.get("is_expired"):
            nutr_reasoning.append(
                f"⚠️ STORAGE WARNING: {inv_match_nutr['item_name']} in farm inventory expired on {inv_match_nutr.get('expiry_date')}. This inventory item is expired and is not counted as usable stock. Do not apply expired stock."
            )
        elif inv_match_nutr["in_stock"]:
            nutr_reasoning.append(f"Storage check: {inv_match_nutr['item_name']} ({inv_match_nutr['available_qty']} {inv_match_nutr['unit']}) available in inventory.")
        elif inv_match_nutr.get("badge") and "Not in Inventory" not in inv_match_nutr.get("badge", ""):
            nutr_reasoning.append(f"Storage check: {inv_match_nutr['badge']}.")

        if farm_app_nutr and farm_app_nutr.get("stock_message"):
            nutr_reasoning.append(farm_app_nutr["stock_message"])

        nutr_source = stage_nutrition.get("source") or stage_nutrition.get("source_authority")
        items.append({
            "id": "rec_fertilizer",
            "recommendation": stage_nutrition["recommendation"],
            "confidence": 92.0,
            "reasoning": nutr_reasoning,
            "priority": stage_nutrition.get("priority", "Medium"),
            "category": "Nutrition",
            "growth_stage": growth_stage,
            "target_nutrients": stage_nutrition.get("target_nutrients"),
            "dosage": stage_nutrition.get("dosage"),
            "inventory_status": inv_match_nutr,
            "safety_protocols": None,
            "farm_application_calc": farm_app_nutr,
            "source_authority": nutr_source,
            "generated_at": now_iso
        })

        processing_time_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "metadata": {
                "api_version": "2.2",
                "generated_at": now_iso,
                "processing_time_ms": processing_time_ms,
                "cache_status": "Live",
                "cache_expires_in": 1800,
                "crop_name": crop_name,
                "growth_stage": growth_stage,
                "farm_size_acres": farm_size,
                "spray_allowed": spray_allowed,
                "dominant_pathogen": dominant_name
            },
            "recommendations": items
        }
