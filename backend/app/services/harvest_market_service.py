import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

from backend.app.models.harvest_season import normalize_to_quintals
from backend.app.services.harvest_season_service import HarvestSeasonService
from backend.app.routers.farmer.market import GOVT_MSP_DATABASE, LIVE_MANDI_DATA

logger = logging.getLogger(__name__)


class HarvestMarketService:
    """B25: Smart Harvest-to-Market Selling Intelligence Service.

    Connects authoritative B24 harvest/sales, B17 Khata cultivation cost,
    and APMC Mandi market references for farmer decision support.
    """

    @staticmethod
    def calculate_harvest_inventory(season_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate authoritative unsold produce stock from B24 harvests and sales.

        Strictly prevents negative stock and distinguishes actual vs not_available units.
        """
        if not season_doc:
            return {
                "farm_id": None,
                "season_id": None,
                "crop_name": None,
                "total_harvested": 0.0,
                "total_harvested_quintals": None,
                "total_sold": 0.0,
                "total_sold_quintals": None,
                "unsold_quantity": 0.0,
                "unsold_quintals": None,
                "unit": "quintal",
                "quantity_status": "not_available",
                "number_of_pickings": 0,
                "number_of_sales": 0,
                "is_fully_sold": False
            }

        farm_id = season_doc.get("farm_id")
        season_id = season_doc.get("season_id")
        crop_name = season_doc.get("crop_name") or "Crop"

        harvests = season_doc.get("harvests", [])
        sales = season_doc.get("sales", [])

        # ── 1. Aggregate Harvests ──
        total_harv_raw = 0.0
        total_harv_qtl = 0.0
        harv_has_convertible = False
        harv_units = set()

        for h in harvests:
            try:
                q = float(h.get("quantity") or 0.0)
            except (ValueError, TypeError):
                q = 0.0
            u = (h.get("unit") or "quintal").strip().lower()
            harv_units.add(u)
            total_harv_raw += q

            norm = h.get("normalized_quintals")
            if norm is not None:
                try:
                    total_harv_qtl += float(norm)
                    harv_has_convertible = True
                except (ValueError, TypeError):
                    pass
            else:
                calc_norm = normalize_to_quintals(q, u)
                if calc_norm is not None:
                    total_harv_qtl += calc_norm
                    harv_has_convertible = True

        # ── 2. Aggregate Sales ──
        total_sold_raw = 0.0
        total_sold_qtl = 0.0
        sold_has_convertible = False
        sold_units = set()

        for s in sales:
            try:
                q = float(s.get("quantity_sold") or 0.0)
            except (ValueError, TypeError):
                q = 0.0
            u = (s.get("unit") or "quintal").strip().lower()
            sold_units.add(u)
            total_sold_raw += q

            calc_norm = normalize_to_quintals(q, u)
            if calc_norm is not None:
                total_sold_qtl += calc_norm
                sold_has_convertible = True

        # ── 3. Determine Reconciled Unsold Stock ──
        # Default primary unit
        primary_unit = list(harv_units)[0] if len(harv_units) == 1 else ("quintal" if harv_has_convertible else "unit")

        unsold_qty = 0.0
        unsold_qtl = None
        quantity_status = "not_available"

        if len(harvests) == 0:
            quantity_status = "not_available"
            unsold_qty = 0.0
            unsold_qtl = None
        elif harv_has_convertible and (sold_has_convertible or len(sales) == 0):
            # Both sides are safely normalized to standard quintals
            total_harv_qtl = round(total_harv_qtl, 2)
            total_sold_qtl = round(total_sold_qtl, 2)
            if total_sold_qtl > total_harv_qtl:
                # Inconsistent data state: sales exceed harvests
                unsold_qty = None
                unsold_qtl = None
                quantity_status = "not_available"
            else:
                unsold_qtl = round(total_harv_qtl - total_sold_qtl, 2)
                unsold_qty = unsold_qtl
                primary_unit = "quintal"
                quantity_status = "actual"
        elif len(harv_units) == 1 and (len(sold_units) == 0 or (len(sold_units) == 1 and harv_units == sold_units)):
            # Same unit across all harvests and sales (e.g. crates)
            total_harv_raw = round(total_harv_raw, 2)
            total_sold_raw = round(total_sold_raw, 2)
            if total_sold_raw > total_harv_raw:
                # Inconsistent data state: sales exceed harvests
                unsold_qty = None
                unsold_qtl = None
                quantity_status = "not_available"
            else:
                unsold_qty = round(total_harv_raw - total_sold_raw, 2)
                unsold_qtl = None
                primary_unit = list(harv_units)[0]
                quantity_status = "actual"
        else:
            # Inconsistent or mixed unsupported units cannot be safely reconciled
            unsold_qty = None
            unsold_qtl = None
            quantity_status = "not_available"

        is_fully_sold = bool(len(harvests) > 0 and unsold_qty == 0.0 and quantity_status == "actual")

        return {
            "farm_id": farm_id,
            "season_id": season_id,
            "crop_name": crop_name,
            "total_harvested": round(total_harv_raw, 2) if len(harvests) > 0 else 0.0,
            "total_harvested_quintals": round(total_harv_qtl, 2) if harv_has_convertible else None,
            "total_sold": round(total_sold_raw, 2) if len(sales) > 0 else 0.0,
            "total_sold_quintals": round(total_sold_qtl, 2) if sold_has_convertible else None,
            "unsold_quantity": unsold_qty,
            "unsold_quintals": unsold_qtl,
            "unit": primary_unit,
            "quantity_status": quantity_status,
            "number_of_pickings": len(harvests),
            "number_of_sales": len(sales),
            "is_fully_sold": is_fully_sold
        }

    @staticmethod
    def calculate_reference_spread(
        modal_price: Optional[float],
        cost_per_quintal: Optional[float]
    ) -> Dict[str, Any]:
        """Compute the Reference Price Spread (Market Modal - Production Cost per Quintal).

        Clearly labeled as a reference spread, never guaranteed profit.
        """
        if modal_price is None or modal_price <= 0:
            return {
                "reference_spread": None,
                "spread_status": "NOT_AVAILABLE",
                "spread_label": "Market reference price not available"
            }

        if cost_per_quintal is None or cost_per_quintal <= 0:
            return {
                "reference_spread": None,
                "spread_status": "NOT_AVAILABLE",
                "spread_label": "Production cost not available"
            }

        spread = round(float(modal_price) - float(cost_per_quintal), 2)
        if spread > 0:
            return {
                "reference_spread": spread,
                "spread_status": "ABOVE_PRODUCTION_COST",
                "spread_label": f"₹{spread:,.2f}/Qtl above recorded production cost"
            }
        elif spread == 0:
            return {
                "reference_spread": 0.0,
                "spread_status": "AT_PRODUCTION_COST",
                "spread_label": "At recorded production cost"
            }
        else:
            return {
                "reference_spread": spread,
                "spread_status": "BELOW_PRODUCTION_COST",
                "spread_label": f"₹{abs(spread):,.2f}/Qtl below recorded production cost"
            }

    @staticmethod
    def find_matching_market_references(
        crop_name: str,
        variety: Optional[str] = None,
        district: Optional[str] = None,
        state: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve authoritative APMC Mandi rates and MSP benchmarks for the crop."""
        if not crop_name:
            return []

        c_lower = crop_name.strip().lower()
        v_lower = (variety or "").strip().lower()

        # Crop name aliases for Indian agriculture
        aliases = [c_lower]
        if "paddy" in c_lower or "rice" in c_lower:
            aliases.extend(["paddy", "rice", "paddy (rice)"])
        elif "tomato" in c_lower:
            aliases.extend(["tomato", "tamatar"])
        elif "chilli" in c_lower or "mirchi" in c_lower:
            aliases.extend(["chilli", "red chilli", "green chilli", "mirchi"])
        elif "cotton" in c_lower or "kapas" in c_lower:
            aliases.extend(["cotton", "kapas"])
        elif "maize" in c_lower or "corn" in c_lower:
            aliases.extend(["maize", "corn", "maize (corn)"])
        elif "groundnut" in c_lower or "peanut" in c_lower:
            aliases.extend(["groundnut", "peanut", "groundnut (peanut)"])
        elif "wheat" in c_lower:
            aliases.extend(["wheat", "gehun"])
        elif "onion" in c_lower:
            aliases.extend(["onion", "pyaz"])
        elif "potato" in c_lower:
            aliases.extend(["potato", "aloo"])
        elif "soybean" in c_lower:
            aliases.extend(["soybean", "soya"])

        # Find matching entries in LIVE_MANDI_DATA
        matched = []
        for item in LIVE_MANDI_DATA:
            item_crop = item.get("crop", "").lower()
            if any(alias in item_crop or item_crop in alias for alias in aliases):
                matched.append(dict(item))

        if not matched:
            return []

        # Find MSP if applicable
        matched_msp = None
        for msp_crop, msp_val in GOVT_MSP_DATABASE.items():
            msp_c_lower = msp_crop.lower()
            if any(alias in msp_c_lower or msp_c_lower in alias for alias in aliases):
                matched_msp = float(msp_val)
                break

        now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        formatted_sync_time = now_ist.strftime("%d %b %Y, %I:%M %p IST")

        results = []
        for m in matched:
            results.append({
                "mandi_name": m.get("mandi_name"),
                "location": f"{m.get('district', '')}, {m.get('state', '')}".strip(", "),
                "district": m.get("district"),
                "state": m.get("state"),
                "crop": m.get("crop"),
                "variety": m.get("variety"),
                "modal_price": float(m.get("modal_price", 0.0)),
                "min_price": float(m.get("min_price", 0.0)),
                "max_price": float(m.get("max_price", 0.0)),
                "grade": m.get("grade", "Standard Grade"),
                "msp_reference": m.get("msp_price") or matched_msp,
                "source": "Agmarknet APMC Central Grid / e-NAM Live Feeds",
                "updated_at": formatted_sync_time
            })

        # Sort: local district matches first, then highest modal price
        if district:
            d_clean = district.strip().lower()
            results.sort(key=lambda x: (0 if x.get("district", "").lower() == d_clean else 1, -x["modal_price"]))
        else:
            results.sort(key=lambda x: -x["modal_price"])

        return results

    @staticmethod
    async def get_selling_advisory(db, farm_id: str, current_user: dict, farm_doc: dict) -> Dict[str, Any]:
        """Aggregate unsold harvest inventory, authoritative production cost per quintal,

        and APMC Mandi reference prices into an actionable selling advisory.
        """
        # 1. Resolve Active Season & Scorecard
        active_season = await HarvestSeasonService.get_or_create_active_season(
            db, farm_id, current_user["id"], farm_doc
        )
        season_id = active_season["season_id"]
        crop_name = active_season.get("crop_name") or farm_doc.get("crop_name") or "Crop"
        variety = active_season.get("variety") or farm_doc.get("crop_variety")

        scorecard = await HarvestSeasonService.calculate_season_scorecard(db, farm_id, active_season)
        cost_per_qtl = scorecard.cost_per_quintal
        cost_status = scorecard.cost_per_quintal_status

        # 2. Compute Unsold Harvest Inventory
        inventory = HarvestMarketService.calculate_harvest_inventory(active_season)
        unsold_qty = inventory["unsold_quantity"]
        unsold_qtl = inventory["unsold_quintals"]
        unit = inventory["unit"]
        quantity_status = inventory["quantity_status"]

        # 3. Retrieve Market References
        district = farm_doc.get("district") or farm_doc.get("farm_location")
        state = farm_doc.get("state")
        mandi_references = HarvestMarketService.find_matching_market_references(
            crop_name=crop_name,
            variety=variety,
            district=district,
            state=state
        )

        # 4. Compute Spreads for Each Mandi Reference
        enriched_mandis = []
        best_modal = None
        for m in mandi_references:
            spread_info = HarvestMarketService.calculate_reference_spread(
                m["modal_price"], cost_per_qtl
            )
            item = dict(m)
            item.update(spread_info)
            enriched_mandis.append(item)
            if best_modal is None or m["modal_price"] > best_modal:
                best_modal = m["modal_price"]

        # 5. Government MSP Reference
        msp_ref = None
        for msp_c, msp_v in GOVT_MSP_DATABASE.items():
            if msp_c.lower() in crop_name.lower() or crop_name.lower() in msp_c.lower():
                msp_ref = float(msp_v)
                break

        msp_status = "available" if msp_ref is not None else "not_available"

        # 6. Estimated Reference Market Value of Unsold Inventory
        estimated_val = None
        value_status = "not_available"
        if unsold_qtl is not None and unsold_qtl > 0 and best_modal is not None and best_modal > 0:
            estimated_val = round(float(unsold_qtl) * float(best_modal), 2)
            value_status = "estimated"
        elif unsold_qty is not None and unsold_qty > 0 and best_modal is not None and best_modal > 0 and unit == "quintal":
            estimated_val = round(float(unsold_qty) * float(best_modal), 2)
            value_status = "estimated"

        return {
            "farm_id": farm_id,
            "season_id": season_id,
            "crop_name": crop_name,
            "variety": variety,
            "inventory": inventory,
            "cost_per_quintal": cost_per_qtl,
            "cost_status": cost_status,
            "government_msp_reference": msp_ref,
            "msp_status": msp_status,
            "msp_disclaimer": "Government MSP Reference Benchmark (2025-2026 Season)" if msp_ref else "MSP reference: Not available",
            "market_references": enriched_mandis,
            "market_references_count": len(enriched_mandis),
            "estimated_reference_market_value": estimated_val,
            "value_status": value_status,
            "value_disclaimer": "Estimated market reference value — not actual sale income",
            "source": "Agmarknet APMC Central Grid / e-NAM Live Feeds" if enriched_mandis else "Source information not available"
        }
