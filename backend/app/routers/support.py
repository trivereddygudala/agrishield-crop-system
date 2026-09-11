import random
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from bson import ObjectId

from backend.app.db.mongodb import get_database
from backend.app.routers.auth import get_current_user
from backend.app.core.security import require_role

router = APIRouter(prefix="/api/support", tags=["Farmer Support & Helpdesk"])

# ─────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────
class TicketCreateRequest(BaseModel):
    category: str = "general" # hardware_iot, crop_disease, weather_maps, billing_account, general
    subject: str
    description: str
    priority: str = "medium" # low, medium, high, urgent
    device_id: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = "en"
    attachments: Optional[List[str]] = []

class CallbackCreateRequest(BaseModel):
    phone: str
    farmer_name: Optional[str] = None
    language: Optional[str] = "te"
    issue_summary: Optional[str] = "Requesting phone callback from agricultural/technical officer"
    preferred_time: Optional[str] = "Within 15 minutes"

class TicketUpdateRequest(BaseModel):
    status: Optional[str] = None # open, in_progress, resolved, closed
    priority: Optional[str] = None
    assigned_agent: Optional[str] = None
    resolution_notes: Optional[str] = None

# ─────────────────────────────────────────────────────────────
# Helper: Format Ticket Document
# ─────────────────────────────────────────────────────────────
def format_ticket_doc(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "ticket_number": doc.get("ticket_number", f"TKT-{str(doc['_id'])[-4:].upper()}"),
        "user_id": doc.get("user_id"),
        "farmer_name": doc.get("farmer_name", "Farmer"),
        "farmer_email": doc.get("farmer_email", ""),
        "phone": doc.get("phone", ""),
        "language": doc.get("language", "en"),
        "location": doc.get("location", ""),
        "category": doc.get("category", "general"),
        "priority": doc.get("priority", "medium"),
        "status": doc.get("status", "open"),
        "subject": doc.get("subject", ""),
        "description": doc.get("description", ""),
        "device_id": doc.get("device_id"),
        "attachments": doc.get("attachments", []),
        "is_callback_request": doc.get("is_callback_request", False),
        "preferred_time": doc.get("preferred_time"),
        "assigned_agent": doc.get("assigned_agent"),
        "resolution_notes": doc.get("resolution_notes", ""),
        "created_at": doc.get("created_at", datetime.now(timezone.utc)).isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
        "updated_at": doc.get("updated_at", datetime.now(timezone.utc)).isoformat() if isinstance(doc.get("updated_at"), datetime) else doc.get("updated_at")
    }

# ─────────────────────────────────────────────────────────────
# Farmer Endpoints
# ─────────────────────────────────────────────────────────────
@router.post("/tickets")
async def create_support_ticket(
    payload: TicketCreateRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Farmer submits a technical, hardware, disease diagnosis, or account issue."""
    now_utc = datetime.now(timezone.utc)
    ticket_num = f"AGRI-{random.randint(1000, 9999)}"

    # Auto-acquire user location or phone if not supplied
    phone = payload.phone or current_user.get("phone") or ""
    location = current_user.get("farm_location") or current_user.get("location") or "Field Location"
    name = current_user.get("name") or current_user.get("full_name") or "Farmer"

    ticket_doc = {
        "ticket_number": ticket_num,
        "user_id": current_user["id"],
        "farmer_name": name,
        "farmer_email": current_user.get("email", ""),
        "phone": phone,
        "language": payload.language or current_user.get("preferred_language", "en"),
        "location": location,
        "category": payload.category,
        "priority": payload.priority,
        "status": "open",
        "subject": payload.subject.strip(),
        "description": payload.description.strip(),
        "device_id": payload.device_id,
        "attachments": payload.attachments or [],
        "is_callback_request": False,
        "assigned_agent": "Support Desk",
        "resolution_notes": "",
        "created_at": now_utc,
        "updated_at": now_utc
    }

    result = await db.support_tickets.insert_one(ticket_doc)
    ticket_doc["_id"] = result.inserted_id

    return {
        "success": True,
        "message": f"Support ticket #{ticket_num} created successfully! Our team will contact you shortly.",
        "ticket": format_ticket_doc(ticket_doc)
    }

@router.post("/callback-request")
async def request_support_callback(
    payload: CallbackCreateRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """1-Tap Request a Callback for farmers who prefer phone calls over typing."""
    now_utc = datetime.now(timezone.utc)
    ticket_num = f"CALL-{random.randint(1000, 9999)}"

    name = payload.farmer_name or current_user.get("name") or current_user.get("full_name") or "Farmer"
    location = current_user.get("farm_location") or current_user.get("location") or "Field Location"

    ticket_doc = {
        "ticket_number": ticket_num,
        "user_id": current_user["id"],
        "farmer_name": name,
        "farmer_email": current_user.get("email", ""),
        "phone": payload.phone.strip(),
        "language": payload.language or current_user.get("preferred_language", "te"),
        "location": location,
        "category": "callback_request",
        "priority": "urgent",
        "status": "open",
        "subject": f"Urgent 15-Min Phone Callback Request ({payload.language.upper()})",
        "description": payload.issue_summary or "Farmer requested phone consultation.",
        "is_callback_request": True,
        "preferred_time": payload.preferred_time or "Within 15 minutes",
        "assigned_agent": "Phone Support Queue",
        "resolution_notes": "",
        "created_at": now_utc,
        "updated_at": now_utc
    }

    result = await db.support_tickets.insert_one(ticket_doc)
    ticket_doc["_id"] = result.inserted_id

    return {
        "success": True,
        "message": f"Callback request #{ticket_num} received! A representative will call {payload.phone} shortly.",
        "ticket": format_ticket_doc(ticket_doc)
    }

@router.get("/tickets/my")
async def get_my_tickets(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Retrieve all tickets submitted by the authenticated farmer."""
    cursor = db.support_tickets.find({"user_id": current_user["id"]}).sort("created_at", -1)
    docs = await cursor.to_list(100)
    return [format_ticket_doc(d) for d in docs]

# ─────────────────────────────────────────────────────────────
# Support Admin Endpoints
# ─────────────────────────────────────────────────────────────
@router.get("/admin/tickets", dependencies=[Depends(require_role("admin"))])
async def list_admin_tickets(
    status_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db = Depends(get_database)
):
    """Admin endpoint to query and manage farmer support tickets."""
    query = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter
    if category_filter and category_filter != "all":
        query["category"] = category_filter
    if priority_filter and priority_filter != "all":
        query["priority"] = priority_filter
    if search:
        query["$or"] = [
            {"ticket_number": {"$regex": search, "$options": "i"}},
            {"farmer_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
            {"device_id": {"$regex": search, "$options": "i"}},
        ]

    total = await db.support_tickets.count_documents(query)
    cursor = db.support_tickets.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)

    return {
        "total": total,
        "tickets": [format_ticket_doc(d) for d in docs]
    }

@router.get("/admin/stats", dependencies=[Depends(require_role("admin"))])
async def get_admin_support_stats(db = Depends(get_database)):
    """Summary metrics for the Helpdesk command console."""
    total_tickets = await db.support_tickets.count_documents({})
    open_tickets = await db.support_tickets.count_documents({"status": "open"})
    in_progress = await db.support_tickets.count_documents({"status": "in_progress"})
    resolved = await db.support_tickets.count_documents({"status": "resolved"})
    urgent_callbacks = await db.support_tickets.count_documents({"status": "open", "is_callback_request": True})

    return {
        "total": total_tickets,
        "open": open_tickets,
        "in_progress": in_progress,
        "resolved": resolved,
        "urgent_callbacks": urgent_callbacks
    }

@router.patch("/admin/tickets/{ticket_id}", dependencies=[Depends(require_role("admin"))])
async def update_ticket_status(
    ticket_id: str,
    payload: TicketUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Admin endpoint to resolve tickets, add resolution notes, or update priority."""
    try:
        obj_id = ObjectId(ticket_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID format")

    update_fields = {"updated_at": datetime.now(timezone.utc)}
    if payload.status:
        update_fields["status"] = payload.status
    if payload.priority:
        update_fields["priority"] = payload.priority
    if payload.assigned_agent:
        update_fields["assigned_agent"] = payload.assigned_agent
    if payload.resolution_notes is not None:
        update_fields["resolution_notes"] = payload.resolution_notes

    res = await db.support_tickets.find_one_and_update(
        {"_id": obj_id},
        {"$set": update_fields},
        return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    return {
        "success": True,
        "message": "Ticket updated successfully",
        "ticket": format_ticket_doc(res)
    }
