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
from app.auth.dependencies import (
    get_current_active_user,
    require_admin
)

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
