"""Add wan_proto property definition for NVR and DVR asset types.

Revision ID: 20260114_000002
Revises: 20260114_000001
Create Date: 2026-01-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import uuid
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20260114_000002'
down_revision = '20260114_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add wan_proto property definition for NVR and DVR."""
    conn = op.get_bind()

    # Get NVR and DVR asset type IDs
    result = conn.execute(text("""
        SELECT id, code FROM asset_types WHERE code IN ('NVR', 'DVR')
    """))
    asset_types = {row.code: row.id for row in result}

    if not asset_types:
        print("WARNING: NVR/DVR asset types not found, skipping wan_proto property creation")
        return

    now = datetime.utcnow()

    # Check if wan_proto property already exists
    for code, type_id in asset_types.items():
        result = conn.execute(text("""
            SELECT id FROM asset_property_definitions
            WHERE asset_type_id = :type_id AND key = 'wan_proto'
        """), {"type_id": type_id})

        if result.fetchone():
            print(f"wan_proto property already exists for {code}, skipping")
            continue

        # Insert wan_proto property definition
        prop_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO asset_property_definitions
            (id, asset_type_id, key, label_en, label_he, data_type, required, visibility, created_at, updated_at)
            VALUES
            (:id, :asset_type_id, 'wan_proto', 'Protocol', :label_he, 'enum', false, 'internal_only', :created_at, :updated_at)
        """), {
            "id": prop_id,
            "asset_type_id": type_id,
            "label_he": "פרוטוקול",
            "created_at": now,
            "updated_at": now
        })
        print(f"Added wan_proto property definition for {code}")


def downgrade() -> None:
    """Remove wan_proto property definitions."""
    conn = op.get_bind()

    # Delete property values first (due to FK constraints)
    conn.execute(text("""
        DELETE FROM asset_property_values
        WHERE property_definition_id IN (
            SELECT id FROM asset_property_definitions WHERE key = 'wan_proto'
        )
    """))

    # Delete property definitions
    conn.execute(text("""
        DELETE FROM asset_property_definitions WHERE key = 'wan_proto'
    """))
