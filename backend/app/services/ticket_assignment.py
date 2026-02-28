"""
Ticket assignment service with audit trail.
Handles ticket assignment logic, history tracking, and validation.
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.tickets import Ticket, TicketAssignmentHistory, CreatedByType
from app.models.users import InternalUser
from app.guards import InternalUserClaims, ClientUserClaims


class TicketAssignmentService:
    """Service for managing ticket assignments and tracking assignment history."""

    @staticmethod
    def create_assignment_history(
        db: Session,
        ticket_id: UUID,
        assigned_to_internal_user_id: UUID,
        assigned_by_actor_type: str,
        assigned_by_actor_id: Optional[UUID],
        assigned_by_actor_display: str,
        assignment_type: str,  # 'auto' | 'manual' | 'reassign'
        reason: Optional[str] = None
    ) -> TicketAssignmentHistory:
        """Create an assignment history record for audit trail."""
        history = TicketAssignmentHistory(
            ticket_id=ticket_id,
            assigned_to_internal_user_id=assigned_to_internal_user_id,
            assigned_by_actor_type=assigned_by_actor_type,
            assigned_by_actor_id=assigned_by_actor_id,
            assigned_by_actor_display=assigned_by_actor_display,
            assignment_type=assignment_type,
            reason=reason,
            created_at=datetime.utcnow()
        )
        db.add(history)
        return history

    @staticmethod
    def assign_ticket_to_technician(
        db: Session,
        ticket: Ticket,
        technician_id: UUID,
        assignment_type: str,  # 'auto' | 'manual' | 'reassign'
        assigned_by_claims: InternalUserClaims,
        reason: Optional[str] = None
    ) -> Ticket:
        """
        Assign a ticket to a technician and record assignment history.

        Args:
            db: Database session
            ticket: Ticket to assign
            technician_id: ID of the technician to assign to
            assignment_type: 'auto' (created by tech), 'manual' (admin selected), 'reassign' (admin changed)
            assigned_by_claims: Claims of the user performing the assignment
            reason: Optional reason for assignment/reassignment

        Returns:
            Updated ticket
        """
        # Verify technician exists and is active
        technician = db.query(InternalUser).filter(
            InternalUser.id == technician_id,
            InternalUser.is_active == True
        ).first()

        if not technician:
            raise ValueError(f"Technician {technician_id} not found or inactive")

        # Store old assignment for history
        old_assigned_to = ticket.assigned_to_internal_user_id

        # Assign ticket
        ticket.assigned_to_internal_user_id = technician_id

        # Create history record
        TicketAssignmentService.create_assignment_history(
            db=db,
            ticket_id=ticket.id,
            assigned_to_internal_user_id=technician_id,
            assigned_by_actor_type="internal_user",
            assigned_by_actor_id=assigned_by_claims.user_id,
            assigned_by_actor_display=assigned_by_claims.name,
            assignment_type=assignment_type,
            reason=reason
        )

        db.add(ticket)
        return ticket

    @staticmethod
    def auto_assign_to_creator(
        db: Session,
        ticket: Ticket,
        creator_id: UUID,
        creator_display: str
    ) -> Ticket:
        """
        Automatically assign a ticket to its creator (for technician-created tickets).

        Args:
            db: Database session
            ticket: Ticket to assign
            creator_id: ID of the technician creating the ticket
            creator_display: Display name of the creator

        Returns:
            Updated ticket with auto-assignment
        """
        ticket.assigned_to_internal_user_id = creator_id

        # Create auto-assignment history record
        TicketAssignmentService.create_assignment_history(
            db=db,
            ticket_id=ticket.id,
            assigned_to_internal_user_id=creator_id,
            assigned_by_actor_type="system",
            assigned_by_actor_id=None,
            assigned_by_actor_display="System",
            assignment_type="auto",
            reason="Auto-assigned to technician upon ticket creation"
        )

        db.add(ticket)
        return ticket

    @staticmethod
    def get_assignment_history(
        db: Session,
        ticket_id: UUID
    ) -> list[TicketAssignmentHistory]:
        """Get assignment history for a ticket, ordered by creation time."""
        return db.query(TicketAssignmentHistory).filter(
            TicketAssignmentHistory.ticket_id == ticket_id
        ).order_by(TicketAssignmentHistory.created_at).all()

    @staticmethod
    def get_unassigned_tickets(
        db: Session,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[list[Ticket], int]:
        """Get unassigned tickets (for admin triage queue)."""
        query = db.query(Ticket).filter(
            Ticket.assigned_to_internal_user_id.is_(None)
        )
        total = query.count()
        tickets = query.order_by(Ticket.created_at).offset(offset).limit(limit).all()
        return tickets, total

    @staticmethod
    def get_technician_assigned_tickets(
        db: Session,
        technician_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[list[Ticket], int]:
        """Get tickets assigned to a specific technician."""
        query = db.query(Ticket).filter(
            Ticket.assigned_to_internal_user_id == technician_id
        )
        total = query.count()
        tickets = query.order_by(Ticket.created_at.desc()).offset(offset).limit(limit).all()
        return tickets, total

    @staticmethod
    def validate_assignment_permission(
        assigned_by_claims: InternalUserClaims
    ) -> bool:
        """
        Validate that the user has permission to assign/reassign tickets.
        Currently, only admin can assign tickets.
        """
        return assigned_by_claims.role == "admin"
