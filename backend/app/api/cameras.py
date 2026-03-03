"""
API endpoints for camera snapshot and listing.

Provides camera-centric endpoints for standalone CAMERA-type assets.
NVR channel snapshots remain in hikvision.py — this router serves
individual CAMERA assets with auto-detection of protocol.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin_or_technician
from app.db.session import get_db
from app.integrations.hikvision.isapi_client import IsapiError
from app.schemas.auth import CurrentUser
from app.schemas.cameras import CameraInfoResponse, CameraListResponse
from app.services.camera_service import (
    get_camera_detail,
    get_snapshot,
    list_cameras,
)
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.get("/", response_model=CameraListResponse)
async def list_cameras_endpoint(
    client_id: Optional[UUID] = Query(None),
    site_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin_or_technician),
):
    """List all CAMERA assets with optional client/site filters."""
    items, total = list_cameras(db, client_id, site_id, page, page_size)
    return CameraListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{asset_id}/info", response_model=CameraInfoResponse)
async def get_camera_info_endpoint(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin_or_technician),
):
    """Get camera details including parent NVR info."""
    try:
        detail = get_camera_detail(db, asset_id)
    except ValueError as e:
        status = 404 if "not found" in str(e).lower() else 400
        raise HTTPException(status_code=status, detail=str(e))
    return detail


@router.get("/{asset_id}/snapshot")
async def get_camera_snapshot(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin_or_technician),
):
    """
    Get JPEG snapshot from a CAMERA asset.

    Auto-detects protocol (ISAPI via parent NVR, or direct RTSP via ffmpeg).
    Returns binary JPEG with Content-Type: image/jpeg.
    """
    logger.info(f"[camera-snapshot] Requested by user={current_user.name} for asset_id={asset_id}")

    try:
        jpeg_data = await get_snapshot(db, asset_id)
    except ValueError as e:
        status = 404 if "not found" in str(e).lower() else 400
        raise HTTPException(status_code=status, detail=str(e))
    except IsapiError as e:
        status = 503 if "timed out" in str(e) or "connect" in str(e).lower() else 502
        raise HTTPException(status_code=status, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return Response(
        content=jpeg_data,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f"inline; filename=camera_{asset_id}.jpg",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
