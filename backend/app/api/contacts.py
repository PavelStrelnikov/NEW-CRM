"""
Contacts API endpoints.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.clients import Client, Contact, Site, contact_site_links
from app.schemas.clients import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ContactWithSites,
    ContactSiteLink
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import (
    get_current_active_user,
    require_admin
)

router = APIRouter()


@router.get("/clients/{client_id}/contacts", response_model=list[ContactWithSites])
async def list_contacts_for_client(
    client_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all contacts for a specific client.

    **RBAC:**
    - Internal users: Can see contacts for any client
    - Client users: Can only see contacts for their own client
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

    # Get contacts for this client
    contacts = db.query(Contact).filter(Contact.client_id == client_id).all()

    # Enrich with site_ids
    result = []
    for contact in contacts:
        site_ids = [site.id for site in contact.sites]
        result.append(ContactWithSites(
            **contact.__dict__,
            site_ids=site_ids
        ))

    return result


@router.post("/clients/{client_id}/contacts", response_model=ContactWithSites, status_code=status.HTTP_201_CREATED)
async def create_contact(
    client_id: UUID,
    contact_data: ContactCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new contact for a client.

    **RBAC:** Admin only

    If applies_to_all_sites=False, must provide site_ids array.
    """
    # Verify client exists
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Ensure contact_data.client_id matches URL client_id
    if str(contact_data.client_id) != str(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id in URL does not match client_id in body"
        )

    # Validate: if applies_to_all_sites is False, must have site_ids
    if not contact_data.applies_to_all_sites:
        if not contact_data.site_ids or len(contact_data.site_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="When applies_to_all_sites is False, must provide at least one site_id"
            )

    # Verify all site_ids belong to this client
    site_ids = contact_data.site_ids or []
    if site_ids:
        sites = db.query(Site).filter(
            Site.id.in_(site_ids),
            Site.client_id == client_id
        ).all()

        if len(sites) != len(site_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more site_ids do not belong to this client"
            )

    # Create contact (exclude site_ids from model_dump)
    contact_dict = contact_data.model_dump(exclude={"site_ids"})
    contact = Contact(**contact_dict)
    db.add(contact)
    db.flush()

    # Link to sites (only if not applies_to_all_sites)
    if not contact.applies_to_all_sites and site_ids:
        for site_id in site_ids:
            db.execute(
                contact_site_links.insert().values(
                    contact_id=contact.id,
                    site_id=site_id
                )
            )

    db.commit()
    db.refresh(contact)

    return ContactWithSites(
        **contact.__dict__,
        site_ids=site_ids
    )


@router.get("/contacts/{contact_id}", response_model=ContactWithSites)
async def get_contact(
    contact_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific contact by ID.

    **RBAC:**
    - Internal users: Can access any contact
    - Client users: Can only access contacts belonging to their client
    """
    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(contact.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    site_ids = [site.id for site in contact.sites]

    return ContactWithSites(
        **contact.__dict__,
        site_ids=site_ids
    )


@router.patch("/contacts/{contact_id}", response_model=ContactWithSites)
async def update_contact(
    contact_id: UUID,
    contact_data: ContactUpdate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update a contact.

    **RBAC:** Admin only
    """
    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    # Get update data
    update_data = contact_data.model_dump(exclude_unset=True)
    site_ids = update_data.pop("site_ids", None)

    # Validate: if applies_to_all_sites is being set to False, must have site_ids
    if "applies_to_all_sites" in update_data:
        if not update_data["applies_to_all_sites"]:
            if site_ids is None or len(site_ids) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="When applies_to_all_sites is False, must provide at least one site_id"
                )
    # Also check if applies_to_all_sites is already False and not being changed
    elif not contact.applies_to_all_sites and site_ids is not None and len(site_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contact requires at least one site when applies_to_all_sites is False"
        )

    # Verify site_ids belong to contact's client (if provided)
    if site_ids:
        sites = db.query(Site).filter(
            Site.id.in_(site_ids),
            Site.client_id == contact.client_id
        ).all()

        if len(sites) != len(site_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more site_ids do not belong to this contact's client"
            )

    # Update contact fields
    for field, value in update_data.items():
        setattr(contact, field, value)

    # Update site links if site_ids provided or applies_to_all_sites changed
    if site_ids is not None or "applies_to_all_sites" in update_data:
        # Remove existing links
        db.execute(
            contact_site_links.delete().where(
                contact_site_links.c.contact_id == contact_id
            )
        )

        # Add new links only if applies_to_all_sites is False
        if not contact.applies_to_all_sites and site_ids:
            for site_id in site_ids:
                db.execute(
                    contact_site_links.insert().values(
                        contact_id=contact_id,
                        site_id=site_id
                    )
                )

    db.commit()
    db.refresh(contact)

    result_site_ids = [site.id for site in contact.sites]

    return ContactWithSites(
        **contact.__dict__,
        site_ids=result_site_ids
    )


@router.post("/contacts/{contact_id}/sites", response_model=ContactWithSites)
async def link_contact_to_sites(
    contact_id: UUID,
    link_data: ContactSiteLink,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Link a contact to specific sites (replaces existing links).

    **RBAC:** Admin only
    """
    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    # Verify all site_ids belong to the same client as the contact
    if link_data.site_ids:
        sites = db.query(Site).filter(
            Site.id.in_(link_data.site_ids),
            Site.client_id == contact.client_id
        ).all()

        if len(sites) != len(link_data.site_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more site_ids do not belong to this contact's client"
            )

    # Remove existing links
    db.execute(
        contact_site_links.delete().where(
            contact_site_links.c.contact_id == contact_id
        )
    )

    # Add new links
    for site_id in link_data.site_ids:
        db.execute(
            contact_site_links.insert().values(
                contact_id=contact_id,
                site_id=site_id
            )
        )

    db.commit()
    db.refresh(contact)

    site_ids = [site.id for site in contact.sites]

    return ContactWithSites(
        **contact.__dict__,
        site_ids=site_ids
    )
