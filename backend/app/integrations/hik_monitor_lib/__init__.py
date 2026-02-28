"""
Hikvision Monitor Library
=========================

A professional library for monitoring Hikvision NVR/DVR devices.
Designed for CRM integration with async support and SQLAlchemy models.

Features:
- HDD diagnostics with S.M.A.R.T. status (via ISAPI and Binary SDK)
- Channel status with D-numbering (D1-D16)
- Recording verification (24h check)
- Async/await support
- SQLAlchemy ORM models for data persistence
- Markdown report generation

Quick Start:
    import asyncio
    from hik_monitor_lib import HikvisionManager

    async def main():
        async with HikvisionManager() as manager:
            await manager.connect(ip, port, username, password)
            data = await manager.get_sync_data()
            print(data.to_json())

    asyncio.run(main())

SDK Path:
    By default, the library looks for HCNetSDK.dll in:
    1. lib/ folder next to this package
    2. lib/ folder in current working directory
    3. System PATH

    You can also specify the path explicitly:
        manager = HikvisionManager(sdk_path="C:/path/to/sdk/lib")
"""

__version__ = "1.0.0"
__author__ = "Hikvision Monitor Library"

# Core
from .core import HikvisionManager

# Schemas (dataclasses)
from .schemas import (
    DeviceInfo,
    HddInfo,
    ChannelInfo,
    RecordingInfo,
    HealthSummary,
    SyncData,
    TimeInfo,
    SmartInfo,
    SmartAttribute,
    HDStatus,
    HDType,
    ChannelType,
    DEVICE_TYPES,
    get_device_type_name,
)

# Models (SQLAlchemy ORM)
from .models import (
    Base,
    Device,
    HddStats,
    ChannelStats,
    SyncHistory,
    create_tables,
    drop_tables,
)

# Exceptions
from .exceptions import (
    HikvisionError,
    SdkNotFoundError,
    SdkInitError,
    DeviceConnectionError,
    DeviceNotConnectedError,
    IsapiError,
    ConfigurationError,
    SDK_ERROR_CODES,
    get_sdk_error_message,
)

# Utilities
from .utils import (
    XmlParser,
    MarkdownReportGenerator,
    generate_report,
    format_hours,
    format_bytes,
    format_timestamp,
)

__all__ = [
    # Version
    "__version__",

    # Core
    "HikvisionManager",

    # Schemas
    "DeviceInfo",
    "HddInfo",
    "ChannelInfo",
    "RecordingInfo",
    "HealthSummary",
    "SyncData",
    "TimeInfo",
    "SmartInfo",
    "SmartAttribute",
    "HDStatus",
    "HDType",
    "ChannelType",
    "DEVICE_TYPES",
    "get_device_type_name",

    # Models
    "Base",
    "Device",
    "HddStats",
    "ChannelStats",
    "SyncHistory",
    "create_tables",
    "drop_tables",

    # Exceptions
    "HikvisionError",
    "SdkNotFoundError",
    "SdkInitError",
    "DeviceConnectionError",
    "DeviceNotConnectedError",
    "IsapiError",
    "ConfigurationError",
    "SDK_ERROR_CODES",
    "get_sdk_error_message",

    # Utilities
    "XmlParser",
    "MarkdownReportGenerator",
    "generate_report",
    "format_hours",
    "format_bytes",
    "format_timestamp",
]
