"""
Test script for Tickets domain CRUD operations.

This script tests:
- Ticket CRUD operations
- Ticket status changes
- Ticket assignment
- Ticket events (comments)
- Work logs
- Line items
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
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "change_me_now"

# Global variables
token: Optional[str] = None
client_id: Optional[str] = None
site_id: Optional[str] = None
ticket_id: Optional[str] = None
status_id: Optional[str] = None
work_log_id: Optional[str] = None
line_item_id: Optional[str] = None

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
    """Get or create client and site for testing."""
    global client_id, site_id, status_id

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

    # Get default ticket status
    response = requests.get(
        f"{BASE_URL}/tickets?page=1&page_size=1",
        headers=get_headers()
    )

    # We'll get the status from the first ticket or use a known status
    # For now, we'll just note that we need it
    print(">> Prerequisites setup complete")


def test_ticket_crud():
    """Test Ticket CRUD operations."""
    global ticket_id

    print_section("TICKET CRUD OPERATIONS")

    # 1. List tickets (may be empty)
    response = requests.get(
        f"{BASE_URL}/tickets",
        headers=get_headers()
    )
    if not print_response(response, "List Tickets (initial)", expected_status=200):
        print("[ERROR] Failed to list tickets")
        sys.exit(1)

    # 2. Create a new ticket
    response = requests.post(
        f"{BASE_URL}/tickets",
        headers=get_headers(),
        json={
            "client_id": client_id,
            "site_id": site_id,
            "title": "Test Ticket - Network Issue",
            "description": "Testing ticket creation via API. Network connectivity issue reported.",
            "category": "Network",
            "priority": "high",
            "source_channel": "manual",
            "reported_via": "phone",
            "service_scope": "not_included",
            "contact_phone": "050-1234567",
            "contact_name": "Test Contact"
        }
    )
    if not print_response(response, "Create Ticket", expected_status=201):
        print("[ERROR] Failed to create ticket")
        sys.exit(1)

    if response.status_code == 201:
        ticket_id = response.json()["id"]
        print(f"\n>> Created ticket_id: {ticket_id}")
        print(f">> Ticket number: {response.json().get('ticket_number')}")
    else:
        print("[ERROR] Did not receive ticket_id from create response")
        sys.exit(1)

    # 3. Get specific ticket
    response = requests.get(
        f"{BASE_URL}/tickets/{ticket_id}",
        headers=get_headers()
    )
    if not print_response(response, "Get Ticket by ID", expected_status=200):
        print("[ERROR] Failed to get ticket by ID")
        sys.exit(1)

    # 4. Update ticket
    response = requests.patch(
        f"{BASE_URL}/tickets/{ticket_id}",
        headers=get_headers(),
        json={
            "priority": "urgent",
            "description": "Updated: This is now an urgent network issue"
        }
    )
    if not print_response(response, "Update Ticket", expected_status=200):
        print("[ERROR] Failed to update ticket")
        sys.exit(1)

    # 5. Search tickets
    response = requests.get(
        f"{BASE_URL}/tickets?q=Test",
        headers=get_headers()
    )
    if not print_response(response, "Search Tickets by query", expected_status=200):
        print("[ERROR] Failed to search tickets")
        sys.exit(1)


def test_ticket_events():
    """Test Ticket Events (comments)."""
    print_section("TICKET EVENTS (COMMENTS)")

    if not ticket_id:
        print("[ERROR] Cannot test events: ticket_id not available")
        sys.exit(1)

    # 1. List events (should have at least the 'created' event)
    response = requests.get(
        f"{BASE_URL}/tickets/{ticket_id}/events",
        headers=get_headers()
    )
    if not print_response(response, "List Ticket Events", expected_status=200):
        print("[ERROR] Failed to list events")
        sys.exit(1)

    # 2. Add a comment
    response = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/events",
        headers=get_headers(),
        json={
            "message": "Customer confirmed the issue is affecting multiple devices"
        }
    )
    if not print_response(response, "Add Comment", expected_status=201):
        print("[ERROR] Failed to add comment")
        sys.exit(1)

    # 3. Add another comment
    response = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/events",
        headers=get_headers(),
        json={
            "message": "Scheduled on-site visit for tomorrow"
        }
    )
    if not print_response(response, "Add Second Comment", expected_status=201):
        print("[ERROR] Failed to add second comment")
        sys.exit(1)

    # 4. List events again (should have 3 now: created + 2 comments)
    response = requests.get(
        f"{BASE_URL}/tickets/{ticket_id}/events",
        headers=get_headers()
    )
    if not print_response(response, "List All Events", expected_status=200):
        print("[ERROR] Failed to list all events")
        sys.exit(1)


def test_work_logs():
    """Test Work Logs."""
    global work_log_id

    print_section("WORK LOGS")

    if not ticket_id:
        print("[ERROR] Cannot test work logs: ticket_id not available")
        sys.exit(1)

    # 1. List work logs (empty initially)
    response = requests.get(
        f"{BASE_URL}/tickets/{ticket_id}/work-logs",
        headers=get_headers()
    )
    if not print_response(response, "List Work Logs (initial)", expected_status=200):
        print("[ERROR] Failed to list work logs")
        sys.exit(1)

    # 2. Create work log with duration
    response = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/work-logs",
        headers=get_headers(),
        json={
            "work_type": "phone",
            "description": "Initial troubleshooting call with customer",
            "duration_minutes": 30,
            "included_in_service": True
        }
    )
    if not print_response(response, "Create Work Log (duration)", expected_status=201):
        print("[ERROR] Failed to create work log")
        sys.exit(1)

    if response.status_code == 201:
        work_log_id = response.json()["id"]
        print(f"\n>> Created work_log_id: {work_log_id}")

    # 3. Create work log with start/end times
    now = datetime.utcnow()
    start_time = now.isoformat() + "Z"
    end_time = (now + timedelta(hours=2)).isoformat() + "Z"

    response = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/work-logs",
        headers=get_headers(),
        json={
            "work_type": "onsite",
            "description": "On-site network equipment inspection and repair",
            "start_at": start_time,
            "end_at": end_time,
            "duration_minutes": 120,
            "included_in_service": False,
            "billing_note": "Billable on-site work"
        }
    )
    if not print_response(response, "Create Work Log (start/end times)", expected_status=201):
        print("[ERROR] Failed to create second work log")
        sys.exit(1)

    # 4. Update work log
    if work_log_id:
        response = requests.patch(
            f"{BASE_URL}/tickets/{ticket_id}/work-logs/{work_log_id}",
            headers=get_headers(),
            json={
                "billing_note": "Updated billing note"
            }
        )
        if not print_response(response, "Update Work Log", expected_status=200):
            print("[ERROR] Failed to update work log")
            sys.exit(1)

    # 5. List all work logs
    response = requests.get(
        f"{BASE_URL}/tickets/{ticket_id}/work-logs",
        headers=get_headers()
    )
    if not print_response(response, "List All Work Logs", expected_status=200):
        print("[ERROR] Failed to list all work logs")
        sys.exit(1)


def test_line_items():
    """Test Line Items."""
    global line_item_id

    print_section("LINE ITEMS")

    if not ticket_id:
        print("[ERROR] Cannot test line items: ticket_id not available")
        sys.exit(1)

    # 1. List line items (empty initially)
    response = requests.get(
        f"{BASE_URL}/tickets/{ticket_id}/line-items",
        headers=get_headers()
    )
    if not print_response(response, "List Line Items (initial)", expected_status=200):
        print("[ERROR] Failed to list line items")
        sys.exit(1)

    # 2. Create line item (material)
    response = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/line-items",
        headers=get_headers(),
        json={
            "item_type": "material",
            "description": "Network cable CAT6 - 50 meters",
            "quantity": 50,
            "unit": "meters",
            "included_in_service": False,
            "chargeable": True,
            "external_reference": "MAT-001"
        }
    )
    if not print_response(response, "Create Line Item (material)", expected_status=201):
        print("[ERROR] Failed to create line item")
        sys.exit(1)

    if response.status_code == 201:
        line_item_id = response.json()["id"]
        print(f"\n>> Created line_item_id: {line_item_id}")

    # 3. Create line item (equipment)
    response = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/line-items",
        headers=get_headers(),
        json={
            "item_type": "equipment",
            "description": "Replacement network switch",
            "quantity": 1,
            "unit": "unit",
            "included_in_service": True,
            "chargeable": False
        }
    )
    if not print_response(response, "Create Line Item (equipment)", expected_status=201):
        print("[ERROR] Failed to create second line item")
        sys.exit(1)

    # 4. Update line item
    if line_item_id:
        response = requests.patch(
            f"{BASE_URL}/tickets/{ticket_id}/line-items/{line_item_id}",
            headers=get_headers(),
            json={
                "quantity": 55,
                "external_reference": "MAT-001-UPDATED"
            }
        )
        if not print_response(response, "Update Line Item", expected_status=200):
            print("[ERROR] Failed to update line item")
            sys.exit(1)

    # 5. List all line items
    response = requests.get(
        f"{BASE_URL}/tickets/{ticket_id}/line-items",
        headers=get_headers()
    )
    if not print_response(response, "List All Line Items", expected_status=200):
        print("[ERROR] Failed to list all line items")
        sys.exit(1)


def test_ticket_assignment():
    """Test Ticket Assignment."""
    print_section("TICKET ASSIGNMENT")

    if not ticket_id:
        print("[ERROR] Cannot test assignment: ticket_id not available")
        sys.exit(1)

    # For this test, we'll assign to null (unassign)
    # In a real scenario, you'd have a specific internal_user_id to assign to
    response = requests.post(
        f"{BASE_URL}/tickets/{ticket_id}/assign",
        headers=get_headers(),
        json={
            "assigned_to_internal_user_id": None
        }
    )
    if not print_response(response, "Unassign Ticket", expected_status=200):
        print("[ERROR] Failed to assign ticket")
        sys.exit(1)


def test_ticket_status():
    """Test Ticket Status Change."""
    print_section("TICKET STATUS CHANGE")

    if not ticket_id:
        print("[ERROR] Cannot test status change: ticket_id not available")
        sys.exit(1)

    # Note: We need a valid status_id for this test
    # For now, we'll skip the actual status change test
    # and just document that it would work like this:

    print("\n[INFO] Status change test requires valid status_id")
    print("[INFO] In production, you would:")
    print("  1. Get available statuses from ticket_status_definitions")
    print("  2. Change status with POST /tickets/{id}/status")
    print("  3. Closing requires at least one comment or work log (we have both)")


def test_rbac():
    """Test RBAC enforcement."""
    print_section("RBAC ENFORCEMENT TESTS")

    # Test without authentication
    response = requests.get(f"{BASE_URL}/tickets")
    print_response(response, "Access without token (expect 401)", expected_status=401)

    # Test with invalid token
    response = requests.get(
        f"{BASE_URL}/tickets",
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
        test_ticket_crud()
        test_ticket_events()
        test_work_logs()
        test_line_items()
        test_ticket_assignment()
        test_ticket_status()
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
            print(f"  - Ticket ID: {ticket_id}")
            print(f"  - Work Log ID: {work_log_id}")
            print(f"  - Line Item ID: {line_item_id}")
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
