# Hikvision Monitor Library - Integration Guide

## Overview

`hik_monitor_lib` is a professional Python library for monitoring Hikvision NVR/DVR devices.
Designed as a **Black Box** for CRM integration - send IP/credentials, receive structured JSON data.

**Supported Platforms:** Windows (x64), Linux (x64), WSL

---

## Installation

### 1. Copy Library

```
your_project/
├── hik_monitor_lib/           # Copy entire folder
│   ├── __init__.py
│   ├── core.py
│   ├── diagnostics.py
│   ├── schemas.py
│   ├── lib/
│   │   ├── win64/lib/         # Windows SDK
│   │   └── linux64/lib/       # Linux SDK
│   └── ...
├── your_crm_code.py
└── requirements.txt
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Linux: Set LD_LIBRARY_PATH

```bash
export LD_LIBRARY_PATH=/path/to/hik_monitor_lib/lib/linux64/lib:$LD_LIBRARY_PATH
```

---

## Quick Start (10 Lines)

```python
import asyncio
from hik_monitor_lib import HikvisionManager

async def get_device_data(ip, port, username, password):
    async with HikvisionManager() as manager:
        await manager.connect(ip, port, username, password)
        data = await manager.get_sync_data()
        return data.to_dict()  # Returns JSON-serializable dict

# Usage
result = asyncio.run(get_device_data("192.168.1.64", 8000, "admin", "password"))
```

---

## API Reference

### HikvisionManager

Main class for device communication.

#### Constructor

```python
manager = HikvisionManager(sdk_path=None)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| sdk_path | str | None | Path to SDK folder. Auto-detected if None. |

#### Connection Methods

```python
# Async (recommended)
await manager.connect(ip, port, username, password)
await manager.disconnect()

# Sync
manager.connect_sync(ip, port, username, password)
manager.disconnect_sync()
```

#### Context Manager

```python
# Recommended usage - auto-disconnect on exit
async with HikvisionManager() as manager:
    await manager.connect(...)
    # ... work with device
# Connection automatically closed
```

---

### get_sync_data() - Main Method

**The primary method for CRM integration.** Returns all device data in one call.

```python
data = await manager.get_sync_data()
```

#### Returns: SyncData

```python
@dataclass
class SyncData:
    device: DeviceInfo          # Device info (serial, type)
    hdd_list: List[HddInfo]     # HDD status with SMART data
    channels: List[ChannelInfo] # Channel status (D1-D16)
    recordings: List[RecordingInfo]  # 24h recording check
    health_summary: HealthSummary    # Overall health status
    timestamp: datetime         # Collection time
    time_info: Optional[TimeInfo]    # Device time info
```

#### Output Methods

```python
# As dictionary (for JSON serialization)
json_dict = data.to_dict()

# As JSON string
json_str = data.to_json()
```

#### Example JSON Output

```json
{
  "device": {
    "serial_number": "DS-7616NI-K2/XXXX",
    "device_type": 16,
    "device_type_name": "NVR",
    "ip_channels": 16,
    "disk_count": 2
  },
  "hdd_list": [
    {
      "number": 1,
      "capacity_gb": 3726.0,
      "free_space_gb": 1245.0,
      "status": "Normal",
      "smart_status": "Pass",
      "power_on_hours": 58930,
      "temperature": 38,
      "is_critical": false
    }
  ],
  "channels": [
    {
      "channel_number": 33,
      "display_number": 1,
      "channel_type": "ip",
      "is_configured": true,
      "is_online": true,
      "ip_address": "192.168.1.100"
    }
  ],
  "recordings": [
    {
      "display_number": 1,
      "has_recordings": true,
      "files_count": 24
    }
  ],
  "health_summary": {
    "total_hdd": 2,
    "critical_hdd": 0,
    "online_channels": 14,
    "offline_channels": 2,
    "overall_status": "warning"
  },
  "timestamp": "2024-01-16T12:30:45"
}
```

---

### HDD Information

#### Data Structure: HddInfo

| Field | Type | Description |
|-------|------|-------------|
| number | int | Disk number (1-based) |
| capacity_gb | float | Total capacity in GB |
| free_space_gb | float | Free space in GB |
| used_percent | float | Usage percentage |
| status | str | Status text (Normal, Error, etc.) |
| status_code | int | SDK status code |
| smart_status | str | S.M.A.R.T. status (Pass/Fail/Warning) |
| power_on_hours | int | **Power-on hours from SMART** |
| temperature | int | Temperature in Celsius |
| is_critical | bool | True if requires replacement |

#### Critical HDD Detection

```python
for hdd in data.hdd_list:
    if hdd.is_critical:
        print(f"HDD {hdd.number} requires replacement!")
    if hdd.power_on_hours > 50000:
        print(f"HDD {hdd.number} has high usage: {hdd.power_on_hours} hours")
```

---

### Channel Information

#### Channel Numbering

| Display | SDK Channel | Type |
|---------|-------------|------|
| D1 | 33 | IP Camera |
| D2 | 34 | IP Camera |
| ... | ... | ... |
| D16 | 48 | IP Camera |
| A1 | 1 | Analog |

#### Data Structure: ChannelInfo

| Field | Type | Description |
|-------|------|-------------|
| channel_number | int | SDK internal number (33+) |
| display_number | int | User-facing number (1-16) |
| channel_type | str | "ip" or "analog" |
| is_configured | bool | True if camera configured |
| is_online | bool | True if camera online |
| ip_address | str | Camera IP (for IP type) |
| offline_reason | str | Reason for offline status |

#### Check Offline Cameras

```python
for ch in data.channels:
    if ch.is_configured and not ch.is_online:
        print(f"D{ch.display_number} OFFLINE: {ch.offline_reason}")
```

---

### Snapshot Capture

Capture JPEG images from cameras.

```python
# Single channel
success, jpeg_data, error = await manager.get_snapshot(1)  # D1
if success:
    with open("snapshot.jpg", "wb") as f:
        f.write(jpeg_data)

# Multiple channels
results = await manager.get_all_snapshots([1, 2, 3])  # D1, D2, D3
for channel, (success, data, error) in results.items():
    if success:
        with open(f"D{channel}.jpg", "wb") as f:
            f.write(data)
```

---

### Time Synchronization

#### Get Device Time

```python
time_info = await manager.get_time_info()
print(f"Device time: {time_info.device_time}")
print(f"Server time: {time_info.server_time}")
print(f"Drift: {time_info.drift_seconds} seconds")
print(f"Status: {time_info.sync_status}")  # ok / drift / synced / error
```

#### Set Device Time

```python
# Sync to server time
await manager.set_time()

# Set specific time
from datetime import datetime
await manager.set_time(datetime(2024, 1, 15, 12, 0, 0))
```

#### Auto-Sync if Drift > Threshold

```python
was_synced, time_info = await manager.sync_time(threshold=30)
if was_synced:
    print(f"Time synchronized! New drift: {time_info.drift_seconds}s")
```

---

## CRM Integration Example

### Simple Function for CRM

```python
import asyncio
from hik_monitor_lib import HikvisionManager

async def check_device(ip: str, port: int, username: str, password: str) -> dict:
    """
    Black-box function for CRM integration.

    Args:
        ip: Device IP address
        port: Device port (usually 8000)
        username: Login username
        password: Login password

    Returns:
        Dictionary with all device data, or error information
    """
    try:
        async with HikvisionManager() as manager:
            await manager.connect(ip, port, username, password)
            data = await manager.get_sync_data()
            return {
                "success": True,
                "data": data.to_dict()
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# Usage from CRM
result = asyncio.run(check_device("192.168.1.64", 8000, "admin", "pass"))
if result["success"]:
    device_data = result["data"]
    # Store in database, send alerts, etc.
```

### Batch Processing

```python
import asyncio
from hik_monitor_lib import HikvisionManager

async def check_multiple_devices(devices: list) -> list:
    """Check multiple devices with concurrency limit."""
    semaphore = asyncio.Semaphore(5)  # Max 5 concurrent

    async def check_one(device):
        async with semaphore:
            try:
                async with HikvisionManager() as manager:
                    await manager.connect(
                        device["ip"],
                        device["port"],
                        device["username"],
                        device["password"]
                    )
                    data = await manager.get_sync_data()
                    return {"ip": device["ip"], "success": True, "data": data.to_dict()}
            except Exception as e:
                return {"ip": device["ip"], "success": False, "error": str(e)}

    tasks = [check_one(d) for d in devices]
    return await asyncio.gather(*tasks)
```

---

## Error Handling

### Exception Types

```python
from hik_monitor_lib import (
    HikvisionError,          # Base exception
    SdkNotFoundError,        # SDK DLL/SO not found
    SdkInitError,            # SDK initialization failed
    DeviceConnectionError,   # Connection failed
    DeviceNotConnectedError, # Not connected to device
)
```

### Example

```python
from hik_monitor_lib import HikvisionManager, DeviceConnectionError

try:
    async with HikvisionManager() as manager:
        await manager.connect(ip, port, user, password)
        data = await manager.get_sync_data()
except DeviceConnectionError as e:
    print(f"Connection failed to {e.ip}:{e.port}")
    print(f"Error code: {e.error_code}, Message: {e.message}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

---

## Health Status Interpretation

### overall_status Values

| Status | Meaning | Action |
|--------|---------|--------|
| healthy | All OK | None needed |
| warning | Minor issues | Check offline channels, recordings |
| critical | Serious issues | Check failing HDDs |

### Automated Alerts

```python
data = await manager.get_sync_data()
hs = data.health_summary

alerts = []

if hs.critical_hdd > 0:
    alerts.append(f"CRITICAL: {hs.critical_hdd} HDD(s) failing!")

if hs.offline_channels > 0:
    alerts.append(f"WARNING: {hs.offline_channels} camera(s) offline")

for hdd in data.hdd_list:
    if hdd.power_on_hours > 50000:
        alerts.append(f"HDD {hdd.number}: {hdd.power_on_hours} hours - consider replacement")

# Send alerts to CRM notification system
```

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial release: HDD SMART, channels D1-D16, 24h recordings |
| 1.1.0 | Added time synchronization via ISAPI |
| 1.2.0 | Added snapshot capture via SDK |

---

## Support

- Issues: Check SDK error codes in `hik_monitor_lib/exceptions.py`
- Logs: Enable debug logging with `logging.basicConfig(level=logging.DEBUG)`
