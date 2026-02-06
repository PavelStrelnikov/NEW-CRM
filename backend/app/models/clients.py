"""
Client domain models: clients, sites, contacts, locations, and linking tables.
"""
from sqlalchemy import Column, String, Boolean, ForeignKey, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db.base import Base, TimestampMixin


class ClientStatus(str, enum.Enum):
    """Client status."""
    ACTIVE = "active"
    INACTIVE = "inactive"


# Association table for contact-site many-to-many relationship
contact_site_links = Table(
    "contact_site_links",
    Base.metadata,
    Column("contact_id", UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("site_id", UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True)
)


class Client(Base, TimestampMixin):
    """Clients (companies being serviced)."""
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    tax_id = Column(String, nullable=True)
    main_phone = Column(String, nullable=True)
    main_email = Column(String, nullable=True)
    main_address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, default=ClientStatus.ACTIVE.value)

    # Relationships
    sites = relationship("Site", back_populates="client", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="client", cascade="all, delete-orphan")
    users = relationship("ClientUser", back_populates="client", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="client")
    assets = relationship("Asset", back_populates="client")
    projects = relationship("Project", back_populates="client")


class Site(Base, TimestampMixin):
    """Client sites (locations)."""
    __tablename__ = "sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    address = Column(Text, nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=True)

    # Relationships
    client = relationship("Client", back_populates="sites")
    contacts = relationship("Contact", secondary=contact_site_links, back_populates="sites")
    locations = relationship("Location", back_populates="site", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="site")
    assets = relationship("Asset", back_populates="site")


class Contact(Base, TimestampMixin):
    """Client contacts."""
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    position = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    applies_to_all_sites = Column(Boolean, nullable=False, default=True)

    # Relationships
    client = relationship("Client", back_populates="contacts")
    sites = relationship("Site", secondary=contact_site_links, back_populates="contacts")
    user = relationship("ClientUser", back_populates="contact", uselist=False)


class Location(Base, TimestampMixin):
    """Physical locations within sites."""
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    building = Column(String, nullable=True)
    floor = Column(String, nullable=True)
    room = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    # Relationships
    site = relationship("Site", back_populates="locations")
    assets = relationship("Asset", back_populates="location")
