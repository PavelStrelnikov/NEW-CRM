"""
Import all models so they are registered with SQLAlchemy Base.metadata.
This is required for Alembic autogenerate to detect all models.
"""
from app.models.users import InternalUser, ClientUser, ClientUserSite, ClientUserClient, InternalUserRole, ClientUserRole, Locale
from app.models.clients import Client, Site, Contact, Location, ClientStatus, contact_site_links
from app.models.tickets import (
    TicketStatusDefinition,
    TicketCategoryDefinition,
    Ticket,
    TicketInitiator,
    TicketEvent,
    TicketAssignmentHistory,
    TicketCategory,
    TicketPriority,
    SourceChannel,
    ReportedVia,
    ServiceScope,
    InitiatorType,
    CreatedByType
)
from app.models.time_billing import WorkLog, TicketLineItem, WorkType, ItemType
from app.models.assets import (
    AssetType,
    Asset,
    AssetPropertyDefinition,
    AssetPropertyValue,
    AssetEvent,
    NVRDisk,
    NVRChannel,
    AssetStatus,
    PropertyDataType,
    PropertyVisibility,
    TicketAssetRelationType,
    ticket_asset_links
)
from app.models.projects import (
    Project,
    ProjectEvent,
    ProjectStatus,
    project_ticket_links,
    project_asset_links,
    project_site_links
)
from app.models.attachments import Attachment, LinkedType
from app.models.providers import InternetProvider

__all__ = [
    # Users
    "InternalUser",
    "ClientUser",
    "ClientUserSite",
    "ClientUserClient",
    "InternalUserRole",
    "ClientUserRole",
    "Locale",
    # Clients
    "Client",
    "Site",
    "Contact",
    "Location",
    "ClientStatus",
    "contact_site_links",
    # Tickets
    "TicketStatusDefinition",
    "TicketCategoryDefinition",
    "Ticket",
    "TicketInitiator",
    "TicketEvent",
    "TicketAssignmentHistory",
    "TicketCategory",
    "TicketPriority",
    "SourceChannel",
    "ReportedVia",
    "ServiceScope",
    "InitiatorType",
    "CreatedByType",
    # Time & Billing
    "WorkLog",
    "TicketLineItem",
    "WorkType",
    "ItemType",
    # Assets
    "AssetType",
    "Asset",
    "AssetPropertyDefinition",
    "AssetPropertyValue",
    "AssetEvent",
    "NVRDisk",
    "NVRChannel",
    "AssetStatus",
    "PropertyDataType",
    "PropertyVisibility",
    "TicketAssetRelationType",
    "ticket_asset_links",
    # Projects
    "Project",
    "ProjectEvent",
    "ProjectStatus",
    "project_ticket_links",
    "project_asset_links",
    "project_site_links",
    # Attachments
    "Attachment",
    "LinkedType",
    # Providers
    "InternetProvider",
]
