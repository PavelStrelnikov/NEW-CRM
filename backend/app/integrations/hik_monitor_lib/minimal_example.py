#!/usr/bin/env python3
"""
Minimal Example - Hikvision Monitor Library
============================================
Demonstrates basic library usage in ~10 lines of code.

Usage:
    python minimal_example.py

The script will prompt for device credentials interactively.
"""

import asyncio
import json
import sys
import getpass
from hik_monitor_lib import HikvisionManager


async def get_device_data(ip: str, port: int, username: str, password: str) -> dict:
    """
    Get all device data as a dictionary.

    This is the simplest "Black Box" integration - send credentials,
    receive complete JSON data about the device.

    Args:
        ip: Device IP address
        port: Device port (usually 8000)
        username: Login username
        password: Login password

    Returns:
        Dictionary with all device data (JSON-serializable)
    """
    async with HikvisionManager() as manager:
        await manager.connect(ip, port, username, password)
        data = await manager.get_sync_data()
        return data.to_dict()


def main():
    """Interactive example - prompts for credentials."""
    print("=" * 50)
    print("  Hikvision Monitor Library - Minimal Example")
    print("=" * 50)
    print()

    # Get connection parameters
    ip = input("Device IP: ").strip()
    port = input("Port [8000]: ").strip() or "8000"
    username = input("Username: ").strip()

    # Secure password input
    if sys.stdin.isatty():
        password = getpass.getpass("Password: ")
    else:
        password = input("Password: ").strip()

    print()
    print("Connecting...")

    try:
        # Get all device data
        result = asyncio.run(get_device_data(ip, int(port), username, password))

        # Pretty print JSON
        print()
        print("Device Data:")
        print("-" * 50)
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))

        # Show summary
        print()
        print("Summary:")
        print("-" * 50)
        print(f"  Serial: {result['device']['serial_number']}")
        print(f"  Type: {result['device']['device_type_name']}")
        print(f"  HDDs: {result['health_summary']['total_hdd']}")
        print(f"  Channels Online: {result['health_summary']['online_channels']}/{result['health_summary']['configured_channels']}")
        print(f"  Status: {result['health_summary']['overall_status'].upper()}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
