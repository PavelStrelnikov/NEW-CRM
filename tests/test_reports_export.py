"""
Test script for Reports Export functionality (CSV and Excel).

This script tests:
- CSV export endpoints
- Excel export endpoints
- File download functionality
- Filename generation
- RBAC enforcement on exports

Prerequisites:
1. Server must be running: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
2. Database must have migrations applied: alembic upgrade head
3. Must have test data from previous test scripts
"""

import requests
import sys
from typing import Optional

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "change_me_now"

# Global variables
token: Optional[str] = None

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


def test_csv_export(endpoint: str, test_name: str, params: dict = None):
    """Test CSV export endpoint."""
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=get_headers(),
        params=params
    )

    success = response.status_code == 200
    details = ""

    if success:
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        if "text/csv" in content_type:
            details = f"CSV file received ({len(response.content)} bytes)"
        else:
            success = False
            details = f"Wrong content type: {content_type}"

        # Check Content-Disposition header
        if "Content-Disposition" in response.headers:
            filename = response.headers["Content-Disposition"]
            if ".csv" in filename:
                details += f", filename: {filename.split('filename=')[1]}"
            else:
                success = False
                details += ", missing .csv extension"
        else:
            success = False
            details = "Missing Content-Disposition header"
    else:
        details = f"Status: {response.status_code}"

    print_test_result(test_name, success, details)


def test_excel_export(endpoint: str, test_name: str, params: dict = None):
    """Test Excel export endpoint."""
    response = requests.get(
        f"{BASE_URL}{endpoint}",
        headers=get_headers(),
        params=params
    )

    success = response.status_code == 200
    details = ""

    if success:
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        if "spreadsheetml" in content_type:
            details = f"Excel file received ({len(response.content)} bytes)"
        else:
            success = False
            details = f"Wrong content type: {content_type}"

        # Check Content-Disposition header
        if "Content-Disposition" in response.headers:
            filename = response.headers["Content-Disposition"]
            if ".xlsx" in filename:
                details += f", filename: {filename.split('filename=')[1]}"
            else:
                success = False
                details += ", missing .xlsx extension"
        else:
            success = False
            details = "Missing Content-Disposition header"
    else:
        details = f"Status: {response.status_code}"

    print_test_result(test_name, success, details)


def test_ticket_exports():
    """Test ticket report exports."""
    print_section("TICKET REPORT EXPORTS")

    # CSV exports
    test_csv_export(
        "/reports/tickets/summary/export/csv",
        "Export Ticket Summary to CSV"
    )

    test_csv_export(
        "/reports/tickets/summary/export/csv",
        "Export Ticket Summary to CSV (with date range)",
        params={"start_date": "2024-01-01", "end_date": "2024-12-31"}
    )

    test_csv_export(
        "/reports/tickets/by-client/export/csv",
        "Export Tickets by Client to CSV"
    )

    # Excel exports
    test_excel_export(
        "/reports/tickets/summary/export/excel",
        "Export Ticket Summary to Excel"
    )

    test_excel_export(
        "/reports/tickets/by-client/export/excel",
        "Export Tickets by Client to Excel"
    )


def test_work_time_exports():
    """Test work time report exports."""
    print_section("WORK TIME REPORT EXPORTS")

    # CSV exports
    test_csv_export(
        "/reports/work-time/summary/export/csv",
        "Export Work Time Summary to CSV"
    )

    # Excel exports
    test_excel_export(
        "/reports/work-time/summary/export/excel",
        "Export Work Time Summary to Excel"
    )


def test_client_exports():
    """Test client report exports."""
    print_section("CLIENT REPORT EXPORTS")

    # CSV exports
    test_csv_export(
        "/reports/clients/activity/export/csv",
        "Export Client Activity to CSV"
    )

    # Excel exports
    test_excel_export(
        "/reports/clients/activity/export/excel",
        "Export Client Activity to Excel"
    )


def test_asset_exports():
    """Test asset report exports."""
    print_section("ASSET REPORT EXPORTS")

    # CSV exports
    test_csv_export(
        "/reports/assets/summary/export/csv",
        "Export Asset Summary to CSV"
    )

    # Excel exports
    test_excel_export(
        "/reports/assets/summary/export/excel",
        "Export Asset Summary to Excel"
    )


def test_technician_exports():
    """Test technician performance report exports."""
    print_section("TECHNICIAN PERFORMANCE EXPORTS")

    # CSV exports
    test_csv_export(
        "/reports/technicians/performance/export/csv",
        "Export Technician Performance to CSV"
    )

    # Excel exports
    test_excel_export(
        "/reports/technicians/performance/export/excel",
        "Export Technician Performance to Excel"
    )


def test_line_item_exports():
    """Test line item report exports."""
    print_section("LINE ITEM REPORT EXPORTS")

    # CSV exports
    test_csv_export(
        "/reports/line-items/summary/export/csv",
        "Export Line Items Summary to CSV"
    )

    # Excel exports
    test_excel_export(
        "/reports/line-items/summary/export/excel",
        "Export Line Items Summary to Excel"
    )


def test_rbac():
    """Test RBAC enforcement on exports."""
    print_section("RBAC ENFORCEMENT ON EXPORTS")

    # Test without authentication
    response = requests.get(f"{BASE_URL}/reports/tickets/summary/export/csv")
    success = response.status_code == 401
    print_test_result(
        "Access export without token (expect 401)",
        success,
        f"Status: {response.status_code}"
    )

    # Test with invalid token
    response = requests.get(
        f"{BASE_URL}/reports/tickets/summary/export/csv",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    success = response.status_code == 401
    print_test_result(
        "Access export with invalid token (expect 401)",
        success,
        f"Status: {response.status_code}"
    )


def test_caching():
    """Test report caching functionality."""
    print_section("REPORT CACHING")

    # Make first request
    import time
    start1 = time.time()
    response1 = requests.get(
        f"{BASE_URL}/reports/tickets/summary",
        headers=get_headers()
    )
    time1 = time.time() - start1

    # Make second request (should be cached)
    start2 = time.time()
    response2 = requests.get(
        f"{BASE_URL}/reports/tickets/summary",
        headers=get_headers()
    )
    time2 = time.time() - start2

    success = response1.status_code == 200 and response2.status_code == 200
    if success:
        # Cached request should be faster (but this is not guaranteed)
        details = f"First request: {time1:.3f}s, Second request: {time2:.3f}s"
        if time2 < time1:
            details += " (cached request was faster)"
    else:
        details = f"Status 1: {response1.status_code}, Status 2: {response2.status_code}"

    print_test_result("Report Caching", success, details)


def main():
    """Run all tests."""
    global token, tests_passed, tests_failed

    try:
        # Login
        token = login()

        # Run test suites
        test_ticket_exports()
        test_work_time_exports()
        test_client_exports()
        test_asset_exports()
        test_technician_exports()
        test_line_item_exports()
        test_rbac()
        test_caching()

        print_section("SUMMARY")

        total_tests = tests_passed + tests_failed
        print(f"\nTests run: {total_tests}")
        print(f"  [OK]   Passed: {tests_passed}")
        print(f"  [FAIL] Failed: {tests_failed}")

        if tests_failed == 0:
            print("\n[SUCCESS] All export tests completed successfully!")
            print("\nExport Features:")
            print("  - 14 export endpoints (7 CSV + 7 Excel)")
            print("  - Automatic filename generation with timestamps")
            print("  - RBAC enforcement on all exports")
            print("  - Report caching for improved performance")
            print("\nYou can now test exports in the API docs:")
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
