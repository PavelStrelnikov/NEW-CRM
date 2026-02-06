# CRM System

A comprehensive CRM system for IT service companies managing CCTV, network infrastructure, and general IT equipment.

## Tech Stack

- **Backend**: Python 3.12+ with FastAPI
- **Database**: PostgreSQL 16+
- **ORM**: SQLAlchemy 2.x
- **Migrations**: Alembic
- **Auth**: JWT with RBAC
- **i18n**: Hebrew (RTL) default, English supported

## Project Status

**Current Status: Step 8 Completed** - Production-ready CRM system with 72+ REST endpoints, caching, and export functionality

**Step 1: Repository & Database Setup** ✅ COMPLETED

- [x] FastAPI project structure created
- [x] Dependencies configured
- [x] Docker Compose setup for PostgreSQL + pgAdmin
- [x] Database connection configured
- [x] Alembic environment initialized
- [x] Health endpoint implemented
- [x] Application startup verified

**Step 2: Database Migrations + Seed Data** ✅ COMPLETED

- [x] All 24 SQLAlchemy models created
- [x] Initial schema migration generated
- [x] Seed data migration created with:
  - 5 ticket status definitions (NEW, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED)
  - 10 asset types (NVR, DVR, ROUTER, SWITCH, ACCESS_POINT, PC, SERVER, PRINTER, ALARM, OTHER)
  - 5 Israeli internet providers (Bezeq, HOT, Partner, Cellcom, Other)
  - 55 asset property definitions for NVR/DVR/Router/Switch/AP
  - Default admin user (email: admin@example.com, password: change_me_now)
- [x] Migrations applied successfully

**Step 3: Authentication & RBAC** ✅ COMPLETED

- [x] Password hashing with bcrypt
- [x] JWT token generation and validation
- [x] User authentication service (supports internal and client users)
- [x] RBAC dependencies (admin, technician, office, client_contact, client_admin)
- [x] Authentication API endpoints:
  - POST /api/v1/auth/login
  - GET /api/v1/auth/me
  - POST /api/v1/auth/logout
- [x] Permission checking utilities
- [x] Client access scoping
- [x] All tests passing

**Step 4: Core CRUD Endpoints (Clients Domain)** ✅ COMPLETED

- [x] Pydantic schemas for clients domain (Client, Site, Contact, Location)
- [x] Clients API (list, create, get, update) with pagination and search
- [x] Sites API with default site logic
- [x] Contacts API with site linking functionality
- [x] Locations API
- [x] RBAC applied to all endpoints (client users filtered to own data)
- [x] 16 REST endpoints implemented
- [x] Routes registered in main.py
- [x] Comprehensive test script (test_clients_crud.py)
- [x] All tests passing

**Step 5: Tickets Vertical Slice** ✅ COMPLETED

- [x] Pydantic schemas for tickets domain (Ticket, Event, WorkLog, LineItem)
- [x] Tickets CRUD API with advanced filtering
- [x] Ticket initiator tracking (actor pattern)
- [x] Ticket events API (comments and audit trail)
- [x] Ticket status management with validation
- [x] Ticket assignment functionality
- [x] Work logs API (time tracking)
- [x] Line items API (materials and equipment)
- [x] Automatic ticket number generation
- [x] RBAC applied to all endpoints
- [x] 20 REST endpoints implemented
- [x] Routes registered in main.py
- [x] Comprehensive test script (test_tickets_crud.py)

**Step 6: Assets MVP with Dynamic Properties** ✅ COMPLETED

- [x] Pydantic schemas for assets domain (Asset, AssetType, Properties, Events, NVRDisk)
- [x] EAV pattern implementation for dynamic properties
- [x] Asset types and property definitions API
- [x] Assets CRUD API with dynamic properties support
- [x] Property value storage with type-specific columns
- [x] Asset events API (audit trail)
- [x] NVR disk tracking API
- [x] Advanced filtering (client, site, asset type, status, search)
- [x] RBAC applied to all endpoints
- [x] 15+ REST endpoints implemented
- [x] Routes registered in main.py
- [x] Comprehensive test script (test_assets_crud.py)

**Step 7: Reports API** ✅ COMPLETED

- [x] Pydantic schemas for reports domain (Ticket, WorkTime, Client, Asset, Technician, LineItem)
- [x] Ticket summary reports with status/priority/category breakdowns
- [x] Work time reports by technician/client/type with billable tracking
- [x] Client activity reports with ticket/asset statistics
- [x] Asset summary reports by type and status
- [x] Technician performance reports with closure rates
- [x] Line item summary reports
- [x] Date range filtering across all reports
- [x] Client filtering for internal users
- [x] RBAC applied to all endpoints
- [x] 7 REST endpoints implemented
- [x] Routes registered in main.py
- [x] Comprehensive test script (test_reports.py)

**Step 8: Production Hardening (Caching & Export)** ✅ COMPLETED

- [x] TTL-based report caching (5-minute expiration)
- [x] Cache key generation with RBAC context
- [x] Cache statistics tracking
- [x] CSV export for all 7 report types
- [x] Excel export for all 7 report types
- [x] Automatic filename generation with timestamps
- [x] Data flattening for nested structures
- [x] Streaming responses for memory efficiency
- [x] Auto-adjusted column widths in Excel
- [x] RBAC enforcement on all exports
- [x] 14 export endpoints implemented
- [x] Comprehensive export test script (test_reports_export.py)
- [x] Production deployment documentation

**Next Steps**: Dashboard frontend, scheduled reports, or additional features

## Quick Start Commands

```bash
# Start database
docker compose up -d

# Install backend dependencies
pip install -r backend/requirements.txt

# Run migrations
cd backend
alembic upgrade head

# Seed demo data (optional)
python scripts/seed_demo_data.py --reset --seed 123

# Start backend
uvicorn app.main:app --reload

# Install frontend dependencies
cd frontend
npm install

# Start frontend (localhost only)
npm run dev

# Start frontend (LAN access for mobile testing)
npm run dev:lan

# Run tests
pytest tests/ -v
```

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This will start:
- PostgreSQL on port 5432
- pgAdmin on port 5050 (http://localhost:5050)

pgAdmin credentials:
- Email: `admin@crm.local`
- Password: `admin`

### 3. Run Database Migrations

```bash
alembic upgrade head
```

### 4. Seed Demo Data (Optional)

For development and UI preview, you can seed realistic demo data:

```bash
# Install Faker if not already installed
pip install -r backend/requirements.txt

# Seed demo data with default settings
python backend/scripts/seed_demo_data.py

# Or customize the data volume
python backend/scripts/seed_demo_data.py --count-clients 50 --count-assets 200 --count-tickets 300

# Reset database and seed fresh data (CAREFUL!)
python backend/scripts/seed_demo_data.py --reset --seed 123
```

Default seed creates:
- **80 clients** with realistic Hebrew/English company names
- **Sites/branches** (1-4 per client) with locations
- **Contacts** (1-6 per client) with site assignments
- **350 assets**: NVRs, IP cameras, switches, routers, access points, servers, PCs, UPS, etc.
- **500 tickets** across last 180 days with realistic statuses, priorities, work logs, and line items
- **10 internal users** (admins, technicians, office staff)

All internal users have password: `password123`

### 5. Start the Development Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or run the test script first:

```bash
python test_startup.py
```

## Testing

The CRM system includes a comprehensive test suite with **157 passing tests** covering RBAC, authentication, ticket management, and portal security.

### Test Suite Overview

```
Total: 157 tests
├── Passing: 157 tests (100%) ✅
├── Failed: 0 tests
└── Xfailed: 0 tests
```

**Test Coverage by Category:**
- **Unit Tests (76 tests)**: RBAC functions, auth service, password hashing, JWT tokens
- **Integration Tests (41 tests)**: Ticket assignment API, portal authentication, portal ticket creation
- **Security Tests (14 tests)**: Data isolation, cross-client access, site-based filtering
- **Portal Tests (7 tests)**: Portal ticket operations, role-based access
- **API Tests (26 tests)**: Client management, ticket operations

### Running Tests

#### Run All Tests
```bash
cd backend
pytest tests/ -v
```

#### Run Specific Test Categories
```bash
# Unit tests only (fast, < 5 seconds)
pytest tests/unit -v

# Integration tests only
pytest tests/integration -v

# Security tests only
pytest tests/integration/test_data_isolation.py -v

# Portal tests only
pytest tests/integration/test_portal_auth_api.py tests/integration/test_portal_tickets_api.py -v
```

#### Run with Coverage Report
```bash
# Generate coverage report
pytest --cov=app --cov-report=html tests/

# View HTML report
# Open htmlcov/index.html in your browser
```

#### Run Specific Test Files
```bash
# RBAC tests
pytest tests/unit/test_rbac_functions.py -v

# Auth service tests
pytest tests/unit/test_auth_service.py -v

# Ticket assignment API tests
pytest tests/integration/test_ticket_assignment_api.py -v

# Portal authentication tests
pytest tests/integration/test_portal_auth_api.py -v
```

### Test Database Setup

Tests use a separate PostgreSQL database for isolation:

```sql
-- Create test database (already done if using Docker Compose)
CREATE DATABASE crm_test OWNER crm_user;
```

Configuration in `.env`:
```env
TEST_DATABASE_URL=postgresql+psycopg://crm_user:crm_password@localhost:5432/crm_test
```

### Test Organization

```
backend/tests/
├── conftest.py                          # Shared fixtures (DB, users, tokens)
├── unit/                                # Fast unit tests (no DB)
│   ├── test_rbac_functions.py           # 57 tests - RBAC permissions
│   └── test_auth_service.py             # 19 tests - Auth & tokens
├── integration/                         # API + database tests
│   ├── conftest.py                      # TestClient fixtures
│   ├── test_ticket_assignment_api.py    # 23 tests - Assignment endpoints
│   ├── test_portal_auth_api.py          # 16 tests - Portal auth
│   ├── test_data_isolation.py           # 9 tests - Security boundaries
│   └── test_portal_tickets_api.py       # 7 tests - Portal tickets
└── pytest.ini                           # Pytest configuration
```

### Key Test Features

- **Transaction Rollback Pattern**: Each test runs in an isolated transaction
- **Fixture Factories**: Reusable fixtures for users, tickets, clients, sites
- **No Mocking**: Uses real database and FastAPI TestClient for integration tests
- **Fast Execution**: Unit tests < 5 seconds, full suite < 25 seconds
- **Deterministic**: No flaky tests, all tests are isolated

### Known Issues

None - all tests passing!

### Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| `rbac.py` | 100% | 100% ✅ |
| `auth_service.py` | 95% | 95% ✅ |
| `guards.py` | 90% | 90% ✅ |
| `ticket_assignment.py` | 85% | 85% ✅ |
| API endpoints | 80% | 87% ✅ |

## API Documentation

Once the server is running, visit:

- **Interactive API Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## Project Structure

```
New-CRM/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry
│   ├── config.py            # Configuration with Pydantic Settings
│   ├── api/                 # API route handlers
│   ├── auth/                # Authentication & RBAC
│   ├── db/                  # Database session & base
│   │   ├── base.py          # SQLAlchemy Base & mixins
│   │   └── session.py       # Database session management
│   ├── models/              # SQLAlchemy models (to be created)
│   ├── schemas/             # Pydantic schemas (to be created)
│   ├── services/            # Business logic (to be created)
│   └── utils/               # Helper utilities
├── alembic/                 # Database migrations
│   ├── versions/            # Migration files
│   └── env.py               # Alembic environment
├── docs/
│   └── spec/                # Specification documents
├── docker-compose.yml       # PostgreSQL + pgAdmin
├── alembic.ini              # Alembic configuration
├── .env                     # Environment variables (not in git)
├── .env.example             # Example environment variables
└── requirements.txt         # Python dependencies
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql+psycopg://crm_user:crm_password@localhost:5432/crm_db

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
DEBUG=True

# Logging
LOG_LEVEL=INFO  # Options: DEBUG, INFO, WARNING, ERROR

# RBAC Flags
CLIENT_ADMIN_CAN_VIEW_SECRETS=False
TECHNICIAN_CAN_EDIT_SECRETS=True
```

## Logging Configuration

### Backend (Python)

The application uses structured logging with configurable levels controlled by environment variables.

**Log Levels:**
- `DEBUG` - Verbose logging for development (includes probe requests, credentials requests, etc.)
- `INFO` - Production logging (important events, status changes)
- `WARNING` - Warnings and potential issues
- `ERROR` - Errors and exceptions

**Configuration:**

Set the log level in `.env`:
```env
LOG_LEVEL=INFO  # Use DEBUG for development, INFO for production
```

**Development** (verbose logging):
```bash
cd backend
LOG_LEVEL=DEBUG uvicorn app.main:app --reload
```

**Production** (minimal logging):
```bash
LOG_LEVEL=INFO uvicorn app.main:app
```

**Log Format:**
```
[2024-01-17 10:30:45] INFO [app.api.hikvision] Probe successful for asset_id=...
```

**Security Features:**
- Passwords and tokens are automatically masked in logs
- Sensitive fields (password, token, secret, api_key, credential) replaced with `***MASKED***`
- Username logging only at DEBUG level

**Usage in Code:**
```python
from app.utils.logger import setup_logger, mask_sensitive_data

logger = setup_logger(__name__)

# Basic logging
logger.debug("Detailed debug information")
logger.info("Important event occurred")
logger.warning("Potential issue detected")
logger.error("Error occurred")

# Mask sensitive data
credentials = {"host": "192.168.1.1", "password": "secret"}
logger.debug(f"Connection data: {mask_sensitive_data(credentials)}")
# Output: Connection data: {'host': '192.168.1.1', 'password': '***MASKED***'}
```

### Frontend (TypeScript)

Logging is automatically controlled based on build environment:
- **Development** (`npm run dev`): All logs visible in browser console
- **Production** (`npm run build`): Only warnings and errors are logged

**Usage:**
```typescript
import { logger } from '@/utils/logger';

logger.debug('Debug info');  // Suppressed in production
logger.info('Info message'); // Suppressed in production
logger.warn('Warning');      // Always visible
logger.error('Error');       // Always visible

// Mask sensitive data
const request = { host: '192.168.1.1', password: 'secret' };
logger.debug('Request:', logger.maskSensitive(request));
// Output in dev: Request: { host: '192.168.1.1', password: '***' }
```

### Troubleshooting

If you need verbose logs to debug an issue:

1. Set `LOG_LEVEL=DEBUG` in `backend/.env`
2. Restart backend: `uvicorn app.main:app --reload`
3. Check console for detailed output
4. Remember to set back to `INFO` for production!

**Note:** With `LOG_LEVEL=INFO`, probe requests and credential logging are suppressed to reduce console noise.

## Database Connection

PostgreSQL connection details:
- **Host**: localhost
- **Port**: 5432
- **Database**: crm_db
- **User**: crm_user
- **Password**: crm_password

## Development Workflow

1. Make changes to code
2. Create new migration: `alembic revision --autogenerate -m "description"`
3. Review migration in `alembic/versions/`
4. Apply migration: `alembic upgrade head`
5. Test changes
6. Commit

## Documentation

Full system specifications are in `docs/spec/`:
- `00_INDEX.md` - Implementation order
- `10_ER_MODEL.md` - Database schema
- `11_RBAC.md` - Role-based access control
- `20_TICKET_SPEC.md` - Ticket management
- `30_ASSET_SPEC.md` - Asset inventory
- `60_API_CONTRACT.md` - API endpoints
- `80_IMPLEMENTATION_TASKS.md` - Implementation tasks
- `81_SEED_DATA.md` - Initial seed data

## Frontend Development

### Local Development (Localhost Only)

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at: http://localhost:3000

### LAN Access (Mobile/Tablet Testing)

To test from mobile devices on the same Wi-Fi network:

#### Step 1: Find Your Computer's IP Address

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter
# Example: 192.168.1.100
```

**Linux/Mac:**
```bash
ip addr show  # or ifconfig
# Look for your local IP (usually starts with 192.168.x.x)
```

#### Step 2: Configure Backend URL (if needed)

If you want to access the backend from mobile devices, create `.env.development.local`:

```bash
cd frontend
cp .env.development.local.example .env.development.local
```

Edit `.env.development.local` and set your computer's IP:
```env
VITE_BACKEND_URL=http://192.168.1.100:8000  # Replace with YOUR IP
```

#### Step 3: Start Backend (Accessible on LAN)

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Note: Backend is already configured with `--host 0.0.0.0` in the command above.

#### Step 4: Start Frontend (LAN Mode)

```bash
cd frontend
npm run dev:lan
```

The console will show network URLs like:
```
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.100:3000/
```

#### Step 5: Access from Mobile

Open on your phone/tablet:
```
http://192.168.1.100:3000
```

Replace `192.168.1.100` with YOUR computer's IP address.

### Windows Firewall Configuration

If you can't access from mobile, allow the dev server port through Windows Firewall:

```powershell
# Run PowerShell as Administrator
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "FastAPI Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

Or manually:
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Enter port `3000` (and `8000` for backend)
6. Allow the connection → Finish

### Troubleshooting LAN Access

**Can't connect from mobile?**
- Ensure both devices are on the same Wi-Fi network
- Check if Windows Firewall is blocking the ports
- Verify your IP address hasn't changed (use `ipconfig` again)
- Try pinging your computer from mobile (use a network tools app)

**API requests fail from mobile?**
- Make sure `VITE_BACKEND_URL` in `.env.development.local` points to your computer's IP
- Ensure backend is running with `--host 0.0.0.0`
- Check that port 8000 is allowed in firewall

## Next Implementation Steps

**Step 2**: Database Migrations + Seed Data
- Create all 23 tables from ER model
- Add required indexes
- Seed ticket statuses, asset types, and property definitions

**Step 3**: Authentication & RBAC
- Implement password hashing
- Create JWT login endpoints
- Build RBAC middleware

See `docs/spec/80_IMPLEMENTATION_TASKS.md` for complete task list.
