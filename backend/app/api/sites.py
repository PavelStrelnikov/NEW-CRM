"""
Sites API endpoints.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.clients import Client, Site
from app.schemas.clients import (
    SiteCreate,
    SiteUpdate,
    SiteResponse
)
from app.schemas.auth import CurrentUser
from app.schemas.deletion import SiteDeletionSummary, DeletionResponse
from app.auth.dependencies import (
    get_current_active_user,
    require_admin
)
from app.services.deletion_service import deletion_service
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter()


@router.get("/clients/{client_id}/sites", response_model=list[SiteResponse])
async def list_sites_for_client(
    client_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all sites for a specific client.

    **RBAC:**
    - Internal users: Can see sites for any client
    - Client users: Can only see sites for their own client
    """
    # Verify client exists
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Get sites for this client
    sites = db.query(Site).filter(Site.client_id == client_id).all()

    return sites


@router.post("/clients/{client_id}/sites", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    client_id: UUID,
    site_data: SiteCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new site for a client.

    **RBAC:** Admin only

    If marked as default site, automatically unsets other default sites for this client.
    """
    # Verify client exists
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Ensure site_data.client_id matches URL client_id
    if str(site_data.client_id) != str(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id in URL does not match client_id in body"
        )

    # If this is being marked as default, unset other default sites
    if site_data.is_default:
        db.query(Site).filter(
            Site.client_id == client_id,
            Site.is_default == True
        ).update({"is_default": False})

    # Create site
    site = Site(**site_data.model_dump())
    db.add(site)
    db.commit()
    db.refresh(site)

    return site


@router.get("/sites/{site_id}", response_model=SiteResponse)
async def get_site(
    site_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific site by ID.

    **RBAC:**
    - Internal users: Can access any site
    - Client users: Can only access sites belonging to their client
    """
    site = db.query(Site).filter(Site.id == site_id).first()

    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(site.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    return site


@router.patch("/sites/{site_id}", response_model=SiteResponse)
async def update_site(
    site_id: UUID,
    site_data: SiteUpdate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update a site.

    **RBAC:** Admin only

    If setting is_default=True, automatically unsets other default sites for this client.
    """
    site = db.query(Site).filter(Site.id == site_id).first()

    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    # If setting as default, unset other default sites for this client
    update_data = site_data.model_dump(exclude_unset=True)
    if update_data.get("is_default") is True:
        db.query(Site).filter(
            Site.client_id == site.client_id,
            Site.id != site_id,
            Site.is_default == True
        ).update({"is_default": False})

    # Update only provided fields
    for field, value in update_data.items():
        setattr(site, field, value)

    db.commit()
    db.refresh(site)

    return site


@router.get("/sites/{site_id}/deletion-summary", response_model=SiteDeletionSummary)
async def get_site_deletion_summary(
    site_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get pre-deletion summary for a site.

    **RBAC:** Admin only

    Returns detailed counts of all records that will be affected by deleting this site:
    - Locations, contact links (will be CASCADE deleted)
    - Tickets, assets (block deletion unless force=true)

    Use this endpoint before DELETE to show the user what will be affected.
    """
    summary = deletion_service.get_site_deletion_summary(db, site_id)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    return summary


@router.delete("/sites/{site_id}", response_model=DeletionResponse)
async def delete_site(
    site_id: UUID,
    force: bool = Query(False, description="Force delete all related records (tickets, assets)"),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a site and all associated data.

    **RBAC:** Admin only

    **Behavior:**
    - By default (force=false): Returns 409 Conflict if site has tickets or assets
    - With force=true: Cascade deletes ALL related data including tickets and assets

    **CASCADE deleted (always):**
    - Locations
    - Contact-site links (contacts themselves remain)

    **RESTRICT (require force=true):**
    - Tickets (and their work logs, events, line items)
    - Assets (and their property values, disks, channels)

    **Warning:** This operation is irreversible. Use the deletion-summary endpoint first
    to understand what will be deleted.

    **Note:** Cannot delete the last site of a client or the default site if it's the only one.
    """
    # Check if this is the only site for the client
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    sites_count = db.query(Site).filter(Site.client_id == site.client_id).count()
    if sites_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete the last site of a client. Delete the client instead."
        )

    try:
        result = await deletion_service.delete_site(
            db=db,
            site_id=site_id,
            force=force,
            actor_type="internal_user" if current_user.user_type == "internal" else "client_user",
            actor_id=current_user.id,
            actor_display=current_user.name
        )
        logger.info(f"Site {site_id} deleted by {current_user.name}")
        return result

    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        # Blocking reason - cannot delete without force
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_msg
        )
