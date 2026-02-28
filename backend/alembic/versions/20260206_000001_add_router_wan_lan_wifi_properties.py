"""Добавление новых property_definitions для ROUTER: WAN/LAN/Wi-Fi/Notes

Расширяет существующий asset_type ROUTER новыми свойствами.
Legacy-свойства (provider_name, wan_ip_type, dialer_type и т.д.) остаются без изменений.
Свойство wan_public_ip уже существует — миграция пропускает дубликаты.

Revision ID: 20260206_000001
Revises: 20260205_000001
Create Date: 2026-02-06

"""
import uuid
from datetime import datetime
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '20260206_000001'
down_revision: Union[str, None] = '20260205_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on = None

# Новые свойства ROUTER (key → определение)
# sort_order начинается с 100, чтобы идти после legacy-свойств (sort_order=0)
NEW_ROUTER_PROPERTIES = [
    # --- WAN ---
    {
        'key': 'wan_connection_type',
        'label_en': 'WAN Connection Type',
        'label_he': 'סוג חיבור WAN',
        'data_type': 'enum',
        'required': True,
        'visibility': 'internal_only',
        'sort_order': 100,
    },
    # wan_public_ip уже существует в legacy — будет пропущен
    {
        'key': 'wan_public_ip',
        'label_en': 'WAN Public IP',
        'label_he': 'כתובת IP חיצונית',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 110,
    },
    # --- PPPoE ---
    {
        'key': 'pppoe_username',
        'label_en': 'PPPoE Username',
        'label_he': 'שם משתמש PPPoE',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 120,
    },
    {
        'key': 'pppoe_password',
        'label_en': 'PPPoE Password',
        'label_he': 'סיסמת PPPoE',
        'data_type': 'secret',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 130,
    },
    # --- L2TP ---
    {
        'key': 'l2tp_server',
        'label_en': 'L2TP Server',
        'label_he': 'שרת L2TP',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 140,
    },
    {
        'key': 'l2tp_username',
        'label_en': 'L2TP Username',
        'label_he': 'שם משתמש L2TP',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 150,
    },
    {
        'key': 'l2tp_password',
        'label_en': 'L2TP Password',
        'label_he': 'סיסמת L2TP',
        'data_type': 'secret',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 160,
    },
    # --- LAN ---
    {
        'key': 'lan_ip_address',
        'label_en': 'LAN IP Address',
        'label_he': 'כתובת IP פנימית',
        'data_type': 'string',
        'required': True,
        'visibility': 'client_admin',
        'sort_order': 200,
    },
    {
        'key': 'lan_subnet',
        'label_en': 'LAN Subnet',
        'label_he': 'תת-רשת LAN',
        'data_type': 'string',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 210,
    },
    {
        'key': 'lan_ip_static',
        'label_en': 'Static LAN IP',
        'label_he': 'IP פנימי סטטי',
        'data_type': 'bool',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 220,
    },
    # --- Wi-Fi ---
    {
        'key': 'wifi_enabled',
        'label_en': 'Wi-Fi Enabled',
        'label_he': 'Wi-Fi מופעל',
        'data_type': 'bool',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 300,
    },
    {
        'key': 'wifi_name',
        'label_en': 'Wi-Fi Network Name (SSID)',
        'label_he': 'שם רשת Wi-Fi',
        'data_type': 'string',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 310,
    },
    {
        'key': 'wifi_password',
        'label_en': 'Wi-Fi Password',
        'label_he': 'סיסמת Wi-Fi',
        'data_type': 'secret',
        'required': False,
        'visibility': 'client_admin',
        'sort_order': 320,
    },
    # --- Заметки ---
    {
        'key': 'internal_notes',
        'label_en': 'Internal Notes',
        'label_he': 'הערות פנימיות',
        'data_type': 'string',
        'required': False,
        'visibility': 'internal_only',
        'sort_order': 900,
    },
    {
        'key': 'client_notes',
        'label_en': 'Client Notes',
        'label_he': 'הערות ללקוח',
        'data_type': 'string',
        'required': False,
        'visibility': 'client_all',
        'sort_order': 910,
    },
]

# Ключи новых свойств для downgrade (без wan_public_ip — он legacy)
NEW_KEYS_FOR_DOWNGRADE = [
    p['key'] for p in NEW_ROUTER_PROPERTIES if p['key'] != 'wan_public_ip'
]


def upgrade() -> None:
    """Добавить новые property_definitions для ROUTER (WAN/LAN/Wi-Fi/Notes)."""
    conn = op.get_bind()

    # Получить ID asset_type ROUTER
    result = conn.execute(text(
        "SELECT id FROM asset_types WHERE code = 'ROUTER'"
    ))
    row = result.fetchone()
    if not row:
        print("WARNING: asset_type ROUTER not found, skipping")
        return

    router_type_id = row[0]
    now = datetime.utcnow()
    inserted = 0
    skipped = 0

    for prop in NEW_ROUTER_PROPERTIES:
        # Проверяем, существует ли свойство (idempotent)
        exists = conn.execute(text(
            "SELECT id FROM asset_property_definitions "
            "WHERE asset_type_id = :type_id AND key = :key"
        ), {"type_id": router_type_id, "key": prop['key']}).fetchone()

        if exists:
            print(f"  SKIP: '{prop['key']}' already exists for ROUTER")
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
            "asset_type_id": router_type_id,
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
    """Удалить новые ROUTER property_definitions (кроме wan_public_ip — он legacy)."""
    conn = op.get_bind()

    # Получить ID asset_type ROUTER
    result = conn.execute(text(
        "SELECT id FROM asset_types WHERE code = 'ROUTER'"
    ))
    row = result.fetchone()
    if not row:
        return

    router_type_id = row[0]

    # Удалить значения свойств (FK constraint)
    conn.execute(text("""
        DELETE FROM asset_property_values
        WHERE property_definition_id IN (
            SELECT id FROM asset_property_definitions
            WHERE asset_type_id = :type_id AND key = ANY(:keys)
        )
    """), {"type_id": router_type_id, "keys": NEW_KEYS_FOR_DOWNGRADE})

    # Удалить определения свойств
    conn.execute(text("""
        DELETE FROM asset_property_definitions
        WHERE asset_type_id = :type_id AND key = ANY(:keys)
    """), {"type_id": router_type_id, "keys": NEW_KEYS_FOR_DOWNGRADE})

    print(f"Deleted ROUTER property_definitions: {NEW_KEYS_FOR_DOWNGRADE}")
