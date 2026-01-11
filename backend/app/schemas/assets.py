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
    location_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetDetailResponse(AssetResponse):
    """Asset response with related objects and properties."""
    asset_type: AssetTypeResponse
    properties: List[AssetPropertyValueResponse] = []


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


class NVRDiskCreate(NVRDiskBase):
    """Schema for creating an NVR disk."""
    pass


class NVRDiskUpdate(BaseModel):
    """Schema for updating an NVR disk (all fields optional)."""
    slot_number: Optional[int] = None
    capacity_tb: Optional[float] = Field(None, gt=0)
    install_date: Optional[date] = None
    serial_number: Optional[str] = None


class NVRDiskResponse(NVRDiskBase):
    """NVR disk response with all fields."""
    id: UUID
    asset_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== Ticket-Asset Link Schemas ==========

class TicketAssetLink(BaseModel):
    """Schema for linking assets to tickets."""
    asset_ids: List[UUID]
    relation_type: str = "affected"
