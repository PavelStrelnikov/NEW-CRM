"""
Ticket assignment and workflow API endpoints (RBAC-aware).
Handles assignment logic, unassigned queue, and technician views.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.guards import InternalUserClaims, get_internal_user
from app.services.ticket_assignment import TicketAssignmentService
from app.models.tickets import Ticket, TicketAssignmentHistory
from app.models.users import InternalUser, InternalUserRole
from app.rbac import can_assign_tickets, can_view_unassigned_queue, can_view_assigned_tickets

router = APIRouter()


# ========== Schemas ==========

class AssignTicketRequest(BaseModel):
    """Request to assign/reassign a ticket to a technician."""
    assigned_to_internal_user_id: UUID
    reason: Optional[str] = None


class AssignmentHistoryResponse(BaseModel):
    """Single assignment history entry."""
    id: UUID
    ticket_id: UUID
    assigned_to_internal_user_id: UUID
    assigned_by_actor_type: str
    assigned_by_actor_id: Optional[UUID]
    assigned_by_actor_display: str
    assignment_type: str
    reason: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class TicketAssignmentResponse(BaseModel):
    """Ticket assignment information."""
    ticket_id: UUID
    assigned_to_internal_user_id: UUID
    assigned_to_technician_name: str
    assignment_history: list[AssignmentHistoryResponse]


# ========== Endpoints ==========

@router.post("/tickets/{ticket_id}/assign", response_model=dict)
async def assign_ticket(
    ticket_id: UUID,
    request: AssignTicketRequest,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Assign or reassign a ticket to a technician (admin only).

    Only admins can assign/reassign tickets.
    """
    claims, user = claims_and_user

    # Check permission
    if not can_assign_tickets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only admins can assign tickets"
        )

    # Get ticket
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Determine assignment type (manual for creation, reassign if already assigned)
    old_assigned_to = ticket.assigned_to_internal_user_id
    assignment_type = "reassign" if old_assigned_to else "manual"

    try:
        # Assign ticket
        TicketAssignmentService.assign_ticket_to_technician(
            db=db,
            ticket=ticket,
            technician_id=request.assigned_to_internal_user_id,
            assignment_type=assignment_type,
            assigned_by_claims=claims,
            reason=request.reason
        )

        db.commit()

        return {
            "status": "success",
            "message": f"Ticket {ticket.ticket_number} assigned successfully",
            "ticket_id": str(ticket.id),
            "assigned_to": str(request.assigned_to_internal_user_id)
        }

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign ticket"
        )


@router.get("/tickets/unassigned", response_model=dict)
async def list_unassigned_tickets(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Get unassigned tickets (admin triage queue).

    Only admins can view the unassigned queue.
    """
    claims, user = claims_and_user

    # Check permission
    if not can_view_unassigned_queue(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only admins can view unassigned queue"
        )

    tickets, total = TicketAssignmentService.get_unassigned_tickets(
        db=db, limit=limit, offset=offset
    )

    return {
        "status": "success",
        "total": total,
        "limit": limit,
        "offset": offset,
        "tickets": [
            {
                "id": str(ticket.id),
                "ticket_number": ticket.ticket_number,
                "client_id": str(ticket.client_id),
                "site_id": str(ticket.site_id),
                "title": ticket.title,
                "priority": ticket.priority,
                "created_at": ticket.created_at.isoformat()
            }
            for ticket in tickets
        ]
    }


@router.get("/tickets/me/assigned", response_model=dict)
async def list_my_tickets(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Get tickets assigned to the current technician (or staff member).

    Non-admin users only see their assigned tickets.
    """
    claims, user = claims_and_user

    # Check permission
    if not can_view_assigned_tickets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    user_id = UUID(claims.user_id) if isinstance(claims.user_id, str) else claims.user_id

    tickets, total = TicketAssignmentService.get_technician_assigned_tickets(
        db=db,
        technician_id=user_id,
        limit=limit,
        offset=offset
    )

    return {
        "status": "success",
        "total": total,
        "limit": limit,
        "offset": offset,
        "tickets": [
            {
                "id": str(ticket.id),
                "ticket_number": ticket.ticket_number,
                "client_id": str(ticket.client_id),
                "site_id": str(ticket.site_id),
                "title": ticket.title,
                "priority": ticket.priority,
                "status": ticket.status.code if ticket.status else None,
                "created_at": ticket.created_at.isoformat()
            }
            for ticket in tickets
        ]
    }


@router.get("/tickets/{ticket_id}/assignment-history", response_model=dict)
async def get_assignment_history(
    ticket_id: UUID,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Get assignment history for a ticket (audit trail).

    Internal users can view assignment history for any ticket.
    """
    claims, user = claims_and_user

    # Get ticket
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    # Get assignment history
    history = TicketAssignmentService.get_assignment_history(db=db, ticket_id=ticket_id)

    return {
        "status": "success",
        "ticket_id": str(ticket_id),
        "ticket_number": ticket.ticket_number,
        "assignment_history": [
            {
                "id": str(h.id),
                "ticket_id": str(h.ticket_id),
                "assigned_to_internal_user_id": str(h.assigned_to_internal_user_id),
                "assigned_by_actor_type": h.assigned_by_actor_type,
                "assigned_by_actor_id": str(h.assigned_by_actor_id) if h.assigned_by_actor_id else None,
                "assigned_by_actor_display": h.assigned_by_actor_display,
                "assignment_type": h.assignment_type,
                "reason": h.reason,
                "created_at": h.created_at.isoformat()
            }
            for h in history
        ]
    }
