"""
Pydantic schemas for deletion operations.
Provides usage summaries before deletion and response structures.
"""
from typing import Optional, Dict
from pydantic import BaseModel


# ========== Client Deletion Schemas ==========

class ClientUsageStats(BaseModel):
    """Usage statistics for a client - counts of related records."""
    sites_count: int
    contacts_count: int
    client_users_count: int
    tickets_total: int
    tickets_open: int
    assets_count: int
    projects_count: int


class ClientDeletionSummary(BaseModel):
    """
    Summary of what will be affected by deleting a client.
    Used by the pre-deletion summary endpoint.
    """
    client_id: str
    client_name: str
    usage: ClientUsageStats
    can_delete: bool  # True if no blocking records (tickets/assets/projects)
    blocking_reason: Optional[str] = None  # Human-readable reason if can_delete=False
    will_be_deleted: Dict[str, int]  # Records that will be CASCADE deleted
    will_be_affected: Dict[str, int]  # Records with RESTRICT (need force=true)


# ========== Site Deletion Schemas ==========

class SiteUsageStats(BaseModel):
    """Usage statistics for a site."""
    locations_count: int
    contacts_linked_count: int  # Contacts that will lose this site link
    tickets_total: int
    tickets_open: int
    assets_count: int


class SiteDeletionSummary(BaseModel):
    """Summary of what will be affected by deleting a site."""
    site_id: str
    site_name: str
    client_id: str
    client_name: str
    usage: SiteUsageStats
    can_delete: bool
    blocking_reason: Optional[str] = None
    will_be_deleted: Dict[str, int]
    will_be_affected: Dict[str, int]


# ========== Ticket Deletion Schemas ==========

class TicketDeletionSummary(BaseModel):
    """Summary for ticket deletion (always allowed, just shows related records)."""
    ticket_id: str
    ticket_number: str
    will_be_deleted: Dict[str, int]  # {work_logs: 3, line_items: 2, events: 15}


# ========== Generic Deletion Response ==========

class DeletionResponse(BaseModel):
    """Response after successful deletion operation."""
    success: bool
    entity_type: str  # "client", "site", "ticket"
    entity_id: str
    entity_name: str
    deleted_counts: Dict[str, int]  # Counts of deleted records by type
    message: str
