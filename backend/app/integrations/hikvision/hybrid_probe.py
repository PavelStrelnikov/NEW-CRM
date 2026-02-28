"""
Hybrid Hikvision Probe Module
==============================
Combines SDK (deep diagnostics) + ISAPI (time, snapshots) for comprehensive device probing.
Uses hik_monitor_lib for cross-platform SDK operations.
"""

import math
import os
import sys
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


# Commercial HDD sizes in TB (standard market values)
COMMERCIAL_HDD_SIZES_TB = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20]


def round_to_commercial_size(capacity_tb: float) -> int:
    """
    Round disk capacity to nearest commercial HDD size.

    Commercial sizes: 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20 TB
    Always rounds UP to match marketing labels (5.46 TB disk is sold as 6 TB).

    Args:
        capacity_tb: Raw capacity in TB (e.g., 5.46)

    Returns:
        Commercial size in TB (e.g., 6)
    """
    if capacity_tb <= 0:
        return 0

    # Find the smallest commercial size >= capacity_tb
    for size in COMMERCIAL_HDD_SIZES_TB:
        if capacity_tb <= size:
            return size

    # If larger than all commercial sizes, round up to nearest even number
    return math.ceil(capacity_tb / 2) * 2


def get_sdk_path() -> str:
    """
    Get cross-platform SDK library path.

    Returns:
        Path to the SDK library directory (win64/lib or linux64/lib)
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    hik_lib_base = os.path.join(base_dir, "..", "hik_monitor_lib", "lib")

    if sys.platform == "win32":
        sdk_path = os.path.join(hik_lib_base, "win64", "lib")
    else:  # linux
        sdk_path = os.path.join(hik_lib_base, "linux64", "lib")

    # Normalize path for the current OS
    sdk_path = os.path.normpath(sdk_path)
    logger.info(f"Using SDK path: {sdk_path} (platform: {sys.platform})")

    return sdk_path


def convert_sync_data_to_response(
    sync_data: Any,
    time_info: Optional[Any] = None,
    errors: Optional[Dict[str, str]] = None,
    nvr_lan_ips: Optional[List[str]] = None,
    ignored_channels: Optional[set[int]] = None
) -> Dict[str, Any]:
    """
    Convert hik_monitor_lib SyncData to API response format.

    Args:
        sync_data: SyncData from HikvisionManager.get_sync_data()
        time_info: TimeInfo from HikvisionManager.get_time_info()
        errors: Dictionary of errors that occurred during probing
        nvr_lan_ips: List of NVR's own LAN IPs (from network interfaces, not cameras)
        ignored_channels: Set of channel numbers to exclude from counts (e.g., {12, 13, 14, 15, 16})

    Returns:
        Dictionary matching HikvisionProbeResponse schema
    """
    if errors is None:
        errors = {}

    if ignored_channels is None:
        ignored_channels = set()

    # Device info - prefer ISAPI model_name, fallback to SDK device_type_name
    device = {
        "model": (
            sync_data.device.model_name or sync_data.device.device_type_name
            if sync_data.device else None
        ),
        "deviceName": sync_data.device.device_name if sync_data.device else None,
        "serialNumber": sync_data.device.serial_number if sync_data.device else None,
        "firmwareVersion": sync_data.device.firmware_version if sync_data.device else None,
        "macAddress": sync_data.device.mac_address if sync_data.device else None,
        "maxChannels": (
            (sync_data.device.analog_channels + sync_data.device.ip_channels)
            if sync_data.device else 0
        ),
    }

    # Storage info with S.M.A.R.T.
    disks: List[Dict[str, Any]] = []
    for hdd in (sync_data.hdd_list or []):
        raw_capacity_tb = hdd.capacity_gb / 1024 if hdd.capacity_gb else 0
        commercial_tb = round_to_commercial_size(raw_capacity_tb)
        free_gb = hdd.free_space_gb or 0

        disks.append({
            "id": str(hdd.number),
            "name": f"HDD {hdd.number}",
            "type": hdd.hdd_type or "Unknown",
            "status": hdd.status or "Unknown",
            "capacity_mb": int(hdd.capacity_gb * 1024) if hdd.capacity_gb else None,
            "free_mb": int(free_gb * 1024) if free_gb else None,
            "capacity_nominal_tb": commercial_tb,  # Rounded to commercial size (6 TB, not 5.46)
            "capacity_raw_tb": round(raw_capacity_tb, 2),  # Keep raw value for reference
            "free_human": f"{free_gb:.1f} GB" if free_gb else None,
            "used_percent": hdd.used_percent,
            "working_hours": hdd.power_on_hours,  # KEY: Power-on hours from S.M.A.R.T.!
            "temperature": hdd.temperature,
            "smart_status": hdd.smart_status,
            "is_critical": hdd.is_critical,
            "model": hdd.model,  # Legacy: HDD serial (confusing SDK naming)
            # Explicit fields for frontend clarity
            "slot": hdd.number,  # Slot number (1-based)
            "serial": hdd.model,  # HDD serial number (SDK uses "model" for serial)
        })

    storage = {
        "disk_count": len(disks),
        "disks": disks,
    }

    # Cameras (channels) with detailed info and recording status
    channels = sync_data.channels or []
    recordings = sync_data.recordings or []

    # Filter out ignored channels when counting (health_summary already excludes them)
    configured = [c for c in channels if c.is_configured and c.display_number not in ignored_channels]
    online = [c for c in configured if c.is_online]

    # Build recording lookup by display_number
    recording_by_channel = {r.display_number: r for r in recordings}

    # Build detailed channel list
    channel_details: List[Dict[str, Any]] = []
    recording_ok_count = 0
    recording_missing_count = 0

    for ch in channels:
        rec = recording_by_channel.get(ch.display_number)
        has_recording = rec.has_recordings if rec else False

        # Count recording status for configured, non-ignored channels
        if ch.is_configured and ch.display_number not in ignored_channels:
            if has_recording:
                recording_ok_count += 1
            else:
                recording_missing_count += 1

        channel_details.append({
            "channel_number": ch.display_number,
            "name": f"D{ch.display_number}",  # Default name, can be enhanced later
            "ip_address": ch.ip_address or None,
            "protocol": ch.protocol or None,
            "is_configured": ch.is_configured,
            "is_online": ch.is_online,
            "has_recording_24h": has_recording,
            "recording_files_count": rec.files_count if rec else None,
            "recording_size_gb": rec.total_size_gb if rec else None,
        })

    cameras = {
        "total": len(configured),
        "online": len(online),
        "offline": len(configured) - len(online),
        "recording_ok": recording_ok_count,
        "recording_missing": recording_missing_count,
        "channels": channel_details,
    }

    # Network - Use NVR's own LAN IPs (from network interfaces), not camera IPs
    # The nvr_lan_ips are fetched via ISAPI /System/Network/interfaces
    # and filtered to exclude PoE internal network (192.168.254.x)
    if nvr_lan_ips:
        lan_ips = nvr_lan_ips
        logger.debug(f"Using NVR network interface IPs: {lan_ips}")
    else:
        # Fallback: extract unique IPs from channels (cameras), excluding PoE network
        # This is not ideal but better than nothing if ISAPI fails
        camera_ips = list(set(c.ip_address for c in channels if c.ip_address))
        lan_ips = [ip for ip in camera_ips if not ip.startswith("192.168.254.")]
        logger.warning(f"ISAPI network interfaces unavailable, using filtered camera IPs: {lan_ips}")

    network = {
        "lan_ips": lan_ips,
    }

    # Health summary from SDK (includes ignored channels logic)
    health_summary = None
    if sync_data.health_summary:
        health_summary = {
            "total_hdd": sync_data.health_summary.total_hdd,
            "healthy_hdd": sync_data.health_summary.healthy_hdd,
            "critical_hdd": sync_data.health_summary.critical_hdd,
            "total_channels": sync_data.health_summary.total_channels,
            "configured_channels": sync_data.health_summary.configured_channels,
            "online_channels": sync_data.health_summary.online_channels,
            "offline_channels": sync_data.health_summary.offline_channels,
            "unconfigured_channels": sync_data.health_summary.unconfigured_channels,
            "channels_with_recordings": sync_data.health_summary.channels_with_recordings,
            "overall_status": sync_data.health_summary.overall_status,  # KEY: healthy/warning/critical
        }

    # Meta with time drift
    meta = {
        "success": True,
        "errors": errors,
        "used_proto": "sdk",
        "base_url": None,
        "time_drift_seconds": time_info.drift_seconds if time_info else None,
        "nvr_time": time_info.device_time.isoformat() if time_info and time_info.device_time else None,
        "time_sync_status": time_info.sync_status if time_info else None,
    }

    return {
        "device": device,
        "network": network,
        "storage": storage,
        "cameras": cameras,
        "health_summary": health_summary,  # Add health_summary to response
        "meta": meta,
    }


def convert_error_to_response(error_message: str, error_code: Optional[int] = None) -> Dict[str, Any]:
    """
    Create error response when probing fails.

    Args:
        error_message: Human-readable error message
        error_code: SDK error code if available

    Returns:
        Dictionary matching HikvisionProbeResponse schema with error info
    """
    errors = {"connection": error_message}
    if error_code is not None:
        errors["sdk_error_code"] = str(error_code)

    return {
        "device": {
            "model": None,
            "deviceName": None,
            "serialNumber": None,
            "firmwareVersion": None,
            "macAddress": None,
            "maxChannels": None,
        },
        "network": {"lan_ips": []},
        "storage": {"disk_count": 0, "disks": []},
        "cameras": {"total": 0, "online": 0, "offline": 0, "recording_ok": 0, "recording_missing": 0, "channels": []},
        "health_summary": None,  # No health data on error
        "meta": {
            "success": False,
            "errors": errors,
            "used_proto": "sdk",
            "base_url": None,
            "time_drift_seconds": None,
            "nvr_time": None,
            "time_sync_status": None,
        },
    }
