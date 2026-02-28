"""
Integration tests for ticket assignment API endpoints.

Tests 4 endpoints:
- POST /api/v1/tickets/{id}/assign - Assign/reassign ticket
- GET /api/v1/tickets/unassigned - Admin queue
- GET /api/v1/tickets/me/assigned - Technician's tickets
- GET /api/v1/tickets/{id}/assignment-history - Audit trail

Covers: Authentication, authorization, validation, database interactions
"""

import pytest
from uuid import uuid4


class TestAssignTicketEndpoint:
    """POST /api/v1/tickets/{ticket_id}/assign"""

    def test_admin_can_assign_unassigned_ticket(
        self, test_client, auth_headers_admin, ticket_factory, technician_user, db_session
    ):
        """Admin should successfully assign unassigned ticket to technician."""
        ticket = ticket_factory(assigned_to_internal_user_id=None)

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers=auth_headers_admin,
            json={
                "assigned_to_internal_user_id": str(technician_user.id),
                "reason": "Specialized in CCTV systems"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["assigned_to"] == str(technician_user.id)

        # Verify database was updated
        db_session.refresh(ticket)
        assert ticket.assigned_to_internal_user_id == technician_user.id

    def test_admin_can_reassign_already_assigned_ticket(
        self, test_client, auth_headers_admin, ticket_factory, technician_user, admin_user
    ):
        """Admin should successfully reassign ticket from one tech to another."""
        ticket = ticket_factory(assigned_to_internal_user_id=admin_user.id)

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers=auth_headers_admin,
            json={
                "assigned_to_internal_user_id": str(technician_user.id),
                "reason": "Workload balancing"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "assigned successfully" in data["message"]

    def test_assignment_creates_history_record(
        self, test_client, auth_headers_admin, ticket_factory, technician_user, db_session
    ):
        """Assignment should create audit trail entry."""
        from app.models.tickets import TicketAssignmentHistory

        ticket = ticket_factory(assigned_to_internal_user_id=None)

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers=auth_headers_admin,
            json={
                "assigned_to_internal_user_id": str(technician_user.id),
                "reason": "Initial assignment"
            }
        )

        assert response.status_code == 200

        # Check history was created
        history = db_session.query(TicketAssignmentHistory).filter_by(ticket_id=ticket.id).all()
        assert len(history) > 0
        assert history[-1].assigned_to_internal_user_id == technician_user.id
        assert history[-1].reason == "Initial assignment"

    def test_technician_cannot_assign_ticket(
        self, test_client, auth_headers_technician, ticket_factory, technician_user
    ):
        """Technician should get 403 when trying to assign tickets."""
        ticket = ticket_factory()

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers=auth_headers_technician,
            json={"assigned_to_internal_user_id": str(technician_user.id)}
        )

        assert response.status_code == 403
        data = response.json()
        assert "Permission denied" in data["detail"] or "Only admins" in data["detail"]

    def test_office_user_cannot_assign_ticket(
        self, test_client, auth_headers_office, ticket_factory, technician_user
    ):
        """Office staff should get 403 when trying to assign tickets."""
        ticket = ticket_factory()

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers=auth_headers_office,
            json={"assigned_to_internal_user_id": str(technician_user.id)}
        )

        assert response.status_code == 403

    def test_unauthenticated_cannot_assign(
        self, test_client, ticket_factory, technician_user
    ):
        """Unauthenticated request should get 401."""
        ticket = ticket_factory()

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            json={"assigned_to_internal_user_id": str(technician_user.id)}
        )

        assert response.status_code == 401

    def test_assign_to_nonexistent_technician_fails(
        self, test_client, auth_headers_admin, ticket_factory
    ):
        """Assigning to non-existent user should return 400."""
        ticket = ticket_factory()

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers=auth_headers_admin,
            json={"assigned_to_internal_user_id": str(uuid4())}
        )

        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()

    def test_assign_nonexistent_ticket_fails(
        self, test_client, auth_headers_admin, technician_user
    ):
        """Assigning non-existent ticket should return 404."""
        response = test_client.post(
            f"/api/v1/tickets/{uuid4()}/assign",
            headers=auth_headers_admin,
            json={"assigned_to_internal_user_id": str(technician_user.id)}
        )

        assert response.status_code == 404

    def test_assignment_without_reason_succeeds(
        self, test_client, auth_headers_admin, ticket_factory, technician_user
    ):
        """Assignment without reason should succeed (reason is optional)."""
        ticket = ticket_factory(assigned_to_internal_user_id=None)

        response = test_client.post(
            f"/api/v1/tickets/{ticket.id}/assign",
            headers=auth_headers_admin,
            json={"assigned_to_internal_user_id": str(technician_user.id)}
        )

        assert response.status_code == 200


class TestUnassignedQueueEndpoint:
    """GET /api/v1/tickets/unassigned"""

    def test_admin_can_view_unassigned_queue(
        self, test_client, auth_headers_admin, ticket_factory, technician_user
    ):
        """Admin should see list of unassigned tickets."""
        # Create unassigned tickets
        ticket1 = ticket_factory(assigned_to_internal_user_id=None, title="Unassigned 1")
        ticket2 = ticket_factory(assigned_to_internal_user_id=None, title="Unassigned 2")

        # Create assigned ticket (should not appear)
        ticket_factory(assigned_to_internal_user_id=technician_user.id, title="Assigned")

        response = test_client.get("/api/v1/tickets/unassigned", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["total"] >= 2

        ticket_ids = [t["id"] for t in data["tickets"]]
        assert str(ticket1.id) in ticket_ids
        assert str(ticket2.id) in ticket_ids

    def test_technician_cannot_view_unassigned_queue(
        self, test_client, auth_headers_technician
    ):
        """Technician should get 403."""
        response = test_client.get("/api/v1/tickets/unassigned", headers=auth_headers_technician)

        assert response.status_code == 403
        assert "Permission denied" in response.json()["detail"] or "Only admins" in response.json()["detail"]

    def test_office_user_cannot_view_unassigned_queue(
        self, test_client, auth_headers_office
    ):
        """Office staff should get 403."""
        response = test_client.get("/api/v1/tickets/unassigned", headers=auth_headers_office)

        assert response.status_code == 403

    def test_unassigned_queue_pagination(
        self, test_client, auth_headers_admin, ticket_factory
    ):
        """Test pagination parameters work correctly."""
        # Create multiple unassigned tickets
        for i in range(5):
            ticket_factory(assigned_to_internal_user_id=None, title=f"Ticket {i}")

        response = test_client.get(
            "/api/v1/tickets/unassigned?limit=2&offset=0",
            headers=auth_headers_admin
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["tickets"]) <= 2
        assert data["limit"] == 2
        assert data["offset"] == 0

    def test_unassigned_queue_empty_result(
        self, test_client, auth_headers_admin, ticket_factory, technician_user
    ):
        """When all tickets are assigned, should return empty list."""
        # Create only assigned tickets
        ticket_factory(assigned_to_internal_user_id=technician_user.id)

        response = test_client.get("/api/v1/tickets/unassigned", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["tickets"] == []


class TestMyAssignedTicketsEndpoint:
    """GET /api/v1/tickets/me/assigned"""

    def test_technician_sees_own_assigned_tickets(
        self, test_client, auth_headers_technician, ticket_factory, technician_user, admin_user
    ):
        """Technician should only see tickets assigned to them."""
        # Create ticket assigned to this technician
        my_ticket = ticket_factory(
            assigned_to_internal_user_id=technician_user.id,
            title="My Ticket"
        )

        # Create ticket assigned to someone else
        other_ticket = ticket_factory(
            assigned_to_internal_user_id=admin_user.id,
            title="Other Ticket"
        )

        response = test_client.get("/api/v1/tickets/me/assigned", headers=auth_headers_technician)

        assert response.status_code == 200
        data = response.json()

        ticket_ids = [t["id"] for t in data["tickets"]]
        assert str(my_ticket.id) in ticket_ids
        assert str(other_ticket.id) not in ticket_ids

    def test_technician_with_no_assigned_tickets(
        self, test_client, auth_headers_technician
    ):
        """Technician with no assignments should get empty list."""
        response = test_client.get("/api/v1/tickets/me/assigned", headers=auth_headers_technician)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["tickets"] == []

    def test_office_user_cannot_view_assigned_tickets(
        self, test_client, auth_headers_office
    ):
        """Office staff should get 403."""
        response = test_client.get("/api/v1/tickets/me/assigned", headers=auth_headers_office)

        assert response.status_code == 403

    def test_my_assigned_tickets_pagination(
        self, test_client, auth_headers_technician, ticket_factory, technician_user
    ):
        """Test pagination works correctly."""
        # Create multiple assigned tickets
        for i in range(5):
            ticket_factory(
                assigned_to_internal_user_id=technician_user.id,
                title=f"Ticket {i}"
            )

        response = test_client.get(
            "/api/v1/tickets/me/assigned?limit=3&offset=0",
            headers=auth_headers_technician
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["tickets"]) <= 3
        assert data["limit"] == 3

    def test_unauthenticated_cannot_view_assigned(
        self, test_client
    ):
        """Unauthenticated request should get 401."""
        response = test_client.get("/api/v1/tickets/me/assigned")

        assert response.status_code == 401


class TestAssignmentHistoryEndpoint:
    """GET /api/v1/tickets/{ticket_id}/assignment-history"""

    def test_get_assignment_history_shows_all_assignments(
        self, test_client, auth_headers_admin, ticket_factory, technician_user, admin_user, db_session
    ):
        """Should return complete assignment history for ticket."""
        from app.services.ticket_assignment import TicketAssignmentService
        from app.guards import InternalUserClaims

        ticket = ticket_factory(assigned_to_internal_user_id=None)

        # Create first assignment
        claims = InternalUserClaims(
            user_id=str(admin_user.id),
            email=admin_user.email,
            role=admin_user.role.value,
            name=admin_user.name
        )
        TicketAssignmentService.assign_ticket_to_technician(
            db=db_session,
            ticket=ticket,
            technician_id=technician_user.id,
            assignment_type="manual",
            assigned_by_claims=claims,
            reason="Initial assignment"
        )
        db_session.commit()

        response = test_client.get(
            f"/api/v1/tickets/{ticket.id}/assignment-history",
            headers=auth_headers_admin
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["assignment_history"]) >= 1

        history_entry = data["assignment_history"][0]
        assert history_entry["assignment_type"] == "manual"
        assert history_entry["reason"] == "Initial assignment"
        assert history_entry["assigned_to_internal_user_id"] == str(technician_user.id)

    def test_get_history_for_nonexistent_ticket(
        self, test_client, auth_headers_admin
    ):
        """Requesting history for non-existent ticket should return 404."""
        response = test_client.get(
            f"/api/v1/tickets/{uuid4()}/assignment-history",
            headers=auth_headers_admin
        )

        assert response.status_code == 404

    def test_unauthenticated_cannot_view_history(
        self, test_client, ticket_factory
    ):
        """Unauthenticated request should get 401."""
        ticket = ticket_factory()

        response = test_client.get(f"/api/v1/tickets/{ticket.id}/assignment-history")

        assert response.status_code == 401

    def test_history_for_ticket_with_no_assignments(
        self, test_client, auth_headers_admin, ticket_factory
    ):
        """Ticket with no assignments should return empty history."""
        ticket = ticket_factory(assigned_to_internal_user_id=None)

        response = test_client.get(
            f"/api/v1/tickets/{ticket.id}/assignment-history",
            headers=auth_headers_admin
        )

        assert response.status_code == 200
        data = response.json()
        assert data["assignment_history"] == []
