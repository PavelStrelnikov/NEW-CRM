"""
User models: internal_users and client_users.
"""
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
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
    CLIENT_USER = "CLIENT_USER"  # Standard client user with site-based access
    CLIENT_CONTACT = "CLIENT_CONTACT"  # Backwards compatibility
    CLIENT_ADMIN = "CLIENT_ADMIN"  # Client admin across all sites


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
    can_view_secrets = Column(Boolean, nullable=False, default=False)  # Allow CLIENT_ADMIN to view device passwords

    # Relationships
    client = relationship("Client", back_populates="users")
    contact = relationship("Contact", back_populates="user")
    allowed_sites = relationship("ClientUserSite", back_populates="client_user", cascade="all, delete-orphan")
    allowed_clients = relationship("ClientUserClient", back_populates="client_user", cascade="all, delete-orphan")


class ClientUserSite(Base):
    """Site access restrictions for client users (portal-level access control)."""
    __tablename__ = "client_user_sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(UUID(as_uuid=True), ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    client_user = relationship("ClientUser", back_populates="allowed_sites")
    site = relationship("Site")


class ClientUserClient(Base):
    """Client access assignments for multi-client CLIENT_ADMIN users."""
    __tablename__ = "client_user_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(UUID(as_uuid=True), ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Audit fields: track who assigned this client to the user
    created_by_actor_type = Column(String, nullable=True)  # 'internal_user', 'system'
    created_by_actor_id = Column(UUID(as_uuid=True), nullable=True)
    created_by_actor_display = Column(String, nullable=True)

    # Relationships
    client_user = relationship("ClientUser", back_populates="allowed_clients")
    client = relationship("Client")
