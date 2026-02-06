"""
API route modules.
"""
from app.api import (
    auth, clients, sites, contacts, locations, tickets, assets, reports,
    attachments, admin, projects, audit, work_logs, ticket_assets,
    ticket_assignment, portal_auth, portal_tickets, portal_assets, internal_users,
    hikvision, hikvision_ws, portal_client_users, portal_attachments
)

__all__ = [
    "auth", "clients", "sites", "contacts", "locations", "tickets", "assets",
    "reports", "attachments", "admin", "projects", "audit", "work_logs",
    "ticket_assets", "ticket_assignment", "portal_auth", "portal_tickets", "portal_assets",
    "internal_users", "hikvision", "hikvision_ws", "portal_client_users", "portal_attachments"
]
