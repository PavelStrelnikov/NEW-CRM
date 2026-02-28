"""
Portal ticket API endpoints for client users.
Client users can view and manage tickets within their scope.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.models.tickets import Ticket, TicketEvent, TicketInitiator, CreatedByType
from app.models.users import ClientUser, ClientUserSite, InternalUser
from app.models.clients import Site
from app.models.time_billing import WorkLog
from app.guards import ClientUserClaims, get_client_user
from app.rbac import (
    can_create_portal_tickets,
    can_view_portal_tickets,
    can_view_portal_assets,
    check_client_user_client_access,
    filter_query_by_client_access
)

router = APIRouter()


# ========== Schemas ==========

class PortalTicketCreate(BaseModel):
    """Create a new ticket (portal)."""
    client_id: UUID  # Added for compatibility with frontend
    site_id: UUID
    title: str
    description: str
    category_id: Optional[UUID] = None
    priority: str = "normal"
    source_channel: str = "manual"
    reported_via: str = "phone"
    service_scope: str = "not_included"
    contact_phone: str
    contact_person_id: UUID  # Required: Who opened the ticket
    callback_contact_id: Optional[UUID] = None  # Optional: Who to call back
    asset_id: Optional[UUID] = None  # Optional: Primary asset link


class PortalTicketCommentCreate(BaseModel):
    """Add a comment to a ticket."""
    message: str


class PortalTicketResponse(BaseModel):
    """Portal ticket view (safe fields only)."""
    id: str
    ticket_number: str
    title: str
    description: str
    status: str
    priority: str
    created_at: str
    assigned_to_name: Optional[str]


# ========== Helper Functions ==========

def get_client_user_allowed_sites(db: Session, client_user_id: UUID) -> list[UUID]:
    """Get list of site IDs a client user can access."""
    user_sites = db.query(ClientUserSite).filter(
        ClientUserSite.client_user_id == client_user_id
    ).all()
    return [site.site_id for site in user_sites]


def check_client_user_site_access(
    db: Session,
    claims: ClientUserClaims,
    client_user_id: UUID,
    site_id: UUID
) -> bool:
    """Check if a client user has access to a specific site."""
    # First verify the site's client is accessible to the user
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        return False

    # Check if user can access this client
    if not check_client_user_client_access(db, claims, client_user_id, site.client_id):
        return False

    # Client admins have access to all sites in their accessible clients
    if claims.role == "CLIENT_ADMIN":
        return True

    # Client users must have explicit site access
    allowed_sites = get_client_user_allowed_sites(db, client_user_id)
    return site_id in allowed_sites


# ========== Endpoints ==========

@router.get("/tickets", response_model=dict)
async def list_client_tickets(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    List tickets visible to the portal user.

    - client_user: All tickets in their allowed sites
    - CLIENT_ADMIN: All tickets across all client sites

    Returns paginated response matching frontend TicketListResponse format.
    """
    claims, user = claims_and_user

    if not can_view_portal_tickets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    # Build query based on role with eager loading of relationships
    query = db.query(Ticket).options(
        joinedload(Ticket.status),
        joinedload(Ticket.category_ref),
        joinedload(Ticket.assigned_to)
    )
    query = filter_query_by_client_access(query, Ticket.client_id, claims)

    if claims.role == "CLIENT_USER" or claims.role == "CLIENT_CONTACT":
        # Filter by allowed sites
        allowed_sites = get_client_user_allowed_sites(db, user.id)
        if not allowed_sites:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        query = query.filter(Ticket.site_id.in_(allowed_sites))

    # Filter by status if provided
    if status:
        query = query.filter(Ticket.status_id == status)

    total = query.count()
    offset = (page - 1) * page_size
    tickets = query.order_by(Ticket.created_at.desc()).offset(offset).limit(page_size).all()

    # Return format matching frontend TicketListResponse
    return {
        "items": [
            {
                "id": str(ticket.id),
                "ticket_number": ticket.ticket_number,
                "client_id": str(ticket.client_id),
                "site_id": str(ticket.site_id),
                "title": ticket.title,
                "description": ticket.description,
                "category_id": str(ticket.category_id) if ticket.category_id else None,
                "category_code": ticket.category_ref.code if ticket.category_ref else None,
                "priority": ticket.priority,
                "status_id": str(ticket.status_id),
                "status_code": ticket.status.code if ticket.status else None,
                "source_channel": ticket.source_channel,
                "reported_via": ticket.reported_via,
                "service_scope": ticket.service_scope,
                "contact_phone": ticket.contact_phone,
                "contact_person_id": str(ticket.contact_person_id) if ticket.contact_person_id else None,
                "callback_contact_id": str(ticket.callback_contact_id) if ticket.callback_contact_id else None,
                "assigned_to_internal_user_id": str(ticket.assigned_to_internal_user_id) if ticket.assigned_to_internal_user_id else None,
                "assigned_to_name": ticket.assigned_to.name if ticket.assigned_to else None,
                "created_at": ticket.created_at.isoformat(),
                "updated_at": ticket.updated_at.isoformat(),
                "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None
            }
            for ticket in tickets
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/tickets/{ticket_id}", response_model=dict)
async def get_ticket_details(
    ticket_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get ticket details (portal view).

    Returns ticket object directly matching frontend Ticket/TicketDetailResponse type.
    """
    claims, user = claims_and_user

    if not can_view_portal_tickets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    # Get ticket with eager loading
    ticket = db.query(Ticket).options(
        joinedload(Ticket.status),
        joinedload(Ticket.category_ref),
        joinedload(Ticket.assigned_to),
        joinedload(Ticket.contact_person),
        joinedload(Ticket.callback_contact),
        joinedload(Ticket.events)
    ).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Check client access first
    if not check_client_user_client_access(db, claims, user.id, ticket.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this ticket")

    # Check site access for client_user
    if not check_client_user_site_access(db, claims, user.id, ticket.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this ticket")

    # Build contact info objects
    contact_person = None
    if ticket.contact_person:
        contact_person = {
            "id": str(ticket.contact_person.id),
            "name": ticket.contact_person.name,
            "phone": ticket.contact_person.phone,
            "email": ticket.contact_person.email
        }

    callback_contact = None
    if ticket.callback_contact:
        callback_contact = {
            "id": str(ticket.callback_contact.id),
            "name": ticket.callback_contact.name,
            "phone": ticket.callback_contact.phone,
            "email": ticket.callback_contact.email
        }

    # Build status object
    status_obj = None
    if ticket.status:
        status_obj = {
            "id": str(ticket.status.id),
            "code": ticket.status.code,
            "name_en": ticket.status.name_en,
            "name_he": ticket.status.name_he,
            "is_default": ticket.status.is_default,
            "is_closed_state": ticket.status.is_closed_state,
            "is_active": ticket.status.is_active,
            "sort_order": ticket.status.sort_order
        }

    # Build category object
    category_obj = None
    if ticket.category_ref:
        category_obj = {
            "id": str(ticket.category_ref.id),
            "code": ticket.category_ref.code,
            "name_en": ticket.category_ref.name_en,
            "name_he": ticket.category_ref.name_he,
            "description": ticket.category_ref.description,
            "is_default": ticket.category_ref.is_default,
            "is_active": ticket.category_ref.is_active,
            "sort_order": ticket.category_ref.sort_order
        }

    # Build events list
    events = []
    if ticket.events:
        events = [
            {
                "id": str(event.id),
                "ticket_id": str(event.ticket_id),
                "message": event.message,
                "actor_type": event.actor_type,
                "actor_id": str(event.actor_id) if event.actor_id else None,
                "actor_display": event.actor_display,
                "created_at": event.created_at.isoformat()
            }
            for event in ticket.events
        ]

    # Return ticket object directly (matches frontend TicketDetailResponse)
    return {
        "id": str(ticket.id),
        "ticket_number": ticket.ticket_number,
        "client_id": str(ticket.client_id),
        "site_id": str(ticket.site_id),
        "title": ticket.title,
        "description": ticket.description,
        "category_id": str(ticket.category_id) if ticket.category_id else None,
        "category_code": ticket.category_ref.code if ticket.category_ref else None,
        "category_name": ticket.category_ref.name_en if ticket.category_ref else None,
        "priority": ticket.priority,
        "status_id": str(ticket.status_id),
        "status_code": ticket.status.code if ticket.status else None,
        "source_channel": ticket.source_channel,
        "reported_via": ticket.reported_via,
        "service_scope": ticket.service_scope,
        "service_note": ticket.service_note,
        "contact_phone": ticket.contact_phone,
        "contact_person_id": str(ticket.contact_person_id) if ticket.contact_person_id else None,
        "callback_contact_id": str(ticket.callback_contact_id) if ticket.callback_contact_id else None,
        "contact_person": contact_person,
        "callback_contact": callback_contact,
        "assigned_to_internal_user_id": str(ticket.assigned_to_internal_user_id) if ticket.assigned_to_internal_user_id else None,
        "assigned_to_name": ticket.assigned_to.name if ticket.assigned_to else None,
        "asset_id": str(ticket.asset_id) if ticket.asset_id else None,
        "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        # Include nested objects for detail view
        "status": status_obj,
        "category": category_obj,
        "events": events
    }


@router.post("/tickets", response_model=dict)
async def create_ticket(
    request: PortalTicketCreate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Create a new ticket from the portal.

    Portal users can only create tickets within their allowed scope.
    Tickets start unassigned and go to admin triage queue.
    """
    claims, user = claims_and_user

    if not can_create_portal_tickets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    # Verify the site exists and belongs to an accessible client
    site = db.query(Site).filter(Site.id == request.site_id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    # Check client access first
    if not check_client_user_client_access(db, claims, user.id, site.client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this client"
        )

    # Check site access
    if not check_client_user_site_access(db, claims, user.id, request.site_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this site"
        )

    # Get default ticket status (e.g., "open")
    from app.models.tickets import TicketStatusDefinition
    default_status = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.is_default == True
    ).first()

    if not default_status:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No default ticket status configured"
        )

    # Generate ticket number
    from app.api.tickets import generate_ticket_number
    ticket_number = generate_ticket_number(db)

    # Verify client_id matches site (security check)
    if request.client_id != site.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID does not match site's client"
        )

    # Verify contact_person exists and belongs to this client
    from app.models.clients import Contact
    contact = db.query(Contact).filter(Contact.id == request.contact_person_id).first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contact person not found"
        )
    if contact.client_id != site.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contact person does not belong to this client"
        )

    # Verify callback_contact if provided
    if request.callback_contact_id:
        callback_contact = db.query(Contact).filter(Contact.id == request.callback_contact_id).first()
        if not callback_contact:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Callback contact not found"
            )
        if callback_contact.client_id != site.client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Callback contact does not belong to this client"
            )

    # Verify asset if provided
    if request.asset_id:
        from app.models.assets import Asset
        asset = db.query(Asset).filter(Asset.id == request.asset_id).first()
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Asset not found"
            )
        if asset.client_id != site.client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Asset does not belong to this client"
            )

    # Create ticket
    ticket = Ticket(
        ticket_number=ticket_number,
        client_id=site.client_id,  # Use site's client
        site_id=request.site_id,
        title=request.title,
        description=request.description,
        category_id=request.category_id,
        priority=request.priority,
        source_channel=request.source_channel,
        reported_via=request.reported_via,
        status_id=default_status.id,  # CRITICAL: Set default status
        service_scope=request.service_scope,
        contact_phone=request.contact_phone,
        contact_person_id=request.contact_person_id,
        callback_contact_id=request.callback_contact_id,
        asset_id=request.asset_id,
        created_by_type=CreatedByType.CLIENT.value,
        created_by_client_user_id=user.id,
        assigned_to_internal_user_id=None,  # Unassigned, goes to admin queue
    )

    db.add(ticket)
    db.flush()  # Flush to assign ticket.id before creating initiator

    # Create initiator record
    initiator = TicketInitiator(
        ticket_id=ticket.id,
        initiator_type="client_user",
        initiator_ref_id=user.id,
        initiator_display=user.name
    )

    db.add(initiator)

    try:
        db.commit()
        db.refresh(ticket)
        return {
            "status": "success",
            "message": f"Ticket {ticket_number} created successfully",
            "ticket_id": str(ticket.id),
            "ticket_number": ticket_number,
            "id": str(ticket.id)  # Include id for test compatibility
        }
    except Exception as e:
        db.rollback()
        # Log the full error for debugging
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR creating portal ticket: {error_trace}")

        # Return user-friendly error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ticket: {str(e)}"
        )


@router.post("/tickets/{ticket_id}/comments", response_model=dict)
async def add_ticket_comment(
    ticket_id: UUID,
    request: PortalTicketCommentCreate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Add a comment to a ticket.
    """
    claims, user = claims_and_user

    if not can_view_portal_tickets(claims.role):  # All users who can view tickets can add comments
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    # Get ticket
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Check client access first
    if not check_client_user_client_access(db, claims, user.id, ticket.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Check site access
    if not check_client_user_site_access(db, claims, user.id, ticket.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Create event (comment)
    event = TicketEvent(
        ticket_id=ticket.id,
        event_type="comment",
        message=request.message,
        actor_type="client_user",
        actor_id=user.id,
        actor_display=user.name
    )

    db.add(event)

    try:
        db.commit()
        return {
            "status": "success",
            "message": "Comment added",
            "event_id": str(event.id)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add comment"
        )


# ========== Work Logs Endpoint (Read-only for Portal Users) ==========

@router.get("/tickets/{ticket_id}/worklogs")
async def list_portal_work_logs(
    ticket_id: str,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get all work logs (activities) for a ticket.

    **Read-only access** for portal users.
    Portal users can view activities but cannot create/edit them.

    **Access Control:** User must have access to the ticket's client

    **RBAC:** Portal users only
    """
    claims, user = claims_and_user

    # Get ticket
    ticket = db.query(Ticket).filter(Ticket.id == UUID(ticket_id)).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, ticket.client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this ticket"
        )

    # Get work logs
    work_logs = db.query(WorkLog).filter(
        WorkLog.ticket_id == UUID(ticket_id)
    ).order_by(WorkLog.created_at.desc()).all()

    # Return work logs in the same format as admin API
    return [
        {
            "id": str(log.id),
            "ticket_id": str(log.ticket_id),
            "work_type": log.work_type,
            "description": log.description,
            "duration_minutes": log.duration_minutes,
            "start_at": log.start_at.isoformat() if log.start_at else None,
            "end_at": log.end_at.isoformat() if log.end_at else None,
            "included_in_service": log.included_in_service,
            "actor_type": log.actor_type,
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_display": log.actor_display,
            "created_at": log.created_at.isoformat()
        }
        for log in work_logs
    ]
