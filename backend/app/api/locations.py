"""
Locations API endpoints.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.clients import Site, Location
from app.schemas.clients import (
    LocationCreate,
    LocationUpdate,
    LocationResponse
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import (
    get_current_active_user,
    require_admin
)

router = APIRouter()


@router.get("/sites/{site_id}/locations", response_model=list[LocationResponse])
async def list_locations_for_site(
    site_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all locations for a specific site.

    **RBAC:**
    - Internal users: Can see locations for any site
    - Client users: Can only see locations for sites belonging to their client
    """
    # Verify site exists
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

    # Get locations for this site
    locations = db.query(Location).filter(Location.site_id == site_id).all()

    return locations


@router.post("/sites/{site_id}/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    site_id: UUID,
    location_data: LocationCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new location for a site.

    **RBAC:** Admin only
    """
    # Verify site exists
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    # Ensure location_data.site_id matches URL site_id
    if str(location_data.site_id) != str(site_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="site_id in URL does not match site_id in body"
        )

    # Create location
    location = Location(**location_data.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)

    return location


@router.get("/locations/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific location by ID.

    **RBAC:**
    - Internal users: Can access any location
    - Client users: Can only access locations belonging to their client's sites
    """
    location = db.query(Location).filter(Location.id == location_id).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Apply RBAC check - need to join through site to get client_id
    site = db.query(Site).filter(Site.id == location.site_id).first()
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(site.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    return location


@router.patch("/locations/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: UUID,
    location_data: LocationUpdate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update a location.

    **RBAC:** Admin only
    """
    location = db.query(Location).filter(Location.id == location_id).first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )

    # Update only provided fields
    update_data = location_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(location, field, value)

    db.commit()
    db.refresh(location)

    return location
