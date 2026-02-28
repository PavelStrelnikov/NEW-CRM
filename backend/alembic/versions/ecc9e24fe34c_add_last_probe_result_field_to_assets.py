"""Add last_probe_result field to assets

Revision ID: ecc9e24fe34c
Revises: 20260117_000001
Create Date: 2026-01-17 21:55:56.563272

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ecc9e24fe34c'
down_revision: Union[str, Sequence[str], None] = '20260117_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add last_probe_result JSON field to assets table."""
    op.add_column('assets', sa.Column('last_probe_result', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove last_probe_result field from assets table."""
    op.drop_column('assets', 'last_probe_result')
