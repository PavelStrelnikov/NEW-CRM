"""
Pydantic schemas for assets domain: assets, asset types, properties, events.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date


# ========== Asset Type Schemas ==========

class AssetTypeResponse(BaseModel):
    """Asset type response."""
    id: UUID
    code: str
    name_he: Optional[str] = None
    name_en: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== Asset Property Definition Schemas ==========

class AssetPropertyDefinitionResponse(BaseModel):
    """Asset property definition response."""
    id: UUID
    asset_type_id: UUID
    key: str
    label_he: Optional[str] = None
    label_en: Optional[str] = None
    data_type: str
    required: bool
    visibility: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== Asset Schemas ==========

class AssetBase(BaseModel):
    """Base asset fields."""
    label: str = Field(..., min_length=1, max_length=255)
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    install_date: Optional[date] = None
    status: str = "active"
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    """Schema for creating an asset."""
    client_id: UUID
    site_id: UUID
    asset_type_id: UUID
    location_id: Optional[UUID] = None
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict)


class AssetUpdate(BaseModel):
    """Schema for updating an asset (all fields optional)."""
    label: Optional[str] = Field(None, min_length=1, max_length=255)
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    install_date: Optional[date] = None
    status: Optional[str] = None
    location_id: Optional[UUID] = None
    notes: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class AssetPropertyValueResponse(BaseModel):
    """Asset property value response."""
    property_definition_id: UUID
    key: str
    label_he: Optional[str] = None
    label_en: Optional[str] = None
    data_type: str
    value: Any
    updated_at: datetime
    updated_by_actor_display: str

    class Config:
        from_attributes = True


class AssetResponse(AssetBase):
    """Asset response with all fields."""
    id: UUID
    client_id: UUID
    site_id: UUID
    asset_type_id: UUID
    asset_type_code: Optional[str] = None  # Computed from asset_type relationship
    location_id: Optional[UUID] = None
    # Key network properties for list display
    wan_public_ip: Optional[str] = None
    lan_ip_address: Optional[str] = None
    # Health monitoring fields
    health_status: str = "unknown"  # ok, warning, critical, unknown
    health_issues: Optional[List[str]] = None  # List of issue codes
    last_probe_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetTicketSummary(BaseModel):
    """Minimal ticket info for asset details page."""
    id: UUID
    ticket_number: str
    title: str
    status_id: UUID
    status_code: Optional[str] = None
    is_closed: bool = False
    priority: str
    created_at: datetime

    class Config:
        from_attributes = True


class AssetDetailResponse(AssetResponse):
    """Asset response with related objects and properties."""
    asset_type: AssetTypeResponse
    properties: List[AssetPropertyValueResponse] = []
    tickets: List[AssetTicketSummary] = []  # Service tickets for this asset
    has_active_ticket: bool = False  # True if any non-closed ticket exists


class AssetListResponse(BaseModel):
    """Paginated list of assets."""
    items: List[AssetResponse]
    total: int
    page: int
    page_size: int


# ========== Asset Event Schemas ==========

class AssetEventCreate(BaseModel):
    """Schema for creating an asset event."""
    event_type: str
    details: Optional[str] = None
    ticket_id: Optional[UUID] = None


class AssetEventResponse(BaseModel):
    """Asset event response."""
    id: UUID
    asset_id: UUID
    ticket_id: Optional[UUID] = None
    event_type: str
    details: Optional[str] = None
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True


# ========== NVR Disk Schemas ==========

class NVRDiskBase(BaseModel):
    """Base NVR disk fields."""
    slot_number: Optional[int] = None
    capacity_tb: float = Field(..., gt=0)
    install_date: date
    serial_number: Optional[str] = None
    # S.M.A.R.T. health data from probe
    status: Optional[str] = Field(default="ok", description="Disk status: ok, warning, error, unknown")
    working_hours: Optional[int] = Field(default=None, description="Power-on hours from S.M.A.R.T.")
    temperature: Optional[int] = Field(default=None, description="Temperature in Celsius")
    smart_status: Optional[str] = Field(default=None, description="S.M.A.R.T. status: Pass, Fail, Warning")


class NVRDiskCreate(NVRDiskBase):
    """Schema for creating an NVR disk."""
    pass


class NVRDiskUpdate(BaseModel):
    """Schema for updating an NVR disk (all fields optional)."""
    slot_number: Optional[int] = None
    capacity_tb: Optional[float] = Field(None, gt=0)
    install_date: Optional[date] = None
    serial_number: Optional[str] = None
    status: Optional[str] = None
    working_hours: Optional[int] = None
    temperature: Optional[int] = None
    smart_status: Optional[str] = None


class NVRDiskResponse(NVRDiskBase):
    """NVR disk response with all fields."""
    id: UUID
    asset_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== NVR Channel Schemas ==========

class NVRChannelBulkUpdate(BaseModel):
    """Schema for updating a single channel's customization."""
    channel_number: int = Field(..., ge=1, le=64, description="Channel number (1-64)")
    custom_name: Optional[str] = Field(None, max_length=100, description="User-friendly channel name")
    is_ignored: bool = Field(default=False, description="Exclude from health monitoring")
    notes: Optional[str] = Field(None, description="Service info: port, camera model, location")


class NVRChannelBulkUpdateRequest(BaseModel):
    """Schema for bulk channel updates."""
    channels: List[NVRChannelBulkUpdate] = Field(..., min_length=1, description="List of channel updates")


class ChannelWithStatusResponse(BaseModel):
    """Channel customization merged with live probe data."""
    channel_number: int
    # Customization fields (from nvr_channels table)
    custom_name: Optional[str] = None
    is_ignored: bool = False
    notes: Optional[str] = None
    # Live status fields (from last_probe_result)
    name: Optional[str] = None  # Device-reported name (e.g., "D1")
    ip_address: Optional[str] = None
    is_configured: bool = False  # Whether channel is configured on device
    is_online: bool = False
    has_recording_24h: bool = False
    # Audit fields
    updated_by_actor_display: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ========== Ticket-Asset Link Schemas ==========

class TicketAssetLink(BaseModel):
    """Schema for linking assets to tickets."""
    asset_ids: List[UUID]
    relation_type: str = "affected"
