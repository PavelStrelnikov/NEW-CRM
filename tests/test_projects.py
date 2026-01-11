"""
Test script for Projects endpoints.

This script tests:
- Project CRUD operations
- Project filtering and search
- Project-site linking
- Project-ticket linking
- Project-asset linking
- Project events
- RBAC enforcement

Prerequisites:
1. Server must be running: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
2. Database must have migrations applied: alembic upgrade head
3. Must have test data (clients, sites, tickets, assets)
"""

import requests
import sys
import time
from typing import Optional

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "change_me_now"

# Global variables
token: Optional[str] = None
client_id: Optional[str] = None
site_id: Optional[str] = None
ticket_id: Optional[str] = None
asset_id: Optional[str] = None
project_id: Optional[str] = None
event_id: Optional[str] = None

# Test statistics
tests_passed = 0
tests_failed = 0


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_test_result(test_name: str, success: bool, details: str = ""):
    """Print test result."""
    global tests_passed, tests_failed

    status_icon = "[OK]" if success else "[FAIL]"
    print(f"\n{status_icon} {test_name}")
    if details:
        print(f"    {details}")

    if success:
        tests_passed += 1
    else:
        tests_failed += 1


def login() -> str:
    """Login and get access token."""
    global tests_passed, tests_failed

    print_section("AUTHENTICATION")

    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )

        if response.status_code == 200:
            print("[OK] Login successful")
            tests_passed += 1
            return response.json()["access_token"]
        else:
            print(f"[FAIL] Login failed: {response.status_code}")
            tests_failed += 1
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Cannot connect to server at http://localhost:8000")
        print("Please start the server: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        sys.exit(1)


def get_headers() -> dict:
    """Get authorization headers."""
    return {
        "Authorization": f"Bearer {token}"
    }


def setup_prerequisites():
    """Get test data IDs for linking."""
    global client_id, site_id, ticket_id, asset_id

    print_section("SETUP PREREQUISITES")

    # Get a client
    response = requests.get(f"{BASE_URL}/clients", headers=get_headers())
    if response.status_code == 200:
        clients = response.json()["items"]
        if clients:
            client_id = clients[0]["id"]
            print(f"\n>> Using client_id: {client_id}")

    # Get a site
    response = requests.get(f"{BASE_URL}/sites", headers=get_headers())
    if response.status_code == 200:
        sites = response.json()["items"]
        if sites:
            site_id = sites[0]["id"]
            print(f">> Using site_id: {site_id}")

    # Get a ticket
    response = requests.get(f"{BASE_URL}/tickets", headers=get_headers())
    if response.status_code == 200:
        tickets = response.json()["items"]
        if tickets:
            ticket_id = tickets[0]["id"]
            print(f">> Using ticket_id: {ticket_id}")

    # Get an asset
    response = requests.get(f"{BASE_URL}/assets", headers=get_headers())
    if response.status_code == 200:
        assets = response.json()["items"]
        if assets:
            asset_id = assets[0]["id"]
            print(f">> Using asset_id: {asset_id}")

    if not client_id:
        print("[WARNING] No client found. Some tests may fail.")

    print(">> Prerequisites setup complete")


def test_project_create():
    """Test creating a project."""
    global project_id

    print_section("PROJECT CREATION")

    if not client_id:
        print("[SKIP] No client available")
        return

    response = requests.post(
        f"{BASE_URL}/projects",
        headers=get_headers(),
        json={
            "client_id": client_id,
            "name": f"Test Project {int(time.time())}",
            "description": "Test project for automated testing",
            "status": "active",
            "start_date": "2026-01-01",
            "target_end_date": "2026-12-31"
        }
    )

    success = response.status_code == 201
    if success:
        project_id = response.json()["id"]
        details = f"Created project ID: {project_id}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"

    print_test_result("Create project", success, details)


def test_project_list():
    """Test listing projects."""
    print_section("PROJECT LISTING")

    # List all projects
    response = requests.get(f"{BASE_URL}/projects", headers=get_headers())
    success = response.status_code == 200
    if success:
        data = response.json()
        details = f"Found {data['total']} project(s)"
    else:
        details = f"Status: {response.status_code}"
    print_test_result("List all projects", success, details)

    # Filter by client
    if client_id:
        response = requests.get(
            f"{BASE_URL}/projects?client_id={client_id}",
            headers=get_headers()
        )
        success = response.status_code == 200
        if success:
            data = response.json()
            details = f"Found {data['total']} project(s) for client"
        else:
            details = f"Status: {response.status_code}"
        print_test_result("Filter projects by client", success, details)

    # Filter by status
    response = requests.get(
        f"{BASE_URL}/projects?status=active",
        headers=get_headers()
    )
    success = response.status_code == 200
    if success:
        data = response.json()
        details = f"Found {data['total']} active project(s)"
    else:
        details = f"Status: {response.status_code}"
    print_test_result("Filter projects by status", success, details)

    # Search by name
    response = requests.get(
        f"{BASE_URL}/projects?q=Test",
        headers=get_headers()
    )
    success = response.status_code == 200
    if success:
        data = response.json()
        details = f"Found {data['total']} project(s) matching 'Test'"
    else:
        details = f"Status: {response.status_code}"
    print_test_result("Search projects by name", success, details)


def test_project_get():
    """Test getting project details."""
    print_section("PROJECT DETAILS")

    if not project_id:
        print("[SKIP] No project available")
        return

    response = requests.get(
        f"{BASE_URL}/projects/{project_id}",
        headers=get_headers()
    )

    success = response.status_code == 200
    if success:
        data = response.json()
        has_events = len(data.get("events", [])) > 0
        details = f"Project: {data['name']}, Events: {len(data.get('events', []))}"
    else:
        details = f"Status: {response.status_code}"

    print_test_result("Get project details", success, details)


def test_project_update():
    """Test updating a project."""
    print_section("PROJECT UPDATE")

    if not project_id:
        print("[SKIP] No project available")
        return

    response = requests.patch(
        f"{BASE_URL}/projects/{project_id}",
        headers=get_headers(),
        json={
            "description": "Updated description",
            "status": "on_hold"
        }
    )

    success = response.status_code == 200
    if success:
        data = response.json()
        details = f"Updated status to: {data['status']}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"

    print_test_result("Update project", success, details)


def test_project_link_sites():
    """Test linking sites to project."""
    print_section("PROJECT-SITE LINKING")

    if not project_id or not site_id:
        print("[SKIP] No project or site available")
        return

    response = requests.post(
        f"{BASE_URL}/projects/{project_id}/sites",
        headers=get_headers(),
        json={
            "site_ids": [site_id]
        }
    )

    success = response.status_code == 204
    details = f"Status: {response.status_code}"
    if not success:
        details += f", Error: {response.text}"

    print_test_result("Link sites to project", success, details)


def test_project_link_tickets():
    """Test linking tickets to project."""
    print_section("PROJECT-TICKET LINKING")

    if not project_id or not ticket_id:
        print("[SKIP] No project or ticket available")
        return

    response = requests.post(
        f"{BASE_URL}/projects/{project_id}/tickets",
        headers=get_headers(),
        json={
            "ticket_ids": [ticket_id]
        }
    )

    success = response.status_code == 204
    details = f"Status: {response.status_code}"
    if not success:
        details += f", Error: {response.text}"

    print_test_result("Link tickets to project", success, details)


def test_project_link_assets():
    """Test linking assets to project."""
    print_section("PROJECT-ASSET LINKING")

    if not project_id or not asset_id:
        print("[SKIP] No project or asset available")
        return

    response = requests.post(
        f"{BASE_URL}/projects/{project_id}/assets",
        headers=get_headers(),
        json={
            "asset_ids": [asset_id]
        }
    )

    success = response.status_code == 204
    details = f"Status: {response.status_code}"
    if not success:
        details += f", Error: {response.text}"

    print_test_result("Link assets to project", success, details)


def test_project_create_event():
    """Test creating project events."""
    print_section("PROJECT EVENTS")

    if not project_id:
        print("[SKIP] No project available")
        return

    # Test note event
    response = requests.post(
        f"{BASE_URL}/projects/{project_id}/events",
        headers=get_headers(),
        json={
            "event_type": "note",
            "message": "This is a test note for the project"
        }
    )

    success = response.status_code == 201
    if success:
        data = response.json()
        details = f"Created event ID: {data['id']}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"

    print_test_result("Create note event", success, details)

    # Test milestone event
    response = requests.post(
        f"{BASE_URL}/projects/{project_id}/events",
        headers=get_headers(),
        json={
            "event_type": "milestone",
            "message": "Phase 1 completed"
        }
    )

    success = response.status_code == 201
    if success:
        data = response.json()
        details = f"Created milestone event ID: {data['id']}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"

    print_test_result("Create milestone event", success, details)


def test_project_rbac():
    """Test RBAC enforcement."""
    print_section("PROJECT RBAC")

    # Test without authentication
    response = requests.get(f"{BASE_URL}/projects")
    success = response.status_code == 401
    print_test_result("Access without token (expect 401)", success, f"Status: {response.status_code}")

    # Test with invalid token
    response = requests.get(
        f"{BASE_URL}/projects",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    success = response.status_code == 401
    print_test_result("Access with invalid token (expect 401)", success, f"Status: {response.status_code}")


def main():
    """Run all tests."""
    global token, tests_passed, tests_failed

    try:
        # Login
        token = login()

        # Setup
        setup_prerequisites()

        # Run test suites
        test_project_create()
        test_project_list()
        test_project_get()
        test_project_update()
        test_project_link_sites()
        test_project_link_tickets()
        test_project_link_assets()
        test_project_create_event()
        test_project_rbac()

        print_section("SUMMARY")

        total_tests = tests_passed + tests_failed
        print(f"\nTests run: {total_tests}")
        print(f"  [OK]   Passed: {tests_passed}")
        print(f"  [FAIL] Failed: {tests_failed}")

        if tests_failed == 0:
            print("\n[SUCCESS] All tests completed successfully!")
            print("\nNew Features Available:")
            print("  - Project CRUD (create, read, update, list)")
            print("  - Project filtering (by client, status, name)")
            print("  - Project-site linking")
            print("  - Project-ticket linking")
            print("  - Project-asset linking")
            print("  - Project events (notes, milestones, status changes)")
            print("\nYou can now test these features in the API docs:")
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
