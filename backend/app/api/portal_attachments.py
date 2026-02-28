"""
Portal Attachments API endpoints.
Provides file attachment operations for portal users (client-admin, client-user).
"""
import os
import uuid
import shutil
from pathlib import Path
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.attachments import Attachment, LinkedType
from app.models.tickets import Ticket
from app.models.assets import Asset
from app.models.projects import Project
from app.models.clients import Client, Site
from app.schemas.attachments import AttachmentResponse, AttachmentListResponse
from app.api.portal_auth import get_client_user, ClientUserClaims
from app.models.users import ClientUser
from app.rbac import check_client_user_client_access

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


def verify_portal_entity_access(
    db: Session,
    claims: ClientUserClaims,
    user_id: UUID,
    linked_type: str,
    linked_id: UUID
) -> UUID:
    """
    Verify that portal user has access to the linked entity.

    Returns the entity's client_id if access allowed, raises HTTPException if not.
    """
    entity_client_id = None

    if linked_type == LinkedType.TICKET.value:
        ticket = db.query(Ticket).filter(Ticket.id == linked_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        entity_client_id = ticket.client_id
    elif linked_type == LinkedType.ASSET.value:
        asset = db.query(Asset).filter(Asset.id == linked_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        entity_client_id = asset.client_id
    elif linked_type == LinkedType.PROJECT.value:
        project = db.query(Project).filter(Project.id == linked_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        entity_client_id = project.client_id
    elif linked_type == LinkedType.SITE.value:
        site = db.query(Site).filter(Site.id == linked_id).first()
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")
        entity_client_id = site.client_id
    elif linked_type == LinkedType.CLIENT.value:
        client = db.query(Client).filter(Client.id == linked_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        entity_client_id = linked_id
    else:
        raise HTTPException(status_code=400, detail=f"Invalid linked_type: {linked_type}")

    # Check if user has access to this client
    if not check_client_user_client_access(db, claims, user_id, entity_client_id):
        raise HTTPException(status_code=403, detail="Access denied to this entity")

    return entity_client_id


@router.post("/portal/attachments", response_model=AttachmentResponse, status_code=201)
async def upload_portal_attachment(
    linked_type: str = Form(...),
    linked_id: UUID = Form(...),
    file: UploadFile = File(...),
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Upload a file attachment (portal users).

    **RBAC:**
    - Portal users: Can only upload to entities they have access to
    """
    claims, user = claims_and_user

    # Validate linked_type
    try:
        LinkedType(linked_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid linked_type. Must be one of: {', '.join([t.value for t in LinkedType])}"
        )

    # Verify portal user access
    entity_client_id = verify_portal_entity_access(db, claims, user.id, linked_type, linked_id)

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
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = storage_dir / unique_filename

    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)

    # Create attachment record
    attachment = Attachment(
        id=uuid.uuid4(),
        linked_type=linked_type,
        linked_id=linked_id,
        filename=file.filename,
        stored_filename=unique_filename,
        file_size=file_size,
        mime_type=file.content_type,
        uploaded_by_actor_type="client_user",
        uploaded_by_actor_id=user.id,
        uploaded_by_actor_display=user.name
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return AttachmentResponse(
        id=str(attachment.id),
        linked_type=attachment.linked_type,
        linked_id=str(attachment.linked_id),
        filename=attachment.filename,
        file_size=attachment.file_size,
        mime_type=attachment.mime_type,
        uploaded_by_actor_display=attachment.uploaded_by_actor_display,
        created_at=attachment.created_at.isoformat()
    )


@router.get("/portal/attachments", response_model=AttachmentListResponse)
def list_portal_attachments(
    linked_type: Optional[str] = Query(None),
    linked_id: Optional[UUID] = Query(None),
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    List attachments with optional filtering (portal users).

    **RBAC:**
    - Portal users: Can only see attachments for entities they have access to
    """
    claims, user = claims_and_user

    # Portal users must specify linked_id (can't list all attachments)
    if not linked_id:
        raise HTTPException(
            status_code=400,
            detail="Portal users must specify linked_id when listing attachments"
        )

    # Verify portal user access
    if linked_type and linked_id:
        verify_portal_entity_access(db, claims, user.id, linked_type, linked_id)

    query = db.query(Attachment)

    # Apply filters
    if linked_type:
        query = query.filter(Attachment.linked_type == linked_type)
    if linked_id:
        query = query.filter(Attachment.linked_id == linked_id)

    query = query.order_by(Attachment.created_at.desc())
    attachments = query.all()

    return AttachmentListResponse(
        items=attachments,
        total=len(attachments)
    )


@router.get("/portal/attachments/{attachment_id}/download")
async def download_portal_attachment(
    attachment_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Download an attachment file (portal users).

    **RBAC:**
    - Portal users: Can only download attachments for entities they have access to
    """
    claims, user = claims_and_user

    # Get attachment
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Verify portal user access
    verify_portal_entity_access(db, claims, user.id, attachment.linked_type, attachment.linked_id)

    # Build file path
    file_path = Path(UPLOAD_DIR) / attachment.linked_type / str(attachment.linked_id) / attachment.stored_filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=attachment.filename,
        media_type=attachment.mime_type
    )


@router.delete("/portal/attachments/{attachment_id}")
def delete_portal_attachment(
    attachment_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Delete an attachment (CLIENT_ADMIN only).

    **RBAC:**
    - CLIENT_ADMIN: Can delete attachments for entities they have access to
    - CLIENT_USER: Cannot delete attachments
    """
    claims, user = claims_and_user

    # Only CLIENT_ADMIN can delete
    if claims.role != "CLIENT_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only CLIENT_ADMIN can delete attachments"
        )

    # Get attachment
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Verify portal user access
    verify_portal_entity_access(db, claims, user.id, attachment.linked_type, attachment.linked_id)

    # Delete file from disk
    file_path = Path(UPLOAD_DIR) / attachment.linked_type / str(attachment.linked_id) / attachment.stored_filename
    if file_path.exists():
        file_path.unlink()

    # Delete database record
    db.delete(attachment)
    db.commit()

    return {"message": "Attachment deleted successfully"}
