"""
API endpoints for work logs (activities).
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime

from app.db.session import get_db
from app.models.tickets import Ticket
from app.models.time_billing import WorkLog
from app.schemas.work_logs import WorkLogCreate, WorkLogUpdate, WorkLogResponse
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user, require_admin_or_technician


router = APIRouter()


@router.get("/tickets/{ticket_id}/worklogs", response_model=List[WorkLogResponse])
async def list_work_logs(
    ticket_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all work logs for a ticket.

    **RBAC:**
    - Internal users: Can access any ticket's work logs
    - Client users: Can only access work logs for their own client's tickets
    """
    # Verify ticket exists and user has access
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Get work logs
    work_logs = db.query(WorkLog).filter(
        WorkLog.ticket_id == ticket_id
    ).order_by(WorkLog.created_at.desc()).all()

    return work_logs


@router.post("/tickets/{ticket_id}/worklogs", response_model=WorkLogResponse, status_code=status.HTTP_201_CREATED)
async def create_work_log(
    ticket_id: UUID,
    work_log_data: WorkLogCreate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Create a new work log for a ticket.

    **Time Tracking Modes:**
    - Mode A: Provide start_at + end_at → duration_minutes computed automatically
    - Mode B: Provide start_at (date at 00:00) + duration_minutes → end_at stays NULL

    **RBAC:** Admin or Technician only
    """
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Compute duration if Mode A (time range provided)
    duration_minutes = work_log_data.duration_minutes
    if work_log_data.end_at is not None:
        # Mode A: Calculate duration from time range
        time_diff = work_log_data.end_at - work_log_data.start_at
        duration_minutes = int(time_diff.total_seconds() / 60)
        if duration_minutes <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duration must be positive"
            )

    # Create work log
    work_log = WorkLog(
        ticket_id=ticket_id,
        work_type=work_log_data.work_type,
        description=work_log_data.description,
        start_at=work_log_data.start_at,
        end_at=work_log_data.end_at,
        duration_minutes=duration_minutes,
        included_in_service=work_log_data.included_in_service,
        billing_note=work_log_data.billing_note,
        actor_type="internal_user",
        actor_id=current_user.id,
        actor_display=current_user.name or current_user.email
    )

    db.add(work_log)
    db.commit()
    db.refresh(work_log)

    return work_log


@router.patch("/worklogs/{work_log_id}", response_model=WorkLogResponse)
async def update_work_log(
    work_log_id: UUID,
    work_log_data: WorkLogUpdate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Update a work log.

    **RBAC:** Admin or Technician only
    """
    # Get work log
    work_log = db.query(WorkLog).filter(WorkLog.id == work_log_id).first()
    if not work_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found"
        )

    # Update fields
    update_data = work_log_data.model_dump(exclude_unset=True)

    # Recompute duration if time range is being updated
    if 'start_at' in update_data or 'end_at' in update_data:
        new_start = update_data.get('start_at', work_log.start_at)
        new_end = update_data.get('end_at', work_log.end_at)

        if new_end is not None and new_start is not None:
            # Mode A: Recalculate duration
            time_diff = new_end - new_start
            update_data['duration_minutes'] = int(time_diff.total_seconds() / 60)
            if update_data['duration_minutes'] <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Duration must be positive"
                )
        elif new_end is None and 'duration_minutes' not in update_data:
            # Mode B: duration_minutes must be provided or already exist
            if work_log.duration_minutes is None or work_log.duration_minutes <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="duration_minutes required when end_at is NULL"
                )

    for key, value in update_data.items():
        setattr(work_log, key, value)

    db.commit()
    db.refresh(work_log)

    return work_log


@router.delete("/worklogs/{work_log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_log(
    work_log_id: UUID,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Delete a work log.

    **RBAC:** Admin or Technician only
    """
    # Get work log
    work_log = db.query(WorkLog).filter(WorkLog.id == work_log_id).first()
    if not work_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found"
        )

    db.delete(work_log)
    db.commit()

    return None
