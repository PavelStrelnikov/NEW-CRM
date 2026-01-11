"""
Pydantic schemas for reports.
"""
from typing import Optional, List
from pydantic import BaseModel
from datetime import date


# ========== Common Report Schemas ==========

class DateRangeFilter(BaseModel):
    """Date range filter for reports."""
    start_date: date
    end_date: date


# ========== Ticket Reports ==========

class TicketStatusStat(BaseModel):
    """Ticket statistics by status."""
    status_code: str
    status_name: Optional[str] = None
    count: int
    percentage: float


class TicketPriorityStat(BaseModel):
    """Ticket statistics by priority."""
    priority: str
    count: int
    percentage: float


class TicketCategoryStat(BaseModel):
    """Ticket statistics by category."""
    category: str
    count: int
    percentage: float


class TicketsByClientStat(BaseModel):
    """Ticket statistics by client."""
    client_id: str
    client_name: str
    total_tickets: int
    open_tickets: int
    closed_tickets: int


class TicketSummaryReport(BaseModel):
    """Overall ticket summary."""
    total_tickets: int
    open_tickets: int
    closed_tickets: int
    by_status: List[TicketStatusStat]
    by_priority: List[TicketPriorityStat]
    by_category: List[TicketCategoryStat]


# ========== Work Time Reports ==========

class WorkTimeByStat(BaseModel):
    """Generic work time statistics."""
    name: str
    id: Optional[str] = None
    total_minutes: int
    total_hours: float
    billable_minutes: int
    billable_hours: float
    non_billable_minutes: int
    non_billable_hours: float


class WorkTimeByTechnician(WorkTimeByStat):
    """Work time by technician."""
    ticket_count: int


class WorkTimeByClient(WorkTimeByStat):
    """Work time by client."""
    ticket_count: int


class WorkTimeByType(BaseModel):
    """Work time by work type."""
    work_type: str
    total_minutes: int
    total_hours: float
    log_count: int


class WorkTimeSummaryReport(BaseModel):
    """Overall work time summary."""
    total_minutes: int
    total_hours: float
    billable_minutes: int
    billable_hours: float
    non_billable_minutes: int
    non_billable_hours: float
    by_technician: List[WorkTimeByTechnician]
    by_client: List[WorkTimeByClient]
    by_type: List[WorkTimeByType]


# ========== Client Reports ==========

class ClientActivityStat(BaseModel):
    """Client activity statistics."""
    client_id: str
    client_name: str
    total_tickets: int
    open_tickets: int
    closed_tickets: int
    total_assets: int
    active_assets: int
    total_work_hours: float
    last_ticket_date: Optional[date] = None


class ClientSummaryReport(BaseModel):
    """Client summary report."""
    total_clients: int
    active_clients: int  # Clients with tickets in period
    client_activity: List[ClientActivityStat]


# ========== Asset Reports ==========

class AssetByTypeStat(BaseModel):
    """Asset statistics by type."""
    asset_type_code: str
    asset_type_name: Optional[str] = None
    count: int
    percentage: float


class AssetByStatusStat(BaseModel):
    """Asset statistics by status."""
    status: str
    count: int
    percentage: float


class AssetByClientStat(BaseModel):
    """Asset statistics by client."""
    client_id: str
    client_name: str
    total_assets: int
    by_type: List[AssetByTypeStat]


class AssetSummaryReport(BaseModel):
    """Asset summary report."""
    total_assets: int
    by_type: List[AssetByTypeStat]
    by_status: List[AssetByStatusStat]


# ========== Technician Performance ==========

class TechnicianPerformanceStat(BaseModel):
    """Technician performance statistics."""
    technician_id: str
    technician_name: str
    assigned_tickets: int
    closed_tickets: int
    closure_rate: float
    total_work_hours: float
    avg_resolution_hours: Optional[float] = None


class TechnicianPerformanceReport(BaseModel):
    """Technician performance report."""
    technicians: List[TechnicianPerformanceStat]


# ========== Line Item Reports ==========

class LineItemStat(BaseModel):
    """Line item statistics."""
    item_type: str
    count: int
    included_count: int
    chargeable_count: int


class LineItemSummaryReport(BaseModel):
    """Line item summary."""
    total_items: int
    by_type: List[LineItemStat]
