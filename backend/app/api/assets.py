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
    AssetEvent, NVRDisk, NVRChannel, PropertyDataType
)
from app.models.clients import Client, Site, Location
from app.models.tickets import Ticket, TicketStatusDefinition
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
    NVRChannelBulkUpdate,
    NVRChannelBulkUpdateRequest,
    ChannelWithStatusResponse,
    AssetTypeResponse,
    AssetPropertyDefinitionResponse,
    AssetTicketSummary
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import (
    get_current_active_user,
    require_admin,
    require_admin_or_technician
)
from app.utils.crypto import encrypt_secret, decrypt_secret

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
        property_value.value_secret_encrypted = encrypt_secret(str(value))


def get_property_value(
    property_value: AssetPropertyValue,
    current_user: Optional[CurrentUser] = None
) -> Any:
    """Get the value from the appropriate column based on data type.

    For SECRET type properties:
    - Internal users (admin, technician) can see the actual value
    - Other users see masked value
    """
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
        # Reveal secrets for internal admin/technician users
        if current_user and current_user.user_type == "internal":
            if current_user.role in ("admin", "technician"):
                return decrypt_secret(property_value.value_secret_encrypted)
        # Mask for everyone else
        return "***SECRET***" if property_value.value_secret_encrypted else None

    return None


def process_asset_properties(
    asset_id: UUID,
    asset_type_id: UUID,
    properties: Dict[str, Any],
    current_user: CurrentUser,
    db: Session
):
    """Process and save asset properties with audit trail."""
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

        # Get old value for audit log (before updating)
        old_value = None
        is_new = False
        if prop_value is None:
            is_new = True
            prop_value = AssetPropertyValue(
                asset_id=asset_id,
                property_definition_id=prop_def.id,
                updated_by_actor_type=actor_type,
                updated_by_actor_id=actor_id,
                updated_by_actor_display=actor_display
            )
            db.add(prop_value)
        else:
            # Get current value before changing
            old_value = get_property_value(prop_value, current_user)

        # Set the new value
        set_property_value(prop_value, prop_def.data_type, value)

        # Update actor info
        prop_value.updated_by_actor_type = actor_type
        prop_value.updated_by_actor_id = actor_id
        prop_value.updated_by_actor_display = actor_display
        prop_value.updated_at = datetime.utcnow()

        # Create audit event if value changed (and not a secret for security)
        if prop_def.data_type != 'secret':
            property_label = prop_def.label_en or prop_def.label_he or key

            if is_new:
                # New property added
                event = AssetEvent(
                    asset_id=asset_id,
                    event_type="property_set",
                    details=f"{property_label} set to '{value}'",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    actor_display=actor_display
                )
                db.add(event)
            elif old_value != value:
                # Property value changed
                event = AssetEvent(
                    asset_id=asset_id,
                    event_type="property_updated",
                    details=f"{property_label} changed from '{old_value}' to '{value}'",
                    actor_type=actor_type,
                    actor_id=actor_id,
                    actor_display=actor_display
                )
                db.add(event)
        elif is_new or old_value != value:
            # For secrets, don't show values in audit log
            property_label = prop_def.label_en or prop_def.label_he or key
            event = AssetEvent(
                asset_id=asset_id,
                event_type="property_updated",
                details=f"{property_label} was updated (password/secret)",
                actor_type=actor_type,
                actor_id=actor_id,
                actor_display=actor_display
            )
            db.add(event)


def get_asset_properties(
    asset: Asset,
    db: Session,
    current_user: Optional[CurrentUser] = None
) -> List[AssetPropertyValueResponse]:
    """Get all properties for an asset.

    Args:
        asset: The asset to get properties for
        db: Database session
        current_user: Current user (used for secret visibility)
    """
    properties = []

    for prop_value in asset.property_values:
        prop_def = prop_value.property_definition
        value = get_property_value(prop_value, current_user)

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

    # Build response with asset_type_code and key network properties
    asset_responses = []
    for asset in assets:
        # Get wan_public_ip and lan_ip_address from properties
        wan_ip = None
        lan_ip = None
        for prop_value in asset.property_values:
            if prop_value.property_definition:
                key = prop_value.property_definition.key
                if key == 'wan_public_ip':
                    wan_ip = prop_value.value_string
                elif key == 'lan_ip_address':
                    lan_ip = prop_value.value_string

        asset_dict = {
            **asset.__dict__,
            'asset_type_code': asset.asset_type.code if asset.asset_type else None,
            'wan_public_ip': wan_ip,
            'lan_ip_address': lan_ip
        }
        asset_responses.append(asset_dict)

    return AssetListResponse(
        items=asset_responses,
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

    # Build detailed response (pass current_user for secret visibility)
    properties = get_asset_properties(asset, db, current_user)

    return AssetDetailResponse(
        **asset.__dict__,
        asset_type_code=asset.asset_type.code if asset.asset_type else None,
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
    Get a specific asset by ID with all properties and linked tickets.

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

    # Build detailed response (pass current_user for secret visibility)
    properties = get_asset_properties(asset, db, current_user)

    # Get tickets linked to this asset (via asset_id FK)
    tickets_query = db.query(Ticket).filter(Ticket.asset_id == asset_id).order_by(Ticket.created_at.desc())
    tickets = tickets_query.all()

    # Build ticket summaries with closed state info
    ticket_summaries = []
    has_active_ticket = False
    for ticket in tickets:
        is_closed = ticket.status.is_closed_state if ticket.status else False
        if not is_closed:
            has_active_ticket = True
        ticket_summaries.append(AssetTicketSummary(
            id=ticket.id,
            ticket_number=ticket.ticket_number,
            title=ticket.title,
            status_id=ticket.status_id,
            status_code=ticket.status.code if ticket.status else None,
            is_closed=is_closed,
            priority=ticket.priority,
            created_at=ticket.created_at
        ))

    return AssetDetailResponse(
        **asset.__dict__,
        asset_type_code=asset.asset_type.code if asset.asset_type else None,
        asset_type=asset.asset_type,
        properties=properties,
        tickets=ticket_summaries,
        has_active_ticket=has_active_ticket
    )


@router.get("/assets/{asset_id}/usage-summary")
async def get_asset_usage_summary(
    asset_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get summary of asset usage across the system for pre-delete confirmation.

    **RBAC:** Admin only

    Returns information about:
    - Client name and site
    - Related tickets (total count and open tickets count)
    - NVR disks (if applicable)
    - Linked assets in many-to-many relationships
    - Property values count
    - Events count
    """
    from app.models.tickets import TicketStatusDefinition

    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Count related tickets
    all_tickets_count = db.query(Ticket).filter(
        or_(
            Ticket.asset_id == asset_id,
            Ticket.linked_assets.any(Asset.id == asset_id)
        )
    ).count()

    # Count open tickets (where status is not closed)
    open_tickets_count = db.query(Ticket).join(TicketStatusDefinition).filter(
        or_(
            Ticket.asset_id == asset_id,
            Ticket.linked_assets.any(Asset.id == asset_id)
        ),
        TicketStatusDefinition.is_closed_state == False
    ).count()

    # Count NVR disks
    disks_count = db.query(NVRDisk).filter(NVRDisk.asset_id == asset_id).count()

    # Get disk details for display
    disks = db.query(NVRDisk).filter(NVRDisk.asset_id == asset_id).all()
    disk_details = [
        {
            "id": str(disk.id),
            "slot": disk.slot_number,
            "serial_number": disk.serial_number,
            "capacity_gb": float(disk.capacity_tb) * 1024 if disk.capacity_tb else 0,  # Convert TB to GB
            "status": disk.status
        }
        for disk in disks
    ]

    # Count property values
    properties_count = db.query(AssetPropertyValue).filter(
        AssetPropertyValue.asset_id == asset_id
    ).count()

    # Count events
    events_count = db.query(AssetEvent).filter(
        AssetEvent.asset_id == asset_id
    ).count()

    # Count projects linked to this asset
    from app.models.projects import project_asset_links
    projects_count = db.query(project_asset_links).filter(
        project_asset_links.c.asset_id == asset_id
    ).count()

    return {
        "asset_id": str(asset.id),
        "asset_label": asset.label,
        "asset_type": asset.asset_type.code if asset.asset_type else None,
        "client_name": asset.client.name if asset.client else None,
        "site_name": asset.site.name if asset.site else None,
        "usage": {
            "tickets_total": all_tickets_count,
            "tickets_open": open_tickets_count,
            "has_open_tickets": open_tickets_count > 0,
            "nvr_disks_count": disks_count,
            "nvr_disks": disk_details,
            "properties_count": properties_count,
            "events_count": events_count,
            "projects_count": projects_count
        },
        "will_be_deleted": {
            "property_values": properties_count,
            "events": events_count,
            "nvr_disks": disks_count,
            "project_links": projects_count,
            "ticket_links": all_tickets_count  # M2M links, not tickets themselves
        },
        "will_be_preserved": {
            "tickets": all_tickets_count,
            "clients": 1,
            "sites": 1
        }
    }


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

    **Audit Trail:**
    - All manual changes are logged to asset_events table
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    actor_type, actor_id, actor_display = get_actor_info(current_user)

    # Field labels for human-readable audit messages
    field_labels = {
        'label': 'Name',
        'manufacturer': 'Manufacturer',
        'model': 'Model',
        'serial_number': 'Serial Number',
        'install_date': 'Installation Date',
        'status': 'Status',
        'location_id': 'Location',
        'notes': 'Notes'
    }

    # Track changes for audit log
    update_data = asset_data.model_dump(exclude_unset=True, exclude={"properties"})

    for field, new_value in update_data.items():
        old_value = getattr(asset, field, None)

        # Only log if value actually changed
        if old_value != new_value:
            field_label = field_labels.get(field, field)

            # Format values for display
            old_display = str(old_value) if old_value is not None else "not set"
            new_display = str(new_value) if new_value is not None else "not set"

            # Create audit event
            event = AssetEvent(
                asset_id=asset.id,
                event_type="field_updated",
                details=f"{field_label} changed from '{old_display}' to '{new_display}'",
                actor_type=actor_type,
                actor_id=actor_id,
                actor_display=actor_display
            )
            db.add(event)

            # Update the field
            setattr(asset, field, new_value)

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

    # Build detailed response (pass current_user for secret visibility)
    properties = get_asset_properties(asset, db, current_user)

    return AssetDetailResponse(
        **asset.__dict__,
        asset_type_code=asset.asset_type.code if asset.asset_type else None,
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

    **Audit Trail:**
    - Disk addition is logged to asset_events table
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
    db.flush()  # Get disk ID before creating event

    # Create audit event for disk addition
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    disk_label = f"Disk #{disk.slot_number}" if disk.slot_number else f"Disk {disk.serial_number}"
    capacity_str = f"{float(disk.capacity_tb) * 1024:.0f} GB" if disk.capacity_tb else "unknown capacity"

    event = AssetEvent(
        asset_id=asset_id,
        event_type="disk_added",
        details=f"{disk_label} added to system (Serial: {disk.serial_number}, {capacity_str})",
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)

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

    **Audit Trail:**
    - Status changes are logged to asset_events table
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

    actor_type, actor_id, actor_display = get_actor_info(current_user)

    # Track changes for audit log
    update_data = disk_data.model_dump(exclude_unset=True)

    for field, new_value in update_data.items():
        old_value = getattr(disk, field, None)

        # Log status changes (most important for monitoring)
        if field == 'status' and old_value != new_value:
            disk_label = f"Disk #{disk.slot_number}" if disk.slot_number else f"Disk {disk.serial_number}"
            event = AssetEvent(
                asset_id=asset_id,
                event_type="disk_status_changed",
                details=f"{disk_label} status changed from '{old_value}' to '{new_value}'",
                actor_type=actor_type,
                actor_id=actor_id,
                actor_display=actor_display
            )
            db.add(event)

        # Update the field
        setattr(disk, field, new_value)

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

    **Audit Trail:**
    - Disk removal is logged to asset_events table
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

    # Create audit event BEFORE deleting (to capture disk info)
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    disk_label = f"Disk #{disk.slot_number}" if disk.slot_number else f"Disk {disk.serial_number}"

    event = AssetEvent(
        asset_id=asset_id,
        event_type="disk_removed",
        details=f"{disk_label} removed from system (Serial: {disk.serial_number})",
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)

    # Now delete the disk
    db.delete(disk)
    db.commit()

    return None


# ========== NVR Channel Endpoints ==========

@router.get("/assets/{asset_id}/channels", response_model=List[ChannelWithStatusResponse])
async def list_nvr_channels(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List channels for an NVR/DVR asset with customization and live status.

    **Returns:**
    - Merged data: channel customization from `nvr_channels` table + live probe data from `last_probe_result`
    - Only configured channels from probe are returned
    - Customization is applied if available in database

    **RBAC:** All authenticated users can view
    """
    # Verify asset exists
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Load channel customization from database
    db_channels = db.query(NVRChannel).filter(
        NVRChannel.asset_id == asset_id
    ).all()

    # Create lookup dict by channel_number
    customization = {ch.channel_number: ch for ch in db_channels}

    # Get live probe data from last_probe_result
    probe_result = getattr(asset, 'last_probe_result', None) or {}

    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[channels] asset.last_probe_result type: {type(asset.last_probe_result)}")
    logger.info(f"[channels] probe_result keys: {list(probe_result.keys()) if probe_result else 'None'}")

    # Support both new format (channels at root) and legacy format (cameras.channels)
    probe_channels = probe_result.get("channels", [])
    if not probe_channels:
        cameras_data = probe_result.get("cameras", {})
        probe_channels = cameras_data.get("channels", []) if isinstance(cameras_data, dict) else []

    logger.info(f"[channels] Found {len(probe_channels)} channels in probe_result")

    # Merge customization with live data
    result = []
    for probe_ch in probe_channels:
        # Support both 'channel_number' (actual format) and 'number' (old format)
        channel_number = probe_ch.get("channel_number") or probe_ch.get("number")
        if not channel_number:
            continue

        custom = customization.get(channel_number)

        channel_data = ChannelWithStatusResponse(
            channel_number=channel_number,
            # Customization fields (from DB)
            custom_name=custom.custom_name if custom else None,
            is_ignored=custom.is_ignored if custom else False,
            notes=custom.notes if custom else None,
            # Live status fields (from probe)
            name=probe_ch.get("name"),
            ip_address=probe_ch.get("ip_address"),
            is_configured=probe_ch.get("is_configured", False),
            is_online=probe_ch.get("is_online", False),
            has_recording_24h=probe_ch.get("has_recording_24h", False),
            # Audit fields
            updated_by_actor_display=custom.updated_by_actor_display if custom else None,
            updated_at=custom.updated_at if custom else None,
        )
        result.append(channel_data)

    return result


@router.post("/assets/{asset_id}/channels/bulk-update", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_update_channels(
    asset_id: UUID,
    request: NVRChannelBulkUpdateRequest,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Bulk update channel customization (custom names, ignore flags, notes).

    **Logic:**
    - Upserts channels (INSERT if not exists, UPDATE if exists)
    - Creates audit event for channel customization changes
    - Does NOT affect live probe data (only persists customization)

    **RBAC:** Admin or Technician only

    **Audit Trail:**
    - Changes are logged to asset_events table
    """
    # Verify asset exists
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    actor_type, actor_id, actor_display = get_actor_info(current_user)

    # Track changes for audit log
    changes = []

    for channel_update in request.channels:
        # Find or create channel record
        channel = db.query(NVRChannel).filter(
            NVRChannel.asset_id == asset_id,
            NVRChannel.channel_number == channel_update.channel_number
        ).first()

        if channel:
            # Update existing channel
            old_custom_name = channel.custom_name
            old_is_ignored = channel.is_ignored
            old_notes = channel.notes

            channel.custom_name = channel_update.custom_name
            channel.is_ignored = channel_update.is_ignored
            channel.notes = channel_update.notes
            channel.updated_by_actor_type = actor_type
            channel.updated_by_actor_id = actor_id
            channel.updated_by_actor_display = actor_display

            # Track significant changes
            if old_custom_name != channel_update.custom_name or \
               old_is_ignored != channel_update.is_ignored or \
               old_notes != channel_update.notes:
                change_details = []
                if old_custom_name != channel_update.custom_name:
                    change_details.append(f"name: '{old_custom_name or 'None'}' → '{channel_update.custom_name or 'None'}'")
                if old_is_ignored != channel_update.is_ignored:
                    change_details.append(f"ignored: {old_is_ignored} → {channel_update.is_ignored}")
                if old_notes != channel_update.notes:
                    change_details.append("notes updated")

                changes.append(f"Channel {channel_update.channel_number}: {', '.join(change_details)}")
        else:
            # Create new channel record
            channel = NVRChannel(
                asset_id=asset_id,
                channel_number=channel_update.channel_number,
                custom_name=channel_update.custom_name,
                is_ignored=channel_update.is_ignored,
                notes=channel_update.notes,
                updated_by_actor_type=actor_type,
                updated_by_actor_id=actor_id,
                updated_by_actor_display=actor_display
            )
            db.add(channel)
            changes.append(f"Channel {channel_update.channel_number}: customization created")

    # Create audit event if there were changes
    if changes:
        event = AssetEvent(
            asset_id=asset_id,
            event_type="channels_customized",
            details=f"Channel customization updated: {'; '.join(changes)}",
            actor_type=actor_type,
            actor_id=actor_id,
            actor_display=actor_display
        )
        db.add(event)

    db.commit()

    return None


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete an asset and all associated data.

    **RBAC:** Admin only

    **Cascading deletions (automatically deleted by DB):**
    - AssetPropertyValue records (all dynamic properties)
    - AssetEvent records (all audit history)
    - NVRDisk records (all disk tracking data)
    - NVRChannel records (all channel customization)
    - ticket_asset_links entries (M2M ticket associations)
    - project_asset_links entries (M2M project associations)

    **Side effects (SET NULL - records remain intact):**
    - Tickets with this asset as primary link will have asset_id SET NULL
    - TicketLineItems with this asset reference will have linked_asset_id SET NULL

    **No broken links:** Clients, Sites, Projects, Tickets, and Line Items remain fully functional
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Create audit event before deletion
    actor_type, actor_id, actor_display = get_actor_info(current_user)
    event = AssetEvent(
        asset_id=asset.id,
        event_type="deleted",
        details=f"Asset '{asset.label}' deleted by {actor_display}",
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)

    # Delete asset (cascades will handle children)
    db.delete(asset)
    db.commit()

    return None
