"""
Unit tests for RBAC permission functions (no database required).
Tests all 15+ permission check functions from app.rbac module.

Coverage: 100% of rbac.py functions
Execution time: < 100ms
"""

import pytest
from app.rbac import (
    is_admin, is_technician, is_office,
    can_assign_tickets, can_view_all_tickets, can_view_assigned_tickets,
    can_create_tickets, can_view_unassigned_queue,
    can_manage_clients, can_manage_assets, can_view_assets,
    can_manage_system, can_manage_users,
    is_client_admin, is_client_user,
    can_create_portal_tickets, can_view_portal_tickets,
    can_view_portal_assets, can_manage_portal_users
)
from app.models.users import InternalUserRole, ClientUserRole


class TestInternalUserRoleChecks:
    """Test internal user role identification functions."""

    def test_is_admin_returns_true_for_admin(self):
        assert is_admin(InternalUserRole.ADMIN.value) is True

    def test_is_admin_returns_false_for_technician(self):
        assert is_admin(InternalUserRole.TECHNICIAN.value) is False

    def test_is_admin_returns_false_for_office(self):
        assert is_admin(InternalUserRole.OFFICE.value) is False

    def test_is_technician_returns_true_for_technician(self):
        assert is_technician(InternalUserRole.TECHNICIAN.value) is True

    def test_is_technician_returns_false_for_admin(self):
        assert is_technician(InternalUserRole.ADMIN.value) is False

    def test_is_technician_returns_false_for_office(self):
        assert is_technician(InternalUserRole.OFFICE.value) is False

    def test_is_office_returns_true_for_office(self):
        assert is_office(InternalUserRole.OFFICE.value) is True

    def test_is_office_returns_false_for_admin(self):
        assert is_office(InternalUserRole.ADMIN.value) is False

    def test_is_office_returns_false_for_technician(self):
        assert is_office(InternalUserRole.TECHNICIAN.value) is False


class TestTicketPermissions:
    """Test ticket-related permission functions."""

    # Assignment permissions
    def test_admin_can_assign_tickets(self):
        assert can_assign_tickets(InternalUserRole.ADMIN.value) is True

    def test_technician_cannot_assign_tickets(self):
        assert can_assign_tickets(InternalUserRole.TECHNICIAN.value) is False

    def test_office_cannot_assign_tickets(self):
        assert can_assign_tickets(InternalUserRole.OFFICE.value) is False

    # View all tickets
    def test_admin_can_view_all_tickets(self):
        assert can_view_all_tickets(InternalUserRole.ADMIN.value) is True

    def test_technician_cannot_view_all_tickets(self):
        assert can_view_all_tickets(InternalUserRole.TECHNICIAN.value) is False

    def test_office_cannot_view_all_tickets(self):
        assert can_view_all_tickets(InternalUserRole.OFFICE.value) is False

    # View assigned tickets
    def test_technician_can_view_assigned_tickets(self):
        assert can_view_assigned_tickets(InternalUserRole.TECHNICIAN.value) is True

    def test_admin_cannot_view_assigned_tickets(self):
        """Admin uses view_all instead."""
        assert can_view_assigned_tickets(InternalUserRole.ADMIN.value) is False

    def test_office_cannot_view_assigned_tickets(self):
        assert can_view_assigned_tickets(InternalUserRole.OFFICE.value) is False

    # Create tickets
    def test_admin_can_create_tickets(self):
        assert can_create_tickets(InternalUserRole.ADMIN.value) is True

    def test_technician_can_create_tickets(self):
        assert can_create_tickets(InternalUserRole.TECHNICIAN.value) is True

    def test_office_cannot_create_tickets(self):
        assert can_create_tickets(InternalUserRole.OFFICE.value) is False

    # View unassigned queue
    def test_admin_can_view_unassigned_queue(self):
        assert can_view_unassigned_queue(InternalUserRole.ADMIN.value) is True

    def test_technician_cannot_view_unassigned_queue(self):
        assert can_view_unassigned_queue(InternalUserRole.TECHNICIAN.value) is False

    def test_office_cannot_view_unassigned_queue(self):
        assert can_view_unassigned_queue(InternalUserRole.OFFICE.value) is False


class TestClientAssetPermissions:
    """Test client and asset management permissions."""

    # Client management
    def test_admin_can_manage_clients(self):
        assert can_manage_clients(InternalUserRole.ADMIN.value) is True

    def test_technician_cannot_manage_clients(self):
        assert can_manage_clients(InternalUserRole.TECHNICIAN.value) is False

    def test_office_cannot_manage_clients(self):
        assert can_manage_clients(InternalUserRole.OFFICE.value) is False

    # Asset management
    def test_admin_can_manage_assets(self):
        assert can_manage_assets(InternalUserRole.ADMIN.value) is True

    def test_technician_cannot_manage_assets(self):
        assert can_manage_assets(InternalUserRole.TECHNICIAN.value) is False

    def test_office_cannot_manage_assets(self):
        assert can_manage_assets(InternalUserRole.OFFICE.value) is False

    # Asset viewing
    def test_admin_can_view_assets(self):
        assert can_view_assets(InternalUserRole.ADMIN.value) is True

    def test_technician_can_view_assets(self):
        assert can_view_assets(InternalUserRole.TECHNICIAN.value) is True

    def test_office_cannot_view_assets(self):
        assert can_view_assets(InternalUserRole.OFFICE.value) is False


class TestSystemManagementPermissions:
    """Test system and user management permissions."""

    # System management
    def test_admin_can_manage_system(self):
        assert can_manage_system(InternalUserRole.ADMIN.value) is True

    def test_technician_cannot_manage_system(self):
        assert can_manage_system(InternalUserRole.TECHNICIAN.value) is False

    def test_office_cannot_manage_system(self):
        assert can_manage_system(InternalUserRole.OFFICE.value) is False

    # User management
    def test_admin_can_manage_users(self):
        assert can_manage_users(InternalUserRole.ADMIN.value) is True

    def test_technician_cannot_manage_users(self):
        assert can_manage_users(InternalUserRole.TECHNICIAN.value) is False

    def test_office_cannot_manage_users(self):
        assert can_manage_users(InternalUserRole.OFFICE.value) is False


class TestPortalUserRoleChecks:
    """Test portal user role identification functions."""

    def test_is_client_admin_returns_true_for_client_admin(self):
        assert is_client_admin(ClientUserRole.CLIENT_ADMIN.value) is True

    def test_is_client_admin_returns_false_for_client_user(self):
        assert is_client_admin(ClientUserRole.CLIENT_USER.value) is False

    def test_is_client_admin_returns_false_for_client_contact(self):
        assert is_client_admin(ClientUserRole.CLIENT_CONTACT.value) is False

    def test_is_client_user_returns_true_for_client_user(self):
        assert is_client_user(ClientUserRole.CLIENT_USER.value) is True

    def test_is_client_user_returns_false_for_client_admin(self):
        assert is_client_user(ClientUserRole.CLIENT_ADMIN.value) is False

    def test_is_client_user_returns_false_for_client_contact(self):
        assert is_client_user(ClientUserRole.CLIENT_CONTACT.value) is False


class TestPortalPermissions:
    """Test portal user permissions."""

    # Create portal tickets
    def test_client_user_can_create_portal_tickets(self):
        assert can_create_portal_tickets(ClientUserRole.CLIENT_USER.value) is True

    def test_client_contact_can_create_portal_tickets(self):
        assert can_create_portal_tickets(ClientUserRole.CLIENT_CONTACT.value) is True

    def test_client_admin_can_create_portal_tickets(self):
        assert can_create_portal_tickets(ClientUserRole.CLIENT_ADMIN.value) is True

    # View portal tickets
    def test_client_user_can_view_portal_tickets(self):
        assert can_view_portal_tickets(ClientUserRole.CLIENT_USER.value) is True

    def test_client_contact_can_view_portal_tickets(self):
        assert can_view_portal_tickets(ClientUserRole.CLIENT_CONTACT.value) is True

    def test_client_admin_can_view_portal_tickets(self):
        assert can_view_portal_tickets(ClientUserRole.CLIENT_ADMIN.value) is True

    # View portal assets
    def test_client_user_can_view_portal_assets(self):
        assert can_view_portal_assets(ClientUserRole.CLIENT_USER.value) is True

    def test_client_contact_can_view_portal_assets(self):
        assert can_view_portal_assets(ClientUserRole.CLIENT_CONTACT.value) is True

    def test_client_admin_can_view_portal_assets(self):
        assert can_view_portal_assets(ClientUserRole.CLIENT_ADMIN.value) is True

    # Manage portal users
    def test_client_admin_can_manage_portal_users(self):
        assert can_manage_portal_users(ClientUserRole.CLIENT_ADMIN.value) is True

    def test_client_user_cannot_manage_portal_users(self):
        assert can_manage_portal_users(ClientUserRole.CLIENT_USER.value) is False

    def test_client_contact_cannot_manage_portal_users(self):
        assert can_manage_portal_users(ClientUserRole.CLIENT_CONTACT.value) is False
