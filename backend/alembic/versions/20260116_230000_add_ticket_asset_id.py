"""Add asset_id to tickets table for direct asset relationship.

Revision ID: 20260116_230000
Revises: 20260116_220000
Create Date: 2026-01-16

Adds asset_id column to tickets table to establish a direct one-to-many
relationship between assets and tickets. This allows viewing ticket history
directly in the asset details page.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '20260116_230000'
down_revision = '20260116_220000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add asset_id column to tickets table."""
    # Add asset_id column with FK to assets
    op.add_column('tickets', sa.Column(
        'asset_id',
        UUID(as_uuid=True),
        sa.ForeignKey('assets.id', ondelete='SET NULL'),
        nullable=True
    ))

    # Create index for efficient querying tickets by asset
    op.create_index('ix_tickets_asset_id', 'tickets', ['asset_id'])


def downgrade() -> None:
    """Remove asset_id column from tickets table."""
    op.drop_index('ix_tickets_asset_id', table_name='tickets')
    op.drop_column('tickets', 'asset_id')
