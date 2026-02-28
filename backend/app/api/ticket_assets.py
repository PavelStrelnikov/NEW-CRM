"""
API endpoints for ticket-asset linking.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, delete, update
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.tickets import Ticket
from app.models.assets import Asset, ticket_asset_links, AssetType
from app.schemas.ticket_assets import (
    TicketAssetLinkCreate,
    TicketAssetLinkUpdate,
    LinkedAssetResponse,
    TicketInfoResponse,
    AssetTypeInfo
)
from app.schemas.auth import CurrentUser
from app.auth.dependencies import get_current_active_user, require_admin_or_technician


router = APIRouter()


@router.get("/tickets/{ticket_id}/assets", response_model=List[LinkedAssetResponse])
async def list_linked_assets(
    ticket_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all assets linked to a ticket.

    **RBAC:**
    - Internal users: Can access any ticket's assets
    - Client users: Can only access assets for their own client's tickets
    """
    # Verify ticket exists and user has access
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(ticket.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Get linked assets with relation_type
    stmt = (
        select(Asset, ticket_asset_links.c.relation_type)
        .join(ticket_asset_links, Asset.id == ticket_asset_links.c.asset_id)
        .where(ticket_asset_links.c.ticket_id == ticket_id)
        .options(joinedload(Asset.asset_type))
    )

    results = db.execute(stmt).all()

    # Build response
    response = []
    for asset, relation_type in results:
        asset_type_info = None
        if asset.asset_type:
            asset_type_info = AssetTypeInfo(
                code=asset.asset_type.code,
                name_he=asset.asset_type.name_he,
                name_en=asset.asset_type.name_en
            )

        response.append(LinkedAssetResponse(
            id=asset.id,
            label=asset.label,
            manufacturer=asset.manufacturer,
            model=asset.model,
            serial_number=asset.serial_number,
            status=asset.status,
            asset_type=asset_type_info,
            relation_type=relation_type
        ))

    return response


@router.post("/tickets/{ticket_id}/assets", status_code=status.HTTP_201_CREATED)
async def link_asset_to_ticket(
    ticket_id: UUID,
    link_data: TicketAssetLinkCreate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Link an asset to a ticket.

    **Validation:**
    - Asset must belong to the same client as the ticket
    - Asset cannot be linked twice to the same ticket

    **RBAC:** Admin or Technician only
    """
    # Verify ticket exists
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Verify asset exists
    asset = db.query(Asset).filter(Asset.id == link_data.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # Validate asset belongs to same client
    if str(asset.client_id) != str(ticket.client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset must belong to the same client as the ticket"
        )

    # Check if link already exists
    stmt = select(ticket_asset_links).where(
        ticket_asset_links.c.ticket_id == ticket_id,
        ticket_asset_links.c.asset_id == link_data.asset_id
    )
    existing = db.execute(stmt).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset already linked to this ticket"
        )

    # Create link
    stmt = ticket_asset_links.insert().values(
        ticket_id=ticket_id,
        asset_id=link_data.asset_id,
        relation_type=link_data.relation_type
    )
    db.execute(stmt)
    db.commit()

    return {"message": "Asset linked successfully"}


@router.patch("/tickets/{ticket_id}/assets/{asset_id}")
async def update_asset_link(
    ticket_id: UUID,
    asset_id: UUID,
    link_data: TicketAssetLinkUpdate,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Update the relation_type of an asset link.

    **RBAC:** Admin or Technician only
    """
    # Check if link exists
    stmt = select(ticket_asset_links).where(
        ticket_asset_links.c.ticket_id == ticket_id,
        ticket_asset_links.c.asset_id == asset_id
    )
    existing = db.execute(stmt).first()
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset link not found"
        )

    # Update relation_type
    stmt = (
        update(ticket_asset_links)
        .where(
            ticket_asset_links.c.ticket_id == ticket_id,
            ticket_asset_links.c.asset_id == asset_id
        )
        .values(relation_type=link_data.relation_type)
    )
    db.execute(stmt)
    db.commit()

    return {"message": "Asset link updated successfully"}


@router.delete("/tickets/{ticket_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_asset_from_ticket(
    ticket_id: UUID,
    asset_id: UUID,
    current_user: CurrentUser = Depends(require_admin_or_technician),
    db: Session = Depends(get_db)
):
    """
    Unlink an asset from a ticket.

    **RBAC:** Admin or Technician only
    """
    # Delete link
    stmt = delete(ticket_asset_links).where(
        ticket_asset_links.c.ticket_id == ticket_id,
        ticket_asset_links.c.asset_id == asset_id
    )
    result = db.execute(stmt)
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset link not found"
        )

    return None


@router.get("/assets/{asset_id}/tickets", response_model=List[TicketInfoResponse])
async def list_asset_tickets(
    asset_id: UUID,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all tickets linked to an asset (historical view).

    **RBAC:**
    - Internal users: Can access any asset's tickets
    - Client users: Can only access tickets for their own client's assets
    """
    # Verify asset exists
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset not found"
        )

    # RBAC check
    if current_user.user_type == "client":
        if str(current_user.client_id) != str(asset.client_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Get linked tickets with relation_type
    stmt = (
        select(Ticket, ticket_asset_links.c.relation_type)
        .join(ticket_asset_links, Ticket.id == ticket_asset_links.c.ticket_id)
        .where(ticket_asset_links.c.asset_id == asset_id)
        .options(joinedload(Ticket.status))
        .order_by(Ticket.created_at.desc())
    )

    results = db.execute(stmt).all()

    # Build response
    response = []
    for ticket, relation_type in results:
        response.append(TicketInfoResponse(
            id=ticket.id,
            ticket_number=ticket.ticket_number,
            title=ticket.title,
            status_code=ticket.status.code if ticket.status else None,
            priority=ticket.priority,
            relation_type=relation_type,
            created_at=ticket.created_at,
            closed_at=ticket.closed_at
        ))

    return response
