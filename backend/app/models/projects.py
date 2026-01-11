"""
Project domain models: projects and project linking tables.
"""
from sqlalchemy import Column, String, ForeignKey, Text, DateTime, Date, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base, TimestampMixin


class ProjectStatus(str, enum.Enum):
    """Project status."""
    PLANNED = "planned"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELED = "canceled"


# Association tables for project links
project_ticket_links = Table(
    "project_ticket_links",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("ticket_id", UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True)
)

project_asset_links = Table(
    "project_asset_links",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True)
)

project_site_links = Table(
    "project_site_links",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("site_id", UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True)
)


class Project(Base, TimestampMixin):
    """Projects."""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default=ProjectStatus.PLANNED.value)
    start_date = Column(Date, nullable=True)
    target_end_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)

    # Actor information for creation
    created_by_actor_type = Column(String, nullable=False)
    created_by_actor_id = Column(UUID(as_uuid=True), nullable=True)
    created_by_actor_display = Column(String, nullable=False)

    # Relationships
    client = relationship("Client", back_populates="projects")
    events = relationship("ProjectEvent", back_populates="project", cascade="all, delete-orphan")


class ProjectEvent(Base):
    """Project events (notes, milestones, status changes)."""
    __tablename__ = "project_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    message = Column(Text, nullable=False)

    # Actor information
    actor_type = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    actor_display = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    project = relationship("Project", back_populates="events")
