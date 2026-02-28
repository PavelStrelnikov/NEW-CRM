"""
Admin endpoints for managing CLIENT_ADMIN multi-client assignments.
Only accessible by internal admin users.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.models.users import ClientUser, ClientUserClient, ClientUserRole, InternalUser
from app.models.clients import Client
from app.guards import InternalUserClaims, get_internal_user
from app.rbac import is_admin

router = APIRouter()


# ========== Schemas ==========

class PortalUserResponse(BaseModel):
    """Portal user response."""
    id: str
    email: str
    name: str
    role: str
    client_id: str
    is_active: bool
    created_at: str
    updated_at: str


class PortalUserListResponse(BaseModel):
    """List of portal users."""
    items: list[PortalUserResponse]
    total: int


class PortalUserCreate(BaseModel):
    """Create portal user request."""
    email: str
    name: str
    password: str
    role: str  # CLIENT_ADMIN, CLIENT_USER, CLIENT_CONTACT
    client_id: str
    is_active: bool = True


class PortalUserUpdate(BaseModel):
    """Update portal user request."""
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class ClientAssignmentResponse(BaseModel):
    """Current client assignments for a CLIENT_ADMIN user."""
    user_id: str
    email: str
    role: str
    primary_client_id: str
    primary_client_name: str
    assigned_client_ids: list[str]
    assigned_clients: list[dict]  # [{"id": "...", "name": "..."}]


class UpdateClientAssignmentsRequest(BaseModel):
    """Update client assignments for a CLIENT_ADMIN user."""
    client_ids: list[str]  # List of client UUIDs to assign


# ========== Helper Functions ==========

def require_admin(claims_and_user: tuple[InternalUserClaims, InternalUser]) -> tuple[InternalUserClaims, InternalUser]:
    """Dependency that requires admin role."""
    claims, user = claims_and_user
    if not is_admin(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return claims, user


# ========== Endpoints ==========

@router.get("/client-users", response_model=PortalUserListResponse)
async def list_portal_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    client_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    List all portal users (CLIENT_ADMIN, CLIENT_USER, CLIENT_CONTACT).

    **RBAC:** Admin only
    """
    # Require admin
    require_admin(claims_and_user)

    query = db.query(ClientUser)

    # Filter by search query
    if q:
        query = query.filter(
            (ClientUser.email.ilike(f"%{q}%")) |
            (ClientUser.name.ilike(f"%{q}%"))
        )

    # Filter by role
    if role:
        query = query.filter(ClientUser.role == role)

    # Filter by client
    if client_id:
        try:
            query = query.filter(ClientUser.client_id == UUID(client_id))
        except ValueError:
            pass

    total = query.count()

    # Pagination
    offset = (page - 1) * page_size
    users = query.order_by(ClientUser.created_at.desc()).offset(offset).limit(page_size).all()

    return PortalUserListResponse(
        items=[
            PortalUserResponse(
                id=str(user.id),
                email=user.email,
                name=user.name,
                role=user.role,
                client_id=str(user.client_id),
                is_active=user.is_active,
                created_at=user.created_at.isoformat(),
                updated_at=user.updated_at.isoformat()
            )
            for user in users
        ],
        total=total
    )


@router.get("/client-users/{user_id}", response_model=PortalUserResponse)
async def get_portal_user(
    user_id: UUID,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Get portal user by ID.

    **RBAC:** Admin only
    """
    # Require admin
    require_admin(claims_and_user)

    user = db.query(ClientUser).filter(ClientUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portal user not found"
        )

    return PortalUserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        client_id=str(user.client_id),
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat()
    )


@router.post("/client-users", response_model=PortalUserResponse)
async def create_portal_user(
    request: PortalUserCreate,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Create a new portal user.

    **RBAC:** Admin only
    """
    # Require admin
    claims, admin_user = require_admin(claims_and_user)

    # Check if email already exists
    existing = db.query(ClientUser).filter(ClientUser.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Validate client exists
    client = db.query(Client).filter(Client.id == UUID(request.client_id)).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Validate role
    valid_roles = [ClientUserRole.CLIENT_ADMIN.value, ClientUserRole.CLIENT_USER.value, ClientUserRole.CLIENT_CONTACT.value]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )

    # Hash password
    from app.services.auth_service import AuthService
    password_hash = AuthService.hash_password(request.password)

    # Create user
    new_user = ClientUser(
        email=request.email,
        name=request.name,
        password_hash=password_hash,
        role=request.role,
        client_id=UUID(request.client_id),
        is_active=request.is_active
    )

    db.add(new_user)
    db.flush()  # Get the ID

    # Auto-create client assignment for CLIENT_ADMIN
    if request.role == ClientUserRole.CLIENT_ADMIN.value:
        assignment = ClientUserClient(
            client_user_id=new_user.id,
            client_id=UUID(request.client_id),
            created_by_actor_type="internal_user",
            created_by_actor_id=admin_user.id,
            created_by_actor_display=admin_user.name
        )
        db.add(assignment)

    try:
        db.commit()
        db.refresh(new_user)

        return PortalUserResponse(
            id=str(new_user.id),
            email=new_user.email,
            name=new_user.name,
            role=new_user.role,
            client_id=str(new_user.client_id),
            is_active=new_user.is_active,
            created_at=new_user.created_at.isoformat(),
            updated_at=new_user.updated_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create portal user: {str(e)}"
        )


@router.patch("/client-users/{user_id}", response_model=PortalUserResponse)
async def update_portal_user(
    user_id: UUID,
    request: PortalUserUpdate,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Update portal user.

    **RBAC:** Admin only
    """
    # Require admin
    require_admin(claims_and_user)

    user = db.query(ClientUser).filter(ClientUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portal user not found"
        )

    # Update fields
    if request.name is not None:
        user.name = request.name
    if request.email is not None:
        # Check if new email is already taken
        existing = db.query(ClientUser).filter(
            ClientUser.email == request.email,
            ClientUser.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        user.email = request.email
    if request.role is not None:
        valid_roles = [ClientUserRole.CLIENT_ADMIN.value, ClientUserRole.CLIENT_USER.value, ClientUserRole.CLIENT_CONTACT.value]
        if request.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        user.role = request.role
    if request.is_active is not None:
        user.is_active = request.is_active

    try:
        db.commit()
        db.refresh(user)

        return PortalUserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role,
            client_id=str(user.client_id),
            is_active=user.is_active,
            created_at=user.created_at.isoformat(),
            updated_at=user.updated_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update portal user: {str(e)}"
        )


@router.delete("/client-users/{user_id}")
async def delete_portal_user(
    user_id: UUID,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Delete portal user.

    **RBAC:** Admin only
    """
    # Require admin
    require_admin(claims_and_user)

    user = db.query(ClientUser).filter(ClientUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portal user not found"
        )

    try:
        db.delete(user)
        db.commit()
        return {"status": "success", "message": f"Portal user {user.email} deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete portal user: {str(e)}"
        )


@router.get("/client-users/{user_id}/clients", response_model=ClientAssignmentResponse)
async def get_client_user_assignments(
    user_id: UUID,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Get current client assignments for a CLIENT_ADMIN user.

    **RBAC:** Admin only
    """
    # Require admin
    require_admin(claims_and_user)

    # Get the client user
    client_user = db.query(ClientUser).filter(ClientUser.id == user_id).first()
    if not client_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found"
        )

    # Verify user is CLIENT_ADMIN
    if client_user.role != ClientUserRole.CLIENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a CLIENT_ADMIN"
        )

    # Get primary client info
    primary_client = db.query(Client).filter(Client.id == client_user.client_id).first()
    if not primary_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Primary client not found"
        )

    # Get assigned clients
    assigned = db.query(ClientUserClient).filter(
        ClientUserClient.client_user_id == user_id
    ).all()

    assigned_client_ids = [str(a.client_id) for a in assigned]

    # Get client details
    assigned_clients = []
    for assignment in assigned:
        client = db.query(Client).filter(Client.id == assignment.client_id).first()
        if client:
            assigned_clients.append({
                "id": str(client.id),
                "name": client.name
            })

    return ClientAssignmentResponse(
        user_id=str(client_user.id),
        email=client_user.email,
        role=client_user.role,
        primary_client_id=str(client_user.client_id),
        primary_client_name=primary_client.name,
        assigned_client_ids=assigned_client_ids,
        assigned_clients=assigned_clients
    )


@router.put("/client-users/{user_id}/clients", response_model=dict)
async def update_client_user_assignments(
    user_id: UUID,
    request: UpdateClientAssignmentsRequest,
    claims_and_user: tuple[InternalUserClaims, InternalUser] = Depends(get_internal_user),
    db: Session = Depends(get_db)
):
    """
    Update client assignments for a CLIENT_ADMIN user.

    Replaces all current assignments with the provided list.

    **RBAC:** Admin only
    """
    # Require admin
    claims, user = require_admin(claims_and_user)

    # Get the client user
    client_user = db.query(ClientUser).filter(ClientUser.id == user_id).first()
    if not client_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found"
        )

    # Verify user is CLIENT_ADMIN
    if client_user.role != ClientUserRole.CLIENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a CLIENT_ADMIN"
        )

    # Validation: Primary client must be in the list
    primary_client_id = str(client_user.client_id)
    if primary_client_id not in request.client_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primary client must be included in assignments"
        )

    # Validation: All client IDs must exist
    for client_id_str in request.client_ids:
        try:
            client_uuid = UUID(client_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid client ID: {client_id_str}"
            )

        client = db.query(Client).filter(Client.id == client_uuid).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client not found: {client_id_str}"
            )

    # Delete existing assignments
    db.query(ClientUserClient).filter(
        ClientUserClient.client_user_id == user_id
    ).delete()

    # Create new assignments
    for client_id_str in request.client_ids:
        assignment = ClientUserClient(
            client_user_id=user_id,
            client_id=UUID(client_id_str),
            created_by_actor_type="internal_user",
            created_by_actor_id=user.id,
            created_by_actor_display=user.name
        )
        db.add(assignment)

    try:
        db.commit()
        return {
            "status": "success",
            "message": f"Updated client assignments for {client_user.email}",
            "assigned_client_count": len(request.client_ids)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update assignments: {str(e)}"
        )
