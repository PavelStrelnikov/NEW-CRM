"""
Integration tests for data isolation and cross-client security.

Critical security tests to ensure:
- CLIENT_USER cannot access other client's data
- CLIENT_ADMIN scoped to their own client only
- Portal users cannot access internal APIs
- Site-based access control works correctly

Covers: Authorization boundaries, data leak prevention, role isolation
"""

import pytest
from uuid import uuid4


class TestCrossClientIsolation:
    """Verify clients cannot access each other's data."""

    def test_client_user_cannot_view_other_client_tickets(
        self, test_client, client_user_with_site_access, test_client_record, test_site, ticket_factory, db_session
    ):
        """CLIENT_USER should not see tickets from other clients."""
        # Create another client and ticket
        from app.models.clients import Client, Site

        other_client = Client(
            id=uuid4(),
            name="Other Client Corp",
            status="active"
        )
        db_session.add(other_client)
        db_session.commit()

        other_site = Site(
            id=uuid4(),
            client_id=other_client.id,
            name="Other Site",
            is_default=True
        )
        db_session.add(other_site)
        db_session.commit()

        # Create ticket for other client
        other_ticket = ticket_factory(
            client_id=other_client.id,
            site_id=other_site.id,
            title="Other Client's Ticket"
        )

        # Login as client_user
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        token = response.json()["access_token"]

        # Try to access other client's ticket
        response = test_client.get(
            f"/api/v1/portal/tickets/{other_ticket.id}",
            headers={"Authorization": f"Bearer {token}"}
        )

        # Should return 404 (not found) not 403, to avoid information disclosure
        assert response.status_code == 404

    def test_client_admin_cannot_view_other_client_data(
        self, test_client, client_admin_user, test_client_record, db_session, ticket_factory
    ):
        """CLIENT_ADMIN should only see their own client's data."""
        # Create another client and ticket
        from app.models.clients import Client, Site

        other_client = Client(
            id=uuid4(),
            name="Other Client Corp",
            status="active"
        )
        db_session.add(other_client)
        db_session.commit()

        other_site = Site(
            id=uuid4(),
            client_id=other_client.id,
            name="Other Site",
            is_default=True
        )
        db_session.add(other_site)
        db_session.commit()

        # Create ticket for other client
        other_ticket = ticket_factory(
            client_id=other_client.id,
            site_id=other_site.id,
            title="Other Client's Ticket"
        )

        # Login as client admin
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "clientadmin@test.com",
                "password": "admin123"
            }
        )

        assert response.status_code == 200
        token = response.json()["access_token"]

        # Try to access other client's ticket
        response = test_client.get(
            f"/api/v1/portal/tickets/{other_ticket.id}",
            headers={"Authorization": f"Bearer {token}"}
        )

        # Should return 404 (not 403 to avoid information disclosure)
        assert response.status_code == 404


class TestPortalInternalAPIIsolation:
    """Verify portal users cannot access internal APIs."""

    def test_portal_user_cannot_access_internal_ticket_endpoints(
        self, test_client, client_user_with_site_access
    ):
        """Portal user token should be rejected on internal endpoints."""
        # Login as portal user
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        portal_token = response.json()["access_token"]

        # Try to access internal tickets list endpoint
        response = test_client.get(
            "/api/v1/tickets",
            headers={"Authorization": f"Bearer {portal_token}"}
        )

        # Should be rejected (401 or 403)
        assert response.status_code in [401, 403]

    def test_portal_user_cannot_assign_tickets(
        self, test_client, client_user_with_site_access, ticket_factory, technician_user
    ):
        """Portal users cannot use ticket assignment endpoints."""
        # Create a ticket
        ticket = ticket_factory(assigned_to_internal_user_id=None)

        # Login as portal user
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        portal_token = response.json()["access_token"]

        # Try to assign ticket
        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers={"Authorization": f"Bearer {portal_token}"},
            json={"assigned_to_internal_user_id": str(technician_user.id)}
        )

        # Should be rejected
        assert response.status_code in [401, 403]

    def test_internal_user_cannot_use_portal_endpoints(
        self, test_client, admin_token
    ):
        """Internal user token should be rejected on portal endpoints."""
        # Try to access portal tickets with internal token
        response = test_client.get(
            "/api/v1/portal/tickets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Should be rejected (wrong token type)
        assert response.status_code in [401, 403]


class TestSiteBasedAccessControl:
    """Verify site-based access control for CLIENT_USER role."""

    def test_client_user_can_only_view_allowed_sites(
        self, test_client, client_user_with_site_access, test_site, test_client_record, db_session, ticket_factory
    ):
        """CLIENT_USER should only see tickets from sites they have access to."""
        # Create another site for same client (without access)
        from app.models.clients import Site

        restricted_site = Site(
            id=uuid4(),
            client_id=test_client_record.id,
            name="Restricted Site",
            is_default=False
        )
        db_session.add(restricted_site)
        db_session.commit()

        # Create tickets for both sites
        allowed_ticket = ticket_factory(
            client_id=test_client_record.id,
            site_id=test_site.id,
            title="Allowed Site Ticket"
        )

        restricted_ticket = ticket_factory(
            client_id=test_client_record.id,
            site_id=restricted_site.id,
            title="Restricted Site Ticket"
        )

        # Login as client user
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        token = response.json()["access_token"]

        # Should be able to view allowed site ticket
        response = test_client.get(
            f"/api/v1/portal/tickets/{allowed_ticket.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

        # Should NOT be able to view restricted site ticket
        response = test_client.get(
            f"/api/v1/portal/tickets/{restricted_ticket.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Either 403 (Forbidden) or 404 (Not Found) is acceptable for access denial
        assert response.status_code in [403, 404]

    def test_client_admin_can_view_all_client_sites(
        self, test_client, client_admin_user, test_client_record, db_session, ticket_factory, test_site
    ):
        """CLIENT_ADMIN should see tickets from all sites of their client."""
        # Create another site for same client
        from app.models.clients import Site

        site2 = Site(
            id=uuid4(),
            client_id=test_client_record.id,
            name="Site 2",
            is_default=False
        )
        db_session.add(site2)
        db_session.commit()

        # Create tickets for both sites
        ticket1 = ticket_factory(
            client_id=test_client_record.id,
            site_id=test_site.id,
            title="Site 1 Ticket"
        )

        ticket2 = ticket_factory(
            client_id=test_client_record.id,
            site_id=site2.id,
            title="Site 2 Ticket"
        )

        # Login as client admin
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "clientadmin@test.com",
                "password": "admin123"
            }
        )

        assert response.status_code == 200
        token = response.json()["access_token"]

        # Should be able to view tickets from both sites
        response = test_client.get(
            f"/api/v1/portal/tickets/{ticket1.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

        response = test_client.get(
            f"/api/v1/portal/tickets/{ticket2.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200


class TestTokenTypeValidation:
    """Verify tokens are validated for correct type (internal vs portal)."""

    def test_portal_token_rejected_on_internal_me_endpoint(
        self, test_client, client_user_with_site_access
    ):
        """Portal token should be rejected on internal /auth/me endpoint."""
        # Get portal token
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        portal_token = response.json()["access_token"]

        # Try to use portal token on internal /me endpoint (if it exists)
        response = test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {portal_token}"}
        )

        # Should be rejected (wrong token type)
        assert response.status_code in [401, 403, 404]  # 404 if endpoint doesn't exist

    def test_internal_token_rejected_on_portal_me_endpoint(
        self, test_client, admin_token
    ):
        """Internal token should be rejected on portal /auth/me endpoint."""
        # Try to use internal token on portal /me endpoint
        response = test_client.get(
            "/api/v1/portal/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )

        # Should be rejected (wrong token type)
        assert response.status_code in [401, 403]
