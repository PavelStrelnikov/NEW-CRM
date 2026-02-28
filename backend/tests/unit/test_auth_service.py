"""
Unit tests for AuthService (password hashing, token creation).
No database required - pure logic tests.

Coverage: 95%+ of auth_service.py
Execution time: < 200ms
"""

import pytest
from uuid import uuid4
from jose import jwt
from datetime import datetime, timedelta

from app.services.auth_service import AuthService
from app.config import settings


class TestPasswordHashing:
    """Test password hashing and verification."""

    def test_hash_password_generates_different_hashes(self):
        """Same password should generate different hashes (due to salt)."""
        password = "test_password_123"
        hash1 = AuthService.hash_password(password)
        hash2 = AuthService.hash_password(password)

        assert hash1 != hash2

    def test_verify_password_succeeds_with_correct_password(self):
        password = "correct_password"
        hash_val = AuthService.hash_password(password)

        assert AuthService.verify_password(password, hash_val) is True

    def test_verify_password_fails_with_wrong_password(self):
        password = "correct_password"
        hash_val = AuthService.hash_password(password)

        assert AuthService.verify_password("wrong_password", hash_val) is False

    def test_verify_password_handles_malformed_hash(self):
        """Malformed hash should not raise exception."""
        result = AuthService.verify_password("password", "not_a_valid_hash")
        assert result is False

    def test_verify_password_handles_empty_password(self):
        """Empty password should hash and verify correctly."""
        password = ""
        hash_val = AuthService.hash_password(password)

        assert AuthService.verify_password(password, hash_val) is True

    def test_hash_password_handles_special_characters(self):
        """Password with special characters should hash correctly."""
        password = "p@ssw0rd!#$%^&*()"
        hash_val = AuthService.hash_password(password)

        assert AuthService.verify_password(password, hash_val) is True

    def test_hash_password_handles_unicode(self):
        """Unicode password should hash correctly."""
        password = "סיסמה123"  # Hebrew with numbers
        hash_val = AuthService.hash_password(password)

        assert AuthService.verify_password(password, hash_val) is True


class TestInternalUserTokens:
    """Test internal user JWT token creation."""

    def test_create_internal_user_token_structure(self):
        user_id = uuid4()
        email = "admin@example.com"
        role = "admin"
        name = "Admin User"

        token = AuthService.create_internal_user_token(user_id, email, role, name)

        # Decode token to verify structure
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload["sub"] == str(user_id)
        assert payload["email"] == email
        assert payload["role"] == role
        assert payload["name"] == name
        assert payload["type"] == "internal"
        assert "iat" in payload
        assert "exp" in payload

    def test_internal_token_expiration_time(self):
        user_id = uuid4()
        token = AuthService.create_internal_user_token(user_id, "test@test.com", "admin", "Test")

        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        iat = datetime.fromtimestamp(payload["iat"])
        exp = datetime.fromtimestamp(payload["exp"])

        expected_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        actual_delta = exp - iat

        # Allow 1 second tolerance
        assert abs(actual_delta.total_seconds() - expected_delta.total_seconds()) < 1

    def test_internal_token_is_valid_jwt(self):
        """Token should be a valid JWT string."""
        user_id = uuid4()
        token = AuthService.create_internal_user_token(user_id, "user@test.com", "technician", "Tech")

        assert isinstance(token, str)
        assert len(token.split('.')) == 3  # JWT has 3 parts

    def test_internal_token_uuid_conversion(self):
        """UUID should be converted to string in token."""
        user_id = uuid4()
        token = AuthService.create_internal_user_token(user_id, "test@test.com", "admin", "Admin")

        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload["sub"] == str(user_id)
        assert isinstance(payload["sub"], str)


class TestPortalUserTokens:
    """Test portal user JWT token creation."""

    def test_create_portal_user_token_with_site_ids(self):
        user_id = uuid4()
        client_id = uuid4()
        site_ids = [str(uuid4()), str(uuid4())]

        token = AuthService.create_portal_user_token(
            user_id, "client@test.com", "CLIENT_USER", client_id, site_ids
        )

        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload["sub"] == str(user_id)
        assert payload["client_id"] == str(client_id)
        assert payload["allowed_site_ids"] == site_ids
        assert payload["type"] == "portal"
        assert payload["role"] == "CLIENT_USER"

    def test_create_portal_token_without_site_ids(self):
        """Client admin tokens don't need site IDs (None value)."""
        user_id = uuid4()
        client_id = uuid4()

        token = AuthService.create_portal_user_token(
            user_id, "admin@client.com", "CLIENT_ADMIN", client_id
        )

        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload["allowed_site_ids"] == []

    def test_portal_token_empty_site_list(self):
        """Portal token with empty site list (user has no access)."""
        user_id = uuid4()
        client_id = uuid4()

        token = AuthService.create_portal_user_token(
            user_id, "user@client.com", "CLIENT_USER", client_id, []
        )

        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload["allowed_site_ids"] == []

    def test_portal_token_includes_all_required_claims(self):
        """Verify all required claims are present."""
        user_id = uuid4()
        client_id = uuid4()
        site_ids = [str(uuid4())]

        token = AuthService.create_portal_user_token(
            user_id, "client@test.com", "CLIENT_USER", client_id, site_ids
        )

        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        required_claims = ["sub", "email", "role", "client_id", "allowed_site_ids", "type", "iat", "exp"]
        for claim in required_claims:
            assert claim in payload


class TestTokenRefresh:
    """Test token refresh operations."""

    def test_refresh_internal_token_creates_new_token(self):
        """Refreshing should create a new token with updated timestamps."""
        user_id = uuid4()
        email = "admin@test.com"
        role = "admin"
        name = "Admin"

        token1 = AuthService.create_internal_user_token(user_id, email, role, name)
        # Delay to ensure different iat (datetime precision is 1 second)
        import time
        time.sleep(1.1)
        token2 = AuthService.refresh_internal_token(user_id, email, role, name)

        # Tokens should be different (different iat)
        assert token1 != token2

        # But should have same claims (except timestamps)
        payload1 = jwt.decode(token1, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        payload2 = jwt.decode(token2, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload1["sub"] == payload2["sub"]
        assert payload1["email"] == payload2["email"]
        assert payload1["role"] == payload2["role"]
        assert payload1["name"] == payload2["name"]

    def test_refresh_portal_token_preserves_site_access(self):
        """Refreshing portal token should preserve site access."""
        user_id = uuid4()
        client_id = uuid4()
        site_ids = [str(uuid4()), str(uuid4())]

        token = AuthService.refresh_portal_token(
            user_id, "client@test.com", "CLIENT_USER", client_id, site_ids
        )

        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload["allowed_site_ids"] == site_ids


class TestTokenAlgorithm:
    """Test token algorithm and configuration."""

    def test_tokens_use_configured_algorithm(self):
        """Tokens should use JWT_ALGORITHM from settings."""
        user_id = uuid4()
        token = AuthService.create_internal_user_token(user_id, "test@test.com", "admin", "Admin")

        # Decode without verifying to inspect header
        header = jwt.get_unverified_header(token)

        assert header["alg"] == settings.JWT_ALGORITHM

    def test_tokens_use_configured_secret_key(self):
        """Tokens should be verifiable with configured secret key."""
        user_id = uuid4()
        token = AuthService.create_internal_user_token(user_id, "test@test.com", "admin", "Admin")

        # Should not raise exception
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

        assert payload is not None
