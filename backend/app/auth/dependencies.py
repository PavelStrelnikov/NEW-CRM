"""
FastAPI dependencies for authentication and authorization.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.auth.service import auth_service
from app.schemas.auth import CurrentUser


# HTTP Bearer token security scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> CurrentUser:
    """
    Dependency to get the current authenticated user.

    Raises:
        HTTPException: If authentication fails
    """
    token = credentials.credentials

    current_user = auth_service.get_current_user(db, token)

    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return current_user


async def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    """
    Dependency to ensure the current user is active.

    Raises:
        HTTPException: If user is not active
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


# Role-based access control dependencies

async def require_internal_user(
    current_user: CurrentUser = Depends(get_current_active_user)
) -> CurrentUser:
    """
    Require that the current user is an internal user (admin, technician, or office).

    Raises:
        HTTPException: If user is not an internal user
    """
    if current_user.user_type != "internal":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Internal users only"
        )
    return current_user


async def require_admin(
    current_user: CurrentUser = Depends(require_internal_user)
) -> CurrentUser:
    """
    Require that the current user has admin role.

    Raises:
        HTTPException: If user is not an admin
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Admin only"
        )
    return current_user


async def require_admin_or_technician(
    current_user: CurrentUser = Depends(require_internal_user)
) -> CurrentUser:
    """
    Require that the current user is admin or technician.

    Raises:
        HTTPException: If user is not admin or technician
    """
    if current_user.role not in ["admin", "technician"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Admin or technician only"
        )
    return current_user


async def require_client_admin(
    current_user: CurrentUser = Depends(get_current_active_user)
) -> CurrentUser:
    """
    Require that the current user is a client admin.

    Raises:
        HTTPException: If user is not a client admin
    """
    if current_user.user_type != "client" or current_user.role != "CLIENT_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Client admin only"
        )
    return current_user


def check_client_access(
    current_user: CurrentUser,
    client_id: str
) -> bool:
    """
    Check if the current user has access to a specific client.

    Args:
        current_user: Current authenticated user
        client_id: Client ID to check access for

    Returns:
        True if user has access, False otherwise
    """
    # Internal users have access to all clients
    if current_user.user_type == "internal":
        return True

    # Client users only have access to their own client
    if current_user.user_type == "client":
        return str(current_user.client_id) == client_id

    return False


def require_client_access(
    client_id: str,
    current_user: CurrentUser = Depends(get_current_active_user)
) -> CurrentUser:
    """
    Dependency to ensure current user has access to a specific client.

    Args:
        client_id: Client ID to check access for

    Raises:
        HTTPException: If user doesn't have access to the client
    """
    if not check_client_access(current_user, client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: No access to this client"
        )
    return current_user
