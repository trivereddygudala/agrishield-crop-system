import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from .cache import analytics_cache
from .utils import parse_time_range, build_date_match_stage
from .statistics import calculate_summary_stats
from .aggregations import (
    get_top_crops_pipeline,
    get_top_diseases_pipeline,
    get_top_agrochemicals_pipeline,
    get_time_series_pipeline
)

class AnalyticsService:
    
    async def get_full_analytics(
        self, 
        db: Any, 
        user_id: str,
        time_range: str = "all", 
        start_date_str: Optional[str] = None, 
        end_date_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves full analytics summary for a specific user.
        Uses in-memory cache to prevent redundant DB aggregations.
        """
        # 1. Check Cache
        cache_key = f"analytics_{user_id}_{time_range}_{start_date_str}_{end_date_str}"
        cached_data = analytics_cache.get(cache_key)
        if cached_data:
            # We don't want to modify the cached object directly, but we want to return a fresh metadata wrapper
            response_copy = dict(cached_data)
            response_copy["metadata"] = {
                "api_version": "1.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "cache_status": "Cached",
                "cache_expires_in": None # We could calculate this if we tracked insertion time, but returning None is fine for now
            }
            return response_copy
            
        # 2. Build Base Match Stage (User + Time Filter)
        match_stage = {"user_id": user_id}
        
        start_date, end_date = parse_time_range(time_range, start_date_str, end_date_str)
        date_match = build_date_match_stage(start_date, end_date)
        if date_match:
            match_stage.update(date_match)
            
        # 3. Fetch Summary Stats
        stats = await calculate_summary_stats(db, match_stage)
        
        # 4. Fetch Top 5s and Time Series concurrently via asyncio.gather (B11-F05)
        (
            top_crops,
            top_diseases,
            top_agrochemicals,
            daily_scans,
            weekly_scans,
            monthly_scans
        ) = await asyncio.gather(
            db.predictions.aggregate(get_top_crops_pipeline(match_stage)).to_list(length=5),
            db.predictions.aggregate(get_top_diseases_pipeline(match_stage)).to_list(length=5),
            db.predictions.aggregate(get_top_agrochemicals_pipeline(match_stage)).to_list(length=5),
            db.predictions.aggregate(get_time_series_pipeline(match_stage, "daily")).to_list(length=100),
            db.predictions.aggregate(get_time_series_pipeline(match_stage, "weekly")).to_list(length=52),
            db.predictions.aggregate(get_time_series_pipeline(match_stage, "monthly")).to_list(length=12)
        )
        
        # 6. Generate Structured Insights
        insights = []
        if top_crops:
            insights.append({
                "id": "top_crop",
                "title": "Most Scanned Crop",
                "value": top_crops[0]["name"].capitalize(),
                "unit": None,
                "icon": "Sprout",
                "color": "green",
                "description": f"Accounts for {top_crops[0]['count']} recent scans"
            })
            
        if top_diseases:
            insights.append({
                "id": "top_disease",
                "title": "Most Common Disease",
                "value": top_diseases[0]["name"].capitalize(),
                "unit": None,
                "icon": "Bug",
                "color": "red",
                "description": f"Detected {top_diseases[0]['count']} times"
            })
            
        if stats["performance"]["average_inference_time_ms"] > 0:
            insights.append({
                "id": "avg_speed",
                "title": "Average Model Speed",
                "value": f"{stats['performance']['average_inference_time_ms']:.1f}",
                "unit": "ms",
                "icon": "Zap",
                "color": "blue",
                "description": "Average AI inference latency"
            })
            
        if stats["performance"]["average_confidence"] > 0:
            insights.append({
                "id": "avg_confidence",
                "title": "Average Confidence",
                "value": f"{stats['performance']['average_confidence'] * 100:.1f}",
                "unit": "%",
                "icon": "Target",
                "color": "purple",
                "description": "Overall prediction certainty"
            })

        # 7. Assemble Final Response
        response = {
            "metadata": {
                "api_version": "1.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "cache_status": "Live",
                "cache_expires_in": 300
            },
            "summary": {
                "time_range": time_range,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            },
            "counts": stats["counts"],
            "performance": stats["performance"],
            "top_crops": top_crops,
            "top_diseases": top_diseases,
            "top_agrochemicals": top_agrochemicals,
            "time_series": {
                "daily": daily_scans,
                "weekly": weekly_scans,
                "monthly": monthly_scans
            },
            "insights": insights
        }
        
        # 8. Set Cache (e.g. 5 minutes)
        # We cache it without the metadata (or with Live metadata, but we'll override it on hit)
        cache_payload = dict(response)
        analytics_cache.set(cache_key, cache_payload, ttl_seconds=300)
        
        return response

analytics_service = AnalyticsService()
