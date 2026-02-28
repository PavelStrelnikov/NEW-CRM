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
    """Upgrade schema.

    NOTE: All project tables are already created in the initial migration
    (8dbb07d195b9). This migration is kept as a no-op to preserve the
    migration chain.
    """
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
