"""
FastAPI dependency guards for RBAC and authentication.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from jose import jwt, JWTError
from datetime import datetime
from uuid import UUID

from app.config import settings
from app.db.session import get_db
from app.models.users import InternalUser, ClientUser

# HTTP Bearer token security scheme
security = HTTPBearer()


class InternalUserClaims:
    """JWT claims for internal users."""
    def __init__(self, user_id: str, email: str, role: str, name: str):
        self.user_id = user_id
        self.email = email
        self.role = role
        self.name = name


class ClientUserClaims:
    """JWT claims for client portal users."""
    def __init__(
        self,
        user_id: str,
        email: str,
        role: str,
        client_id: str,
        primary_client_id: Optional[str] = None,
        allowed_client_ids: Optional[list[str]] = None,
        allowed_site_ids: Optional[list[str]] = None,
        can_view_secrets: bool = False
    ):
        self.user_id = user_id
        self.email = email
        self.role = role
        self.client_id = client_id  # Currently active client
        self.primary_client_id = primary_client_id or client_id  # Backward compat
        self.allowed_client_ids = allowed_client_ids or []
        self.allowed_site_ids = allowed_site_ids or []
        self.can_view_secrets = can_view_secrets  # Allow viewing device passwords

    def can_access_client(self, client_id: UUID) -> bool:
        """Check if user can access a specific client."""
        client_id_str = str(client_id)
        # Single-client users can only access their client_id
        if not self.allowed_client_ids:
            return client_id_str == self.client_id
        # Multi-client admins can access any assigned client
        return client_id_str in self.allowed_client_ids


def decode_internal_token(token: str) -> InternalUserClaims:
    """Decode and validate internal user JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")
        name = payload.get("name")
        user_type = payload.get("user_type")

        if not user_id or not email or not role or user_type != "internal":
            raise ValueError("Invalid token structure")

        return InternalUserClaims(user_id=user_id, email=email, role=role, name=name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


def decode_portal_token(token: str) -> ClientUserClaims:
    """Decode and validate client portal user JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")
        client_id = payload.get("client_id")
        primary_client_id = payload.get("primary_client_id")  # NEW: may be None for old tokens
        allowed_client_ids = payload.get("allowed_client_ids", [])  # NEW
        allowed_site_ids = payload.get("allowed_site_ids", [])
        can_view_secrets = payload.get("can_view_secrets", False)  # NEW: for device password access
        user_type = payload.get("user_type")

        # Validate required fields
        if not user_id or not email or not role or not client_id or user_type != "portal":
            raise ValueError("Invalid token structure")

        return ClientUserClaims(
            user_id=user_id,
            email=email,
            role=role,
            client_id=client_id,
            primary_client_id=primary_client_id,  # Backward compat: None OK
            allowed_client_ids=allowed_client_ids,
            allowed_site_ids=allowed_site_ids,
            can_view_secrets=can_view_secrets
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_internal_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> tuple[InternalUserClaims, InternalUser]:
    """Get current internal user from token and database."""
    token = credentials.credentials

    claims = decode_internal_token(token)

    # Verify user exists and is active
    try:
        user_uuid = UUID(claims.user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(InternalUser).filter(
        InternalUser.id == user_uuid,
        InternalUser.is_active == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return claims, user


async def get_client_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> tuple[ClientUserClaims, ClientUser]:
    """Get current client portal user from token and database."""
    token = credentials.credentials

    claims = decode_portal_token(token)

    # Verify user exists and is active
    try:
        user_uuid = UUID(claims.user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(ClientUser).filter(
        ClientUser.id == user_uuid,
        ClientUser.is_active == True
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return claims, user
