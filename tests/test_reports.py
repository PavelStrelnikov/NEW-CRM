"""
Test script for Reports API endpoints.

This script tests:
- Ticket summary reports
- Tickets by client reports
- Work time summary reports
- Client activity reports
- Asset summary reports
- Technician performance reports
- Line item summary reports
- RBAC enforcement

Prerequisites:
1. Server must be running: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
2. Database must have migrations applied: alembic upgrade head
3. Must have test data from previous test scripts (clients, tickets, assets)
"""

import requests
import json
import sys
from typing import Optional
from datetime import date, timedelta

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "change_me_now"

# Global variables
token: Optional[str] = None
client_id: Optional[str] = None

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
    """Get client for testing."""
    global client_id

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
            print("[WARNING] No clients found. Some tests may be limited.")
    else:
        print("[WARNING] Failed to get clients. Some tests may be limited.")

    print(">> Prerequisites setup complete")


def test_ticket_reports():
    """Test ticket reporting endpoints."""
    print_section("TICKET REPORTS")

    # 1. Ticket summary report (no filters)
    response = requests.get(
        f"{BASE_URL}/reports/tickets/summary",
        headers=get_headers()
    )
    print_response(response, "Ticket Summary Report", expected_status=200)

    # 2. Ticket summary with date range
    today = date.today()
    start_date = today - timedelta(days=30)
    response = requests.get(
        f"{BASE_URL}/reports/tickets/summary?start_date={start_date}&end_date={today}",
        headers=get_headers()
    )
    print_response(response, "Ticket Summary with Date Range", expected_status=200)

    # 3. Ticket summary for specific client
    if client_id:
        response = requests.get(
            f"{BASE_URL}/reports/tickets/summary?client_id={client_id}",
            headers=get_headers()
        )
        print_response(response, "Ticket Summary for Specific Client", expected_status=200)

    # 4. Tickets by client
    response = requests.get(
        f"{BASE_URL}/reports/tickets/by-client",
        headers=get_headers()
    )
    print_response(response, "Tickets by Client Report", expected_status=200)

    # 5. Tickets by client with date range
    response = requests.get(
        f"{BASE_URL}/reports/tickets/by-client?start_date={start_date}&end_date={today}",
        headers=get_headers()
    )
    print_response(response, "Tickets by Client with Date Range", expected_status=200)


def test_work_time_reports():
    """Test work time reporting endpoints."""
    print_section("WORK TIME REPORTS")

    # 1. Work time summary (no filters)
    response = requests.get(
        f"{BASE_URL}/reports/work-time/summary",
        headers=get_headers()
    )
    print_response(response, "Work Time Summary Report", expected_status=200)

    # 2. Work time summary with date range
    today = date.today()
    start_date = today - timedelta(days=30)
    response = requests.get(
        f"{BASE_URL}/reports/work-time/summary?start_date={start_date}&end_date={today}",
        headers=get_headers()
    )
    print_response(response, "Work Time Summary with Date Range", expected_status=200)

    # 3. Work time for specific client
    if client_id:
        response = requests.get(
            f"{BASE_URL}/reports/work-time/summary?client_id={client_id}",
            headers=get_headers()
        )
        print_response(response, "Work Time Summary for Specific Client", expected_status=200)


def test_client_reports():
    """Test client reporting endpoints."""
    print_section("CLIENT REPORTS")

    # 1. Client activity report (no filters)
    response = requests.get(
        f"{BASE_URL}/reports/clients/activity",
        headers=get_headers()
    )
    print_response(response, "Client Activity Report", expected_status=200)

    # 2. Client activity with date range
    today = date.today()
    start_date = today - timedelta(days=30)
    response = requests.get(
        f"{BASE_URL}/reports/clients/activity?start_date={start_date}&end_date={today}",
        headers=get_headers()
    )
    print_response(response, "Client Activity with Date Range", expected_status=200)


def test_asset_reports():
    """Test asset reporting endpoints."""
    print_section("ASSET REPORTS")

    # 1. Asset summary report (no filters)
    response = requests.get(
        f"{BASE_URL}/reports/assets/summary",
        headers=get_headers()
    )
    print_response(response, "Asset Summary Report", expected_status=200)

    # 2. Asset summary for specific client
    if client_id:
        response = requests.get(
            f"{BASE_URL}/reports/assets/summary?client_id={client_id}",
            headers=get_headers()
        )
        print_response(response, "Asset Summary for Specific Client", expected_status=200)


def test_technician_reports():
    """Test technician performance reporting endpoints."""
    print_section("TECHNICIAN PERFORMANCE REPORTS")

    # 1. Technician performance report (no filters)
    response = requests.get(
        f"{BASE_URL}/reports/technicians/performance",
        headers=get_headers()
    )
    print_response(response, "Technician Performance Report", expected_status=200)

    # 2. Technician performance with date range
    today = date.today()
    start_date = today - timedelta(days=30)
    response = requests.get(
        f"{BASE_URL}/reports/technicians/performance?start_date={start_date}&end_date={today}",
        headers=get_headers()
    )
    print_response(response, "Technician Performance with Date Range", expected_status=200)


def test_line_item_reports():
    """Test line item reporting endpoints."""
    print_section("LINE ITEM REPORTS")

    # 1. Line item summary report (no filters)
    response = requests.get(
        f"{BASE_URL}/reports/line-items/summary",
        headers=get_headers()
    )
    print_response(response, "Line Item Summary Report", expected_status=200)

    # 2. Line item summary with date range
    today = date.today()
    start_date = today - timedelta(days=30)
    response = requests.get(
        f"{BASE_URL}/reports/line-items/summary?start_date={start_date}&end_date={today}",
        headers=get_headers()
    )
    print_response(response, "Line Item Summary with Date Range", expected_status=200)

    # 3. Line item summary for specific client
    if client_id:
        response = requests.get(
            f"{BASE_URL}/reports/line-items/summary?client_id={client_id}",
            headers=get_headers()
        )
        print_response(response, "Line Item Summary for Specific Client", expected_status=200)


def test_rbac():
    """Test RBAC enforcement."""
    print_section("RBAC ENFORCEMENT TESTS")

    # Test without authentication
    response = requests.get(f"{BASE_URL}/reports/tickets/summary")
    print_response(response, "Access without token (expect 401)", expected_status=401)

    # Test with invalid token
    response = requests.get(
        f"{BASE_URL}/reports/tickets/summary",
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
        test_ticket_reports()
        test_work_time_reports()
        test_client_reports()
        test_asset_reports()
        test_technician_reports()
        test_line_item_reports()
        test_rbac()

        print_section("SUMMARY")

        total_tests = tests_passed + tests_failed
        print(f"\nTests run: {total_tests}")
        print(f"  [OK]   Passed: {tests_passed}")
        print(f"  [FAIL] Failed: {tests_failed}")

        if tests_failed == 0:
            print("\n[SUCCESS] All tests completed successfully!")
            print("\nReports API is ready to use.")
            print("You can now test these reports in the API docs:")
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
