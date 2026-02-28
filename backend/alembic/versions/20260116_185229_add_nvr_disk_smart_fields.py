"""Add SMART fields to nvr_disks table.

Revision ID: 20260116_185229
Revises: 20260114_233941
Create Date: 2026-01-16

Adds status, working_hours, temperature, and smart_status columns to nvr_disks table
to persist HDD health data from Hikvision SDK probing.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260116_185229'
down_revision = '20260114_233941'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add SMART-related columns to nvr_disks table
    op.add_column('nvr_disks', sa.Column('status', sa.String(50), nullable=True, server_default='ok'))
    op.add_column('nvr_disks', sa.Column('working_hours', sa.Integer(), nullable=True))
    op.add_column('nvr_disks', sa.Column('temperature', sa.Integer(), nullable=True))
    op.add_column('nvr_disks', sa.Column('smart_status', sa.String(50), nullable=True))


def downgrade() -> None:
    # Remove SMART-related columns
    op.drop_column('nvr_disks', 'smart_status')
    op.drop_column('nvr_disks', 'temperature')
    op.drop_column('nvr_disks', 'working_hours')
    op.drop_column('nvr_disks', 'status')
