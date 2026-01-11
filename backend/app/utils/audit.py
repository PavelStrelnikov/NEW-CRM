"""
Audit utility functions for logging entity changes.
"""
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent


def create_audit_event(
    db: Session,
    entity_type: str,
    entity_id: UUID,
    action: str,
    old_values: Optional[Dict[str, Any]],
    new_values: Optional[Dict[str, Any]],
    actor_type: str,
    actor_id: Optional[UUID],
    actor_display: str
) -> AuditEvent:
    """
    Create an audit event for tracking entity changes.

    Args:
        db: Database session
        entity_type: Type of entity (e.g., "client", "contact", "asset")
        entity_id: UUID of the entity
        action: Action performed (create, update, delete, deactivate)
        old_values: Dictionary of old values (for updates/deletes)
        new_values: Dictionary of new values (for creates/updates)
        actor_type: Type of actor (internal_user, client_user, system)
        actor_id: UUID of the actor (if applicable)
        actor_display: Display name of the actor

    Returns:
        Created AuditEvent instance
    """
    event = AuditEvent(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_values_json=old_values,
        new_values_json=new_values,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_display=actor_display
    )
    db.add(event)
    # Don't commit - let caller handle transaction
    return event
