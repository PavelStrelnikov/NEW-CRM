"""add composite index on asset_property_values

Revision ID: 485039a00917
Revises: 20260206_000002
Create Date: 2026-02-28 20:00:29.169596

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '485039a00917'
down_revision: Union[str, Sequence[str], None] = '20260206_000002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add composite index for faster property lookups by (asset_id, property_definition_id)."""
    op.create_index(
        'ix_asset_property_values_asset_def',
        'asset_property_values',
        ['asset_id', 'property_definition_id'],
        unique=False
    )


def downgrade() -> None:
    """Remove composite index."""
    op.drop_index('ix_asset_property_values_asset_def', table_name='asset_property_values')
