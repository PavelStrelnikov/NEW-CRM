"""
Pydantic schemas for authentication.
"""
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr
from uuid import UUID


class LoginRequest(BaseModel):
    """Login request payload."""
    email: str  # Changed from EmailStr to allow .local domains
    password: str


class TokenResponse(BaseModel):
    """Token response after successful login."""
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    """Base user information."""
    id: UUID
    name: str
    email: str
    is_active: bool
    preferred_locale: str


class InternalUserResponse(UserBase):
    """Internal user response."""
    role: Literal["admin", "technician", "office"]
    user_type: str = "internal"

    class Config:
        from_attributes = True


class ClientUserResponse(UserBase):
    """Client user response."""
    role: Literal["CLIENT_USER", "CLIENT_CONTACT", "CLIENT_ADMIN"]
    client_id: UUID
    user_type: str = "client"

    class Config:
        from_attributes = True


class CurrentUser(BaseModel):
    """Current authenticated user information."""
    id: UUID
    name: str
    email: str
    role: str
    user_type: Literal["internal", "client"]
    client_id: Optional[UUID] = None
    is_active: bool
    preferred_locale: str
