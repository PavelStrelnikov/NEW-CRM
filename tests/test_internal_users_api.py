"""
Manual test script for Internal Users Management API.

Run this after starting the backend server:
    uvicorn app.main:app --reload

Usage:
    python test_internal_users_api.py
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

# Colors for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'


def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")


def print_error(message):
    print(f"{RED}✗ {message}{RESET}")


def print_info(message):
    print(f"{BLUE}ℹ {message}{RESET}")


def test_internal_users_api():
    """Test internal users management API."""
    print("\n" + "="*60)
    print("Internal Users Management API Test")
    print("="*60 + "\n")

    # Step 1: Login as admin
    print_info("Step 1: Logging in as admin...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": "admin@example.com",
            "password": "change_me_now"
        }
    )

    if login_response.status_code != 200:
        print_error(f"Login failed: {login_response.status_code}")
        print(login_response.json())
        return

    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print_success("Login successful")

    # Step 2: List existing users
    print_info("\nStep 2: Listing existing internal users...")
    list_response = requests.get(
        f"{BASE_URL}/admin/users",
        headers=headers
    )

    if list_response.status_code != 200:
        print_error(f"List users failed: {list_response.status_code}")
        print(list_response.json())
        return

    users_data = list_response.json()
    print_success(f"Found {users_data['total']} users")
    print(f"  Page: {users_data.get('page', 'N/A')}, Page size: {users_data.get('page_size', 'N/A')}")

    for user in users_data['items'][:3]:  # Show first 3
        print(f"  - {user['name']} ({user['email']}) - {user['role']}")

    # Step 3: Create a test user
    print_info("\nStep 3: Creating a test user...")
    create_response = requests.post(
        f"{BASE_URL}/admin/users",
        headers=headers,
        json={
            "name": "Test Technician",
            "email": f"test.tech.{len(users_data['items'])}@example.com",
            "phone": "050-1234567",
            "password": "TestPass123",
            "role": "technician",
            "preferred_locale": "he",
            "is_active": True
        }
    )

    if create_response.status_code == 201:
        new_user = create_response.json()
        print_success(f"User created: {new_user['name']} (ID: {new_user['id']})")
        test_user_id = new_user['id']
    elif create_response.status_code == 400 and "already registered" in create_response.text:
        print_info("Test user already exists (email conflict)")
        # Get existing user for update test
        test_user_id = users_data['items'][0]['id'] if users_data['items'] else None
    else:
        print_error(f"Create user failed: {create_response.status_code}")
        print(create_response.json())
        return

    # Step 4: Get user by ID
    if test_user_id:
        print_info(f"\nStep 4: Getting user by ID: {test_user_id}...")
        get_response = requests.get(
            f"{BASE_URL}/admin/users/{test_user_id}",
            headers=headers
        )

        if get_response.status_code == 200:
            user = get_response.json()
            print_success(f"User retrieved: {user['name']} ({user['email']})")
            print(f"  Role: {user['role']}, Active: {user['is_active']}")
        else:
            print_error(f"Get user failed: {get_response.status_code}")

    # Step 5: Update user
    if test_user_id:
        print_info(f"\nStep 5: Updating user...")
        update_response = requests.patch(
            f"{BASE_URL}/admin/users/{test_user_id}",
            headers=headers,
            json={
                "phone": "052-9876543",
                "is_active": True
            }
        )

        if update_response.status_code == 200:
            updated_user = update_response.json()
            print_success(f"User updated: {updated_user['phone']}")
        else:
            print_error(f"Update user failed: {update_response.status_code}")
            print(update_response.json())

    # Step 6: Test search
    print_info("\nStep 6: Testing search functionality...")
    search_response = requests.get(
        f"{BASE_URL}/admin/users?q=admin",
        headers=headers
    )

    if search_response.status_code == 200:
        search_data = search_response.json()
        print_success(f"Search returned {len(search_data['items'])} results")
    else:
        print_error(f"Search failed: {search_response.status_code}")

    # Step 7: Test role filter
    print_info("\nStep 7: Testing role filter...")
    filter_response = requests.get(
        f"{BASE_URL}/admin/users?role=technician",
        headers=headers
    )

    if filter_response.status_code == 200:
        filter_data = filter_response.json()
        print_success(f"Role filter returned {len(filter_data['items'])} technicians")
    else:
        print_error(f"Role filter failed: {filter_response.status_code}")

    print("\n" + "="*60)
    print("All tests completed!")
    print("="*60 + "\n")


if __name__ == "__main__":
    try:
        test_internal_users_api()
    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to backend server!")
        print_info("Make sure the server is running: uvicorn app.main:app --reload")
    except Exception as e:
        print_error(f"Test failed with error: {str(e)}")
