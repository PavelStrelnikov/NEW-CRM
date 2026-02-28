"""Add can_view_secrets column to client_users

Revision ID: 20260121_000001
Revises: 20260120_000001
Create Date: 2026-01-21 00:00:01.000000

Adds boolean flag to allow CLIENT_ADMIN users to view device passwords.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260121_000001'
down_revision: Union[str, None] = '20260120_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add can_view_secrets column to client_users
    op.add_column(
        'client_users',
        sa.Column('can_view_secrets', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    # Remove can_view_secrets column
    op.drop_column('client_users', 'can_view_secrets')
