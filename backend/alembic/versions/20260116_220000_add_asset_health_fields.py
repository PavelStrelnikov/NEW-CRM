"""Add health monitoring fields to assets table.

Revision ID: 20260116_220000
Revises: 20260116_213044
Create Date: 2026-01-16

Adds health_status, health_issues, and last_probe_at fields to the assets table
for the Health Engine monitoring system.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = '20260116_220000'
down_revision = '20260116_213044'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add health monitoring columns to assets table."""
    # Add health_status column with default 'unknown'
    op.add_column('assets', sa.Column(
        'health_status',
        sa.String(20),
        nullable=False,
        server_default='unknown'
    ))

    # Add health_issues JSON column for storing issue codes
    op.add_column('assets', sa.Column(
        'health_issues',
        JSON,
        nullable=True
    ))

    # Add last_probe_at timestamp
    op.add_column('assets', sa.Column(
        'last_probe_at',
        sa.DateTime(),
        nullable=True
    ))

    # Create index on health_status for filtering
    op.create_index('ix_assets_health_status', 'assets', ['health_status'])


def downgrade() -> None:
    """Remove health monitoring columns from assets table."""
    op.drop_index('ix_assets_health_status', table_name='assets')
    op.drop_column('assets', 'last_probe_at')
    op.drop_column('assets', 'health_issues')
    op.drop_column('assets', 'health_status')
