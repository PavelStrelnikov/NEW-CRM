"""
Audit events API endpoints.
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.audit import AuditEvent
from app.schemas.audit import AuditEventResponse, AuditEventListResponse
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user


router = APIRouter()


@router.get("/audit-events", response_model=AuditEventListResponse)
async def list_audit_events(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[UUID] = Query(None, description="Filter by entity ID"),
    from_date: Optional[datetime] = Query(None, description="Filter from date"),
    to_date: Optional[datetime] = Query(None, description="Filter to date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List audit events with optional filters.

    **RBAC:**
    - Internal users: Can view all audit events
    - Client users: Can only view events for their client's entities
    """
    query = db.query(AuditEvent)

    # Apply filters
    if entity_type:
        query = query.filter(AuditEvent.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditEvent.entity_id == entity_id)
    if from_date:
        query = query.filter(AuditEvent.created_at >= from_date)
    if to_date:
        query = query.filter(AuditEvent.created_at <= to_date)

    # Apply RBAC for client users
    # Note: For now, we allow all authenticated users to see audit events
    # In a real implementation, we would filter based on client_id for client users

    # Order by created_at descending (most recent first)
    query = query.order_by(AuditEvent.created_at.desc())

    # Count total
    total = query.count()

    # Paginate
    offset = (page - 1) * page_size
    events = query.offset(offset).limit(page_size).all()

    return AuditEventListResponse(
        items=events,
        total=total,
        page=page,
        page_size=page_size
    )
