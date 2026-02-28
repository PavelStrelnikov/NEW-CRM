"""
Pydantic schemas for ticket-asset linking.
"""
from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class TicketAssetLinkCreate(BaseModel):
    """Schema for linking an asset to a ticket."""
    asset_id: UUID
    relation_type: str = Field(default="affected", description="Type of relationship: affected, repaired, replaced, mentioned")


class TicketAssetLinkUpdate(BaseModel):
    """Schema for updating ticket-asset link."""
    relation_type: str = Field(..., description="Type of relationship: affected, repaired, replaced, mentioned")


class AssetTypeInfo(BaseModel):
    """Asset type info for responses."""
    code: str
    name_he: Optional[str] = None
    name_en: Optional[str] = None

    class Config:
        from_attributes = True


class LinkedAssetResponse(BaseModel):
    """Asset info in ticket-asset link response."""
    id: UUID
    label: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    status: str
    asset_type: Optional[AssetTypeInfo] = None
    relation_type: str  # From the link table

    class Config:
        from_attributes = True


class TicketAssetLinkResponse(BaseModel):
    """Ticket-asset link response."""
    ticket_id: UUID
    asset_id: UUID
    relation_type: str

    class Config:
        from_attributes = True


class TicketInfoResponse(BaseModel):
    """Minimal ticket info for asset history."""
    id: UUID
    ticket_number: str
    title: str
    status_code: Optional[str] = None
    priority: str
    relation_type: str  # From the link table
    created_at: datetime
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
