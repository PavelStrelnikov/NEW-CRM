"""
Test if the application can start with authentication module.
"""
import sys

try:
    print("Importing FastAPI app...")
    from app.main import app
    print("[OK] FastAPI app imported successfully")

    print("\nChecking authentication endpoints...")
    routes = [route.path for route in app.routes]
    auth_routes = [route for route in routes if '/auth/' in route]

    if auth_routes:
        print(f"[OK] Found {len(auth_routes)} authentication route(s):")
        for route in auth_routes:
            print(f"   - {route}")
    else:
        print("[ERROR] No authentication routes found!")
        sys.exit(1)

    print("\nImporting authentication modules...")
    from app.auth.security import pwd_hasher, token_manager
    from app.auth.service import auth_service
    from app.auth.dependencies import get_current_user
    print("[OK] All authentication modules imported successfully")

    print("\nTesting password hashing...")
    test_password = "test123"
    hashed = pwd_hasher.hash_password(test_password)
    is_valid = pwd_hasher.verify_password(test_password, hashed)

    if is_valid:
        print("[OK] Password hashing works correctly")
    else:
        print("[ERROR] Password verification failed!")
        sys.exit(1)

    print("\nTesting JWT token creation...")
    test_token = token_manager.create_access_token({"sub": "test_user"})
    if test_token and len(test_token) > 20:
        print(f"[OK] JWT token created: {test_token[:50]}...")
    else:
        print("[ERROR] JWT token creation failed!")
        sys.exit(1)

    decoded = token_manager.decode_access_token(test_token)
    if decoded and decoded.get("sub") == "test_user":
        print("[OK] JWT token decoded successfully")
    else:
        print("[ERROR] JWT token decoding failed!")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("ALL CHECKS PASSED!")
    print("=" * 60)

    print("\nTo start the server, run:")
    print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    print("\nThen test authentication with:")
    print("  python test_auth.py")
    print("\nOr visit:")
    print("  http://localhost:8000/docs")

except Exception as e:
    print(f"\n[ERROR] {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
