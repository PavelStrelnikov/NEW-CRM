"""
Projects API endpoints.
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, select
from datetime import datetime

from app.db.session import get_db
from app.models.projects import (
    Project, ProjectEvent, ProjectStatus,
    project_ticket_links, project_asset_links, project_site_links
)
from app.models.clients import Client, Site
from app.models.tickets import Ticket
from app.models.assets import Asset
from app.schemas.projects import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectEventCreate,
    ProjectEventResponse,
    ProjectSiteLink,
    ProjectTicketLink,
    ProjectAssetLink
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user

router = APIRouter()


def get_actor_info(current_user: CurrentUser) -> tuple[str, Optional[UUID], str]:
    """Extract actor information from current user."""
    actor_type = current_user.user_type
    actor_id = current_user.id
    actor_display = current_user.name
    return actor_type, actor_id, actor_display


def verify_client_access(db: Session, current_user: CurrentUser, client_id: UUID) -> bool:
    """Verify that client user has access to the specified client."""
    if current_user.user_type != "client":
        return True  # Internal users have full access

    if client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied to this client")

    return True


# ========== Project CRUD Endpoints ==========

@router.get("/projects", response_model=ProjectListResponse)
async def list_projects(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    status: Optional[str] = Query(None, description="Filter by status"),
    q: Optional[str] = Query(None, description="Search by project name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List projects with filtering and pagination.

    **RBAC:**
    - Internal users: Can see all projects
    - Client users: Can only see projects for their own client
    """
    query = db.query(Project)

    # Apply RBAC filters
    if current_user.user_type == "client":
        query = query.filter(Project.client_id == current_user.client_id)

    # Apply filters
    if client_id:
        query = query.filter(Project.client_id == client_id)
    if status:
        query = query.filter(Project.status == status)
    if q:
        query = query.filter(Project.name.ilike(f"%{q}%"))

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    projects = query.order_by(Project.created_at.desc()).offset(offset).limit(page_size).all()

    # Enrich with client names
    for project in projects:
        client = db.query(Client).filter(Client.id == project.client_id).first()
        if client:
            project.client_name = client.name

    return ProjectListResponse(
        items=projects,
        total=total
    )


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    project_data: ProjectCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new project.

    **RBAC:**
    - Internal users: Can create projects for any client
    - Client users: Can only create projects for their own client
    """
    # Verify client access
    verify_client_access(db, current_user, project_data.client_id)

    # Verify client exists
    client = db.query(Client).filter(Client.id == project_data.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get actor info
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    # Create project
    project = Project(
        client_id=project_data.client_id,
        name=project_data.name,
        description=project_data.description,
        status=project_data.status,
        start_date=project_data.start_date,
        target_end_date=project_data.target_end_date,
        actual_end_date=project_data.actual_end_date,
        created_by_actor_type=actor_type,
        created_by_actor_id=actor_id,
        created_by_actor_display=actor_display
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # Create initial event
    event = ProjectEvent(
        project_id=project.id,
        event_type="note",
        message=f"Project created: {project.name}",
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)
    db.commit()

    # Enrich response
    project.client_name = client.name

    return project


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get project details.

    **RBAC:**
    - Internal users: Can see all projects
    - Client users: Can only see projects for their own client
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify access
    verify_client_access(db, current_user, project.client_id)

    # Enrich with client name
    client = db.query(Client).filter(Client.id == project.client_id).first()
    if client:
        project.client_name = client.name

    # Include events
    events = db.query(ProjectEvent).filter(
        ProjectEvent.project_id == project_id
    ).order_by(ProjectEvent.created_at.desc()).all()
    project.events = events

    return project


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update a project.

    **RBAC:**
    - Internal users: Can update any project
    - Client users: Can only update projects for their own client
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify access
    verify_client_access(db, current_user, project.client_id)

    # Track old status for event
    old_status = project.status

    # Update fields
    update_data = project_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)

    # Create event if status changed
    if "status" in update_data and update_data["status"] != old_status:
        actor_type, actor_id, actor_display = get_actor_info(current_user)
        event = ProjectEvent(
            project_id=project.id,
            event_type="status_change",
            message=f"Status changed from {old_status} to {project.status}",
            actor_type=actor_type,
            actor_id=actor_id,
            actor_display=actor_display
        )
        db.add(event)
        db.commit()

    # Enrich response
    client = db.query(Client).filter(Client.id == project.client_id).first()
    if client:
        project.client_name = client.name

    return project


# ========== Project Linking Endpoints ==========

@router.post("/projects/{project_id}/sites", status_code=204)
async def link_sites_to_project(
    project_id: UUID,
    link_data: ProjectSiteLink,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Link sites to a project.

    **RBAC:**
    - Internal users: Can link sites to any project
    - Client users: Can only link sites to their own client's projects
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify access
    verify_client_access(db, current_user, project.client_id)

    # Verify all sites belong to the same client and exist
    for site_id in link_data.site_ids:
        site = db.query(Site).filter(Site.id == site_id).first()
        if not site:
            raise HTTPException(status_code=404, detail=f"Site {site_id} not found")
        if site.client_id != project.client_id:
            raise HTTPException(
                status_code=400,
                detail=f"Site {site_id} does not belong to project's client"
            )

    # Add links (avoid duplicates)
    for site_id in link_data.site_ids:
        existing = db.execute(
            select(project_site_links).where(
                project_site_links.c.project_id == project_id,
                project_site_links.c.site_id == site_id
            )
        ).first()

        if not existing:
            db.execute(
                project_site_links.insert().values(
                    project_id=project_id,
                    site_id=site_id
                )
            )

    db.commit()
    return None


@router.post("/projects/{project_id}/tickets", status_code=204)
async def link_tickets_to_project(
    project_id: UUID,
    link_data: ProjectTicketLink,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Link tickets to a project.

    **RBAC:**
    - Internal users: Can link tickets to any project
    - Client users: Can only link tickets to their own client's projects
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify access
    verify_client_access(db, current_user, project.client_id)

    # Verify all tickets belong to the same client and exist
    for ticket_id in link_data.ticket_ids:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
        if ticket.client_id != project.client_id:
            raise HTTPException(
                status_code=400,
                detail=f"Ticket {ticket_id} does not belong to project's client"
            )

    # Add links (avoid duplicates)
    for ticket_id in link_data.ticket_ids:
        existing = db.execute(
            select(project_ticket_links).where(
                project_ticket_links.c.project_id == project_id,
                project_ticket_links.c.ticket_id == ticket_id
            )
        ).first()

        if not existing:
            db.execute(
                project_ticket_links.insert().values(
                    project_id=project_id,
                    ticket_id=ticket_id
                )
            )

    db.commit()
    return None


@router.post("/projects/{project_id}/assets", status_code=204)
async def link_assets_to_project(
    project_id: UUID,
    link_data: ProjectAssetLink,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Link assets to a project.

    **RBAC:**
    - Internal users: Can link assets to any project
    - Client users: Can only link assets to their own client's projects
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify access
    verify_client_access(db, current_user, project.client_id)

    # Verify all assets belong to the same client and exist
    for asset_id in link_data.asset_ids:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
        if asset.client_id != project.client_id:
            raise HTTPException(
                status_code=400,
                detail=f"Asset {asset_id} does not belong to project's client"
            )

    # Add links (avoid duplicates)
    for asset_id in link_data.asset_ids:
        existing = db.execute(
            select(project_asset_links).where(
                project_asset_links.c.project_id == project_id,
                project_asset_links.c.asset_id == asset_id
            )
        ).first()

        if not existing:
            db.execute(
                project_asset_links.insert().values(
                    project_id=project_id,
                    asset_id=asset_id
                )
            )

    db.commit()
    return None


# ========== Project Events Endpoint ==========

@router.post("/projects/{project_id}/events", response_model=ProjectEventResponse, status_code=201)
async def create_project_event(
    project_id: UUID,
    event_data: ProjectEventCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a project event (note, milestone, etc).

    **RBAC:**
    - Internal users: Can create events for any project
    - Client users: Can only create events for their own client's projects
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify access
    verify_client_access(db, current_user, project.client_id)

    # Get actor info
    actor_type, actor_id, actor_display = get_actor_info(current_user)

    # Create event
    event = ProjectEvent(
        project_id=project_id,
        event_type=event_data.event_type,
        message=event_data.message,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event
