"""
Pydantic schemas for tickets domain: tickets, ticket events, work logs, line items.
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


# ========== Ticket Status Schemas ==========

class TicketStatusDefinitionResponse(BaseModel):
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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== Ticket Initiator Schemas ==========

class TicketInitiatorResponse(BaseModel):
    """Ticket initiator information."""
    initiator_type: str
    initiator_ref_id: Optional[UUID] = None
    initiator_display: str

    class Config:
        from_attributes = True


# ========== Ticket Schemas ==========

class TicketBase(BaseModel):
    """Base ticket fields."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    category: Optional[str] = None
    priority: str = "normal"
    source_channel: str
    reported_via: Optional[str] = None
    service_scope: str = "not_included"
    service_note: Optional[str] = None
    contact_phone: str = Field(..., min_length=1)
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


class TicketCreate(TicketBase):
    """Schema for creating a ticket."""
    client_id: UUID
    site_id: UUID
    contact_person_id: Optional[UUID] = None

    # Initiator information (will be set automatically from current user if not provided)
    initiator_type: Optional[str] = None
    initiator_ref_id: Optional[UUID] = None
    initiator_display: Optional[str] = None


class TicketUpdate(BaseModel):
    """Schema for updating a ticket (all fields optional)."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = None
    priority: Optional[str] = None
    reported_via: Optional[str] = None
    service_scope: Optional[str] = None
    service_note: Optional[str] = None
    contact_person_id: Optional[UUID] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = Field(None, min_length=1)
    contact_email: Optional[str] = None


class TicketResponse(TicketBase):
    """Ticket response with all fields."""
    id: UUID
    ticket_number: str
    client_id: UUID
    site_id: UUID
    status_id: UUID
    assigned_to_internal_user_id: Optional[UUID] = None
    contact_person_id: Optional[UUID] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketDetailResponse(TicketResponse):
    """Ticket response with related objects."""
    status: TicketStatusDefinitionResponse
    initiator: Optional[TicketInitiatorResponse] = None


class TicketListResponse(BaseModel):
    """Paginated list of tickets."""
    items: List[TicketResponse]
    total: int
    page: int
    page_size: int


# ========== Ticket Assignment Schemas ==========

class TicketAssignment(BaseModel):
    """Schema for assigning a ticket."""
    assigned_to_internal_user_id: Optional[UUID] = None


class TicketStatusChange(BaseModel):
    """Schema for changing ticket status."""
    status_id: UUID
    comment: Optional[str] = None


# ========== Ticket Event Schemas ==========

class TicketEventCreate(BaseModel):
    """Schema for creating a ticket event (comment)."""
    message: str = Field(..., min_length=1)


class TicketEventResponse(BaseModel):
    """Ticket event response."""
    id: UUID
    ticket_id: UUID
    event_type: str
    message: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True


# ========== Work Log Schemas ==========

class WorkLogBase(BaseModel):
    """Base work log fields."""
    work_type: str
    description: str = Field(..., min_length=1)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    duration_minutes: int = Field(..., gt=0)
    included_in_service: bool = False
    billing_note: Optional[str] = None


class WorkLogCreate(WorkLogBase):
    """Schema for creating a work log."""
    pass


class WorkLogUpdate(BaseModel):
    """Schema for updating a work log (all fields optional)."""
    work_type: Optional[str] = None
    description: Optional[str] = Field(None, min_length=1)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, gt=0)
    included_in_service: Optional[bool] = None
    billing_note: Optional[str] = None


class WorkLogResponse(WorkLogBase):
    """Work log response with all fields."""
    id: UUID
    ticket_id: UUID
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True


# ========== Line Item Schemas ==========

class LineItemBase(BaseModel):
    """Base line item fields."""
    item_type: str
    description: str = Field(..., min_length=1)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    included_in_service: bool = False
    chargeable: bool = True
    external_reference: Optional[str] = None
    linked_asset_id: Optional[UUID] = None


class LineItemCreate(LineItemBase):
    """Schema for creating a line item."""
    pass


class LineItemUpdate(BaseModel):
    """Schema for updating a line item (all fields optional)."""
    item_type: Optional[str] = None
    description: Optional[str] = Field(None, min_length=1)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    included_in_service: Optional[bool] = None
    chargeable: Optional[bool] = None
    external_reference: Optional[str] = None
    linked_asset_id: Optional[UUID] = None


class LineItemResponse(LineItemBase):
    """Line item response with all fields."""
    id: UUID
    ticket_id: UUID
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True
