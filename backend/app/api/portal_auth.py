"""
Portal authentication API endpoints for client users.
Separate auth flow from internal users.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.db.session import get_db
from app.models.users import ClientUser, ClientUserRole, ClientUserSite, ClientUserClient
from app.models.clients import Client
from app.services.auth_service import AuthService
from app.guards import ClientUserClaims, decode_portal_token, get_client_user

router = APIRouter()
security = HTTPBearer()


# ========== Schemas ==========

class PortalLoginRequest(BaseModel):
    """Portal user login request."""
    email: str
    password: str


class PortalTokenResponse(BaseModel):
    """Portal login response with token."""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str


class PortalCurrentUserResponse(BaseModel):
    """Current portal user information."""
    id: str
    email: str
    name: str
    role: str
    user_type: str  # Always "portal" for portal users (matches JWT token)
    client_id: str  # Currently active client
    primary_client_id: str  # User's home client
    allowed_client_ids: Optional[list[str]]  # All assigned clients (for CLIENT_ADMIN)
    allowed_site_ids: Optional[list[str]]  # Site restrictions (for CLIENT_USER)


class SwitchClientRequest(BaseModel):
    """Request to switch active client."""
    client_id: str


class SwitchClientResponse(BaseModel):
    """Response with new token for switched client."""
    access_token: str
    token_type: str = "bearer"
    client_id: str
    client_name: str


# ========== Endpoints ==========

@router.post("/login", response_model=PortalTokenResponse)
async def portal_login(
    request: PortalLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate a client portal user.

    Returns a JWT token for portal access.
    """
    # Find user by email
    user = db.query(ClientUser).filter(
        ClientUser.email == request.email,
        ClientUser.is_active == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Verify password
    if not AuthService.verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Get allowed sites for CLIENT_USER/CLIENT_CONTACT
    allowed_site_ids = None
    if user.role in [ClientUserRole.CLIENT_USER.value, ClientUserRole.CLIENT_CONTACT.value]:
        allowed_sites = db.query(ClientUserSite).filter(
            ClientUserSite.client_user_id == user.id
        ).all()
        allowed_site_ids = [str(site.site_id) for site in allowed_sites]

    # Get allowed clients for CLIENT_ADMIN (multi-client support)
    allowed_client_ids = None
    if user.role == ClientUserRole.CLIENT_ADMIN.value:
        allowed_clients = db.query(ClientUserClient).filter(
            ClientUserClient.client_user_id == user.id
        ).all()
        allowed_client_ids = [str(c.client_id) for c in allowed_clients]

    # Create token with primary client as active by default
    token = AuthService.create_portal_user_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        client_id=user.client_id,  # Primary client is initially active
        primary_client_id=user.client_id,
        allowed_client_ids=allowed_client_ids,
        allowed_site_ids=allowed_site_ids,
        can_view_secrets=user.can_view_secrets
    )

    return PortalTokenResponse(
        access_token=token,
        user_id=str(user.id),
        role=user.role
    )


@router.get("/me", response_model=PortalCurrentUserResponse)
async def get_current_portal_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated portal user information.
    """
    token = credentials.credentials

    claims = decode_portal_token(token)

    # Get user from database
    user = db.query(ClientUser).filter(
        ClientUser.id == UUID(claims.user_id),
        ClientUser.is_active == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    return PortalCurrentUserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        user_type="portal",  # Must match JWT token user_type for frontend detection
        client_id=claims.client_id,  # Currently active client
        primary_client_id=claims.primary_client_id,
        allowed_client_ids=claims.allowed_client_ids if claims.allowed_client_ids else None,
        allowed_site_ids=claims.allowed_site_ids if claims.allowed_site_ids else None
    )


@router.post("/switch-client", response_model=SwitchClientResponse)
async def switch_client(
    request: SwitchClientRequest,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Switch active client for CLIENT_ADMIN users with multi-client access.

    Returns a new JWT token with the selected client as active.

    **RBAC:** Only CLIENT_ADMIN users with multi-client access
    """
    claims, user = claims_and_user

    # Verify user is CLIENT_ADMIN
    if user.role != ClientUserRole.CLIENT_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only CLIENT_ADMIN users can switch clients"
        )

    # Verify requested client is in user's allowed clients
    if not claims.can_access_client(UUID(request.client_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to requested client"
        )

    # Get client info
    client = db.query(Client).filter(Client.id == UUID(request.client_id)).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Create new token with selected client as active
    token = AuthService.create_portal_user_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
        client_id=UUID(request.client_id),  # NEW active client
        primary_client_id=user.client_id,
        allowed_client_ids=claims.allowed_client_ids,
        allowed_site_ids=None,  # CLIENT_ADMIN has no site restrictions
        can_view_secrets=user.can_view_secrets
    )

    return SwitchClientResponse(
        access_token=token,
        client_id=str(client.id),
        client_name=client.name
    )
