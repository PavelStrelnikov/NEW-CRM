"""Add created_by_type, created_by_internal_user_id, created_by_client_user_id to tickets

Revision ID: 20260113_000001
Revises: 20260112_212835
Create Date: 2026-01-13 00:00:01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260113_000001'
down_revision: Union[str, None] = '20260112_212835'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type for created_by_type if it doesn't exist
    op.execute("CREATE TYPE created_by_type_enum AS ENUM ('internal', 'client', 'system')")

    # Add new columns
    op.add_column('tickets', sa.Column('created_by_type', sa.String(), nullable=True))
    op.add_column('tickets', sa.Column('created_by_internal_user_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('tickets', sa.Column('created_by_client_user_id', postgresql.UUID(as_uuid=True), nullable=True))

    # Create foreign key constraints
    op.create_foreign_key('fk_tickets_created_by_internal_user', 'tickets', 'internal_users', ['created_by_internal_user_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_tickets_created_by_client_user', 'tickets', 'client_users', ['created_by_client_user_id'], ['id'], ondelete='SET NULL')

    # For existing tickets, set created_by_type to 'internal' (assume all existing tickets were created internally)
    op.execute("""
        UPDATE tickets
        SET created_by_type = 'internal'
        WHERE created_by_type IS NULL
    """)

    # Make created_by_type NOT NULL
    op.alter_column('tickets', 'created_by_type', nullable=False)


def downgrade() -> None:
    # Drop foreign keys
    op.drop_constraint('fk_tickets_created_by_client_user', 'tickets', type_='foreignkey')
    op.drop_constraint('fk_tickets_created_by_internal_user', 'tickets', type_='foreignkey')

    # Drop columns
    op.drop_column('tickets', 'created_by_client_user_id')
    op.drop_column('tickets', 'created_by_internal_user_id')
    op.drop_column('tickets', 'created_by_type')

    # Drop enum
    op.execute("DROP TYPE created_by_type_enum")
