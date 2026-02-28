"""Create client_user_sites junction table for site-based access control

Revision ID: 20260113_000002
Revises: 20260113_000001
Create Date: 2026-01-13 00:00:02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260113_000002'
down_revision: Union[str, None] = '20260113_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'client_user_sites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['client_user_id'], ['client_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_user_id', 'site_id', name='uq_client_user_sites')
    )

    # Create indexes
    op.create_index('ix_client_user_sites_client_user_id', 'client_user_sites', ['client_user_id'])
    op.create_index('ix_client_user_sites_site_id', 'client_user_sites', ['site_id'])


def downgrade() -> None:
    op.drop_index('ix_client_user_sites_site_id', table_name='client_user_sites')
    op.drop_index('ix_client_user_sites_client_user_id', table_name='client_user_sites')
    op.drop_table('client_user_sites')
