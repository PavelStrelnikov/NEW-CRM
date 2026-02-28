"""Cleanup test property definitions

Removes any test/custom property definitions that were added manually
and should not appear in production.

Revision ID: 20260114_000001
Revises: 20260113_000006
Create Date: 2026-01-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260114_000001'
down_revision: Union[str, None] = '20260113_000006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove test property definitions that were added manually."""
    connection = op.get_bind()

    # Delete any property definitions with test/custom keys or Hebrew labels containing "בדיקה" (test)
    # These are not part of the standard seed data and should be removed
    connection.execute(sa.text("""
        DELETE FROM asset_property_definitions
        WHERE key LIKE '%test%'
           OR key LIKE '%custom%'
           OR key LIKE '%בדיקה%'
           OR label_he LIKE '%שדה בדיקה%'
           OR label_en LIKE '%test field%'
           OR label_en LIKE '%custom field%'
    """))


def downgrade() -> None:
    """No downgrade - these were manually added test records."""
    pass
