"""Cleanup duplicate NVR disks by serial number.

Revision ID: 20260116_213044
Revises: 20260116_185229
Create Date: 2026-01-16

This migration removes duplicate disk entries that were created due to a bug
in the probe-and-save logic. For each asset, if multiple disks have the same
serial number, we keep only the most recently updated one.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '20260116_213044'
down_revision = '20260116_185229'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove duplicate NVR disks, keeping the most recently updated."""
    connection = op.get_bind()

    # Find and delete duplicate disks
    # For each (asset_id, serial_number) pair, keep only the disk with the latest updated_at
    result = connection.execute(text("""
        WITH duplicates AS (
            SELECT id,
                   asset_id,
                   serial_number,
                   updated_at,
                   ROW_NUMBER() OVER (
                       PARTITION BY asset_id, UPPER(TRIM(serial_number))
                       ORDER BY updated_at DESC
                   ) as rn
            FROM nvr_disks
            WHERE serial_number IS NOT NULL
              AND TRIM(serial_number) != ''
        )
        SELECT id, asset_id, serial_number
        FROM duplicates
        WHERE rn > 1
    """))

    duplicates = result.fetchall()

    if duplicates:
        print(f"Found {len(duplicates)} duplicate disk(s) to delete:")
        for dup in duplicates:
            print(f"  - Deleting disk id={dup[0]}, asset_id={dup[1]}, serial={dup[2]}")

        # Delete the duplicates
        duplicate_ids = [str(dup[0]) for dup in duplicates]
        if duplicate_ids:
            connection.execute(text(f"""
                DELETE FROM nvr_disks
                WHERE id IN ({','.join([f"'{id}'" for id in duplicate_ids])})
            """))
            print(f"Deleted {len(duplicate_ids)} duplicate disk(s)")
    else:
        print("No duplicate disks found")

    # Also add a unique constraint to prevent future duplicates
    # But first check if there would be conflicts
    # Note: We can't add a unique constraint because slot_number can be NULL
    # and serial_number is optional. Instead, the application logic handles this.


def downgrade() -> None:
    """Downgrade is a no-op - we can't restore deleted duplicates."""
    pass
