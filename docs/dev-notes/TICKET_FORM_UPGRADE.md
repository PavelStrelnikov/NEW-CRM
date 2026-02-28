# Ticket Create/Edit Form Upgrade - Implementation Summary

## Changes Implemented

### 1. Backend - Updated Ticket Model & Validation

**File: `backend/app/models/tickets.py`**
- Updated `ReportedVia` enum to include only: phone, whatsapp, email, other
- Removed: portal, telegram (obsolete values)

```python
class ReportedVia(str, enum.Enum):
    """How customer reported the issue (contact channel)."""
    PHONE = "phone"
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    OTHER = "other"
```

**File: `backend/app/schemas/tickets.py`**
- Made `reported_via` required (was optional)
- Made `contact_person_id` required in `TicketCreate` (was optional)
- Added field description for `reported_via`

```python
class TicketBase(BaseModel):
    """Base ticket fields."""
    # ... other fields
    reported_via: str = Field(..., description="Contact channel: phone, whatsapp, email, other")
    # ...

class TicketCreate(TicketBase):
    """Schema for creating a ticket."""
    client_id: UUID
    site_id: UUID
    contact_person_id: UUID  # Now required
```

**File: `backend/app/api/tickets.py`**
- Updated validation to require `contact_person_id`
- Added validation for `reported_via` field with whitelist
- Removed check for "either contact_person_id or contact_name" (contact_person_id now required)

```python
# Validate contact_person_id belongs to client
contact = db.query(Contact).filter(
    Contact.id == ticket_data.contact_person_id,
    Contact.client_id == ticket_data.client_id
).first()
if not contact:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Contact not found or does not belong to this client"
    )

# Validate reported_via (contact channel)
valid_channels = {"phone", "whatsapp", "email", "other"}
if ticket_data.reported_via not in valid_channels:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid reported_via value. Must be one of: {', '.join(valid_channels)}"
    )
```

### 2. Frontend - New Ticket Form Component

**File: `frontend/src/components/Tickets/TicketForm.tsx`** (NEW)

Created comprehensive ticket creation/editing form with:

**Features:**
- **Client Selection** (Autocomplete, required)
  - Fetches clients sorted by name
  - Shows up to 100 clients

- **Branch/Site Selection** (Autocomplete, required)
  - Disabled until client selected
  - Fetches sites for selected client
  - Automatically clears when client changes

- **Contact Person Selection** (Autocomplete, required)
  - Disabled until client selected
  - Fetches contacts for selected client
  - Filters by selected site:
    - Shows contacts with `applies_to_all_sites=true`
    - Shows contacts linked to specific site
  - Auto-fills contact phone/email when contact selected
  - Automatically clears when client or site changes

- **Channel Selection** (Dropdown, required)
  - Default: "טלפון" (phone)
  - Options:
    - טלפון (phone)
    - WhatsApp (whatsapp)
    - אימייל (email)
    - אחר (other)

- **Other Fields:**
  - Title (required)
  - Description (required, multiline)
  - Category (optional)
  - Priority (dropdown: low, normal, high, urgent)
  - Contact Phone (required, auto-filled from selected contact)
  - Contact Name (optional override)
  - Contact Email (optional)

**Validation:**
- All required fields enforced before submit
- Clear error messages in Hebrew
- Form resets on successful creation
- Loading states during submission

**State Management:**
```typescript
const [selectedClient, setSelectedClient] = useState<Client | null>(null);
const [selectedSite, setSelectedSite] = useState<Site | null>(null);
const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

// Changing client resets site and contact
const handleClientChange = (client: Client | null) => {
  setSelectedClient(client);
  setSelectedSite(null);
  setSelectedContact(null);
  setFormData((prev) => ({
    ...prev,
    client_id: client?.id,
    site_id: undefined,
    contact_person_id: undefined,
  }));
};

// Changing site refilters contacts and clears selection
const handleSiteChange = (site: Site | null) => {
  setSelectedSite(site);
  setSelectedContact(null);
  setFormData((prev) => ({
    ...prev,
    site_id: site?.id,
    contact_person_id: undefined,
  }));
};
```

**Contact Filtering Logic:**
```typescript
const filteredContacts = React.useMemo(() => {
  if (!contacts?.items) return [];
  if (!selectedSite) return contacts.items;

  return contacts.items.filter(
    (contact) =>
      contact.applies_to_all_sites || contact.site_ids.includes(selectedSite.id)
  );
}, [contacts, selectedSite]);
```

### 3. Frontend - Updated Tickets List

**File: `frontend/src/components/Tickets/TicketsList.tsx`**

Changes:
- Added "Create Ticket" button in header
- Added `TicketForm` dialog
- Added `refetch` callback to refresh list after ticket creation
- Maintained existing filter/search functionality

```typescript
<Button
  variant="contained"
  onClick={() => setIsCreateDialogOpen(true)}
>
  {t('tickets.createTicket')}
</Button>

<TicketForm
  open={isCreateDialogOpen}
  onClose={() => setIsCreateDialogOpen(false)}
  onSuccess={() => {
    setIsCreateDialogOpen(false);
    refetch();
  }}
/>
```

### 4. Frontend - Updated API & Types

**File: `frontend/src/api/tickets.ts`**
- Added `updateTicket` method for future edit functionality

```typescript
updateTicket: async (id: string, data: any): Promise<Ticket> => {
  const response = await apiClient.patch<Ticket>(`/tickets/${id}`, data);
  return response.data;
},
```

**File: `frontend/src/types/index.ts`**
- Made `reported_via` required in `TicketCreate`
- Made `contact_person_id` required in `TicketCreate`

```typescript
export interface TicketCreate {
  client_id: string;
  site_id: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  source_channel: string;
  reported_via: string;  // Required (was optional)
  service_scope?: string;
  contact_phone: string;
  contact_person_id: string;  // Required (was optional)
  contact_name?: string;
  contact_email?: string;
}
```

## Existing Endpoints Used

### Backend Endpoints (Already Existed)
- `GET /clients/{client_id}/sites` - List sites for client
- `GET /clients/{client_id}/contacts` - List contacts for client (with site_ids)
- `POST /tickets` - Create ticket (updated validation)

### Contact Filtering Logic
Contacts have two modes:
1. **applies_to_all_sites = true** - Contact available for all sites
2. **applies_to_all_sites = false** - Contact linked to specific sites (stored in `contact_site_links`)

Frontend filters contacts based on:
- If no site selected: show all contacts for client
- If site selected: show contacts with `applies_to_all_sites=true` OR `site_id` in contact's `site_ids` array

## Data Flow

### Creating a Ticket
1. User clicks "Create Ticket" button
2. Form opens with:
   - Channel defaulted to "phone"
   - All other fields empty
3. User selects Client → sites load
4. User selects Site → contacts filter to that site
5. User selects Contact → contact phone/email auto-filled
6. User selects Channel from dropdown
7. User fills title, description, other fields
8. User submits
9. Frontend validates required fields
10. Backend validates:
    - Client exists
    - Site belongs to client
    - Contact belongs to client
    - Channel is valid (phone/whatsapp/email/other)
11. Ticket created with default status
12. Ticket initiator record created
13. Ticket event "created" logged
14. Form closes, list refreshes

### Field Dependencies
```
Client (required)
  └─> Site (required, filtered by client)
       └─> Contact (required, filtered by client + site)
            └─> Contact Phone (auto-filled, editable)
            └─> Contact Email (auto-filled, editable)
            └─> Contact Name (auto-filled, editable)

Channel (required, independent, default: phone)
```

## Validation Rules

### Backend Validation
- `client_id`: Must exist in database
- `site_id`: Must exist and belong to `client_id`
- `contact_person_id`: Must exist and belong to `client_id`
- `reported_via`: Must be one of: phone, whatsapp, email, other
- `title`: Required, max 255 chars
- `description`: Required
- `contact_phone`: Required
- `source_channel`: Required (auto-set to "manual")

### Frontend Validation
- Client: Required (enforced by form)
- Site: Required (enforced by form)
- Contact Person: Required (enforced by form)
- Channel: Required (enforced by form, default: phone)
- Title: Required (enforced by TextField)
- Description: Required (enforced by TextField)
- Contact Phone: Required (enforced by TextField)

### Error Messages (Hebrew)
- `t('tickets.clientRequired')` - "יש לבחור לקוח"
- `t('tickets.siteRequired')` - "יש לבחור סניף"
- `t('tickets.contactRequired')` - "יש לבחור איש קשר"
- `t('tickets.channelRequired')` - "יש לבחור ערוץ יצירת קשר"

## UI/UX Features

### RTL Compatibility
- All fields properly aligned for RTL (Hebrew)
- Autocomplete dropdowns work correctly in RTL
- Form labels and placeholders in Hebrew

### User Experience
- **Cascading Dropdowns**: Changing client resets dependent fields
- **Auto-fill**: Contact selection auto-fills phone/email
- **Smart Filtering**: Contacts filter by site automatically
- **Loading States**: Shows spinner during API calls
- **Error Handling**: Clear error messages on validation failure
- **Success Feedback**: Toast notification on successful creation
- **Form Reset**: Form clears after successful submission

### Default Values
- Channel: "טלפון" (phone)
- Priority: "normal"
- Source Channel: "manual"
- Service Scope: "not_included"

## Testing Checklist

### Backend Testing
- [x] Backend imports work
- [ ] Create ticket with valid data → success
- [ ] Create ticket with invalid client_id → 404 error
- [ ] Create ticket with invalid site_id → 404 error
- [ ] Create ticket with site not belonging to client → 404 error
- [ ] Create ticket with invalid contact_id → 404 error
- [ ] Create ticket with contact not belonging to client → 404 error
- [ ] Create ticket with invalid channel → 400 error
- [ ] Create ticket with missing required fields → 422 error

### Frontend Testing
- [ ] Open create dialog → form appears
- [ ] Select client → sites populate
- [ ] Change client → sites and contacts reset
- [ ] Select site → contacts filter correctly
- [ ] Change site → contact resets
- [ ] Select contact → phone/email auto-fill
- [ ] Select channel → dropdown works
- [ ] Submit without client → error message
- [ ] Submit without site → error message
- [ ] Submit without contact → error message
- [ ] Submit with all required fields → ticket created
- [ ] Form closes → ticket appears in list
- [ ] Channel defaults to "phone"

### Contact Filtering Testing
- [ ] Contact with applies_to_all_sites=true → visible for all sites
- [ ] Contact with site_ids=[site1] → visible only for site1
- [ ] Contact with site_ids=[site1, site2] → visible for both
- [ ] No site selected → all contacts visible
- [ ] Site selected → only relevant contacts visible

## Migration Notes

### Database Changes
- **None** - All existing columns used
- `reported_via` column already exists (changed from optional to required)
- `contact_person_id` column already exists (changed from optional to required)

### Breaking Changes
- **Backend API**: `reported_via` now required (was optional)
  - Impact: Old API clients must provide `reported_via`
  - Migration: Update all API clients to include channel
- **Backend API**: `contact_person_id` now required (was optional)
  - Impact: Can no longer create tickets with just `contact_name`
  - Migration: Ensure all ticket creation flows select from contact list

### Backward Compatibility
- Existing tickets with `reported_via=null` still valid (database allows null)
- Existing tickets with `contact_person_id=null` still valid (database allows null)
- New tickets must have both fields populated

## Summary

✅ **Required Fields Enforced**: Client, Site, Contact, Channel all required
✅ **Cascading Dropdowns**: Dependent fields reset when parent changes
✅ **Smart Contact Filtering**: By client and optionally by site
✅ **Channel Selection**: Phone/WhatsApp/Email/Other with default
✅ **Auto-fill**: Contact details populated from selected contact
✅ **RTL Compatible**: Hebrew labels, proper text direction
✅ **Validation**: Backend + frontend validation with clear errors
✅ **User Feedback**: Toast notifications, loading states
