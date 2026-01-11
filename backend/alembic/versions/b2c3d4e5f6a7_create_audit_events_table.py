"""create audit_events table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-09 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create audit_events table."""
    op.create_table(
        'audit_events',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False, index=True),
        sa.Column('entity_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('action', sa.String(), nullable=False),  # create/update/delete/deactivate
        sa.Column('old_values_json', JSON(), nullable=True),
        sa.Column('new_values_json', JSON(), nullable=True),
        sa.Column('actor_type', sa.String(), nullable=False),
        sa.Column('actor_id', UUID(as_uuid=True), nullable=True),
        sa.Column('actor_display', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_events_created_at', 'audit_events', ['created_at'])


def downgrade() -> None:
    """Drop audit_events table."""
    op.drop_index('ix_audit_events_created_at', 'audit_events')
    op.drop_table('audit_events')
