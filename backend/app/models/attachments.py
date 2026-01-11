"""
Attachments model (polymorphic - can attach to tickets, assets, projects, etc.).
"""
from sqlalchemy import Column, String, ForeignKey, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class LinkedType(str, enum.Enum):
    """Types of entities that can have attachments."""
    TICKET = "ticket"
    ASSET = "asset"
    PROJECT = "project"
    SITE = "site"
    CLIENT = "client"


class Attachment(Base):
    """File attachments."""
    __tablename__ = "attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    linked_type = Column(String, nullable=False, index=True)
    linked_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    storage_path = Column(Text, nullable=False)

    # Actor information for upload
    uploaded_by_actor_type = Column(String, nullable=False)
    uploaded_by_actor_id = Column(UUID(as_uuid=True), nullable=True)
    uploaded_by_actor_display = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
