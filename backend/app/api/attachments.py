"""
Attachments API endpoints.
"""
import os
import uuid
import shutil
from pathlib import Path
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.attachments import Attachment, LinkedType
from app.models.tickets import Ticket
from app.models.assets import Asset
from app.models.projects import Project
from app.models.clients import Client, Site
from app.schemas.attachments import AttachmentResponse, AttachmentListResponse
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user

router = APIRouter()

# Configuration
UPLOAD_DIR = "./data/uploads"
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip"
]


def verify_client_access(
    db: Session,
    current_user: CurrentUser,
    linked_type: str,
    linked_id: UUID
) -> bool:
    """
    Verify that client user has access to the linked entity.

    Returns True if access allowed, raises HTTPException if not.
    """
    if current_user.user_type != "client":
        return True  # Internal users have full access

    # Get client_id from linked entity
    entity_client_id = None

    if linked_type == LinkedType.TICKET.value:
        ticket = db.query(Ticket).filter(Ticket.id == linked_id).first()
        if ticket:
            entity_client_id = ticket.client_id
    elif linked_type == LinkedType.ASSET.value:
        asset = db.query(Asset).filter(Asset.id == linked_id).first()
        if asset:
            entity_client_id = asset.client_id
    elif linked_type == LinkedType.PROJECT.value:
        project = db.query(Project).filter(Project.id == linked_id).first()
        if project:
            entity_client_id = project.client_id
    elif linked_type == LinkedType.SITE.value:
        site = db.query(Site).filter(Site.id == linked_id).first()
        if site:
            entity_client_id = site.client_id
    elif linked_type == LinkedType.CLIENT.value:
        entity_client_id = linked_id

    if entity_client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied to this entity")

    return True


@router.post("/attachments", response_model=AttachmentResponse, status_code=201)
async def upload_attachment(
    linked_type: str = Form(...),
    linked_id: UUID = Form(...),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload a file attachment.

    **RBAC:**
    - Internal users: Can upload to any entity
    - Client users: Can only upload to their own client's entities
    """
    # Validate linked_type
    try:
        LinkedType(linked_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid linked_type. Must be one of: {', '.join([t.value for t in LinkedType])}"
        )

    # Verify client access
    verify_client_access(db, current_user, linked_type, linked_id)

    # Validate file size
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024 * 1024)}MB"
        )

    # Validate mime type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}"
        )

    # Create storage directory
    storage_dir = Path(UPLOAD_DIR) / linked_type / str(linked_id)
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    storage_path = storage_dir / unique_filename
    relative_path = str(storage_path).replace("\\", "/")

    # Save file
    with open(storage_path, "wb") as f:
        f.write(file_content)

    # Create attachment record
    attachment = Attachment(
        linked_type=linked_type,
        linked_id=linked_id,
        filename=file.filename,
        mime_type=file.content_type,
        size_bytes=file_size,
        storage_path=relative_path,
        uploaded_by_actor_type=current_user.user_type,
        uploaded_by_actor_id=current_user.id,
        uploaded_by_actor_display=current_user.name
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.get("/attachments", response_model=AttachmentListResponse)
def list_attachments(
    linked_type: Optional[str] = Query(None),
    linked_id: Optional[UUID] = Query(None),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List attachments with optional filtering.

    **RBAC:**
    - Internal users: Can see all attachments
    - Client users: Can only see attachments for their own client's entities
    """
    query = db.query(Attachment)

    # Apply filters
    if linked_type:
        query = query.filter(Attachment.linked_type == linked_type)
    if linked_id:
        # Verify client access if specified
        if linked_type and linked_id:
            verify_client_access(db, current_user, linked_type, linked_id)
        query = query.filter(Attachment.linked_id == linked_id)

    # For client users, filter to their own entities
    if current_user.user_type == "client" and not linked_id:
        # Get all entity IDs belonging to this client
        # This is complex, so for MVP we require linked_id for client users
        if not linked_id:
            raise HTTPException(
                status_code=400,
                detail="Client users must specify linked_id when listing attachments"
            )

    query = query.order_by(Attachment.created_at.desc())
    attachments = query.all()

    return AttachmentListResponse(
        items=attachments,
        total=len(attachments)
    )


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Download an attachment file.

    **RBAC:**
    - Internal users: Can download any attachment
    - Client users: Can only download attachments for their own client's entities
    """
    # Get attachment
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Verify client access
    verify_client_access(db, current_user, attachment.linked_type, attachment.linked_id)

    # Check if file exists
    file_path = Path(attachment.storage_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Return file
    return FileResponse(
        path=str(file_path),
        filename=attachment.filename,
        media_type=attachment.mime_type
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete an attachment (admin only).

    **RBAC:** Admin only
    """
    if current_user.user_type != "internal" or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get attachment
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Delete file from disk
    file_path = Path(attachment.storage_path)
    if file_path.exists():
        file_path.unlink()

    # Delete record
    db.delete(attachment)
    db.commit()

    return None
