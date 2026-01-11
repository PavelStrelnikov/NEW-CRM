"""add applies_to_all_sites to contacts

Revision ID: a1b2c3d4e5f6
Revises: 605bd1b8e8a1
Create Date: 2026-01-09 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '605bd1b8e8a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add applies_to_all_sites column to contacts table."""
    op.add_column('contacts',
        sa.Column('applies_to_all_sites', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Remove applies_to_all_sites column from contacts table."""
    op.drop_column('contacts', 'applies_to_all_sites')
