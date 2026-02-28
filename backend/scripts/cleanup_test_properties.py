"""
Script to find and delete test property definitions from the database.
Run from backend directory: python scripts/cleanup_test_properties.py
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def main():
    # Connect to database
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Step 1: Find all test property definitions
        print("=" * 60)
        print("STEP 1: Finding test property definitions...")
        print("=" * 60)

        result = conn.execute(text("""
            SELECT id, key, label_he, label_en, asset_type_id
            FROM asset_property_definitions
            WHERE key LIKE '%test%'
               OR key LIKE '%custom%'
               OR key LIKE '%בדיקה%'
               OR label_he LIKE '%שדה בדיקה%'
               OR label_he LIKE '%בדיקה מותאם%'
               OR label_en LIKE '%test field%'
               OR label_en LIKE '%custom field%'
        """))

        rows = result.fetchall()

        if not rows:
            print("No test property definitions found.")
            print("\nLet's check ALL properties to see what exists:")
            result2 = conn.execute(text("""
                SELECT apd.id, apd.key, apd.label_he, apd.label_en, at.code as asset_type
                FROM asset_property_definitions apd
                JOIN asset_types at ON apd.asset_type_id = at.id
                ORDER BY at.code, apd.key
            """))
            all_rows = result2.fetchall()
            for row in all_rows:
                print(f"  [{row.asset_type}] {row.key}: {row.label_he} / {row.label_en}")
            return

        print(f"Found {len(rows)} test property definitions:")
        for row in rows:
            print(f"  ID: {row.id}")
            print(f"    Key: {row.key}")
            print(f"    Label HE: {row.label_he}")
            print(f"    Label EN: {row.label_en}")
            print()

        # Step 2: Delete test property definitions
        print("=" * 60)
        print("STEP 2: Deleting test property definitions...")
        print("=" * 60)

        # First delete any property values that reference these definitions
        ids = [str(row.id) for row in rows]
        ids_str = ", ".join([f"'{id}'" for id in ids])

        print(f"Deleting property values for {len(ids)} definitions...")
        conn.execute(text(f"""
            DELETE FROM asset_property_values
            WHERE property_definition_id IN ({ids_str})
        """))

        print(f"Deleting {len(ids)} property definitions...")
        conn.execute(text(f"""
            DELETE FROM asset_property_definitions
            WHERE id IN ({ids_str})
        """))

        conn.commit()
        print("Done! Test property definitions deleted.")

        # Step 3: Verify deletion
        print("=" * 60)
        print("STEP 3: Verification...")
        print("=" * 60)

        result3 = conn.execute(text("""
            SELECT COUNT(*) as count
            FROM asset_property_definitions
            WHERE key LIKE '%test%'
               OR key LIKE '%custom%'
               OR key LIKE '%בדיקה%'
               OR label_he LIKE '%שדה בדיקה%'
               OR label_he LIKE '%בדיקה מותאם%'
        """))
        count = result3.fetchone().count

        if count == 0:
            print("SUCCESS: No test property definitions remain in database.")
        else:
            print(f"WARNING: {count} test property definitions still exist.")


if __name__ == "__main__":
    main()
