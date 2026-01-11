# Quick Start: Testing Clients Domain CRUD

## Prerequisites

1. PostgreSQL is running: `docker compose up -d`
2. Migrations are applied: `alembic upgrade head`
3. Dependencies are installed: `pip install -r requirements.txt`
4. Authentication is working (see `QUICKSTART_AUTH.md`)

## Step 1: Start the Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server should start on http://localhost:8000

## Step 2: Run the Test Script

```bash
python test_clients_crud.py
```

This will:
- Login as admin
- Create a test client (with auto-created default site)
- Create an additional site
- Create a contact linked to the site
- Create locations at the site
- Test all CRUD operations
- Test RBAC enforcement

Expected output:
```
============================================================
  AUTHENTICATION
============================================================
[OK] Login as Admin
Status: 200

============================================================
  CLIENT CRUD OPERATIONS
============================================================
[OK] Create Client
Status: 201
>> Created client_id: <uuid>

[OK] List Clients (initial)
[OK] Get Client by ID
[OK] Update Client
[OK] Search Clients by name

============================================================
  SITE CRUD OPERATIONS
============================================================
[OK] List Sites for Client
[OK] Create Additional Site
[OK] Get Site by ID
[OK] Update Site
[OK] Set Site as Default

============================================================
  CONTACT CRUD OPERATIONS
============================================================
[OK] Create Contact with Site Link
[OK] Get Contact by ID
[OK] Update Contact
[OK] Update Contact Site Links

============================================================
  LOCATION CRUD OPERATIONS
============================================================
[OK] Create Location
[OK] Get Location by ID
[OK] Update Location
[OK] List All Locations for Site

============================================================
  SUMMARY
============================================================
[SUCCESS] All tests completed successfully!
```

## Step 3: Interactive Testing

### Using Swagger UI

1. Visit http://localhost:8000/docs
2. Click "Authorize" button
3. Login to get token:
   - Click "POST /api/v1/auth/login"
   - Try it out
   - Enter admin credentials
   - Copy the `access_token`
4. Paste token in Authorization dialog: `Bearer <token>`
5. Now you can test any endpoint!

### API Endpoints Available

**Clients:**
- `GET /api/v1/clients` - List clients (supports pagination & search)
- `POST /api/v1/clients` - Create client
- `GET /api/v1/clients/{id}` - Get client
- `PATCH /api/v1/clients/{id}` - Update client

**Sites:**
- `GET /api/v1/clients/{id}/sites` - List sites for client
- `POST /api/v1/clients/{id}/sites` - Create site
- `GET /api/v1/sites/{id}` - Get site
- `PATCH /api/v1/sites/{id}` - Update site

**Contacts:**
- `GET /api/v1/clients/{id}/contacts` - List contacts for client
- `POST /api/v1/clients/{id}/contacts` - Create contact
- `GET /api/v1/contacts/{id}` - Get contact
- `PATCH /api/v1/contacts/{id}` - Update contact
- `POST /api/v1/contacts/{id}/sites` - Update contact-site links

**Locations:**
- `GET /api/v1/sites/{id}/locations` - List locations for site
- `POST /api/v1/sites/{id}/locations` - Create location
- `GET /api/v1/locations/{id}` - Get location
- `PATCH /api/v1/locations/{id}` - Update location

## Manual Testing with curl

### 1. Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "change_me_now"}'
```

Save the token:
```bash
TOKEN="<paste-token-here>"
```

### 2. Create a Client
```bash
curl -X POST http://localhost:8000/api/v1/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company Ltd",
    "main_address": "123 Test Street, Tel Aviv",
    "notes": "Test client",
    "status": "active"
  }'
```

Response includes client and auto-created default site:
```json
{
  "id": "uuid",
  "name": "Test Company Ltd",
  "main_address": "123 Test Street, Tel Aviv",
  "notes": "Test client",
  "status": "active",
  "created_at": "2024-01-09T...",
  "updated_at": "2024-01-09T..."
}
```

Save the client ID:
```bash
CLIENT_ID="<paste-uuid-here>"
```

### 3. List Sites (includes default site)
```bash
curl -X GET http://localhost:8000/api/v1/clients/$CLIENT_ID/sites \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Create Additional Site
```bash
curl -X POST http://localhost:8000/api/v1/clients/$CLIENT_ID/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'$CLIENT_ID'",
    "name": "Branch Office",
    "address": "456 Branch Street, Haifa",
    "is_default": false,
    "notes": "Northern branch"
  }'
```

Save the site ID:
```bash
SITE_ID="<paste-uuid-here>"
```

### 5. Create Contact with Site Link
```bash
curl -X POST http://localhost:8000/api/v1/clients/$CLIENT_ID/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'$CLIENT_ID'",
    "name": "John Doe",
    "phone": "050-1234567",
    "email": "john@test.com",
    "position": "IT Manager",
    "site_ids": ["'$SITE_ID'"]
  }'
```

### 6. Create Location at Site
```bash
curl -X POST http://localhost:8000/api/v1/sites/$SITE_ID/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "'$SITE_ID'",
    "building": "Building A",
    "floor": "3rd Floor",
    "room": "Server Room",
    "description": "Main data center"
  }'
```

### 7. Search Clients
```bash
curl -X GET "http://localhost:8000/api/v1/clients?q=Test&page=1&page_size=25" \
  -H "Authorization: Bearer $TOKEN"
```

### 8. Update Client
```bash
curl -X PATCH http://localhost:8000/api/v1/clients/$CLIENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated notes"
  }'
```

## Key Features

### 1. Automatic Default Site
When you create a client, a default site is automatically created:
```json
{
  "name": "Default Site",
  "address": "<client's main_address>",
  "is_default": true
}
```

### 2. Default Site Management
Only one site per client can be marked as default. When you set a site as default:
```bash
curl -X PATCH http://localhost:8000/api/v1/sites/$SITE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_default": true}'
```
All other sites for that client automatically have `is_default` set to `false`.

### 3. Contact-Site Linking
Contacts can be linked to multiple sites. Update links:
```bash
curl -X POST http://localhost:8000/api/v1/contacts/$CONTACT_ID/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_ids": ["site-uuid-1", "site-uuid-2"]
  }'
```

### 4. Pagination & Search
List clients with pagination:
```bash
# Page 1 with 10 items per page
curl -X GET "http://localhost:8000/api/v1/clients?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"

# Search for "Acme"
curl -X GET "http://localhost:8000/api/v1/clients?q=Acme" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. RBAC Filtering
**Internal users (admin/technician/office):**
- Can see all clients, sites, contacts, locations
- Admins can create/update

**Client users:**
- Can only see resources belonging to their client
- Automatically filtered by `client_id`
- Read-only access

Test RBAC:
```bash
# Without token - should fail with 401
curl -X GET http://localhost:8000/api/v1/clients

# With invalid token - should fail with 401
curl -X GET http://localhost:8000/api/v1/clients \
  -H "Authorization: Bearer invalid_token"
```

## Troubleshooting

### "401 Unauthorized"
- Check your token is valid
- Tokens expire after 30 minutes (default)
- Login again to get a new token

### "403 Forbidden"
- Your user doesn't have permission
- Only admins can create/update
- Client users can only see their own data

### "404 Not Found"
- Check the UUID is correct
- Verify the resource exists

### "400 Bad Request"
- Check request body matches schema
- For nested routes, ensure parent exists
- When linking sites, ensure they belong to the client

## Data Hierarchy

```
Client
├── Sites (1:N)
│   └── Locations (1:N)
└── Contacts (1:N)
    └── Sites (M:N via contact_site_links)
```

## Next Steps

Once clients domain is working:
1. Implement Assets API (NVR, DVR, routers, switches, etc.)
2. Implement Tickets API (ticket management, status tracking)
3. Implement Work Logs API (time billing)
4. Add reports and dashboards

See `docs/spec/80_IMPLEMENTATION_TASKS.md` for the full implementation plan.
