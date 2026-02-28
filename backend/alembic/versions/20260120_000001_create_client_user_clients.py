"""Create client_user_clients junction table for multi-client access

Revision ID: 20260120_000001
Revises: ecc9e24fe34c
Create Date: 2026-01-20 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision: str = '20260120_000001'
down_revision: Union[str, None] = 'ecc9e24fe34c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create client_user_clients junction table
    op.create_table(
        'client_user_clients',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('client_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('created_by_actor_type', sa.String(), nullable=True),
        sa.Column('created_by_actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by_actor_display', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['client_user_id'], ['client_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('client_user_id', 'client_id', name='uq_client_user_clients')
    )

    # Create indexes for performance
    op.create_index('ix_client_user_clients_client_user_id', 'client_user_clients', ['client_user_id'])
    op.create_index('ix_client_user_clients_client_id', 'client_user_clients', ['client_id'])

    # BACKWARD COMPATIBILITY: Auto-populate for existing CLIENT_ADMIN users
    # For each CLIENT_ADMIN user, create a record linking them to their primary client
    op.execute("""
        INSERT INTO client_user_clients (id, client_user_id, client_id, created_at, created_by_actor_type, created_by_actor_display)
        SELECT
            gen_random_uuid(),
            id as client_user_id,
            client_id,
            NOW() as created_at,
            'system' as created_by_actor_type,
            'Migration: Auto-assign primary client' as created_by_actor_display
        FROM client_users
        WHERE role = 'CLIENT_ADMIN'
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_client_user_clients_client_id', table_name='client_user_clients')
    op.drop_index('ix_client_user_clients_client_user_id', table_name='client_user_clients')

    # Drop table
    op.drop_table('client_user_clients')
