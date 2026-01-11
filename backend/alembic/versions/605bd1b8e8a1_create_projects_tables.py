"""create_projects_tables

Revision ID: 605bd1b8e8a1
Revises: 208b11c400e3
Create Date: 2026-01-09 19:13:13.974290

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '605bd1b8e8a1'
down_revision: Union[str, Sequence[str], None] = '208b11c400e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='planned'),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('target_end_date', sa.Date(), nullable=True),
        sa.Column('actual_end_date', sa.Date(), nullable=True),
        sa.Column('created_by_actor_type', sa.String(), nullable=False),
        sa.Column('created_by_actor_id', sa.UUID(), nullable=True),
        sa.Column('created_by_actor_display', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_projects_client_id'), 'projects', ['client_id'], unique=False)

    # Create project_events table
    op.create_table(
        'project_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('actor_type', sa.String(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('actor_display', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_project_events_project_id'), 'project_events', ['project_id'], unique=False)
    op.create_index(op.f('ix_project_events_created_at'), 'project_events', ['created_at'], unique=False)

    # Create project_ticket_links table
    op.create_table(
        'project_ticket_links',
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('ticket_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('project_id', 'ticket_id')
    )

    # Create project_asset_links table
    op.create_table(
        'project_asset_links',
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('asset_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('project_id', 'asset_id')
    )

    # Create project_site_links table
    op.create_table(
        'project_site_links',
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('site_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('project_id', 'site_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('project_site_links')
    op.drop_table('project_asset_links')
    op.drop_table('project_ticket_links')
    op.drop_index(op.f('ix_project_events_created_at'), table_name='project_events')
    op.drop_index(op.f('ix_project_events_project_id'), table_name='project_events')
    op.drop_table('project_events')
    op.drop_index(op.f('ix_projects_client_id'), table_name='projects')
    op.drop_table('projects')
