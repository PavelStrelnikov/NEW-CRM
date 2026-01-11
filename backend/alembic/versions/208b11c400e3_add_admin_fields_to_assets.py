"""add_admin_fields_to_assets

Revision ID: 208b11c400e3
Revises: (check previous revision)
Create Date: 2026-01-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '208b11c400e3'
down_revision = '7033e1c9f63f'
branch_labels = None
depends_on = None


def upgrade():
    # Add fields to asset_types
    op.add_column('asset_types', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('asset_types', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))

    # Add fields to asset_property_definitions
    op.add_column('asset_property_definitions', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('asset_property_definitions', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade():
    # Remove fields from asset_property_definitions
    op.drop_column('asset_property_definitions', 'is_active')
    op.drop_column('asset_property_definitions', 'sort_order')

    # Remove fields from asset_types
    op.drop_column('asset_types', 'is_active')
    op.drop_column('asset_types', 'description')
