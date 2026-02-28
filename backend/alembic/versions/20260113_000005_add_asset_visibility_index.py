"""Add index on asset_property_definitions visibility column for portal filtering

Revision ID: 20260113_000005
Revises: 20260113_000004
Create Date: 2026-01-13 00:00:05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260113_000005'
down_revision: Union[str, None] = '20260113_000003'  # Skip deleted migration 004
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add index on visibility column for efficient filtering when displaying assets to portal users
    op.create_index(
        'ix_asset_property_definitions_visibility',
        'asset_property_definitions',
        ['visibility']
    )


def downgrade() -> None:
    op.drop_index('ix_asset_property_definitions_visibility', table_name='asset_property_definitions')
