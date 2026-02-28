"""Create ticket_assignment_history table for tracking assignment changes (audit trail)

Revision ID: 20260113_000006
Revises: 20260113_000005
Create Date: 2026-01-13 00:00:06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260113_000006'
down_revision: Union[str, None] = '20260113_000005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ticket_assignment_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_to_internal_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('assigned_by_actor_type', sa.String(), nullable=False),
        sa.Column('assigned_by_actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_by_actor_display', sa.String(), nullable=False),
        sa.Column('assignment_type', sa.String(), nullable=False),  # 'auto' | 'manual' | 'reassign'
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_to_internal_user_id'], ['internal_users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('ix_ticket_assignment_history_ticket_id', 'ticket_assignment_history', ['ticket_id'])
    op.create_index('ix_ticket_assignment_history_assigned_to', 'ticket_assignment_history', ['assigned_to_internal_user_id'])
    op.create_index('ix_ticket_assignment_history_created_at', 'ticket_assignment_history', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_ticket_assignment_history_created_at', table_name='ticket_assignment_history')
    op.drop_index('ix_ticket_assignment_history_assigned_to', table_name='ticket_assignment_history')
    op.drop_index('ix_ticket_assignment_history_ticket_id', table_name='ticket_assignment_history')
    op.drop_table('ticket_assignment_history')
