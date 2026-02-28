"""
Tickets API endpoints.
"""
from typing import Optional, List, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, text, desc, asc
from sqlalchemy.exc import IntegrityError
from datetime import datetime, date, timedelta

from app.db.session import get_db
from app.models.tickets import (
    Ticket, TicketInitiator, TicketEvent, TicketStatusDefinition, TicketCategoryDefinition
)
from app.models.clients import Client, Site, Contact
from app.models.assets import Asset
from app.models.time_billing import WorkLog, TicketLineItem
from app.schemas.tickets import (
    TicketCreate,
    TicketUpdate,
    TicketResponse,
    TicketDetailResponse,
    TicketListResponse,
    TicketAssignment,
    TicketStatusChange,
    TicketEventCreate,
    TicketEventResponse,
    WorkLogCreate,
    WorkLogUpdate,
    WorkLogResponse,
    LineItemCreate,
    LineItemUpdate,
    LineItemResponse
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import (
    get_current_active_user,
    require_admin,
    require_admin_or_technician
)

router = APIRouter()


def generate_ticket_number(db: Session) -> str:
    """Generate next ticket number with retry logic for duplicates."""
    max_retries = 10
    prefix = "TKT-"

    for _ in range(max_retries):
        # Get the maximum numeric portion from all TKT- ticket numbers
        # This handles both old format (TKT-2024505) and new format (TKT-000001)
        from sqlalchemy import func, cast, Integer
        from sqlalchemy.sql.expression import case

        # Extract the numeric part after TKT- and find the maximum
        result = db.execute(
            text("""
                SELECT MAX(
                    CAST(SUBSTRING(ticket_number FROM 5) AS INTEGER)
                )
                FROM tickets
                WHERE ticket_number LIKE 'TKT-%'
                AND SUBSTRING(ticket_number FROM 5) ~ '^[0-9]+$'
            """)
        ).scalar()

        if result is None:
            next_num = 1
        else:
            next_num = result + 1

        # Generate ticket number (use 7 digits to accommodate existing high numbers)
        ticket_number = f"{prefix}{next_num:07d}"

        # Check if this number already exists (safety check)
        exists = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not exists:
            return ticket_number

    # If we couldn't generate a unique number after retries, raise error
    raise ValueError("Failed to generate unique ticket number after maximum retries")


def get_actor_info(current_user: CurrentUser) -> tuple[str, Optional[UUID], str]:
    """Extract actor information from current user."""
    actor_type = current_user.user_type
    actor_id = current_user.id
    actor_display = current_user.name
    return actor_type, actor_id, actor_display


# ========== Ticket CRUD Endpoints ==========

@router.get("/tickets", response_model=TicketListResponse)
async def list_tickets(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    site_id: Optional[UUID] = Query(None, description="Filter by site"),
    status: Optional[str] = Query(None, description="Filter by status code"),
    assigned_to: Optional[UUID] = Query(None, description="Filter by assigned user"),
    category: Optional[str] = Query(None, description="Filter by category"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    q: Optional[str] = Query(None, description="Search by ticket number or title"),
    # Date range filters
    date_from: Optional[date] = Query(None, description="Filter tickets created on or after this date"),
    date_to: Optional[date] = Query(None, description="Filter tickets created on or before this date"),
    # Hide closed tickets filter
    hide_closed: bool = Query(False, description="Hide tickets with closed status"),
    # Sorting parameters
    sort_by: Optional[str] = Query(
        "created_at",
        description="Field to sort by: created_at, ticket_number, priority, status"
    ),
    sort_order: Optional[str] = Query(
        "desc",
        description="Sort order: asc or desc"
    ),
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List tickets with filtering, sorting, and pagination.

    **RBAC:**
    - Internal users: Can see all tickets
    - Client users: Can only see tickets for their own client

    **Filters:**
    - client_id, site_id, status, assigned_to, category, priority: Exact match
    - q: Search by ticket number or title
    - date_from, date_to: Filter by created_at date range
    - hide_closed: When true, excludes tickets with is_closed_state=true

    **Sorting:**
    - sort_by: created_at (default), ticket_number, priority, status
    - sort_order: desc (default), asc
    """
    # Start with base query - need outerjoin for status to handle null cases
    query = db.query(Ticket).outerjoin(
        TicketStatusDefinition, Ticket.status_id == TicketStatusDefinition.id
    ).outerjoin(
        TicketCategoryDefinition, Ticket.category_id == TicketCategoryDefinition.id
    ).options(
        joinedload(Ticket.status),
        joinedload(Ticket.contact_person),
        joinedload(Ticket.callback_contact),
        joinedload(Ticket.assigned_to),
        joinedload(Ticket.category_ref)
    )

    # Apply RBAC filters
    if current_user.user_type == "client":
        query = query.filter(Ticket.client_id == current_user.client_id)

    # Apply filters
    if client_id:
        query = query.filter(Ticket.client_id == client_id)
    if site_id:
        query = query.filter(Ticket.site_id == site_id)
    if status:
        query = query.filter(TicketStatusDefinition.code == status)
    if assigned_to:
        query = query.filter(Ticket.assigned_to_internal_user_id == assigned_to)
    if category:
        query = query.filter(TicketCategoryDefinition.code == category)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if q:
        query = query.filter(
            or_(
                Ticket.ticket_number.ilike(f"%{q}%"),
                Ticket.title.ilike(f"%{q}%")
            )
        )

    # Date range filters
    if date_from:
        # Include tickets from start of the day
        query = query.filter(Ticket.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        # Include tickets until end of the day
        query = query.filter(Ticket.created_at <= datetime.combine(date_to, datetime.max.time()))

    # Hide closed tickets filter
    if hide_closed:
        query = query.filter(
            or_(
                TicketStatusDefinition.is_closed_state == False,
                TicketStatusDefinition.is_closed_state.is_(None)
            )
        )

    # Get total count before pagination
    total = query.count()

    # Apply sorting
    sort_direction = desc if sort_order == "desc" else asc

    # Map sort_by to actual columns
    sort_column_map = {
        "created_at": Ticket.created_at,
        "ticket_number": Ticket.ticket_number,
        "priority": Ticket.priority,
        "status": TicketStatusDefinition.sort_order,  # Sort by status sort_order field
        "updated_at": Ticket.updated_at,
    }

    sort_column = sort_column_map.get(sort_by, Ticket.created_at)
    query = query.order_by(sort_direction(sort_column))

    # Apply pagination
    offset = (page - 1) * page_size
    tickets = query.offset(offset).limit(page_size).all()

    # Convert to response objects (Pydantic will handle from_attributes)
    # Add status_code, category_code/name, and assigned_to_name manually since they're derived from relationships
    ticket_responses = []
    for ticket in tickets:
        ticket_response = TicketResponse.model_validate(ticket)
        # Add status_code which is derived from relationship
        ticket_response.status_code = ticket.status.code if ticket.status else None
        # Add assigned_to_name from the assigned_to relationship
        ticket_response.assigned_to_name = ticket.assigned_to.name if ticket.assigned_to else None
        # Add category info from the category_ref relationship
        ticket_response.category_code = ticket.category_ref.code if ticket.category_ref else None
        ticket_response.category_name = ticket.category_ref.name_en if ticket.category_ref else None
        ticket_responses.append(ticket_response)

    return TicketListResponse(
        items=ticket_responses,
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/tickets", response_model=TicketDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new ticket.

    **RBAC:** All authenticated users can create tickets

    **Validation:**
    - Client and site must exist
    - contact_phone is required
    - contact_person_id is required (who opened the ticket)
    - callback_contact_id is optional (defaults to contact_person_id if not provided)
    - Creates ticket_initiator record
    - Creates ticket_event of type 'created'
    - Assigns default status if not specified
    """
    # Validate client exists
    client = db.query(Client).filter(Client.id == ticket_data.client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Apply RBAC: client users can only create tickets for their own client
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket_data.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create ticket for another client"
            )

    # Validate site exists and belongs to client
    site = db.query(Site).filter(
        Site.id == ticket_data.site_id,
        Site.client_id == ticket_data.client_id
    ).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or does not belong to this client"
        )

    # Validate asset_id if provided (must exist and belong to same client)
    if ticket_data.asset_id:
        asset = db.query(Asset).filter(
            Asset.id == ticket_data.asset_id,
            Asset.client_id == ticket_data.client_id
        ).first()
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Asset not found or does not belong to this client"
            )

    # Validate contact_person_id belongs to client
    contact = db.query(Contact).filter(
        Contact.id == ticket_data.contact_person_id,
        Contact.client_id == ticket_data.client_id
    ).first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found or does not belong to this client"
        )

    # Validate callback_contact_id (optional, defaults to contact_person_id)
    if ticket_data.callback_contact_id:
        callback_contact = db.query(Contact).filter(
            Contact.id == ticket_data.callback_contact_id,
            Contact.client_id == ticket_data.client_id
        ).first()
        if not callback_contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Callback contact not found or does not belong to this client"
            )
    else:
        # Default callback contact to opener contact
        ticket_data.callback_contact_id = ticket_data.contact_person_id

    # Validate reported_via (contact channel)
    valid_channels = {"phone", "whatsapp", "email", "other"}
    if ticket_data.reported_via not in valid_channels:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reported_via value. Must be one of: {', '.join(valid_channels)}"
        )

    # Get default status
    default_status = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.is_default == True,
        TicketStatusDefinition.is_active == True
    ).first()
    if not default_status:
        # Fallback: get any active status
        default_status = db.query(TicketStatusDefinition).filter(
            TicketStatusDefinition.is_active == True
        ).first()
    if not default_status:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No active ticket status found"
        )

    # Generate ticket number
    try:
        ticket_number = generate_ticket_number(db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    # Create ticket
    try:
        # Get actor info for created_by fields
        actor_type, actor_id, actor_display = get_actor_info(current_user)

        ticket_dict = ticket_data.model_dump(exclude={"initiator_type", "initiator_ref_id", "initiator_display"})
        ticket = Ticket(
            **ticket_dict,
            ticket_number=ticket_number,
            status_id=default_status.id,
            created_by_type=actor_type
        )

        # Set appropriate created_by user ID based on user type
        if current_user.user_type == "internal":
            ticket.created_by_internal_user_id = current_user.id
        else:
            ticket.created_by_client_user_id = current_user.id

        db.add(ticket)
        db.flush()

        # Create ticket initiator - use provided initiator info or default to current user
        initiator_type = ticket_data.initiator_type or actor_type
        initiator_ref_id = ticket_data.initiator_ref_id or actor_id
        initiator_display = ticket_data.initiator_display or actor_display

        initiator = TicketInitiator(
            ticket_id=ticket.id,
            initiator_type=initiator_type,
            initiator_ref_id=initiator_ref_id,
            initiator_display=initiator_display
        )
        db.add(initiator)

        # Create ticket event for creation
        event = TicketEvent(
            ticket_id=ticket.id,
            event_type="created",
            message=f"Ticket created by {actor_display}",
            actor_type=actor_type,
            actor_id=actor_id,
            actor_display=actor_display
        )
        db.add(event)

        db.commit()
        db.refresh(ticket)

        return ticket

    except IntegrityError as e:
        db.rollback()
        error_str = str(e)
        import logging
        logging.error(f"IntegrityError creating ticket: {error_str}")

        # Check for specific duplicate key violation on ticket_number
        # Look for unique constraint violation patterns
        if "ix_tickets_ticket_number" in error_str or "duplicate key" in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="UNIQUE_CONSTRAINT_TICKET_NUMBER"
            )
        # Re-raise as 400 for other integrity errors (foreign key, not null, etc.)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INTEGRITY_ERROR_V2: {error_str}"
        )


@router.get("/tickets/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket(
    ticket_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific ticket by ID.

    **RBAC:**
    - Internal users: Can access any ticket
    - Client users: Can only access tickets for their own client
    """
    ticket = db.query(Ticket).options(
        joinedload(Ticket.status),
        joinedload(Ticket.contact_person),
        joinedload(Ticket.callback_contact),
        joinedload(Ticket.assigned_to),
        joinedload(Ticket.category_ref)
    ).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Build response with derived fields
    ticket_response = TicketDetailResponse.model_validate(ticket)
    ticket_response.status_code = ticket.status.code if ticket.status else None
    ticket_response.assigned_to_name = ticket.assigned_to.name if ticket.assigned_to else None
    ticket_response.category_code = ticket.category_ref.code if ticket.category_ref else None
    ticket_response.category_name = ticket.category_ref.name_en if ticket.category_ref else None
    # Add full category object for detail response
    if ticket.category_ref:
        from app.schemas.tickets import TicketCategoryDefinitionResponse
        ticket_response.category = TicketCategoryDefinitionResponse.model_validate(ticket.category_ref)

    return ticket_response


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID,
    ticket_data: TicketUpdate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Update a ticket.

    **RBAC:** Admin or Technician only
    """
    ticket = db.query(Ticket).options(
        joinedload(Ticket.status),
        joinedload(Ticket.assigned_to),
        joinedload(Ticket.contact_person),
        joinedload(Ticket.callback_contact),
        joinedload(Ticket.category_ref)
    ).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Track if status changed to closed
    status_changed_to_closed = False
    old_status = ticket.status

    # Update only provided fields
    update_data = ticket_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ticket, field, value)

    # Check if status was changed to a closed state
    if 'status_id' in update_data:
        new_status = db.query(TicketStatusDefinition).filter(
            TicketStatusDefinition.id == update_data['status_id']
        ).first()
        if new_status and new_status.is_closed_state:
            if not old_status or not old_status.is_closed_state:
                status_changed_to_closed = True
                # Set closed_at timestamp
                ticket.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(ticket)

    # AUTO-HEAL: Reset asset health when ticket is closed
    if status_changed_to_closed and ticket.asset_id:
        # Find the linked asset
        asset = db.query(Asset).filter(Asset.id == ticket.asset_id).first()
        if asset:
            # Check if there are other open tickets for this asset
            other_open_tickets = db.query(Ticket).join(TicketStatusDefinition).filter(
                Ticket.asset_id == ticket.asset_id,
                Ticket.id != ticket.id,
                TicketStatusDefinition.is_closed_state == False
            ).count()

            # If no other open tickets, reset health status
            if other_open_tickets == 0:
                asset.health_status = 'ok'
                asset.health_issues = []
                db.commit()

    # Re-load relationships after update (single query with eager loading)
    db.expire(ticket)
    ticket = db.query(Ticket).options(
        joinedload(Ticket.status),
        joinedload(Ticket.assigned_to),
        joinedload(Ticket.contact_person),
        joinedload(Ticket.callback_contact),
        joinedload(Ticket.category_ref)
    ).filter(Ticket.id == ticket_id).first()

    # Build response with derived fields
    ticket_response = TicketResponse.model_validate(ticket)
    ticket_response.status_code = ticket.status.code if ticket.status else None
    ticket_response.assigned_to_name = ticket.assigned_to.name if ticket.assigned_to else None
    ticket_response.category_code = ticket.category_ref.code if ticket.category_ref else None
    ticket_response.category_name = ticket.category_ref.name_en if ticket.category_ref else None

    return ticket_response


# ========== Ticket Assignment ==========
# NOTE: Ticket assignment endpoints moved to ticket_assignment.py with new RBAC system
# This old endpoint is commented out to avoid conflicts with the new implementation

# @router.post("/tickets/{ticket_id}/assign", response_model=TicketResponse)
# async def assign_ticket(
#     ticket_id: UUID,
#     assignment: TicketAssignment,
#     current_user: CurrentUser = Depends(require_admin_or_technician),
#     db: Session = Depends(get_db)
# ):
#     """
#     Assign ticket to an internal user.
#
#     **RBAC:** Admin or Technician only
#
#     Creates a ticket_event of type 'assignment_change'.
#     """
#     ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
#
#     if not ticket:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Ticket not found"
#         )
#
#     old_assigned_to = ticket.assigned_to_internal_user_id
#
#     # Update assignment
#     ticket.assigned_to_internal_user_id = assignment.assigned_to_internal_user_id
#
#     # Create event
#     actor_type, actor_id, actor_display = get_actor_info(current_user)
#
#     if assignment.assigned_to_internal_user_id:
#         message = f"Ticket assigned to user {assignment.assigned_to_internal_user_id}"
#     else:
#         message = "Ticket unassigned"
#
#     event = TicketEvent(
#         ticket_id=ticket.id,
#         event_type="assignment_change",
#         message=message,
#         old_value=str(old_assigned_to) if old_assigned_to else None,
#         new_value=str(assignment.assigned_to_internal_user_id) if assignment.assigned_to_internal_user_id else None,
#         actor_type=actor_type,
#         actor_id=actor_id,
#         actor_display=actor_display
#     )
#     db.add(event)
#
#     db.commit()
#     db.refresh(ticket)
#
#     return ticket


# ========== Ticket Status ==========

@router.post("/tickets/{ticket_id}/status", response_model=TicketResponse)
async def change_ticket_status(
    ticket_id: UUID,
    status_change: TicketStatusChange,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Change ticket status.

    **RBAC:** Admin or Technician only

    **Validation:**
    - If closing (is_closed_state=true), requires at least one comment or work log
    - Sets closed_at timestamp when closing
    - Creates ticket_event of type 'status_change'
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Validate new status exists
    new_status = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.id == status_change.status_id
    ).first()

    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Status not found"
        )

    # If closing, validate there's at least one comment or work log
    if new_status.is_closed_state:
        has_comment = db.query(TicketEvent).filter(
            TicketEvent.ticket_id == ticket_id,
            TicketEvent.event_type == "comment"
        ).first()

        has_work_log = db.query(WorkLog).filter(
            WorkLog.ticket_id == ticket_id
        ).first()

        if not has_comment and not has_work_log:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot close ticket without at least one comment or work log"
            )

        # Set closed_at timestamp
        ticket.closed_at = datetime.utcnow()
    else:
        # If reopening, clear closed_at
        ticket.closed_at = None

    old_status_id = ticket.status_id

    # Update status
    ticket.status_id = status_change.status_id

    # Create event
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    message = f"Status changed from {old_status_id} to {new_status.code}"
    if status_change.comment:
        message += f"\nComment: {status_change.comment}"

    event = TicketEvent(
        ticket_id=ticket.id,
        event_type="status_change",
        message=message,
        old_value=str(old_status_id),
        new_value=str(new_status.code),
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)

    db.commit()

    # Reload with eager-loaded relationships
    ticket = db.query(Ticket).options(
        joinedload(Ticket.status),
        joinedload(Ticket.assigned_to),
        joinedload(Ticket.category_ref)
    ).filter(Ticket.id == ticket.id).first()

    return ticket


# ========== Ticket Events (Comments) ==========

@router.get("/tickets/{ticket_id}/events", response_model=List[TicketEventResponse])
async def list_ticket_events(
    ticket_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all events for a ticket.

    **RBAC:**
    - Internal users: Can see events for any ticket
    - Client users: Can only see events for their client's tickets
    """
    # First verify ticket exists and user has access
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    events = db.query(TicketEvent).filter(
        TicketEvent.ticket_id == ticket_id
    ).order_by(TicketEvent.created_at.asc()).all()

    return events


@router.post("/tickets/{ticket_id}/events", response_model=TicketEventResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket_event(
    ticket_id: UUID,
    event_data: TicketEventCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Add a comment to a ticket.

    **RBAC:** All authenticated users can comment on accessible tickets
    """
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Create event
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    event = TicketEvent(
        ticket_id=ticket_id,
        event_type="comment",
        message=event_data.message,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return event


# ========== Work Logs ==========

@router.get("/tickets/{ticket_id}/work-logs", response_model=List[WorkLogResponse])
async def list_work_logs(
    ticket_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all work logs for a ticket.

    **RBAC:**
    - Internal users: Can see work logs for any ticket
    - Client users: Can only see work logs for their client's tickets
    """
    # First verify ticket exists and user has access
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    work_logs = db.query(WorkLog).filter(
        WorkLog.ticket_id == ticket_id
    ).order_by(WorkLog.created_at.asc()).all()

    return work_logs


@router.post("/tickets/{ticket_id}/work-logs", response_model=WorkLogResponse, status_code=status.HTTP_201_CREATED)
async def create_work_log(
    ticket_id: UUID,
    work_log_data: WorkLogCreate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Add a work log to a ticket.

    **RBAC:** Admin or Technician only

    **Validation:**
    - Either (start_at and end_at) or duration_minutes must be provided
    - Creates ticket_event of type 'work_logged'
    """
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Validate: either have start/end times or duration
    if work_log_data.start_at and work_log_data.end_at:
        # Calculate duration if both times provided
        duration = (work_log_data.end_at - work_log_data.start_at).total_seconds() / 60
        if duration <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="end_at must be after start_at"
            )
    elif not work_log_data.duration_minutes or work_log_data.duration_minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either (start_at and end_at) or duration_minutes > 0 is required"
        )

    # Create work log
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    work_log = WorkLog(
        **work_log_data.model_dump(),
        ticket_id=ticket_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(work_log)
    db.flush()

    # Create ticket event
    event = TicketEvent(
        ticket_id=ticket_id,
        event_type="work_logged",
        message=f"Work logged: {work_log_data.duration_minutes} minutes - {work_log_data.description}",
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)

    db.commit()
    db.refresh(work_log)

    return work_log


@router.patch("/tickets/{ticket_id}/work-logs/{work_log_id}", response_model=WorkLogResponse)
async def update_work_log(
    ticket_id: UUID,
    work_log_id: UUID,
    work_log_data: WorkLogUpdate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Update a work log.

    **RBAC:** Admin or Technician only
    """
    work_log = db.query(WorkLog).filter(
        WorkLog.id == work_log_id,
        WorkLog.ticket_id == ticket_id
    ).first()

    if not work_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found"
        )

    # Update only provided fields
    update_data = work_log_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(work_log, field, value)

    db.commit()
    db.refresh(work_log)

    return work_log


@router.delete("/tickets/{ticket_id}/work-logs/{work_log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_log(
    ticket_id: UUID,
    work_log_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a work log.

    **RBAC:** Admin only
    """
    work_log = db.query(WorkLog).filter(
        WorkLog.id == work_log_id,
        WorkLog.ticket_id == ticket_id
    ).first()

    if not work_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found"
        )

    db.delete(work_log)
    db.commit()

    return None


# ========== Line Items ==========

@router.get("/tickets/{ticket_id}/line-items", response_model=List[LineItemResponse])
async def list_line_items(
    ticket_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all line items for a ticket.

    **RBAC:**
    - Internal users: Can see line items for any ticket
    - Client users: Can only see line items for their client's tickets
    """
    # First verify ticket exists and user has access
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    line_items = db.query(TicketLineItem).filter(
        TicketLineItem.ticket_id == ticket_id
    ).order_by(TicketLineItem.created_at.asc()).all()

    return line_items


@router.post("/tickets/{ticket_id}/line-items", response_model=LineItemResponse, status_code=status.HTTP_201_CREATED)
async def create_line_item(
    ticket_id: UUID,
    line_item_data: LineItemCreate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Add a line item to a ticket.

    **RBAC:** Admin or Technician only
    """
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Create line item
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    line_item = TicketLineItem(
        **line_item_data.model_dump(),
        ticket_id=ticket_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(line_item)
    db.commit()
    db.refresh(line_item)

    return line_item


@router.patch("/tickets/{ticket_id}/line-items/{line_item_id}", response_model=LineItemResponse)
async def update_line_item(
    ticket_id: UUID,
    line_item_id: UUID,
    line_item_data: LineItemUpdate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Update a line item.

    **RBAC:** Admin or Technician only
    """
    line_item = db.query(TicketLineItem).filter(
        TicketLineItem.id == line_item_id,
        TicketLineItem.ticket_id == ticket_id
    ).first()

    if not line_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line item not found"
        )

    # Update only provided fields
    update_data = line_item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(line_item, field, value)

    db.commit()
    db.refresh(line_item)

    return line_item


@router.delete("/tickets/{ticket_id}/line-items/{line_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_line_item(
    ticket_id: UUID,
    line_item_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a line item.

    **RBAC:** Admin only
    """
    line_item = db.query(TicketLineItem).filter(
        TicketLineItem.id == line_item_id,
        TicketLineItem.ticket_id == ticket_id
    ).first()

    if not line_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Line item not found"
        )

    db.delete(line_item)
    db.commit()

    return None
