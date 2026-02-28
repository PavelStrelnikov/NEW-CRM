"""
Integration tests for portal authentication API.

Tests 2 endpoints:
- POST /api/v1/portal/auth/login - Portal user authentication
- GET /api/v1/portal/auth/me - Get current portal user

Covers: Credential validation, site access resolution, token generation
"""

import pytest
from uuid import uuid4


class TestPortalLoginEndpoint:
    """POST /api/v1/portal/auth/login"""

    def test_client_user_can_login_with_valid_credentials(
        self, test_client, client_user
    ):
        """CLIENT_USER should successfully login with correct credentials."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user_id"] == str(client_user.id)
        assert data["role"] == client_user.role.value

    def test_client_admin_can_login(
        self, test_client, client_admin_user
    ):
        """CLIENT_ADMIN should successfully login."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "clientadmin@test.com",
                "password": "admin123"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["role"] == "CLIENT_ADMIN"

    def test_login_fails_with_wrong_password(
        self, test_client, client_user
    ):
        """Login should fail with incorrect password."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "wrong_password"
            }
        )

        assert response.status_code == 401
        detail = response.json()["detail"]
        assert any(phrase in detail for phrase in ["Invalid credentials", "Invalid email or password", "Incorrect email or password"])

    def test_login_fails_with_nonexistent_email(
        self, test_client
    ):
        """Login should fail with non-existent email."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "password123"
            }
        )

        assert response.status_code == 401

    def test_login_fails_for_inactive_user(
        self, test_client, client_user, db_session
    ):
        """Inactive user should not be able to login."""
        # Deactivate user
        client_user.is_active = False
        db_session.commit()

        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 401

    def test_login_resolves_site_access_for_client_user(
        self, test_client, client_user_with_site_access, test_site
    ):
        """CLIENT_USER login should include allowed_site_ids from client_user_sites."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        data = response.json()

        # Token should include site access
        from jose import jwt
        from app.config import settings
        token = data["access_token"]
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert "allowed_site_ids" in payload
        assert str(test_site.id) in payload["allowed_site_ids"]

    def test_login_client_admin_has_no_site_restrictions(
        self, test_client, client_admin_user
    ):
        """CLIENT_ADMIN should have empty/null allowed_site_ids (full access)."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "clientadmin@test.com",
                "password": "admin123"
            }
        )

        assert response.status_code == 200
        data = response.json()

        # Token should have empty allowed_site_ids for admin
        from jose import jwt
        from app.config import settings
        token = data["access_token"]
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        # Admin should have empty list (no restrictions)
        assert payload.get("allowed_site_ids") is not None

    def test_login_missing_email_returns_422(
        self, test_client
    ):
        """Login without email should return validation error."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={"password": "password123"}
        )

        assert response.status_code == 422

    def test_login_missing_password_returns_422(
        self, test_client
    ):
        """Login without password should return validation error."""
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={"email": "client@test.com"}
        )

        assert response.status_code == 422


class TestPortalMeEndpoint:
    """GET /api/v1/portal/auth/me"""

    def test_authenticated_client_user_gets_profile(
        self, test_client, auth_headers_client_user, client_user
    ):
        """Authenticated CLIENT_USER should get their profile."""
        response = test_client.get(
            "/api/v1/portal/auth/me",
            headers=auth_headers_client_user
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(client_user.id)
        assert data["email"] == client_user.email
        assert data["name"] == client_user.name
        assert data["role"] == client_user.role.value
        assert data["client_id"] == str(client_user.client_id)

    def test_authenticated_client_admin_gets_profile(
        self, test_client, auth_headers_client_admin, client_admin_user
    ):
        """Authenticated CLIENT_ADMIN should get their profile."""
        response = test_client.get(
            "/api/v1/portal/auth/me",
            headers=auth_headers_client_admin
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(client_admin_user.id)
        assert data["role"] == "CLIENT_ADMIN"

    def test_unauthenticated_request_returns_401(
        self, test_client
    ):
        """Request without auth token should return 401."""
        response = test_client.get("/api/v1/portal/auth/me")

        assert response.status_code == 401

    def test_invalid_token_returns_401(
        self, test_client
    ):
        """Request with invalid token should return 401."""
        response = test_client.get(
            "/api/v1/portal/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )

        assert response.status_code == 401

    def test_internal_user_token_rejected(
        self, test_client, auth_headers_admin
    ):
        """Internal user token should be rejected on portal endpoint."""
        response = test_client.get(
            "/api/v1/portal/auth/me",
            headers=auth_headers_admin
        )

        # Should reject internal token (wrong type)
        assert response.status_code == 401

    def test_inactive_user_cannot_access_me(
        self, test_client, client_user, client_user_token, db_session
    ):
        """Inactive user should get 401."""
        # Deactivate user
        client_user.is_active = False
        db_session.commit()

        response = test_client.get(
            "/api/v1/portal/auth/me",
            headers={"Authorization": f"Bearer {client_user_token}"}
        )

        assert response.status_code == 401

    def test_me_includes_allowed_site_ids(
        self, test_client, client_user_with_site_access, allowed_site_ids
    ):
        """CLIENT_USER /me response should include allowed_site_ids from token."""
        # Login to get fresh token with site access
        login_response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        token = login_response.json()["access_token"]

        response = test_client.get(
            "/api/v1/portal/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "allowed_site_ids" in data
        # Should have site access
        assert len(data["allowed_site_ids"]) > 0
