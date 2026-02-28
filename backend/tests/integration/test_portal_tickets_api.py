"""
Integration tests for portal ticket API endpoints.

Tests portal-specific ticket operations:
- GET /portal/tickets - List tickets with filtering
- GET /portal/tickets/{id} - View ticket details
- POST /portal/tickets - Create new tickets
- Site-based access filtering for CLIENT_USER

Covers: Portal ticket CRUD, role-based filtering, site access validation
"""

import pytest
from uuid import uuid4


class TestPortalTicketsList:
    """GET /api/v1/portal/tickets"""

    def test_client_user_sees_only_allowed_site_tickets(
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

        # List tickets
        response = test_client.get(
            "/api/v1/portal/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        tickets = data.get("tickets", [])

        # Should only see allowed site ticket
        ticket_ids = [t["id"] for t in tickets]
        assert str(allowed_ticket.id) in ticket_ids
        assert str(restricted_ticket.id) not in ticket_ids

    def test_client_admin_sees_all_client_tickets(
        self, test_client, client_admin_user, test_client_record, db_session, ticket_factory, test_site
    ):
        """CLIENT_ADMIN should see all tickets from their client."""
        # Create another site
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

        # List tickets
        response = test_client.get(
            "/api/v1/portal/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        tickets = data.get("tickets", [])

        # Should see both tickets
        ticket_ids = [t["id"] for t in tickets]
        assert str(ticket1.id) in ticket_ids
        assert str(ticket2.id) in ticket_ids


class TestPortalTicketDetails:
    """GET /api/v1/portal/tickets/{id}"""

    def test_client_user_can_view_allowed_site_ticket(
        self, test_client, client_user_with_site_access, test_site, test_client_record, ticket_factory
    ):
        """CLIENT_USER can view ticket details from allowed sites."""
        ticket = ticket_factory(
            client_id=test_client_record.id,
            site_id=test_site.id,
            title="Test Ticket"
        )

        # Login
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        token = response.json()["access_token"]

        # Get ticket details
        response = test_client.get(
            f"/api/v1/portal/tickets/{ticket.id}",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        ticket_data = data.get("ticket", data)  # Try "ticket" key, fallback to root
        assert ticket_data["id"] == str(ticket.id)
        assert ticket_data["title"] == "Test Ticket"

    def test_unauthenticated_cannot_view_tickets(
        self, test_client, ticket_factory, test_client_record, test_site
    ):
        """Unauthenticated requests should be rejected."""
        ticket = ticket_factory(
            client_id=test_client_record.id,
            site_id=test_site.id
        )

        response = test_client.get(f"/api/v1/portal/tickets/{ticket.id}")
        assert response.status_code == 401


class TestPortalTicketCreation:
    """POST /api/v1/portal/tickets"""

    def test_client_user_can_create_ticket_for_allowed_site(
        self, test_client, client_user_with_site_access, test_site, test_client_record, default_ticket_status
    ):
        """CLIENT_USER can create tickets for sites they have access to."""
        # Login
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        token = response.json()["access_token"]

        # Create ticket
        response = test_client.post(
            "/api/v1/portal/tickets",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "site_id": str(test_site.id),
                "title": "New Portal Ticket",
                "description": "Test description",
                "contact_phone": "050-1234567"
            }
        )

        # Should succeed (200 or 201)
        assert response.status_code in [200, 201]
        if response.status_code in [200, 201]:
            data = response.json()
            assert "id" in data or "ticket_id" in data

    def test_client_user_cannot_create_ticket_for_restricted_site(
        self, test_client, client_user_with_site_access, test_client_record, db_session
    ):
        """CLIENT_USER cannot create tickets for sites they don't have access to."""
        # Create restricted site
        from app.models.clients import Site

        restricted_site = Site(
            id=uuid4(),
            client_id=test_client_record.id,
            name="Restricted Site",
            is_default=False
        )
        db_session.add(restricted_site)
        db_session.commit()

        # Login
        response = test_client.post(
            "/api/v1/portal/auth/login",
            json={
                "email": "client@test.com",
                "password": "client123"
            }
        )

        assert response.status_code == 200
        token = response.json()["access_token"]

        # Try to create ticket for restricted site
        response = test_client.post(
            "/api/v1/portal/tickets",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "site_id": str(restricted_site.id),
                "title": "Restricted Ticket",
                "description": "Test description",
                "contact_phone": "050-1234567"
            }
        )

        # Should be rejected (403 or 400)
        assert response.status_code in [400, 403]

    def test_client_admin_can_create_ticket_for_any_client_site(
        self, test_client, client_admin_user, test_client_record, db_session, test_site, default_ticket_status
    ):
        """CLIENT_ADMIN can create tickets for any site in their client."""
        # Create another site
        from app.models.clients import Site

        site2 = Site(
            id=uuid4(),
            client_id=test_client_record.id,
            name="Site 2",
            is_default=False
        )
        db_session.add(site2)
        db_session.commit()

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

        # Create ticket for site2
        response = test_client.post(
            "/api/v1/portal/tickets",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "site_id": str(site2.id),
                "title": "Admin Created Ticket",
                "description": "Test description",
                "contact_phone": "050-1234567"
            }
        )

        # Should succeed
        assert response.status_code in [200, 201]
