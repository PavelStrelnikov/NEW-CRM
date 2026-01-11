"""
Test script for Clients domain CRUD operations.

This script tests:
- Client CRUD operations
- Site CRUD operations
- Contact CRUD operations with site linking
- Location CRUD operations
- RBAC enforcement

Prerequisites:
1. Server must be running: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
2. Database must have migrations applied: alembic upgrade head
"""

import requests
import json
import sys
from typing import Optional

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "change_me_now"

# Global variables to store created IDs
token: Optional[str] = None
client_id: Optional[str] = None
site_id: Optional[str] = None
contact_id: Optional[str] = None
location_id: Optional[str] = None

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

    Args:
        response: HTTP response object
        operation: Description of the operation
        expected_status: If provided, check for exact status match.
                        If None, any status < 400 is considered success.

    Returns:
        bool: True if test passed, False otherwise
    """
    global tests_passed, tests_failed

    if expected_status is not None:
        # Check for exact status match
        success = response.status_code == expected_status
    else:
        # Default: any status < 400 is success
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
            print("\n[ERROR] Failed to login. Please check:")
            print("  - Server is running: uvicorn app.main:app --reload")
            print("  - Database is running: docker compose up -d")
            print("  - Migrations applied: alembic upgrade head")
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


def test_clients():
    """Test Client CRUD operations."""
    global client_id

    print_section("CLIENT CRUD OPERATIONS")

    # 1. List clients (empty initially except seed data)
    response = requests.get(
        f"{BASE_URL}/clients",
        headers=get_headers()
    )
    if not print_response(response, "List Clients (initial)", expected_status=200):
        print("[ERROR] Failed to list clients")
        sys.exit(1)

    # 2. Create a new client
    response = requests.post(
        f"{BASE_URL}/clients",
        headers=get_headers(),
        json={
            "name": "Test Company Ltd",
            "main_address": "123 Test Street, Tel Aviv",
            "notes": "This is a test client created by automation",
            "status": "active"
        }
    )
    if not print_response(response, "Create Client", expected_status=201):
        print("[ERROR] Failed to create client")
        sys.exit(1)

    if response.status_code == 201:
        client_id = response.json()["id"]
        print(f"\n>> Created client_id: {client_id}")
    else:
        print("[ERROR] Did not receive client_id from create response")
        sys.exit(1)

    # 3. Get specific client
    response = requests.get(
        f"{BASE_URL}/clients/{client_id}",
        headers=get_headers()
    )
    if not print_response(response, "Get Client by ID", expected_status=200):
        print("[ERROR] Failed to get client by ID")
        sys.exit(1)

    # 4. Update client
    response = requests.patch(
        f"{BASE_URL}/clients/{client_id}",
        headers=get_headers(),
        json={
            "notes": "Updated notes - client is now verified"
        }
    )
    if not print_response(response, "Update Client", expected_status=200):
        print("[ERROR] Failed to update client")
        sys.exit(1)

    # 5. Search clients
    response = requests.get(
        f"{BASE_URL}/clients?q=Test",
        headers=get_headers()
    )
    if not print_response(response, "Search Clients by name", expected_status=200):
        print("[ERROR] Failed to search clients")
        sys.exit(1)


def test_sites():
    """Test Site CRUD operations."""
    global site_id

    print_section("SITE CRUD OPERATIONS")

    if not client_id:
        print("[ERROR] Cannot test sites: client_id not available")
        sys.exit(1)

    # 1. List sites for client (should have default site)
    response = requests.get(
        f"{BASE_URL}/clients/{client_id}/sites",
        headers=get_headers()
    )
    if not print_response(response, "List Sites for Client", expected_status=200):
        print("[ERROR] Failed to list sites")
        sys.exit(1)

    # 2. Create additional site
    response = requests.post(
        f"{BASE_URL}/clients/{client_id}/sites",
        headers=get_headers(),
        json={
            "client_id": client_id,
            "name": "Branch Office",
            "address": "456 Branch St, Haifa",
            "is_default": False,
            "notes": "Northern branch location"
        }
    )
    if not print_response(response, "Create Additional Site", expected_status=201):
        print("[ERROR] Failed to create site")
        sys.exit(1)

    if response.status_code == 201:
        site_id = response.json()["id"]
        print(f"\n>> Created site_id: {site_id}")
    else:
        print("[ERROR] Did not receive site_id from create response")
        sys.exit(1)

    # 3. Get specific site
    response = requests.get(
        f"{BASE_URL}/sites/{site_id}",
        headers=get_headers()
    )
    if not print_response(response, "Get Site by ID", expected_status=200):
        print("[ERROR] Failed to get site by ID")
        sys.exit(1)

    # 4. Update site
    response = requests.patch(
        f"{BASE_URL}/sites/{site_id}",
        headers=get_headers(),
        json={
            "notes": "Updated - renovations completed"
        }
    )
    if not print_response(response, "Update Site", expected_status=200):
        print("[ERROR] Failed to update site")
        sys.exit(1)

    # 5. Try to set new site as default
    response = requests.patch(
        f"{BASE_URL}/sites/{site_id}",
        headers=get_headers(),
        json={
            "is_default": True
        }
    )
    if not print_response(response, "Set Site as Default", expected_status=200):
        print("[ERROR] Failed to set site as default")
        sys.exit(1)


def test_contacts():
    """Test Contact CRUD operations."""
    global contact_id

    print_section("CONTACT CRUD OPERATIONS")

    if not client_id:
        print("[ERROR] Cannot test contacts: client_id not available")
        sys.exit(1)
    if not site_id:
        print("[ERROR] Cannot test contacts: site_id not available")
        sys.exit(1)

    # 1. List contacts for client (empty initially)
    response = requests.get(
        f"{BASE_URL}/clients/{client_id}/contacts",
        headers=get_headers()
    )
    if not print_response(response, "List Contacts for Client (initial)", expected_status=200):
        print("[ERROR] Failed to list contacts")
        sys.exit(1)

    # 2. Create contact with site linking
    response = requests.post(
        f"{BASE_URL}/clients/{client_id}/contacts",
        headers=get_headers(),
        json={
            "client_id": client_id,
            "name": "John Doe",
            "phone": "050-1234567",
            "email": "john.doe@testcompany.com",
            "position": "IT Manager",
            "notes": "Primary technical contact",
            "site_ids": [site_id]
        }
    )
    if not print_response(response, "Create Contact with Site Link", expected_status=201):
        print("[ERROR] Failed to create contact")
        sys.exit(1)

    if response.status_code == 201:
        contact_id = response.json()["id"]
        print(f"\n>> Created contact_id: {contact_id}")
    else:
        print("[ERROR] Did not receive contact_id from create response")
        sys.exit(1)

    # 3. Get specific contact
    response = requests.get(
        f"{BASE_URL}/contacts/{contact_id}",
        headers=get_headers()
    )
    if not print_response(response, "Get Contact by ID", expected_status=200):
        print("[ERROR] Failed to get contact by ID")
        sys.exit(1)

    # 4. Update contact
    response = requests.patch(
        f"{BASE_URL}/contacts/{contact_id}",
        headers=get_headers(),
        json={
            "phone": "050-9876543",
            "notes": "Updated phone number"
        }
    )
    if not print_response(response, "Update Contact", expected_status=200):
        print("[ERROR] Failed to update contact")
        sys.exit(1)

    # 5. Update site links
    response = requests.post(
        f"{BASE_URL}/contacts/{contact_id}/sites",
        headers=get_headers(),
        json={
            "site_ids": []  # Unlink from all sites
        }
    )
    if not print_response(response, "Update Contact Site Links", expected_status=200):
        print("[ERROR] Failed to update contact site links")
        sys.exit(1)


def test_locations():
    """Test Location CRUD operations."""
    global location_id

    print_section("LOCATION CRUD OPERATIONS")

    if not site_id:
        print("[ERROR] Cannot test locations: site_id not available")
        sys.exit(1)

    # 1. List locations for site (empty initially)
    response = requests.get(
        f"{BASE_URL}/sites/{site_id}/locations",
        headers=get_headers()
    )
    if not print_response(response, "List Locations for Site (initial)", expected_status=200):
        print("[ERROR] Failed to list locations")
        sys.exit(1)

    # 2. Create location
    response = requests.post(
        f"{BASE_URL}/sites/{site_id}/locations",
        headers=get_headers(),
        json={
            "site_id": site_id,
            "building": "Building A",
            "floor": "3rd Floor",
            "room": "Room 301",
            "description": "Server room - main data center"
        }
    )
    if not print_response(response, "Create Location", expected_status=201):
        print("[ERROR] Failed to create location")
        sys.exit(1)

    if response.status_code == 201:
        location_id = response.json()["id"]
        print(f"\n>> Created location_id: {location_id}")
    else:
        print("[ERROR] Did not receive location_id from create response")
        sys.exit(1)

    # 3. Create another location
    response = requests.post(
        f"{BASE_URL}/sites/{site_id}/locations",
        headers=get_headers(),
        json={
            "site_id": site_id,
            "building": "Building A",
            "floor": "2nd Floor",
            "room": "Reception",
            "description": "Main reception desk"
        }
    )
    if not print_response(response, "Create Second Location", expected_status=201):
        print("[ERROR] Failed to create second location")
        sys.exit(1)

    # 4. Get specific location
    response = requests.get(
        f"{BASE_URL}/locations/{location_id}",
        headers=get_headers()
    )
    if not print_response(response, "Get Location by ID", expected_status=200):
        print("[ERROR] Failed to get location by ID")
        sys.exit(1)

    # 5. Update location
    response = requests.patch(
        f"{BASE_URL}/locations/{location_id}",
        headers=get_headers(),
        json={
            "description": "Server room - upgraded cooling system installed"
        }
    )
    if not print_response(response, "Update Location", expected_status=200):
        print("[ERROR] Failed to update location")
        sys.exit(1)

    # 6. List all locations again
    response = requests.get(
        f"{BASE_URL}/sites/{site_id}/locations",
        headers=get_headers()
    )
    if not print_response(response, "List All Locations for Site", expected_status=200):
        print("[ERROR] Failed to list all locations")
        sys.exit(1)


def test_rbac():
    """Test RBAC enforcement."""
    print_section("RBAC ENFORCEMENT TESTS")

    # Test without authentication - should return 401
    response = requests.get(f"{BASE_URL}/clients")
    print_response(response, "Access without token (expect 401 Unauthorized)", expected_status=401)

    # Test with invalid token - should return 401
    response = requests.get(
        f"{BASE_URL}/clients",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    print_response(response, "Access with invalid token (expect 401 Unauthorized)", expected_status=401)


def main():
    """Run all tests."""
    global token, tests_passed, tests_failed

    try:
        # Login
        token = login()

        # Run test suites
        test_clients()
        test_sites()
        test_contacts()
        test_locations()
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
            print(f"  - Contact ID: {contact_id}")
            print(f"  - Location ID: {location_id}")
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
