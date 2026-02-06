"""
Pydantic schemas for clients domain: clients, sites, contacts, locations.
"""
from typing import Optional, List
from pydantic import BaseModel, field_validator, model_validator
from uuid import UUID
from datetime import datetime


# ========== Client Schemas ==========

class ClientBase(BaseModel):
    """Base client fields."""
    name: str
    tax_id: Optional[str] = None
    main_phone: Optional[str] = None
    main_email: Optional[str] = None
    main_address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class ClientCreate(ClientBase):
    """Schema for creating a client."""
    pass


class ClientUpdate(BaseModel):
    """Schema for updating a client (all fields optional)."""
    name: Optional[str] = None
    tax_id: Optional[str] = None
    main_phone: Optional[str] = None
    main_email: Optional[str] = None
    main_address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(ClientBase):
    """Client response with all fields."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    @model_validator(mode='before')
    @classmethod
    def convert_status_to_is_active(cls, data):
        """Convert status field to is_active for frontend compatibility."""
        if hasattr(data, 'status'):
            # ORM model object
            data_dict = {
                'id': data.id,
                'name': data.name,
                'tax_id': data.tax_id,
                'main_phone': data.main_phone,
                'main_email': data.main_email,
                'main_address': data.main_address,
                'notes': data.notes,
                'is_active': data.status == 'active',
                'created_at': data.created_at,
                'updated_at': data.updated_at,
            }
            return data_dict
        return data

    class Config:
        from_attributes = True


class ClientListResponse(BaseModel):
    """Paginated list of clients."""
    items: List[ClientResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ========== Site Schemas ==========

class SiteBase(BaseModel):
    """Base site fields."""
    name: str
    address: Optional[str] = None
    is_default: bool = False
    notes: Optional[str] = None


class SiteCreate(SiteBase):
    """Schema for creating a site."""
    client_id: UUID


class SiteUpdate(BaseModel):
    """Schema for updating a site (all fields optional)."""
    name: Optional[str] = None
    address: Optional[str] = None
    is_default: Optional[bool] = None
    notes: Optional[str] = None


class SiteResponse(SiteBase):
    """Site response with all fields."""
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== Contact Schemas ==========

class ContactBase(BaseModel):
    """Base contact fields."""
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    notes: Optional[str] = None
    applies_to_all_sites: bool = True


class ContactCreate(ContactBase):
    """Schema for creating a contact."""
    client_id: UUID
    site_ids: Optional[List[UUID]] = None  # Required if applies_to_all_sites is False


class ContactUpdate(BaseModel):
    """Schema for updating a contact (all fields optional)."""
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    notes: Optional[str] = None
    applies_to_all_sites: Optional[bool] = None
    site_ids: Optional[List[UUID]] = None


class ContactResponse(ContactBase):
    """Contact response with all fields."""
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContactWithSites(ContactResponse):
    """Contact response with linked sites."""
    site_ids: List[UUID]


class ContactSiteLink(BaseModel):
    """Schema for linking/unlinking contact to sites."""
    site_ids: List[UUID]


# ========== Location Schemas ==========

class LocationBase(BaseModel):
    """Base location fields."""
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    description: Optional[str] = None


class LocationCreate(LocationBase):
    """Schema for creating a location."""
    site_id: UUID


class LocationUpdate(BaseModel):
    """Schema for updating a location (all fields optional)."""
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    description: Optional[str] = None


class LocationResponse(LocationBase):
    """Location response with all fields."""
    id: UUID
    site_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
