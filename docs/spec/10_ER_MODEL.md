# ER Model (Tables, Keys, Relations) — v1.1

Conventions:
- PK: `id` (UUID) unless stated otherwise
- FK: `<table>_id`
- All tables have `created_at`, `updated_at` unless noted
- Actor fields are stored as:
  `actor_type`, `actor_id`, `actor_display`

---

## 1. Identity & Access

### internal_users
- id (PK)
- name
- email (unique)
- phone
- role (enum: admin, technician, office)
- preferred_locale (enum: he-IL, en-US)
- is_active (bool)

### client_users
- id (PK)
- client_id (FK → clients.id)
- contact_id (nullable FK → contacts.id)
- name
- email (unique)
- phone
- role (enum: client_contact, client_admin)
- preferred_locale (enum: he-IL, en-US)
- is_active (bool)

---

## 2. Clients, Sites, Contacts

### clients
- id (PK)
- name
- main_address
- notes
- status (enum: active, inactive)

### sites
- id (PK)
- client_id (FK)
- name
- address
- is_default (bool)
- notes

### contacts
- id (PK)
- client_id (FK)
- name
- phone
- email
- position
- notes

### contact_site_links
- contact_id (FK)
- site_id (FK)
PK: (contact_id, site_id)

---

## 3. Locations (optional)

### locations
- id (PK)
- site_id (FK)
- building
- floor
- room
- description

---

## 4. Tickets

### ticket_status_definitions
- id (PK)
- code (unique)
- name_he (nullable)
- name_en (nullable)
- description
- is_active (bool)
- is_default (bool)
- is_closed_state (bool)
- sort_order (int)

### tickets
- id (PK)
- ticket_number (unique)
- client_id (FK)
- site_id (FK)
- title
- description
- category (enum: CCTV, Network, PC, Alarm, Other)
- priority (enum: low, normal, high, urgent)
- source_channel (portal, email, whatsapp, telegram, manual, api)
- reported_via (portal, phone, email, whatsapp, telegram)
- status_id (FK)
- assigned_to_internal_user_id (nullable FK)
- service_scope (included, not_included, mixed)
- service_note (nullable)
- contact_person_id (nullable FK)
- contact_name (nullable)
- contact_phone (required)
- contact_email (nullable)
- closed_at (nullable)

### ticket_initiators
- ticket_id (PK, FK)
- initiator_type (internal_user, client_user, external_identity, integration)
- initiator_ref_id (nullable)
- initiator_display

### ticket_events
- id (PK)
- ticket_id (FK)
- event_type
- message
- old_value (nullable)
- new_value (nullable)
- actor_type
- actor_id
- actor_display
- created_at

---

## 5. Time & Billable Items

### work_logs
- id (PK)
- ticket_id (FK)
- work_type (phone, remote, onsite, travel, repair_lab, admin)
- description
- start_at (nullable)
- end_at (nullable)
- duration_minutes
- included_in_service (bool)
- billing_note (nullable)
- actor_type
- actor_id
- actor_display
- created_at

### ticket_line_items
- id (PK)
- ticket_id (FK)
- item_type (material, equipment, service, other)
- description
- quantity (nullable)
- unit (nullable)
- included_in_service (bool)
- chargeable (bool)
- external_reference (nullable)
- linked_asset_id (nullable FK)
- actor_type
- actor_id
- actor_display
- created_at

---

## 6. Attachments

### attachments
- id (PK)
- linked_type (ticket, asset, project, site, client)
- linked_id
- filename
- mime_type
- size_bytes
- storage_path
- uploaded_by_actor_type
- uploaded_by_actor_id
- uploaded_by_actor_display
- created_at

---

## 7. Assets (Generic & Custom)

### asset_types
- id (PK)
- code (unique)
- name_he (nullable)
- name_en (nullable)

### assets
- id (PK)
- client_id (FK)
- site_id (FK)
- asset_type_id (FK)
- label
- manufacturer
- model
- serial_number (nullable)
- install_date (nullable)
- status (active, in_repair, replaced, retired)
- location_id (nullable FK)
- notes

### asset_property_definitions
- id (PK)
- asset_type_id (FK)
- key
- label_he (nullable)
- label_en (nullable)
- data_type (string, int, bool, date, enum, decimal, secret)
- required (bool)
- visibility (internal_only, client_admin, client_all)

### asset_property_values
- id (PK)
- asset_id (FK)
- property_definition_id (FK)
- value_string (nullable)
- value_int (nullable)
- value_bool (nullable)
- value_date (nullable)
- value_decimal (nullable)
- value_enum (nullable)
- value_secret_encrypted (nullable)
- updated_at
- updated_by_actor_type
- updated_by_actor_id
- updated_by_actor_display

### asset_events
- id (PK)
- asset_id (FK)
- ticket_id (nullable FK)
- event_type
- details
- actor_type
- actor_id
- actor_display
- created_at

### ticket_asset_links
- ticket_id (FK)
- asset_id (FK)
- relation_type (affected, repaired, replaced, mentioned)
PK: (ticket_id, asset_id)

---

## 8. NVR Disks

### nvr_disks
- id (PK)
- asset_id (FK)
- slot_number (nullable)
- capacity_tb
- install_date
- serial_number (nullable)

---

## 9. Projects

### projects
- id (PK)
- client_id (FK)
- name
- description
- status (planned, active, on_hold, completed, canceled)
- start_date (nullable)
- target_end_date (nullable)
- actual_end_date (nullable)
- created_by_actor_type
- created_by_actor_id
- created_by_actor_display
- created_at
- updated_at

### project_ticket_links
- project_id (FK)
- ticket_id (FK)

### project_asset_links
- project_id (FK)
- asset_id (FK)

### project_site_links
- project_id (FK)
- site_id (FK)
