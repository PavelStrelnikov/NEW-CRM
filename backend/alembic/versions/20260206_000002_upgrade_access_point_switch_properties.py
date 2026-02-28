"""Апгрейд property_definitions для ACCESS_POINT и SWITCH

Добавляет новые упрощённые свойства для ACCESS_POINT и SWITCH.
Legacy-свойства остаются без изменений (скрываются на уровне UI).
Миграция идемпотентна — проверяет существование ключей перед вставкой.

Revision ID: 20260206_000002
Revises: 20260206_000001
Create Date: 2026-02-06

"""
import uuid
from datetime import datetime
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '20260206_000002'
down_revision: Union[str, None] = '20260206_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on = None


# ─── ACCESS_POINT: новые свойства ───────────────────────────────────────────
NEW_AP_PROPERTIES = [
    {
        'key': 'ap_brand',
        'label_en': 'Brand',
        'label_he': 'יצרן',
        'data_type': 'enum',
        'required': True,
        'visibility': 'client_admin',
        'sort_order': 100,
    },
    {
        'key': 'ap_quantity',
        'label_en': 'Quantity',
        'label_he': 'כמות',
        'data_type': 'int',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 110,
    },
    {
        'key': 'wifi_ssid',
        'label_en': 'Wi-Fi SSID',
        'label_he': 'שם רשת Wi-Fi',
        'data_type': 'string',
        'required': True,
        'visibility': 'client_admin',
        'sort_order': 200,
    },
    {
        'key': 'wifi_password',
        'label_en': 'Wi-Fi Password',
        'label_he': 'סיסמת Wi-Fi',
        'data_type': 'secret',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 210,
    },
    {
        'key': 'notes',
        'label_en': 'Notes',
        'label_he': 'הערות',
        'data_type': 'string',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 900,
    },
]

# ─── SWITCH: новые свойства ─────────────────────────────────────────────────
NEW_SWITCH_PROPERTIES = [
    {
        'key': 'switch_brand',
        'label_en': 'Brand',
        'label_he': 'יצרן',
        'data_type': 'enum',
        'required': True,
        'visibility': 'client_admin',
        'sort_order': 100,
    },
    {
        'key': 'switch_quantity',
        'label_en': 'Quantity',
        'label_he': 'כמות',
        'data_type': 'int',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 110,
    },
    {
        'key': 'switch_managed',
        'label_en': 'Managed Switch',
        'label_he': 'סוויץ׳ מנוהל',
        'data_type': 'bool',
        'required': True,
        'visibility': 'client_admin',
        'sort_order': 120,
    },
    # total_ports уже существует в legacy — будет пропущен
    {
        'key': 'total_ports',
        'label_en': 'Total Ports',
        'label_he': 'מספר פורטים כולל',
        'data_type': 'int',
        'required': True,
        'visibility': 'client_admin',
        'sort_order': 200,
    },
    # poe_supported уже существует в legacy — будет пропущен
    {
        'key': 'poe_supported',
        'label_en': 'PoE Supported',
        'label_he': 'תומך PoE',
        'data_type': 'bool',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 210,
    },
    {
        'key': 'poe_ports_count',
        'label_en': 'PoE Ports Count',
        'label_he': 'מספר פורטי PoE',
        'data_type': 'int',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 220,
    },
    {
        'key': 'admin_username',
        'label_en': 'Admin Username',
        'label_he': 'שם משתמש לניהול',
        'data_type': 'string',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 300,
    },
    {
        'key': 'admin_password',
        'label_en': 'Admin Password',
        'label_he': 'סיסמת ניהול',
        'data_type': 'secret',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 310,
    },
    {
        'key': 'notes',
        'label_en': 'Notes',
        'label_he': 'הערות',
        'data_type': 'string',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 900,
    },
]

# Ключи для downgrade (исключая те, что были в legacy)
AP_NEW_KEYS = [p['key'] for p in NEW_AP_PROPERTIES]
SWITCH_NEW_KEYS = [
    p['key'] for p in NEW_SWITCH_PROPERTIES
    if p['key'] not in ('total_ports', 'poe_supported')
]


def _add_properties(conn, type_code: str, properties: list) -> None:
    """Добавить property_definitions для указанного asset_type (идемпотентно)."""
    result = conn.execute(text(
        "SELECT id FROM asset_types WHERE code = :code"
    ), {"code": type_code})
    row = result.fetchone()
    if not row:
        print(f"WARNING: asset_type {type_code} not found, skipping")
        return

    type_id = row[0]
    now = datetime.utcnow()
    inserted = 0
    skipped = 0

    for prop in properties:
        exists = conn.execute(text(
            "SELECT id FROM asset_property_definitions "
            "WHERE asset_type_id = :type_id AND key = :key"
        ), {"type_id": type_id, "key": prop['key']}).fetchone()

        if exists:
            print(f"  SKIP: '{prop['key']}' already exists for {type_code}")
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
            "asset_type_id": type_id,
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

    print(f"{type_code}: added {inserted}, skipped {skipped}")


def _remove_properties(conn, type_code: str, keys: list) -> None:
    """Удалить property_definitions и их значения (для downgrade)."""
    result = conn.execute(text(
        "SELECT id FROM asset_types WHERE code = :code"
    ), {"code": type_code})
    row = result.fetchone()
    if not row:
        return

    type_id = row[0]

    # Удалить значения свойств (FK constraint)
    conn.execute(text("""
        DELETE FROM asset_property_values
        WHERE property_definition_id IN (
            SELECT id FROM asset_property_definitions
            WHERE asset_type_id = :type_id AND key = ANY(:keys)
        )
    """), {"type_id": type_id, "keys": keys})

    # Удалить определения свойств
    conn.execute(text("""
        DELETE FROM asset_property_definitions
        WHERE asset_type_id = :type_id AND key = ANY(:keys)
    """), {"type_id": type_id, "keys": keys})

    print(f"Removed {type_code} property_definitions: {keys}")


def upgrade() -> None:
    """Добавить новые property_definitions для ACCESS_POINT и SWITCH."""
    conn = op.get_bind()

    print("\n=== ACCESS_POINT ===")
    _add_properties(conn, 'ACCESS_POINT', NEW_AP_PROPERTIES)

    print("\n=== SWITCH ===")
    _add_properties(conn, 'SWITCH', NEW_SWITCH_PROPERTIES)


def downgrade() -> None:
    """Удалить новые property_definitions (кроме legacy полей)."""
    conn = op.get_bind()

    _remove_properties(conn, 'ACCESS_POINT', AP_NEW_KEYS)
    _remove_properties(conn, 'SWITCH', SWITCH_NEW_KEYS)
