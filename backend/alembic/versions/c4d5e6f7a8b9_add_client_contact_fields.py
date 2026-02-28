"""add client contact fields

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
Create Date: 2026-01-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add tax_id, main_phone, main_email columns to clients table."""
    op.add_column('clients', sa.Column('tax_id', sa.String(), nullable=True))
    op.add_column('clients', sa.Column('main_phone', sa.String(), nullable=True))
    op.add_column('clients', sa.Column('main_email', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove tax_id, main_phone, main_email columns from clients table."""
    op.drop_column('clients', 'main_email')
    op.drop_column('clients', 'main_phone')
    op.drop_column('clients', 'tax_id')
