"""
Pydantic schemas for projects domain: projects, project events, project links.
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date


# ========== Project Event Schemas ==========

class ProjectEventCreate(BaseModel):
    """Schema for creating a project event."""
    event_type: str = Field(..., min_length=1, max_length=50, pattern="^(note|status_change|milestone)$")
    message: str = Field(..., min_length=1)


class ProjectEventResponse(BaseModel):
    """Project event response."""
    id: UUID
    project_id: UUID
    event_type: str
    message: str
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True


# ========== Project Schemas ==========

class ProjectBase(BaseModel):
    """Base project fields."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = Field(default="planned", pattern="^(planned|active|on_hold|completed|canceled)$")
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    actual_end_date: Optional[date] = None


class ProjectCreate(ProjectBase):
    """Schema for creating a project."""
    client_id: UUID


class ProjectUpdate(BaseModel):
    """Schema for updating a project (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(planned|active|on_hold|completed|canceled)$")
    start_date: Optional[date] = None
    target_end_date: Optional[date] = None
    actual_end_date: Optional[date] = None


class ProjectResponse(ProjectBase):
    """Project response with all fields."""
    id: UUID
    client_id: UUID
    created_by_actor_type: str
    created_by_actor_id: Optional[UUID] = None
    created_by_actor_display: str
    created_at: datetime
    updated_at: datetime

    # Optional nested data
    client_name: Optional[str] = None
    events: Optional[List[ProjectEventResponse]] = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Response for list of projects."""
    items: List[ProjectResponse]
    total: int


# ========== Project Link Schemas ==========

class ProjectSiteLink(BaseModel):
    """Schema for linking sites to a project."""
    site_ids: List[UUID] = Field(..., min_length=1)


class ProjectTicketLink(BaseModel):
    """Schema for linking tickets to a project."""
    ticket_ids: List[UUID] = Field(..., min_length=1)


class ProjectAssetLink(BaseModel):
    """Schema for linking assets to a project."""
    asset_ids: List[UUID] = Field(..., min_length=1)
