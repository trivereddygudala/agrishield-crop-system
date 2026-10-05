import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from bson import ObjectId

from backend.app.models.harvest_season import (
    HarvestCreate,
    HarvestRecord,
    SaleCreate,
    SaleRecord,
    SeasonCreate,
    SeasonCloseRequest,
    SeasonScorecardResponse,
    SeasonResponse,
    normalize_to_quintals,
    VALID_HARVEST_UNITS
)

logger = logging.getLogger(__name__)


def serialize_mongo_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to cleanly serialize Mongo document ObjectIds and datetimes."""
    if not doc:
        return {}
    d = dict(doc)
    d["id"] = str(d.get("id") or d.get("season_id") or d.get("_id"))
    d["_id"] = str(d.get("_id"))
    if "created_at" in d and isinstance(d["created_at"], datetime):
        d["created_at"] = d["created_at"].isoformat()
    if "updated_at" in d and isinstance(d["updated_at"], datetime):
        d["updated_at"] = d["updated_at"].isoformat()
    if "closed_at" in d and isinstance(d["closed_at"], datetime):
        d["closed_at"] = d["closed_at"].isoformat()
    return d


class HarvestSeasonService:

    @staticmethod
    async def get_or_create_active_season(db, farm_id: str, user_id: str, farm_doc: dict) -> dict:
        """Find the currently active season for a farm, or automatically initialize

        one using the authoritative farm profile parameters.
        """
        active_season = await db["farm_seasons"].find_one({
            "farm_id": farm_id,
            "status": "active"
        })
        if active_season:
            return active_season

        # Initialize from existing farm profile
        now = datetime.now(timezone.utc)
        crop_name = farm_doc.get("crop_name") or "Mixed Crop"
        variety = farm_doc.get("crop_variety")
        area = float(farm_doc.get("farm_size", 1.0))
        area_unit = farm_doc.get("farm_unit", "acres")
        planting_date = farm_doc.get("planting_date")
        year_str = planting_date[:4] if planting_date and len(planting_date) >= 4 else str(now.year)
        season_name = f"{crop_name} Season {year_str}"
        season_id = f"season-{uuid.uuid4().hex[:10]}"

        season_doc = {
            "id": season_id,
            "season_id": season_id,
            "farm_id": farm_id,
            "user_id": user_id,
            "field_id": farm_doc.get("field_name") or (f"Field 1" if farm_doc.get("number_of_fields") else None),
            "season_name": season_name,
            "crop_name": crop_name,
            "variety": variety,
            "area": area,
            "area_unit": area_unit,
            "planting_date": planting_date,
            "season_start_date": planting_date or now.strftime("%Y-%m-%d"),
            "season_end_date": None,
            "status": "active",
            "harvests": [],
            "sales": [],
            "scorecard": None,
            "created_at": now,
            "updated_at": now,
            "closed_at": None
        }

        try:
            await db["farm_seasons"].insert_one(season_doc)
            # Link current_season_id in farm_profile
            await db["farm_profiles"].update_one(
                {"$or": [{"id": farm_id}, {"_id": farm_doc.get("_id")}]},
                {"$set": {"current_season_id": season_id}}
            )
            return season_doc
        except Exception as e:
            logger.warning(f"Error creating initial season: {e}")
            # In case of concurrent creation, return whatever active season was stored
            active = await db["farm_seasons"].find_one({"farm_id": farm_id, "status": "active"})
            if active:
                return active
            return season_doc

    @staticmethod
    async def log_harvest(db, farm_id: str, user_id: str, payload: HarvestCreate, farm_doc: dict) -> dict:
        """Record a harvest batch for the designated season with idempotency and unit normalization."""
        if payload.quantity <= 0:
            raise ValueError("Harvest quantity must be greater than zero.")

        # Resolve target season
        if payload.season_id:
            season = await db["farm_seasons"].find_one({"season_id": payload.season_id, "farm_id": farm_id})
            if not season:
                raise ValueError("Specified season not found for this farm.")
            if season.get("status") == "closed":
                raise ValueError("Cannot add a harvest to a closed season.")
        else:
            season = await HarvestSeasonService.get_or_create_active_season(db, farm_id, user_id, farm_doc)

        season_id = season["season_id"]
        harvests = season.get("harvests", [])

        # Idempotency check: return existing if idempotency_key matches
        if payload.idempotency_key:
            for existing in harvests:
                if existing.get("idempotency_key") == payload.idempotency_key:
                    return existing

        now = datetime.now(timezone.utc)
        norm_qtl = normalize_to_quintals(payload.quantity, payload.unit)
        picking_num = payload.picking_number or (len(harvests) + 1)
        harvest_id = f"harv-{uuid.uuid4().hex[:10]}"

        harvest_entry = {
            "harvest_id": harvest_id,
            "season_id": season_id,
            "farm_id": farm_id,
            "field_id": payload.field_id or season.get("field_id"),
            "crop_name": season.get("crop_name"),
            "variety": payload.variety or season.get("variety"),
            "harvest_date": payload.harvest_date,
            "quantity": float(payload.quantity),
            "unit": payload.unit.strip().lower(),
            "normalized_quintals": norm_qtl,
            "grade": payload.grade.strip() if payload.grade else None,
            "picking_number": picking_num,
            "notes": payload.notes.strip() if payload.notes else None,
            "idempotency_key": payload.idempotency_key,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        await db["farm_seasons"].update_one(
            {"season_id": season_id},
            {
                "$push": {"harvests": harvest_entry},
                "$set": {"updated_at": now}
            }
        )

        return harvest_entry

    @staticmethod
    async def list_harvests(db, farm_id: str, season_id: Optional[str] = None) -> List[dict]:
        """List all harvest batches for a specific season, or the currently active season."""
        query: Dict[str, Any] = {"farm_id": farm_id}
        if season_id:
            query["season_id"] = season_id
        else:
            query["status"] = "active"

        season = await db["farm_seasons"].find_one(query)
        if not season:
            return []
        return season.get("harvests", [])

    @staticmethod
    async def record_sale(db, farm_id: str, user_id: str, payload: SaleCreate, farm_doc: dict) -> dict:
        """Record an actual crop sale with idempotency and optional Farm Khata integration."""
        if payload.quantity_sold <= 0:
            raise ValueError("Quantity sold must be greater than zero.")
        if payload.price_per_unit < 0:
            raise ValueError("Price per unit cannot be negative.")

        # Resolve target season
        if payload.season_id:
            season = await db["farm_seasons"].find_one({"season_id": payload.season_id, "farm_id": farm_id})
            if not season:
                raise ValueError("Specified season not found for this farm.")
        else:
            season = await HarvestSeasonService.get_or_create_active_season(db, farm_id, user_id, farm_doc)

        season_id = season["season_id"]
        sales = season.get("sales", [])

        # Idempotency check: return existing if idempotency_key matches
        if payload.idempotency_key:
            for existing in sales:
                if existing.get("idempotency_key") == payload.idempotency_key:
                    return existing

        now = datetime.now(timezone.utc)
        sale_id = f"sale-{uuid.uuid4().hex[:10]}"
        total_sale_value = round(float(payload.quantity_sold) * float(payload.price_per_unit), 2)
        crop_name = season.get("crop_name") or "Crop"

        khata_tx_id = None
        if payload.record_in_khata and total_sale_value > 0:
            op_ref = f"harvest-sale-{sale_id}"
            # Check if Khata entry with this booking reference already exists
            existing_khata = await db["farm_khata"].find_one({"farm_id": farm_id, "booking_id": op_ref})
            if not existing_khata:
                khata_doc = {
                    "id": f"khata-{uuid.uuid4().hex[:12]}",
                    "farm_id": farm_id,
                    "user_id": user_id,
                    "type": "income",
                    "category": "crop_sale",
                    "description": f"Harvest Sale: {payload.quantity_sold} {payload.unit} of {crop_name} @ ₹{payload.price_per_unit:,.2f}/{payload.unit}",
                    "amount": float(total_sale_value),
                    "date": payload.sale_date or now.strftime("%Y-%m-%d"),
                    "booking_id": op_ref,
                    "season": season.get("season_name"),
                    "field_id": payload.field_id or season.get("field_id"),
                    "crop_name": crop_name,
                    "is_estimated": False,
                    "payment_status": "paid",
                    "quantity": float(payload.quantity_sold),
                    "unit": payload.unit,
                    "vendor": payload.buyer or payload.mandi or "Mandi / Trader",
                    "created_at": now,
                    "updated_at": now
                }
                res = await db["farm_khata"].insert_one(khata_doc)
                khata_tx_id = str(res.inserted_id)
            else:
                khata_tx_id = str(existing_khata.get("id") or existing_khata.get("_id"))

        sale_entry = {
            "sale_id": sale_id,
            "season_id": season_id,
            "harvest_id": payload.harvest_id,
            "farm_id": farm_id,
            "field_id": payload.field_id or season.get("field_id"),
            "sale_date": payload.sale_date,
            "quantity_sold": float(payload.quantity_sold),
            "unit": payload.unit.strip().lower(),
            "price_per_unit": float(payload.price_per_unit),
            "total_sale_value": total_sale_value,
            "buyer": payload.buyer.strip() if payload.buyer else None,
            "mandi": payload.mandi.strip() if payload.mandi else None,
            "record_in_khata": bool(payload.record_in_khata),
            "khata_tx_id": khata_tx_id,
            "notes": payload.notes.strip() if payload.notes else None,
            "idempotency_key": payload.idempotency_key,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        await db["farm_seasons"].update_one(
            {"season_id": season_id},
            {
                "$push": {"sales": sale_entry},
                "$set": {"updated_at": now}
            }
        )

        return sale_entry

    @staticmethod
    async def list_sales(db, farm_id: str, season_id: Optional[str] = None) -> List[dict]:
        """List all sales records for a specific season, or the currently active season."""
        query: Dict[str, Any] = {"farm_id": farm_id}
        if season_id:
            query["season_id"] = season_id
        else:
            query["status"] = "active"

        season = await db["farm_seasons"].find_one(query)
        if not season:
            return []
        return season.get("sales", [])

    @staticmethod
    async def calculate_season_scorecard(db, farm_id: str, season_doc: dict) -> SeasonScorecardResponse:
        """Calculate the comprehensive Season Performance Scorecard using historical

        season area and authoritative actual harvest, sale, and Khata financial entries.
        """
        season_id = season_doc.get("season_id") or str(season_doc.get("_id"))
        season_name = season_doc.get("season_name") or "Crop Season"
        crop_name = season_doc.get("crop_name") or "Crop"
        variety = season_doc.get("variety")
        historical_area = float(season_doc.get("area") or 1.0)
        area_unit = season_doc.get("area_unit") or "acres"
        status_val = season_doc.get("status") or "active"

        harvests = season_doc.get("harvests", [])
        sales = season_doc.get("sales", [])

        # ── 1. Harvest & Yield Metrics ──
        total_harvest_qty = 0.0
        total_quintals = 0.0
        has_convertible_quintals = False
        pickings_count = len(harvests)

        for h in harvests:
            qty = float(h.get("quantity") or 0.0)
            total_harvest_qty += qty
            norm_qtl = h.get("normalized_quintals")
            if norm_qtl is not None:
                total_quintals += float(norm_qtl)
                has_convertible_quintals = True
            else:
                # Attempt on-the-fly normalization
                q_calc = normalize_to_quintals(qty, h.get("unit", ""))
                if q_calc is not None:
                    total_quintals += q_calc
                    has_convertible_quintals = True

        harvest_status = "actual" if pickings_count > 0 else "not_available"
        disp_total_qty = round(total_harvest_qty, 2) if pickings_count > 0 else None
        disp_total_quintals = round(total_quintals, 2) if (pickings_count > 0 and has_convertible_quintals) else None

        yield_per_acre_quintal = None
        yield_per_acre_kg = None
        yield_status = "not_available"

        if has_convertible_quintals and historical_area > 0:
            yield_per_acre_quintal = round(total_quintals / historical_area, 2)
            yield_per_acre_kg = round(yield_per_acre_quintal * 100.0, 2)
            yield_status = "actual"

        # ── 2. Actual Cultivation Expenses from Farm Khata ──
        # Query Khata for actual expenses associated with this farm & season
        khata_query: Dict[str, Any] = {
            "farm_id": farm_id,
            "type": "expense",
            "is_estimated": {"$ne": True}
        }

        # Match either exact season_id, or season_name, or crop_name
        season_khata_cursor = db["farm_khata"].find(khata_query)
        actual_expenses_sum = 0.0
        expenses_found = 0

        async for tx in season_khata_cursor:
            tx_season = (tx.get("season") or "").strip().lower()
            tx_crop = (tx.get("crop_name") or "").strip().lower()
            s_name_clean = season_name.strip().lower()
            c_name_clean = crop_name.strip().lower()

            # Include if tagged with this season, or tagged with this crop
            if tx_season == s_name_clean or (tx_crop and tx_crop == c_name_clean) or not tx.get("season"):
                actual_expenses_sum += float(tx.get("amount") or 0.0)
                expenses_found += 1

        actual_cultivation_cost = round(actual_expenses_sum, 2) if expenses_found > 0 else None
        expense_status = "actual" if expenses_found > 0 else "not_available"

        # ── 3. Actual Sales Revenue ──
        actual_sales_sum = 0.0
        sales_count = len(sales)
        for s in sales:
            actual_sales_sum += float(s.get("total_sale_value") or 0.0)

        actual_sales_income = round(actual_sales_sum, 2) if sales_count > 0 else None
        revenue_status = "actual" if sales_count > 0 else "not_available"

        # ── 4. Unit Economics: Net Profit, Cost/Quintal, Profit/Acre, ROI ──
        net_profit = None
        profit_status = "not_available"
        if actual_sales_income is not None and actual_cultivation_cost is not None:
            net_profit = round(actual_sales_income - actual_cultivation_cost, 2)
            profit_status = "actual"

        cost_per_quintal = None
        cost_per_quintal_status = "not_available"
        if actual_cultivation_cost is not None and total_quintals > 0 and has_convertible_quintals:
            cost_per_quintal = round(actual_cultivation_cost / total_quintals, 2)
            cost_per_quintal_status = "actual"

        profit_per_acre = None
        profit_per_acre_status = "not_available"
        if net_profit is not None and historical_area > 0:
            profit_per_acre = round(net_profit / historical_area, 2)
            profit_per_acre_status = "actual"

        actual_roi_percentage = None
        roi_status = "not_available"
        if net_profit is not None and actual_cultivation_cost is not None and actual_cultivation_cost > 0:
            actual_roi_percentage = round((net_profit / actual_cultivation_cost) * 100.0, 2)
            roi_status = "actual"

        return SeasonScorecardResponse(
            season_id=season_id,
            farm_id=farm_id,
            season_name=season_name,
            crop_name=crop_name,
            variety=variety,
            historical_area=historical_area,
            area_unit=area_unit,
            planting_date=season_doc.get("planting_date"),
            season_start_date=season_doc.get("season_start_date") or "",
            season_end_date=season_doc.get("season_end_date"),
            status=status_val,
            total_harvest_records_count=pickings_count,
            total_harvest_quantity=disp_total_qty,
            total_harvest_quintals=disp_total_quintals,
            harvest_status=harvest_status,
            total_pickings_count=pickings_count,
            yield_per_acre_quintal=yield_per_acre_quintal,
            yield_per_acre_kg=yield_per_acre_kg,
            yield_status=yield_status,
            actual_cultivation_cost=actual_cultivation_cost,
            expense_status=expense_status,
            actual_sales_income=actual_sales_income,
            revenue_status=revenue_status,
            net_profit=net_profit,
            profit_status=profit_status,
            cost_per_quintal=cost_per_quintal,
            cost_per_quintal_status=cost_per_quintal_status,
            profit_per_acre=profit_per_acre,
            profit_per_acre_status=profit_per_acre_status,
            actual_roi_percentage=actual_roi_percentage,
            roi_status=roi_status,
            harvests_summary=harvests,
            sales_summary=sales
        )

    @staticmethod
    async def close_season(db, farm_id: str, user_id: str, season_id: str, payload: SeasonCloseRequest) -> dict:
        """Close an active season, calculating the immutable final scorecard snapshot."""
        season = await db["farm_seasons"].find_one({"season_id": season_id, "farm_id": farm_id})
        if not season:
            raise ValueError("Season not found.")

        # Idempotency check: if already closed, return existing state safely
        if season.get("status") == "closed":
            return season

        now = datetime.now(timezone.utc)
        scorecard = await HarvestSeasonService.calculate_season_scorecard(db, farm_id, season)
        scorecard_dict = scorecard.model_dump()

        close_date = payload.season_end_date or now.strftime("%Y-%m-%d")

        update_fields = {
            "status": "closed",
            "season_end_date": close_date,
            "closed_at": now,
            "updated_at": now,
            "scorecard": scorecard_dict
        }
        if payload.notes:
            update_fields["close_notes"] = payload.notes.strip()

        await db["farm_seasons"].update_one(
            {"season_id": season_id},
            {"$set": update_fields}
        )

        updated_season = await db["farm_seasons"].find_one({"season_id": season_id})
        return updated_season

    @staticmethod
    async def start_new_season(db, farm_id: str, user_id: str, payload: SeasonCreate, farm_doc: dict) -> dict:
        """Start a new crop season for the farm without destroying or overwriting

        the previous season's historical data.
        """
        now = datetime.now(timezone.utc)

        # 1. Safely close any currently active season if requested
        if payload.close_previous_active:
            active_season = await db["farm_seasons"].find_one({"farm_id": farm_id, "status": "active"})
            if active_season:
                await HarvestSeasonService.close_season(
                    db,
                    farm_id,
                    user_id,
                    active_season["season_id"],
                    SeasonCloseRequest(season_end_date=now.strftime("%Y-%m-%d"), notes="Auto-closed for new crop rollover.")
                )

        # 2. Create the new season
        new_season_id = f"season-{uuid.uuid4().hex[:10]}"
        year_str = payload.planting_date[:4] if payload.planting_date and len(payload.planting_date) >= 4 else str(now.year)
        season_name = payload.season_name or f"{payload.crop_name} Season {year_str}"

        new_season_doc = {
            "id": new_season_id,
            "season_id": new_season_id,
            "farm_id": farm_id,
            "user_id": user_id,
            "field_id": payload.field_id or farm_doc.get("field_name"),
            "season_name": season_name,
            "crop_name": payload.crop_name,
            "variety": payload.variety,
            "area": float(payload.area),
            "area_unit": payload.area_unit,
            "planting_date": payload.planting_date,
            "season_start_date": payload.season_start_date or payload.planting_date or now.strftime("%Y-%m-%d"),
            "season_end_date": None,
            "status": "active",
            "harvests": [],
            "sales": [],
            "scorecard": None,
            "created_at": now,
            "updated_at": now,
            "closed_at": None
        }

        await db["farm_seasons"].insert_one(new_season_doc)

        # 3. Update the farm profile with new active crop context
        profile_update = {
            "crop_name": payload.crop_name,
            "crop_variety": payload.variety,
            "farm_size": float(payload.area),
            "farm_unit": payload.area_unit,
            "growth_stage": "Seedling",
            "planting_date": payload.planting_date,
            "current_season_id": new_season_id,
            "timeline_tasks": {},  # Fresh task map for new crop season
            "updated_at": now
        }
        await db["farm_profiles"].update_one(
            {"$or": [{"id": farm_id}, {"_id": farm_doc.get("_id")}]},
            {"$set": profile_update}
        )

        return new_season_doc

    @staticmethod
    async def list_seasons(db, farm_id: str) -> List[dict]:
        """List all seasons (active and closed) for a farm sorted by creation date."""
        cursor = db["farm_seasons"].find({"farm_id": farm_id}).sort("created_at", -1)
        seasons = await cursor.to_list(length=100)
        return [serialize_mongo_doc(s) for s in seasons]
