"""
Audit event models for tracking changes to entities.
"""
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSON
from datetime import datetime
import uuid

from app.db.base import Base


class AuditEvent(Base):
    """Audit events for tracking CRUD operations."""
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    action = Column(String, nullable=False)  # create, update, delete, deactivate
    old_values_json = Column(JSON, nullable=True)
    new_values_json = Column(JSON, nullable=True)
    actor_type = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    actor_display = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
