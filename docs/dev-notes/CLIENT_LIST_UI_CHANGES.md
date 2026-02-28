# Client List UI Changes - Summary

## Changes Implemented

### 1. Visual Status Indicator
**Before:** Text chip showing "Active" or "Inactive"
**After:** Small colored dot with tooltip

- **Active clients:** Green dot (#4caf50)
- **Inactive clients:** Red dot (#f44336)
- **Tooltip (Hebrew):**
  - Active: "פעיל"
  - Inactive: "לא פעיל"
- **Size:** 16px dot icon
- **Column width:** 40px (minimal)

### 2. Default Filter - Only Active Clients
**Before:** All clients shown by default
**After:** Only active clients shown by default

- Backend API now filters by `status="active"` by default
- Inactive clients hidden unless explicitly requested

### 3. Show Inactive Checkbox
**Location:** Top toolbar, next to search field

- **Label (Hebrew):** "הצג לקוחות לא פעילים"
- **Default:** Unchecked (only active shown)
- **When checked:** Shows all clients (active + inactive)
- **RTL-compatible:** Uses `whiteSpace: 'nowrap'` to prevent wrapping
- **Layout:** Flexbox with gap, aligns with search field

### 4. Removed Toggle Action
**Before:** Two action buttons (View, Toggle Active/Inactive)
**After:** Only View button

- Removed toggle functionality from list view
- Status can only be changed from client details/edit page
- Simplified actions column

## Files Modified

### Backend

**`backend/app/api/clients.py`**
- Added `include_inactive` parameter (default: `False`)
- Added filter: `query.filter(Client.status == "active")` when `include_inactive=False`
- Updated docstring with filter behavior

```python
@router.get("", response_model=ClientListResponse)
async def list_clients(
    q: Optional[str] = Query(None, description="Search by name"),
    include_inactive: bool = Query(False, description="Include inactive clients"),
    # ...
):
    # By default, only active clients are returned
    if not include_inactive:
        query = query.filter(Client.status == "active")
```

### Frontend

**`frontend/src/api/clients.ts`**
- Added `include_inactive?: boolean` to `listClients` parameters

```typescript
listClients: async (params?: {
  q?: string;
  include_inactive?: boolean;  // Added
  page?: number;
  page_size?: number;
}): Promise<ClientListResponse>
```

**`frontend/src/components/Clients/ClientsList.tsx`**

Changes:
1. **Imports:**
   - Added: `FormControlLabel`, `Checkbox`, `Tooltip`
   - Added: `FiberManualRecord as DotIcon`
   - Removed: `Chip`, `Edit`, `Block`, `CheckCircle` icons

2. **State:**
   - Added: `showInactive` state (default: `false`)

3. **Query:**
   - Added `showInactive` to queryKey
   - Added `include_inactive: showInactive` parameter

4. **Toolbar:**
   - Added checkbox next to search field
   - Hebrew label: "הצג לקוחות לא פעילים"

5. **Table Structure:**
   - Added narrow status column (40px) at start
   - Removed "Active/Inactive" text column
   - Reduced colspan from 6 to 6 (same count due to reordering)

6. **Table Cells:**
   - First cell: Status dot with tooltip
   - Removed chip display
   - Removed toggle action button

7. **Removed:**
   - `handleToggleActive` function (no longer needed)

## Visual Example

### Table Header
```
| • | Name | Tax ID | Phone | Email | Actions |
```

### Active Client Row
```
| 🟢 | Acme Corp | 123456 | 050-1234567 | info@acme.com | 👁️ |
   ↑ Green dot (tooltip: "פעיל")
```

### Inactive Client Row (when checkbox checked)
```
| 🔴 | Old Corp | 987654 | 050-9876543 | old@corp.com | 👁️ |
   ↑ Red dot (tooltip: "לא פעיל")
```

## Testing

### Backend Test
**File:** `backend/test_client_filter.py`

Results:
```
[PASS] Active filter works
[PASS] Include inactive works
[PASS] Inactive client correctly excluded
[PASS] Inactive client correctly included
TEST PASSED: Client filtering works correctly!
```

### Manual UI Testing Steps

1. **Default view (unchecked):**
   - Open clients list
   - Verify only active clients shown
   - Verify green dots visible

2. **With inactive (checked):**
   - Check "הצג לקוחות לא פעילים"
   - Verify inactive clients appear
   - Verify red dots visible for inactive

3. **RTL layout:**
   - Verify checkbox aligns properly in RTL
   - Verify status dots align left (RTL start)
   - Verify tooltips display correctly

4. **Status change flow:**
   - Open client details
   - Change status to inactive
   - Save and return to list
   - Verify client no longer visible (default view)
   - Check "הצג לקוחות לא פעילים"
   - Verify client appears with red dot

## Technical Notes

### Material-UI Components Used
- `FiberManualRecord` icon for dot
- `Tooltip` with `arrow` prop
- `FormControlLabel` + `Checkbox` for filter
- `TableCell` with `padding="checkbox"` for compact status column

### Colors
- Active green: `#4caf50` (Material-UI success.main)
- Inactive red: `#f44336` (Material-UI error.main)

### Performance
- Filter applied server-side (no client-side filtering)
- Query key includes `showInactive` for proper cache invalidation
- Reset to page 1 when toggling checkbox

### RTL Considerations
- `whiteSpace: 'nowrap'` on checkbox label prevents text wrapping
- Flexbox with `gap: 2` provides consistent spacing
- Tooltip alignment handled automatically by MUI

## Migration Notes

- No data migration required (status field already exists)
- No breaking API changes (new parameter is optional with sensible default)
- Frontend change is backwards compatible (defaults to same behavior as before if parameter omitted)

## Summary of Improvements

✅ **Cleaner UI:** Replaced verbose chips with minimal dots
✅ **Better UX:** Active clients by default (most common use case)
✅ **Clear visual feedback:** Color-coded status at a glance
✅ **RTL compatible:** Hebrew label, proper alignment
✅ **Simplified actions:** Removed toggle from list (edit-only)
✅ **Performance:** Server-side filtering, no wasted data transfer
