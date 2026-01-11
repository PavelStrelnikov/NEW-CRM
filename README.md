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

### 4. Start the Development Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or run the test script first:

```bash
python test_startup.py
```

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

# RBAC Flags
CLIENT_ADMIN_CAN_VIEW_SECRETS=False
TECHNICIAN_CAN_EDIT_SECRETS=True
```

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
