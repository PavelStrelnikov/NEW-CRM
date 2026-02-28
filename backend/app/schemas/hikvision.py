"""
Pydantic schemas for Hikvision device probing.
Supports hybrid SDK + ISAPI approach via hik_monitor_lib.
"""
from pydantic import BaseModel, Field
from typing import Optional


class HikvisionProbeRequest(BaseModel):
    """Request to probe a Hikvision device.

    Ports:
    - port: Service Port for SDK connection (default 8000)
    - web_port: Web Port for ISAPI/HTTP(S) (default 80, for snapshots)
    """
    host: str = Field(..., description="IP address or hostname (WAN IP)")
    port: int = Field(default=8000, description="Service Port for SDK (default 8000)")
    web_port: int = Field(default=80, description="Web Port for ISAPI (default 80)")
    username: str = Field(..., description="Device username")
    password: str = Field(..., description="Device password")
    proto: str = Field(default="http", pattern="^(http|https)$", description="Protocol for ISAPI")
    timeout: float = Field(default=15.0, ge=1.0, le=60.0, description="Connection timeout")


class DeviceInfoResponse(BaseModel):
    """Device information."""
    model: Optional[str] = None
    deviceName: Optional[str] = None
    serialNumber: Optional[str] = None
    firmwareVersion: Optional[str] = None
    macAddress: Optional[str] = None
    maxChannels: Optional[int] = None


class DiskInfoResponse(BaseModel):
    """Storage disk information with S.M.A.R.T. data."""
    id: str
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    capacity_mb: Optional[int] = None
    free_mb: Optional[int] = None
    capacity_nominal_tb: Optional[int] = Field(default=None, description="Commercial disk size in TB (e.g., 6)")
    capacity_raw_tb: Optional[float] = Field(default=None, description="Raw disk capacity in TB (e.g., 5.46)")
    free_human: Optional[str] = None
    used_percent: Optional[float] = None
    # S.M.A.R.T. data from hik_monitor_lib
    working_hours: Optional[int] = Field(default=None, description="Power-on hours from S.M.A.R.T.")
    temperature: Optional[int] = Field(default=None, description="Temperature in Celsius")
    smart_status: Optional[str] = Field(default=None, description="S.M.A.R.T. status: Pass/Fail/Warning")
    is_critical: Optional[bool] = Field(default=None, description="HDD requires attention/replacement")
    model: Optional[str] = Field(default=None, description="HDD model name (legacy, same as serial)")
    # Explicit slot and serial fields for clarity
    slot: Optional[int] = Field(default=None, description="Slot number (1-based)")
    serial: Optional[str] = Field(default=None, description="HDD serial number (e.g., WD-WCC4E...)")


class StorageInfoResponse(BaseModel):
    """Storage summary."""
    disk_count: int = 0
    disks: list[DiskInfoResponse] = []


class ChannelDetailResponse(BaseModel):
    """Detailed channel/camera information."""
    channel_number: int = Field(..., description="Display number (D1=1, D2=2, etc.)")
    name: Optional[str] = Field(default=None, description="Channel name from NVR")
    ip_address: Optional[str] = Field(default=None, description="Camera IP address")
    protocol: Optional[str] = Field(default=None, description="Connection protocol")
    is_configured: bool = Field(default=False, description="Channel has camera configured")
    is_online: bool = Field(default=False, description="Camera is online")
    # Recording status (24h check)
    has_recording_24h: bool = Field(default=False, description="Has recordings in last 24 hours")
    recording_files_count: Optional[int] = Field(default=None, description="Number of recording files")
    recording_size_gb: Optional[float] = Field(default=None, description="Recording size in GB")


class CameraInfoResponse(BaseModel):
    """Camera summary with recording health."""
    total: int = 0
    online: int = 0
    offline: int = 0
    # Recording summary
    recording_ok: int = Field(default=0, description="Channels with recordings in last 24h")
    recording_missing: int = Field(default=0, description="Configured channels without recordings")
    # Detailed channel list
    channels: list[ChannelDetailResponse] = Field(default=[], description="Detailed channel information")


class NetworkInfoResponse(BaseModel):
    """Network configuration."""
    lan_ips: list[str] = []


class ProbeMetadataResponse(BaseModel):
    """Probe operation metadata with time drift info."""
    success: bool = False
    errors: dict[str, str] = {}
    used_proto: Optional[str] = None
    base_url: Optional[str] = None
    # Time drift detection from hik_monitor_lib
    time_drift_seconds: Optional[int] = Field(default=None, description="Time diff between NVR and server (seconds)")
    nvr_time: Optional[str] = Field(default=None, description="NVR time as ISO string")
    time_sync_status: Optional[str] = Field(default=None, description="Time status: ok/drift/synced/error")


class HikvisionProbeResponse(BaseModel):
    """Complete probe result."""
    device: DeviceInfoResponse
    network: NetworkInfoResponse
    storage: StorageInfoResponse
    cameras: CameraInfoResponse
    meta: ProbeMetadataResponse


# ==================== ISAPI / Live View ====================

class ISAPICredentials(BaseModel):
    """ISAPI connection credentials for direct device access."""
    host: str = Field(..., description="Device IP address or hostname")
    web_port: int = Field(..., description="HTTP port (usually 80 or 81)")
    username: str = Field(..., description="Device username")
    password: str = Field(..., description="Device password")
    protocol: str = Field(default="http", description="Protocol (http or https)")


class LiveViewUrlResponse(BaseModel):
    """Response containing URLs for live video access."""
    web_url: str = Field(..., description="URL to NVR web interface for live view")
    rtsp_url: str = Field(..., description="RTSP URL for direct stream access")
    rtsp_substream_url: str = Field(..., description="RTSP URL for substream (lower quality, faster)")
    channel: int
    channel_name: str


# ==================== Схемы для синхронизации времени ====================

class TimeCheckResponse(BaseModel):
    """Ответ проверки времени устройства."""
    device_time: str = Field(..., description="Время на устройстве (ISO формат)")
    server_time: str = Field(..., description="Время сервера (ISO формат)")
    drift_seconds: int = Field(..., description="Разница в секундах (положительное = устройство впереди)")
    is_synced: bool = Field(..., description="Время синхронизировано (разница < 60 сек)")
    status: str = Field(..., description="Статус: ok, drift, error")


class TimeSyncResponse(BaseModel):
    """Ответ синхронизации времени устройства."""
    success: bool = Field(..., description="Успешность синхронизации")
    message: str = Field(..., description="Сообщение о результате")
    device_time_before: Optional[str] = Field(default=None, description="Время до синхронизации")
    device_time_after: Optional[str] = Field(default=None, description="Время после синхронизации")
    drift_before: Optional[int] = Field(default=None, description="Разница до синхронизации")
    drift_after: Optional[int] = Field(default=None, description="Разница после синхронизации")
