"""
Assets API endpoints.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, date

from app.db.session import get_db
from app.models.assets import (
    Asset, AssetType, AssetPropertyDefinition, AssetPropertyValue,
    AssetEvent, NVRDisk, PropertyDataType
)
from app.models.clients import Client, Site, Location
from app.schemas.assets import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetDetailResponse,
    AssetListResponse,
    AssetPropertyValueResponse,
    AssetEventCreate,
    AssetEventResponse,
    NVRDiskCreate,
    NVRDiskUpdate,
    NVRDiskResponse,
    AssetTypeResponse,
    AssetPropertyDefinitionResponse
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import (
    get_current_active_user,
    require_admin,
    require_admin_or_technician
)

router = APIRouter()


def get_actor_info(current_user: CurrentUser) -> tuple[str, Optional[UUID], str]:
    """Extract actor information from current user."""
    actor_type = current_user.user_type
    actor_id = current_user.id
    actor_display = current_user.name
    return actor_type, actor_id, actor_display


def set_property_value(
    property_value: AssetPropertyValue,
    data_type: str,
    value: Any
):
    """Set the appropriate value column based on data type."""
    # Clear all value columns first
    property_value.value_string = None
    property_value.value_int = None
    property_value.value_bool = None
    property_value.value_date = None
    property_value.value_decimal = None
    property_value.value_enum = None
    property_value.value_secret_encrypted = None

    if value is None:
        return

    if data_type == PropertyDataType.STRING.value:
        property_value.value_string = str(value)
    elif data_type == PropertyDataType.INT.value:
        property_value.value_int = int(value)
    elif data_type == PropertyDataType.BOOL.value:
        property_value.value_bool = bool(value)
    elif data_type == PropertyDataType.DATE.value:
        if isinstance(value, str):
            property_value.value_date = date.fromisoformat(value)
        elif isinstance(value, date):
            property_value.value_date = value
    elif data_type == PropertyDataType.DECIMAL.value:
        property_value.value_decimal = float(value)
    elif data_type == PropertyDataType.ENUM.value:
        property_value.value_enum = str(value)
    elif data_type == PropertyDataType.SECRET.value:
        # TODO: Implement encryption
        property_value.value_secret_encrypted = str(value)


def get_property_value(property_value: AssetPropertyValue) -> Any:
    """Get the value from the appropriate column based on data type."""
    prop_def = property_value.property_definition
    data_type = prop_def.data_type

    if data_type == PropertyDataType.STRING.value:
        return property_value.value_string
    elif data_type == PropertyDataType.INT.value:
        return property_value.value_int
    elif data_type == PropertyDataType.BOOL.value:
        return property_value.value_bool
    elif data_type == PropertyDataType.DATE.value:
        return property_value.value_date
    elif data_type == PropertyDataType.DECIMAL.value:
        return property_value.value_decimal
    elif data_type == PropertyDataType.ENUM.value:
        return property_value.value_enum
    elif data_type == PropertyDataType.SECRET.value:
        # TODO: Implement decryption
        # For now, mask secrets
        return "***SECRET***" if property_value.value_secret_encrypted else None

    return None


def process_asset_properties(
    asset_id: UUID,
    asset_type_id: UUID,
    properties: Dict[str, Any],
    current_user: CurrentUser,
    db: Session
):
    """Process and save asset properties."""
    if not properties:
        return

    # Get all property definitions for this asset type
    prop_defs = db.query(AssetPropertyDefinition).filter(
        AssetPropertyDefinition.asset_type_id == asset_type_id
    ).all()

    prop_def_map = {pd.key: pd for pd in prop_defs}

    actor_type, actor_id, actor_display = get_actor_info(current_user)

    for key, value in properties.items():
        if key not in prop_def_map:
            # Skip unknown properties
            continue

        prop_def = prop_def_map[key]

        # Find or create property value
        prop_value = db.query(AssetPropertyValue).filter(
            AssetPropertyValue.asset_id == asset_id,
            AssetPropertyValue.property_definition_id == prop_def.id
        ).first()

        if prop_value is None:
            prop_value = AssetPropertyValue(
                asset_id=asset_id,
                property_definition_id=prop_def.id,
                updated_by_actor_type=actor_type,
                updated_by_actor_id=actor_id,
                updated_by_actor_display=actor_display
            )
            db.add(prop_value)

        # Set the value
        set_property_value(prop_value, prop_def.data_type, value)

        # Update actor info
        prop_value.updated_by_actor_type = actor_type
        prop_value.updated_by_actor_id = actor_id
        prop_value.updated_by_actor_display = actor_display
        prop_value.updated_at = datetime.utcnow()


def get_asset_properties(asset: Asset, db: Session) -> List[AssetPropertyValueResponse]:
    """Get all properties for an asset."""
    properties = []

    for prop_value in asset.property_values:
        prop_def = prop_value.property_definition
        value = get_property_value(prop_value)

        properties.append(AssetPropertyValueResponse(
            property_definition_id=prop_def.id,
            key=prop_def.key,
            label_he=prop_def.label_he,
            label_en=prop_def.label_en,
            data_type=prop_def.data_type,
            value=value,
            updated_at=prop_value.updated_at,
            updated_by_actor_display=prop_value.updated_by_actor_display
        ))

    return properties


# ========== Asset Type Endpoints ==========

@router.get("/asset-types", response_model=List[AssetTypeResponse])
async def list_asset_types(
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all asset types.

    **RBAC:** All authenticated users can view asset types
    """
    asset_types = db.query(AssetType).all()
    return asset_types


@router.get("/asset-types/{asset_type_id}/properties", response_model=List[AssetPropertyDefinitionResponse])
async def list_property_definitions(
    asset_type_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List property definitions for an asset type.

    **RBAC:** All authenticated users can view property definitions
    """
    asset_type = db.query(AssetType).filter(AssetType.id == asset_type_id).first()
    if not asset_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset type not found"
        )

    prop_defs = db.query(AssetPropertyDefinition).filter(
        AssetPropertyDefinition.asset_type_id == asset_type_id
    ).all()

    return prop_defs


# ========== Asset CRUD Endpoints ==========

@router.get("/assets", response_model=AssetListResponse)
async def list_assets(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    site_id: Optional[UUID] = Query(None, description="Filter by site"),
    asset_type_id: Optional[UUID] = Query(None, description="Filter by asset type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    q: Optional[str] = Query(None, description="Search by label or serial number"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List assets with filtering and pagination.

    **RBAC:**
    - Internal users: Can see all assets
    - Client users: Can only see assets for their own client
    """
    query = db.query(Asset)

    # Apply RBAC filters
    if current_user.user_type == "client":
        query = query.filter(Asset.client_id == current_user.client_id)

    # Apply filters
    if client_id:
        query = query.filter(Asset.client_id == client_id)
    if site_id:
        query = query.filter(Asset.site_id == site_id)
    if asset_type_id:
        query = query.filter(Asset.asset_type_id == asset_type_id)
    if status:
        query = query.filter(Asset.status == status)
    if q:
        query = query.filter(
            or_(
                Asset.label.ilike(f"%{q}%"),
                Asset.serial_number.ilike(f"%{q}%")
            )
        )

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    assets = query.order_by(Asset.created_at.desc()).offset(offset).limit(page_size).all()

    return AssetListResponse(
        items=assets,
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/assets", response_model=AssetDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(
    asset_data: AssetCreate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Create a new asset with dynamic properties.

    **RBAC:** Admin or Technician only

    **Properties:**
    - Accepts a properties dict with key-value pairs
    - Properties are validated against asset_property_definitions for the asset type
    - Values are stored in appropriate columns based on data_type
    """
    # Validate client exists
    client = db.query(Client).filter(Client.id == asset_data.client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    # Validate site exists and belongs to client
    site = db.query(Site).filter(
        Site.id == asset_data.site_id,
        Site.client_id == asset_data.client_id
    ).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found or does not belong to this client"
        )

    # Validate asset type exists
    asset_type = db.query(AssetType).filter(
        AssetType.id == asset_data.asset_type_id
    ).first()
    if not asset_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset type not found"
        )

    # Validate location if provided
    if asset_data.location_id:
        location = db.query(Location).filter(
            Location.id == asset_data.location_id,
            Location.site_id == asset_data.site_id
        ).first()
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found or does not belong to this site"
            )

    # Create asset
    asset_dict = asset_data.model_dump(exclude={"properties"})
    asset = Asset(**asset_dict)
    db.add(asset)
    db.flush()

    # Process properties
    if asset_data.properties:
        process_asset_properties(
            asset.id,
            asset_data.asset_type_id,
            asset_data.properties,
            current_user,
            db
        )

    # Create asset event for creation
    actor_type, actor_id, actor_display = get_actor_info(current_user)
    event = AssetEvent(
        asset_id=asset.id,
        event_type="created",
        details=f"Asset created by {actor_display}",
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)

    db.commit()
    db.refresh(asset)

    # Build detailed response
    properties = get_asset_properties(asset, db)

    return AssetDetailResponse(
        **asset.__dict__,
        asset_type=asset.asset_type,
        properties=properties
    )


@router.get("/assets/{asset_id}", response_model=AssetDetailResponse)
async def get_asset(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific asset by ID with all properties.

    **RBAC:**
    - Internal users: Can access any asset
    - Client users: Can only access assets for their own client
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(asset.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Build detailed response
    properties = get_asset_properties(asset, db)

    return AssetDetailResponse(
        **asset.__dict__,
        asset_type=asset.asset_type,
        properties=properties
    )


@router.patch("/assets/{asset_id}", response_model=AssetDetailResponse)
async def update_asset(
    asset_id: UUID,
    asset_data: AssetUpdate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Update an asset.

    **RBAC:** Admin or Technician only

    **Properties:**
    - If properties dict is provided, updates only those properties
    - Other properties remain unchanged
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Update only provided fields (exclude properties)
    update_data = asset_data.model_dump(exclude_unset=True, exclude={"properties"})
    for field, value in update_data.items():
        setattr(asset, field, value)

    # Process properties if provided
    if asset_data.properties is not None:
        process_asset_properties(
            asset.id,
            asset.asset_type_id,
            asset_data.properties,
            current_user,
            db
        )

    db.commit()
    db.refresh(asset)

    # Build detailed response
    properties = get_asset_properties(asset, db)

    return AssetDetailResponse(
        **asset.__dict__,
        asset_type=asset.asset_type,
        properties=properties
    )


# ========== Asset Events ==========

@router.get("/assets/{asset_id}/events", response_model=List[AssetEventResponse])
async def list_asset_events(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all events for an asset.

    **RBAC:**
    - Internal users: Can see events for any asset
    - Client users: Can only see events for their client's assets
    """
    # First verify asset exists and user has access
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(asset.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    events = db.query(AssetEvent).filter(
        AssetEvent.asset_id == asset_id
    ).order_by(AssetEvent.created_at.desc()).all()

    return events


@router.post("/assets/{asset_id}/events", response_model=AssetEventResponse, status_code=status.HTTP_201_CREATED)
async def create_asset_event(
    asset_id: UUID,
    event_data: AssetEventCreate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Add an event to an asset.

    **RBAC:** Admin or Technician only
    """
    # Verify asset exists
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Create event
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    event = AssetEvent(
        **event_data.model_dump(),
        asset_id=asset_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return event


# ========== NVR Disks ==========

@router.get("/assets/{asset_id}/disks", response_model=List[NVRDiskResponse])
async def list_nvr_disks(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List all disks for an NVR asset.

    **RBAC:**
    - Internal users: Can see disks for any asset
    - Client users: Can only see disks for their client's assets
    """
    # First verify asset exists and user has access
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Apply RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(asset.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    disks = db.query(NVRDisk).filter(
        NVRDisk.asset_id == asset_id
    ).order_by(NVRDisk.slot_number).all()

    return disks


@router.post("/assets/{asset_id}/disks", response_model=NVRDiskResponse, status_code=status.HTTP_201_CREATED)
async def create_nvr_disk(
    asset_id: UUID,
    disk_data: NVRDiskCreate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Add a disk to an NVR asset.

    **RBAC:** Admin or Technician only
    """
    # Verify asset exists
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Create disk
    disk = NVRDisk(
        **disk_data.model_dump(),
        asset_id=asset_id
    )
    db.add(disk)
    db.commit()
    db.refresh(disk)

    return disk


@router.patch("/assets/{asset_id}/disks/{disk_id}", response_model=NVRDiskResponse)
async def update_nvr_disk(
    asset_id: UUID,
    disk_id: UUID,
    disk_data: NVRDiskUpdate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Update an NVR disk.

    **RBAC:** Admin or Technician only
    """
    disk = db.query(NVRDisk).filter(
        NVRDisk.id == disk_id,
        NVRDisk.asset_id == asset_id
    ).first()

    if not disk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disk not found"
        )

    # Update only provided fields
    update_data = disk_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(disk, field, value)

    db.commit()
    db.refresh(disk)

    return disk


@router.delete("/assets/{asset_id}/disks/{disk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_nvr_disk(
    asset_id: UUID,
    disk_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete an NVR disk.

    **RBAC:** Admin only
    """
    disk = db.query(NVRDisk).filter(
        NVRDisk.id == disk_id,
        NVRDisk.asset_id == asset_id
    ).first()

    if not disk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disk not found"
        )

    db.delete(disk)
    db.commit()

    return None
