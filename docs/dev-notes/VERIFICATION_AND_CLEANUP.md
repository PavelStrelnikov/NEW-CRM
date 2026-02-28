# Verification & Cleanup Report

**Date**: 2026-01-13
**Status**: Audit in progress

---

## 1. Database Schema Changes - Exact Operations

### Migration 001: `20260113_000001_add_ticket_creation_fields.py`
**Revision ID**: `20260113_000001`
**Parent**: `20260112_212835`

**Operations**:
- CREATE ENUM: `created_by_type_enum` ('internal', 'client', 'system')
- ADD COLUMN: `tickets.created_by_type` (String, NOT NULL after backfill)
- ADD COLUMN: `tickets.created_by_internal_user_id` (UUID, nullable, FK → internal_users)
- ADD COLUMN: `tickets.created_by_client_user_id` (UUID, nullable, FK → client_users)
- UPDATE: Backfill existing tickets with `created_by_type = 'internal'`

**Approved?** ✅ YES - In locked plan section "2. Ticket Data Model Changes"

---

### Migration 002: `20260113_000002_create_client_user_sites.py`
**Revision ID**: `20260113_000002`
**Parent**: `20260113_000001`

**Operations**:
- CREATE TABLE: `client_user_sites`
  - `id` (Integer, PK)
  - `client_user_id` (UUID, FK → client_users, CASCADE)
  - `site_id` (UUID, FK → sites, CASCADE)
  - `created_at` (DateTime)
  - UNIQUE constraint: (client_user_id, site_id)
- CREATE INDEX: `ix_client_user_sites_client_user_id`
- CREATE INDEX: `ix_client_user_sites_site_id`

**Approved?** ✅ YES - In locked plan "Decision 5: Client User Site Scoping"

---

### Migration 003: `20260113_000003_add_client_user_role.py`
**Revision ID**: `20260113_000003`
**Parent**: `20260113_000002`

**Operations**:
- ALTER TYPE: Add 'client_user' value to `clientuserrole` enum

**Approved?** ✅ YES - In locked plan, user roles include client_user

---

### Migration 004: `20260113_000004_create_inbound_messages.py` ⚠️
**Revision ID**: `20260113_000004`
**Parent**: `20260113_000003`

**Operations**:
- CREATE TABLE: `inbound_messages` (id, source, sender_identity, subject, body, ticket_id, created_at, processed_at)
- CREATE INDEX: `ix_inbound_messages_source`
- CREATE INDEX: `ix_inbound_messages_ticket_id`
- CREATE INDEX: `ix_inbound_messages_created_at`
- CREATE TABLE: `inbound_message_attachments` (id, message_id, file_path, file_name, mime_type)
- CREATE INDEX: `ix_inbound_message_attachments_message_id`

**Approved?** ⚠️ **QUESTIONABLE** - Plan section 8 says "Future Channel Ingestion Plan" with note "not implemented now, just structure"
**Decision**: Should be removed or marked as optional/deferred

---

### Migration 005: `20260113_000005_add_asset_visibility_index.py`
**Revision ID**: `20260113_000005`
**Parent**: `20260113_000004`

**Operations**:
- CREATE INDEX: `ix_asset_property_definitions_visibility` on `asset_property_definitions(visibility)`

**Approved?** ✅ YES - Performance optimization for portal asset filtering (locked plan section 9)

---

### Migration 006: `20260113_000006_create_ticket_assignment_history.py`
**Revision ID**: `20260113_000006`
**Parent**: `20260113_000005`

**Operations**:
- CREATE TABLE: `ticket_assignment_history`
  - `id` (UUID, PK)
  - `ticket_id` (UUID, FK → tickets, CASCADE)
  - `assigned_to_internal_user_id` (UUID, FK → internal_users, RESTRICT)
  - `assigned_by_actor_type` (String)
  - `assigned_by_actor_id` (UUID, nullable)
  - `assigned_by_actor_display` (String)
  - `assignment_type` (String) - 'auto' | 'manual' | 'reassign'
  - `reason` (Text, nullable)
  - `created_at` (DateTime)
- CREATE INDEX: `ix_ticket_assignment_history_ticket_id`
- CREATE INDEX: `ix_ticket_assignment_history_assigned_to`
- CREATE INDEX: `ix_ticket_assignment_history_created_at`

**Approved?** ✅ YES - In locked plan "10. Alembic Migrations Checklist" item 6

---

## 2. Scope Validation - Items NOT in Approved Plan

### ❌ UNAPPROVED: "Office" Internal Role

**Where**: `app/models/users.py`, `app/rbac.py`

```python
class InternalUserRole(str, enum.Enum):
    ADMIN = "admin"
    TECHNICIAN = "technician"
    OFFICE = "office"  # ❌ NOT IN LOCKED DECISIONS
```

**Approved Roles (from locked plan section 1)**:
- admin ✅
- technician ✅
- dispatcher (deferred) ⚠️

**Action Required**: Remove OFFICE role or confirm it was approved separately

---

### ❌ UNAPPROVED: 30+ Granular Permissions

**Where**: `app/rbac.py`

**What was built**: Permission enum with 30+ permissions:
- MANAGE_SYSTEM, MANAGE_USERS_INTERNAL, MANAGE_ASSET_TYPES
- CREATE_CLIENT, EDIT_CLIENT, DELETE_CLIENT, VIEW_CLIENTS
- CREATE_ASSET, EDIT_ASSET, DELETE_ASSET, VIEW_ASSETS
- CREATE_TICKET, VIEW_ALL_TICKETS, VIEW_ASSIGNED_TICKETS, UPDATE_TICKET, ASSIGN_TICKET
- CREATE_WORKLOG, EDIT_WORKLOG, DELETE_WORKLOG
- VIEW_REPORTS, EXPORT_DATA
- PORTAL_CREATE_TICKET, PORTAL_VIEW_TICKETS, PORTAL_ADD_COMMENT
- PORTAL_VIEW_ASSETS, PORTAL_EDIT_ASSET, PORTAL_MANAGE_USERS

**What was requested (from locked plan)**:
- Plan section 1 shows a "Role Matrix & Permissions" with detailed permissions
- BUT user is saying this was NOT requested

**User's statement**: "30+ granular permissions system (not requested; we wanted simple role checks)"

**Action Required**: Clarify if the role matrix in the plan was approved or if simpler checks were desired

---

### ❌ UNAPPROVED: Inbound Message Tables (Future Feature)

**Where**: Migration 004, `app/models/messages.py`

**What was built**:
- `inbound_messages` table
- `inbound_message_attachments` table

**Plan says**: "8. Future Channel Ingestion Plan" - marked as placeholder for future

**Action Required**: Remove migration 004 and `app/models/messages.py` OR mark as optional

---

### ❌ UNAPPROVED: Portal Comments Endpoint

**Where**: `app/api/portal_tickets.py`

```python
@router.post("/tickets/{ticket_id}/comments")
async def add_ticket_comment(...)
```

**What was requested (locked plan section 6)**:
- Portal can view tickets ✅
- Portal can create tickets ✅
- **Portal can add comments** - checking plan...

**Locked plan section 7 "Client Portal UI Flow"**:
- "Comments (view + add)" - ✅ APPROVED

**Action Required**: Keep this endpoint (it IS in the plan)

---

## 3. Backwards Compatibility Check

### Required Verification

#### A. Database Compatibility
- [ ] Verify `tickets` table exists before migration 001
- [ ] Verify `assigned_to_internal_user_id` already exists in tickets (from prior work)
- [ ] Confirm migration 001 adds only NEW columns (created_by_*)
- [ ] Test migration rollback works

#### B. Application Startup
- [ ] Start app with existing JWT token → should work
- [ ] Hit `/health` endpoint → should return 200
- [ ] Hit `/api/v1/auth/me` with stable token → should decode properly

#### C. Existing Endpoints
- [ ] `/api/v1/tickets` (list) - still works
- [ ] `/api/v1/tickets/{id}` (get) - still works
- [ ] `/api/v1/clients` (list) - still works

---

## 4. Required .env Variables for Local Dev

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/crm_dev

# JWT Authentication
JWT_SECRET_KEY=your-super-secret-key-change-in-production-min-32-chars
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
DEBUG=true

# Optional RBAC Flags (if used)
CLIENT_ADMIN_CAN_VIEW_SECRETS=false
TECHNICIAN_CAN_EDIT_SECRETS=true
```

**Critical**: `JWT_SECRET_KEY` must be **stable** across restarts. Do NOT regenerate or existing tokens will become invalid.

**Recommended**: Generate with:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 5. Cleanup Actions Required

### Immediate Removals

#### 1. Remove "Office" Role (if not approved)
**Files to edit**:
- `app/models/users.py` - Remove OFFICE from InternalUserRole enum
- `app/rbac.py` - Remove OFFICE permissions from ROLE_PERMISSIONS dict

#### 2. Simplify Permissions (if 30+ not approved)
**Options**:
A. Keep granular system (if user approves role matrix from plan)
B. Simplify to basic role checks:
```python
# Simple version
def is_admin(role: str) -> bool:
    return role == "admin"

def is_technician(role: str) -> bool:
    return role == "technician"

def can_assign_tickets(role: str) -> bool:
    return role == "admin"
```

#### 3. Remove Inbound Message Tables (deferred feature)
**Files to delete**:
- `backend/alembic/versions/20260113_000004_create_inbound_messages.py`
- `app/models/messages.py`

**Files to edit**:
- `app/models/__init__.py` - Remove InboundMessage imports
- Migration 005 - Update down_revision to skip 004

#### 4. Keep Portal Comments (it IS approved in plan)
**No action needed** - endpoint is in locked plan section 7

---

## 6. Validation Checklist

### Before Migration
- [ ] Review locked plan sections 1-12 again
- [ ] Confirm which roles are approved (admin, technician only?)
- [ ] Confirm permission system level (granular or simple?)
- [ ] Confirm inbound messages are deferred

### After Cleanup
- [ ] All Python files compile
- [ ] No import errors after removing messages.py
- [ ] Migrations are sequential (no gaps)
- [ ] App starts successfully
- [ ] `/health` returns 200
- [ ] Existing auth tokens work

### Migration Test
- [ ] `alembic upgrade head` succeeds
- [ ] `alembic downgrade -1` succeeds
- [ ] `alembic upgrade head` again succeeds (idempotent)

---

## 7. Summary of Changes Needed

| Item | Status | Action |
|------|--------|--------|
| Migration 001 (created_by fields) | ✅ Approved | Keep |
| Migration 002 (client_user_sites) | ✅ Approved | Keep |
| Migration 003 (client_user role) | ✅ Approved | Keep |
| Migration 004 (inbound_messages) | ⚠️ Future | **Remove** |
| Migration 005 (visibility index) | ✅ Approved | Keep, update revision |
| Migration 006 (assignment_history) | ✅ Approved | Keep, update revision |
| "Office" role | ❌ Not approved | **Remove** |
| 30+ permissions | ⚠️ Unclear | **Await confirmation** |
| Portal comments endpoint | ✅ In plan | **Keep** |
| Assignment endpoints | ✅ Approved | Keep |
| Portal auth/tickets/assets | ✅ Approved | Keep |

---

## 8. Questions for Pavel

1. **Office role**: Should this be removed? Plan mentions admin/technician/dispatcher (deferred).

2. **Permission granularity**: The locked plan has a detailed role matrix. Do you want:
   - A) Keep the 30+ permission system (matches plan section 1)
   - B) Simplify to basic role checks (admin vs technician)

3. **Inbound messages**: Plan section 8 says "Future" but tables were created. Should these be:
   - A) Removed entirely (deferred)
   - B) Kept as-is (ready for future)

4. **Dispatcher role**: Plan says "NOT required now" - this was correctly NOT implemented. Confirm OK.

---

**Next Step**: Await Pavel's decisions on items 1-3, then execute cleanup.
