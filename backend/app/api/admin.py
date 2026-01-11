"""
Admin API endpoints for system configuration.
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.tickets import TicketStatusDefinition
from app.models.assets import AssetType, AssetPropertyDefinition
from app.schemas.admin import (
    TicketStatusCreate,
    TicketStatusUpdate,
    TicketStatusResponse,
    AssetTypeCreate,
    AssetTypeUpdate,
    AssetTypeResponse,
    AssetPropertyDefinitionCreate,
    AssetPropertyDefinitionUpdate,
    AssetPropertyDefinitionResponse
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user

router = APIRouter()


def require_admin(current_user: CurrentUser):
    """Ensure user is admin."""
    if current_user.user_type != "internal" or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


# ========== Ticket Status Admin ==========

@router.get("/admin/ticket-statuses", response_model=List[TicketStatusResponse])
def list_ticket_statuses(
    include_inactive: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all ticket status definitions.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    query = db.query(TicketStatusDefinition)
    if not include_inactive:
        query = query.filter(TicketStatusDefinition.is_active == True)

    statuses = query.order_by(TicketStatusDefinition.sort_order).all()
    return statuses


@router.post("/admin/ticket-statuses", response_model=TicketStatusResponse, status_code=201)
def create_ticket_status(
    status_data: TicketStatusCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new ticket status definition.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    # Check if code already exists
    existing = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.code == status_data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Status code already exists")

    # Create status
    status = TicketStatusDefinition(
        code=status_data.code,
        name_he=status_data.name_he,
        name_en=status_data.name_en,
        description=status_data.description,
        is_active=True,
        is_default=False,  # Cannot set default on create
        is_closed_state=status_data.is_closed_state,
        sort_order=status_data.sort_order
    )

    db.add(status)
    db.commit()
    db.refresh(status)

    return status


@router.get("/admin/ticket-statuses/{status_id}", response_model=TicketStatusResponse)
def get_ticket_status(
    status_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a ticket status definition.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    status = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.id == status_id
    ).first()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")

    return status


@router.patch("/admin/ticket-statuses/{status_id}", response_model=TicketStatusResponse)
def update_ticket_status(
    status_id: UUID,
    status_data: TicketStatusUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update a ticket status definition.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    status = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.id == status_id
    ).first()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")

    # Update fields
    update_data = status_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(status, key, value)

    db.commit()
    db.refresh(status)

    return status


@router.post("/admin/ticket-statuses/{status_id}/set-default", response_model=TicketStatusResponse)
def set_default_status(
    status_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Set a status as the default (unsets others).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    status = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.id == status_id
    ).first()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")

    # Unset all other defaults
    db.query(TicketStatusDefinition).update({"is_default": False})

    # Set this one as default
    status.is_default = True

    db.commit()
    db.refresh(status)

    return status


@router.delete("/admin/ticket-statuses/{status_id}", status_code=204)
def delete_ticket_status(
    status_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete a ticket status definition (soft delete - set is_active=False).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    status = db.query(TicketStatusDefinition).filter(
        TicketStatusDefinition.id == status_id
    ).first()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")

    # Cannot delete if it's the default
    if status.is_default:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete default status. Set another status as default first."
        )

    # Soft delete
    status.is_active = False

    db.commit()

    return None


# ========== Asset Type Admin ==========

@router.get("/admin/asset-types", response_model=List[AssetTypeResponse])
def list_asset_types_admin(
    include_inactive: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all asset types (admin endpoint with inactive).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    query = db.query(AssetType)
    if not include_inactive:
        query = query.filter(AssetType.is_active == True)

    types = query.order_by(AssetType.code).all()
    return types


@router.post("/admin/asset-types", response_model=AssetTypeResponse, status_code=201)
def create_asset_type(
    type_data: AssetTypeCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a custom asset type.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    # Check if code already exists
    existing = db.query(AssetType).filter(AssetType.code == type_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Asset type code already exists")

    # Create asset type
    asset_type = AssetType(
        code=type_data.code,
        name_he=type_data.name_he,
        name_en=type_data.name_en,
        description=type_data.description,
        is_active=True
    )

    db.add(asset_type)
    db.commit()
    db.refresh(asset_type)

    return asset_type


@router.get("/admin/asset-types/{type_id}", response_model=AssetTypeResponse)
def get_asset_type_admin(
    type_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get an asset type.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    asset_type = db.query(AssetType).filter(AssetType.id == type_id).first()
    if not asset_type:
        raise HTTPException(status_code=404, detail="Asset type not found")

    return asset_type


@router.patch("/admin/asset-types/{type_id}", response_model=AssetTypeResponse)
def update_asset_type(
    type_id: UUID,
    type_data: AssetTypeUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update an asset type.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    asset_type = db.query(AssetType).filter(AssetType.id == type_id).first()
    if not asset_type:
        raise HTTPException(status_code=404, detail="Asset type not found")

    # Update fields
    update_data = type_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(asset_type, key, value)

    db.commit()
    db.refresh(asset_type)

    return asset_type


@router.delete("/admin/asset-types/{type_id}", status_code=204)
def delete_asset_type(
    type_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete an asset type (soft delete - set is_active=False).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    asset_type = db.query(AssetType).filter(AssetType.id == type_id).first()
    if not asset_type:
        raise HTTPException(status_code=404, detail="Asset type not found")

    # Soft delete
    asset_type.is_active = False

    db.commit()

    return None


# ========== Asset Property Definition Admin ==========

@router.get("/admin/asset-property-definitions", response_model=List[AssetPropertyDefinitionResponse])
def list_property_definitions_admin(
    asset_type_id: Optional[UUID] = Query(None),
    include_inactive: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List asset property definitions.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    query = db.query(AssetPropertyDefinition)

    if asset_type_id:
        query = query.filter(AssetPropertyDefinition.asset_type_id == asset_type_id)

    if not include_inactive:
        query = query.filter(AssetPropertyDefinition.is_active == True)

    definitions = query.order_by(
        AssetPropertyDefinition.asset_type_id,
        AssetPropertyDefinition.sort_order
    ).all()

    return definitions


@router.post("/admin/asset-property-definitions", response_model=AssetPropertyDefinitionResponse, status_code=201)
def create_property_definition(
    definition_data: AssetPropertyDefinitionCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new asset property definition.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    # Verify asset type exists
    asset_type = db.query(AssetType).filter(
        AssetType.id == definition_data.asset_type_id
    ).first()
    if not asset_type:
        raise HTTPException(status_code=404, detail="Asset type not found")

    # Check if key already exists for this asset type
    existing = db.query(AssetPropertyDefinition).filter(
        AssetPropertyDefinition.asset_type_id == definition_data.asset_type_id,
        AssetPropertyDefinition.key == definition_data.key
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Property key already exists for this asset type"
        )

    # Create property definition
    definition = AssetPropertyDefinition(
        asset_type_id=definition_data.asset_type_id,
        key=definition_data.key,
        label_he=definition_data.label_he,
        label_en=definition_data.label_en,
        data_type=definition_data.data_type,
        required=definition_data.required,
        visibility=definition_data.visibility,
        sort_order=definition_data.sort_order,
        is_active=True
    )

    db.add(definition)
    db.commit()
    db.refresh(definition)

    return definition


@router.get("/admin/asset-property-definitions/{definition_id}", response_model=AssetPropertyDefinitionResponse)
def get_property_definition(
    definition_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get an asset property definition.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    definition = db.query(AssetPropertyDefinition).filter(
        AssetPropertyDefinition.id == definition_id
    ).first()
    if not definition:
        raise HTTPException(status_code=404, detail="Property definition not found")

    return definition


@router.patch("/admin/asset-property-definitions/{definition_id}", response_model=AssetPropertyDefinitionResponse)
def update_property_definition(
    definition_id: UUID,
    definition_data: AssetPropertyDefinitionUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update an asset property definition.

    **RBAC:** Admin only
    """
    require_admin(current_user)

    definition = db.query(AssetPropertyDefinition).filter(
        AssetPropertyDefinition.id == definition_id
    ).first()
    if not definition:
        raise HTTPException(status_code=404, detail="Property definition not found")

    # Update fields
    update_data = definition_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(definition, key, value)

    db.commit()
    db.refresh(definition)

    return definition


@router.delete("/admin/asset-property-definitions/{definition_id}", status_code=204)
def delete_property_definition(
    definition_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete an asset property definition (soft delete - set is_active=False).

    **RBAC:** Admin only
    """
    require_admin(current_user)

    definition = db.query(AssetPropertyDefinition).filter(
        AssetPropertyDefinition.id == definition_id
    ).first()
    if not definition:
        raise HTTPException(status_code=404, detail="Property definition not found")

    # Soft delete
    definition.is_active = False

    db.commit()

    return None
