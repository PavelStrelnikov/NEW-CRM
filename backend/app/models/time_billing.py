"""
Time & billing models: work_logs and ticket_line_items.
"""
from sqlalchemy import Column, String, ForeignKey, Integer, Text, DateTime, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class WorkType(str, enum.Enum):
    """Types of work."""
    PHONE = "phone"
    REMOTE = "remote"
    ONSITE = "onsite"
    TRAVEL = "travel"
    REPAIR_LAB = "repair_lab"
    ADMIN = "admin"


class ItemType(str, enum.Enum):
    """Types of line items."""
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    SERVICE = "service"
    OTHER = "other"


class WorkLog(Base):
    """Work time logs for tickets."""
    __tablename__ = "work_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    work_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    included_in_service = Column(Boolean, nullable=False, default=False)
    billing_note = Column(Text, nullable=True)

    # Actor information
    actor_type = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    actor_display = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    ticket = relationship("Ticket", back_populates="work_logs")


class TicketLineItem(Base):
    """Line items for tickets (materials, equipment, services)."""
    __tablename__ = "ticket_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    quantity = Column(Numeric(10, 2), nullable=True)
    unit = Column(String, nullable=True)
    included_in_service = Column(Boolean, nullable=False, default=False)
    chargeable = Column(Boolean, nullable=False, default=True)
    external_reference = Column(String, nullable=True)
    linked_asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)

    # Actor information
    actor_type = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    actor_display = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    ticket = relationship("Ticket", back_populates="line_items")
    linked_asset = relationship("Asset", foreign_keys=[linked_asset_id])
