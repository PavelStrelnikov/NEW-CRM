"""
Pydantic schemas for work logs.
"""
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from uuid import UUID
from datetime import datetime


class WorkLogBase(BaseModel):
    """Base work log fields."""
    work_type: str = Field(..., description="Type of work/activity")
    description: str = Field(..., min_length=1)
    included_in_service: bool = False
    billing_note: Optional[str] = None


class WorkLogCreate(WorkLogBase):
    """Schema for creating a work log."""
    # Mode A: Time range (start_at + end_at, duration computed)
    # Mode B: Duration only (start_at at 00:00 + duration_minutes, end_at NULL)
    start_at: datetime = Field(..., description="Start time (Mode A) or date at 00:00 (Mode B)")
    end_at: Optional[datetime] = Field(None, description="End time (Mode A only)")
    duration_minutes: Optional[int] = Field(None, ge=1, description="Duration in minutes (Mode B or computed from Mode A)")

    @model_validator(mode='after')
    def validate_time_mode(self):
        """Validate time tracking mode consistency."""
        start_at = self.start_at
        end_at = self.end_at
        duration = self.duration_minutes

        if end_at is not None:
            # Mode A: Time range
            if end_at <= start_at:
                raise ValueError('end_at must be after start_at')
            # Duration will be computed in API handler
            # User should not provide duration in Mode A, but if they do, ignore it
        else:
            # Mode B: Duration only
            if duration is None or duration <= 0:
                raise ValueError('duration_minutes required and must be > 0 when end_at is NULL')
            # start_at should be at 00:00 for date-only mode, but we allow flexibility

        return self


class WorkLogUpdate(BaseModel):
    """Schema for updating a work log."""
    work_type: Optional[str] = None
    description: Optional[str] = Field(None, min_length=1)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    included_in_service: Optional[bool] = None
    billing_note: Optional[str] = None

    @model_validator(mode='after')
    def validate_time_mode_update(self):
        """Validate time mode consistency for updates."""
        # If updating time fields, apply same validation as create
        if self.start_at is not None or self.end_at is not None or self.duration_minutes is not None:
            if self.end_at is not None:
                if self.start_at is not None and self.end_at <= self.start_at:
                    raise ValueError('end_at must be after start_at')
            # Allow partial updates without full validation (will be validated against existing record in API)

        return self


class WorkLogResponse(WorkLogBase):
    """Work log response."""
    id: UUID
    ticket_id: UUID
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    duration_minutes: int
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True
