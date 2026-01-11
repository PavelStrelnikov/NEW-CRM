# Implementation Tasks — v1.0 (MVP)
Target stack:
- Backend: Python 3.12 + FastAPI
- DB: PostgreSQL 16+
- ORM: SQLAlchemy 2.x
- Migrations: Alembic
- Auth: JWT (access token), RBAC in app
- i18n: UI side (Hebrew default), DB supports optional he/en labels

Guiding principles:
- Ship a working vertical slice early: Tickets → WorkLogs/LineItems → Reports.
- Strict audit on changes (events tables).
- No bots/integrations in MVP (only keep source_channel/initiator model).

---

## 0) Repo & Project Setup (P0)
### Tasks
- Create backend project structure:
  - app/main.py
  - app/config.py
  - app/db/{session.py, base.py}
  - app/models/*
  - app/schemas/*
  - app/api/*
  - app/services/*
  - app/auth/*
  - app/utils/*
- Add dependencies:
  - fastapi, uvicorn
  - sqlalchemy, asyncpg or psycopg (choose async or sync; sync is simpler MVP)
  - alembic
  - pydantic, pydantic-settings
  - python-jose (JWT), passlib[bcrypt] (password hashing)
  - python-multipart (uploads)
- Docker compose (optional but recommended):
  - postgres service + pgadmin

### Definition of Done (DoD)
- Server runs locally.
- DB connects.
- Health endpoint returns OK.

---

## 1) Database & Migrations (P0)
Source of truth: `docs/spec/10_ER_MODEL.md`

### Tasks
- Create Alembic environment.
- Implement migrations to create all MVP tables:
  - internal_users, client_users
  - clients, sites, contacts, contact_site_links
  - locations
  - ticket_status_definitions, tickets, ticket_initiators, ticket_events
  - work_logs, ticket_line_items
  - attachments
  - asset_types, assets, asset_property_definitions, asset_property_values
  - asset_events, ticket_asset_links
  - nvr_disks
  - projects, project_*_links, project_events
- Add indexes:
  - tickets(ticket_number), tickets(client_id, site_id), tickets(status_id)
  - assets(client_id, site_id, asset_type_id)
  - asset_property_values(asset_id, property_definition_id) unique
  - attachments(linked_type, linked_id)
  - ticket_events(ticket_id, created_at)
  - work_logs(ticket_id, created_at)
  - ticket_line_items(ticket_id, created_at)

### Seed Migration (P0)
- Seed asset_types (built-in):
  - NVR, DVR, ROUTER, SWITCH, ACCESS_POINT, PC, SERVER, PRINTER, ALARM, OTHER
- Seed ticket_status_definitions (minimum):
  - NEW (default)
  - IN_PROGRESS
  - WAITING_CUSTOMER
  - RESOLVED
  - CLOSED (is_closed_state=true)
- Seed essential asset_property_definitions for NVR/ROUTER/SWITCH/AP (minimum keys from specs).

### DoD
- `alembic upgrade head` creates schema.
- Seeds exist in DB.

---

## 2) Auth & RBAC (P0)
Source: `docs/spec/11_RBAC.md`

### Tasks
- Implement password hashing for internal_users and client_users.
- JWT login:
  - POST /auth/login (internal and client users; may have separate endpoints if easier)
  - GET /auth/me
- RBAC middleware/dependencies:
  - role detection (admin/technician/office/client_contact/client_admin)
  - scope rules for client users:
    - client_admin: all client data
    - client_contact: limited tickets (initially: only tickets created by them OR by allowed sites; pick simplest: created_by/initiator)
- Add config flags:
  - client_admin_can_view_secrets (default false)
  - technician_can_edit_secrets (default true)

### DoD
- Can login as admin and as client_admin.
- Forbidden responses correctly returned for unauthorized endpoints.

---

## 3) Core CRUD: Clients / Sites / Contacts / Locations (P1)
### Tasks
- Implement endpoints:
  - Clients: list/create/get/update
  - Sites: create/list/update
  - Contacts: create/list/update
  - Contact-site linking
  - Locations CRUD per site
- Business rule:
  - Auto-create Default Site when a new client created (if no sites provided).

### DoD
- Admin/internal can manage these entities.
- Client_admin can read their own client data.

---

## 4) Tickets Vertical Slice (P0)
Source: `docs/spec/20_TICKET_SPEC.md`

### 4.1 Ticket CRUD
- Endpoints:
  - GET /tickets (filters)
  - POST /tickets
  - GET /tickets/{id}
  - PATCH /tickets/{id}
- Validation:
  - contact_phone required
  - contact_person_id OR contact_name required
  - initiator required
- On create:
  - create ticket_initiators row
  - create ticket_event type=created

### 4.2 Ticket Events (comments)
- POST /tickets/{id}/events
- Must add actor info.

### 4.3 Status & Assignment
- POST /tickets/{id}/status
  - create event status_change
  - set closed_at if closed state
  - close validation: at least one comment or work log
- POST /tickets/{id}/assign
  - create event assignment_change

### 4.4 Work Logs (Time)
- POST /tickets/{id}/work-logs
- PATCH/DELETE work logs
- Validate start/end vs duration_minutes
- On create: create ticket_event type=work_logged

### 4.5 Line Items
- POST /tickets/{id}/line-items
- PATCH/DELETE line items
- Ensure flags:
  - included_in_service
  - chargeable

### DoD
- Full ticket lifecycle works:
  - create ticket, comment, add work log, add line item, change status, close.
- RBAC enforced:
  - client_admin sees their client tickets
  - client_contact sees limited tickets

---

## 5) Assets MVP (P1)
Source: `docs/spec/30_ASSET_SPEC.md`

### 5.1 Assets Core
- Endpoints:
  - GET /assets (search/filter: label, serial, LAN/WAN IP via properties)
  - POST /assets
  - GET /assets/{id}
  - PATCH /assets/{id}
- Implement dynamic properties:
  - Accept properties dict in create/update
  - Resolve definitions by asset_type
  - Store in asset_property_values by datatype
  - Secrets stored encrypted

### 5.2 Asset Events (Audit)
- On significant changes:
  - password fields changed → asset_event(password_changed)
  - WAN fields changed → asset_event(wan_access_changed)
  - LAN fields changed → asset_event(lan_access_changed)
- Provide GET /assets/{id} including:
  - properties
  - events
  - linked tickets (via ticket_asset_links)

### 5.3 NVR Disks
- CRUD endpoints for nvr_disks
- On disk add/update/delete create asset_event(disk_added/disk_replaced/disk_removed)

### 5.4 Link assets to tickets
- Endpoint:
  - POST /tickets/{id}/assets { asset_id, relation_type }
  - DELETE /tickets/{id}/assets/{asset_id}
- Create ticket_events asset_linked/asset_unlinked

### DoD
- Create NVR with WAN/LAN/credentials, see properties.
- Link NVR to ticket; ticket shows linked assets; asset shows linked tickets.

---

## 6) Projects MVP (P2)
Source: `docs/spec/40_PROJECT_SPEC.md`

### Tasks
- Endpoints:
  - GET/POST/PATCH /projects
  - Link sites/tickets/assets to project
  - POST /projects/{id}/events
- Attachments:
  - support linked_type=project

### DoD
- Create project, link tickets/assets, add milestone note.

---

## 7) Reports MVP (P1)
Source: `docs/spec/50_REPORTS_SPEC.md`

### 7.1 Report Queries
Implement query functions for:
- Client Summary (period)
- Client Detailed (period)
- Site (period)
- Ticket (single)
- Asset History (period)

Must compute:
- ticket counts by service_scope
- time totals included vs not included
- breakdown by work_type
- line items summary: included vs chargeable

### 7.2 Rendering
- HTML rendering:
  - Jinja2 templates recommended
- PDF rendering:
  - start with HTML-only MVP OR use WeasyPrint (Linux deps) / wkhtmltopdf
  - If PDF is hard initially, keep "Download HTML" and add PDF later.

### Endpoints
- POST /reports/* returns either:
  - immediate file (simple)
  - or {report_id} + download endpoint (later)

### DoD
- Generate client summary and ticket report successfully.

---

## 8) File Uploads (P1)
### Tasks
- POST /attachments multipart
- Store files locally (MVP) under /data/uploads
- Save metadata to attachments
- Enforce allowed mime types and max size

### DoD
- Upload file to ticket and download via static serving.

---

## 9) Admin: Statuses + Asset Type/Property Definitions (P2)
### Ticket Status Admin
- CRUD + reorder + set default + deactivate

### Asset Type Admin
- CRUD asset_types (allow custom types)
- CRUD asset_property_definitions (including label_he/label_en, required, visibility)

### DoD
- Admin can create custom asset type "CUSTOM_PRINTER" and add 3 fields.

---

## 10) i18n / Hebrew Readiness (Backend-support) (P2)
Source: `docs/spec/90_I18N.md`

### Tasks
- Ensure user has preferred_locale fields
- API returns preferred_locale in /auth/me
- Ensure status definitions and asset defs can store name_he/name_en and label_he/label_en
- Provide fallback fields in API responses:
  - display_name resolved by requested locale if DB has it, else by code/key

### DoD
- Client_admin in he-IL receives Hebrew display names when provided.

---

## 11) Quality Gates (P0–P2)
### Tests (minimum)
- Ticket create validation
- Work log duration validation
- RBAC: client_admin cannot read other client tickets
- Secrets not returned to client users unless allowed

### Logging
- Log request id
- Audit events created for ticket/asset changes

### Performance basics
- Add indexes for search fields
- Add pagination on lists

---

## Suggested Implementation Order (practical)
1) DB + seeds
2) Auth/RBAC
3) Tickets (full vertical slice)
4) Basic Reports (ticket + client summary)
5) Assets core + link to tickets
6) Projects
7) Admin screens endpoints (custom asset types/fields)
8) PDF exports

---

## Deliverables for Cursor/Claude prompt
- "Implement tasks 0–4 first (tickets slice) with full RBAC and migrations."
- "Return working endpoints + migration scripts + minimal templates for reports."
