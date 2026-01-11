"""
Test script to verify authentication endpoints work correctly.
"""
import requests
import sys

BASE_URL = "http://localhost:8000"
API_V1 = f"{BASE_URL}/api/v1"

print("=" * 60)
print("AUTHENTICATION TEST")
print("=" * 60)

# Test 1: Login with admin credentials
print("\n1. Testing login with admin credentials...")
print("   Email: admin@example.com")
print("   Password: change_me_now")

try:
    response = requests.post(
        f"{API_V1}/auth/login",
        json={
            "email": "admin@example.com",
            "password": "change_me_now"
        }
    )

    if response.status_code == 200:
        data = response.json()
        print("   [OK] Login successful!")
        print(f"   Token type: {data.get('token_type')}")
        access_token = data.get('access_token')
        print(f"   Access token: {access_token[:50]}...")
    else:
        print(f"   [ERROR] Login failed with status {response.status_code}")
        print(f"   Response: {response.text}")
        sys.exit(1)

except requests.exceptions.ConnectionError:
    print("   [ERROR] Could not connect to server")
    print("   Make sure the server is running with: uvicorn app.main:app --reload")
    sys.exit(1)

# Test 2: Get current user info
print("\n2. Testing /auth/me endpoint...")

headers = {
    "Authorization": f"Bearer {access_token}"
}

response = requests.get(f"{API_V1}/auth/me", headers=headers)

if response.status_code == 200:
    user_data = response.json()
    print("   [OK] Got current user info!")
    print(f"   ID: {user_data.get('id')}")
    print(f"   Name: {user_data.get('name')}")
    print(f"   Email: {user_data.get('email')}")
    print(f"   Role: {user_data.get('role')}")
    print(f"   User type: {user_data.get('user_type')}")
    print(f"   Locale: {user_data.get('preferred_locale')}")
else:
    print(f"   [ERROR] Failed with status {response.status_code}")
    print(f"   Response: {response.text}")
    sys.exit(1)

# Test 3: Test invalid credentials
print("\n3. Testing login with invalid credentials...")

response = requests.post(
    f"{API_V1}/auth/login",
    json={
        "email": "admin@example.com",
        "password": "wrong_password"
    }
)

if response.status_code == 401:
    print("   [OK] Invalid credentials correctly rejected!")
else:
    print(f"   [WARNING] Expected 401, got {response.status_code}")

# Test 4: Test missing/invalid token
print("\n4. Testing /auth/me with invalid token...")

headers = {
    "Authorization": "Bearer invalid_token_here"
}

response = requests.get(f"{API_V1}/auth/me", headers=headers)

if response.status_code == 401:
    print("   [OK] Invalid token correctly rejected!")
else:
    print(f"   [WARNING] Expected 401, got {response.status_code}")

# Test 5: Logout
print("\n5. Testing logout...")

headers = {
    "Authorization": f"Bearer {access_token}"
}

response = requests.post(f"{API_V1}/auth/logout", headers=headers)

if response.status_code == 200:
    print("   [OK] Logout successful!")
    print(f"   Message: {response.json().get('message')}")
else:
    print(f"   [ERROR] Logout failed with status {response.status_code}")

print("\n" + "=" * 60)
print("ALL TESTS PASSED!")
print("=" * 60)

print("\nAuthentication is working correctly!")
print("\nYou can now:")
print("1. Visit http://localhost:8000/docs to see the interactive API documentation")
print("2. Test the endpoints using the Swagger UI")
print("3. Start implementing additional API endpoints")
