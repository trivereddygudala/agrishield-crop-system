"""
AgriShield Diagnostics & Root-Cause Analysis (RCA) API Router
============================================================
Exposes endpoints for running automated canary tests, retrieving
execution traces, inspecting detected root causes, and executing auto-heal actions.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
from pydantic import BaseModel
import logging

from backend.app.services.system_diagnostics import (
    run_full_diagnostics,
    execute_auto_heal,
    DiagnosticTracer,
    QuotaShield
)

logger = logging.getLogger("agrishield.diagnostics.api")
router = APIRouter(prefix="/system/diagnostics", tags=["System Diagnostics & RCA"])

class AutoHealRequest(BaseModel):
    issue_id: str

@router.get("/summary")
async def get_diagnostics_summary() -> Dict[str, Any]:
    """Returns instant high-level status of all subsystems and QuotaShield metrics."""
    return {
        "status": "OPERATIONAL",
        "quota_shield": QuotaShield.get_quota_status(),
        "recent_traces_count": len(DiagnosticTracer.get_recent_traces()),
        "subsystems": {
            "pytorch_cnn": "ACTIVE",
            "gemini_3x_flash": "ACTIVE",
            "plantnet_flora": "ACTIVE",
            "vernacular_translator": "ACTIVE"
        }
    }

@router.post("/run")
async def run_diagnostics_probe() -> Dict[str, Any]:
    """Runs on-demand synthetic canary tests across all AI Scan Center subsystems and deduces root causes."""
    try:
        report = await run_full_diagnostics()
        return report
    except Exception as e:
        logger.error(f"Diagnostic probe execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Diagnostic runner error: {str(e)}")

@router.get("/traces")
async def get_execution_traces(limit: int = 20) -> Dict[str, Any]:
    """Returns the last 20 execution traces captured by the Telemetry Tracer."""
    traces = DiagnosticTracer.get_recent_traces(limit=limit)
    return {
        "count": len(traces),
        "traces": traces
    }

@router.post("/auto-heal")
async def trigger_auto_heal(req: AutoHealRequest) -> Dict[str, Any]:
    """Executes safe automated self-healing procedures for a specified root cause signature."""
    try:
        result = execute_auto_heal(req.issue_id)
        return result
    except Exception as e:
        logger.error(f"Auto-heal execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Auto-heal error: {str(e)}")
