"""
Pydantic schemas for admin endpoints.
"""
from typing import Optional
from pydantic import BaseModel, Field
from uuid import UUID


# ========== Ticket Status Admin ==========

class TicketStatusCreate(BaseModel):
    """Create ticket status definition."""
    code: str = Field(..., min_length=1, max_length=50)
    name_he: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    is_closed_state: bool = False
    sort_order: int = 0


class TicketStatusUpdate(BaseModel):
    """Update ticket status definition."""
    name_he: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_closed_state: Optional[bool] = None
    sort_order: Optional[int] = None


class TicketStatusResponse(BaseModel):
    """Ticket status definition response."""
    id: UUID
    code: str
    name_he: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    is_default: bool
    is_closed_state: bool
    sort_order: int

    class Config:
        from_attributes = True


# ========== Asset Type Admin ==========

class AssetTypeCreate(BaseModel):
    """Create asset type."""
    code: str = Field(..., min_length=1, max_length=50)
    name_he: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None


class AssetTypeUpdate(BaseModel):
    """Update asset type."""
    name_he: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AssetTypeResponse(BaseModel):
    """Asset type response."""
    id: UUID
    code: str
    name_he: Optional[str] = None
    name_en: Optional[str] = None
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# ========== Asset Property Definition Admin ==========

class AssetPropertyDefinitionCreate(BaseModel):
    """Create asset property definition."""
    asset_type_id: UUID
    key: str = Field(..., min_length=1, max_length=100)
    label_he: Optional[str] = None
    label_en: Optional[str] = None
    data_type: str = Field(..., pattern="^(string|int|bool|date|decimal|enum|secret)$")
    required: bool = False
    visibility: str = Field(default="internal_only", pattern="^(internal_only|client_admin|client_all)$")
    sort_order: int = 0


class AssetPropertyDefinitionUpdate(BaseModel):
    """Update asset property definition."""
    label_he: Optional[str] = None
    label_en: Optional[str] = None
    required: Optional[bool] = None
    visibility: Optional[str] = Field(None, pattern="^(internal_only|client_admin|client_all)$")
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


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
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True
