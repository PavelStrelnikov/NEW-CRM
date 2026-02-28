"""Add CLIENT_USER role to ClientUserRole enum

Revision ID: 20260113_000003
Revises: 20260113_000002
Create Date: 2026-01-13 00:00:03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260113_000003'
down_revision: Union[str, None] = '20260113_000002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL enum workaround: create new enum type and migrate data
    # Add new enum value to client_users role column
    # Note: Database uses uppercase enum values (CLIENT_CONTACT, CLIENT_ADMIN)
    op.execute("""
        ALTER TYPE clientuserrole ADD VALUE 'CLIENT_USER' BEFORE 'CLIENT_CONTACT'
    """)


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values, so we'll just document this
    # In practice, if you need to downgrade, you'd need to recreate the type
    # For now, we'll do nothing as removing enum values requires recreating the type
    # and is risky with existing data
    pass
