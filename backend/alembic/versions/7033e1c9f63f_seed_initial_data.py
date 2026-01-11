"""Seed initial data

Revision ID: 7033e1c9f63f
Revises: 8dbb07d195b9
Create Date: 2026-01-09 12:41:32.136023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7033e1c9f63f'
down_revision: Union[str, Sequence[str], None] = '8dbb07d195b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed initial data."""
    from uuid import uuid4
    from datetime import datetime

    # Get metadata and connections
    connection = op.get_bind()

    # 1. Seed Ticket Status Definitions
    statuses = [
        {
            'id': uuid4(),
            'code': 'NEW',
            'name_en': 'New',
            'name_he': 'חדש',
            'is_default': True,
            'is_closed_state': False,
            'is_active': True,
            'sort_order': 10,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            'id': uuid4(),
            'code': 'IN_PROGRESS',
            'name_en': 'In Progress',
            'name_he': 'בטיפול',
            'is_default': False,
            'is_closed_state': False,
            'is_active': True,
            'sort_order': 20,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            'id': uuid4(),
            'code': 'WAITING_CUSTOMER',
            'name_en': 'Waiting for Customer',
            'name_he': 'ממתין ללקוח',
            'is_default': False,
            'is_closed_state': False,
            'is_active': True,
            'sort_order': 30,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            'id': uuid4(),
            'code': 'RESOLVED',
            'name_en': 'Resolved',
            'name_he': 'נפתר',
            'is_default': False,
            'is_closed_state': False,
            'is_active': True,
            'sort_order': 40,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            'id': uuid4(),
            'code': 'CLOSED',
            'name_en': 'Closed',
            'name_he': 'סגור',
            'is_default': False,
            'is_closed_state': True,
            'is_active': True,
            'sort_order': 50,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
    ]
    op.bulk_insert(
        sa.table('ticket_status_definitions',
            sa.column('id', sa.UUID),
            sa.column('code', sa.String),
            sa.column('name_en', sa.String),
            sa.column('name_he', sa.String),
            sa.column('is_default', sa.Boolean),
            sa.column('is_closed_state', sa.Boolean),
            sa.column('is_active', sa.Boolean),
            sa.column('sort_order', sa.Integer),
            sa.column('created_at', sa.DateTime),
            sa.column('updated_at', sa.DateTime),
        ),
        statuses
    )

    # 2. Seed Asset Types
    asset_type_ids = {}
    asset_types = [
        {'code': 'NVR', 'name_en': 'NVR', 'name_he': 'מקליט רשת (NVR)'},
        {'code': 'DVR', 'name_en': 'DVR', 'name_he': 'מקליט DVR'},
        {'code': 'ROUTER', 'name_en': 'Router', 'name_he': 'ראוטר'},
        {'code': 'SWITCH', 'name_en': 'Switch', 'name_he': 'סוויץ׳'},
        {'code': 'ACCESS_POINT', 'name_en': 'Access Point', 'name_he': 'נקודת גישה (Wi-Fi)'},
        {'code': 'PC', 'name_en': 'PC', 'name_he': 'מחשב'},
        {'code': 'SERVER', 'name_en': 'Server', 'name_he': 'שרת'},
        {'code': 'PRINTER', 'name_en': 'Printer', 'name_he': 'מדפסת'},
        {'code': 'ALARM', 'name_en': 'Alarm System', 'name_he': 'מערכת אזעקה'},
        {'code': 'OTHER', 'name_en': 'Other', 'name_he': 'אחר'},
    ]

    asset_types_to_insert = []
    for at in asset_types:
        aid = uuid4()
        asset_type_ids[at['code']] = aid
        asset_types_to_insert.append({
            'id': aid,
            'code': at['code'],
            'name_en': at['name_en'],
            'name_he': at['name_he'],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })

    op.bulk_insert(
        sa.table('asset_types',
            sa.column('id', sa.UUID),
            sa.column('code', sa.String),
            sa.column('name_en', sa.String),
            sa.column('name_he', sa.String),
            sa.column('created_at', sa.DateTime),
            sa.column('updated_at', sa.DateTime),
        ),
        asset_types_to_insert
    )

    # 3. Seed Internet Providers
    providers = [
        {'name': 'Bezeq', 'name_he': 'בזק', 'country': 'IL'},
        {'name': 'HOT', 'name_he': 'HOT', 'country': 'IL'},
        {'name': 'Partner', 'name_he': 'פרטנר', 'country': 'IL'},
        {'name': 'Cellcom', 'name_he': 'סלקום', 'country': 'IL'},
        {'name': 'Other', 'name_he': 'אחר', 'country': 'IL'},
    ]

    providers_to_insert = []
    for p in providers:
        providers_to_insert.append({
            'id': uuid4(),
            'name': p['name'],
            'name_he': p['name_he'],
            'country': p['country'],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })

    op.bulk_insert(
        sa.table('internet_providers',
            sa.column('id', sa.UUID),
            sa.column('name', sa.String),
            sa.column('name_he', sa.String),
            sa.column('country', sa.String),
            sa.column('created_at', sa.DateTime),
            sa.column('updated_at', sa.DateTime),
        ),
        providers_to_insert
    )

    # 4. Seed Asset Property Definitions for NVR/DVR
    nvr_dvr_properties = [
        # Capacity
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'max_camera_channels',
            'label_en': 'Max Camera Channels',
            'label_he': 'מספר ערוצים מקסימלי',
            'data_type': 'enum',
            'required': True,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'camera_count_connected',
            'label_en': 'Cameras Connected',
            'label_he': 'מצלמות מחוברות',
            'data_type': 'int',
            'required': False,
            'visibility': 'client_admin'
        },
        # LAN Access
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'lan_ip_address',
            'label_en': 'LAN IP Address',
            'label_he': 'כתובת IP פנימית',
            'data_type': 'string',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'lan_http_port',
            'label_en': 'LAN Web Port',
            'label_he': 'פורט Web פנימי',
            'data_type': 'int',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'lan_service_port',
            'label_en': 'LAN Service Port',
            'label_he': 'פורט שירות פנימי',
            'data_type': 'int',
            'required': False,
            'visibility': 'client_admin'
        },
        # WAN Access
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'wan_public_ip',
            'label_en': 'WAN Public IP',
            'label_he': 'כתובת IP חיצונית',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'wan_http_port',
            'label_en': 'WAN Web Port',
            'label_he': 'פורט Web חיצוני',
            'data_type': 'int',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'wan_service_port',
            'label_en': 'WAN Service Port',
            'label_he': 'פורט שירות חיצוני',
            'data_type': 'int',
            'required': False,
            'visibility': 'internal_only'
        },
        # Device Credentials
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'device_username',
            'label_en': 'Device Username',
            'label_he': 'שם משתמש למכשיר',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'device_password',
            'label_en': 'Device Password',
            'label_he': 'סיסמה למכשיר',
            'data_type': 'secret',
            'required': False,
            'visibility': 'internal_only'
        },
        # PoE
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'poe_supported',
            'label_en': 'PoE Supported',
            'label_he': 'תומך PoE',
            'data_type': 'bool',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['NVR'],
            'key': 'poe_port_count',
            'label_en': 'PoE Port Count',
            'label_he': 'מספר פורטי PoE',
            'data_type': 'int',
            'required': False,
            'visibility': 'client_admin'
        },
    ]

    # Copy same properties for DVR
    dvr_properties = []
    for prop in nvr_dvr_properties:
        dvr_prop = prop.copy()
        dvr_prop['asset_type_id'] = asset_type_ids['DVR']
        dvr_properties.append(dvr_prop)

    # 5. Seed Asset Property Definitions for ROUTER
    router_properties = [
        # Provider & WAN
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'provider_name',
            'label_en': 'Internet Provider',
            'label_he': 'ספק אינטרנט',
            'data_type': 'enum',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'wan_ip_type',
            'label_en': 'WAN IP Type',
            'label_he': 'סוג IP חיצוני',
            'data_type': 'enum',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'wan_public_ip',
            'label_en': 'WAN Public IP',
            'label_he': 'כתובת IP חיצונית',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'ddns_name',
            'label_en': 'DDNS Name',
            'label_he': 'כתובת DDNS',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        # Router Admin
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'admin_username',
            'label_en': 'Router Admin Username',
            'label_he': 'שם משתמש ראוטר',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'admin_password',
            'label_en': 'Router Admin Password',
            'label_he': 'סיסמת ראוטר',
            'data_type': 'secret',
            'required': False,
            'visibility': 'internal_only'
        },
        # Dialer Credentials
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'dialer_type',
            'label_en': 'Dialer Type',
            'label_he': 'סוג חייגן',
            'data_type': 'enum',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'internet_username',
            'label_en': 'Internet Username',
            'label_he': 'שם משתמש לחייגן',
            'data_type': 'secret',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ROUTER'],
            'key': 'internet_password',
            'label_en': 'Internet Password',
            'label_he': 'סיסמת חייגן',
            'data_type': 'secret',
            'required': False,
            'visibility': 'internal_only'
        },
    ]

    # 6. Seed Asset Property Definitions for SWITCH
    switch_properties = [
        {
            'asset_type_id': asset_type_ids['SWITCH'],
            'key': 'is_managed',
            'label_en': 'Managed Switch',
            'label_he': 'סוויץ׳ מנוהל',
            'data_type': 'bool',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['SWITCH'],
            'key': 'management_ip',
            'label_en': 'Management IP',
            'label_he': 'כתובת ניהול',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['SWITCH'],
            'key': 'total_ports',
            'label_en': 'Total Ports',
            'label_he': 'מספר פורטים כולל',
            'data_type': 'int',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['SWITCH'],
            'key': 'poe_supported',
            'label_en': 'PoE Supported',
            'label_he': 'תומך PoE',
            'data_type': 'bool',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['SWITCH'],
            'key': 'poe_port_count',
            'label_en': 'PoE Port Count',
            'label_he': 'מספר פורטי PoE',
            'data_type': 'int',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['SWITCH'],
            'key': 'uplink_port_count',
            'label_en': 'Uplink Port Count',
            'label_he': 'מספר פורטי Uplink',
            'data_type': 'int',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['SWITCH'],
            'key': 'poe_standard',
            'label_en': 'PoE Standard',
            'label_he': 'תקן PoE',
            'data_type': 'enum',
            'required': False,
            'visibility': 'client_admin'
        },
    ]

    # 7. Seed Asset Property Definitions for ACCESS_POINT
    ap_properties = [
        {
            'asset_type_id': asset_type_ids['ACCESS_POINT'],
            'key': 'management_type',
            'label_en': 'Management Type',
            'label_he': 'סוג ניהול',
            'data_type': 'enum',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['ACCESS_POINT'],
            'key': 'controller_name',
            'label_en': 'Controller / Cloud Name',
            'label_he': 'שם Controller / ענן',
            'data_type': 'string',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['ACCESS_POINT'],
            'key': 'management_ip',
            'label_en': 'Management IP',
            'label_he': 'כתובת ניהול',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ACCESS_POINT'],
            'key': 'admin_username',
            'label_en': 'AP Admin Username',
            'label_he': 'שם משתמש לניהול',
            'data_type': 'string',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ACCESS_POINT'],
            'key': 'admin_password',
            'label_en': 'AP Admin Password',
            'label_he': 'סיסמת ניהול',
            'data_type': 'secret',
            'required': False,
            'visibility': 'internal_only'
        },
        {
            'asset_type_id': asset_type_ids['ACCESS_POINT'],
            'key': 'wifi_ssid_primary',
            'label_en': 'Primary SSID',
            'label_he': 'שם רשת (SSID) ראשי',
            'data_type': 'string',
            'required': False,
            'visibility': 'client_admin'
        },
        {
            'asset_type_id': asset_type_ids['ACCESS_POINT'],
            'key': 'wifi_password_primary',
            'label_en': 'Primary Wi-Fi Password',
            'label_he': 'סיסמת Wi-Fi',
            'data_type': 'secret',
            'required': False,
            'visibility': 'internal_only'
        },
    ]

    # Combine all property definitions
    all_properties = nvr_dvr_properties + dvr_properties + router_properties + switch_properties + ap_properties

    # Insert all property definitions
    property_defs_to_insert = []
    for prop in all_properties:
        property_defs_to_insert.append({
            'id': uuid4(),
            'asset_type_id': prop['asset_type_id'],
            'key': prop['key'],
            'label_en': prop['label_en'],
            'label_he': prop['label_he'],
            'data_type': prop['data_type'],
            'required': prop['required'],
            'visibility': prop['visibility'],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })

    op.bulk_insert(
        sa.table('asset_property_definitions',
            sa.column('id', sa.UUID),
            sa.column('asset_type_id', sa.UUID),
            sa.column('key', sa.String),
            sa.column('label_en', sa.String),
            sa.column('label_he', sa.String),
            sa.column('data_type', sa.String),
            sa.column('required', sa.Boolean),
            sa.column('visibility', sa.String),
            sa.column('created_at', sa.DateTime),
            sa.column('updated_at', sa.DateTime),
        ),
        property_defs_to_insert
    )

    # 8. Seed Optional Admin User
    import bcrypt

    # Hash the password using bcrypt directly
    password = 'change_me_now'
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    admin_user = {
        'id': uuid4(),
        'name': 'System Administrator',
        'email': 'admin@example.com',
        'password_hash': password_hash,
        'role': 'ADMIN',  # PostgreSQL enum uses uppercase member names
        'preferred_locale': 'HE_IL',  # PostgreSQL enum uses uppercase member names
        'is_active': True,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }

    # Use raw SQL to insert admin user to handle enum types properly
    params = {
        'id': str(admin_user['id']),
        'name': admin_user['name'],
        'email': admin_user['email'],
        'password_hash': password_hash,
        'role': admin_user['role'],
        'preferred_locale': admin_user['preferred_locale'],
        'is_active': admin_user['is_active'],
        'created_at': admin_user['created_at'],
        'updated_at': admin_user['updated_at']
    }
    connection.execute(sa.text("""
        INSERT INTO internal_users (id, name, email, password_hash, role, preferred_locale, is_active, created_at, updated_at)
        VALUES (CAST(:id AS uuid), :name, :email, :password_hash, CAST(:role AS internaluserrole), CAST(:preferred_locale AS locale), :is_active, :created_at, :updated_at)
    """), params)


def downgrade() -> None:
    """Remove seed data."""
    connection = op.get_bind()

    # Remove in reverse order
    connection.execute(sa.text("DELETE FROM internal_users WHERE email = 'admin@example.com'"))
    connection.execute(sa.text("DELETE FROM asset_property_definitions"))
    connection.execute(sa.text("DELETE FROM internet_providers"))
    connection.execute(sa.text("DELETE FROM asset_types"))
    connection.execute(sa.text("DELETE FROM ticket_status_definitions"))
