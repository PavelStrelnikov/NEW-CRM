"""
Simple role-based access control (RBAC).
Basic role checks without granular permission enums.

Replace app/rbac.py with this file to simplify the permission system.
"""
from typing import TYPE_CHECKING
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.users import InternalUserRole, ClientUserRole

if TYPE_CHECKING:
    from app.guards import ClientUserClaims


# ========== Internal User Checks ==========

def is_admin(role: str) -> bool:
    """Check if internal user is admin."""
    return role == InternalUserRole.ADMIN.value


def is_technician(role: str) -> bool:
    """Check if internal user is technician."""
    return role == InternalUserRole.TECHNICIAN.value


def is_office(role: str) -> bool:
    """Check if internal user is office staff."""
    return role == InternalUserRole.OFFICE.value


# ========== Ticket Permissions ==========

def can_assign_tickets(role: str) -> bool:
    """Only admins can assign/reassign tickets."""
    return is_admin(role)


def can_view_all_tickets(role: str) -> bool:
    """Admins can view all tickets; others see filtered."""
    return is_admin(role)


def can_view_assigned_tickets(role: str) -> bool:
    """Technicians can view their assigned tickets."""
    return is_technician(role)


def can_create_tickets(role: str) -> bool:
    """Admins and technicians can create tickets."""
    return role in [InternalUserRole.ADMIN.value, InternalUserRole.TECHNICIAN.value]


def can_view_unassigned_queue(role: str) -> bool:
    """Only admins can view unassigned ticket queue."""
    return is_admin(role)


# ========== Client/Asset Permissions ==========

def can_manage_clients(role: str) -> bool:
    """Only admins can create/edit/delete clients."""
    return is_admin(role)


def can_manage_assets(role: str) -> bool:
    """Only admins can create/edit/delete assets."""
    return is_admin(role)


def can_view_assets(role: str) -> bool:
    """Admins and technicians can view assets."""
    return role in [InternalUserRole.ADMIN.value, InternalUserRole.TECHNICIAN.value]


# ========== System Management ==========

def can_manage_system(role: str) -> bool:
    """Only admins can manage system settings."""
    return is_admin(role)


def can_manage_users(role: str) -> bool:
    """Only admins can manage internal users."""
    return is_admin(role)


# ========== Portal User Checks ==========

def is_client_admin(role: str) -> bool:
    """Check if portal user is client admin."""
    return role == ClientUserRole.CLIENT_ADMIN.value


def is_client_user(role: str) -> bool:
    """Check if portal user is regular client user."""
    return role == ClientUserRole.CLIENT_USER.value


def can_create_portal_tickets(role: str) -> bool:
    """All portal users can create tickets."""
    return role in [
        ClientUserRole.CLIENT_USER.value,
        ClientUserRole.CLIENT_CONTACT.value,
        ClientUserRole.CLIENT_ADMIN.value
    ]


def can_view_portal_tickets(role: str) -> bool:
    """All portal users can view tickets (scoped by sites)."""
    return role in [
        ClientUserRole.CLIENT_USER.value,
        ClientUserRole.CLIENT_CONTACT.value,
        ClientUserRole.CLIENT_ADMIN.value
    ]


def can_view_portal_assets(role: str) -> bool:
    """All portal users can view assets (scoped by sites + visibility)."""
    return role in [
        ClientUserRole.CLIENT_USER.value,
        ClientUserRole.CLIENT_CONTACT.value,
        ClientUserRole.CLIENT_ADMIN.value
    ]


def can_manage_portal_users(role: str) -> bool:
    """Only client admins can manage other portal users."""
    return is_client_admin(role)


# ========== CLIENT_ADMIN Portal Permissions ==========

def can_edit_portal_assets(role: str) -> bool:
    """CLIENT_ADMIN can create/update assets in their scope."""
    return is_client_admin(role)


def can_probe_portal_assets(role: str) -> bool:
    """CLIENT_ADMIN can run device probe in their scope."""
    return is_client_admin(role)


def can_edit_portal_channels(role: str) -> bool:
    """CLIENT_ADMIN can edit channel customization (custom_name, is_ignored)."""
    return is_client_admin(role)


def can_edit_portal_clients(role: str) -> bool:
    """CLIENT_ADMIN can update their assigned client details (NOT create new clients)."""
    return is_client_admin(role)


def can_edit_portal_sites(role: str) -> bool:
    """CLIENT_ADMIN can create/update sites within their client scope."""
    return is_client_admin(role)


def can_edit_portal_contacts(role: str) -> bool:
    """CLIENT_ADMIN can create/update contacts within their client scope."""
    return is_client_admin(role)


# ========== Multi-Client Access Helpers ==========

def get_client_user_assigned_clients(db: Session, client_user_id: UUID) -> list[UUID]:
    """
    Get list of client IDs a CLIENT_ADMIN user can access.

    Returns empty list for non-CLIENT_ADMIN users.
    """
    from app.models.users import ClientUserClient

    assigned = db.query(ClientUserClient).filter(
        ClientUserClient.client_user_id == client_user_id
    ).all()

    return [assignment.client_id for assignment in assigned]


def check_client_user_client_access(
    db: Session,
    claims: "ClientUserClaims",
    client_user_id: UUID,
    client_id: UUID
) -> bool:
    """
    Check if a client user has access to a specific client.

    - CLIENT_ADMIN: Check allowed_client_ids list
    - CLIENT_USER: Must match their single client_id
    """
    # CLIENT_ADMIN with multi-client access
    if claims.role == ClientUserRole.CLIENT_ADMIN.value:
        if claims.allowed_client_ids:
            return str(client_id) in claims.allowed_client_ids
        # Fallback for old tokens without allowed_client_ids
        return str(client_id) == claims.client_id

    # CLIENT_USER/CLIENT_CONTACT: single client only
    return str(client_id) == claims.client_id


def filter_query_by_client_access(query, model_client_id_field, claims: "ClientUserClaims"):
    """
    Apply client access filtering to a SQLAlchemy query.

    Args:
        query: SQLAlchemy query object
        model_client_id_field: The model's client_id field (e.g., Ticket.client_id)
        claims: ClientUserClaims from token

    Returns:
        Filtered query

    Example:
        query = db.query(Ticket)
        query = filter_query_by_client_access(query, Ticket.client_id, claims)
    """
    from sqlalchemy.dialects.postgresql import UUID as SQLUUID

    # CLIENT_ADMIN with multi-client access
    if claims.role == ClientUserRole.CLIENT_ADMIN.value and claims.allowed_client_ids:
        # Filter by all allowed clients
        allowed_uuids = [UUID(cid) for cid in claims.allowed_client_ids]
        return query.filter(model_client_id_field.in_(allowed_uuids))

    # Single-client access (CLIENT_USER, CLIENT_CONTACT, or old CLIENT_ADMIN)
    return query.filter(model_client_id_field == UUID(claims.client_id))
