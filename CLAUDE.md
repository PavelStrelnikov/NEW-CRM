# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **specification repository** for a CRM system designed for IT service companies managing CCTV, network infrastructure, and general IT equipment. The codebase to be built is a FastAPI backend with PostgreSQL.

**No code exists yet** — only specification documents in `docs/spec/`.

## Target Stack

- **Backend**: Python 3.12 + FastAPI
- **Database**: PostgreSQL 16+
- **ORM**: SQLAlchemy 2.x
- **Migrations**: Alembic
- **Auth**: JWT with RBAC
- **i18n**: Hebrew (he-IL, RTL) default, English (en-US) supported

## Specification Documents

Read specs in this order before implementing:

1. `docs/spec/10_ER_MODEL.md` — Database schema (tables, relations, keys)
2. `docs/spec/11_RBAC.md` — Role-based permissions (admin, technician, office, client_contact, client_admin)
3. `docs/spec/20_TICKET_SPEC.md` — Ticket lifecycle and validation rules
4. `docs/spec/30_ASSET_SPEC.md` — Dynamic asset properties and equipment types
5. `docs/spec/60_API_CONTRACT.md` — REST API endpoints and payloads
6. `docs/spec/81_SEED_DATA.md` — Initial data (statuses, asset types, property definitions)

## Architecture Decisions

### Actor Pattern
All audit fields use a polymorphic actor pattern:
- `actor_type` (internal_user, client_user, external_identity, integration)
- `actor_id` (nullable reference)
- `actor_display` (denormalized name for display)

### Dual User Tables
- `internal_users` — Company staff (admin, technician, office roles)
- `client_users` — External users (client_contact, client_admin roles)

### Dynamic Asset Properties
Assets use an EAV pattern:
- `asset_types` — Equipment categories (NVR, ROUTER, SWITCH, etc.)
- `asset_property_definitions` — Field schemas per type (with data_type, visibility, validation)
- `asset_property_values` — Actual values with type-specific columns (value_string, value_int, value_secret_encrypted, etc.)

### Ticket Initiator vs Contact
Every ticket tracks:
- **Initiator** — Who opened the ticket (stored in `ticket_initiators`)
- **Contact** — Who to call back (`contact_phone` required, may differ from initiator)

### Service Scope
Three-level billing tracking:
- `ticket.service_scope` (included/not_included/mixed)
- `work_log.included_in_service` (bool)
- `ticket_line_item.included_in_service` + `chargeable` (bools)

### Secrets Handling
- Properties with `data_type: secret` stored in `value_secret_encrypted`
- Visibility controlled by `asset_property_definitions.visibility` (internal_only, client_admin, client_all)
- Password changes create `asset_event` audit records

## Key Validation Rules

- Ticket requires: `client_id`, `site_id`, `title`, `description`, `source_channel`, `initiator`, `contact_phone`, and either `contact_person_id` OR `contact_name`
- Work log requires: either (`start_at` + `end_at`) OR `duration_minutes > 0`
- Ticket close requires: status with `is_closed_state=true` AND at least one comment or work log

## Project Structure (to be created)

```
app/
├── main.py
├── config.py
├── db/
│   ├── session.py
│   └── base.py
├── models/
├── schemas/
├── api/
├── services/
├── auth/
└── utils/
```

## MVP Scope

Included: Tickets, Work Logs, Line Items, Assets, Projects, Reports, File Uploads
Excluded: Accounting/invoicing, mobile app, bot integrations (only data model foundations)
