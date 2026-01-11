"""
Test script for Assets domain CRUD operations.

This script tests:
- Asset types and property definitions
- Asset CRUD with dynamic properties (EAV pattern)
- Asset events
- NVR disks
- RBAC enforcement

Prerequisites:
1. Server must be running: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
2. Database must have migrations applied: alembic upgrade head
3. At least one client must exist (run test_clients_crud.py first)
"""

import requests
import json
import sys
from typing import Optional
from datetime import date

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "change_me_now"

# Global variables
token: Optional[str] = None
client_id: Optional[str] = None
site_id: Optional[str] = None
location_id: Optional[str] = None
asset_type_id: Optional[str] = None
asset_id: Optional[str] = None
nvr_asset_id: Optional[str] = None
disk_id: Optional[str] = None

# Test statistics
tests_passed = 0
tests_failed = 0


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_response(response: requests.Response, operation: str, expected_status: Optional[int] = None):
    """
    Print response details.

    Returns:
        bool: True if test passed, False otherwise
    """
    global tests_passed, tests_failed

    if expected_status is not None:
        success = response.status_code == expected_status
    else:
        success = response.status_code < 400

    status_icon = "[OK]" if success else "[FAIL]"
    print(f"\n{status_icon} {operation}")
    print(f"Status: {response.status_code}")

    if expected_status is not None:
        print(f"Expected: {expected_status}")

    try:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2, default=str)}")
    except:
        print(f"Response: {response.text}")

    if success:
        tests_passed += 1
    else:
        tests_failed += 1

    return success


def login() -> str:
    """Login and get access token."""
    print_section("AUTHENTICATION")

    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )

        success = print_response(response, "Login as Admin", expected_status=200)

        if success:
            return response.json()["access_token"]
        else:
            print("\n[ERROR] Failed to login")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Cannot connect to server at http://localhost:8000")
        print("Please start the server: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        sys.exit(1)


def get_headers() -> dict:
    """Get authorization headers."""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }


def setup_prerequisites():
    """Get or create client, site, and location for testing."""
    global client_id, site_id, location_id

    print_section("SETUP PREREQUISITES")

    # Get first client
    response = requests.get(
        f"{BASE_URL}/clients",
        headers=get_headers()
    )

    if response.status_code == 200:
        data = response.json()
        if data["total"] > 0:
            client_id = data["items"][0]["id"]
            print(f"\n>> Using existing client_id: {client_id}")
        else:
            print("[ERROR] No clients found. Please run test_clients_crud.py first")
            sys.exit(1)
    else:
        print("[ERROR] Failed to get clients")
        sys.exit(1)

    # Get first site for this client
    response = requests.get(
        f"{BASE_URL}/clients/{client_id}/sites",
        headers=get_headers()
    )

    if response.status_code == 200:
        sites = response.json()
        if len(sites) > 0:
            site_id = sites[0]["id"]
            print(f">> Using existing site_id: {site_id}")
        else:
            print("[ERROR] No sites found for this client")
            sys.exit(1)
    else:
        print("[ERROR] Failed to get sites")
        sys.exit(1)

    # Get first location for this site (if any)
    response = requests.get(
        f"{BASE_URL}/sites/{site_id}/locations",
        headers=get_headers()
    )

    if response.status_code == 200:
        locations = response.json()
        if len(locations) > 0:
            location_id = locations[0]["id"]
            print(f">> Using existing location_id: {location_id}")
        else:
            print(">> No locations found (optional)")

    print(">> Prerequisites setup complete")


def test_asset_types():
    """Test Asset Types and Property Definitions."""
    global asset_type_id

    print_section("ASSET TYPES AND PROPERTY DEFINITIONS")

    # 1. List asset types
    response = requests.get(
        f"{BASE_URL}/asset-types",
        headers=get_headers()
    )
    if not print_response(response, "List Asset Types", expected_status=200):
        print("[ERROR] Failed to list asset types")
        sys.exit(1)

    if response.status_code == 200:
        asset_types = response.json()
        if len(asset_types) > 0:
            # Find NVR or use first type
            nvr_type = next((at for at in asset_types if at["code"] == "NVR"), asset_types[0])
            asset_type_id = nvr_type["id"]
            print(f"\n>> Using asset_type: {nvr_type['code']} (id: {asset_type_id})")

    # 2. Get property definitions for the asset type
    response = requests.get(
        f"{BASE_URL}/asset-types/{asset_type_id}/properties",
        headers=get_headers()
    )
    if not print_response(response, "Get Property Definitions", expected_status=200):
        print("[ERROR] Failed to get property definitions")
        sys.exit(1)


def test_asset_crud():
    """Test Asset CRUD with dynamic properties."""
    global asset_id

    print_section("ASSET CRUD OPERATIONS")

    # 1. List assets (may be empty)
    response = requests.get(
        f"{BASE_URL}/assets",
        headers=get_headers()
    )
    if not print_response(response, "List Assets (initial)", expected_status=200):
        print("[ERROR] Failed to list assets")
        sys.exit(1)

    # 2. Create asset with dynamic properties
    response = requests.post(
        f"{BASE_URL}/assets",
        headers=get_headers(),
        json={
            "client_id": client_id,
            "site_id": site_id,
            "asset_type_id": asset_type_id,
            "label": "Test Router - Main Office",
            "manufacturer": "Mikrotik",
            "model": "RB4011iGS+RM",
            "serial_number": "SN-TEST-12345",
            "install_date": "2024-01-01",
            "status": "active",
            "location_id": location_id,
            "notes": "Primary router for office network",
            "properties": {
                "wan_ip_type": "static",
                "wan_public_ip": "203.0.113.45",
                "admin_username": "admin",
                "admin_password": "SecurePass123!"
            }
        }
    )
    if not print_response(response, "Create Asset with Properties", expected_status=201):
        print("[ERROR] Failed to create asset")
        sys.exit(1)

    if response.status_code == 201:
        asset_id = response.json()["id"]
        print(f"\n>> Created asset_id: {asset_id}")

    # 3. Get specific asset with properties
    response = requests.get(
        f"{BASE_URL}/assets/{asset_id}",
        headers=get_headers()
    )
    if not print_response(response, "Get Asset with Properties", expected_status=200):
        print("[ERROR] Failed to get asset")
        sys.exit(1)

    # 4. Update asset and properties
    response = requests.patch(
        f"{BASE_URL}/assets/{asset_id}",
        headers=get_headers(),
        json={
            "notes": "Updated - firmware upgraded to latest version",
            "properties": {
                "wan_public_ip": "203.0.113.46"
            }
        }
    )
    if not print_response(response, "Update Asset and Properties", expected_status=200):
        print("[ERROR] Failed to update asset")
        sys.exit(1)

    # 5. Search assets
    response = requests.get(
        f"{BASE_URL}/assets?q=Test",
        headers=get_headers()
    )
    if not print_response(response, "Search Assets", expected_status=200):
        print("[ERROR] Failed to search assets")
        sys.exit(1)

    # 6. Filter assets by client
    response = requests.get(
        f"{BASE_URL}/assets?client_id={client_id}",
        headers=get_headers()
    )
    if not print_response(response, "Filter Assets by Client", expected_status=200):
        print("[ERROR] Failed to filter assets")
        sys.exit(1)


def test_asset_events():
    """Test Asset Events."""
    print_section("ASSET EVENTS")

    if not asset_id:
        print("[ERROR] Cannot test events: asset_id not available")
        sys.exit(1)

    # 1. List events (should have 'created' event)
    response = requests.get(
        f"{BASE_URL}/assets/{asset_id}/events",
        headers=get_headers()
    )
    if not print_response(response, "List Asset Events", expected_status=200):
        print("[ERROR] Failed to list events")
        sys.exit(1)

    # 2. Create event
    response = requests.post(
        f"{BASE_URL}/assets/{asset_id}/events",
        headers=get_headers(),
        json={
            "event_type": "firmware_upgrade",
            "details": "Upgraded firmware from 6.48.6 to 6.49.10"
        }
    )
    if not print_response(response, "Create Asset Event", expected_status=201):
        print("[ERROR] Failed to create event")
        sys.exit(1)

    # 3. Create another event
    response = requests.post(
        f"{BASE_URL}/assets/{asset_id}/events",
        headers=get_headers(),
        json={
            "event_type": "password_changed",
            "details": "Admin password rotated as per security policy"
        }
    )
    if not print_response(response, "Create Second Event", expected_status=201):
        print("[ERROR] Failed to create second event")
        sys.exit(1)


def test_nvr_disks():
    """Test NVR Disks functionality."""
    global nvr_asset_id, disk_id

    print_section("NVR DISKS")

    # Create an NVR asset for disk testing
    response = requests.post(
        f"{BASE_URL}/assets",
        headers=get_headers(),
        json={
            "client_id": client_id,
            "site_id": site_id,
            "asset_type_id": asset_type_id,
            "label": "Test NVR - Security Cameras",
            "manufacturer": "Hikvision",
            "model": "DS-7616NI-K2/16P",
            "serial_number": "SN-NVR-67890",
            "status": "active",
            "properties": {
                "max_camera_channels": "16",
                "lan_ip_address": "192.168.1.100"
            }
        }
    )

    if response.status_code == 201:
        nvr_asset_id = response.json()["id"]
        print(f"\n>> Created NVR asset_id: {nvr_asset_id}")

    if not nvr_asset_id:
        print("[WARNING] Skipping NVR disk tests - could not create NVR asset")
        return

    # 1. List disks (empty initially)
    response = requests.get(
        f"{BASE_URL}/assets/{nvr_asset_id}/disks",
        headers=get_headers()
    )
    if not print_response(response, "List NVR Disks (initial)", expected_status=200):
        print("[ERROR] Failed to list disks")
        sys.exit(1)

    # 2. Add disk
    response = requests.post(
        f"{BASE_URL}/assets/{nvr_asset_id}/disks",
        headers=get_headers(),
        json={
            "slot_number": 1,
            "capacity_tb": 4.0,
            "install_date": "2024-01-01",
            "serial_number": "WD-DISK-12345"
        }
    )
    if not print_response(response, "Add NVR Disk", expected_status=201):
        print("[ERROR] Failed to add disk")
        sys.exit(1)

    if response.status_code == 201:
        disk_id = response.json()["id"]
        print(f"\n>> Created disk_id: {disk_id}")

    # 3. Add second disk
    response = requests.post(
        f"{BASE_URL}/assets/{nvr_asset_id}/disks",
        headers=get_headers(),
        json={
            "slot_number": 2,
            "capacity_tb": 4.0,
            "install_date": "2024-01-01",
            "serial_number": "WD-DISK-67890"
        }
    )
    if not print_response(response, "Add Second Disk", expected_status=201):
        print("[ERROR] Failed to add second disk")
        sys.exit(1)

    # 4. Update disk
    if disk_id:
        response = requests.patch(
            f"{BASE_URL}/assets/{nvr_asset_id}/disks/{disk_id}",
            headers=get_headers(),
            json={
                "serial_number": "WD-DISK-12345-UPDATED"
            }
        )
        if not print_response(response, "Update Disk", expected_status=200):
            print("[ERROR] Failed to update disk")
            sys.exit(1)

    # 5. List all disks
    response = requests.get(
        f"{BASE_URL}/assets/{nvr_asset_id}/disks",
        headers=get_headers()
    )
    if not print_response(response, "List All Disks", expected_status=200):
        print("[ERROR] Failed to list all disks")
        sys.exit(1)


def test_rbac():
    """Test RBAC enforcement."""
    print_section("RBAC ENFORCEMENT TESTS")

    # Test without authentication
    response = requests.get(f"{BASE_URL}/assets")
    print_response(response, "Access without token (expect 401)", expected_status=401)

    # Test with invalid token
    response = requests.get(
        f"{BASE_URL}/assets",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    print_response(response, "Access with invalid token (expect 401)", expected_status=401)


def main():
    """Run all tests."""
    global token, tests_passed, tests_failed

    try:
        # Login
        token = login()

        # Setup
        setup_prerequisites()

        # Run test suites
        test_asset_types()
        test_asset_crud()
        test_asset_events()
        test_nvr_disks()
        test_rbac()

        print_section("SUMMARY")

        total_tests = tests_passed + tests_failed
        print(f"\nTests run: {total_tests}")
        print(f"  [OK]   Passed: {tests_passed}")
        print(f"  [FAIL] Failed: {tests_failed}")

        if tests_failed == 0:
            print("\n[SUCCESS] All tests completed successfully!")
            print("\nCreated resources:")
            print(f"  - Client ID: {client_id}")
            print(f"  - Site ID: {site_id}")
            print(f"  - Asset Type ID: {asset_type_id}")
            print(f"  - Asset ID: {asset_id}")
            if nvr_asset_id:
                print(f"  - NVR Asset ID: {nvr_asset_id}")
            if disk_id:
                print(f"  - Disk ID: {disk_id}")
            print("\nYou can now test these resources in the API docs:")
            print("  http://localhost:8000/docs")
        else:
            print(f"\n[FAILURE] {tests_failed} test(s) failed!")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n[INFO] Tests interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
