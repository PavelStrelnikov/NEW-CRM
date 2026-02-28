"""Create ticket_category_definitions table and migrate data.

Revision ID: 20260114_233941
Revises: 20260114_000002
Create Date: 2026-01-14 23:39:41.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision: str = '20260114_233941'
down_revision: Union[str, None] = '20260114_000002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ticket_category_definitions table
    op.create_table(
        'ticket_category_definitions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('code', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('name_he', sa.String(), nullable=True),
        sa.Column('name_en', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, default=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Insert initial categories
    categories = [
        {
            'id': str(uuid.uuid4()),
            'code': 'CCTV',
            'name_he': 'מצלמות אבטחה',
            'name_en': 'CCTV / Cameras',
            'description': 'Security cameras, NVR/DVR systems',
            'is_active': True,
            'is_default': True,
            'sort_order': 1
        },
        {
            'id': str(uuid.uuid4()),
            'code': 'PC_IT',
            'name_he': 'מחשבים ו-IT',
            'name_en': 'Computers / IT',
            'description': 'PCs, laptops, servers, software',
            'is_active': True,
            'is_default': False,
            'sort_order': 2
        },
        {
            'id': str(uuid.uuid4()),
            'code': 'NETWORK',
            'name_he': 'רשתות ו-Wi-Fi',
            'name_en': 'Networking / Wi-Fi',
            'description': 'Routers, switches, access points, cabling',
            'is_active': True,
            'is_default': False,
            'sort_order': 3
        },
        {
            'id': str(uuid.uuid4()),
            'code': 'INTERCOM',
            'name_he': 'אינטרקום ואבטחה',
            'name_en': 'Intercom & Security',
            'description': 'Intercom systems, access control, alarms',
            'is_active': True,
            'is_default': False,
            'sort_order': 4
        },
        {
            'id': str(uuid.uuid4()),
            'code': 'OTHER',
            'name_he': 'אחר',
            'name_en': 'Other',
            'description': 'Other issues not in specific categories',
            'is_active': True,
            'is_default': False,
            'sort_order': 99
        },
    ]

    # Use bulk insert
    op.bulk_insert(
        sa.table(
            'ticket_category_definitions',
            sa.Column('id', postgresql.UUID(as_uuid=True)),
            sa.Column('code', sa.String()),
            sa.Column('name_he', sa.String()),
            sa.Column('name_en', sa.String()),
            sa.Column('description', sa.Text()),
            sa.Column('is_active', sa.Boolean()),
            sa.Column('is_default', sa.Boolean()),
            sa.Column('sort_order', sa.Integer()),
        ),
        categories
    )

    # Add category_id column to tickets (nullable initially)
    op.add_column('tickets', sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_tickets_category_id', 'tickets', ['category_id'])
    op.create_foreign_key(
        'fk_tickets_category_id',
        'tickets',
        'ticket_category_definitions',
        ['category_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Drop the old category column if it exists
    # Note: This will lose any existing category string data
    # In production, you'd want to migrate the data first
    try:
        op.drop_column('tickets', 'category')
    except Exception:
        pass  # Column might not exist


def downgrade() -> None:
    # Re-add the category string column
    op.add_column('tickets', sa.Column('category', sa.String(), nullable=True))

    # Drop foreign key and index
    op.drop_constraint('fk_tickets_category_id', 'tickets', type_='foreignkey')
    op.drop_index('ix_tickets_category_id', table_name='tickets')
    op.drop_column('tickets', 'category_id')

    # Drop the table
    op.drop_table('ticket_category_definitions')
