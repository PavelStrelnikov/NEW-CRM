"""Create nvr_channels table for channel customization

Revision ID: 20260117_000001
Revises: 20260116_230000
Create Date: 2026-01-17

Adds table for NVR channel customization with custom names, ignore flags, and service notes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '20260117_000001'
down_revision = '20260116_230000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create nvr_channels table."""
    op.create_table(
        'nvr_channels',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('asset_id', UUID(as_uuid=True), nullable=False),
        sa.Column('channel_number', sa.Integer(), nullable=False),
        sa.Column('custom_name', sa.String(100), nullable=True),
        sa.Column('is_ignored', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('updated_by_actor_type', sa.String(), nullable=False),
        sa.Column('updated_by_actor_id', UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_actor_display', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('asset_id', 'channel_number', name='uq_nvr_channel_asset_channel')
    )

    # Create indexes for better query performance
    op.create_index('ix_nvr_channels_asset_id', 'nvr_channels', ['asset_id'])
    op.create_index('ix_nvr_channels_asset_id_channel', 'nvr_channels', ['asset_id', 'channel_number'])


def downgrade() -> None:
    """Drop nvr_channels table."""
    op.drop_index('ix_nvr_channels_asset_id_channel', table_name='nvr_channels')
    op.drop_index('ix_nvr_channels_asset_id', table_name='nvr_channels')
    op.drop_table('nvr_channels')
