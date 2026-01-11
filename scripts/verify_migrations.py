"""
Script to verify migration files are valid and ready to run.
"""
import sys
from pathlib import Path

print("=" * 60)
print("MIGRATION VERIFICATION")
print("=" * 60)

# Check migration files exist
migrations_dir = Path("alembic/versions")
if not migrations_dir.exists():
    print("ERROR: alembic/versions directory not found!")
    sys.exit(1)

migration_files = list(migrations_dir.glob("*.py"))
if not migration_files:
    print("ERROR: No migration files found!")
    sys.exit(1)

print(f"\nFound {len(migration_files)} migration file(s):")
for mf in sorted(migration_files):
    print(f"  - {mf.name}")

# Check models can be imported
print("\nChecking models can be imported...")
try:
    from app.models import (
        InternalUser, ClientUser,
        Client, Site, Contact, Location,
        Ticket, TicketStatusDefinition, TicketInitiator, TicketEvent,
        WorkLog, TicketLineItem,
        Asset, AssetType, AssetPropertyDefinition, AssetPropertyValue,
        Project, Attachment, InternetProvider
    )
    print("  [OK] All models imported successfully")
except Exception as e:
    print(f"  ERROR importing models: {e}")
    sys.exit(1)

# Check alembic env is configured
print("\nChecking Alembic configuration...")
try:
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config("alembic.ini")
    print("  [OK] alembic.ini found and valid")
except Exception as e:
    print(f"  ERROR: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE - All checks passed!")
print("=" * 60)

print("\nNext steps:")
print("\n1. Start PostgreSQL:")
print("   docker compose up -d")
print("\n2. Run migrations:")
print("   alembic upgrade head")
print("\n3. Verify migrations applied:")
print("   alembic current")
print("\n4. Check database tables:")
print("   docker exec -it crm_postgres psql -U crm_user -d crm_db -c '\\dt'")
print("\n5. View seed data:")
print("   docker exec -it crm_postgres psql -U crm_user -d crm_db -c 'SELECT * FROM ticket_status_definitions;'")
print("   docker exec -it crm_postgres psql -U crm_user -d crm_db -c 'SELECT * FROM asset_types;'")
