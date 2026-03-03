"""Add CAMERA asset type and property definitions for camera snapshot feature.

Creates the CAMERA asset type (if not exists) and adds property definitions:
- camera_protocol (string) - Protocol: isapi/rtsp
- camera_parent_nvr_id (string) - UUID of parent NVR asset
- camera_channel_number (int) - Channel number on parent NVR
- camera_stream_type (string) - Stream type: main/sub
- camera_rtsp_url (string) - Direct RTSP URL for standalone cameras
- device_username (string) - Device username
- device_password (secret) - Device password
- wan_public_ip (string) - WAN IP address
- wan_http_port (int) - WAN HTTP port

Revision ID: 20260301_000001
Revises: 485039a00917
Create Date: 2026-03-01
"""
import uuid
from datetime import datetime
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '20260301_000001'
down_revision: Union[str, None] = '485039a00917'
branch_labels: Union[str, Sequence[str], None] = None
depends_on = None

CAMERA_PROPERTIES = [
    # --- Camera-specific ---
    {
        'key': 'camera_protocol',
        'label_en': 'Camera Protocol',
        'label_he': 'פרוטוקול מצלמה',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 100,
    },
    {
        'key': 'camera_parent_nvr_id',
        'label_en': 'Parent NVR',
        'label_he': 'מקליט אב',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 110,
    },
    {
        'key': 'camera_channel_number',
        'label_en': 'Channel Number',
        'label_he': 'מספר ערוץ',
        'data_type': 'int',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 120,
    },
    {
        'key': 'camera_stream_type',
        'label_en': 'Stream Type',
        'label_he': 'סוג סטרים',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 130,
    },
    {
        'key': 'camera_rtsp_url',
        'label_en': 'RTSP URL',
        'label_he': 'כתובת RTSP',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 140,
    },
    # --- Device credentials ---
    {
        'key': 'device_username',
        'label_en': 'Device Username',
        'label_he': 'שם משתמש מכשיר',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 200,
    },
    {
        'key': 'device_password',
        'label_en': 'Device Password',
        'label_he': 'סיסמת מכשיר',
        'data_type': 'secret',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 210,
    },
    # --- Network ---
    {
        'key': 'wan_public_ip',
        'label_en': 'WAN Public IP',
        'label_he': 'כתובת IP חיצונית',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 220,
    },
    {
        'key': 'wan_http_port',
        'label_en': 'WAN HTTP Port',
        'label_he': 'פורט HTTP חיצוני',
        'data_type': 'int',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 230,
    },
]

ALL_KEYS = [p['key'] for p in CAMERA_PROPERTIES]


def upgrade() -> None:
    """Add CAMERA asset type and property definitions."""
    conn = op.get_bind()
    now = datetime.utcnow()

    # 1. Create CAMERA asset type if not exists
    existing = conn.execute(text(
        "SELECT id FROM asset_types WHERE code = 'CAMERA'"
    )).fetchone()

    if existing:
        camera_type_id = existing[0]
        print("  SKIP: asset_type CAMERA already exists")
    else:
        camera_type_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO asset_types (id, code, name_en, name_he, is_active, created_at, updated_at)
            VALUES (:id, 'CAMERA', 'Camera', 'מצלמה', true, :now, :now)
        """), {"id": camera_type_id, "now": now})
        print(f"  ADD: asset_type CAMERA (id={camera_type_id})")

    # 2. Add property definitions
    inserted = 0
    skipped = 0

    for prop in CAMERA_PROPERTIES:
        exists = conn.execute(text(
            "SELECT id FROM asset_property_definitions "
            "WHERE asset_type_id = :type_id AND key = :key"
        ), {"type_id": camera_type_id, "key": prop['key']}).fetchone()

        if exists:
            print(f"  SKIP: '{prop['key']}' already exists for CAMERA")
            skipped += 1
            continue

        prop_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO asset_property_definitions
            (id, asset_type_id, key, label_en, label_he, data_type,
             required, visibility, sort_order, is_active, created_at, updated_at)
            VALUES
            (:id, :asset_type_id, :key, :label_en, :label_he, :data_type,
             :required, :visibility, :sort_order, true, :created_at, :updated_at)
        """), {
            "id": prop_id,
            "asset_type_id": camera_type_id,
            "key": prop['key'],
            "label_en": prop['label_en'],
            "label_he": prop['label_he'],
            "data_type": prop['data_type'],
            "required": prop['required'],
            "visibility": prop['visibility'],
            "sort_order": prop['sort_order'],
            "created_at": now,
            "updated_at": now,
        })
        inserted += 1
        print(f"  ADD: '{prop['key']}' ({prop['data_type']}, {prop['visibility']})")

    print(f"\nTotal: added {inserted}, skipped {skipped}")


def downgrade() -> None:
    """Remove CAMERA property definitions and asset type."""
    conn = op.get_bind()

    # Get CAMERA type id
    result = conn.execute(text(
        "SELECT id FROM asset_types WHERE code = 'CAMERA'"
    )).fetchone()
    if not result:
        return

    camera_type_id = result[0]

    # Delete property values first (FK constraint)
    conn.execute(text("""
        DELETE FROM asset_property_values
        WHERE property_definition_id IN (
            SELECT id FROM asset_property_definitions
            WHERE asset_type_id = :type_id AND key = ANY(:keys)
        )
    """), {"type_id": camera_type_id, "keys": ALL_KEYS})

    # Delete property definitions
    conn.execute(text("""
        DELETE FROM asset_property_definitions
        WHERE asset_type_id = :type_id AND key = ANY(:keys)
    """), {"type_id": camera_type_id, "keys": ALL_KEYS})

    # Delete asset type only if no assets reference it
    asset_count = conn.execute(text(
        "SELECT COUNT(*) FROM assets WHERE asset_type_id = :type_id"
    ), {"type_id": camera_type_id}).scalar()

    if asset_count == 0:
        conn.execute(text(
            "DELETE FROM asset_types WHERE id = :type_id"
        ), {"type_id": camera_type_id})
        print("Deleted CAMERA asset type")
    else:
        print(f"Kept CAMERA asset type (has {asset_count} assets)")

    print(f"Deleted CAMERA property_definitions: {ALL_KEYS}")
