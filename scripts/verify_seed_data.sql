-- SQL queries to verify seed data in pgAdmin or psql

-- Check ticket status definitions
SELECT code, name_en, name_he, is_default, is_closed_state, sort_order
FROM ticket_status_definitions
ORDER BY sort_order;

-- Check asset types
SELECT code, name_en, name_he
FROM asset_types
ORDER BY code;

-- Check internet providers
SELECT name, name_he, country
FROM internet_providers
ORDER BY name;

-- Check asset property definitions count
SELECT at.code, COUNT(apd.id) as property_count
FROM asset_types at
LEFT JOIN asset_property_definitions apd ON apd.asset_type_id = at.id
GROUP BY at.code, at.name_en
ORDER BY at.code;

-- Check admin user
SELECT name, email, role, is_active, preferred_locale
FROM internal_users
WHERE email = 'admin@example.com';

-- Count all tables
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
