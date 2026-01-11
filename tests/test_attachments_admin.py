"""
Test script for Attachments and Admin endpoints.

This script tests:
- File upload/download (attachments)
- RBAC enforcement on attachments
- Ticket status admin CRUD
- Asset type admin CRUD
- Asset property definition admin CRUD

Prerequisites:
1. Server must be running: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
2. Database must have migrations applied: alembic upgrade head
3. Must have test data from previous test scripts
"""

import requests
import io
import sys
import time
from typing import Optional

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "change_me_now"

# Global variables
token: Optional[str] = None
ticket_id: Optional[str] = None
attachment_id: Optional[str] = None
status_id: Optional[str] = None
asset_type_id: Optional[str] = None
property_def_id: Optional[str] = None

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
    """Get a ticket for testing attachments."""
    global ticket_id

    print_section("SETUP PREREQUISITES")

    # Get first ticket
    response = requests.get(
        f"{BASE_URL}/tickets",
        headers=get_headers()
    )

    if response.status_code == 200:
        data = response.json()
        if data["total"] > 0:
            ticket_id = data["items"][0]["id"]
            print(f"\n>> Using existing ticket_id: {ticket_id}")
        else:
            print("[WARNING] No tickets found. Some tests may be limited.")
    else:
        print("[WARNING] Failed to get tickets. Some tests may be limited.")

    print(">> Prerequisites setup complete")


def test_attachment_upload():
    """Test file upload."""
    global attachment_id

    print_section("ATTACHMENT UPLOAD")

    if not ticket_id:
        print("[SKIP] No ticket available for attachment test")
        return

    # Create a test file
    test_file_content = b"This is a test PDF file content."
    test_file = io.BytesIO(test_file_content)

    # Upload file
    response = requests.post(
        f"{BASE_URL}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "linked_type": "ticket",
            "linked_id": ticket_id
        },
        files={
            "file": ("test_document.pdf", test_file, "application/pdf")
        }
    )

    success = response.status_code == 201
    if success:
        attachment_id = response.json()["id"]
        details = f"Uploaded file ID: {attachment_id}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"

    print_test_result("Upload attachment", success, details)


def test_attachment_list():
    """Test listing attachments."""
    print_section("ATTACHMENT LISTING")

    if not ticket_id:
        print("[SKIP] No ticket available for attachment test")
        return

    # List attachments for ticket
    response = requests.get(
        f"{BASE_URL}/attachments?linked_type=ticket&linked_id={ticket_id}",
        headers=get_headers()
    )

    success = response.status_code == 200
    if success:
        data = response.json()
        details = f"Found {data['total']} attachment(s)"
    else:
        details = f"Status: {response.status_code}"

    print_test_result("List attachments", success, details)


def test_attachment_download():
    """Test file download."""
    print_section("ATTACHMENT DOWNLOAD")

    if not attachment_id:
        print("[SKIP] No attachment available for download test")
        return

    # Download file
    response = requests.get(
        f"{BASE_URL}/attachments/{attachment_id}/download",
        headers=get_headers()
    )

    success = response.status_code == 200
    if success:
        details = f"Downloaded {len(response.content)} bytes"
    else:
        details = f"Status: {response.status_code}"

    print_test_result("Download attachment", success, details)


def test_attachment_rbac():
    """Test RBAC enforcement on attachments."""
    print_section("ATTACHMENT RBAC")

    if not attachment_id:
        print("[SKIP] No attachment available for RBAC test")
        return

    # Test without authentication
    response = requests.get(f"{BASE_URL}/attachments")
    success = response.status_code == 401
    print_test_result("Access without token (expect 401)", success, f"Status: {response.status_code}")

    # Test with invalid token
    response = requests.get(
        f"{BASE_URL}/attachments",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    success = response.status_code == 401
    print_test_result("Access with invalid token (expect 401)", success, f"Status: {response.status_code}")


def test_ticket_status_admin():
    """Test ticket status admin endpoints."""
    global status_id

    print_section("TICKET STATUS ADMIN")

    # 1. List statuses
    response = requests.get(
        f"{BASE_URL}/admin/ticket-statuses",
        headers=get_headers()
    )
    success = response.status_code == 200
    if success:
        statuses = response.json()
        details = f"Found {len(statuses)} status(es)"
    else:
        details = f"Status: {response.status_code}"
    print_test_result("List ticket statuses", success, details)

    # 2. Create custom status (with unique code)
    unique_code = f"CUSTOM_TEST_{int(time.time())}"
    response = requests.post(
        f"{BASE_URL}/admin/ticket-statuses",
        headers=get_headers(),
        json={
            "code": unique_code,
            "name_en": "Custom Test Status",
            "name_he": "סטטוס בדיקה מותאם",
            "description": "Test status for automated testing",
            "is_closed_state": False,
            "sort_order": 100
        }
    )
    success = response.status_code == 201
    if success:
        status_id = response.json()["id"]
        details = f"Created status ID: {status_id}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"
    print_test_result("Create ticket status", success, details)

    # 3. Update status
    if status_id:
        response = requests.patch(
            f"{BASE_URL}/admin/ticket-statuses/{status_id}",
            headers=get_headers(),
            json={
                "description": "Updated description"
            }
        )
        success = response.status_code == 200
        print_test_result("Update ticket status", success, f"Status: {response.status_code}")

    # 4. Get status
    if status_id:
        response = requests.get(
            f"{BASE_URL}/admin/ticket-statuses/{status_id}",
            headers=get_headers()
        )
        success = response.status_code == 200
        print_test_result("Get ticket status", success, f"Status: {response.status_code}")

    # 5. Delete status (soft delete)
    if status_id:
        response = requests.delete(
            f"{BASE_URL}/admin/ticket-statuses/{status_id}",
            headers=get_headers()
        )
        success = response.status_code == 204
        print_test_result("Delete ticket status", success, f"Status: {response.status_code}")


def test_asset_type_admin():
    """Test asset type admin endpoints."""
    global asset_type_id

    print_section("ASSET TYPE ADMIN")

    # 1. List asset types
    response = requests.get(
        f"{BASE_URL}/admin/asset-types",
        headers=get_headers()
    )
    success = response.status_code == 200
    if success:
        types = response.json()
        details = f"Found {len(types)} type(s)"
    else:
        details = f"Status: {response.status_code}"
    print_test_result("List asset types", success, details)

    # 2. Create custom asset type (with unique code)
    unique_code = f"CUSTOM_DEVICE_{int(time.time())}"
    response = requests.post(
        f"{BASE_URL}/admin/asset-types",
        headers=get_headers(),
        json={
            "code": unique_code,
            "name_en": "Custom Device",
            "name_he": "מכשיר מותאם",
            "description": "Test asset type"
        }
    )
    success = response.status_code == 201
    if success:
        asset_type_id = response.json()["id"]
        details = f"Created asset type ID: {asset_type_id}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"
    print_test_result("Create asset type", success, details)

    # 3. Update asset type
    if asset_type_id:
        response = requests.patch(
            f"{BASE_URL}/admin/asset-types/{asset_type_id}",
            headers=get_headers(),
            json={
                "description": "Updated description"
            }
        )
        success = response.status_code == 200
        print_test_result("Update asset type", success, f"Status: {response.status_code}")

    # 4. Get asset type
    if asset_type_id:
        response = requests.get(
            f"{BASE_URL}/admin/asset-types/{asset_type_id}",
            headers=get_headers()
        )
        success = response.status_code == 200
        print_test_result("Get asset type", success, f"Status: {response.status_code}")

    # 5. Delete asset type (soft delete)
    if asset_type_id:
        response = requests.delete(
            f"{BASE_URL}/admin/asset-types/{asset_type_id}",
            headers=get_headers()
        )
        success = response.status_code == 204
        print_test_result("Delete asset type", success, f"Status: {response.status_code}")


def test_property_definition_admin():
    """Test asset property definition admin endpoints."""
    global property_def_id

    print_section("ASSET PROPERTY DEFINITION ADMIN")

    # Get an existing asset type to use
    response = requests.get(
        f"{BASE_URL}/asset-types",
        headers=get_headers()
    )
    if response.status_code != 200 or len(response.json()) == 0:
        print("[SKIP] No asset types available for property definition test")
        return

    test_asset_type_id = response.json()[0]["id"]

    # 1. List property definitions
    response = requests.get(
        f"{BASE_URL}/admin/asset-property-definitions?asset_type_id={test_asset_type_id}",
        headers=get_headers()
    )
    success = response.status_code == 200
    if success:
        defs = response.json()
        details = f"Found {len(defs)} definition(s)"
    else:
        details = f"Status: {response.status_code}"
    print_test_result("List property definitions", success, details)

    # 2. Create property definition (with unique key)
    unique_key = f"custom_test_field_{int(time.time())}"
    response = requests.post(
        f"{BASE_URL}/admin/asset-property-definitions",
        headers=get_headers(),
        json={
            "asset_type_id": test_asset_type_id,
            "key": unique_key,
            "label_en": "Custom Test Field",
            "label_he": "שדה בדיקה מותאם",
            "data_type": "string",
            "required": False,
            "visibility": "internal_only",
            "sort_order": 100
        }
    )
    success = response.status_code == 201
    if success:
        property_def_id = response.json()["id"]
        details = f"Created property definition ID: {property_def_id}"
    else:
        details = f"Status: {response.status_code}, Error: {response.text}"
    print_test_result("Create property definition", success, details)

    # 3. Update property definition
    if property_def_id:
        response = requests.patch(
            f"{BASE_URL}/admin/asset-property-definitions/{property_def_id}",
            headers=get_headers(),
            json={
                "required": True
            }
        )
        success = response.status_code == 200
        print_test_result("Update property definition", success, f"Status: {response.status_code}")

    # 4. Get property definition
    if property_def_id:
        response = requests.get(
            f"{BASE_URL}/admin/asset-property-definitions/{property_def_id}",
            headers=get_headers()
        )
        success = response.status_code == 200
        print_test_result("Get property definition", success, f"Status: {response.status_code}")

    # 5. Delete property definition (soft delete)
    if property_def_id:
        response = requests.delete(
            f"{BASE_URL}/admin/asset-property-definitions/{property_def_id}",
            headers=get_headers()
        )
        success = response.status_code == 204
        print_test_result("Delete property definition", success, f"Status: {response.status_code}")


def test_admin_rbac():
    """Test RBAC enforcement on admin endpoints."""
    print_section("ADMIN RBAC")

    # Test without authentication
    response = requests.get(f"{BASE_URL}/admin/ticket-statuses")
    success = response.status_code == 401
    print_test_result("Access admin without token (expect 401)", success, f"Status: {response.status_code}")

    # Test with invalid token
    response = requests.get(
        f"{BASE_URL}/admin/ticket-statuses",
        headers={"Authorization": "Bearer invalid_token_12345"}
    )
    success = response.status_code == 401
    print_test_result("Access admin with invalid token (expect 401)", success, f"Status: {response.status_code}")


def main():
    """Run all tests."""
    global token, tests_passed, tests_failed

    try:
        # Login
        token = login()

        # Setup
        setup_prerequisites()

        # Run test suites
        test_attachment_upload()
        test_attachment_list()
        test_attachment_download()
        test_attachment_rbac()
        test_ticket_status_admin()
        test_asset_type_admin()
        test_property_definition_admin()
        test_admin_rbac()

        print_section("SUMMARY")

        total_tests = tests_passed + tests_failed
        print(f"\nTests run: {total_tests}")
        print(f"  [OK]   Passed: {tests_passed}")
        print(f"  [FAIL] Failed: {tests_failed}")

        if tests_failed == 0:
            print("\n[SUCCESS] All tests completed successfully!")
            print("\nNew Features Available:")
            print("  - File attachments (upload/download)")
            print("  - Ticket status admin (CRUD)")
            print("  - Asset type admin (CRUD)")
            print("  - Asset property definition admin (CRUD)")
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
