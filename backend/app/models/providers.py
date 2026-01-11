"""
Internet providers model (for router provider enum values).
"""
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base, TimestampMixin


class InternetProvider(Base, TimestampMixin):
    """Internet service providers (ISPs)."""
    __tablename__ = "internet_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False, index=True)
    country = Column(String, nullable=False, default="IL")
    name_he = Column(String, nullable=True)
