"""
Portal assets API endpoints for client users.
Client users can view assets within their scope with safe fields only.
CLIENT_ADMIN users can also create, update, and probe assets.
"""
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime, date as date_type
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.db.session import get_db
from app.models.assets import (
    Asset, AssetPropertyValue, AssetPropertyDefinition, PropertyVisibility,
    AssetEvent, NVRDisk, NVRChannel, AssetType, PropertyDataType, HealthStatus
)
from app.models.users import ClientUser, ClientUserSite, ClientUserRole
from app.models.clients import Site, Client
from app.guards import ClientUserClaims, get_client_user
from app.rbac import (
    can_view_portal_assets,
    can_edit_portal_assets,
    can_probe_portal_assets,
    can_edit_portal_channels,
    check_client_user_client_access,
    filter_query_by_client_access
)
from app.utils.crypto import encrypt_secret, decrypt_secret

router = APIRouter()

# Asset types that support NVR-specific features (disks, channels, probe)
NVR_DVR_TYPES = {"NVR", "DVR"}


# ========== Helper Functions ==========

def get_client_user_allowed_sites(db: Session, client_user_id: UUID) -> list[UUID]:
    """Get list of site IDs a client user can access."""
    user_sites = db.query(ClientUserSite).filter(
        ClientUserSite.client_user_id == client_user_id
    ).all()
    return [site.site_id for site in user_sites]


def check_client_user_site_access(
    db: Session,
    claims: ClientUserClaims,
    client_user_id: UUID,
    site_id: UUID
) -> bool:
    """Check if a client user has access to a specific site."""
    # First verify the site's client is accessible to the user
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        return False

    # Check if user can access this client
    if not check_client_user_client_access(db, claims, client_user_id, site.client_id):
        return False

    # Client admins have access to all sites in their accessible clients
    if claims.role == "CLIENT_ADMIN":
        return True

    # Client users must have explicit site access
    allowed_sites = get_client_user_allowed_sites(db, client_user_id)
    return site_id in allowed_sites


def is_property_visible_to_client(visibility: str, prop_key: str = None, claims: ClientUserClaims = None) -> bool:
    """Check if a property should be visible to client portal users.

    Args:
        visibility: Property visibility level
        prop_key: Property key (e.g., 'device_password')
        claims: User claims for can_view_secrets check

    Returns:
        True if property should be visible
    """
    # Hide internal-only properties
    if visibility == PropertyVisibility.INTERNAL_ONLY.value:
        return False

    # Secrets (device_password) require can_view_secrets flag
    if prop_key == "device_password":
        if claims and claims.can_view_secrets:
            return True
        return False

    # Show client_admin and client_all properties
    return visibility in [PropertyVisibility.CLIENT_ADMIN.value, PropertyVisibility.CLIENT_ALL.value]


def get_portal_actor_info(user: ClientUser) -> tuple[str, UUID, str]:
    """Extract actor information from portal user for audit logging."""
    return "client_user", user.id, user.name


# ========== Pydantic Schemas for Portal ==========

class PortalAssetCreate(BaseModel):
    """Create asset request for portal users."""
    site_id: UUID
    asset_type_id: UUID
    label: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    install_date: Optional[date_type] = None
    notes: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class PortalAssetUpdate(BaseModel):
    """Update asset request for portal users."""
    label: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    install_date: Optional[date_type] = None
    notes: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class PortalChannelUpdate(BaseModel):
    """Single channel update."""
    channel_number: int
    custom_name: Optional[str] = None
    is_ignored: bool = False
    notes: Optional[str] = None


class PortalChannelBulkUpdateRequest(BaseModel):
    """Bulk channel update request."""
    channels: List[PortalChannelUpdate]


# ========== Endpoints ==========

@router.get("/assets", response_model=dict)
async def list_client_assets(
    asset_type_id: Optional[UUID] = Query(None),
    client_id: Optional[UUID] = Query(None, description="Filter by specific client"),
    site_id: Optional[UUID] = Query(None, description="Filter by specific site"),
    asset_type: Optional[str] = Query(None, description="Filter by asset type code"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    List assets visible to the portal user.

    - client_user: All assets in their allowed sites
    - client_admin: All assets across all client sites

    Returns paginated response matching frontend AssetListResponse format.
    """
    claims, user = claims_and_user

    if not can_view_portal_assets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    # Build query based on role with eager loading
    query = db.query(Asset).options(joinedload(Asset.asset_type))
    query = filter_query_by_client_access(query, Asset.client_id, claims)

    if claims.role == "CLIENT_USER" or claims.role == "CLIENT_CONTACT":
        # Filter by allowed sites
        allowed_sites = get_client_user_allowed_sites(db, user.id)
        if not allowed_sites:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        query = query.filter(Asset.site_id.in_(allowed_sites))

    # Filter by client_id if provided (must be in allowed clients)
    if client_id:
        # Verify access to this client
        if not check_client_user_client_access(db, claims, user.id, client_id):
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        query = query.filter(Asset.client_id == client_id)

    # Filter by site_id if provided
    if site_id:
        query = query.filter(Asset.site_id == site_id)

    # Filter by asset type if provided (by UUID or code)
    if asset_type_id:
        query = query.filter(Asset.asset_type_id == asset_type_id)
    elif asset_type:
        query = query.join(AssetType).filter(AssetType.code == asset_type)

    total = query.count()
    offset = (page - 1) * page_size
    assets = query.order_by(Asset.label).offset(offset).limit(page_size).all()

    # Return format matching frontend AssetListResponse
    return {
        "items": [
            {
                "id": str(asset.id),
                "client_id": str(asset.client_id),
                "site_id": str(asset.site_id),
                "asset_type_id": str(asset.asset_type_id),
                "asset_type_code": asset.asset_type.code if asset.asset_type else None,
                "label": asset.label,
                "manufacturer": asset.manufacturer,
                "model": asset.model,
                "serial_number": asset.serial_number,
                "install_date": asset.install_date.isoformat() if asset.install_date else None,
                "status": asset.status,
                "notes": asset.notes,
                "health_status": asset.health_status or "unknown",
                "health_issues": asset.health_issues,
                "last_probe_at": asset.last_probe_at.isoformat() if asset.last_probe_at else None,
                "created_at": asset.created_at.isoformat(),
                "updated_at": asset.updated_at.isoformat()
            }
            for asset in assets
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/assets/{asset_id}", response_model=dict)
async def get_asset_details(
    asset_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Get asset details with safe fields only.

    Hides:
    - Internal-only properties
    - Passwords and secrets
    - Cost/pricing information

    Returns asset object directly matching frontend AssetDetailResponse type.
    """
    claims, user = claims_and_user

    if not can_view_portal_assets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )

    # Get asset with eager loading
    asset = db.query(Asset).options(joinedload(Asset.asset_type)).filter(Asset.id == asset_id).first()

    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    # Check client access first
    if not check_client_user_client_access(db, claims, user.id, asset.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this asset")

    # Check site access for client_user
    if not check_client_user_site_access(db, claims, user.id, asset.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this asset")

    # Get property values with property_definition eager-loaded (avoid N+1)
    property_values = (
        db.query(AssetPropertyValue)
        .options(joinedload(AssetPropertyValue.property_definition))
        .filter(AssetPropertyValue.asset_id == asset_id)
        .all()
    )

    # Filter properties based on visibility and format as array
    safe_properties = []
    for pv in property_values:
        prop_def = pv.property_definition
        if is_property_visible_to_client(prop_def.visibility, prop_def.key, claims):
            # Get the value based on data type
            value = None
            if prop_def.data_type == "string":
                value = pv.value_string
            elif prop_def.data_type == "int":
                value = pv.value_int
            elif prop_def.data_type == "bool":
                value = pv.value_bool
            elif prop_def.data_type == "date":
                value = pv.value_date.isoformat() if pv.value_date else None
            elif prop_def.data_type == "decimal":
                value = str(pv.value_decimal) if pv.value_decimal else None
            elif prop_def.data_type == "enum":
                value = pv.value_enum
            elif prop_def.data_type == "secret":
                # Show secret for CLIENT_ADMIN with can_view_secrets flag
                if claims.can_view_secrets:
                    value = decrypt_secret(pv.value_secret_encrypted)
                else:
                    value = "***SECRET***" if pv.value_secret_encrypted else None

            safe_properties.append({
                "key": prop_def.key,
                "label": prop_def.label_en or prop_def.label_he,
                "value": value,
                "data_type": prop_def.data_type
            })

    # Build asset type object
    asset_type_obj = None
    if asset.asset_type:
        asset_type_obj = {
            "id": str(asset.asset_type.id),
            "code": asset.asset_type.code,
            "name_he": asset.asset_type.name_he,
            "name_en": asset.asset_type.name_en
        }

    # Return asset object directly (matches frontend AssetDetailResponse)
    return {
        "id": str(asset.id),
        "client_id": str(asset.client_id),
        "site_id": str(asset.site_id),
        "asset_type_id": str(asset.asset_type_id),
        "asset_type_code": asset.asset_type.code if asset.asset_type else None,
        "label": asset.label,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "install_date": asset.install_date.isoformat() if asset.install_date else None,
        "status": asset.status,
        "notes": asset.notes,
        "health_status": asset.health_status or "unknown",
        "health_issues": asset.health_issues,
        "last_probe_at": asset.last_probe_at.isoformat() if asset.last_probe_at else None,
        "created_at": asset.created_at.isoformat(),
        "updated_at": asset.updated_at.isoformat(),
        # Include nested objects for detail view
        "asset_type": asset_type_obj,
        "properties": safe_properties
    }


# ========== NVR Disks Endpoint ==========

@router.get("/assets/{asset_id}/disks", response_model=list)
async def list_asset_disks(
    asset_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    List NVR disks for an asset.

    **RBAC:** All portal users can view (scoped by client/site access)
    """
    claims, user = claims_and_user

    # Get asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    # Only NVR/DVR assets have disks
    if not asset.asset_type or asset.asset_type.code not in NVR_DVR_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This operation is only available for NVR/DVR assets")

    # Check access
    if not check_client_user_client_access(db, claims, user.id, asset.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not check_client_user_site_access(db, claims, user.id, asset.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get disks
    disks = db.query(NVRDisk).filter(NVRDisk.asset_id == asset_id).order_by(NVRDisk.slot_number).all()

    return [
        {
            "id": str(disk.id),
            "slot_number": disk.slot_number,
            "capacity_tb": float(disk.capacity_tb) if disk.capacity_tb else None,
            "install_date": disk.install_date.isoformat() if disk.install_date else None,
            "serial_number": disk.serial_number,
            "status": disk.status,
            "working_hours": disk.working_hours,
            "temperature": disk.temperature,
            "smart_status": disk.smart_status,
        }
        for disk in disks
    ]


# ========== NVR Channels Endpoint ==========

@router.get("/assets/{asset_id}/channels", response_model=list)
async def list_asset_channels(
    asset_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    List NVR channels with customization and live status.

    **RBAC:** All portal users can view (scoped by client/site access)
    """
    claims, user = claims_and_user

    # Get asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    # Only NVR/DVR assets have channels
    if not asset.asset_type or asset.asset_type.code not in NVR_DVR_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This operation is only available for NVR/DVR assets")

    # Check access
    if not check_client_user_client_access(db, claims, user.id, asset.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not check_client_user_site_access(db, claims, user.id, asset.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Load channel customization from database
    db_channels = db.query(NVRChannel).filter(NVRChannel.asset_id == asset_id).all()
    customization = {ch.channel_number: ch for ch in db_channels}

    # Get live probe data from last_probe_result
    probe_result = getattr(asset, 'last_probe_result', None) or {}

    # Support both new format (channels at root) and legacy format (cameras.channels)
    probe_channels = probe_result.get("channels", [])
    if not probe_channels:
        cameras_data = probe_result.get("cameras", {})
        probe_channels = cameras_data.get("channels", []) if isinstance(cameras_data, dict) else []

    # Merge customization with live data
    result = []
    for probe_ch in probe_channels:
        channel_number = probe_ch.get("channel_number") or probe_ch.get("number")
        if not channel_number:
            continue

        custom = customization.get(channel_number)

        result.append({
            "channel_number": channel_number,
            # Customization fields (from DB)
            "custom_name": custom.custom_name if custom else None,
            "is_ignored": custom.is_ignored if custom else False,
            "notes": custom.notes if custom else None,
            # Live status fields (from probe)
            "name": probe_ch.get("name"),
            "ip_address": probe_ch.get("ip_address"),
            "is_configured": probe_ch.get("is_configured", False),
            "is_online": probe_ch.get("is_online", False),
            "has_recording_24h": probe_ch.get("has_recording_24h", False),
            # Audit fields
            "updated_by_actor_display": custom.updated_by_actor_display if custom else None,
            "updated_at": custom.updated_at.isoformat() if custom and custom.updated_at else None,
        })

    return result


# ========== Asset Events Endpoint ==========

@router.get("/assets/{asset_id}/events", response_model=list)
async def list_asset_events(
    asset_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    List asset events (activity log).

    **RBAC:** All portal users can view (scoped by client/site access)
    """
    claims, user = claims_and_user

    # Get asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    # Check access
    if not check_client_user_client_access(db, claims, user.id, asset.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not check_client_user_site_access(db, claims, user.id, asset.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get events
    events = db.query(AssetEvent).filter(
        AssetEvent.asset_id == asset_id
    ).order_by(AssetEvent.created_at.desc()).all()

    return [
        {
            "id": str(event.id),
            "event_type": event.event_type,
            "details": event.details,
            "actor_type": event.actor_type,
            "actor_display": event.actor_display,
            "created_at": event.created_at.isoformat(),
        }
        for event in events
    ]


# ========== Asset Types Endpoint ==========

@router.get("/asset-types", response_model=list)
async def list_asset_types(
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    List all asset types.

    **RBAC:** All portal users can view
    """
    asset_types = db.query(AssetType).filter(AssetType.is_active == True).all()

    return [
        {
            "id": str(at.id),
            "code": at.code,
            "name_he": at.name_he,
            "name_en": at.name_en,
        }
        for at in asset_types
    ]


# ========== CLIENT_ADMIN Write Endpoints ==========

@router.post("/assets", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_asset(
    asset_data: PortalAssetCreate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Create a new asset.

    **RBAC:** CLIENT_ADMIN only
    """
    claims, user = claims_and_user

    if not can_edit_portal_assets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only CLIENT_ADMIN can create assets"
        )

    # Verify site exists and belongs to accessible client
    site = db.query(Site).filter(Site.id == asset_data.site_id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")

    if not check_client_user_client_access(db, claims, user.id, site.client_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this site's client"
        )

    # Verify asset type exists
    asset_type = db.query(AssetType).filter(AssetType.id == asset_data.asset_type_id).first()
    if not asset_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset type not found")

    # Create asset
    asset = Asset(
        client_id=site.client_id,
        site_id=asset_data.site_id,
        asset_type_id=asset_data.asset_type_id,
        label=asset_data.label,
        manufacturer=asset_data.manufacturer,
        model=asset_data.model,
        serial_number=asset_data.serial_number,
        install_date=asset_data.install_date,
        notes=asset_data.notes,
    )
    db.add(asset)
    db.flush()

    # Process properties if provided
    if asset_data.properties:
        _process_portal_asset_properties(
            asset.id, asset_data.asset_type_id, asset_data.properties, user, db
        )

    # Create audit event
    actor_type, actor_id, actor_display = get_portal_actor_info(user)
    event = AssetEvent(
        asset_id=asset.id,
        event_type="created",
        details=f"Asset created by {actor_display} (portal)",
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)

    db.commit()
    db.refresh(asset)

    return {"id": str(asset.id), "message": "Asset created successfully"}


@router.patch("/assets/{asset_id}", response_model=dict)
async def update_asset(
    asset_id: UUID,
    asset_data: PortalAssetUpdate,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Update an asset.

    **RBAC:** CLIENT_ADMIN only
    """
    claims, user = claims_and_user

    if not can_edit_portal_assets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only CLIENT_ADMIN can update assets"
        )

    # Get asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    # Check access
    if not check_client_user_client_access(db, claims, user.id, asset.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not check_client_user_site_access(db, claims, user.id, asset.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    actor_type, actor_id, actor_display = get_portal_actor_info(user)

    # Track changes for audit log
    changes = []
    update_data = asset_data.model_dump(exclude_unset=True, exclude={"properties"})

    for field, new_value in update_data.items():
        old_value = getattr(asset, field, None)
        if old_value != new_value:
            changes.append(f"{field}: '{old_value}' → '{new_value}'")
            setattr(asset, field, new_value)

    # Process properties if provided
    if asset_data.properties is not None:
        _process_portal_asset_properties(
            asset.id, asset.asset_type_id, asset_data.properties, user, db
        )
        changes.append("properties updated")

    # Create audit event if there were changes
    if changes:
        event = AssetEvent(
            asset_id=asset.id,
            event_type="updated",
            details=f"Asset updated by {actor_display} (portal): {'; '.join(changes)}",
            actor_type=actor_type,
            actor_id=actor_id,
            actor_display=actor_display
        )
        db.add(event)

    db.commit()

    return {"id": str(asset.id), "message": "Asset updated successfully"}


@router.post("/assets/{asset_id}/probe", response_model=dict)
async def probe_asset(
    asset_id: UUID,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Probe a Hikvision device and save results.

    **RBAC:** CLIENT_ADMIN only
    """
    claims, user = claims_and_user

    if not can_probe_portal_assets(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only CLIENT_ADMIN can probe assets"
        )

    # Get asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    # Only NVR/DVR assets can be probed
    if not asset.asset_type or asset.asset_type.code not in NVR_DVR_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This operation is only available for NVR/DVR assets")

    # Check access
    if not check_client_user_client_access(db, claims, user.id, asset.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not check_client_user_site_access(db, claims, user.id, asset.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Get asset properties for connection
    props_query = (
        db.query(AssetPropertyDefinition.key, AssetPropertyValue)
        .join(AssetPropertyValue, AssetPropertyValue.property_definition_id == AssetPropertyDefinition.id)
        .filter(AssetPropertyValue.asset_id == asset_id)
    )
    props = {row[0]: row[1] for row in props_query.all()}

    # Extract connection details
    ip_prop = props.get("wan_public_ip") or props.get("ip_address")
    port_prop = props.get("wan_service_port") or props.get("port")
    username_prop = props.get("device_username") or props.get("admin_username")
    password_prop = props.get("device_password") or props.get("admin_password")

    if not ip_prop or not username_prop or not password_prop:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset missing required connection properties (wan_public_ip, device_username, device_password)"
        )

    # Import hikvision probe function
    from app.services.hikvision_service import probe_device_impl, calculate_health_status
    from app.schemas.hikvision import HikvisionProbeRequest
    from app.schemas.auth import CurrentUser as InternalCurrentUser

    # Get ignored channels for health calculation
    ignored_channels_db = db.query(NVRChannel).filter(
        NVRChannel.asset_id == asset_id,
        NVRChannel.is_ignored == True
    ).all()
    ignored_channels = {ch.channel_number for ch in ignored_channels_db}

    # Create probe request
    probe_request = HikvisionProbeRequest(
        host=ip_prop.value_string,
        port=int(port_prop.value_int) if port_prop and port_prop.value_int else 8000,
        username=username_prop.value_string,
        password=decrypt_secret(password_prop.value_secret_encrypted),
    )

    # Create a mock internal user for the probe function
    # The probe function expects an internal user, so we create a compatible object
    class PortalUserProxy:
        def __init__(self, user: ClientUser):
            self.id = user.id
            self.name = user.name
            self.email = user.email
            self.user_type = "client_user"
            self.role = user.role

    proxy_user = PortalUserProxy(user)

    try:
        # Run probe
        probe_result = await probe_device_impl(probe_request, proxy_user, ignored_channels)

        # Calculate health status
        health_status, health_issues = calculate_health_status(probe_result, ignored_channels)

        # Update asset health fields
        asset.health_status = health_status
        asset.health_issues = health_issues
        asset.last_probe_at = datetime.utcnow()
        asset.last_probe_result = probe_result

        # Create audit event
        actor_type, actor_id, actor_display = get_portal_actor_info(user)
        event = AssetEvent(
            asset_id=asset.id,
            event_type="probe_refresh",
            details=f"Probe triggered by {actor_display} (portal). Status: {health_status}",
            actor_type=actor_type,
            actor_id=actor_id,
            actor_display=actor_display
        )
        db.add(event)

        # Update NVR disks from probe result
        _update_nvr_disks_from_probe(asset_id, probe_result, db)

        db.commit()

        return {
            "success": True,
            "health_status": health_status,
            "health_issues": health_issues,
            "message": "Probe completed successfully"
        }

    except Exception as e:
        # Create error audit event
        actor_type, actor_id, actor_display = get_portal_actor_info(user)
        event = AssetEvent(
            asset_id=asset.id,
            event_type="probe_failed",
            details=f"Probe by {actor_display} (portal) failed: {str(e)}",
            actor_type=actor_type,
            actor_id=actor_id,
            actor_display=actor_display
        )
        db.add(event)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Probe failed: {str(e)}"
        )


@router.post("/assets/{asset_id}/channels/bulk-update", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_update_channels(
    asset_id: UUID,
    request: PortalChannelBulkUpdateRequest,
    claims_and_user: tuple[ClientUserClaims, ClientUser] = Depends(get_client_user),
    db: Session = Depends(get_db)
):
    """
    Bulk update channel customization (custom names, ignore flags, notes).

    **RBAC:** CLIENT_ADMIN only
    """
    claims, user = claims_and_user

    if not can_edit_portal_channels(claims.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only CLIENT_ADMIN can edit channels"
        )

    # Get asset
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    # Only NVR/DVR assets have channels
    if not asset.asset_type or asset.asset_type.code not in NVR_DVR_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This operation is only available for NVR/DVR assets")

    # Check access
    if not check_client_user_client_access(db, claims, user.id, asset.client_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not check_client_user_site_access(db, claims, user.id, asset.site_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    actor_type, actor_id, actor_display = get_portal_actor_info(user)

    changes = []

    for channel_update in request.channels:
        # Find or create channel record
        channel = db.query(NVRChannel).filter(
            NVRChannel.asset_id == asset_id,
            NVRChannel.channel_number == channel_update.channel_number
        ).first()

        if channel:
            # Track changes
            if (channel.custom_name != channel_update.custom_name or
                channel.is_ignored != channel_update.is_ignored or
                channel.notes != channel_update.notes):
                changes.append(f"Channel {channel_update.channel_number} updated")

            channel.custom_name = channel_update.custom_name
            channel.is_ignored = channel_update.is_ignored
            channel.notes = channel_update.notes
            channel.updated_by_actor_type = actor_type
            channel.updated_by_actor_id = actor_id
            channel.updated_by_actor_display = actor_display
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
            changes.append(f"Channel {channel_update.channel_number} created")

    # Create audit event if there were changes
    if changes:
        event = AssetEvent(
            asset_id=asset_id,
            event_type="channels_customized",
            details=f"Channel customization by {actor_display} (portal): {'; '.join(changes)}",
            actor_type=actor_type,
            actor_id=actor_id,
            actor_display=actor_display
        )
        db.add(event)

    db.commit()

    return None


# ========== Helper Functions ==========

def _process_portal_asset_properties(
    asset_id: UUID,
    asset_type_id: UUID,
    properties: Dict[str, Any],
    user: ClientUser,
    db: Session
):
    """Process and save asset properties from portal user."""
    if not properties:
        return

    # Get all property definitions for this asset type (1 query)
    prop_defs = db.query(AssetPropertyDefinition).filter(
        AssetPropertyDefinition.asset_type_id == asset_type_id
    ).all()
    prop_def_map = {pd.key: pd for pd in prop_defs}

    # Batch-load ALL existing property values for this asset (1 query instead of N)
    existing_values = db.query(AssetPropertyValue).filter(
        AssetPropertyValue.asset_id == asset_id
    ).all()
    existing_map = {pv.property_definition_id: pv for pv in existing_values}

    actor_type, actor_id, actor_display = get_portal_actor_info(user)

    for key, value in properties.items():
        if key not in prop_def_map:
            continue

        prop_def = prop_def_map[key]

        # Find existing property value (no extra query)
        prop_value = existing_map.get(prop_def.id)

        if prop_value is None:
            prop_value = AssetPropertyValue(
                asset_id=asset_id,
                property_definition_id=prop_def.id,
                updated_by_actor_type=actor_type,
                updated_by_actor_id=actor_id,
                updated_by_actor_display=actor_display
            )
            db.add(prop_value)

        # Set the value based on data type
        _set_property_value(prop_value, prop_def.data_type, value)

        prop_value.updated_by_actor_type = actor_type
        prop_value.updated_by_actor_id = actor_id
        prop_value.updated_by_actor_display = actor_display
        prop_value.updated_at = datetime.utcnow()


def _set_property_value(property_value: AssetPropertyValue, data_type: str, value: Any):
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
            property_value.value_date = date_type.fromisoformat(value)
        elif isinstance(value, date_type):
            property_value.value_date = value
    elif data_type == PropertyDataType.DECIMAL.value:
        property_value.value_decimal = float(value)
    elif data_type == PropertyDataType.ENUM.value:
        property_value.value_enum = str(value)
    elif data_type == PropertyDataType.SECRET.value:
        property_value.value_secret_encrypted = encrypt_secret(str(value))


def _update_nvr_disks_from_probe(asset_id: UUID, probe_result: dict, db: Session):
    """Update NVR disk records from probe result."""
    storage = probe_result.get("storage", {})
    disks = storage.get("disks", [])

    # Batch-load all existing disks for this asset (1 query instead of N)
    existing_disks = db.query(NVRDisk).filter(NVRDisk.asset_id == asset_id).all()
    disks_by_slot = {d.slot_number: d for d in existing_disks}

    for disk_data in disks:
        slot = disk_data.get("slot")
        if slot is None:
            continue

        # Find existing disk by slot (no extra query)
        disk = disks_by_slot.get(slot)

        if disk:
            # Update existing disk
            disk.status = disk_data.get("status", disk.status)
            disk.working_hours = disk_data.get("working_hours", disk.working_hours)
            disk.temperature = disk_data.get("temperature", disk.temperature)
            disk.smart_status = disk_data.get("smart_status", disk.smart_status)
