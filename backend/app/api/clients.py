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
from app.auth.dependencies import (
    get_current_active_user,
    require_admin
)
from app.utils.audit import create_audit_event

router = APIRouter()


@router.get("", response_model=ClientListResponse)
async def list_clients(
    q: Optional[str] = Query(None, description="Search by name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List clients with pagination and search.

    **RBAC:**
    - Internal users: Can see all clients
    - Client users: Can only see their own client
    """
    query = db.query(Client)

    # Apply RBAC filters
    if current_user.user_type == "client":
        query = query.filter(Client.id == current_user.client_id)

    # Apply search filter
    if q:
        query = query.filter(Client.name.ilike(f"%{q}%"))

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    clients = query.offset(offset).limit(page_size).all()

    return ClientListResponse(
        items=clients,
        total=total,
        page=page,
        page_size=page_size
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
    # Create client
    client = Client(**client_data.model_dump())
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

    # Capture old values for audit
    update_data = client_data.model_dump(exclude_unset=True)
    old_values = {field: getattr(client, field) for field in update_data.keys()}

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
