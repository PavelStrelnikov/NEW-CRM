"""
Pydantic schemas for audit events.
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class AuditEventResponse(BaseModel):
    """Audit event response."""
    id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    old_values_json: Optional[Dict[str, Any]] = None
    new_values_json: Optional[Dict[str, Any]] = None
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditEventListResponse(BaseModel):
    """Paginated list of audit events."""
    items: List[AuditEventResponse]
    total: int
    page: int
    page_size: int
