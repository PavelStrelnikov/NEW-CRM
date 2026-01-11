"""
Authentication API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.auth.service import auth_service
from app.auth.dependencies import get_current_active_user
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    CurrentUser
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return access token.

    **Supports both internal users and client users.**

    Returns:
        - **access_token**: JWT token for subsequent requests
        - **token_type**: Always "bearer"

    Raises:
        - **401**: Invalid credentials or inactive user
    """
    result = auth_service.authenticate_user(db, login_data.email, login_data.password)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user, user_type = result

    # Create access token
    access_token = auth_service.create_access_token_for_user(user, user_type)

    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=CurrentUser)
async def get_me(
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Get current authenticated user information.

    Returns:
        Current user details including:
        - id, name, email
        - role (admin, technician, office, client_contact, client_admin)
        - user_type (internal or client)
        - client_id (for client users only)
        - preferred_locale

    Requires:
        - Valid JWT token in Authorization header
    """
    return current_user


@router.post("/logout")
async def logout(
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Logout endpoint (stateless - client should discard token).

    Since JWT tokens are stateless, logout is handled client-side
    by discarding the token. This endpoint is provided for
    consistency and potential future server-side token revocation.

    Returns:
        Success message
    """
    return {"message": "Successfully logged out"}
