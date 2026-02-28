# Cleanup Actions - Quick Reference

**Execute these steps to trim to approved scope.**

---

## Step 1: Delete Inbound Messages (Future Feature)

```bash
cd backend

# Delete migration
rm alembic/versions/20260113_000004_create_inbound_messages.py

# Delete model
rm app/models/messages.py
```

**Edit** `app/models/__init__.py`:
```python
# REMOVE these lines (around line 21):
from app.models.messages import InboundMessage, InboundMessageAttachment

# REMOVE from __all__ list (around line 75-76):
    "InboundMessage",
    "InboundMessageAttachment",
```

---

## Step 2: Fix Migration Chain

**Edit** `alembic/versions/20260113_000005_add_asset_visibility_index.py`:

Change line 16 from:
```python
down_revision: Union[str, None] = '20260113_000004'
```

To:
```python
down_revision: Union[str, None] = '20260113_000003'  # Skip deleted migration 004
```

---

## Step 3: Simplify RBAC System

### Option A: Replace with Simple Version

```bash
cd backend/app

# Backup current version
cp rbac.py rbac_complex_backup.py

# Replace with simple version
mv rbac_simple.py rbac.py
```

### Option B: Keep Complex Version

If you want to keep the 30+ permission system, just:
1. Review `rbac.py` permissions
2. Confirm they match your needs
3. Keep as-is

**Recommendation**: Use Option A (simple) since you said "we wanted simple role checks"

---

## Step 4: Test After Cleanup

```bash
cd backend

# 1. Check syntax
python -m py_compile app/rbac.py
python -m py_compile app/models/__init__.py

# 2. Test migrations
alembic upgrade head

# 3. Verify app starts
uvicorn app.main:app --reload
# Should start without errors

# 4. Hit health endpoint
curl http://localhost:8000/health
# Should return {"status": "healthy", ...}
```

---

## Step 5: Verify .env Setup

Create/update `backend/.env`:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/crm_dev
JWT_SECRET_KEY=your-stable-secret-key-minimum-32-characters-do-not-change
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=true
```

**Generate stable key** (only once):
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**IMPORTANT**: Once set, NEVER change `JWT_SECRET_KEY` or existing tokens break.

---

## Final Migration Sequence

After cleanup, you should have:

```
backend/alembic/versions/
  20260112_212835_add_callback_contact.py       (existing)
  20260113_000001_add_ticket_creation_fields.py ✅
  20260113_000002_create_client_user_sites.py   ✅
  20260113_000003_add_client_user_role.py       ✅
  20260113_000005_add_asset_visibility_index.py ✅ (parent: 000003)
  20260113_000006_create_ticket_assignment.py   ✅ (parent: 000005)
```

**Total**: 5 new migrations (removed 1)

---

## What You Should Have

### Files Created (Approved)
- ✅ 5 Alembic migrations
- ✅ `app/rbac.py` (simple or complex - your choice)
- ✅ `app/guards.py`
- ✅ `app/services/ticket_assignment.py`
- ✅ `app/services/auth_service.py`
- ✅ `app/api/ticket_assignment.py`
- ✅ `app/api/portal_auth.py`
- ✅ `app/api/portal_tickets.py`
- ✅ `app/api/portal_assets.py`

### Files Updated (Approved)
- ✅ `app/models/tickets.py` (added TicketAssignmentHistory, creator fields)
- ✅ `app/models/users.py` (added ClientUserSite, CLIENT_USER role)
- ✅ `app/models/__init__.py` (exports)
- ✅ `app/main.py` (router registration)

### Files Removed (Not Approved)
- ❌ `app/models/messages.py`
- ❌ Migration 004

### Pre-Existing (Not My Addition)
- ℹ️ "Office" role in InternalUserRole enum (already existed)

---

## Estimated Time

- **Deletions**: 2 minutes
- **Fix migration parents**: 1 minute
- **Replace RBAC (if desired)**: 1 minute
- **Test**: 5 minutes

**Total**: ~10 minutes

---

## Questions?

If anything is unclear, check:
- `SCOPE_VERIFICATION_FINAL.md` - Full audit
- `PLAN_RBAC_TICKET_ASSIGNMENT.md` - Original locked plan
- `rbac_simple.py` - Simplified permission checks

**Status**: Ready to execute cleanup ✅
