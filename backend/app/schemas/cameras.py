"""
Pydantic schemas for camera API endpoints.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CameraListItem(BaseModel):
    """Camera item in list response."""
    id: UUID
    label: str
    client_id: UUID
    client_name: Optional[str] = None
    site_id: UUID
    site_name: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    status: str
    camera_protocol: Optional[str] = None
    camera_channel_number: Optional[int] = None
    parent_nvr_id: Optional[str] = None
    parent_nvr_label: Optional[str] = None
    health_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CameraListResponse(BaseModel):
    """Paginated camera list."""
    items: List[CameraListItem]
    total: int
    page: int
    page_size: int


class CameraInfoResponse(BaseModel):
    """Detailed camera info with parent NVR."""
    id: UUID
    label: str
    client_id: UUID
    client_name: Optional[str] = None
    site_id: UUID
    site_name: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    status: str
    camera_protocol: Optional[str] = None
    camera_channel_number: Optional[int] = None
    camera_stream_type: Optional[str] = None
    camera_rtsp_url_masked: Optional[str] = None
    parent_nvr_id: Optional[str] = None
    parent_nvr_label: Optional[str] = None
    parent_nvr_health_status: Optional[str] = None
    health_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
