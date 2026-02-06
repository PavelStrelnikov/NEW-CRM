"""
Clients API endpoints.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.clients import Client, Site
from app.schemas.clients import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListResponse
)
from app.schemas.auth import CurrentUser
from app.schemas.deletion import ClientDeletionSummary, DeletionResponse
from app.auth.dependencies import (
    get_current_active_user,
    require_admin
)
from app.utils.audit import create_audit_event
from app.services.deletion_service import deletion_service
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter()


@router.get("", response_model=ClientListResponse)
async def list_clients(
    q: Optional[str] = Query(None, description="Search by name, phone, or tax ID"),
    include_inactive: bool = Query(False, description="Include inactive clients"),
    sort: Optional[str] = Query("name", description="Sort field: name, main_phone, tax_id"),
    order: Optional[str] = Query("asc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=1000, description="Items per page (max 1000)"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List clients with pagination, search, and sorting.

    **RBAC:**
    - Internal users: Can see all clients
    - Client users: Can only see their own client

    **Filters:**
    - By default, only active clients are returned
    - Set include_inactive=true to include inactive clients

    **Search:**
    - q parameter searches across name, main_phone, and tax_id fields

    **Sorting:**
    - Allowed fields: name, main_phone, tax_id
    - Default: name asc
    """
    query = db.query(Client)

    # Apply RBAC filters
    if current_user.user_type == "client":
        query = query.filter(Client.id == current_user.client_id)

    # Apply active/inactive filter
    if not include_inactive:
        query = query.filter(Client.status == "active")

    # Apply multi-field search filter
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (Client.name.ilike(search_term)) |
            (Client.main_phone.ilike(search_term)) |
            (Client.tax_id.ilike(search_term))
        )

    # Apply sorting
    sort_whitelist = {"name": Client.name, "main_phone": Client.main_phone, "tax_id": Client.tax_id}
    if sort not in sort_whitelist:
        sort = "name"

    sort_column = sort_whitelist[sort]
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Get total count
    total = query.count()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    # Apply pagination
    offset = (page - 1) * page_size
    clients = query.offset(offset).limit(page_size).all()

    return ClientListResponse(
        items=clients,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new client.

    **RBAC:** Admin only

    Automatically creates a default site for the client.
    """
    # Create client - convert is_active to status
    client_dict = client_data.model_dump()
    is_active = client_dict.pop('is_active', True)
    client_dict['status'] = 'active' if is_active else 'inactive'

    client = Client(**client_dict)
    db.add(client)
    db.flush()

    # Auto-create default site
    default_site = Site(
        client_id=client.id,
        name="Default Site",
        address=client.main_address,
        is_default=True
    )
    db.add(default_site)

    # Create audit event
    create_audit_event(
        db=db,
        entity_type="client",
        entity_id=client.id,
        action="create",
        old_values=None,
        new_values=client_data.model_dump(),
        actor_type="internal_user" if current_user.user_type == "internal" else "client_user",
        actor_id=current_user.id,
        actor_display=current_user.name
    )

    db.commit()
    db.refresh(client)

    return client


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific client by ID.

    **RBAC:**
    - Internal users: Can access any client
    - Client users: Can only access their own client
    """
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

    return client


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update a client.

    **RBAC:** Admin only
    """
    client = db.query(Client).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Capture old values for audit - convert is_active to status
    update_data = client_data.model_dump(exclude_unset=True)

    # Convert is_active to status if present
    if 'is_active' in update_data:
        is_active = update_data.pop('is_active')
        update_data['status'] = 'active' if is_active else 'inactive'

    old_values = {field: getattr(client, field, None) for field in update_data.keys()}

    # Update only provided fields
    for field, value in update_data.items():
        setattr(client, field, value)

    # Create audit event
    create_audit_event(
        db=db,
        entity_type="client",
        entity_id=client.id,
        action="update",
        old_values=old_values,
        new_values=update_data,
        actor_type="internal_user" if current_user.user_type == "internal" else "client_user",
        actor_id=current_user.id,
        actor_display=current_user.name
    )

    db.commit()
    db.refresh(client)

    return client


@router.get("/{client_id}/deletion-summary", response_model=ClientDeletionSummary)
async def get_client_deletion_summary(
    client_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get pre-deletion summary for a client.

    **RBAC:** Admin only

    Returns detailed counts of all records that will be affected by deleting this client:
    - Sites, contacts, client users (will be CASCADE deleted)
    - Tickets, assets, projects (block deletion unless force=true)

    Use this endpoint before DELETE to show the user what will be affected.
    """
    summary = deletion_service.get_client_deletion_summary(db, client_id)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return summary


@router.delete("/{client_id}", response_model=DeletionResponse)
async def delete_client(
    client_id: UUID,
    force: bool = Query(False, description="Force delete all related records (tickets, assets, projects)"),
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a client and all associated data.

    **RBAC:** Admin only

    **Behavior:**
    - By default (force=false): Returns 409 Conflict if client has tickets, assets, or projects
    - With force=true: Cascade deletes ALL related data including tickets, assets, projects

    **CASCADE deleted (always):**
    - Sites and their locations
    - Contacts and contact-site links
    - Client users

    **RESTRICT (require force=true):**
    - Tickets (and their work logs, events, line items)
    - Assets (and their property values, disks, channels)
    - Projects

    **Warning:** This operation is irreversible. Use the deletion-summary endpoint first
    to understand what will be deleted.
    """
    try:
        result = await deletion_service.delete_client(
            db=db,
            client_id=client_id,
            force=force,
            actor_type="internal_user" if current_user.user_type == "internal" else "client_user",
            actor_id=current_user.id,
            actor_display=current_user.name
        )
        logger.info(f"Client {client_id} deleted by {current_user.name}")
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
