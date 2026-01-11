"""
User models: internal_users and client_users.
"""
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db.base import Base, TimestampMixin


class InternalUserRole(str, enum.Enum):
    """Internal user roles."""
    ADMIN = "admin"
    TECHNICIAN = "technician"
    OFFICE = "office"


class ClientUserRole(str, enum.Enum):
    """Client user roles."""
    CLIENT_CONTACT = "client_contact"
    CLIENT_ADMIN = "client_admin"


class Locale(str, enum.Enum):
    """Supported locales."""
    HE_IL = "he-IL"
    EN_US = "en-US"


class InternalUser(Base, TimestampMixin):
    """Internal users (company staff)."""
    __tablename__ = "internal_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(InternalUserRole), nullable=False)
    preferred_locale = Column(Enum(Locale), nullable=False, default=Locale.HE_IL)
    is_active = Column(Boolean, nullable=False, default=True)


class ClientUser(Base, TimestampMixin):
    """Client users (external portal users)."""
    __tablename__ = "client_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(ClientUserRole), nullable=False)
    preferred_locale = Column(Enum(Locale), nullable=False, default=Locale.HE_IL)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    client = relationship("Client", back_populates="users")
    contact = relationship("Contact", back_populates="user")
