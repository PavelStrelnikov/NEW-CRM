"""
Ticket domain models: tickets, ticket_status_definitions, ticket_initiators, ticket_events.
"""
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base, TimestampMixin


class TicketCategory(str, enum.Enum):
    """Ticket categories."""
    CCTV = "CCTV"
    NETWORK = "Network"
    PC = "PC"
    ALARM = "Alarm"
    OTHER = "Other"


class TicketPriority(str, enum.Enum):
    """Ticket priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class SourceChannel(str, enum.Enum):
    """How ticket was created."""
    PORTAL = "portal"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"
    MANUAL = "manual"
    API = "api"


class ReportedVia(str, enum.Enum):
    """How customer reported the issue."""
    PORTAL = "portal"
    PHONE = "phone"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"


class ServiceScope(str, enum.Enum):
    """Service scope classification."""
    INCLUDED = "included"
    NOT_INCLUDED = "not_included"
    MIXED = "mixed"


class InitiatorType(str, enum.Enum):
    """Types of ticket initiators."""
    INTERNAL_USER = "internal_user"
    CLIENT_USER = "client_user"
    EXTERNAL_IDENTITY = "external_identity"
    INTEGRATION = "integration"


class TicketStatusDefinition(Base, TimestampMixin):
    """Ticket status definitions (admin-configurable)."""
    __tablename__ = "ticket_status_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False, index=True)
    name_he = Column(String, nullable=True)
    name_en = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_default = Column(Boolean, nullable=False, default=False)
    is_closed_state = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)

    # Relationships
    tickets = relationship("Ticket", back_populates="status")


class Ticket(Base, TimestampMixin):
    """Support tickets."""
    __tablename__ = "tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number = Column(String, unique=True, nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="RESTRICT"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    priority = Column(String, nullable=False, default=TicketPriority.NORMAL.value)
    source_channel = Column(String, nullable=False)
    reported_via = Column(String, nullable=True)
    status_id = Column(UUID(as_uuid=True), ForeignKey("ticket_status_definitions.id", ondelete="RESTRICT"), nullable=False, index=True)
    assigned_to_internal_user_id = Column(UUID(as_uuid=True), ForeignKey("internal_users.id", ondelete="SET NULL"), nullable=True, index=True)
    service_scope = Column(String, nullable=False, default=ServiceScope.NOT_INCLUDED.value)
    service_note = Column(Text, nullable=True)

    # Contact information (callback contact)
    contact_person_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    contact_name = Column(String, nullable=True)
    contact_phone = Column(String, nullable=False)
    contact_email = Column(String, nullable=True)

    closed_at = Column(DateTime, nullable=True)

    # Relationships
    client = relationship("Client", back_populates="tickets")
    site = relationship("Site", back_populates="tickets")
    status = relationship("TicketStatusDefinition", back_populates="tickets")
    assigned_to = relationship("InternalUser", foreign_keys=[assigned_to_internal_user_id])
    contact_person = relationship("Contact", foreign_keys=[contact_person_id])
    initiator = relationship("TicketInitiator", back_populates="ticket", uselist=False, cascade="all, delete-orphan")
    events = relationship("TicketEvent", back_populates="ticket", cascade="all, delete-orphan")
    work_logs = relationship("WorkLog", back_populates="ticket", cascade="all, delete-orphan")
    line_items = relationship("TicketLineItem", back_populates="ticket", cascade="all, delete-orphan")


class TicketInitiator(Base):
    """Ticket initiator information (who opened the ticket)."""
    __tablename__ = "ticket_initiators"

    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True)
    initiator_type = Column(String, nullable=False)
    initiator_ref_id = Column(UUID(as_uuid=True), nullable=True)
    initiator_display = Column(String, nullable=False)

    # Relationships
    ticket = relationship("Ticket", back_populates="initiator")


class TicketEvent(Base):
    """Ticket events (audit trail, comments, status changes)."""
    __tablename__ = "ticket_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    # Actor information
    actor_type = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    actor_display = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    ticket = relationship("Ticket", back_populates="events")
