"""
Deletion Service for cascade delete operations.
Handles Client, Site, and Ticket deletions with proper cascade logic
and hooks for external service integration (Google Calendar/Tasks).
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.clients import Client, Site, Contact, Location
from app.models.users import ClientUser
from app.models.tickets import Ticket, TicketStatusDefinition
from app.models.assets import Asset
from app.models.projects import Project
from app.schemas.deletion import (
    ClientUsageStats,
    ClientDeletionSummary,
    SiteUsageStats,
    SiteDeletionSummary,
    TicketDeletionSummary,
    DeletionResponse,
)
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


# ========== Hook Interface for External Services ==========

class DeletionHook(ABC):
    """
    Abstract base class for deletion hooks.
    Implement this to integrate with external services (Google, etc.).
    """

    @abstractmethod
    async def on_ticket_delete(self, ticket_id: UUID, ticket_data: dict) -> None:
        """Called before a ticket is deleted. Clean up external references."""
        pass

    @abstractmethod
    async def on_client_delete(self, client_id: UUID, client_data: dict) -> None:
        """Called before a client is deleted."""
        pass

    @abstractmethod
    async def on_site_delete(self, site_id: UUID, site_data: dict) -> None:
        """Called before a site is deleted."""
        pass


class GoogleCalendarHook(DeletionHook):
    """
    Placeholder for Google Calendar API integration.
    TODO: Implement when Google Calendar integration is added.
    """

    async def on_ticket_delete(self, ticket_id: UUID, ticket_data: dict) -> None:
        # TODO: Find and delete linked calendar events
        # Example implementation:
        # calendar_event_id = ticket_data.get('google_calendar_event_id')
        # if calendar_event_id:
        #     await google_calendar_api.delete_event(calendar_event_id)
        logger.debug(f"[GoogleCalendarHook] on_ticket_delete called for ticket {ticket_id}")
        pass

    async def on_client_delete(self, client_id: UUID, client_data: dict) -> None:
        # TODO: Cancel all scheduled visits for this client
        # Example: Find all calendar events where client_id matches
        logger.debug(f"[GoogleCalendarHook] on_client_delete called for client {client_id}")
        pass

    async def on_site_delete(self, site_id: UUID, site_data: dict) -> None:
        # TODO: Cancel all scheduled visits for this site
        logger.debug(f"[GoogleCalendarHook] on_site_delete called for site {site_id}")
        pass


class GoogleTasksHook(DeletionHook):
    """
    Placeholder for Google Tasks API integration.
    TODO: Implement when Google Tasks integration is added.
    """

    async def on_ticket_delete(self, ticket_id: UUID, ticket_data: dict) -> None:
        # TODO: Complete or delete linked tasks
        # Example:
        # task_id = ticket_data.get('google_task_id')
        # if task_id:
        #     await google_tasks_api.complete_task(task_id)
        logger.debug(f"[GoogleTasksHook] on_ticket_delete called for ticket {ticket_id}")
        pass

    async def on_client_delete(self, client_id: UUID, client_data: dict) -> None:
        # TODO: Handle client-related tasks
        logger.debug(f"[GoogleTasksHook] on_client_delete called for client {client_id}")
        pass

    async def on_site_delete(self, site_id: UUID, site_data: dict) -> None:
        logger.debug(f"[GoogleTasksHook] on_site_delete called for site {site_id}")
        pass


# ========== Deletion Service ==========

class DeletionService:
    """
    Service for handling cascade deletions with external hooks.

    Usage:
        service = DeletionService(hooks=[GoogleCalendarHook(), GoogleTasksHook()])
        summary = service.get_client_deletion_summary(db, client_id)
        result = await service.delete_client(db, client_id, force=True, ...)
    """

    def __init__(self, hooks: Optional[List[DeletionHook]] = None):
        self.hooks = hooks or []

    # ==================== Client Deletion ====================

    def get_client_deletion_summary(self, db: Session, client_id: UUID) -> Optional[ClientDeletionSummary]:
        """
        Get detailed usage summary for a client before deletion.
        Returns None if client not found.
        """
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            return None

        # Count related entities
        sites_count = db.query(Site).filter(Site.client_id == client_id).count()
        contacts_count = db.query(Contact).filter(Contact.client_id == client_id).count()
        users_count = db.query(ClientUser).filter(ClientUser.client_id == client_id).count()

        # Count tickets (total and open)
        tickets_total = db.query(Ticket).filter(Ticket.client_id == client_id).count()
        tickets_open = db.query(Ticket).join(TicketStatusDefinition).filter(
            Ticket.client_id == client_id,
            TicketStatusDefinition.is_closed_state == False
        ).count()

        assets_count = db.query(Asset).filter(Asset.client_id == client_id).count()
        projects_count = db.query(Project).filter(Project.client_id == client_id).count()

        # Determine if can delete without force (no RESTRICT blocking)
        has_blocking_records = (tickets_total > 0 or assets_count > 0 or projects_count > 0)
        can_delete = not has_blocking_records

        blocking_reason = None
        if has_blocking_records:
            parts = []
            if tickets_total > 0:
                parts.append(f"{tickets_total} tickets ({tickets_open} open)")
            if assets_count > 0:
                parts.append(f"{assets_count} assets")
            if projects_count > 0:
                parts.append(f"{projects_count} projects")
            blocking_reason = f"Cannot delete: client has {', '.join(parts)}. Use force=true to delete all."

        return ClientDeletionSummary(
            client_id=str(client_id),
            client_name=client.name,
            usage=ClientUsageStats(
                sites_count=sites_count,
                contacts_count=contacts_count,
                client_users_count=users_count,
                tickets_total=tickets_total,
                tickets_open=tickets_open,
                assets_count=assets_count,
                projects_count=projects_count
            ),
            can_delete=can_delete,
            blocking_reason=blocking_reason,
            will_be_deleted={
                "sites": sites_count,
                "contacts": contacts_count,
                "client_users": users_count,
            },
            will_be_affected={
                "tickets": tickets_total,
                "assets": assets_count,
                "projects": projects_count,
            }
        )

    async def delete_client(
        self,
        db: Session,
        client_id: UUID,
        force: bool = False,
        actor_type: Optional[str] = None,
        actor_id: Optional[UUID] = None,
        actor_display: Optional[str] = None
    ) -> DeletionResponse:
        """
        Delete a client and all associated data.

        Args:
            db: Database session
            client_id: Client UUID to delete
            force: If True, cascade delete tickets/assets/projects too
            actor_*: Audit trail information

        Returns:
            DeletionResponse with counts of deleted records

        Raises:
            ValueError: If can_delete=False and force=False
        """
        summary = self.get_client_deletion_summary(db, client_id)
        if not summary:
            raise ValueError("Client not found")

        if not summary.can_delete and not force:
            raise ValueError(summary.blocking_reason)

        client = db.query(Client).filter(Client.id == client_id).first()
        client_name = client.name
        client_data = {"id": str(client_id), "name": client_name}

        logger.info(f"Deleting client '{client_name}' (id={client_id}, force={force})")

        # Call hooks before deletion
        for hook in self.hooks:
            try:
                await hook.on_client_delete(client_id, client_data)
            except Exception as e:
                logger.error(f"Hook {hook.__class__.__name__} failed: {e}")

        deleted_counts = {}

        if force:
            # Force mode: Delete all blocking records first
            # Delete tickets (CASCADE will delete work_logs, events, line_items, etc.)
            tickets_deleted = db.query(Ticket).filter(
                Ticket.client_id == client_id
            ).delete(synchronize_session=False)
            deleted_counts["tickets"] = tickets_deleted
            logger.debug(f"Deleted {tickets_deleted} tickets")

            # Delete assets (CASCADE will delete property_values, events, disks, channels)
            assets_deleted = db.query(Asset).filter(
                Asset.client_id == client_id
            ).delete(synchronize_session=False)
            deleted_counts["assets"] = assets_deleted
            logger.debug(f"Deleted {assets_deleted} assets")

            # Delete projects (CASCADE will delete project_events)
            projects_deleted = db.query(Project).filter(
                Project.client_id == client_id
            ).delete(synchronize_session=False)
            deleted_counts["projects"] = projects_deleted
            logger.debug(f"Deleted {projects_deleted} projects")

        # Now delete client (CASCADE will delete sites, contacts, client_users)
        deleted_counts["sites"] = summary.usage.sites_count
        deleted_counts["contacts"] = summary.usage.contacts_count
        deleted_counts["client_users"] = summary.usage.client_users_count

        db.delete(client)
        db.commit()

        logger.info(f"Client '{client_name}' deleted successfully. Counts: {deleted_counts}")

        return DeletionResponse(
            success=True,
            entity_type="client",
            entity_id=str(client_id),
            entity_name=client_name,
            deleted_counts=deleted_counts,
            message=f"Client '{client_name}' and all related data deleted successfully"
        )

    # ==================== Site Deletion ====================

    def get_site_deletion_summary(self, db: Session, site_id: UUID) -> Optional[SiteDeletionSummary]:
        """Get detailed usage summary for a site before deletion."""
        site = db.query(Site).filter(Site.id == site_id).first()
        if not site:
            return None

        client = db.query(Client).filter(Client.id == site.client_id).first()

        # Count related entities
        locations_count = db.query(Location).filter(Location.site_id == site_id).count()

        # Count contacts linked to this site (through contact_site_links)
        from app.models.clients import contact_site_links
        contacts_linked = db.query(func.count()).select_from(contact_site_links).filter(
            contact_site_links.c.site_id == site_id
        ).scalar()

        # Count tickets and assets
        tickets_total = db.query(Ticket).filter(Ticket.site_id == site_id).count()
        tickets_open = db.query(Ticket).join(TicketStatusDefinition).filter(
            Ticket.site_id == site_id,
            TicketStatusDefinition.is_closed_state == False
        ).count()
        assets_count = db.query(Asset).filter(Asset.site_id == site_id).count()

        has_blocking_records = (tickets_total > 0 or assets_count > 0)
        can_delete = not has_blocking_records

        blocking_reason = None
        if has_blocking_records:
            parts = []
            if tickets_total > 0:
                parts.append(f"{tickets_total} tickets ({tickets_open} open)")
            if assets_count > 0:
                parts.append(f"{assets_count} assets")
            blocking_reason = f"Cannot delete: site has {', '.join(parts)}. Use force=true to delete all."

        return SiteDeletionSummary(
            site_id=str(site_id),
            site_name=site.name,
            client_id=str(site.client_id),
            client_name=client.name if client else "Unknown",
            usage=SiteUsageStats(
                locations_count=locations_count,
                contacts_linked_count=contacts_linked,
                tickets_total=tickets_total,
                tickets_open=tickets_open,
                assets_count=assets_count
            ),
            can_delete=can_delete,
            blocking_reason=blocking_reason,
            will_be_deleted={
                "locations": locations_count,
                "contact_links": contacts_linked,
            },
            will_be_affected={
                "tickets": tickets_total,
                "assets": assets_count,
            }
        )

    async def delete_site(
        self,
        db: Session,
        site_id: UUID,
        force: bool = False,
        actor_type: Optional[str] = None,
        actor_id: Optional[UUID] = None,
        actor_display: Optional[str] = None
    ) -> DeletionResponse:
        """Delete a site and all associated data."""
        summary = self.get_site_deletion_summary(db, site_id)
        if not summary:
            raise ValueError("Site not found")

        if not summary.can_delete and not force:
            raise ValueError(summary.blocking_reason)

        site = db.query(Site).filter(Site.id == site_id).first()
        site_name = site.name
        site_data = {"id": str(site_id), "name": site_name, "client_id": str(site.client_id)}

        logger.info(f"Deleting site '{site_name}' (id={site_id}, force={force})")

        # Call hooks
        for hook in self.hooks:
            try:
                await hook.on_site_delete(site_id, site_data)
            except Exception as e:
                logger.error(f"Hook {hook.__class__.__name__} failed: {e}")

        deleted_counts = {}

        if force:
            # Delete tickets
            tickets_deleted = db.query(Ticket).filter(
                Ticket.site_id == site_id
            ).delete(synchronize_session=False)
            deleted_counts["tickets"] = tickets_deleted

            # Delete assets
            assets_deleted = db.query(Asset).filter(
                Asset.site_id == site_id
            ).delete(synchronize_session=False)
            deleted_counts["assets"] = assets_deleted

        # Delete site (CASCADE will delete locations, contact_site_links)
        deleted_counts["locations"] = summary.usage.locations_count
        deleted_counts["contact_links"] = summary.usage.contacts_linked_count

        db.delete(site)
        db.commit()

        logger.info(f"Site '{site_name}' deleted successfully. Counts: {deleted_counts}")

        return DeletionResponse(
            success=True,
            entity_type="site",
            entity_id=str(site_id),
            entity_name=site_name,
            deleted_counts=deleted_counts,
            message=f"Site '{site_name}' and all related data deleted successfully"
        )

    # ==================== Ticket Deletion ====================

    def get_ticket_deletion_summary(self, db: Session, ticket_id: UUID) -> Optional[TicketDeletionSummary]:
        """Get deletion summary for a ticket (always allowed)."""
        from app.models.time_billing import WorkLog, TicketLineItem
        from app.models.tickets import TicketEvent, TicketInitiator, TicketAssignmentHistory

        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            return None

        work_logs_count = db.query(WorkLog).filter(WorkLog.ticket_id == ticket_id).count()
        line_items_count = db.query(TicketLineItem).filter(TicketLineItem.ticket_id == ticket_id).count()
        events_count = db.query(TicketEvent).filter(TicketEvent.ticket_id == ticket_id).count()
        history_count = db.query(TicketAssignmentHistory).filter(
            TicketAssignmentHistory.ticket_id == ticket_id
        ).count()

        return TicketDeletionSummary(
            ticket_id=str(ticket_id),
            ticket_number=ticket.ticket_number,
            will_be_deleted={
                "work_logs": work_logs_count,
                "line_items": line_items_count,
                "events": events_count,
                "assignment_history": history_count,
            }
        )

    async def delete_ticket(
        self,
        db: Session,
        ticket_id: UUID,
        actor_type: Optional[str] = None,
        actor_id: Optional[UUID] = None,
        actor_display: Optional[str] = None
    ) -> DeletionResponse:
        """Delete a ticket and all associated data."""
        summary = self.get_ticket_deletion_summary(db, ticket_id)
        if not summary:
            raise ValueError("Ticket not found")

        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        ticket_number = ticket.ticket_number
        ticket_data = {
            "id": str(ticket_id),
            "ticket_number": ticket_number,
            "client_id": str(ticket.client_id) if ticket.client_id else None,
        }

        logger.info(f"Deleting ticket '{ticket_number}' (id={ticket_id})")

        # Call hooks (for Google Calendar/Tasks cleanup)
        for hook in self.hooks:
            try:
                await hook.on_ticket_delete(ticket_id, ticket_data)
            except Exception as e:
                logger.error(f"Hook {hook.__class__.__name__} failed: {e}")

        # Delete ticket (CASCADE will handle work_logs, events, line_items, etc.)
        deleted_counts = summary.will_be_deleted.copy()
        db.delete(ticket)
        db.commit()

        logger.info(f"Ticket '{ticket_number}' deleted successfully. Counts: {deleted_counts}")

        return DeletionResponse(
            success=True,
            entity_type="ticket",
            entity_id=str(ticket_id),
            entity_name=ticket_number,
            deleted_counts=deleted_counts,
            message=f"Ticket '{ticket_number}' and all related data deleted successfully"
        )


# Global instance with default hooks (placeholders)
deletion_service = DeletionService(hooks=[
    GoogleCalendarHook(),
    GoogleTasksHook(),
])
