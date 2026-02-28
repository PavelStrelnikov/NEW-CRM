"""
Pydantic schemas for internal users management (admin only).
"""
from typing import Optional
from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime


class InternalUserBase(BaseModel):
    """Base internal user fields."""
    name: str
    email: str  # Changed from EmailStr to allow .local domains
    phone: Optional[str] = None
    role: str  # 'admin' | 'technician' | 'office'
    preferred_locale: Optional[str] = 'he'
    is_active: bool = True

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate role is one of the allowed values."""
        allowed = {'admin', 'technician', 'office'}
        if v not in allowed:
            raise ValueError(f'Role must be one of: {", ".join(allowed)}')
        return v

    @field_validator('preferred_locale')
    @classmethod
    def validate_locale(cls, v: Optional[str]) -> str:
        """Validate locale is supported."""
        allowed = {'he', 'en', 'he-IL', 'en-US'}
        if v and v not in allowed:
            raise ValueError(f'Locale must be one of: {", ".join(allowed)}')
        # Normalize to short form
        if v == 'he-IL':
            return 'he'
        if v == 'en-US':
            return 'en'
        return v or 'he'


class InternalUserCreate(InternalUserBase):
    """Schema for creating an internal user."""
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password meets minimum requirements."""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v


class InternalUserUpdate(BaseModel):
    """Schema for updating an internal user (all fields optional)."""
    name: Optional[str] = None
    email: Optional[str] = None  # Changed from EmailStr to allow .local domains
    phone: Optional[str] = None
    role: Optional[str] = None
    preferred_locale: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        """Validate role is one of the allowed values."""
        if v is not None:
            allowed = {'admin', 'technician', 'office'}
            if v not in allowed:
                raise ValueError(f'Role must be one of: {", ".join(allowed)}')
        return v

    @field_validator('preferred_locale')
    @classmethod
    def validate_locale(cls, v: Optional[str]) -> Optional[str]:
        """Validate locale is supported."""
        if v is not None:
            allowed = {'he', 'en', 'he-IL', 'en-US'}
            if v not in allowed:
                raise ValueError(f'Locale must be one of: {", ".join(allowed)}')
            # Normalize to short form
            if v == 'he-IL':
                return 'he'
            if v == 'en-US':
                return 'en'
        return v


class InternalUserResponse(BaseModel):
    """Internal user response with all fields."""
    id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    preferred_locale: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InternalUserListResponse(BaseModel):
    """Paginated list of internal users."""
    items: list[InternalUserResponse]
    total: int
    page: Optional[int] = None
    page_size: Optional[int] = None
