"""
Asset domain models: assets, asset_types, asset_property_definitions,
asset_property_values, asset_events, nvr_disks, ticket_asset_links.
"""
from sqlalchemy import Column, String, ForeignKey, Integer, Text, DateTime, Boolean, Date, Numeric, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.db.base import Base, TimestampMixin


class AssetStatus(str, enum.Enum):
    """Asset status."""
    ACTIVE = "active"
    IN_REPAIR = "in_repair"
    REPLACED = "replaced"
    RETIRED = "retired"


class PropertyDataType(str, enum.Enum):
    """Data types for asset properties."""
    STRING = "string"
    INT = "int"
    BOOL = "bool"
    DATE = "date"
    ENUM = "enum"
    DECIMAL = "decimal"
    SECRET = "secret"


class PropertyVisibility(str, enum.Enum):
    """Visibility levels for asset properties."""
    INTERNAL_ONLY = "internal_only"
    CLIENT_ADMIN = "client_admin"
    CLIENT_ALL = "client_all"


class TicketAssetRelationType(str, enum.Enum):
    """Types of ticket-asset relationships."""
    AFFECTED = "affected"
    REPAIRED = "repaired"
    REPLACED = "replaced"
    MENTIONED = "mentioned"


# Association table for ticket-asset links
ticket_asset_links = Table(
    "ticket_asset_links",
    Base.metadata,
    Column("ticket_id", UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
    Column("relation_type", String, nullable=False, default=TicketAssetRelationType.AFFECTED.value)
)


class AssetType(Base, TimestampMixin):
    """Asset types (e.g., NVR, Router, Switch)."""
    __tablename__ = "asset_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False, index=True)
    name_he = Column(String, nullable=True)
    name_en = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    assets = relationship("Asset", back_populates="asset_type")
    property_definitions = relationship("AssetPropertyDefinition", back_populates="asset_type", cascade="all, delete-orphan")


class Asset(Base, TimestampMixin):
    """Assets (equipment inventory)."""
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True)
    site_id = Column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="RESTRICT"), nullable=False, index=True)
    asset_type_id = Column(UUID(as_uuid=True), ForeignKey("asset_types.id", ondelete="RESTRICT"), nullable=False, index=True)
    label = Column(String, nullable=False)
    manufacturer = Column(String, nullable=True)
    model = Column(String, nullable=True)
    serial_number = Column(String, nullable=True, index=True)
    install_date = Column(Date, nullable=True)
    status = Column(String, nullable=False, default=AssetStatus.ACTIVE.value)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    client = relationship("Client", back_populates="assets")
    site = relationship("Site", back_populates="assets")
    asset_type = relationship("AssetType", back_populates="assets")
    location = relationship("Location", back_populates="assets")
    property_values = relationship("AssetPropertyValue", back_populates="asset", cascade="all, delete-orphan")
    events = relationship("AssetEvent", back_populates="asset", cascade="all, delete-orphan")
    nvr_disks = relationship("NVRDisk", back_populates="asset", cascade="all, delete-orphan")


class AssetPropertyDefinition(Base, TimestampMixin):
    """Property definitions for asset types (EAV schema)."""
    __tablename__ = "asset_property_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_type_id = Column(UUID(as_uuid=True), ForeignKey("asset_types.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String, nullable=False)
    label_he = Column(String, nullable=True)
    label_en = Column(String, nullable=True)
    data_type = Column(String, nullable=False)
    required = Column(Boolean, nullable=False, default=False)
    visibility = Column(String, nullable=False, default=PropertyVisibility.CLIENT_ADMIN.value)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    asset_type = relationship("AssetType", back_populates="property_definitions")
    property_values = relationship("AssetPropertyValue", back_populates="property_definition", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("asset_type_id", "key", name="uq_asset_property_definition_type_key"),
    )


class AssetPropertyValue(Base):
    """Property values for assets (EAV values with type-specific columns)."""
    __tablename__ = "asset_property_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    property_definition_id = Column(UUID(as_uuid=True), ForeignKey("asset_property_definitions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Type-specific value columns
    value_string = Column(Text, nullable=True)
    value_int = Column(Integer, nullable=True)
    value_bool = Column(Boolean, nullable=True)
    value_date = Column(Date, nullable=True)
    value_decimal = Column(Numeric(10, 2), nullable=True)
    value_enum = Column(String, nullable=True)
    value_secret_encrypted = Column(Text, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Actor information
    updated_by_actor_type = Column(String, nullable=False)
    updated_by_actor_id = Column(UUID(as_uuid=True), nullable=True)
    updated_by_actor_display = Column(String, nullable=False)

    # Relationships
    asset = relationship("Asset", back_populates="property_values")
    property_definition = relationship("AssetPropertyDefinition", back_populates="property_values")

    __table_args__ = (
        UniqueConstraint("asset_id", "property_definition_id", name="uq_asset_property_value_asset_definition"),
    )


class AssetEvent(Base):
    """Asset events (audit trail)."""
    __tablename__ = "asset_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String, nullable=False)
    details = Column(Text, nullable=True)

    # Actor information
    actor_type = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    actor_display = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    asset = relationship("Asset", back_populates="events")


class NVRDisk(Base, TimestampMixin):
    """NVR disk tracking."""
    __tablename__ = "nvr_disks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    slot_number = Column(Integer, nullable=True)
    capacity_tb = Column(Numeric(5, 2), nullable=False)
    install_date = Column(Date, nullable=False)
    serial_number = Column(String, nullable=True)

    # Relationships
    asset = relationship("Asset", back_populates="nvr_disks")
