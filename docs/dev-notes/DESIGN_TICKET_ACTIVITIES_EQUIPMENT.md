# Design: Ticket Activities & Equipment Linking

## Executive Summary

**Good news:** Most of the required infrastructure **already exists** in the database!

- ✅ **WorkLog model** exists with time tracking (both modes supported)
- ✅ **ticket_asset_links** junction table exists for equipment linking
- ✅ **TicketLineItem** can already link to assets

**What's needed:**
1. Extend WorkLog activity types to include communication activities
2. Add validation for time tracking modes
3. Create API endpoints (currently missing or incomplete)
4. Build UI components

---

## Part 1: Ticket Activities (Work Log)

### 1.1 Current State Analysis

**Existing WorkLog Model** (`backend/app/models/time_billing.py`):
```python
class WorkLog(Base):
    id = Column(UUID)
    ticket_id = Column(UUID, ForeignKey("tickets.id"))
    work_type = Column(String)  # PHONE, REMOTE, ONSITE, TRAVEL, REPAIR_LAB, ADMIN
    description = Column(Text)
    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    included_in_service = Column(Boolean)
    billing_note = Column(Text, nullable=True)
    actor_type = Column(String)
    actor_id = Column(UUID, nullable=True)
    actor_display = Column(String)
    created_at = Column(DateTime)
```

**Current WorkType Enum:**
```python
class WorkType(str, enum.Enum):
    PHONE = "phone"
    REMOTE = "remote"
    ONSITE = "onsite"
    TRAVEL = "travel"
    REPAIR_LAB = "repair_lab"
    ADMIN = "admin"
```

### 1.2 Proposed Changes

#### Option A: Extend WorkType Enum (RECOMMENDED)

**Rationale:**
- WorkLog already supports both time tracking modes
- Just need to add communication activity types
- Simpler than creating a new model
- Maintains backward compatibility

**New WorkType Enum:**
```python
class WorkType(str, enum.Enum):
    # Communication activities
    PHONE_CALL = "phone_call"        # NEW
    EMAIL = "email"                   # NEW
    WHATSAPP = "whatsapp"            # NEW

    # Work activities
    REMOTE_WORK = "remote_work"      # Renamed from REMOTE
    ONSITE_VISIT = "onsite_visit"    # Renamed from ONSITE
    TRAVEL = "travel"
    REPAIR_LAB = "repair_lab"
    ADMIN = "admin"
    OTHER = "other"                   # NEW
```

**Migration:**
```sql
-- Update existing records to new naming
UPDATE work_logs SET work_type = 'phone_call' WHERE work_type = 'phone';
UPDATE work_logs SET work_type = 'remote_work' WHERE work_type = 'remote';
UPDATE work_logs SET work_type = 'onsite_visit' WHERE work_type = 'onsite';
```

#### Time Tracking Validation

**Current behavior:** Both fields can coexist
**Required behavior:** Enforce one mode at a time

**Validation Rules:**
1. **Mode A (Time Range):**
   - If `start_at` is provided → `end_at` is required
   - `duration_minutes` is auto-calculated: `(end_at - start_at).total_seconds() / 60`
   - Store calculated duration

2. **Mode B (Duration Only):**
   - If `start_at` is NULL → `duration_minutes` is required (must be > 0)
   - `end_at` must be NULL

**Implementation:**
- Add Pydantic validation in schema
- Add SQLAlchemy CheckConstraint (optional, for DB-level enforcement)
- Backend calculates `duration_minutes` from time range if Mode A is used

**Schema Update (no DB migration needed):**
```python
# In backend/app/schemas/work_logs.py (to be created)

class WorkLogCreate(BaseModel):
    ticket_id: UUID
    work_type: str  # From WorkType enum
    description: str

    # Mode A: Time range
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None

    # Mode B: Duration
    duration_minutes: Optional[int] = None

    included_in_service: bool = False
    billing_note: Optional[str] = None

    @validator('duration_minutes', always=True)
    def validate_time_tracking(cls, v, values):
        start_at = values.get('start_at')
        end_at = values.get('end_at')

        # Mode A: Time range
        if start_at:
            if not end_at:
                raise ValueError('end_at required when start_at is provided')
            if end_at <= start_at:
                raise ValueError('end_at must be after start_at')
            # Auto-calculate duration (will be set in API handler)
            return None

        # Mode B: Duration only
        if not v or v <= 0:
            raise ValueError('duration_minutes required when start_at is not provided')
        if end_at:
            raise ValueError('end_at cannot be set without start_at')

        return v
```

---

## Part 2: Equipment/Asset Linking to Tickets

### 2.1 Current State Analysis

**Existing ticket_asset_links table** (`backend/app/models/assets.py`, lines 50-56):
```python
ticket_asset_links = Table(
    "ticket_asset_links",
    Base.metadata,
    Column("ticket_id", UUID, ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", UUID, ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
    Column("relation_type", String, nullable=False, default="affected")
)
```

**Existing TicketAssetRelationType Enum:**
```python
class TicketAssetRelationType(str, enum.Enum):
    AFFECTED = "affected"      # Asset affected by the issue
    REPAIRED = "repaired"      # Asset was repaired
    REPLACED = "replaced"      # Asset was replaced
    MENTIONED = "mentioned"    # Asset mentioned in ticket
```

### 2.2 Proposed Changes

**Status:** ✅ **No database changes needed!**

The junction table already exists and has everything needed:
- Many-to-many relationship
- Relation type classification
- Proper cascade delete

**What's missing:**
- SQLAlchemy relationship in Ticket model
- API endpoints
- UI implementation

**Update Ticket Model** (add relationship):
```python
# In backend/app/models/tickets.py
class Ticket(Base, TimestampMixin):
    # ... existing fields ...

    # Add this relationship:
    linked_assets = relationship(
        "Asset",
        secondary="ticket_asset_links",
        backref="linked_tickets"
    )
```

---

## Part 3: API Endpoints Design

### 3.1 Work Log / Activities Endpoints

**Base path:** `/api/v1/tickets/{ticket_id}/activities`

#### **GET** `/api/v1/tickets/{ticket_id}/activities`
Get all activities for a ticket

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "work_type": "phone_call",
      "description": "Called client to confirm issue details",
      "start_at": "2024-01-15T14:30:00Z",
      "end_at": "2024-01-15T14:45:00Z",
      "duration_minutes": 15,
      "included_in_service": true,
      "billing_note": null,
      "actor_type": "internal_user",
      "actor_id": "uuid",
      "actor_display": "John Technician",
      "created_at": "2024-01-15T14:46:00Z"
    },
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "work_type": "onsite_visit",
      "description": "Replaced faulty camera",
      "start_at": null,
      "end_at": null,
      "duration_minutes": 120,
      "included_in_service": false,
      "billing_note": "Travel time included",
      "actor_type": "internal_user",
      "actor_id": "uuid",
      "actor_display": "Jane Technician",
      "created_at": "2024-01-15T16:00:00Z"
    }
  ]
}
```

#### **POST** `/api/v1/tickets/{ticket_id}/activities`
Create new activity

**Request Body (Mode A - Time Range):**
```json
{
  "work_type": "phone_call",
  "description": "Discussed issue with client",
  "start_at": "2024-01-15T14:30:00Z",
  "end_at": "2024-01-15T14:45:00Z",
  "included_in_service": true,
  "billing_note": null
}
```

**Request Body (Mode B - Duration):**
```json
{
  "work_type": "onsite_visit",
  "description": "Repaired network switch",
  "duration_minutes": 90,
  "included_in_service": false,
  "billing_note": "2 hours billable"
}
```

**Response:** 201 Created with activity object

#### **PATCH** `/api/v1/activities/{activity_id}`
Update activity (partial update)

**Request Body:**
```json
{
  "description": "Updated description",
  "included_in_service": false
}
```

**Response:** 200 OK with updated activity

#### **DELETE** `/api/v1/activities/{activity_id}`
Delete activity

**Response:** 204 No Content

---

### 3.2 Ticket-Asset Linking Endpoints

**Base path:** `/api/v1/tickets/{ticket_id}/assets`

#### **GET** `/api/v1/tickets/{ticket_id}/assets`
Get all assets linked to a ticket

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "label": "Main Entrance Camera",
      "asset_type": {
        "code": "CAMERA",
        "name_he": "מצלמה",
        "name_en": "Camera"
      },
      "manufacturer": "Hikvision",
      "model": "DS-2CD2345",
      "serial_number": "ABC123456",
      "status": "active",
      "relation_type": "affected"
    }
  ]
}
```

#### **POST** `/api/v1/tickets/{ticket_id}/assets`
Link asset to ticket

**Request Body:**
```json
{
  "asset_id": "uuid",
  "relation_type": "affected"  // optional, defaults to "affected"
}
```

**Validation:**
- Asset must belong to same client as ticket
- Asset cannot be linked twice to same ticket (unique constraint)

**Response:** 201 Created

#### **DELETE** `/api/v1/tickets/{ticket_id}/assets/{asset_id}`
Unlink asset from ticket

**Response:** 204 No Content

#### **GET** `/api/v1/assets/{asset_id}/tickets`
Get all tickets linked to an asset (historical view)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "ticket_number": "TKT-2024001",
      "title": "Camera offline",
      "status_code": "closed",
      "priority": "high",
      "relation_type": "repaired",
      "created_at": "2024-01-15T10:00:00Z",
      "closed_at": "2024-01-15T16:00:00Z"
    }
  ]
}
```

---

## Part 4: UI/UX Flow

### 4.1 Ticket Details Page Updates

**Current Structure:**
```
Tabs:
- Details
- Events
- Work Logs  ← ALREADY EXISTS
- Line Items
```

**Proposed Update:**
```
Tabs:
- Details
- פעולות (Activities)  ← Rename from "Work Logs", keep same functionality
- אירועים (Events)
- פריטים (Line Items)
- ציוד קשור (Linked Equipment)  ← NEW TAB
```

### 4.2 Activities Tab (פעולות)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ פעולות (Activities)            [+ הוסף פעולה]    │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌──────────────────────────────────────────────┐  │
│ │ 🕐 15/01/2024 14:30 - 14:45 (15 דקות)        │  │
│ │ 📞 Phone Call                                 │  │
│ │ Discussed issue with client                   │  │
│ │ by: John Technician                           │  │
│ │ כלול בשירות ✓                                │  │
│ └──────────────────────────────────────────────┘  │
│                                                      │
│ ┌──────────────────────────────────────────────┐  │
│ │ 📅 15/01/2024 (120 דקות)                     │  │
│ │ 🔧 On-site Visit                              │  │
│ │ Replaced faulty camera                        │  │
│ │ by: Jane Technician                           │  │
│ │ בחיוב ✓                                       │  │
│ └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Activity Icons:**
- 📞 Phone Call
- 📧 Email
- 💬 WhatsApp
- 🔧 On-site Visit
- 💻 Remote Work
- 🚗 Travel
- 🔨 Repair (Lab)
- 📋 Admin
- 📝 Other

### 4.3 Add Activity Dialog

**Form Fields:**

**Section 1: Activity Details**
- **Activity Type** (dropdown, required)
  - תשובה טלפונית (Phone Call)
  - אימייל (Email)
  - WhatsApp
  - ביקור באתר (On-site Visit)
  - עבודה מרחוק (Remote Work)
  - נסיעה (Travel)
  - תיקון במעבדה (Repair Lab)
  - אחר (Other)

**Section 2: Time Tracking** (radio buttons)
- ⭕ **From-To (Time Range)**
  - Start Date & Time (datetime picker)
  - End Date & Time (datetime picker)
  - Duration: *[auto-calculated]* דקות

- ⭕ **Duration Only**
  - Date (date picker)
  - Duration (number input) דקות

**Section 3: Details**
- **Description** (textarea, optional but recommended)
  - Placeholder: "תיאור הפעולה שבוצעה..."

**Section 4: Billing**
- ☑ **Included in Service** (checkbox)
- **Billing Note** (text input, optional)
  - Placeholder: "הערות לחיוב..."

**Buttons:**
- [ביטול] [שמור]

**Validation:**
- If Time Range selected: start_at and end_at required, end_at > start_at
- If Duration selected: duration_minutes required, must be > 0
- Description recommended but not required

### 4.4 Linked Equipment Tab (ציוד קשור)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ ציוד קשור (Linked Equipment)    [+ קשר ציוד]     │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌──────────────────────────────────────────────┐  │
│ │ 📷 Main Entrance Camera                       │  │
│ │ Type: Camera | Model: Hikvision DS-2CD2345   │  │
│ │ Serial: ABC123456                              │  │
│ │ Relation: נפגע (Affected)                     │  │
│ │                                     [🗑️ Remove] │  │
│ └──────────────────────────────────────────────┘  │
│                                                      │
│ ┌──────────────────────────────────────────────┐  │
│ │ 📹 NVR-001                                    │  │
│ │ Type: NVR | Model: Dahua DHI-NVR4216         │  │
│ │ Serial: XYZ789012                              │  │
│ │ Relation: תוקן (Repaired)                     │  │
│ │                                     [🗑️ Remove] │  │
│ └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 4.5 Link Equipment Dialog

**Form:**
- **Equipment** (autocomplete/searchable dropdown, required)
  - Filters: Only assets belonging to ticket's client
  - Shows: Label, Type, Model, Serial Number
  - Searchable by any field

- **Relation Type** (dropdown, optional, defaults to "Affected")
  - נפגע (Affected)
  - תוקן (Repaired)
  - הוחלף (Replaced)
  - הוזכר (Mentioned)

**Buttons:**
- [ביטול] [קשר]

---

## Part 5: Dependencies & Existing Models

### 5.1 Dependencies

**Database Models:**
- ✅ `Ticket` (exists)
- ✅ `WorkLog` (exists, needs enum extension)
- ✅ `ticket_asset_links` (exists)
- ✅ `Asset` (exists)
- ⚠️ Need to add relationship to Ticket model

**Schemas (Pydantic):**
- ⚠️ `WorkLogCreate` (needs creation)
- ⚠️ `WorkLogUpdate` (needs creation)
- ⚠️ `WorkLogResponse` (needs creation)
- ⚠️ `TicketAssetLinkCreate` (needs creation)
- ⚠️ `AssetResponse` (might exist, verify)

**API Endpoints:**
- ❌ Work log CRUD (missing or incomplete)
- ❌ Ticket-asset linking (missing)

**Frontend Components:**
- ⚠️ `WorkLogForm` (exists in TicketDetails.tsx, line 402)
- ⚠️ Activities list in TicketDetails (exists as work_logs tab)
- ❌ Equipment linking UI (missing)

### 5.2 Existing Code to Update

**Backend:**
1. `backend/app/models/time_billing.py`
   - Extend `WorkType` enum

2. `backend/app/models/tickets.py`
   - Add `linked_assets` relationship

3. `backend/app/schemas/` (create new file)
   - Create `work_logs.py` with schemas
   - Create `ticket_assets.py` with schemas

4. `backend/app/api/` (create new endpoints)
   - Extend `tickets.py` or create `work_logs.py`
   - Create `ticket_assets.py`

**Frontend:**
1. `frontend/src/components/Tickets/TicketDetails.tsx`
   - Rename "Work Logs" tab to "Activities"
   - Add "Linked Equipment" tab

2. `frontend/src/components/Tickets/WorkLogForm.tsx`
   - Update to support new activity types
   - Add time mode selector UI

3. `frontend/src/components/Tickets/` (create new)
   - Create `EquipmentLinkForm.tsx`
   - Create `LinkedEquipmentList.tsx`

4. `frontend/src/i18n/he.json` & `en.json`
   - Add activity type labels
   - Add equipment linking labels

---

## Part 6: Migration Path

### 6.1 Database Migrations

**Migration 1: Update WorkType values**
```sql
-- Rename existing work_type values
UPDATE work_logs SET work_type = 'phone_call' WHERE work_type = 'phone';
UPDATE work_logs SET work_type = 'remote_work' WHERE work_type = 'remote';
UPDATE work_logs SET work_type = 'onsite_visit' WHERE work_type = 'onsite';
```

**No other migrations needed** - all tables already exist!

### 6.2 Implementation Order

**Phase 1: Backend Foundation** (Day 1)
1. Extend `WorkType` enum
2. Create migration for work_type value updates
3. Create work log schemas (WorkLogCreate, WorkLogUpdate, WorkLogResponse)
4. Add validation logic for time tracking modes
5. Add `linked_assets` relationship to Ticket model

**Phase 2: Backend API** (Day 2)
1. Create work log CRUD endpoints
2. Create ticket-asset linking endpoints
3. Add validation (asset belongs to client)
4. Test all endpoints

**Phase 3: Frontend Activities** (Day 3)
1. Update WorkLogForm with new activity types
2. Add time mode selector (From-To vs Duration)
3. Update activities list display
4. Add activity type icons

**Phase 4: Frontend Equipment** (Day 4)
1. Create EquipmentLinkForm component
2. Create LinkedEquipmentList component
3. Add "Linked Equipment" tab to TicketDetails
4. Add remove/unlink functionality

**Phase 5: Translations & Polish** (Day 5)
1. Add all Hebrew/English labels
2. Test RTL layout
3. Add loading states
4. Add error handling

---

## Part 7: Open Questions / Decisions Needed

### Q1: Activity vs Work Log naming
**Question:** Should we rename "WorkLog" to "TicketActivity" in the code?

**Options:**
- A) Keep `WorkLog` model name, use "Activities" in UI only
- B) Rename model to `TicketActivity` (requires migration)

**Recommendation:** Option A - keep backend as-is, use friendly name in UI

### Q2: Can activities be edited after creation?
**Question:** Should users be able to edit/delete activities?

**Options:**
- A) Allow edit/delete (like we allow for work logs)
- B) Immutable audit trail (can only add, not modify)

**Recommendation:** Option A - allow edit for flexibility, keep audit via `updated_at`

### Q3: Activity date vs created_at
**Question:** Should we add an explicit `activity_date` field separate from `created_at`?

**Context:**
- `created_at` = when the record was created in the system
- User might log an activity retroactively (activity happened yesterday, logged today)

**Options:**
- A) Add `activity_date` field (when activity actually happened)
- B) Use `start_at` or `created_at` as activity date

**Recommendation:** Option B - use `start_at` for Mode A, `created_at` for Mode B (simpler)

### Q4: Equipment relation type - editable?
**Question:** Should users be able to change relation type after linking?

**Options:**
- A) Allow changing relation type via PATCH
- B) Require unlink + relink to change type

**Recommendation:** Option A - add PATCH endpoint for updating relation_type

---

## Part 8: Summary & Next Steps

### What Already Exists ✅
- WorkLog model with time tracking
- ticket_asset_links junction table
- Basic relationships

### What Needs Building 🔨
- [ ] Extend WorkType enum (communication types)
- [ ] Time tracking validation logic
- [ ] API endpoints (work logs CRUD, asset linking)
- [ ] Frontend activity UI enhancements
- [ ] Frontend equipment linking UI
- [ ] Translations

### Estimated Effort
- Backend: **2 days** (schemas, endpoints, validation)
- Frontend: **2-3 days** (forms, lists, tabs)
- Testing & Polish: **1 day**
- **Total: ~1 week**

### Risk Assessment
- **Low Risk** - Most DB structure exists
- **No breaking changes** - Pure additions
- **Backward compatible** - Existing work logs remain valid

---

## Approval Checklist

Before proceeding to implementation, please confirm:

- [ ] DB schema changes approved (enum extension + relationship)
- [ ] API endpoint design approved
- [ ] UI flow approved
- [ ] Naming conventions approved (Activities vs Work Logs)
- [ ] Decisions on open questions (Q1-Q4) finalized
- [ ] Implementation order approved

**Ready to proceed?** Reply with approval or requested changes.
