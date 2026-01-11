"""
Reset the database by dropping all tables and recreating from migrations.
"""
from sqlalchemy import create_engine, text
from app.config import settings

print("Resetting database...")

# Create engine
engine = create_engine(settings.DATABASE_URL)

# Drop all tables
with engine.connect() as conn:
    # Drop all enums and tables
    conn.execute(text("""
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO crm_user;
        GRANT ALL ON SCHEMA public TO public;
    """))
    conn.commit()
    print("✓ All tables and types dropped")

print("\nNow run: alembic upgrade head")
