# Quick Start: Testing Authentication

## Prerequisites

1. PostgreSQL is running: `docker compose up -d`
2. Migrations are applied: `alembic upgrade head`
3. Dependencies are installed: `pip install -r requirements.txt`

## Step 1: Verify Setup

```bash
python test_startup_auth.py
```

Expected output:
```
[OK] FastAPI app imported successfully
[OK] Found 3 authentication route(s)
[OK] All authentication modules imported successfully
[OK] Password hashing works correctly
[OK] JWT token created
[OK] JWT token decoded successfully
ALL CHECKS PASSED!
```

## Step 2: Start the Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server should start on http://localhost:8000

## Step 3: Test Authentication

### Option A: Run Test Script

```bash
python test_auth.py
```

This will:
- Login with admin credentials
- Get current user info
- Test invalid credentials
- Test invalid token
- Logout

### Option B: Manual Testing with curl

**1. Login:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "change_me_now"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**2. Save the token and get user info:**
```bash
TOKEN="<paste-your-token-here>"

curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "id": "uuid-here",
  "name": "System Administrator",
  "email": "admin@example.com",
  "role": "admin",
  "user_type": "internal",
  "client_id": null,
  "is_active": true,
  "preferred_locale": "HE_IL"
}
```

### Option C: Interactive API Documentation

1. Visit http://localhost:8000/docs
2. Click on "POST /api/v1/auth/login"
3. Click "Try it out"
4. Enter credentials:
   ```json
   {
     "email": "admin@example.com",
     "password": "change_me_now"
   }
   ```
5. Click "Execute"
6. Copy the `access_token` from the response
7. Click the "Authorize" button at the top
8. Enter: `Bearer <your-token>`
9. Click "Authorize"
10. Now you can test any protected endpoint!

## Default Credentials

```
Email: admin@example.com
Password: change_me_now
```

⚠️ **IMPORTANT**: Change this password immediately!

## Testing Different Roles

To test different roles, you'll need to create users with different roles using the API (once user management endpoints are implemented) or directly in the database.

### Create a Technician (via database):
```sql
INSERT INTO internal_users (id, name, email, password_hash, role, preferred_locale, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Test Technician',
  'tech@example.com',
  '$2b$12$...', -- hash of 'test123'
  'TECHNICIAN',
  'HE_IL',
  true,
  now(),
  now()
);
```

Then login with:
```json
{
  "email": "tech@example.com",
  "password": "test123"
}
```

## Troubleshooting

### "Could not connect to server"
- Make sure the server is running: `uvicorn app.main:app --reload`

### "401 Unauthorized"
- Check your credentials
- Verify the admin user exists: `SELECT * FROM internal_users WHERE email = 'admin@example.com';`

### "Token expired"
- Tokens expire after 30 minutes by default (configurable in `.env`)
- Login again to get a new token

### "403 Forbidden"
- Your user doesn't have permission for this endpoint
- Check the endpoint's required role in the API docs

## Next Steps

Once authentication is working:
1. Implement Clients API endpoints
2. Implement Sites API endpoints
3. Implement Tickets API endpoints
4. Add RBAC to all endpoints

See `docs/spec/80_IMPLEMENTATION_TASKS.md` for the full implementation plan.
