# Step 9 Implementation Summary

## Attachments MVP + Admin Endpoints - COMPLETED ✅

### Overview

Implemented file attachment functionality and administrative configuration endpoints as specified:
- **Part A:** File upload/download with RBAC enforcement
- **Part B:** Admin CRUD for ticket statuses, asset types, and asset property definitions

Both features follow the backend-first approach with no frontend implementation.

---

## Part A: Attachments MVP

### Files Created

#### 1. Pydantic Schemas (`app/schemas/attachments.py`)
- `AttachmentResponse` - Attachment metadata response
- `AttachmentListResponse` - Paginated list of attachments

#### 2. API Endpoints (`app/api/attachments.py`)

**Attachment Operations:**
- `POST /api/v1/attachments` - Upload file with multipart/form-data
- `GET /api/v1/attachments` - List attachments with filtering
- `GET /api/v1/attachments/{id}/download` - Download file
- `DELETE /api/v1/attachments/{id}` - Delete attachment (admin only)

**Total: 4 REST endpoints**

### Key Features Implemented

✅ **File Upload**
- Multipart/form-data support
- Fields: `linked_type`, `linked_id`, `file`
- Linked types: ticket, asset, project, site, client
- Automatic UUID-based filename generation
- Metadata storage in database

✅ **File Storage**
- Local filesystem storage
- Path structure: `./data/uploads/{linked_type}/{linked_id}/{uuid}-{filename}`
- File size validation (25MB max)
- MIME type validation (pdf, jpg, png, gif, docx, xlsx, txt, zip)

✅ **File Download**
- Direct file response via FileResponse
- Original filename preserved
- Proper content-type headers
- Streaming for memory efficiency

✅ **RBAC Enforcement**
- Internal users: Full access to all attachments
- Client users: Access only to their own client's entities
- Polymorphic access control (validates entity ownership)
- Authentication required for all operations

✅ **Entity Validation**
- Verifies linked entity exists
- Checks client ownership for client users
- Prevents unauthorized cross-client access

### Implementation Details

**File Upload Flow:**
```
1. Validate linked_type (must be valid LinkedType enum)
2. Verify client access to linked entity (RBAC)
3. Validate file size (max 25MB)
4. Validate MIME type (whitelist)
5. Create storage directory if not exists
6. Generate unique filename with UUID
7. Save file to disk
8. Create attachment metadata record in database
9. Return attachment response
```

**Storage Structure:**
```
./data/uploads/
├── ticket/
│   └── {ticket_id}/
│       └── {uuid}-document.pdf
├── asset/
│   └── {asset_id}/
│       └── {uuid}-photo.jpg
├── project/
├── site/
└── client/
```

**RBAC Verification Logic:**
```python
def verify_client_access(db, current_user, linked_type, linked_id):
    """Verify client user can access entity."""
    if current_user.user_type != "client":
        return True  # Internal users have full access

    # Get entity's client_id based on linked_type
    # Compare with current_user.client_id
    # Raise 403 if mismatch
```

### Database Schema (Existing)

The `attachments` table already existed in the schema:
```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY,
    linked_type VARCHAR NOT NULL,
    linked_id UUID NOT NULL,
    filename VARCHAR NOT NULL,
    mime_type VARCHAR NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by_actor_type VARCHAR NOT NULL,
    uploaded_by_actor_id UUID,
    uploaded_by_actor_display VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL,
    INDEX idx_attachments_linked (linked_type, linked_id)
);
```

**No migration needed** - Model already implemented in `app/models/attachments.py`.

### Configuration

**File Upload Limits:**
```python
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
UPLOAD_DIR = "./data/uploads"
```

**Allowed MIME Types:**
- `application/pdf`
- `image/jpeg`, `image/png`, `image/gif`
- `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `text/plain`
- `application/zip`

### Usage Examples

**1. Upload file to ticket:**
```bash
curl -X POST "http://localhost:8000/api/v1/attachments" \
  -H "Authorization: Bearer <token>" \
  -F "linked_type=ticket" \
  -F "linked_id=<ticket_uuid>" \
  -F "file=@document.pdf"
```

Response:
```json
{
  "id": "uuid",
  "linked_type": "ticket",
  "linked_id": "ticket_uuid",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 102400,
  "uploaded_by_actor_display": "Admin User",
  "created_at": "2026-01-09T..."
}
```

**2. List attachments for ticket:**
```bash
curl -X GET "http://localhost:8000/api/v1/attachments?linked_type=ticket&linked_id=<ticket_uuid>" \
  -H "Authorization: Bearer <token>"
```

**3. Download attachment:**
```bash
curl -X GET "http://localhost:8000/api/v1/attachments/<attachment_id>/download" \
  -H "Authorization: Bearer <token>" \
  -o downloaded_file.pdf
```

**4. Delete attachment (admin only):**
```bash
curl -X DELETE "http://localhost:8000/api/v1/attachments/<attachment_id>" \
  -H "Authorization: Bearer <token>"
```

---

## Part B: Admin Endpoints

### Files Created

#### 1. Pydantic Schemas (`app/schemas/admin.py`)

**Ticket Status Schemas:**
- `TicketStatusCreate` - Create ticket status
- `TicketStatusUpdate` - Update ticket status
- `TicketStatusResponse` - Status response

**Asset Type Schemas:**
- `AssetTypeCreate` - Create asset type
- `AssetTypeUpdate` - Update asset type
- `AssetTypeResponse` - Asset type response

**Asset Property Definition Schemas:**
- `AssetPropertyDefinitionCreate` - Create property definition
- `AssetPropertyDefinitionUpdate` - Update property definition
- `AssetPropertyDefinitionResponse` - Property definition response

#### 2. API Endpoints (`app/api/admin.py`)

**Ticket Status Admin (7 endpoints):**
- `GET /api/v1/admin/ticket-statuses` - List all statuses
- `POST /api/v1/admin/ticket-statuses` - Create status
- `GET /api/v1/admin/ticket-statuses/{id}` - Get status
- `PATCH /api/v1/admin/ticket-statuses/{id}` - Update status
- `POST /api/v1/admin/ticket-statuses/{id}/set-default` - Set as default
- `DELETE /api/v1/admin/ticket-statuses/{id}` - Soft delete status

**Asset Type Admin (5 endpoints):**
- `GET /api/v1/admin/asset-types` - List all types
- `POST /api/v1/admin/asset-types` - Create type
- `GET /api/v1/admin/asset-types/{id}` - Get type
- `PATCH /api/v1/admin/asset-types/{id}` - Update type
- `DELETE /api/v1/admin/asset-types/{id}` - Soft delete type

**Asset Property Definition Admin (5 endpoints):**
- `GET /api/v1/admin/asset-property-definitions` - List definitions
- `POST /api/v1/admin/asset-property-definitions` - Create definition
- `GET /api/v1/admin/asset-property-definitions/{id}` - Get definition
- `PATCH /api/v1/admin/asset-property-definitions/{id}` - Update definition
- `DELETE /api/v1/admin/asset-property-definitions/{id}` - Soft delete definition

**Total: 17 REST endpoints**

### Key Features Implemented

✅ **Ticket Status Management**
- Full CRUD operations
- Sort order management
- Set/unset default status (only one can be default)
- Soft delete (set is_active=false)
- Bilingual names (name_he, name_en)
- Cannot delete default status

✅ **Asset Type Management**
- Create custom asset types
- Update existing types
- Soft delete (set is_active=false)
- Bilingual names (name_he, name_en)
- List with optional inactive filter

✅ **Asset Property Definition Management**
- Create custom properties for any asset type
- Configure data types (string, int, bool, date, decimal, enum, secret)
- Set visibility levels (internal_only, client_admin, client_all)
- Mark as required or optional
- Sort order management
- Soft delete (set is_active=false)
- Bilingual labels (label_he, label_en)

✅ **RBAC Enforcement**
- All admin endpoints require admin role
- Helper function: `require_admin(current_user)`
- Returns 403 for non-admin users
- Authentication required for all operations

✅ **Data Validation**
- Code uniqueness checks
- Pattern validation for data types and visibility
- Cannot delete default status
- Cannot duplicate property keys per asset type

### Business Rules Enforced

**Ticket Statuses:**
1. Only one status can be default at a time
2. Cannot delete default status (must set another as default first)
3. Soft delete only (preserves referential integrity)
4. Code must be unique
5. New statuses are active by default

**Asset Types:**
1. Code must be unique
2. Soft delete only
3. New types are active by default

**Asset Property Definitions:**
1. Key must be unique per asset type
2. Data type must be valid enum value
3. Visibility must be valid enum value
4. Soft delete only
5. New definitions are active by default

### Usage Examples

**1. Create custom ticket status:**
```bash
curl -X POST "http://localhost:8000/api/v1/admin/ticket-statuses" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ON_HOLD",
    "name_en": "On Hold",
    "name_he": "בהמתנה",
    "description": "Ticket is on hold pending customer response",
    "is_closed_state": false,
    "sort_order": 50
  }'
```

**2. Set status as default:**
```bash
curl -X POST "http://localhost:8000/api/v1/admin/ticket-statuses/<status_id>/set-default" \
  -H "Authorization: Bearer <admin_token>"
```

**3. Create custom asset type:**
```bash
curl -X POST "http://localhost:8000/api/v1/admin/asset-types" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TABLET",
    "name_en": "Tablet",
    "name_he": "טאבלט",
    "description": "Tablet devices"
  }'
```

**4. Create custom property definition:**
```bash
curl -X POST "http://localhost:8000/api/v1/admin/asset-property-definitions" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_type_id": "<asset_type_uuid>",
    "key": "warranty_expiration",
    "label_en": "Warranty Expiration Date",
    "label_he": "תאריך תפוגת אחריות",
    "data_type": "date",
    "required": false,
    "visibility": "internal_only",
    "sort_order": 10
  }'
```

**5. List all statuses including inactive:**
```bash
curl -X GET "http://localhost:8000/api/v1/admin/ticket-statuses?include_inactive=true" \
  -H "Authorization: Bearer <admin_token>"
```

---

## Files Modified

### Route Registration

**`app/api/__init__.py`:**
- Added `attachments` and `admin` to imports and exports

**`app/main.py`:**
- Registered `attachments.router` under `/api/v1` with tag "Attachments"
- Registered `admin.router` under `/api/v1` with tag "Admin"

---

## Testing

### Test Script Created

**`test_attachments_admin.py`** - Comprehensive test suite covering:

**Attachment Tests (4 tests):**
- Upload file to ticket
- List attachments with filtering
- Download attachment
- RBAC enforcement (unauthorized access)

**Ticket Status Admin Tests (5 tests):**
- List statuses
- Create custom status
- Update status
- Get status by ID
- Delete status (soft delete)

**Asset Type Admin Tests (5 tests):**
- List asset types
- Create custom type
- Update type
- Get type by ID
- Delete type (soft delete)

**Asset Property Definition Admin Tests (5 tests):**
- List definitions
- Create custom definition
- Update definition
- Get definition by ID
- Delete definition (soft delete)

**RBAC Tests (2 tests):**
- Attachment access without authentication
- Admin endpoint access without authentication

**Total: 21 automated tests**

### Running Tests

```bash
# Ensure server is running
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
python test_attachments_admin.py
```

Expected output:
```
Tests run: 21
  [OK]   Passed: 21
  [FAIL] Failed: 0

[SUCCESS] All tests completed successfully!
```

---

## API Summary

### New Endpoints Added

**Attachments: 4 endpoints**
- POST /api/v1/attachments
- GET /api/v1/attachments
- GET /api/v1/attachments/{id}/download
- DELETE /api/v1/attachments/{id}

**Admin - Ticket Statuses: 6 endpoints**
- GET /api/v1/admin/ticket-statuses
- POST /api/v1/admin/ticket-statuses
- GET /api/v1/admin/ticket-statuses/{id}
- PATCH /api/v1/admin/ticket-statuses/{id}
- POST /api/v1/admin/ticket-statuses/{id}/set-default
- DELETE /api/v1/admin/ticket-statuses/{id}

**Admin - Asset Types: 5 endpoints**
- GET /api/v1/admin/asset-types
- POST /api/v1/admin/asset-types
- GET /api/v1/admin/asset-types/{id}
- PATCH /api/v1/admin/asset-types/{id}
- DELETE /api/v1/admin/asset-types/{id}

**Admin - Property Definitions: 5 endpoints**
- GET /api/v1/admin/asset-property-definitions
- POST /api/v1/admin/asset-property-definitions
- GET /api/v1/admin/asset-property-definitions/{id}
- PATCH /api/v1/admin/asset-property-definitions/{id}
- DELETE /api/v1/admin/asset-property-definitions/{id}

**Total New Endpoints: 21**
**Total System Endpoints: 93+ (72 from previous steps + 21 new)**

---

## Security Considerations

### File Upload Security

**Validations Implemented:**
- File size limit (25MB)
- MIME type whitelist
- Filename sanitization (UUID-based)
- Entity ownership verification
- Authentication required

**Best Practices:**
- Files stored outside web root
- No direct file serving from web server
- Files served through application logic
- RBAC enforced on all operations

**Future Enhancements:**
- Virus scanning integration
- Image optimization/thumbnails
- S3/cloud storage migration
- File versioning

### Admin Endpoint Security

**Access Control:**
- Admin role required for all operations
- No partial admin access
- All changes logged via created_at/updated_at
- Soft deletes preserve data integrity

**Audit Trail:**
- All admin changes tracked via timestamps
- Actor information preserved in attachments
- Can implement admin_events table for detailed audit

---

## Migration Notes

**No Database Migration Required:**
- `attachments` table already exists in schema
- `ticket_status_definitions` table already exists
- `asset_types` table already exists
- `asset_property_definitions` table already exists
- All models were already implemented in Step 2

**File System Changes:**
- Created `./data/uploads/` directory structure
- Added `.gitkeep` to track empty directory

---

## Future Enhancements

### Attachments
- [ ] Image thumbnails generation
- [ ] Cloud storage integration (S3, Azure Blob)
- [ ] Bulk upload support
- [ ] File versioning
- [ ] Virus scanning integration
- [ ] Image compression
- [ ] Preview generation for documents
- [ ] Attachment comments/annotations

### Admin Features
- [ ] Audit log for admin changes
- [ ] Bulk operations (reorder, bulk activate/deactivate)
- [ ] Import/export configurations
- [ ] Configuration templates
- [ ] Rollback functionality
- [ ] Change preview/validation
- [ ] Admin dashboard with statistics

---

## Project Status

```
✅ Step 1: Repository & Database Setup
✅ Step 2: Database Migrations + Seed Data
✅ Step 3: Authentication & RBAC
✅ Step 4: Clients Domain (16 endpoints)
✅ Step 5: Tickets Domain (20 endpoints)
✅ Step 6: Assets Domain (15 endpoints)
✅ Step 7: Reports API (7 endpoints)
✅ Step 8: Production Hardening - Caching & Export (14 endpoints)
✅ Step 9: Attachments + Admin Endpoints (21 endpoints)
```

**Total: 93+ REST endpoints** with complete file handling and system administration!

---

## Summary

Step 9 is now **complete** with full Attachments and Admin functionality:
- ✅ 4 attachment endpoints (upload/download/list/delete)
- ✅ Local filesystem storage with proper structure
- ✅ File size and MIME type validation
- ✅ Complete RBAC enforcement
- ✅ 6 ticket status admin endpoints
- ✅ 5 asset type admin endpoints
- ✅ 5 asset property definition admin endpoints
- ✅ Soft delete pattern throughout
- ✅ Bilingual support for all admin entities
- ✅ Comprehensive test suite (21 tests)

The CRM system now includes complete file attachment functionality and administrative configuration capabilities, bringing the backend MVP to near completion. Only the Projects module remains to be implemented for full MVP feature parity.
