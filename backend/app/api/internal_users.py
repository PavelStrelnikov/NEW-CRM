"""
Internal users management API endpoints (admin only).
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.session import get_db
from app.models.users import InternalUser, InternalUserRole
from app.schemas.internal_users import (
    InternalUserCreate,
    InternalUserUpdate,
    InternalUserResponse,
    InternalUserListResponse
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user
from app.services.auth_service import AuthService

router = APIRouter()


def require_admin(current_user: CurrentUser):
    """Ensure user is admin."""
    if current_user.user_type != "internal" or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def normalize_locale(locale: Optional[str]) -> str:
    """Normalize locale to database format (he-IL or en-US)."""
    if not locale:
        return "he-IL"

    locale_map = {
        "he": "he-IL",
        "he-IL": "he-IL",
        "en": "en-US",
        "en-US": "en-US"
    }

    return locale_map.get(locale, "he-IL")


def format_locale_for_frontend(locale: Optional[str]) -> str:
    """Format locale for frontend (short form: he or en)."""
    if not locale:
        return "he"

    if locale.startswith("he"):
        return "he"
    if locale.startswith("en"):
        return "en"

    return "he"


# ========== Endpoints ==========

@router.get("/admin/users", response_model=InternalUserListResponse)
def list_internal_users(
    q: Optional[str] = Query(None, description="Search in name or email"),
    role: Optional[str] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List internal users with filtering and pagination (admin only).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    # Build query
    query = db.query(InternalUser)

    # Apply search filter
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            or_(
                InternalUser.name.ilike(search_pattern),
                InternalUser.email.ilike(search_pattern)
            )
        )

    # Apply role filter
    if role:
        try:
            role_enum = InternalUserRole(role)
            query = query.filter(InternalUser.role == role_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

    # Apply active status filter
    if is_active is not None:
        query = query.filter(InternalUser.is_active == is_active)

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    users = query.order_by(InternalUser.name).offset(offset).limit(page_size).all()

    # Format response with frontend-friendly locale format
    items = []
    for user in users:
        user_dict = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role.value,
            "is_active": user.is_active,
            "preferred_locale": format_locale_for_frontend(user.preferred_locale.value if user.preferred_locale else None),
            "created_at": user.created_at,
            "updated_at": user.updated_at
        }
        items.append(InternalUserResponse(**user_dict))

    return InternalUserListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/admin/users/{user_id}", response_model=InternalUserResponse)
def get_internal_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get an internal user by ID (admin only).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    user = db.query(InternalUser).filter(InternalUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Format response with frontend-friendly locale
    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role.value,
        "is_active": user.is_active,
        "preferred_locale": format_locale_for_frontend(user.preferred_locale.value if user.preferred_locale else None),
        "created_at": user.created_at,
        "updated_at": user.updated_at
    }

    return InternalUserResponse(**user_dict)


@router.post("/admin/users", response_model=InternalUserResponse, status_code=201)
def create_internal_user(
    user_data: InternalUserCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new internal user (admin only).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    # Check if email already exists
    existing = db.query(InternalUser).filter(InternalUser.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash password
    password_hash = AuthService.hash_password(user_data.password)

    # Convert role string to enum
    try:
        role_enum = InternalUserRole(user_data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {user_data.role}")

    # Normalize locale to database format
    db_locale = normalize_locale(user_data.preferred_locale)

    # Create user
    user = InternalUser(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=password_hash,
        role=role_enum,
        preferred_locale=db_locale,
        is_active=user_data.is_active
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Format response with frontend-friendly locale
    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role.value,
        "is_active": user.is_active,
        "preferred_locale": format_locale_for_frontend(user.preferred_locale.value if user.preferred_locale else None),
        "created_at": user.created_at,
        "updated_at": user.updated_at
    }

    return InternalUserResponse(**user_dict)


@router.patch("/admin/users/{user_id}", response_model=InternalUserResponse)
def update_internal_user(
    user_id: UUID,
    user_data: InternalUserUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update an internal user (admin only).

    **RBAC:** Admin only

    Note: Password updates should be done via a separate endpoint for security.
    """
    require_admin(current_user)

    user = db.query(InternalUser).filter(InternalUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)

    # Handle email uniqueness check
    if "email" in update_data and update_data["email"] != user.email:
        existing = db.query(InternalUser).filter(
            InternalUser.email == update_data["email"]
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

    # Handle role conversion
    if "role" in update_data:
        try:
            update_data["role"] = InternalUserRole(update_data["role"])
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {update_data['role']}")

    # Handle locale normalization
    if "preferred_locale" in update_data:
        update_data["preferred_locale"] = normalize_locale(update_data["preferred_locale"])

    # Apply updates
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    # Format response with frontend-friendly locale
    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role.value,
        "is_active": user.is_active,
        "preferred_locale": format_locale_for_frontend(user.preferred_locale.value if user.preferred_locale else None),
        "created_at": user.created_at,
        "updated_at": user.updated_at
    }

    return InternalUserResponse(**user_dict)
