# RBAC & Ticket Assignment System — Planning Document

**Status**: ✅ APPROVED & LOCKED FOR IMPLEMENTATION
**Date**: 2026-01-13
**Approved By**: Pavel (2026-01-13)

---

## 🔒 FINAL DECISIONS (LOCKED)

### Decision 1: Technician Ticket Creation
✅ **Technicians CAN create tickets internally.**
- Technician-created tickets are **auto-assigned to the creating technician** (`assigned_to_internal_user_id = current_tech_id`)
- Technicians **cannot assign/reassign** to other technicians (admin-only permission)

### Decision 2: Ticket Assignment Requirement
✅ **Assignment is mandatory logically, but flexible in practice:**
- **Technician-created**: Auto-assigned to self immediately
- **Admin-created**: Admin must explicitly choose assignee at creation (no unassigned option)
- **Client-created (portal)**: Starts unassigned (`NULL`) → goes to admin triage queue for manual assignment

### Decision 3: Technician Unassigned Queue
✅ **Technicians do NOT see unassigned queue.**
- Technicians see only tickets where `assigned_to_internal_user_id = their_id`
- Unassigned ticket triage is **admin-only**
- Dispatcher role (if added later) will also have triage access

### Decision 4: Dispatcher Role
✅ **NOT required now; plan for future.**
- Keep role enum and architectural hooks for future
- Implement ticket assignment/triage as **admin-only for now**
- When dispatcher is needed, copy admin assignment permissions without system management access

### Decision 5: Client User Site Scoping
✅ **Strictly site-based scoping via `client_user_sites` table.**
- `client_user` can only access sites listed in `client_user_sites`
- If no sites assigned: user sees nothing and cannot create tickets (must assign sites first)
- `client_admin` ignores site restrictions and sees all sites within their client
- **Implication**: `client_user_sites` is required; no fallback to client-wide view

### Decision 6: Portal Ticket Visibility
✅ **Client users see all tickets for their allowed sites (not just their own).**
- `client_user`: All tickets in allowed sites (regardless of who created them)
- `client_admin`: All tickets across all sites for their client
- **Implication**: Portal uses client/site-level access control, not creator-based filtering

### Decision 7: Portal Assignment Display
✅ **Show technician display name only; no personal details.**
- If assigned: Display format `"[First Name] [Last Name]"` (e.g., "John Smith")
- If unassigned: Display `"Awaiting assignment"`
- Never expose: technician ID, email, phone, or internal notes

---

## 1. Role Matrix & Permissions

### INTERNAL USERS (internal_users table)

| Permission | Admin | Technician | Dispatcher (opt) |
|-----------|-------|-----------|------------------|
| **System Management** | ✅ | ❌ | ❌ |
| View system settings | ✅ | ❌ | ❌ |
| Manage users (internal) | ✅ | ❌ | ❌ |
| Manage asset types & properties | ✅ | ❌ | ❌ |
| **Clients Management** | ✅ | ❌ | ❌ |
| Create/edit/delete clients | ✅ | ❌ | ❌ |
| View client list | ✅ | ❌ | ❌ |
| **Assets Management** | ✅ | ❌ | ❌ |
| Create/edit assets | ✅ | ❌ | ❌ |
| View all assets | ✅ | ✅* | ✅* |
| *View only assets linked to assigned tickets | | | |
| **Tickets** | | | |
| Create tickets | ✅ | ✅* | ✅ |
| *Auto-assigned to self if technician creates* | | | |
| View all tickets | ✅ | ❌ | ✅ |
| View assigned tickets only | | ✅ | |
| Update ticket (status, priority, etc.) | ✅ | ✅** | ✅ |
| **Only assigned tickets** | | | |
| Add work logs | ✅ | ✅ | ✅ |
| Link/unlink assets | ✅ | ✅ | ✅ |
| Add comments/notes | ✅ | ✅ | ✅ |
| **Ticket Assignment** | | | |
| Assign/reassign tickets | ✅ | ❌ | (future) |
| Create & manage teams (future) | ✅ | ❌ | ✅ |
| **Reports** | | | |
| View reports | ✅ | ❓ | ✅ |
| Export data | ✅ | ❌ | ✅ |

**Legend:**
✅ = Yes
❌ = No
❓ = TBD (marked as decision needed)
*/* = Conditional permission

---

### EXTERNAL USERS (client_users table) — Portal

| Permission | Client User | Client Admin |
|-----------|-----------|-----------|
| **Ticket Management** | | |
| Create tickets (allowed sites only) | ✅* | ✅** |
| *Must be assigned to at least one site via client_user_sites* | | |
| **Can create in any client site** | | |
| View tickets (allowed sites) | ✅* | ✅ |
| *All tickets in allowed sites, not just own* | | |
| **View all client tickets** | | |
| Update own tickets (status, etc.) | ❌ | ❌ |
| View work logs | ✅ | ✅ |
| Add comments | ✅ | ✅ |
| **Assets Viewing** | | |
| View assets (allowed sites) | ✅* | ✅ |
| *All assets in allowed sites, not just own* | | |
| **View all client assets** | | |
| View asset details (safe fields) | ✅ | ✅ |
| Edit assets | ❌ | ❌ |
| **Account Management** | | |
| View profile | ✅ | ✅ |
| Change password | ✅ | ✅ |
| Manage other portal users (client) | ❌ | ✅ |

**Legend:** *With site restriction / **Across all sites*

---

## 2. Ticket Data Model Changes

### New/Modified Fields on `tickets` Table

```python
# New fields to add:
created_by_type: str  # 'internal' | 'client' | 'system'
created_by_internal_user_id: Optional[int]  # FK → internal_users
created_by_client_user_id: Optional[int]  # FK → client_users
assigned_to_internal_user_id: Optional[int]  # FK → internal_users (nullable)
source_channel: str  # 'phone' | 'whatsapp' | 'email' | 'api' | 'other'

# Already exists (confirm):
contact_phone: str  # Required
contact_person_id: Optional[int]  # FK → client_contacts
contact_name: Optional[str]  # Fallback if no contact_person_id
```

### New Table: `client_users` (External Portal Identity)

```sql
CREATE TABLE client_users (
    id SERIAL PRIMARY KEY,
    client_id INT NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    first_name VARCHAR,
    last_name VARCHAR,
    phone VARCHAR,
    role VARCHAR NOT NULL,  -- 'client_user' | 'client_admin'

    -- Account status
    is_active BOOL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,

    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

### New Table: `client_user_sites` (Optional Site Restriction)

For **client_user** role only — if client_user should be restricted to specific sites:

```sql
CREATE TABLE client_user_sites (
    id SERIAL PRIMARY KEY,
    client_user_id INT NOT NULL,
    site_id INT NOT NULL,

    UNIQUE(client_user_id, site_id),
    FOREIGN KEY (client_user_id) REFERENCES client_users(id),
    FOREIGN KEY (site_id) REFERENCES sites(id)
);
```

**Decision**: Should `client_user` role be:
- A) Always site-restricted (use `client_user_sites`)?
- B) Always client-wide (no restriction)?
- C) Optional per user (allow both)?

---

## 3. Ticket Assignment Workflow

### Creation Flow (LOCKED)

**Admin creates ticket:**
```
1. Fill in: client, site, description, contact, source_channel
2. REQUIRED: Select assignee from list of active technicians
3. Save ticket
4. Ticket enters workflow (status: "open" or "new")
5. Ticket is immediately assigned to selected technician
```

**Technician creates ticket:**
```
1. Fill in: client, site, description, contact, source_channel
2. created_by_type = 'internal', created_by_internal_user_id = self
3. AUTO-ASSIGN: assigned_to_internal_user_id = self (automatic, no choice)
4. Save ticket
5. Ticket immediately appears in "My Assigned Tickets"
```

**Client creates ticket (portal):**
```
1. Form restricted to allowed sites (client_user) or any site (client_admin)
2. Fill in: site (if client_user, pre-selected or dropdown of allowed), title, description
3. Contact info auto-populated from profile
4. created_by_type = 'client', created_by_client_user_id = self
5. assigned_to_internal_user_id = NULL (unassigned)
6. Ticket goes to admin triage queue
7. Client sees status "Awaiting assignment" until admin assigns
```

### Assignment Rules (LOCKED)

| Actor | Can Assign/Reassign? | Notes |
|-------|-----------|---------|
| Admin | ✅ | Any technician; anytime |
| Technician | ❌ | Cannot assign or reassign (even to self) |
| Client (portal) | ❌ | Cannot see or change assignment |

**Special case:** Technician creating their own ticket auto-assigns to self (not a choice, automatic).

---

## 4. Technician Ticket Visibility (LOCKED)

### Implementation: Assigned Tickets Only
- **Technician view**: Only tickets where `assigned_to_internal_user_id = their_id`
- **Admin view**: All tickets (assigned + unassigned) + filters
- **Query for technician**: `WHERE assigned_to_internal_user_id = :tech_id`
- **Query for admin**: `WHERE 1=1` (or filter by client, site, status, etc.)

**Implication**: Unassigned ticket triage is a dedicated admin workflow:
1. Admin views "Unassigned Queue" (tickets where `assigned_to_internal_user_id IS NULL`)
2. Admin assigns ticket to a technician
3. Ticket immediately appears in technician's "My Tickets" list

---

## 5. API Spec Updates

### Internal Auth Endpoints
```
POST   /api/v1/auth/login                    → JWT token + role
POST   /api/v1/auth/refresh                  → New JWT
POST   /api/v1/auth/logout                   → Invalidate
GET    /api/v1/auth/me                       → Current user details + permissions
```

### Internal Ticket Endpoints (NEW/MODIFIED)

```
# Ticket CRUD
POST   /api/v1/tickets                       → Create ticket (auto-set created_by_type)
GET    /api/v1/tickets                       → List (filtered by role)
  - Admin: all tickets
  - Technician: assigned tickets only
GET    /api/v1/tickets/{id}
PATCH  /api/v1/tickets/{id}                 → Update ticket

# Assignment (NEW)
PATCH  /api/v1/tickets/{id}/assign           → Assign to technician (admin/dispatcher only)
PATCH  /api/v1/tickets/{id}/unassign         → Remove assignment
GET    /api/v1/tickets/{id}/assignment-history → View changes

# My Tickets (convenience endpoint)
GET    /api/v1/tickets/me/assigned           → Technician's assigned tickets
```

### Portal Auth Endpoints
```
POST   /api/v1/portal/auth/register          → Self-register (client admin creates)
POST   /api/v1/portal/auth/login             → JWT token + role
GET    /api/v1/portal/auth/me
```

### Portal Ticket Endpoints
```
POST   /api/v1/portal/tickets                → Create (auto: created_by_client_user_id)
GET    /api/v1/portal/tickets                → List (scoped by site or client)
GET    /api/v1/portal/tickets/{id}           → View details (safe fields only)
PATCH  /api/v1/portal/tickets/{id}/comment   → Add comment
```

### Portal Assets Endpoints
```
GET    /api/v1/portal/assets                 → List (scoped by client or site)
GET    /api/v1/portal/assets/{id}            → View (safe fields: no passwords, no internal URLs)
```

---

## 6. Internal UI Flow Outline

### Admin Dashboard
```
Dashboard
├── Quick Stats (tickets by status, unassigned count, technician load)
├── Ticket List (all tickets)
│   ├── Filter: status, assigned_to, client, source_channel, priority
│   ├── Bulk actions: assign, reassign, close
│   ├── Each row shows: ticket#, client, site, status, assigned_to, created_by_type
└── Create Ticket button
    └── Form:
        - Client/Site selector
        - Description + Title
        - Source Channel dropdown (phone, whatsapp, email, api, other)
        - Contact (phone + name OR contact_person_id)
        - Assign to dropdown (list of technicians)
        - Save
```

### Ticket Details Page (Admin)
```
Ticket Header:
├── ID, Status, Priority
├── Created by: [Name] ([admin/technician/client label])
├── Client/Site
├── Source Channel badge
└── Assignment section (see below)

Ticket Body:
├── Description + Title
├── Contact (phone + name)
├── Work logs (view/add)
├── Assets linked (view/add/remove)
├── Comments/Timeline

Assignment Info (LOCKED):
├── Currently assigned to: [Tech First Last Name]
├── Last assigned on: YYYY-MM-DD HH:MM
├── [Reassign] button (admin only)
└── Assignment history (audit trail: who → whom, when)
    └── Shows: Admin reassigned from [Tech A] to [Tech B] on YYYY-MM-DD
    └── Auto-created entries: "Ticket auto-assigned to [Tech] on creation (technician-created)" or
       "Ticket assigned to [Tech] on creation (admin-created)"
```

### Technician Portal - My Tickets
```
Dashboard/Home:
├── Quick stats: [X] assigned tickets
├── [Create New Ticket] button
└── My Tickets list (see below)

My Tickets (filtered list - LOCKED):
├── Filter: status, priority, site
├── Each row: ticket#, client, title, status, priority, created_date
├── Click → Ticket Details

Ticket Details (Technician):
├── Cannot see assignment controls (no reassign button)
├── Can see: Assigned to: [My Name]
├── Can: add work logs, link assets, add comments, update status (if allowed)
└── Can view: work history, asset edits, comment timeline

Create Ticket (Technician - LOCKED):
├── Form: client, site, description, title, contact (phone + name/contact_person_id)
├── Source Channel: Auto-set to 'internal' (or hidden)
├── On save: Auto-assign to current technician
├── Confirmation: "Ticket #12345 created and assigned to you"
```

---

## 7. Client Portal UI Flow Outline

### Client Portal - Ticket List (LOCKED)
```
Tickets (or "Support Tickets")
├── Filter: status, date range, site (client_user may not see this)
├── List: ticket#, status, created_date, last_update, assigned_technician
├── Assigned Technician column (LOCKED):
│   ├── If assigned: "[First Name] [Last Name]" (e.g., "John Smith")
│   └── If unassigned: "Awaiting assignment"
├── Click → Ticket Details
└── NOTE: Client sees ALL tickets for their allowed scope, not just own
```

### Client Portal - Ticket Creation
```
New Ticket Form:
├── If client_user: (optional) Select site
├── If client_admin: Select site (any of client's sites)
├── Title + Description
├── Category (optional, if you have ticket types)
├── Contact info (auto-populated from profile)
├── Submit → Ticket created

Confirmation:
├── "Ticket #12345 created"
├── "Assigned technician will contact you soon"
└── Redirect to ticket details
```

### Client Portal - Ticket Details (LOCKED)
```
Ticket Header:
├── ID, Status, Title
├── Assigned Technician (LOCKED):
│   ├── If assigned: "[First Name] [Last Name]" (e.g., "John Smith")
│   └── If unassigned: "Awaiting assignment"
├── Created date
└── Created by indicator (if relevant: e.g., "Created by you" or show name)

Ticket Body:
├── Description (read-only)
├── Work logs (read-only):
│   ├── Date, duration, notes
│   └── Technician name (not ID or contact)
├── Asset list (safe fields only, no passwords/internal URLs/internal notes)
├── Comments (view + add):
│   ├── Posted by: Technician name or "You" (client)
│   └── Timestamp
└── NO controls for: reassigning, editing status, unlinking assets
```

### Client Portal - Asset List (LOCKED)
```
Assets (filtered by scope)
├── client_user: Assets in allowed sites (via client_user_sites)
├── client_admin: All assets across all client sites
├── Filter: asset type, site (client_user may not see site filter if single site)
├── List: asset name, type, location, status
├── Click → Asset Details
└── NOTE: Client sees ALL assets in scope, not just linked to their tickets

Asset Details (LOCKED):
├── Name, Type, Serial, Location
├── Safe properties ONLY (apply visibility rules):
│   ├── Show: data_type != 'secret' AND visibility != 'internal_only'
│   └── Hide: passwords, RTSP URLs with creds, cost fields, internal notes
├── Related tickets: List linked tickets (read-only)
└── No edit capability (read-only, no property edits)
```

---

## 8. Future Channel Ingestion Plan

### Incoming Message Processing (Email/WhatsApp/API)

```
Inbound Message Event
├── Source: email | whatsapp | api
├── Route to: InboundMessageService
│
├── Parse:
│   ├── Extract sender (email, phone, API key)
│   ├── Match to client/client_user OR create "unknown" ticket
│   ├── Extract subject/body → title + description
│
├── Create Ticket:
│   ├── created_by_type = 'system'
│   ├── created_by_internal_user_id = NULL
│   ├── created_by_client_user_id = NULL (or matched client_user if known)
│   ├── source_channel = 'email' | 'whatsapp' | 'api'
│   ├── assigned_to_internal_user_id = NULL (unassigned, auto-assign later?)
│
├── Store Raw Message:
│   └── New table: inbound_messages (source, sender, raw_body, ticket_id, processed_at)
│
└── Notify Admin:
    └── Email/webhook: "New inbound ticket #12345 from WhatsApp"
```

### Data Model for Future

```sql
CREATE TABLE inbound_messages (
    id SERIAL PRIMARY KEY,
    source VARCHAR NOT NULL,  -- 'email' | 'whatsapp' | 'api'
    sender_identity VARCHAR,  -- email or phone or API key
    subject VARCHAR,
    body TEXT,
    ticket_id INT,  -- NULL until matched/created

    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,

    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

CREATE TABLE inbound_message_attachments (
    id SERIAL PRIMARY KEY,
    message_id INT NOT NULL,
    file_path VARCHAR,
    file_name VARCHAR,
    mime_type VARCHAR,

    FOREIGN KEY (message_id) REFERENCES inbound_messages(id)
);
```

**Future placeholder**: `InboundMessageService` class stub in `backend/app/services/` (not implemented now, just structure).

---

## 9. Security & Visibility Rules

### Safe Asset Fields (Portal View)

**Do NOT expose to client:**
- Passwords / secrets (value_secret_encrypted)
- Internal-only notes
- RTSP URLs with embedded credentials
- Cost / pricing fields
- Warranty details (internal)

**Safe to expose:**
- Asset name, type, serial number
- Location/site
- Status (online/offline/maintenance)
- Client-visible notes
- Support end date
- Last maintenance date

**Query approach:** Filter by `asset_property_definitions.visibility` field:
- `internal_only` → not shown to clients
- `client_admin` → shown to client_admin only
- `client_all` → shown to all client users

### JWT Claims

**Internal User Token:**
```json
{
  "sub": "internal_user_123",
  "email": "tech@company.com",
  "role": "technician",
  "permissions": ["read:assigned_tickets", "write:assigned_tickets", ...],
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Client User Token:**
```json
{
  "sub": "client_user_456",
  "email": "contact@client.com",
  "role": "client_user",
  "client_id": 789,
  "site_ids": [10, 11],  -- if restricted to sites
  "permissions": ["read:client_tickets", "read:client_assets", ...],
  "iat": 1234567890,
  "exp": 1234571490
}
```

---

## 10. Alembic Migrations Checklist

**Migrations to create (in order):**

1. ✋ **`001_add_ticket_assignment_fields.py`**
   - Add: `created_by_type`, `created_by_internal_user_id`, `created_by_client_user_id`, `assigned_to_internal_user_id`, `source_channel`
   - Drop (if exists): old untyped creator fields
   - Add FK constraints

2. ✋ **`002_create_client_users_table.py`**
   - Create: `client_users` table with roles, passwords, timestamps
   - Add: indexes on email, client_id

3. ✋ **`003_create_client_user_sites_table.py` (conditional)**
   - Create: `client_user_sites` junction table
   - Only if site-scoping is needed for `client_user` role

4. ✋ **`004_create_inbound_messages_table.py`**
   - Create: `inbound_messages` table (for future channel ingestion)
   - Create: `inbound_message_attachments` table

5. ✋ **`005_update_asset_property_visibility.py`**
   - Ensure `asset_property_definitions.visibility` enum includes:
     - `internal_only`, `client_admin`, `client_all` (or update existing enum)

6. ✋ **`006_create_assignment_audit_table.py` (optional)**
   - Create: `ticket_assignment_history` (tracks who assigned to whom, when)
   - Useful for auditing and reporting technician load over time

---

## 11. Locked Decisions Summary

✅ **All 7 critical decisions are LOCKED and finalized above (see "FINAL DECISIONS" section).**

### Remaining Implementation Decisions (TBD during coding)

These will be decided during implementation or are left flexible:

1. **Password hashing library** for `client_users` — bcrypt, argon2, etc.
2. **JWT secret/key management** — Secret storage, rotation strategy
3. **Rate limiting** — Login endpoints rate limit (e.g., 5 attempts / 15 min)
4. **Session timeout** — Internal vs portal JWT expiry times
5. **Error message verbosity** — Security vs UX tradeoff on login failures
6. **Tech assignment history tracking** — What detail to store (reason, reassigned_by role, etc.)
7. **Portal asset visibility** — Fine-tune which properties are safe (decide per property_definition)
8. **Technician name display in portal** — First + Last, or allow full name overrides
9. **Unassigned queue ordering** — By creation date (FIFO), priority, or site grouping
10. **Client user site assignment flow** — Admin UI to manage `client_user_sites` (TBD later)

---

## 12. Implementation Readiness Checklist

✅ **All items below are LOCKED & APPROVED:**

- [x] Pavel reviews and approves this plan
- [x] All 7 critical decisions answered and locked
- [x] Roles matrix finalized
- [x] API endpoint list outlined
- [x] UI flows documented
- [x] Migration order confirmed (6 migrations)
- [x] Security rules locked
- [x] **READY FOR IMPLEMENTATION** ✅

### Next Steps (After Approval)

1. Create database migration scripts (Alembic)
2. Implement FastAPI backend:
   - Auth service (internal + portal separate flows)
   - Ticket service (CRUD + assignment)
   - Client user service (portal identity)
   - Assignment audit service
3. Implement database models (SQLAlchemy)
4. Implement API endpoints
5. Implement portal frontend (React)
6. Implement internal admin/technician frontend (React)
7. Testing (unit, integration, E2E)
