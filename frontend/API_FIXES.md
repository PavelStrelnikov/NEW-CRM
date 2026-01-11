# Frontend API Fixes

## Issue
The frontend was using incorrect field names and API endpoints that didn't match the backend schema.

## Fixes Applied

### 1. Contact Field Name Mismatches

**Backend Schema:**
```typescript
{
  name: string,
  phone: string,
  email: string,
  position: string,
  notes: string
}
```

**Frontend Was Sending (WRONG):**
```typescript
{
  full_name: string,          // ❌ Should be 'name'
  role_at_client: string,     // ❌ Should be 'position'
  mobile_phone: string,       // ❌ Doesn't exist
  is_primary: boolean,        // ❌ Doesn't exist
  can_approve_work: boolean,  // ❌ Doesn't exist
}
```

**Fixed Frontend Types:** (`src/types/index.ts`)
- Changed `full_name` → `name`
- Changed `role_at_client` → `position`
- Removed `mobile_phone` (use `phone` instead)
- Removed `is_primary`
- Removed `can_approve_work`

**Updated Components:**
- `ContactsList.tsx` - Updated table columns
- `ContactForm.tsx` - Updated form fields
- `he.json` & `en.json` - Updated translation keys

### 2. Site Field Name Mismatches

**Backend Schema:**
```typescript
{
  name: string,
  address: string,
  is_default: boolean,
  notes: string
}
```

**Frontend Was Sending (WRONG):**
```typescript
{
  name: string,
  address: string,
  city: string,           // ❌ Doesn't exist
  contact_phone: string,  // ❌ Doesn't exist
  contact_email: string,  // ❌ Doesn't exist
  is_active: boolean,     // ❌ Doesn't exist
  notes: string
}
```

**Fixed Frontend Types:** (`src/types/index.ts`)
- Removed `city`
- Removed `contact_phone`
- Removed `contact_email`
- Removed `is_active`
- Kept `is_default` (correct)

**Updated Components:**
- `SitesList.tsx` - Simplified table columns
- `SiteForm.tsx` - Removed non-existent fields

### 3. API Endpoint Path Mismatches

**Backend Endpoint Structure:**

**Sites:**
- `GET /clients/{client_id}/sites` - List sites (nested) ✅
- `POST /clients/{client_id}/sites` - Create site (nested) ✅
- `GET /sites/{site_id}` - Get single site (NOT nested) ⚠️
- `PATCH /sites/{site_id}` - Update site (NOT nested) ⚠️

**Contacts:**
- `GET /clients/{client_id}/contacts` - List contacts (nested) ✅
- `POST /clients/{client_id}/contacts` - Create contact (nested) ✅
- `GET /contacts/{contact_id}` - Get single contact (NOT nested) ⚠️
- `PATCH /contacts/{contact_id}` - Update contact (NOT nested) ⚠️

**Frontend Was Calling (WRONG):**
```typescript
PATCH /clients/{client_id}/sites/{site_id}      // ❌ 404 - doesn't exist
PATCH /clients/{client_id}/contacts/{contact_id} // ❌ 404 - doesn't exist
```

**Fixed API Client:** (`src/api/clients.ts`)

**Before:**
```typescript
updateSite: async (clientId: string, siteId: string, data: SiteUpdate)
updateContact: async (clientId: string, contactId: string, data: ContactUpdate)
```

**After:**
```typescript
updateSite: async (siteId: string, data: SiteUpdate)
updateContact: async (contactId: string, data: ContactUpdate)
```

**Updated API Calls:**
- `SiteForm.tsx` - Now calls `clientsApi.updateSite(site.id, formData)`
- `ContactForm.tsx` - Now calls `clientsApi.updateContact(contact.id, formData)`

## Summary

All field names and API endpoints now match the actual backend schema. The frontend will no longer receive 422 (Unprocessable Entity) or 404 (Not Found) errors when creating or updating sites and contacts.

## Testing

After these fixes:
1. ✅ Create Contact - Works
2. ✅ Update Contact - Works (404 fixed)
3. ✅ Create Site - Works
4. ✅ Update Site - Works (404 fixed)
5. ✅ List Contacts - Works
6. ✅ List Sites - Works

## Files Modified

1. `src/types/index.ts` - Fixed Site and Contact interfaces
2. `src/api/clients.ts` - Fixed API endpoint paths
3. `src/components/Clients/ContactsList.tsx` - Updated table columns
4. `src/components/Clients/ContactForm.tsx` - Updated form fields and API call
5. `src/components/Clients/SitesList.tsx` - Updated table columns
6. `src/components/Clients/SiteForm.tsx` - Updated form fields and API call
7. `src/i18n/he.json` - Updated Hebrew translations
8. `src/i18n/en.json` - Updated English translations
