# Feature: Ticket Form Cleanup + Callback Contact

## Summary

Cleaned up the ticket create/edit form by removing duplicate fields and added a separate "callback contact" field to distinguish between who opened the ticket and who to call back.

## Changes Implemented

### Backend Changes

#### 1. Database Schema (Migration: 20260112_212835)

**Added:**
- `callback_contact_id` (UUID, nullable) - Foreign key to contacts table
- Relationship: `callback_contact` to Contact model

**Removed:**
- `contact_name` (VARCHAR) - Duplicate field
- `contact_email` (VARCHAR) - Duplicate field

**Migration Logic:**
- Sets `callback_contact_id = contact_person_id` for existing tickets (defaults to opener)
- Creates foreign key constraint to contacts table

#### 2. Model Updates (backend/app/models/tickets.py)

```python
# Contact information
contact_person_id = Column(UUID, ForeignKey("contacts.id"), nullable=True)  # Who opened
callback_contact_id = Column(UUID, ForeignKey("contacts.id"), nullable=True)  # Who to call back
contact_phone = Column(String, nullable=False)  # Phone for callback
```

**Removed:** contact_name, contact_email columns

#### 3. Schema Updates (backend/app/schemas/tickets.py)

**TicketBase:**
- Removed: `contact_name`, `contact_email`
- Kept: `contact_phone` (required for callbacks)

**TicketCreate:**
- Added: `callback_contact_id: Optional[UUID]` (defaults to opener if not provided)
- Kept: `contact_person_id: UUID` (required - who opened the ticket)

**TicketUpdate:**
- Added: `callback_contact_id: Optional[UUID]`
- Removed: `contact_name`, `contact_email`

**TicketResponse:**
- Added: `callback_contact_id: Optional[UUID]`

#### 4. API Validation (backend/app/api/tickets.py)

**Added validation in create_ticket:**
```python
# Validate callback_contact_id (optional, defaults to contact_person_id)
if ticket_data.callback_contact_id:
    callback_contact = db.query(Contact).filter(
        Contact.id == ticket_data.callback_contact_id,
        Contact.client_id == ticket_data.client_id
    ).first()
    if not callback_contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Callback contact not found or does not belong to this client"
        )
else:
    # Default callback contact to opener contact
    ticket_data.callback_contact_id = ticket_data.contact_person_id
```

### Frontend Changes

#### 1. Translations

**Hebrew (frontend/src/i18n/he.json):**
```json
"callbackContact": "למי לחזור",
"sameAsOpener": "כמו איש הקשר שפתח",
"ticketOpeningDetails": "פרטי פתיחת טיקט",
"problemDetails": "פרטי התקלה"
```

**English (frontend/src/i18n/en.json):**
```json
"callbackContact": "Call Back To",
"sameAsOpener": "Same as opener",
"ticketOpeningDetails": "Ticket Opening Details",
"problemDetails": "Problem Details"
```

#### 2. Form Structure (frontend/src/components/Tickets/TicketForm.tsx)

**Removed duplicate fields:**
- Contact Name input (was duplicating selected contact's name)
- Contact Email input (was duplicating selected contact's email)

**Added callback contact selector:**
- Checkbox: "Same as opener" (default: checked)
- When unchecked: Shows dropdown to select different callback contact
- Filtered by same client/branch as opener contact
- Shows contact info (phone/email) as read-only text below selector

**Form sections:**
1. **Section A: Ticket Opening Details** (פרטי פתיחת טיקט)
   - Client (required)
   - Branch/Site (required)
   - Contact Person - opener (required)
   - Callback Contact (optional, defaults to opener)
   - Channel (required)
   - Contact Phone (required)

2. **Section B: Problem Details** (פרטי התקלה)
   - Title (required)
   - Description (required)
   - Category (optional)
   - Priority (default: normal)

**Read-only contact info display:**
- Shows phone and email below contact selector
- Format: "Phone: 050-1234567 • Email: contact@example.com"
- Only displayed when contact is selected

#### 3. TypeScript Types (frontend/src/types/index.ts)

**Ticket interface:**
- Added: `callback_contact_id?: string`
- Removed: `contact_name?: string`
- Kept: `contact_person_id?: string`

**TicketCreate interface:**
- Added: `callback_contact_id?: string`
- Removed: `contact_name`, `contact_email`

#### 4. Ticket Details View (frontend/src/components/Tickets/TicketDetails.tsx)

**Updated to show:**
- Contact Person (opener) - displays ID
- Callback Contact - displays ID
- Contact Phone

**Removed:**
- Contact Name display (field no longer exists)

## Data Flow

### Creating a Ticket

1. **User selects:**
   - Client → Branch → Contact Person (opener)
   - "Same as opener" checkbox (default: checked)
   - If unchecked: Select different callback contact
   - Channel (phone/whatsapp/email/other)
   - Contact Phone (auto-filled from selected contact)

2. **Backend receives:**
   ```json
   {
     "client_id": "uuid",
     "site_id": "uuid",
     "contact_person_id": "uuid",     // Who opened
     "callback_contact_id": "uuid",   // Who to call back (or null)
     "reported_via": "phone",
     "contact_phone": "050-1234567",
     "title": "Issue title",
     "description": "Issue description",
     // ... other fields
   }
   ```

3. **Backend logic:**
   - If `callback_contact_id` is null → sets it to `contact_person_id`
   - Validates both contacts belong to same client
   - Creates ticket with both IDs stored

### Behavior Examples

**Scenario 1: Same person (default)**
- User: Select "John (opener)", leave "Same as opener" checked
- Result: `contact_person_id = John`, `callback_contact_id = John`

**Scenario 2: Different person**
- User: Select "John (opener)", uncheck "Same as opener", select "Mary (callback)"
- Result: `contact_person_id = John`, `callback_contact_id = Mary`

## Migration Instructions

### 1. Run Database Migration

```bash
cd backend
alembic upgrade head
```

Or manually apply SQL:
```sql
-- Add callback_contact_id column
ALTER TABLE tickets ADD COLUMN callback_contact_id UUID;
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_callback_contact
  FOREIGN KEY (callback_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

-- Set callback to opener for existing tickets
UPDATE tickets SET callback_contact_id = contact_person_id
WHERE contact_person_id IS NOT NULL;

-- Remove duplicate fields
ALTER TABLE tickets DROP COLUMN contact_name;
ALTER TABLE tickets DROP COLUMN contact_email;
```

### 2. Restart Backend

```powershell
# Stop backend (Ctrl+C)
cd C:\Users\Pavel\DEV\Claude\New-CRM
.\scripts\run_backend.ps1
```

### 3. Restart Frontend (if running)

Frontend will automatically pick up changes.

## Verification Checklist

### Backend Verification

- [ ] Migration runs successfully
- [ ] `callback_contact_id` column exists in tickets table
- [ ] `contact_name` and `contact_email` columns removed
- [ ] POST /api/tickets accepts `callback_contact_id`
- [ ] If `callback_contact_id` not provided, defaults to `contact_person_id`
- [ ] Validation ensures callback contact belongs to same client

### Frontend Verification

#### Create Ticket Form

- [ ] Form has two sections with headings (Hebrew/English based on locale)
- [ ] Section A shows: Client, Branch, Contact Person, Callback, Channel, Phone
- [ ] Section B shows: Title, Description, Category, Priority
- [ ] Contact Person selector required
- [ ] "Same as opener" checkbox visible (default: checked)
- [ ] When checked: Callback selector hidden
- [ ] When unchecked: Callback selector visible
- [ ] Contact info shows read-only below selector (phone • email)
- [ ] No duplicate contact name/email input fields
- [ ] Contact phone auto-fills from selected contact
- [ ] Form submission works with "same as opener"
- [ ] Form submission works with different callback contact

#### Ticket Details View

- [ ] Shows Contact Person ID
- [ ] Shows Callback Contact ID
- [ ] Shows Contact Phone
- [ ] No errors from missing contact_name field

### Edge Cases

- [ ] Create ticket with same person → both IDs equal
- [ ] Create ticket with different callback → different IDs
- [ ] Change opener contact → callback updates if "same as opener" checked
- [ ] Change opener contact → callback unchanged if "same as opener" unchecked
- [ ] Branch filter applies to both opener and callback contact selectors
- [ ] Validation error if callback contact from different client

## Benefits

✅ **Cleaner Form** - Removed duplicate fields (contact name/email)
✅ **Clear Intent** - Separate "who opened" vs "who to call back"
✅ **Flexible** - Can callback different person than opener
✅ **Better UX** - Shows contact info read-only, no manual typing needed
✅ **Organized** - Form sections make it easier to scan
✅ **Data Integrity** - Backend validates both contacts belong to same client
✅ **Backward Compatible** - Existing tickets migrated (callback = opener)

## Files Modified

### Backend
1. `backend/app/models/tickets.py` - Added callback_contact_id, removed duplicate fields
2. `backend/app/schemas/tickets.py` - Updated schemas
3. `backend/app/api/tickets.py` - Added validation
4. `backend/alembic/versions/20260112_212835_add_callback_contact.py` - Migration (NEW)

### Frontend
5. `frontend/src/components/Tickets/TicketForm.tsx` - Complete rewrite with sections
6. `frontend/src/components/Tickets/TicketDetails.tsx` - Updated display
7. `frontend/src/types/index.ts` - Updated interfaces
8. `frontend/src/i18n/he.json` - Added translations
9. `frontend/src/i18n/en.json` - Added translations
