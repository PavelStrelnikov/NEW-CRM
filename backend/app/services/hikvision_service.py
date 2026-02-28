"""
Hikvision service layer.

Extracts common patterns from api/hikvision.py:
- Asset credential loading (replaces 8 duplicate blocks)
- Health status calculation (pure business logic)
- Device probe implementation (SDK + ISAPI orchestration)
- Probe-and-save orchestration (probe + DB persistence)
"""
import logging
from dataclasses import dataclass
from datetime import datetime, date as date_type
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.assets import (
    Asset, AssetPropertyDefinition, AssetPropertyValue, HealthStatus,
    AssetEvent, NVRDisk, NVRChannel,
)
from app.schemas.hikvision import HikvisionProbeRequest
from app.schemas.auth import CurrentUser
from app.integrations.hikvision.hybrid_probe import (
    get_sdk_path,
    convert_sync_data_to_response,
)
from app.utils.crypto import decrypt_secret

logger = logging.getLogger(__name__)


@dataclass
class AssetCredentials:
    """Connection credentials extracted from asset properties."""
    asset: Asset
    host: str
    port: int          # SDK service port (default 8000)
    web_port: int      # HTTP/ISAPI port (default 80)
    username: str
    password: str      # Already decrypted


def get_asset_credentials(db: Session, asset_id: UUID) -> AssetCredentials:
    """
    Load asset and extract Hikvision connection credentials.

    Loads the asset, queries all property definitions + values,
    extracts host/port/web_port/username/password with fallback keys,
    decrypts the password, and returns a DTO.

    Args:
        db: Database session
        asset_id: UUID of the asset

    Returns:
        AssetCredentials with all connection details

    Raises:
        ValueError: If asset not found or required credentials missing
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise ValueError("Asset not found")

    # Load all property key→value pairs for this asset
    props_query = (
        db.query(AssetPropertyDefinition.key, AssetPropertyValue)
        .join(AssetPropertyValue, AssetPropertyValue.property_definition_id == AssetPropertyDefinition.id)
        .filter(AssetPropertyValue.asset_id == asset_id)
    )
    props = {row[0]: row[1] for row in props_query.all()}

    # Extract with fallback keys (new names → legacy names)
    ip_prop = props.get("wan_public_ip") or props.get("ip_address")
    port_prop = props.get("wan_service_port") or props.get("service_port") or props.get("port")
    web_port_prop = props.get("wan_http_port") or props.get("http_port") or props.get("wan_web_port")
    username_prop = props.get("device_username") or props.get("admin_username")
    password_prop = props.get("device_password") or props.get("admin_password")

    # Validate required fields
    if not ip_prop or not ip_prop.value_string:
        raise ValueError("Asset missing IP address (wan_public_ip)")
    if not username_prop or not username_prop.value_string:
        raise ValueError("Asset missing device username")
    if not password_prop or not password_prop.value_secret_encrypted:
        raise ValueError("Asset missing device password")

    return AssetCredentials(
        asset=asset,
        host=ip_prop.value_string,
        port=port_prop.value_int if port_prop and port_prop.value_int else 8000,
        web_port=web_port_prop.value_int if web_port_prop and web_port_prop.value_int else 80,
        username=username_prop.value_string,
        password=decrypt_secret(password_prop.value_secret_encrypted),
    )


def calculate_health_status(probe_result: dict, ignored_channels: set[int] = None) -> tuple[str, list[str]]:
    """
    Calculate equipment health status and issues from probe result.

    Health Status Logic:
    - CRITICAL (Red): Device offline OR disk with 'Error'/'SMART: Fail'
    - WARNING (Yellow): Device online BUT offline cameras OR no 24h recording
    - OK (Green): All systems normal

    Args:
        probe_result: Probe result dictionary from device
        ignored_channels: Set of channel numbers to exclude from health monitoring (e.g., {2, 5, 8})

    Returns:
        Tuple of (health_status, health_issues_list)
    """
    if ignored_channels is None:
        ignored_channels = set()

    issues = []

    # Check if probe was successful (device reachable)
    meta = probe_result.get("meta", {})
    if not meta.get("success"):
        return HealthStatus.CRITICAL.value, ["DEVICE_OFFLINE"]

    # Check disk health - CRITICAL condition
    storage = probe_result.get("storage", {})
    disks = storage.get("disks", [])
    for disk in disks:
        status = (disk.get("status") or "").lower()
        smart_status = (disk.get("smart_status") or "").lower()

        # Check for error/fail conditions
        if "error" in status or "fail" in status:
            issues.append(f"HDD_{disk.get('slot', '?')}_STATUS_ERROR")
        if "fail" in smart_status:
            issues.append(f"HDD_{disk.get('slot', '?')}_SMART_FAIL")
        elif "warning" in smart_status:
            issues.append(f"HDD_{disk.get('slot', '?')}_SMART_WARNING")

    # Check for critical disk issues
    critical_disk_issues = [i for i in issues if "ERROR" in i or "FAIL" in i]

    # Check camera/channel status - WARNING condition
    # Count offline/no-recording channels EXCLUDING ignored ones
    # Support both new format (channels at root) and legacy format (cameras.channels)
    channels = probe_result.get("channels", [])
    if not channels:
        cameras_data = probe_result.get("cameras", {})
        channels = cameras_data.get("channels", []) if isinstance(cameras_data, dict) else []

    offline_count = 0
    recording_missing = 0

    if channels:
        # Detailed channel-by-channel analysis
        for channel in channels:
            # Get channel number - hybrid_probe.py uses "channel_number" (equals display_number 1-16)
            channel_number = channel.get("channel_number") or channel.get("display_number") or channel.get("number")

            # Skip ignored channels
            if channel_number in ignored_channels:
                continue

            # Only count issues for configured channels
            if not channel.get("is_configured", False):
                continue

            if not channel.get("is_online", False):
                offline_count += 1

            if not channel.get("has_recording_24h", False):
                recording_missing += 1
    else:
        # Legacy fallback: use summary counts from cameras object
        cameras = probe_result.get("cameras", {})
        if isinstance(cameras, dict):
            offline_count = cameras.get("offline", 0)
            recording_missing = cameras.get("recording_missing", 0)

    if offline_count > 0:
        issues.append(f"CAMERAS_OFFLINE_{offline_count}")

    if recording_missing > 0:
        issues.append(f"NO_RECORDING_24H_{recording_missing}")

    # Determine final status
    if critical_disk_issues:
        return HealthStatus.CRITICAL.value, issues
    elif offline_count > 0 or recording_missing > 0 or any("WARNING" in i for i in issues):
        return HealthStatus.WARNING.value, issues
    else:
        return HealthStatus.OK.value, []


async def probe_device_impl(
    probe_data: HikvisionProbeRequest,
    current_user: CurrentUser,
    ignored_channels: set[int] | None = None,
):
    """
    Internal implementation of device probe.

    Probe a Hikvision device using hybrid SDK + ISAPI approach.

    Uses hik_monitor_lib for cross-platform SDK operations:
    - SDK (Service Port): Deep diagnostics - HDD S.M.A.R.T., channels, device info
    - ISAPI (Web Port): Time sync, snapshots (via SDK session)

    Ports:
    - probe_data.port: Service Port for SDK connection (default 8000)
    - probe_data.web_port: Web Port for ISAPI (default 80, reserved for future use)

    Returns device info, storage status with S.M.A.R.T. data, camera count,
    network config, and time drift information.
    """
    import sys
    import os

    logger.info("=" * 60)
    logger.info("HIKVISION PROBE REQUEST - DEBUG")
    logger.info("=" * 60)
    logger.info(f"Platform: {sys.platform}")
    logger.info(f"Request: host={probe_data.host}, port={probe_data.port}, web_port={probe_data.web_port}")
    logger.info(f"Username: {probe_data.username}, Proto: {probe_data.proto}, Timeout: {probe_data.timeout}")

    try:
        # Import hik_monitor_lib
        from app.integrations.hik_monitor_lib import (
            HikvisionManager,
            DeviceConnectionError,
            SdkNotFoundError,
            SdkInitError,
        )
        logger.info("Successfully imported hik_monitor_lib")
    except ImportError as e:
        logger.error(f"Failed to import hik_monitor_lib: {e}")
        raise HTTPException(
            status_code=500,
            detail="Hikvision SDK library not available"
        )

    # Get cross-platform SDK path
    sdk_path = get_sdk_path()
    logger.info(f"SDK path resolved: {sdk_path}")
    logger.info(f"SDK path exists: {os.path.exists(sdk_path)}")

    # Check for SDK files
    if os.path.exists(sdk_path):
        sdk_files = os.listdir(sdk_path)
        logger.info(f"SDK directory contents: {sdk_files[:10]}...")  # First 10 files

    logger.info(f"Probing {probe_data.host}:{probe_data.port} via SDK at {sdk_path}")

    manager = None
    errors = {}

    try:
        # Initialize SDK manager
        logger.info("Initializing HikvisionManager...")
        manager = HikvisionManager(sdk_path=sdk_path)
        logger.info(f"HikvisionManager initialized. Platform: {manager._platform}")

        # Connect via SDK (Service Port)
        logger.info(f"Connecting to {probe_data.host}:{probe_data.port}...")
        await manager.connect(
            ip=probe_data.host,
            port=probe_data.port,  # Service Port (default 8000)
            username=probe_data.username,
            password=probe_data.password
        )
        logger.info(f"Connection successful. user_id={manager.user_id}, is_connected={manager.is_connected()}")

        # Get all device data via SDK with ignored channels
        if ignored_channels:
            logger.info(f"Fetching sync_data with {len(ignored_channels)} ignored channels: {ignored_channels}")
        else:
            logger.info("Fetching sync_data (no channels ignored)...")
        sync_data = await manager.get_sync_data(ignored_channels=ignored_channels)

        # Debug: Log what we got from SDK
        logger.info("=" * 40)
        logger.info("SYNC DATA RECEIVED:")
        logger.info(f"  device: {sync_data.device}")
        if sync_data.device:
            logger.info(f"    serial_number: {sync_data.device.serial_number}")
            logger.info(f"    device_type: {sync_data.device.device_type}")
            logger.info(f"    device_type_name: {sync_data.device.device_type_name}")
            logger.info(f"    analog_channels: {sync_data.device.analog_channels}")
            logger.info(f"    ip_channels: {sync_data.device.ip_channels}")
            logger.info(f"    disk_count: {sync_data.device.disk_count}")
        logger.info(f"  hdd_list count: {len(sync_data.hdd_list) if sync_data.hdd_list else 0}")
        for i, hdd in enumerate(sync_data.hdd_list or []):
            logger.info(f"    HDD[{i}]: number={hdd.number}, capacity={hdd.capacity_gb}GB, status={hdd.status}, temp={hdd.temperature}°C, hours={hdd.power_on_hours}h")
        logger.info(f"  channels count: {len(sync_data.channels) if sync_data.channels else 0}")
        configured = [c for c in (sync_data.channels or []) if c.is_configured]
        online = [c for c in configured if c.is_online]
        logger.info(f"    configured: {len(configured)}, online: {len(online)}")
        logger.info("=" * 40)

        # SMART data fallback: If SDK failed to get SMART data, try direct HTTP
        if sync_data.hdd_list:
            has_smart_data = any(hdd.temperature is not None or hdd.power_on_hours is not None for hdd in sync_data.hdd_list)
            if not has_smart_data:
                logger.warning("SDK did not retrieve SMART data (all temperature and hours are NULL)")
                logger.info("Attempting direct HTTP ISAPI requests as fallback...")
                try:
                    # Try direct HTTP SMART retrieval (bypasses SDK)
                    smart_data = await manager.diagnostics.get_smart_direct_http_async(
                        host=probe_data.host,
                        port=probe_data.web_port,  # Use HTTP port, not SDK port
                        username=probe_data.username,
                        password=probe_data.password
                    )

                    if smart_data:
                        logger.info(f"Direct HTTP retrieved SMART data for {len(smart_data)} disks")
                        # Apply SMART data to HDD list (only set if value exists)
                        for hdd in sync_data.hdd_list:
                            if hdd.number in smart_data:
                                info = smart_data[hdd.number]
                                hdd.temperature = info.get("temperature") if info.get("temperature") else None
                                hdd.power_on_hours = info.get("power_on_hours") if info.get("power_on_hours") else None
                                hdd.reallocated_sectors = info.get("reallocated_sectors") if info.get("reallocated_sectors") else None
                                hdd.smart_status = info.get("smart_status") if info.get("smart_status") else None
                                logger.info(f"  HDD {hdd.number}: Updated SMART - {hdd.temperature}C, {hdd.power_on_hours}h, {hdd.smart_status}")
                    else:
                        logger.warning("Direct HTTP also failed to retrieve SMART data - SMART fields will remain NULL")
                        errors["smart_http"] = "SMART not supported by device (all endpoints failed)"
                except Exception as e:
                    logger.error(f"Direct HTTP SMART retrieval failed: {e}")
                    errors["smart_http"] = str(e)

        # Get time info (drift detection) - uses ISAPI via SDK session
        time_info = None
        try:
            logger.info("Fetching time_info...")
            time_info = await manager.get_time_info()
            if time_info:
                logger.info(f"Time info: device_time={time_info.device_time}, drift={time_info.drift_seconds}s")
        except Exception as e:
            logger.warning(f"Failed to get time info: {e}")
            errors["time"] = str(e)

        # Get NVR's own LAN IPs (from network interfaces, not cameras)
        nvr_lan_ips = None
        try:
            logger.info("=" * 40)
            logger.info("FETCHING NVR LAN IPS FROM ISAPI")
            logger.info("=" * 40)
            nvr_lan_ips = await manager.get_nvr_lan_ips()
            logger.info(f"NVR LAN IPs result: {nvr_lan_ips}")
            if nvr_lan_ips:
                logger.info(f"SUCCESS: Got {len(nvr_lan_ips)} LAN IP(s) from ISAPI: {nvr_lan_ips}")
            else:
                logger.warning("WARNING: ISAPI returned empty list - will fall back to camera IPs")
            logger.info("=" * 40)
        except Exception as e:
            logger.warning(f"EXCEPTION getting NVR LAN IPs: {e}")
            errors["network"] = str(e)

        # Convert to API response
        logger.info("Converting sync_data to response...")
        result = convert_sync_data_to_response(sync_data, time_info, errors, nvr_lan_ips, ignored_channels)

        # Validate: if no device info, mark as failed
        if not sync_data.device or not sync_data.device.serial_number:
            logger.warning("Probe returned empty device data - marking as failed")
            result["meta"]["success"] = False
            result["meta"]["errors"]["device"] = "No device information returned from SDK"

        logger.info(f"Probe result: success={result['meta']['success']}, errors={result['meta']['errors']}")
        return result

    except SdkNotFoundError as e:
        logger.error(f"SDK not found: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Hikvision SDK library not found at {sdk_path}"
        )
    except SdkInitError as e:
        logger.error(f"SDK init failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to initialize Hikvision SDK"
        )
    except DeviceConnectionError as e:
        logger.warning(f"Device connection failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to device: {e}"
        )
    except Exception as e:
        logger.exception(f"Probe failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Probe failed: {str(e)}"
        )
    finally:
        # Cleanup
        if manager:
            try:
                await manager.disconnect()
                manager.cleanup()
            except Exception as e:
                logger.warning(f"Cleanup error: {e}")


async def probe_and_save_asset(
    db: Session,
    asset_id: UUID,
    current_user,
):
    """
    Probe a Hikvision device and save the results to the database.

    Orchestrates the full probe-and-save flow:
    1. Load asset credentials
    2. Load ignored channels
    3. Run device probe
    4. Save results: properties, disks, health status, audit events
    5. Commit to DB

    Args:
        db: Database session
        asset_id: UUID of the asset to probe
        current_user: Authenticated user (internal or portal proxy)

    Returns:
        Probe result dictionary (same format as /probe endpoint)

    Raises:
        HTTPException: If asset not found or credentials missing
    """
    logger.info(f"[probe-and-save] Starting for asset_id={asset_id}")

    try:
        creds = get_asset_credentials(db, asset_id)
    except ValueError as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 400, detail=str(e))

    asset = creds.asset

    # Load ignored channels to pass to probe_device for correct health calculation
    ignored_channels_db = db.query(NVRChannel).filter(
        NVRChannel.asset_id == asset_id,
        NVRChannel.is_ignored == True
    ).all()
    ignored_channels = {ch.channel_number for ch in ignored_channels_db}
    if ignored_channels:
        logger.info(f"[probe-and-save] Passing {len(ignored_channels)} ignored channels to probe: {ignored_channels}")

    # Probe the device with ignored channels
    probe_request = HikvisionProbeRequest(
        host=creds.host,
        port=creds.port,
        username=creds.username,
        password=creds.password,
    )

    probe_result = await probe_device_impl(probe_request, current_user, ignored_channels=ignored_channels)

    # If probe was successful, save the data
    if probe_result.get("meta", {}).get("success"):
        logger.info(f"[probe-and-save] Probe successful, saving data...")

        try:
            # Get all property definitions for this asset type
            prop_defs = db.query(AssetPropertyDefinition).filter(
                AssetPropertyDefinition.asset_type_id == asset.asset_type_id
            ).all()
            prop_def_map = {pd.key: pd for pd in prop_defs}

            # Helper to update or create property
            def update_property(key: str, value, data_type: str = "string"):
                if key not in prop_def_map or value is None:
                    return
                prop_def = prop_def_map[key]
                prop_value = db.query(AssetPropertyValue).filter(
                    AssetPropertyValue.asset_id == asset_id,
                    AssetPropertyValue.property_definition_id == prop_def.id
                ).first()

                if not prop_value:
                    prop_value = AssetPropertyValue(
                        asset_id=asset_id,
                        property_definition_id=prop_def.id,
                        updated_by_actor_type=current_user.user_type,
                        updated_by_actor_id=current_user.id,
                        updated_by_actor_display=current_user.name
                    )
                    db.add(prop_value)

                # Clear all value columns
                prop_value.value_string = None
                prop_value.value_int = None
                prop_value.value_bool = None

                # Set the appropriate column
                if data_type == "string":
                    prop_value.value_string = str(value) if value else None
                elif data_type == "int":
                    prop_value.value_int = int(value) if value else None
                elif data_type == "bool":
                    prop_value.value_bool = bool(value) if value is not None else None

                prop_value.updated_at = datetime.utcnow()
                prop_value.updated_by_actor_type = current_user.user_type
                prop_value.updated_by_actor_id = current_user.id
                prop_value.updated_by_actor_display = current_user.name

            # Update asset model and serial if available
            device_info = probe_result.get("device", {})
            if device_info.get("model") and device_info["model"] != asset.model:
                asset.model = device_info["model"]
            if device_info.get("serialNumber") and device_info["serialNumber"] != asset.serial_number:
                asset.serial_number = device_info["serialNumber"]

            # Update camera count
            cameras_info = probe_result.get("cameras", {})
            if cameras_info.get("total") is not None:
                update_property("camera_count_connected", cameras_info["total"], "int")

            # Update LAN IP from network info (filter PoE IPs)
            # Note: lan_ips comes from ISAPI /System/Network/interfaces
            # If ISAPI fails, hybrid_probe falls back to camera IPs (which is wrong)
            network_info = probe_result.get("network", {})
            lan_ips = network_info.get("lan_ips", [])
            logger.info(f"[probe-and-save] Received lan_ips from probe: {lan_ips}")
            if lan_ips:
                # Filter out PoE network IPs (192.168.254.*)
                filtered_ips = [ip for ip in lan_ips if not ip.startswith("192.168.254.")]
                lan_ip = filtered_ips[0] if filtered_ips else lan_ips[0]
                update_property("lan_ip_address", lan_ip, "string")
                logger.info(f"[probe-and-save] Saved LAN IP: {lan_ip}")

            # Update NVR disks with S.M.A.R.T. data
            storage_info = probe_result.get("storage", {})
            probe_disks = storage_info.get("disks", [])

            if probe_disks:
                logger.info(f"[probe-and-save] Processing {len(probe_disks)} disks from probe...")

                # Step 1: Clean up duplicate disks (keep newest by updated_at)
                # Group existing disks by serial number
                existing_disks = db.query(NVRDisk).filter(
                    NVRDisk.asset_id == asset_id
                ).order_by(NVRDisk.updated_at.desc()).all()

                # Find and delete duplicates (same serial number)
                seen_serials = set()
                duplicates_to_delete = []
                for disk in existing_disks:
                    if disk.serial_number:
                        serial_key = disk.serial_number.strip().upper()
                        if serial_key in seen_serials:
                            duplicates_to_delete.append(disk)
                            logger.info(f"[probe-and-save] Marking duplicate disk for deletion: id={disk.id}, serial={disk.serial_number}")
                        else:
                            seen_serials.add(serial_key)

                # Delete duplicates
                for dup in duplicates_to_delete:
                    db.delete(dup)
                if duplicates_to_delete:
                    db.flush()
                    logger.info(f"[probe-and-save] Deleted {len(duplicates_to_delete)} duplicate disks")

                # Step 2: Refresh existing disks list after cleanup
                existing_disks = db.query(NVRDisk).filter(
                    NVRDisk.asset_id == asset_id
                ).all()

                # Create lookup maps - SERIAL NUMBER is the primary key for matching
                # Normalize serial numbers to uppercase for consistent matching
                existing_by_serial = {}
                for d in existing_disks:
                    if d.serial_number:
                        key = d.serial_number.strip().upper()
                        existing_by_serial[key] = d

                # Also create slot lookup as fallback (for disks without serial)
                existing_by_slot = {d.slot_number: d for d in existing_disks if d.slot_number is not None}

                # Track which disks we've updated (to avoid double updates)
                updated_disk_ids = set()

                for probe_disk in probe_disks:
                    slot = probe_disk.get("slot")
                    serial = probe_disk.get("serial")
                    # Use capacity_nominal_tb (commercial size) or calculate from capacity_mb
                    capacity_tb = probe_disk.get("capacity_nominal_tb", 0)
                    if not capacity_tb:
                        capacity_mb = probe_disk.get("capacity_mb", 0)
                        capacity_tb = round(capacity_mb / (1024 * 1024), 2) if capacity_mb else 0

                    # S.M.A.R.T. data (snake_case from hybrid_probe.py)
                    working_hours = probe_disk.get("working_hours")
                    temperature = probe_disk.get("temperature")
                    smart_status = probe_disk.get("smart_status")

                    # Normalize status with SMART-aware logic (matches frontend normalizeProbeStatus)
                    # Priority: SMART status > working hours threshold > raw probe status
                    if smart_status == "Fail":
                        disk_status = "error"
                    elif smart_status == "Warning":
                        disk_status = "warning"
                    elif working_hours is not None and working_hours > 50000:
                        # Disk age warning: > 50,000 hours (~5.7 years)
                        disk_status = "warning"
                    else:
                        # Fallback to raw probe status
                        raw_status = probe_disk.get("status", "unknown")
                        status_lower = raw_status.lower() if raw_status else "unknown"
                        if status_lower in ("ok", "healthy", "normal"):
                            disk_status = "ok"
                        elif "error" in status_lower or "fail" in status_lower:
                            disk_status = "error"
                        elif "warning" in status_lower or "degraded" in status_lower:
                            disk_status = "warning"
                        else:
                            disk_status = "unknown"

                    # Find existing disk - SERIAL NUMBER has priority over slot
                    disk = None
                    if serial:
                        serial_key = serial.strip().upper()
                        disk = existing_by_serial.get(serial_key)

                    # Fallback to slot if no serial match and slot is valid
                    if not disk and slot is not None:
                        disk = existing_by_slot.get(slot)
                        # But only if this disk wasn't already matched by serial
                        if disk and disk.id in updated_disk_ids:
                            disk = None

                    if disk:
                        # Track SMART data changes for audit log
                        smart_changes = []

                        # Check if temperature changed
                        if temperature != disk.temperature:
                            if temperature is not None and disk.temperature is not None:
                                # Both have values - show change
                                smart_changes.append(f"Temperature: {disk.temperature}\u00b0C \u2192 {temperature}\u00b0C")
                            elif temperature is not None and disk.temperature is None:
                                # New data available
                                smart_changes.append(f"Temperature: {temperature}\u00b0C (new)")
                            elif temperature is None and disk.temperature is not None:
                                # Data became unavailable (SMART not supported on new firmware?)
                                smart_changes.append(f"Temperature: {disk.temperature}\u00b0C \u2192 N/A (SMART unavailable)")

                        # Check if working hours changed
                        if working_hours != disk.working_hours:
                            if working_hours is not None and disk.working_hours is not None:
                                smart_changes.append(f"Working hours: {disk.working_hours}h \u2192 {working_hours}h")
                            elif working_hours is not None and disk.working_hours is None:
                                smart_changes.append(f"Working hours: {working_hours}h (new)")
                            elif working_hours is None and disk.working_hours is not None:
                                smart_changes.append(f"Working hours: {disk.working_hours}h \u2192 N/A (SMART unavailable)")

                        # Check if SMART status changed
                        if smart_status != disk.smart_status:
                            if smart_status is not None and disk.smart_status is not None:
                                smart_changes.append(f"SMART status: {disk.smart_status} \u2192 {smart_status}")
                            elif smart_status is not None and disk.smart_status is None:
                                smart_changes.append(f"SMART status: {smart_status} (new)")
                            elif smart_status is None and disk.smart_status is not None:
                                smart_changes.append(f"SMART status: {disk.smart_status} \u2192 N/A (SMART unavailable)")

                        # Update existing disk
                        disk.slot_number = slot  # Update slot in case it changed
                        disk.status = disk_status
                        disk.working_hours = working_hours
                        disk.temperature = temperature
                        disk.smart_status = smart_status
                        if serial:
                            disk.serial_number = serial
                        if capacity_tb > 0:
                            disk.capacity_tb = capacity_tb
                        disk.updated_at = datetime.utcnow()
                        updated_disk_ids.add(disk.id)
                        logger.info(f"[probe-and-save] Updated disk id={disk.id}, slot={slot}, serial={serial}: status={disk_status}, hours={working_hours}")

                        # Create audit event if SMART data changed
                        if smart_changes:
                            disk_label = f"Disk #{slot}" if slot else f"Disk {serial}"
                            changes_text = ", ".join(smart_changes)

                            smart_event = AssetEvent(
                                asset_id=asset_id,
                                event_type="disk_smart_updated",
                                details=f"{disk_label} SMART data updated by system probe: {changes_text}",
                                actor_type="system",
                                actor_id=None,
                                actor_display="System Integration"
                            )
                            db.add(smart_event)
                            logger.info(f"[probe-and-save] Created SMART update event for disk {disk_label}: {changes_text}")
                    else:
                        # Создаём новый диск - требуется либо serial, либо slot
                        if serial or slot is not None:
                            new_disk = NVRDisk(
                                asset_id=asset_id,
                                slot_number=slot,
                                serial_number=serial,  # Может быть None если SDK не вернул
                                capacity_tb=capacity_tb if capacity_tb > 0 else 1.0,
                                install_date=date_type.today(),
                                status=disk_status,
                                working_hours=working_hours,
                                temperature=temperature,
                                smart_status=smart_status
                            )
                            db.add(new_disk)
                            db.flush()  # Получаем ID для audit event

                            # Создаём audit event для автоматического обнаружения диска
                            disk_label = f"Disk #{slot}" if slot is not None else f"Disk {serial}"
                            capacity_str = f"{float(capacity_tb) * 1024:.0f} GB" if capacity_tb else "unknown capacity"
                            serial_info = f"Serial: {serial}" if serial else "Serial: N/A"

                            disk_event = AssetEvent(
                                asset_id=asset_id,
                                event_type="disk_added",
                                details=f"{disk_label} auto-discovered by system probe ({serial_info}, {capacity_str})",
                                actor_type="system",
                                actor_id=None,
                                actor_display="System Integration"
                            )
                            db.add(disk_event)

                            logger.info(f"[probe-and-save] Created new disk slot={slot}, serial={serial}: status={disk_status}")
                        else:
                            logger.warning(f"[probe-and-save] Skipping disk without slot or serial")

            # Calculate and save health status from probe result
            # Note: ignored channels were already excluded from health calculation
            # in the probe_device() call via SDK library
            health_status, health_issues = calculate_health_status(probe_result, ignored_channels)
            asset.health_status = health_status
            asset.health_issues = health_issues if health_issues else None
            asset.last_probe_at = datetime.utcnow()
            asset.last_probe_result = probe_result  # Save full probe result for channel status display
            logger.info(f"[probe-and-save] Health status: {health_status}, issues: {health_issues}")

            # Create audit event with health status info
            # Note: Only active (non-ignored) channels are included in health calculation
            event_details = f"Device probed and data refreshed by {current_user.name}. Status: {health_status.upper()}"
            if health_issues:
                # Filter out ignored channel issues from audit log details
                non_ignored_issues = []
                for issue in health_issues:
                    # Skip issues related to ignored channels (they don't affect overall health)
                    if "CAMERAS_OFFLINE" in issue or "NO_RECORDING_24H" in issue:
                        # These issues already exclude ignored channels from calculate_health_status
                        non_ignored_issues.append(issue)
                    elif "HDD" in issue or "DISK" in issue:
                        non_ignored_issues.append(issue)

                if non_ignored_issues:
                    event_details += f". Issues: {', '.join(non_ignored_issues)}"

            if ignored_channels:
                event_details += f". {len(ignored_channels)} channel(s) excluded from monitoring (marked as ignored)"

            event = AssetEvent(
                asset_id=asset_id,
                event_type="probe_refresh",
                details=event_details,
                actor_type=current_user.user_type,
                actor_id=current_user.id,
                actor_display=current_user.name
            )
            db.add(event)

            db.commit()
            logger.info(f"[probe-and-save] Data saved successfully for asset_id={asset_id}")

        except Exception as e:
            logger.error(f"[probe-and-save] Failed to save data: {e}")
            db.rollback()
            # Still return probe result even if save failed
            probe_result["meta"]["errors"]["save"] = str(e)

    return probe_result
