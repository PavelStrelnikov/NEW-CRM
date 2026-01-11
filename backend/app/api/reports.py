"""
Reports API endpoints with caching and export functionality.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import date, datetime

from app.db.session import get_db
from app.models.tickets import Ticket, TicketStatusDefinition
from app.models.time_billing import WorkLog, TicketLineItem
from app.models.assets import Asset, AssetType
from app.models.clients import Client
from app.models.users import InternalUser
from app.schemas.reports import (
    TicketSummaryReport,
    TicketStatusStat,
    TicketPriorityStat,
    TicketCategoryStat,
    TicketsByClientStat,
    WorkTimeSummaryReport,
    WorkTimeByTechnician,
    WorkTimeByClient,
    WorkTimeByType,
    ClientSummaryReport,
    ClientActivityStat,
    AssetSummaryReport,
    AssetByTypeStat,
    AssetByStatusStat,
    AssetByClientStat,
    TechnicianPerformanceReport,
    TechnicianPerformanceStat,
    LineItemSummaryReport,
    LineItemStat
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user
from app.utils.cache import cached_report
from app.utils.export import create_csv_response, create_excel_response, generate_export_filename

router = APIRouter()


def apply_client_filter(query, model, current_user: CurrentUser):
    """Apply client filter for RBAC."""
    if current_user.user_type == "client":
        return query.filter(model.client_id == current_user.client_id)
    return query


def apply_date_filter(query, model, start_date: Optional[date], end_date: Optional[date]):
    """Apply date range filter."""
    if start_date:
        query = query.filter(model.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(model.created_at <= datetime.combine(end_date, datetime.max.time()))
    return query


# ========== Ticket Reports ==========

@router.get("/reports/tickets/summary", response_model=TicketSummaryReport)
@cached_report(ttl=300, key_prefix="tickets_summary")
async def get_ticket_summary_report(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get ticket summary report (cached for 5 minutes).

    **RBAC:**
    - Internal users: Can see all tickets
    - Client users: Can only see their own tickets
    """
    query = db.query(Ticket)

    # Apply RBAC
    query = apply_client_filter(query, Ticket, current_user)

    # Apply filters
    query = apply_date_filter(query, Ticket, start_date, end_date)
    if client_id:
        query = query.filter(Ticket.client_id == client_id)

    # Get all tickets
    tickets = query.all()
    total_tickets = len(tickets)

    # Count open/closed
    open_tickets = sum(1 for t in tickets if not t.status.is_closed_state)
    closed_tickets = sum(1 for t in tickets if t.status.is_closed_state)

    # Group by status
    status_counts = {}
    for ticket in tickets:
        status_code = ticket.status.code
        if status_code not in status_counts:
            status_counts[status_code] = {
                'count': 0,
                'name': ticket.status.name_en or ticket.status.name_he
            }
        status_counts[status_code]['count'] += 1

    by_status = [
        TicketStatusStat(
            status_code=code,
            status_name=data['name'],
            count=data['count'],
            percentage=round(data['count'] / total_tickets * 100, 2) if total_tickets > 0 else 0
        )
        for code, data in status_counts.items()
    ]

    # Group by priority
    priority_counts = {}
    for ticket in tickets:
        priority = ticket.priority
        priority_counts[priority] = priority_counts.get(priority, 0) + 1

    by_priority = [
        TicketPriorityStat(
            priority=priority,
            count=count,
            percentage=round(count / total_tickets * 100, 2) if total_tickets > 0 else 0
        )
        for priority, count in priority_counts.items()
    ]

    # Group by category
    category_counts = {}
    for ticket in tickets:
        category = ticket.category or "Uncategorized"
        category_counts[category] = category_counts.get(category, 0) + 1

    by_category = [
        TicketCategoryStat(
            category=category,
            count=count,
            percentage=round(count / total_tickets * 100, 2) if total_tickets > 0 else 0
        )
        for category, count in category_counts.items()
    ]

    return TicketSummaryReport(
        total_tickets=total_tickets,
        open_tickets=open_tickets,
        closed_tickets=closed_tickets,
        by_status=by_status,
        by_priority=by_priority,
        by_category=by_category
    )


@router.get("/reports/tickets/by-client", response_model=list[TicketsByClientStat])
async def get_tickets_by_client_report(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get ticket statistics grouped by client.

    **RBAC:**
    - Internal users: Can see all clients
    - Client users: Can only see their own stats
    """
    query = db.query(
        Client.id,
        Client.name,
        func.count(Ticket.id).label('total'),
        func.sum(case((Ticket.closed_at.is_(None), 1), else_=0)).label('open_count'),
        func.sum(case((Ticket.closed_at.isnot(None), 1), else_=0)).label('closed_count')
    ).join(Ticket, Client.id == Ticket.client_id)

    # Apply RBAC
    if current_user.user_type == "client":
        query = query.filter(Client.id == current_user.client_id)

    # Apply date filter
    if start_date:
        query = query.filter(Ticket.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Ticket.created_at <= datetime.combine(end_date, datetime.max.time()))

    query = query.group_by(Client.id, Client.name)
    results = query.all()

    return [
        TicketsByClientStat(
            client_id=str(row[0]),
            client_name=row[1],
            total_tickets=row[2],
            open_tickets=row[3] or 0,
            closed_tickets=row[4] or 0
        )
        for row in results
    ]


# ========== Work Time Reports ==========

@router.get("/reports/work-time/summary", response_model=WorkTimeSummaryReport)
async def get_work_time_summary_report(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get work time summary report.

    **RBAC:**
    - Internal users: Can see all work logs
    - Client users: Can only see their own work logs
    """
    # Base query with ticket join for client filter
    query = db.query(WorkLog).join(Ticket, WorkLog.ticket_id == Ticket.id)

    # Apply RBAC
    if current_user.user_type == "client":
        query = query.filter(Ticket.client_id == current_user.client_id)

    # Apply filters
    query = apply_date_filter(query, WorkLog, start_date, end_date)
    if client_id:
        query = query.filter(Ticket.client_id == client_id)

    work_logs = query.all()

    # Calculate totals
    total_minutes = sum(wl.duration_minutes for wl in work_logs)
    billable_minutes = sum(wl.duration_minutes for wl in work_logs if not wl.included_in_service)
    non_billable_minutes = sum(wl.duration_minutes for wl in work_logs if wl.included_in_service)

    # Group by technician (actor)
    technician_stats = {}
    for wl in work_logs:
        tech_id = str(wl.actor_id) if wl.actor_id else "unknown"
        tech_name = wl.actor_display

        if tech_id not in technician_stats:
            technician_stats[tech_id] = {
                'name': tech_name,
                'total_minutes': 0,
                'billable_minutes': 0,
                'non_billable_minutes': 0,
                'tickets': set()
            }

        technician_stats[tech_id]['total_minutes'] += wl.duration_minutes
        if wl.included_in_service:
            technician_stats[tech_id]['non_billable_minutes'] += wl.duration_minutes
        else:
            technician_stats[tech_id]['billable_minutes'] += wl.duration_minutes
        technician_stats[tech_id]['tickets'].add(str(wl.ticket_id))

    by_technician = [
        WorkTimeByTechnician(
            id=tech_id,
            name=data['name'],
            total_minutes=data['total_minutes'],
            total_hours=round(data['total_minutes'] / 60, 2),
            billable_minutes=data['billable_minutes'],
            billable_hours=round(data['billable_minutes'] / 60, 2),
            non_billable_minutes=data['non_billable_minutes'],
            non_billable_hours=round(data['non_billable_minutes'] / 60, 2),
            ticket_count=len(data['tickets'])
        )
        for tech_id, data in technician_stats.items()
    ]

    # Group by client
    client_stats = {}
    for wl in work_logs:
        ticket = db.query(Ticket).filter(Ticket.id == wl.ticket_id).first()
        if ticket:
            client_id = str(ticket.client_id)
            client_name = ticket.client.name if ticket.client else "Unknown"

            if client_id not in client_stats:
                client_stats[client_id] = {
                    'name': client_name,
                    'total_minutes': 0,
                    'billable_minutes': 0,
                    'non_billable_minutes': 0,
                    'tickets': set()
                }

            client_stats[client_id]['total_minutes'] += wl.duration_minutes
            if wl.included_in_service:
                client_stats[client_id]['non_billable_minutes'] += wl.duration_minutes
            else:
                client_stats[client_id]['billable_minutes'] += wl.duration_minutes
            client_stats[client_id]['tickets'].add(str(wl.ticket_id))

    by_client = [
        WorkTimeByClient(
            id=client_id,
            name=data['name'],
            total_minutes=data['total_minutes'],
            total_hours=round(data['total_minutes'] / 60, 2),
            billable_minutes=data['billable_minutes'],
            billable_hours=round(data['billable_minutes'] / 60, 2),
            non_billable_minutes=data['non_billable_minutes'],
            non_billable_hours=round(data['non_billable_minutes'] / 60, 2),
            ticket_count=len(data['tickets'])
        )
        for client_id, data in client_stats.items()
    ]

    # Group by work type
    type_stats = {}
    for wl in work_logs:
        work_type = wl.work_type
        if work_type not in type_stats:
            type_stats[work_type] = {
                'total_minutes': 0,
                'count': 0
            }
        type_stats[work_type]['total_minutes'] += wl.duration_minutes
        type_stats[work_type]['count'] += 1

    by_type = [
        WorkTimeByType(
            work_type=work_type,
            total_minutes=data['total_minutes'],
            total_hours=round(data['total_minutes'] / 60, 2),
            log_count=data['count']
        )
        for work_type, data in type_stats.items()
    ]

    return WorkTimeSummaryReport(
        total_minutes=total_minutes,
        total_hours=round(total_minutes / 60, 2),
        billable_minutes=billable_minutes,
        billable_hours=round(billable_minutes / 60, 2),
        non_billable_minutes=non_billable_minutes,
        non_billable_hours=round(non_billable_minutes / 60, 2),
        by_technician=by_technician,
        by_client=by_client,
        by_type=by_type
    )


# ========== Client Reports ==========

@router.get("/reports/clients/activity", response_model=ClientSummaryReport)
async def get_client_activity_report(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get client activity report.

    **RBAC:**
    - Internal users: Can see all clients
    - Client users: Can only see their own stats
    """
    clients_query = db.query(Client)

    # Apply RBAC
    if current_user.user_type == "client":
        clients_query = clients_query.filter(Client.id == current_user.client_id)

    clients = clients_query.all()
    client_activity = []
    active_count = 0

    for client in clients:
        # Get tickets for this client
        tickets_query = db.query(Ticket).filter(Ticket.client_id == client.id)
        tickets_query = apply_date_filter(tickets_query, Ticket, start_date, end_date)
        tickets = tickets_query.all()

        # Get assets for this client
        assets = db.query(Asset).filter(Asset.client_id == client.id).all()

        # Get work logs for this client
        work_logs_query = db.query(WorkLog).join(Ticket).filter(Ticket.client_id == client.id)
        work_logs_query = apply_date_filter(work_logs_query, WorkLog, start_date, end_date)
        work_logs = work_logs_query.all()

        # Get last ticket date
        last_ticket = db.query(Ticket).filter(Ticket.client_id == client.id).order_by(Ticket.created_at.desc()).first()

        total_tickets = len(tickets)
        if total_tickets > 0:
            active_count += 1

        client_activity.append(ClientActivityStat(
            client_id=str(client.id),
            client_name=client.name,
            total_tickets=total_tickets,
            open_tickets=sum(1 for t in tickets if not t.status.is_closed_state),
            closed_tickets=sum(1 for t in tickets if t.status.is_closed_state),
            total_assets=len(assets),
            active_assets=sum(1 for a in assets if a.status == "active"),
            total_work_hours=round(sum(wl.duration_minutes for wl in work_logs) / 60, 2),
            last_ticket_date=last_ticket.created_at.date() if last_ticket else None
        ))

    return ClientSummaryReport(
        total_clients=len(clients),
        active_clients=active_count,
        client_activity=client_activity
    )


# ========== Asset Reports ==========

@router.get("/reports/assets/summary", response_model=AssetSummaryReport)
async def get_asset_summary_report(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get asset summary report.

    **RBAC:**
    - Internal users: Can see all assets
    - Client users: Can only see their own assets
    """
    query = db.query(Asset)

    # Apply RBAC
    query = apply_client_filter(query, Asset, current_user)

    # Apply filters
    if client_id:
        query = query.filter(Asset.client_id == client_id)

    assets = query.all()
    total_assets = len(assets)

    # Group by type
    type_counts = {}
    for asset in assets:
        type_code = asset.asset_type.code
        type_name = asset.asset_type.name_en or asset.asset_type.name_he
        if type_code not in type_counts:
            type_counts[type_code] = {
                'count': 0,
                'name': type_name
            }
        type_counts[type_code]['count'] += 1

    by_type = [
        AssetByTypeStat(
            asset_type_code=code,
            asset_type_name=data['name'],
            count=data['count'],
            percentage=round(data['count'] / total_assets * 100, 2) if total_assets > 0 else 0
        )
        for code, data in type_counts.items()
    ]

    # Group by status
    status_counts = {}
    for asset in assets:
        status = asset.status
        status_counts[status] = status_counts.get(status, 0) + 1

    by_status = [
        AssetByStatusStat(
            status=status,
            count=count,
            percentage=round(count / total_assets * 100, 2) if total_assets > 0 else 0
        )
        for status, count in status_counts.items()
    ]

    return AssetSummaryReport(
        total_assets=total_assets,
        by_type=by_type,
        by_status=by_status
    )


# ========== Technician Performance ==========

@router.get("/reports/technicians/performance", response_model=TechnicianPerformanceReport)
async def get_technician_performance_report(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get technician performance report.

    **RBAC:** Internal users only
    """
    if current_user.user_type != "internal":
        return TechnicianPerformanceReport(technicians=[])

    # Get all technicians
    technicians = db.query(InternalUser).filter(
        InternalUser.role.in_(["ADMIN", "TECHNICIAN"])
    ).all()

    technician_stats = []

    for tech in technicians:
        # Get assigned tickets
        assigned_query = db.query(Ticket).filter(Ticket.assigned_to_internal_user_id == tech.id)
        assigned_query = apply_date_filter(assigned_query, Ticket, start_date, end_date)
        assigned_tickets = assigned_query.all()

        # Count closed tickets
        closed_tickets = sum(1 for t in assigned_tickets if t.status.is_closed_state)

        # Get work logs
        work_logs_query = db.query(WorkLog).filter(WorkLog.actor_id == tech.id)
        work_logs_query = apply_date_filter(work_logs_query, WorkLog, start_date, end_date)
        work_logs = work_logs_query.all()

        # Calculate average resolution time for closed tickets
        resolution_times = []
        for ticket in assigned_tickets:
            if ticket.closed_at and ticket.created_at:
                resolution_hours = (ticket.closed_at - ticket.created_at).total_seconds() / 3600
                resolution_times.append(resolution_hours)

        avg_resolution_hours = round(sum(resolution_times) / len(resolution_times), 2) if resolution_times else None

        technician_stats.append(TechnicianPerformanceStat(
            technician_id=str(tech.id),
            technician_name=tech.name,
            assigned_tickets=len(assigned_tickets),
            closed_tickets=closed_tickets,
            closure_rate=round(closed_tickets / len(assigned_tickets) * 100, 2) if assigned_tickets else 0,
            total_work_hours=round(sum(wl.duration_minutes for wl in work_logs) / 60, 2),
            avg_resolution_hours=avg_resolution_hours
        ))

    return TechnicianPerformanceReport(technicians=technician_stats)


# ========== Line Item Reports ==========

@router.get("/reports/line-items/summary", response_model=LineItemSummaryReport)
async def get_line_items_summary_report(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get line items summary report.

    **RBAC:**
    - Internal users: Can see all line items
    - Client users: Can only see their own line items
    """
    # Base query with ticket join for client filter
    query = db.query(TicketLineItem).join(Ticket, TicketLineItem.ticket_id == Ticket.id)

    # Apply RBAC
    if current_user.user_type == "client":
        query = query.filter(Ticket.client_id == current_user.client_id)

    # Apply filters
    query = apply_date_filter(query, TicketLineItem, start_date, end_date)
    if client_id:
        query = query.filter(Ticket.client_id == client_id)

    line_items = query.all()
    total_items = len(line_items)

    # Group by item type
    type_stats = {}
    for item in line_items:
        item_type = item.item_type
        if item_type not in type_stats:
            type_stats[item_type] = {
                'count': 0,
                'included_count': 0,
                'chargeable_count': 0
            }
        type_stats[item_type]['count'] += 1
        if item.included_in_service:
            type_stats[item_type]['included_count'] += 1
        if item.chargeable:
            type_stats[item_type]['chargeable_count'] += 1

    by_type = [
        LineItemStat(
            item_type=item_type,
            count=data['count'],
            included_count=data['included_count'],
            chargeable_count=data['chargeable_count']
        )
        for item_type, data in type_stats.items()
    ]

    return LineItemSummaryReport(
        total_items=total_items,
        by_type=by_type
    )


# ========== Export Endpoints ==========

@router.get("/reports/tickets/summary/export/csv")
async def export_ticket_summary_csv(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export ticket summary report to CSV."""
    report = await get_ticket_summary_report(start_date, end_date, client_id, current_user, db)
    filename = generate_export_filename("tickets_summary", start_date, end_date)
    return create_csv_response(report, filename)


@router.get("/reports/tickets/summary/export/excel")
async def export_ticket_summary_excel(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export ticket summary report to Excel."""
    report = await get_ticket_summary_report(start_date, end_date, client_id, current_user, db)
    filename = generate_export_filename("tickets_summary", start_date, end_date)
    return create_excel_response(report, filename, sheet_name="Ticket Summary")


@router.get("/reports/tickets/by-client/export/csv")
async def export_tickets_by_client_csv(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export tickets by client report to CSV."""
    report = await get_tickets_by_client_report(start_date, end_date, current_user, db)
    filename = generate_export_filename("tickets_by_client", start_date, end_date)
    return create_csv_response(report, filename)


@router.get("/reports/tickets/by-client/export/excel")
async def export_tickets_by_client_excel(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export tickets by client report to Excel."""
    report = await get_tickets_by_client_report(start_date, end_date, current_user, db)
    filename = generate_export_filename("tickets_by_client", start_date, end_date)
    return create_excel_response(report, filename, sheet_name="Tickets by Client")


@router.get("/reports/work-time/summary/export/csv")
async def export_work_time_summary_csv(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export work time summary report to CSV."""
    report = await get_work_time_summary_report(start_date, end_date, client_id, current_user, db)
    filename = generate_export_filename("work_time_summary", start_date, end_date)
    return create_csv_response(report, filename)


@router.get("/reports/work-time/summary/export/excel")
async def export_work_time_summary_excel(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export work time summary report to Excel."""
    report = await get_work_time_summary_report(start_date, end_date, client_id, current_user, db)
    filename = generate_export_filename("work_time_summary", start_date, end_date)
    return create_excel_response(report, filename, sheet_name="Work Time Summary")


@router.get("/reports/clients/activity/export/csv")
async def export_client_activity_csv(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export client activity report to CSV."""
    report = await get_client_activity_report(start_date, end_date, current_user, db)
    filename = generate_export_filename("client_activity", start_date, end_date)
    return create_csv_response(report.client_activity, filename)


@router.get("/reports/clients/activity/export/excel")
async def export_client_activity_excel(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export client activity report to Excel."""
    report = await get_client_activity_report(start_date, end_date, current_user, db)
    filename = generate_export_filename("client_activity", start_date, end_date)
    return create_excel_response(report.client_activity, filename, sheet_name="Client Activity")


@router.get("/reports/assets/summary/export/csv")
async def export_asset_summary_csv(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export asset summary report to CSV."""
    report = await get_asset_summary_report(client_id, current_user, db)
    filename = generate_export_filename("assets_summary")
    return create_csv_response(report, filename)


@router.get("/reports/assets/summary/export/excel")
async def export_asset_summary_excel(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export asset summary report to Excel."""
    report = await get_asset_summary_report(client_id, current_user, db)
    filename = generate_export_filename("assets_summary")
    return create_excel_response(report, filename, sheet_name="Asset Summary")


@router.get("/reports/technicians/performance/export/csv")
async def export_technician_performance_csv(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export technician performance report to CSV."""
    report = await get_technician_performance_report(start_date, end_date, current_user, db)
    filename = generate_export_filename("technician_performance", start_date, end_date)
    return create_csv_response(report.technicians, filename)


@router.get("/reports/technicians/performance/export/excel")
async def export_technician_performance_excel(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export technician performance report to Excel."""
    report = await get_technician_performance_report(start_date, end_date, current_user, db)
    filename = generate_export_filename("technician_performance", start_date, end_date)
    return create_excel_response(report.technicians, filename, sheet_name="Technician Performance")


@router.get("/reports/line-items/summary/export/csv")
async def export_line_items_summary_csv(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export line items summary report to CSV."""
    report = await get_line_items_summary_report(start_date, end_date, client_id, current_user, db)
    filename = generate_export_filename("line_items_summary", start_date, end_date)
    return create_csv_response(report, filename)


@router.get("/reports/line-items/summary/export/excel")
async def export_line_items_summary_excel(
    start_date: Optional[date] = Query(None, description="Filter from date"),
    end_date: Optional[date] = Query(None, description="Filter to date"),
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export line items summary report to Excel."""
    report = await get_line_items_summary_report(start_date, end_date, client_id, current_user, db)
    filename = generate_export_filename("line_items_summary", start_date, end_date)
    return create_excel_response(report, filename, sheet_name="Line Items Summary")
