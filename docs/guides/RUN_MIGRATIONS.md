# Running Database Migrations

## Quick Start

Follow these steps to set up your database with all tables and seed data:

### 1. Start PostgreSQL

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- pgAdmin on port 5050 (http://localhost:5050)

Wait about 10 seconds for PostgreSQL to be ready.

### 2. Run Migrations

```bash
alembic upgrade head
```

This will:
- Create all 24 database tables
- Add all indexes and constraints
- Insert seed data:
  - 5 ticket status definitions
  - 10 asset types
  - 5 Israeli internet providers
  - 55 asset property definitions
  - 1 default admin user

Expected output:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 8dbb07d195b9, Initial schema with all tables
INFO  [alembic.runtime.migration] Running upgrade 8dbb07d195b9 -> 7033e1c9f63f, Seed initial data
```

### 3. Verify Migrations

Check current migration version:
```bash
alembic current
```

Expected output:
```
7033e1c9f63f (head)
```

### 4. Verify Database Tables

List all tables:
```bash
docker exec -it crm_postgres psql -U crm_user -d crm_db -c "\dt"
```

You should see all 24 tables.

### 5. View Seed Data

Check ticket statuses:
```bash
docker exec -it crm_postgres psql -U crm_user -d crm_db -c "SELECT code, name_en, name_he, is_default, is_closed_state FROM ticket_status_definitions ORDER BY sort_order;"
```

Expected output:
```
     code       |      name_en       |    name_he    | is_default | is_closed_state
----------------+--------------------+---------------+------------+-----------------
 NEW            | New                | חדש           | t          | f
 IN_PROGRESS    | In Progress        | בטיפול       | f          | f
 WAITING_CUSTOMER| Waiting for Customer| ממתין ללקוח  | f          | f
 RESOLVED       | Resolved           | נפתר          | f          | f
 CLOSED         | Closed             | סגור          | f          | t
```

Check asset types:
```bash
docker exec -it crm_postgres psql -U crm_user -d crm_db -c "SELECT code, name_en, name_he FROM asset_types ORDER BY code;"
```

Expected output:
```
     code      |   name_en    |       name_he
---------------+--------------+----------------------
 ACCESS_POINT  | Access Point | נקודת גישה (Wi-Fi)
 ALARM         | Alarm System | מערכת אזעקה
 DVR           | DVR          | מקליט DVR
 NVR           | NVR          | מקליט רשת (NVR)
 OTHER         | Other        | אחר
 PC            | PC           | מחשב
 PRINTER       | Printer      | מדפסת
 ROUTER        | Router       | ראוטר
 SERVER        | Server       | שרת
 SWITCH        | Switch       | סוויץ׳
```

Check admin user:
```bash
docker exec -it crm_postgres psql -U crm_user -d crm_db -c "SELECT name, email, role, is_active FROM internal_users WHERE email = 'admin@example.com';"
```

Expected output:
```
         name          |       email        | role  | is_active
-----------------------+--------------------+-------+-----------
 System Administrator  | admin@example.com  | admin | t
```

### 6. Test Login Credentials

**Email:** admin@example.com
**Password:** change_me_now

⚠️ **IMPORTANT:** Change this password immediately in production!

## Troubleshooting

### PostgreSQL won't start

Check if port 5432 is already in use:
```bash
# Windows
netstat -ano | findstr :5432

# Linux/Mac
lsof -i :5432
```

### Migration fails

1. Check database is running:
   ```bash
   docker ps
   ```

2. Check database connection:
   ```bash
   docker exec -it crm_postgres psql -U crm_user -d crm_db -c "SELECT 1;"
   ```

3. Check migration status:
   ```bash
   alembic current
   ```

4. If needed, downgrade and retry:
   ```bash
   alembic downgrade base
   alembic upgrade head
   ```

### Reset database completely

```bash
# Stop and remove containers
docker compose down -v

# Start fresh
docker compose up -d

# Wait 10 seconds, then run migrations
alembic upgrade head
```

## Database Connection Info

For connecting with other tools:

- **Host:** localhost
- **Port:** 5432
- **Database:** crm_db
- **Username:** crm_user
- **Password:** crm_password

**Connection String:**
```
postgresql+psycopg://crm_user:crm_password@localhost:5432/crm_db
```

## pgAdmin Access

Access pgAdmin at: http://localhost:5050

**Login:**
- Email: admin@example.com
- Password: admin

**Add Server in pgAdmin:**
1. Right-click "Servers" → Register → Server
2. General tab:
   - Name: CRM Local
3. Connection tab:
   - Host: postgres (or host.docker.internal)
   - Port: 5432
   - Maintenance database: crm_db
   - Username: crm_user
   - Password: crm_password
4. Click "Save"

## Next Steps

Once migrations are complete, you're ready for:

**Step 3: Authentication & RBAC**
- Implement password hashing
- Create JWT token generation
- Build RBAC middleware
- Create login endpoints

See `docs/spec/80_IMPLEMENTATION_TASKS.md` for details.
