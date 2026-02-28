"""add callback_contact_id and remove duplicate contact fields

Revision ID: 20260112_212835
Revises: c4d5e6f7a8b9
Create Date: 2026-01-12 21:28:35

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260112_212835'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add callback_contact_id column
    op.add_column('tickets', sa.Column('callback_contact_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_tickets_callback_contact', 'tickets', 'contacts', ['callback_contact_id'], ['id'], ondelete='SET NULL')

    # Set callback_contact_id to contact_person_id for existing tickets (default to opener)
    op.execute("""
        UPDATE tickets
        SET callback_contact_id = contact_person_id
        WHERE contact_person_id IS NOT NULL
    """)

    # Remove duplicate contact fields
    op.drop_column('tickets', 'contact_name')
    op.drop_column('tickets', 'contact_email')


def downgrade() -> None:
    # Add back contact fields
    op.add_column('tickets', sa.Column('contact_email', sa.VARCHAR(), nullable=True))
    op.add_column('tickets', sa.Column('contact_name', sa.VARCHAR(), nullable=True))

    # Remove callback_contact_id
    op.drop_constraint('fk_tickets_callback_contact', 'tickets', type_='foreignkey')
    op.drop_column('tickets', 'callback_contact_id')
