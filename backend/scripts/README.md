# Database Seeding Scripts

## seed_demo_data.py

Generates realistic demo data for the CRM database. **For development/demo use only.**

### Quick Usage

```bash
# From project root directory
docker compose up -d
python backend/scripts/seed_demo_data.py --reset --seed 123
```

### What It Creates

With default settings (seed=123):

- **10 internal users** (2 admins, 6 technicians, 2 office staff)
  - Password for all: `password123`
- **80 client companies** with Hebrew/English names
- **~200 sites/branches** (1-4 per client)
- **~400 locations** (building/floor/room within sites)
- **~350 contacts** (1-6 per client, linked to sites)
- **350 assets** distributed as:
  - ~140 IP cameras
  - ~18 NVRs with disks
  - ~10 DVRs with disks
  - ~35 switches (Aruba, HP, Cisco, Ubiquiti)
  - ~18 routers (Check Point, Mikrotik, Cisco)
  - ~52 access points (Aruba, Ruijie, Ubiquiti)
  - ~35 PCs
  - ~7 servers
  - ~18 printers
  - ~10 alarm systems
  - ~7 UPS units
- **500 tickets** across last 180 days with:
  - Mix of statuses (NEW, IN_PROGRESS, WAITING_CUSTOMER, RESOLVED, CLOSED)
  - Realistic Hebrew/English descriptions
  - Work logs and time tracking
  - Line items (materials/equipment)
  - Event history and comments

### Command Line Options

```bash
python backend/scripts/seed_demo_data.py [OPTIONS]

Options:
  --count-clients N          Number of clients (default: 80)
  --max-branches-per-client N   Max sites per client (default: 4)
  --max-contacts-per-branch N   Max contacts per client (default: 6)
  --count-assets N          Total assets to create (default: 350)
  --count-tickets N         Total tickets to create (default: 500)
  --seed N                  Random seed for reproducibility (default: 123)
  --reset                   DANGEROUS: Wipe all data first
```

### Examples

```bash
# Smaller dataset for quick testing
python backend/scripts/seed_demo_data.py \
  --count-clients 20 \
  --count-assets 100 \
  --count-tickets 150 \
  --seed 999

# Large dataset for stress testing
python backend/scripts/seed_demo_data.py \
  --count-clients 200 \
  --count-assets 1000 \
  --count-tickets 2000 \
  --reset \
  --seed 123

# Reset and reseed with same data (idempotent)
python backend/scripts/seed_demo_data.py --reset --seed 123
```

### Safety Features

- **Production Protection**: Refuses to run if DATABASE_URL doesn't contain "localhost" or "127.0.0.1"
- **Confirmation Prompt**: Requires typing "yes" when using --reset
- **Preserves Seed Data**: Keeps ticket status definitions, asset types, property definitions, and admin user
- **Deterministic**: Same seed produces same data every time
- **FK-Safe Reset**: Uses PostgreSQL TRUNCATE CASCADE to avoid foreign key violations
- **Transaction Safety**: Rolls back on any error to maintain database consistency

### Troubleshooting

**Import Error: No module named 'faker'**
```bash
pip install -r backend/requirements.txt
```

**Database Connection Error**
```bash
# Make sure PostgreSQL is running
docker compose up -d

# Check .env file has correct DATABASE_URL
cat .env
```

**Permission Denied**
```bash
# Make script executable (Linux/Mac)
chmod +x backend/scripts/seed_demo_data.py
```

**Python 3.14+ Compatibility**
The script uses `bcrypt` directly instead of `passlib` to avoid compatibility issues with newer Python versions. This ensures the script works on Python 3.14+ where `passlib` has dependency conflicts with newer `bcrypt` versions.

### What's NOT Included

- Client users (portal accounts) - only internal staff users
- Actual file attachments - only metadata would be created
- Projects - model exists but not seeded yet
- Invoice/accounting data - out of MVP scope

### Technical Details

**Reset Strategy (TRUNCATE CASCADE)**

The `--reset` flag uses PostgreSQL's `TRUNCATE ... CASCADE` command instead of individual DELETE statements. This approach:

1. **Prevents FK Violations**: CASCADE automatically follows foreign key relationships and deletes dependent rows
2. **Future-Proof**: New tables with FK constraints are automatically handled - no code changes needed
3. **Performance**: TRUNCATE is faster than DELETE and resets sequences with RESTART IDENTITY
4. **Simplicity**: Only need to truncate parent tables (`clients`, `projects`) - CASCADE handles everything else

Example:
```sql
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;
-- Automatically cascades to: sites, contacts, client_users, assets, tickets, etc.
```

This prevents the `ForeignKeyViolation` errors that occur with naive DELETE approaches when tables like `projects` have foreign keys to `clients`.
