"""
Portal clients API endpoints for client users.
Allows CLIENT_ADMIN users to view their assigned clients and sites.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.clients import Client, ClientStatus, Site, Contact
from app.models.users import ClientUser, ClientUserRole, ClientUserSite
from app.guards import ClientUserClaims, get_client_user
from app.rbac import check_client_user_client_access
from pydantic import BaseModel


router = APIRouter()


# ========== Schemas ==========

class PortalClientResponse(BaseModel):
    """Portal client information (read-only)."""
    id: str
    name: str
    is_active: bool
    is_primary: bool  # True if this is the user's primary client

    class Config:
        from_attributes = True


class PortalClientsListResponse(BaseModel):
    """List of clients accessible to portal user."""
    items: List[PortalClientResponse]
    total: int


# ========== Endpoints ==========

@router.get("/clients", response_model=PortalClientsListResponse)
async def list_portal_clients(
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get list of clients accessible to current portal user.

    **For CLIENT_ADMIN:** Returns all assigned clients from allowed_client_ids
    **For CLIENT_USER/CLIENT_CONTACT:** Returns only their primary client

    **RBAC:** Portal users only
    """
    claims, user = claims_and_user

    # Get allowed client IDs from claims
    allowed_client_ids = claims.allowed_client_ids if claims.allowed_client_ids else [claims.client_id]

    # Convert to UUID for query
    client_uuids = [UUID(cid) for cid in allowed_client_ids]

    # Query clients
    clients = db.query(Client).filter(
        Client.id.in_(client_uuids),
        Client.status == ClientStatus.ACTIVE.value
    ).order_by(Client.name).all()

    # Map to response with is_primary flag
    primary_client_id = claims.primary_client_id or claims.client_id

    items = [
        PortalClientResponse(
            id=str(client.id),
            name=client.name,
            is_active=(client.status == ClientStatus.ACTIVE.value),
            is_primary=(str(client.id) == primary_client_id)
        )
        for client in clients
    ]

    return PortalClientsListResponse(
        items=items,
        total=len(items)
    )


@router.get("/clients/{client_id}", response_model=PortalClientResponse)
async def get_portal_client(
    client_id: str,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific client.

    **Access Control:** User must have access to this client via allowed_client_ids

    **RBAC:** Portal users only
    """
    claims, user = claims_and_user

    # Verify user has access to this client
    if not claims.can_access_client(UUID(client_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this client"
        )

    # Get client
    client = db.query(Client).filter(
        Client.id == UUID(client_id),
        Client.status == ClientStatus.ACTIVE.value
    ).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    primary_client_id = claims.primary_client_id or claims.client_id

    return PortalClientResponse(
        id=str(client.id),
        name=client.name,
        is_active=(client.status == ClientStatus.ACTIVE.value),
        is_primary=(str(client.id) == primary_client_id)
    )


# ========== Site Schemas ==========

class PortalSiteResponse(BaseModel):
    """Portal site information."""
    id: str
    client_id: str
    name: str
    address: Optional[str]

    class Config:
        from_attributes = True


class PortalSitesListResponse(BaseModel):
    """List of sites."""
    items: List[PortalSiteResponse]
    total: int


# ========== Site Endpoints ==========

@router.get("/clients/{client_id}/sites", response_model=PortalSitesListResponse)
async def list_client_sites(
    client_id: str,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get list of sites for a specific client.

    **For CLIENT_ADMIN:** Returns all sites of the client
    **For CLIENT_USER/CLIENT_CONTACT:** Returns only their allowed sites

    **RBAC:** Portal users only
    """
    claims, user = claims_and_user

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, UUID(client_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this client"
        )

    # Build query (Site doesn't have is_active field)
    query = db.query(Site).filter(
        Site.client_id == UUID(client_id)
    )

    # For CLIENT_USER/CLIENT_CONTACT, filter by allowed sites
    if claims.role in [ClientUserRole.CLIENT_USER.value, ClientUserRole.CLIENT_CONTACT.value]:
        allowed_sites = db.query(ClientUserSite).filter(
            ClientUserSite.client_user_id == user.id
        ).all()
        allowed_site_ids = [s.site_id for s in allowed_sites]
        if not allowed_site_ids:
            return PortalSitesListResponse(items=[], total=0)
        query = query.filter(Site.id.in_(allowed_site_ids))

    sites = query.order_by(Site.name).all()

    items = [
        PortalSiteResponse(
            id=str(site.id),
            client_id=str(site.client_id),
            name=site.name,
            address=site.address
        )
        for site in sites
    ]

    return PortalSitesListResponse(items=items, total=len(items))


@router.get("/sites/{site_id}", response_model=PortalSiteResponse)
async def get_portal_site(
    site_id: str,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific site.

    **Access Control:** User must have access to this site's client

    **RBAC:** Portal users only
    """
    claims, user = claims_and_user

    # Get site
    site = db.query(Site).filter(
        Site.id == UUID(site_id)
    ).first()

    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, site.client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this site"
        )

    # For CLIENT_USER/CLIENT_CONTACT, verify site access
    if claims.role in [ClientUserRole.CLIENT_USER.value, ClientUserRole.CLIENT_CONTACT.value]:
        allowed_sites = db.query(ClientUserSite).filter(
            ClientUserSite.client_user_id == user.id
        ).all()
        allowed_site_ids = [s.site_id for s in allowed_sites]
        if site.id not in allowed_site_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this site"
            )

    return PortalSiteResponse(
        id=str(site.id),
        client_id=str(site.client_id),
        name=site.name,
        address=site.address
    )


# ========== Contact Schemas ==========

class PortalContactResponse(BaseModel):
    """Portal contact information."""
    id: str
    client_id: str
    name: str
    phone: Optional[str]
    email: Optional[str]
    position: Optional[str]
    notes: Optional[str]
    applies_to_all_sites: bool

    class Config:
        from_attributes = True


class PortalContactsListResponse(BaseModel):
    """List of contacts."""
    items: List[PortalContactResponse]
    total: int


# ========== Contact Endpoints ==========

@router.get("/clients/{client_id}/contacts", response_model=PortalContactsListResponse)
async def list_client_contacts(
    client_id: str,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get list of contacts for a specific client.

    **For CLIENT_ADMIN:** Returns all contacts of the client
    **For CLIENT_USER/CLIENT_CONTACT:** Returns contacts with applies_to_all_sites=True
        or contacts linked to their allowed sites

    **RBAC:** Portal users only
    """
    claims, user = claims_and_user

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, UUID(client_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this client"
        )

    # Build query
    query = db.query(Contact).filter(
        Contact.client_id == UUID(client_id)
    )

    # For CLIENT_USER/CLIENT_CONTACT, filter by site access
    if claims.role in [ClientUserRole.CLIENT_USER.value, ClientUserRole.CLIENT_CONTACT.value]:
        allowed_sites = db.query(ClientUserSite).filter(
            ClientUserSite.client_user_id == user.id
        ).all()
        allowed_site_ids = [s.site_id for s in allowed_sites]

        if not allowed_site_ids:
            # Only show contacts that apply to all sites
            query = query.filter(Contact.applies_to_all_sites == True)
        else:
            # Show contacts that apply to all sites OR are linked to allowed sites
            from sqlalchemy import or_
            from app.models.clients import contact_site_links

            query = query.filter(
                or_(
                    Contact.applies_to_all_sites == True,
                    Contact.id.in_(
                        db.query(contact_site_links.c.contact_id).filter(
                            contact_site_links.c.site_id.in_(allowed_site_ids)
                        )
                    )
                )
            )

    contacts = query.order_by(Contact.name).all()

    items = [
        PortalContactResponse(
            id=str(contact.id),
            client_id=str(contact.client_id),
            name=contact.name,
            phone=contact.phone,
            email=contact.email,
            position=contact.position,
            notes=contact.notes,
            applies_to_all_sites=contact.applies_to_all_sites
        )
        for contact in contacts
    ]

    return PortalContactsListResponse(items=items, total=len(items))


@router.get("/contacts/{contact_id}", response_model=PortalContactResponse)
async def get_portal_contact(
    contact_id: str,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific contact.

    **Access Control:** User must have access to this contact's client

    **RBAC:** Portal users only
    """
    claims, user = claims_and_user

    # Get contact
    contact = db.query(Contact).filter(
        Contact.id == UUID(contact_id)
    ).first()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, contact.client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this contact"
        )

    return PortalContactResponse(
        id=str(contact.id),
        client_id=str(contact.client_id),
        name=contact.name,
        phone=contact.phone,
        email=contact.email,
        position=contact.position,
        notes=contact.notes,
        applies_to_all_sites=contact.applies_to_all_sites
    )


# ========== Create Schemas ==========

class PortalSiteCreate(BaseModel):
    """Schema for creating a site (portal users)."""
    client_id: str
    name: str
    address: Optional[str] = None
    is_default: bool = False
    notes: Optional[str] = None


class PortalContactCreate(BaseModel):
    """Schema for creating a contact (portal users)."""
    client_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    notes: Optional[str] = None
    applies_to_all_sites: bool = True
    site_ids: Optional[List[str]] = None


# ========== Create Endpoints ==========

@router.post("/clients/{client_id}/sites")
async def create_portal_site(
    client_id: str,
    request: PortalSiteCreate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Create a new site for a client.

    **Access Control:** CLIENT_ADMIN only, must have access to this client

    **RBAC:** Portal CLIENT_ADMIN users only
    """
    claims, user = claims_and_user

    # Only CLIENT_ADMIN can create sites
    if claims.role != ClientUserRole.CLIENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only client admins can create sites"
        )

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, UUID(client_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this client"
        )

    # Ensure request.client_id matches path client_id
    if request.client_id != client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID in request body must match path parameter"
        )

    # Create site
    site = Site(
        client_id=UUID(request.client_id),
        name=request.name,
        address=request.address,
        is_default=request.is_default,
        notes=request.notes
    )

    db.add(site)
    db.commit()
    db.refresh(site)

    return {
        "id": str(site.id),
        "message": "Site created successfully"
    }


@router.post("/clients/{client_id}/contacts")
async def create_portal_contact(
    client_id: str,
    request: PortalContactCreate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Create a new contact for a client.

    **Access Control:** CLIENT_ADMIN only, must have access to this client

    **RBAC:** Portal CLIENT_ADMIN users only
    """
    claims, user = claims_and_user

    # Only CLIENT_ADMIN can create contacts
    if claims.role != ClientUserRole.CLIENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only client admins can create contacts"
        )

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, UUID(client_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this client"
        )

    # Ensure request.client_id matches path client_id
    if request.client_id != client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client ID in request body must match path parameter"
        )

    # Validate site_ids if provided
    if request.site_ids:
        site_uuids = [UUID(sid) for sid in request.site_ids]
        # Verify all sites belong to this client
        sites = db.query(Site).filter(
            Site.id.in_(site_uuids),
            Site.client_id == UUID(client_id)
        ).all()
        if len(sites) != len(site_uuids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more sites do not belong to this client"
            )

    # Create contact
    contact = Contact(
        client_id=UUID(request.client_id),
        name=request.name,
        phone=request.phone,
        email=request.email,
        position=request.position,
        notes=request.notes,
        applies_to_all_sites=request.applies_to_all_sites
    )

    db.add(contact)
    db.flush()  # Get contact ID before adding site links

    # Add site links if provided and applies_to_all_sites is False
    if request.site_ids and not request.applies_to_all_sites:
        from app.models.clients import contact_site_links
        for site_id in request.site_ids:
            db.execute(
                contact_site_links.insert().values(
                    contact_id=contact.id,
                    site_id=UUID(site_id)
                )
            )

    db.commit()
    db.refresh(contact)

    return {
        "id": str(contact.id),
        "message": "Contact created successfully"
    }


# ========== Update Schemas ==========

class PortalSiteUpdate(BaseModel):
    """Schema for updating a site (portal users)."""
    name: Optional[str] = None
    address: Optional[str] = None
    is_default: Optional[bool] = None
    notes: Optional[str] = None


class PortalContactUpdate(BaseModel):
    """Schema for updating a contact (portal users)."""
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    notes: Optional[str] = None
    applies_to_all_sites: Optional[bool] = None
    site_ids: Optional[List[str]] = None


# ========== Update Endpoints ==========

@router.patch("/sites/{site_id}")
async def update_portal_site(
    site_id: str,
    request: PortalSiteUpdate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing site.

    **Access Control:** CLIENT_ADMIN only, must have access to this site's client

    **RBAC:** Portal CLIENT_ADMIN users only
    """
    claims, user = claims_and_user

    # Only CLIENT_ADMIN can update sites
    if claims.role != ClientUserRole.CLIENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only client admins can update sites"
        )

    # Get site
    site = db.query(Site).filter(Site.id == UUID(site_id)).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, site.client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this site"
        )

    # Update fields
    if request.name is not None:
        site.name = request.name
    if request.address is not None:
        site.address = request.address
    if request.is_default is not None:
        site.is_default = request.is_default
    if request.notes is not None:
        site.notes = request.notes

    db.commit()
    db.refresh(site)

    return {
        "id": str(site.id),
        "message": "Site updated successfully"
    }


@router.patch("/contacts/{contact_id}")
async def update_portal_contact(
    contact_id: str,
    request: PortalContactUpdate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Update an existing contact.

    **Access Control:** CLIENT_ADMIN only, must have access to this contact's client

    **RBAC:** Portal CLIENT_ADMIN users only
    """
    claims, user = claims_and_user

    # Only CLIENT_ADMIN can update contacts
    if claims.role != ClientUserRole.CLIENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only client admins can update contacts"
        )

    # Get contact
    contact = db.query(Contact).filter(Contact.id == UUID(contact_id)).first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    # Verify user has access to this client
    if not check_client_user_client_access(db, claims, user.id, contact.client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this contact"
        )

    # Validate site_ids if provided
    if request.site_ids is not None:
        site_uuids = [UUID(sid) for sid in request.site_ids]
        # Verify all sites belong to this client
        sites = db.query(Site).filter(
            Site.id.in_(site_uuids),
            Site.client_id == contact.client_id
        ).all()
        if len(sites) != len(site_uuids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more sites do not belong to this client"
            )

    # Update fields
    if request.name is not None:
        contact.name = request.name
    if request.phone is not None:
        contact.phone = request.phone
    if request.email is not None:
        contact.email = request.email
    if request.position is not None:
        contact.position = request.position
    if request.notes is not None:
        contact.notes = request.notes
    if request.applies_to_all_sites is not None:
        contact.applies_to_all_sites = request.applies_to_all_sites

    # Update site links if provided
    if request.site_ids is not None:
        from app.models.clients import contact_site_links

        # Delete existing links
        db.execute(
            contact_site_links.delete().where(
                contact_site_links.c.contact_id == contact.id
            )
        )

        # Add new links if not applies_to_all_sites
        if not contact.applies_to_all_sites and request.site_ids:
            for site_id in request.site_ids:
                db.execute(
                    contact_site_links.insert().values(
                        contact_id=contact.id,
                        site_id=UUID(site_id)
                    )
                )

    db.commit()
    db.refresh(contact)

    return {
        "id": str(contact.id),
        "message": "Contact updated successfully"
    }
