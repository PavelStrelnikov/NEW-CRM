"""Update property visibility for CLIENT_ADMIN access

Revision ID: 20260121_000002
Revises: 20260121_000001
Create Date: 2026-01-21 00:00:02.000000

Changes visibility of device credentials and network fields to client_admin
so CLIENT_ADMIN users can see them (filtered by can_view_secrets for passwords).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260121_000002'
down_revision: Union[str, None] = '20260121_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update visibility for network and credential fields to client_admin
    # This allows CLIENT_ADMIN users to see these fields
    # Note: device_password is additionally filtered by can_view_secrets flag in code
    op.execute("""
        UPDATE asset_property_definitions
        SET visibility = 'client_admin'
        WHERE key IN ('wan_public_ip', 'device_username', 'device_password', 'lan_ip_address', 'wan_service_port', 'wan_http_port', 'wan_web_port')
    """)


def downgrade() -> None:
    # Revert to internal_only
    op.execute("""
        UPDATE asset_property_definitions
        SET visibility = 'internal_only'
        WHERE key IN ('wan_public_ip', 'device_username', 'device_password', 'lan_ip_address', 'wan_service_port', 'wan_http_port', 'wan_web_port')
    """)
