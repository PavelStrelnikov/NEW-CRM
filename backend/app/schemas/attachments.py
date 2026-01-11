"""
Pydantic schemas for attachments.
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class AttachmentResponse(BaseModel):
    """Attachment response schema."""
    id: UUID
    linked_type: str
    linked_id: UUID
    filename: str
    mime_type: str
    size_bytes: int
    uploaded_by_actor_display: str
    created_at: datetime

    class Config:
        from_attributes = True


class AttachmentListResponse(BaseModel):
    """List of attachments."""
    items: list[AttachmentResponse]
    total: int
