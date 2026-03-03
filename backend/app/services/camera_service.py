"""
Camera service layer.

Provides snapshot capture, camera listing, and detail retrieval
for standalone CAMERA-type assets. Supports ISAPI (via parent NVR)
and direct RTSP (via ffmpeg) protocols.
"""
import asyncio
import re
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.assets import (
    Asset, AssetType, AssetPropertyDefinition, AssetPropertyValue,
)
from app.models.clients import Client, Site
from app.integrations.hikvision.isapi_client import get_snapshot as isapi_get_snapshot
from app.services.hikvision_service import get_asset_credentials
from app.utils.crypto import decrypt_secret
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

# Limit concurrent ffmpeg processes to avoid resource exhaustion
_rtsp_semaphore = asyncio.Semaphore(5)

_PASSWORD_RE = re.compile(r'(://[^:]+:)([^@]+)(@)')


def _mask_url(url: str) -> str:
    """Mask password in RTSP URL for safe logging."""
    return _PASSWORD_RE.sub(r'\1***\3', url)


def _get_camera_props(db: Session, asset_id: UUID) -> tuple[Asset, dict[str, any]]:
    """
    Load a CAMERA asset and its EAV properties.

    Returns:
        Tuple of (asset, property_dict) where property_dict maps key → value.

    Raises:
        ValueError: If asset not found or not CAMERA type.
    """
    asset = (
        db.query(Asset)
        .join(AssetType)
        .filter(Asset.id == asset_id)
        .first()
    )
    if not asset:
        raise ValueError(f"Asset not found: {asset_id}")
    if asset.asset_type.code != 'CAMERA':
        raise ValueError(f"Asset {asset_id} is not a CAMERA (type={asset.asset_type.code})")

    # Load EAV key→value pairs
    rows = (
        db.query(AssetPropertyDefinition.key, AssetPropertyValue)
        .join(
            AssetPropertyValue,
            AssetPropertyValue.property_definition_id == AssetPropertyDefinition.id,
        )
        .filter(AssetPropertyValue.asset_id == asset_id)
    ).all()

    props: dict[str, any] = {}
    for key, pv in rows:
        if pv.value_string is not None:
            props[key] = pv.value_string
        elif pv.value_int is not None:
            props[key] = pv.value_int
        elif pv.value_bool is not None:
            props[key] = pv.value_bool
        elif pv.value_secret_encrypted is not None:
            props[key] = pv.value_secret_encrypted
        elif pv.value_decimal is not None:
            props[key] = pv.value_decimal
        elif pv.value_date is not None:
            props[key] = pv.value_date
        elif pv.value_enum is not None:
            props[key] = pv.value_enum
        else:
            props[key] = None

    return asset, props


async def _get_snapshot_sdk(db: Session, props: dict) -> bytes:
    """
    Get snapshot via Hikvision SDK through parent NVR.

    Uses the SDK connection pool (port 8000) for reliable capture.
    Falls back to ISAPI HTTP if SDK fails.
    """
    from app.integrations.hik_monitor_lib.connection_pool import get_connection_pool
    from app.integrations.hikvision.hybrid_probe import get_sdk_path

    parent_nvr_id = props.get('camera_parent_nvr_id')
    if not parent_nvr_id:
        raise ValueError("Camera has no parent NVR configured (camera_parent_nvr_id)")

    channel = props.get('camera_channel_number')
    if not channel:
        raise ValueError("Camera has no channel number configured (camera_channel_number)")

    try:
        nvr_uuid = UUID(parent_nvr_id)
    except (ValueError, TypeError):
        raise ValueError(f"Invalid parent NVR ID: {parent_nvr_id}")

    logger.info(f"[camera-snapshot] SDK: parent_nvr={parent_nvr_id}, channel={channel}")
    creds = get_asset_credentials(db, nvr_uuid)

    pool = get_connection_pool()
    sdk_path = get_sdk_path()
    pool_key = (parent_nvr_id, creds.host, creds.port)

    try:
        manager, is_new = await pool.get_connection(
            parent_nvr_id, creds.host, creds.port,
            creds.username, creds.password, sdk_path
        )
        logger.info(f"[camera-snapshot] SDK connection acquired (new={is_new})")

        success, jpeg_data, error_msg = await manager.get_snapshot(int(channel))

        if success and jpeg_data:
            logger.info(f"[camera-snapshot] SDK snapshot captured: {len(jpeg_data)} bytes")
            return jpeg_data

        # Fallback to ISAPI if SDK fails
        logger.warning(f"[camera-snapshot] SDK failed: {error_msg}, trying ISAPI fallback")
        return await isapi_get_snapshot(
            creds.host, creds.web_port, creds.username, creds.password, int(channel)
        )
    finally:
        pool.release_connection(*pool_key)


async def _get_snapshot_rtsp(props: dict) -> bytes:
    """
    Get snapshot via RTSP using ffmpeg subprocess.

    Uses camera_rtsp_url if available, otherwise constructs from
    device credentials.
    """
    rtsp_url = props.get('camera_rtsp_url')

    if not rtsp_url:
        # Try to construct RTSP URL from device credentials
        ip = props.get('wan_public_ip')
        username = props.get('device_username')
        password_enc = props.get('device_password')

        if not ip:
            raise ValueError("RTSP camera has no IP address or RTSP URL configured")

        password = decrypt_secret(password_enc) if password_enc else ''
        stream = 'main' if props.get('camera_stream_type', 'main') == 'main' else 'sub'
        # Standard Hikvision RTSP URL pattern
        channel = props.get('camera_channel_number', 1)
        stream_num = 1 if stream == 'main' else 2
        rtsp_url = f"rtsp://{username}:{password}@{ip}:554/Streaming/Channels/{channel}0{stream_num}"

    logger.info(f"[camera-snapshot] RTSP: url={_mask_url(rtsp_url)}")

    async with _rtsp_semaphore:
        proc = await asyncio.create_subprocess_exec(
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', rtsp_url,
            '-frames:v', '1',
            '-f', 'image2',
            '-update', '1',
            'pipe:1',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15.0)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise RuntimeError("RTSP snapshot timed out after 15 seconds")

    if proc.returncode != 0:
        err_msg = stderr.decode(errors='replace')[-500:]
        logger.error(f"[camera-snapshot] ffmpeg failed (rc={proc.returncode}): {err_msg}")
        raise RuntimeError(f"ffmpeg snapshot failed (rc={proc.returncode})")

    if len(stdout) < 100 or stdout[:2] != b'\xff\xd8':
        raise RuntimeError("ffmpeg produced invalid JPEG data")

    logger.info(f"[camera-snapshot] RTSP snapshot captured: {len(stdout)} bytes")
    return stdout


async def get_snapshot(db: Session, asset_id: UUID) -> bytes:
    """
    Get JPEG snapshot from a CAMERA asset.

    Auto-detects protocol from camera_protocol EAV property:
    - 'isapi': routes through parent NVR via SDK (port 8000), ISAPI fallback
    - 'rtsp': captures via ffmpeg subprocess
    - None: tries SDK if parent_nvr_id is set, otherwise rtsp

    Args:
        db: Database session
        asset_id: UUID of the CAMERA asset

    Returns:
        JPEG bytes

    Raises:
        ValueError: Asset not found, not CAMERA type, or missing config
        RuntimeError: ffmpeg failure or timeout
        IsapiError: ISAPI device communication failure
    """
    asset, props = _get_camera_props(db, asset_id)
    protocol = props.get('camera_protocol', '').lower()

    logger.info(
        f"[camera-snapshot] asset_id={asset_id}, label={asset.label}, protocol={protocol or 'auto'}"
    )

    if protocol == 'isapi':
        return await _get_snapshot_sdk(db, props)
    elif protocol == 'rtsp':
        return await _get_snapshot_rtsp(props)
    else:
        # Auto-detect: prefer ISAPI if parent NVR is configured
        if props.get('camera_parent_nvr_id') and props.get('camera_channel_number'):
            logger.info("[camera-snapshot] Auto-detect: using SDK (parent NVR found)")
            return await _get_snapshot_sdk(db, props)
        elif props.get('camera_rtsp_url') or props.get('wan_public_ip'):
            logger.info("[camera-snapshot] Auto-detect: using RTSP")
            return await _get_snapshot_rtsp(props)
        else:
            raise ValueError(
                "Cannot determine snapshot method: "
                "set camera_protocol, camera_parent_nvr_id+channel, or camera_rtsp_url"
            )


def list_cameras(
    db: Session,
    client_id: Optional[UUID] = None,
    site_id: Optional[UUID] = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    """
    List all CAMERA-type assets with optional filters.

    Returns:
        Tuple of (items_list, total_count) for pagination.
    """
    base_query = (
        db.query(Asset)
        .join(AssetType)
        .filter(AssetType.code == 'CAMERA')
    )

    if client_id:
        base_query = base_query.filter(Asset.client_id == client_id)
    if site_id:
        base_query = base_query.filter(Asset.site_id == site_id)

    total = base_query.count()

    assets = (
        base_query
        .order_by(Asset.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for asset in assets:
        # Load EAV properties
        _, props = _get_camera_props(db, asset.id)

        # Load client/site names
        client = db.query(Client).filter(Client.id == asset.client_id).first()
        site = db.query(Site).filter(Site.id == asset.site_id).first()

        # Resolve parent NVR label
        parent_nvr_label = None
        parent_nvr_id = props.get('camera_parent_nvr_id')
        if parent_nvr_id:
            try:
                parent_nvr = db.query(Asset).filter(Asset.id == UUID(parent_nvr_id)).first()
                if parent_nvr:
                    parent_nvr_label = parent_nvr.label
            except (ValueError, TypeError):
                pass

        items.append({
            'id': asset.id,
            'label': asset.label,
            'client_id': asset.client_id,
            'client_name': client.name if client else None,
            'site_id': asset.site_id,
            'site_name': site.name if site else None,
            'manufacturer': asset.manufacturer,
            'model': asset.model,
            'status': asset.status,
            'camera_protocol': props.get('camera_protocol'),
            'camera_channel_number': props.get('camera_channel_number'),
            'parent_nvr_id': parent_nvr_id,
            'parent_nvr_label': parent_nvr_label,
            'health_status': asset.health_status,
            'created_at': asset.created_at,
            'updated_at': asset.updated_at,
        })

    return items, total


def get_camera_detail(db: Session, asset_id: UUID) -> dict:
    """
    Get full camera info including parent NVR details.

    Returns:
        Dict suitable for CameraInfoResponse schema.

    Raises:
        ValueError: If asset not found or not CAMERA type.
    """
    asset, props = _get_camera_props(db, asset_id)

    client = db.query(Client).filter(Client.id == asset.client_id).first()
    site = db.query(Site).filter(Site.id == asset.site_id).first()

    # Resolve parent NVR
    parent_nvr_label = None
    parent_nvr_health = None
    parent_nvr_id = props.get('camera_parent_nvr_id')
    if parent_nvr_id:
        try:
            parent_nvr = db.query(Asset).filter(Asset.id == UUID(parent_nvr_id)).first()
            if parent_nvr:
                parent_nvr_label = parent_nvr.label
                parent_nvr_health = parent_nvr.health_status
        except (ValueError, TypeError):
            pass

    # Mask RTSP URL for response
    rtsp_url = props.get('camera_rtsp_url')
    masked_rtsp = _mask_url(rtsp_url) if rtsp_url else None

    return {
        'id': asset.id,
        'label': asset.label,
        'client_id': asset.client_id,
        'client_name': client.name if client else None,
        'site_id': asset.site_id,
        'site_name': site.name if site else None,
        'manufacturer': asset.manufacturer,
        'model': asset.model,
        'serial_number': asset.serial_number,
        'status': asset.status,
        'camera_protocol': props.get('camera_protocol'),
        'camera_channel_number': props.get('camera_channel_number'),
        'camera_stream_type': props.get('camera_stream_type'),
        'camera_rtsp_url_masked': masked_rtsp,
        'parent_nvr_id': parent_nvr_id,
        'parent_nvr_label': parent_nvr_label,
        'parent_nvr_health_status': parent_nvr_health,
        'health_status': asset.health_status,
        'created_at': asset.created_at,
        'updated_at': asset.updated_at,
    }
