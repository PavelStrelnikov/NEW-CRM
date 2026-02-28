#!/usr/bin/env python3
"""
Mass deletion script for non-NVR assets.

This script deletes all assets that are NOT of type 'NVR', along with their
related data (properties, events, disks, channels, links, attachments).

IMPORTANT: This script is IRREVERSIBLE and should only be run on localhost.
Always use --verbose in preview mode first to verify what will be deleted.

Usage:
    # Preview mode (safe, shows what would be deleted)
    python backend/scripts/delete_non_nvr_assets.py --verbose

    # Execute deletion (requires confirmation)
    python backend/scripts/delete_non_nvr_assets.py --execute --confirm

    # Execute with custom batch size
    python backend/scripts/delete_non_nvr_assets.py --execute --confirm --batch-size 50

Args:
    --execute: Run actual deletion (default: preview mode)
    --confirm: Required confirmation flag for execution mode
    --verbose: Show detailed information in preview mode
    --batch-size: Number of assets to delete per transaction (default: 100)
"""

import sys
import os
import argparse
from pathlib import Path
from typing import List, Dict, Any, Tuple
from uuid import UUID

# Add backend directory to Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

# Import database session
from app.db.session import SessionLocal
from app.config import settings

# Import models
from app.models.assets import (
    Asset, AssetType, AssetPropertyValue, AssetEvent,
    NVRDisk, NVRChannel
)
from app.models.attachments import Attachment, LinkedType
from app.models.tickets import Ticket
from app.models.time_billing import TicketLineItem


def verify_database_is_localhost() -> bool:
    """
    Safety check: ensure script only runs on localhost databases.

    Returns:
        bool: True if database is on localhost, False otherwise
    """
    db_url = settings.DATABASE_URL
    if 'localhost' not in db_url and '127.0.0.1' not in db_url:
        print("[X] ERROR: This script can only run on localhost databases!")
        print(f"   Current DATABASE_URL: {db_url}")
        print("   Refusing to run to prevent data loss in production.")
        return False
    return True


def get_assets_to_delete(db: Session) -> List[UUID]:
    """
    Get list of asset UUIDs that should be deleted (all non-NVR assets).

    Args:
        db: Database session

    Returns:
        List of asset UUIDs to delete
    """
    stmt = (
        select(Asset.id)
        .join(AssetType, Asset.asset_type_id == AssetType.id)
        .where(AssetType.code != 'NVR')
        .order_by(Asset.created_at)
    )
    result = db.execute(stmt)
    asset_ids = [row[0] for row in result.fetchall()]
    return asset_ids


def get_deletion_preview(db: Session) -> Dict[str, Any]:
    """
    Get statistics about what will be deleted (preview mode).

    Args:
        db: Database session

    Returns:
        Dictionary with counts and breakdown information
    """
    # Get asset counts by type (excluding NVR)
    asset_type_counts = {}
    stmt = (
        select(AssetType.code, func.count(Asset.id))
        .join(AssetType, Asset.asset_type_id == AssetType.id)
        .where(AssetType.code != 'NVR')
        .group_by(AssetType.code)
        .order_by(func.count(Asset.id).desc())
    )
    result = db.execute(stmt)
    for code, count in result.fetchall():
        asset_type_counts[code] = count

    total_assets = sum(asset_type_counts.values())

    # Get asset IDs for related counts
    asset_ids = get_assets_to_delete(db)

    # Count related records
    property_values_count = db.query(func.count(AssetPropertyValue.id)).filter(
        AssetPropertyValue.asset_id.in_(asset_ids)
    ).scalar() if asset_ids else 0

    asset_events_count = db.query(func.count(AssetEvent.id)).filter(
        AssetEvent.asset_id.in_(asset_ids)
    ).scalar() if asset_ids else 0

    # Count NVR-related records (may not exist in all DB versions)
    try:
        nvr_disks_count = db.query(func.count(NVRDisk.id)).filter(
            NVRDisk.asset_id.in_(asset_ids)
        ).scalar() if asset_ids else 0
    except Exception:
        db.rollback()
        nvr_disks_count = 0

    try:
        nvr_channels_count = db.query(func.count(NVRChannel.id)).filter(
            NVRChannel.asset_id.in_(asset_ids)
        ).scalar() if asset_ids else 0
    except Exception:
        db.rollback()
        nvr_channels_count = 0

    # Count M2M links (using raw SQL since we have association tables)
    from sqlalchemy import text
    ticket_links_count = db.execute(
        text("SELECT COUNT(*) FROM ticket_asset_links WHERE asset_id = ANY(:ids)"),
        {"ids": asset_ids}
    ).scalar() if asset_ids else 0

    project_links_count = db.execute(
        text("SELECT COUNT(*) FROM project_asset_links WHERE asset_id = ANY(:ids)"),
        {"ids": asset_ids}
    ).scalar() if asset_ids else 0

    # Count FK references that will be SET NULL
    tickets_with_asset_count = db.query(func.count(Ticket.id)).filter(
        Ticket.asset_id.in_(asset_ids)
    ).scalar() if asset_ids else 0

    line_items_with_asset_count = db.query(func.count(TicketLineItem.id)).filter(
        TicketLineItem.linked_asset_id.in_(asset_ids)
    ).scalar() if asset_ids else 0

    # Count attachments
    attachments_count = db.query(func.count(Attachment.id)).filter(
        and_(
            Attachment.linked_type == LinkedType.ASSET.value,
            Attachment.linked_id.in_(asset_ids)
        )
    ).scalar() if asset_ids else 0

    return {
        'total_assets': total_assets,
        'asset_type_counts': asset_type_counts,
        'asset_ids': asset_ids,
        'related_counts': {
            'asset_property_values': property_values_count,
            'asset_events': asset_events_count,
            'nvr_disks': nvr_disks_count,
            'nvr_channels': nvr_channels_count,
            'ticket_asset_links': ticket_links_count,
            'project_asset_links': project_links_count,
        },
        'fk_updates': {
            'tickets.asset_id': tickets_with_asset_count,
            'ticket_line_items.linked_asset_id': line_items_with_asset_count,
        },
        'attachments_count': attachments_count,
    }


def cleanup_attachments_for_assets(db: Session, asset_ids: List[UUID]) -> List[str]:
    """
    Delete attachment records for given assets and return file paths for manual cleanup.

    Args:
        db: Database session
        asset_ids: List of asset UUIDs

    Returns:
        List of storage paths that need manual file deletion
    """
    if not asset_ids:
        return []

    # Query attachments
    attachments = db.query(Attachment).filter(
        and_(
            Attachment.linked_type == LinkedType.ASSET.value,
            Attachment.linked_id.in_(asset_ids)
        )
    ).all()

    # Collect storage paths
    storage_paths = [att.storage_path for att in attachments]

    # Delete attachment records
    for attachment in attachments:
        db.delete(attachment)

    return storage_paths


def delete_assets_batch(db: Session, asset_ids: List[UUID]) -> Tuple[int, List[str]]:
    """
    Delete a batch of assets and their attachments.

    CASCADE will automatically delete:
    - asset_property_values
    - asset_events
    - nvr_disks
    - nvr_channels
    - ticket_asset_links
    - project_asset_links

    SET NULL will automatically update:
    - tickets.asset_id
    - ticket_line_items.linked_asset_id

    Args:
        db: Database session
        asset_ids: List of asset UUIDs to delete

    Returns:
        Tuple of (deleted_count, attachment_paths)
    """
    if not asset_ids:
        return (0, [])

    # First, cleanup attachments
    attachment_paths = cleanup_attachments_for_assets(db, asset_ids)

    # Delete assets (CASCADE does the rest)
    deleted_count = db.query(Asset).filter(
        Asset.id.in_(asset_ids)
    ).delete(synchronize_session=False)

    return (deleted_count, attachment_paths)


def preview_mode(db: Session, verbose: bool = False) -> None:
    """
    Preview mode: show what would be deleted without making changes.

    Args:
        db: Database session
        verbose: Show detailed information including sample assets
    """
    print("\n" + "="*70)
    print("PREVIEW: Assets to be Deleted (Non-NVR Equipment)")
    print("="*70)

    preview = get_deletion_preview(db)

    print(f"\nTotal assets to delete: {preview['total_assets']:,}")

    if preview['total_assets'] == 0:
        print("\n[OK] No non-NVR assets found. Nothing to delete.")
        print("="*70)
        return

    # Breakdown by asset type
    print("\nBreakdown by asset type:")
    for asset_type, count in preview['asset_type_counts'].items():
        print(f"  {asset_type:20s}: {count:6,} assets")

    # Related records (will be CASCADE deleted)
    print("\nRelated records (will be CASCADE deleted):")
    for table, count in preview['related_counts'].items():
        print(f"  {table:30s}: {count:6,}")

    # Foreign keys (will be SET NULL)
    print("\nForeign keys (will be SET NULL):")
    for fk, count in preview['fk_updates'].items():
        print(f"  {fk:30s}: {count:6,}")

    # Attachments (files need manual cleanup)
    print(f"\nAttachments (files need manual cleanup):")
    print(f"  Total attachments:                {preview['attachments_count']:6,}")

    # Verbose mode: show sample assets
    if verbose and preview['asset_ids']:
        print("\n" + "-"*70)
        print("Sample assets to be deleted (first 10):")
        print("-"*70)

        sample_ids = preview['asset_ids'][:10]
        sample_assets = db.query(Asset).filter(Asset.id.in_(sample_ids)).all()

        for asset in sample_assets:
            asset_type = db.query(AssetType).filter(AssetType.id == asset.asset_type_id).first()
            print(f"  [{asset_type.code:15s}] {asset.label or 'Unnamed'}")
            print(f"    ID: {asset.id}")
            if asset.client_id:
                print(f"    Client ID: {asset.client_id}")
            if asset.site_id:
                print(f"    Site ID: {asset.site_id}")
            print()

        # Show sample attachment paths if any
        if preview['attachments_count'] > 0:
            print("-"*70)
            print("Sample attachment paths (first 5):")
            print("-"*70)

            sample_attachments = db.query(Attachment).filter(
                and_(
                    Attachment.linked_type == LinkedType.ASSET.value,
                    Attachment.linked_id.in_(sample_ids)
                )
            ).limit(5).all()

            for att in sample_attachments:
                print(f"  {att.storage_path}")

    # Warning
    print("\n" + "="*70)
    print("[!]  WARNING: This operation is IRREVERSIBLE!")
    print("="*70)
    print("\nTo execute deletion, run:")
    print("  python backend/scripts/delete_non_nvr_assets.py --execute --confirm")
    print("="*70)


def execute_mode(db: Session, batch_size: int = 100) -> None:
    """
    Execute mode: perform actual deletion with batch processing.

    Args:
        db: Database session
        batch_size: Number of assets to delete per transaction
    """
    # First show preview
    print("\n" + "="*70)
    print("EXECUTE MODE: Deletion Preview")
    print("="*70)

    preview = get_deletion_preview(db)

    print(f"\nTotal assets to delete: {preview['total_assets']:,}")

    if preview['total_assets'] == 0:
        print("\n[OK] No non-NVR assets found. Nothing to delete.")
        print("="*70)
        return

    # Show brief summary
    print("\nAsset types:")
    for asset_type, count in list(preview['asset_type_counts'].items())[:5]:
        print(f"  {asset_type:20s}: {count:6,}")
    if len(preview['asset_type_counts']) > 5:
        print(f"  ... and {len(preview['asset_type_counts']) - 5} more types")

    print(f"\nTotal related records to delete: {sum(preview['related_counts'].values()):,}")
    print(f"Total FK updates (SET NULL): {sum(preview['fk_updates'].values()):,}")
    print(f"Total attachments to cleanup: {preview['attachments_count']:,}")

    # Final confirmation
    print("\n" + "="*70)
    print("[!]  FINAL CONFIRMATION REQUIRED")
    print("="*70)
    print("This will PERMANENTLY DELETE all non-NVR assets and related data.")
    print("This operation CANNOT be undone.")
    print("\nType 'yes' to proceed (anything else to cancel): ", end='')

    confirmation = input()
    if confirmation.lower() != 'yes':
        print("\n[X] Deletion cancelled by user.")
        return

    # Start deletion
    print("\n" + "="*70)
    print("DELETION IN PROGRESS")
    print("="*70)

    asset_ids = preview['asset_ids']
    total_batches = (len(asset_ids) + batch_size - 1) // batch_size

    total_deleted = 0
    total_attachment_paths = []
    batch_errors = []

    # Process in batches
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(asset_ids))
        batch_ids = asset_ids[start_idx:end_idx]

        try:
            # Each batch is a separate transaction
            deleted_count, attachment_paths = delete_assets_batch(db, batch_ids)
            db.commit()

            total_deleted += deleted_count
            total_attachment_paths.extend(attachment_paths)

            # Progress indicator
            progress_pct = ((batch_num + 1) / total_batches) * 100
            print(f"\n{'='*70}")
            print(f"Progress: Batch {batch_num + 1}/{total_batches} ({progress_pct:.1f}%)")
            print(f"{'='*70}")
            print(f"Deleted this batch:      {deleted_count:6,}")
            print(f"Total deleted so far:    {total_deleted:6,}")
            print(f"Attachments this batch:  {len(attachment_paths):6,}")
            print(f"{'='*70}")

        except Exception as e:
            db.rollback()
            batch_errors.append((batch_num + 1, str(e)))
            print(f"\n[FAIL] Batch {batch_num + 1}/{total_batches}: ERROR")
            print(f"   {e}")
            print(f"   Rolling back batch and continuing...")
            continue

    # Save attachment paths to file
    if total_attachment_paths:
        log_file = Path(__file__).parent / 'attachment_cleanup_log.txt'
        with open(log_file, 'w', encoding='utf-8') as f:
            for path in total_attachment_paths:
                f.write(f"{path}\n")
        print(f"\n[LOG] Attachment paths saved to: {log_file}")

    # Final summary
    print("\n" + "="*70)
    print("DELETION SUMMARY")
    print("="*70)
    print(f"Total assets deleted:           {total_deleted:6,}")
    print(f"Successful batches:             {total_batches - len(batch_errors):6,}")
    print(f"Failed batches:                 {len(batch_errors):6,}")
    print(f"Attachments to cleanup:         {len(total_attachment_paths):6,}")

    if batch_errors:
        print("\n[X] Batch errors:")
        for batch_num, error in batch_errors:
            print(f"   Batch {batch_num}: {error}")

    print("\nAutomatically deleted (CASCADE):")
    print("  [OK] asset_property_values")
    print("  [OK] asset_events (audit trail)")
    print("  [OK] nvr_disks")
    print("  [OK] nvr_channels")
    print("  [OK] ticket_asset_links")
    print("  [OK] project_asset_links")

    print("\nAutomatically updated (SET NULL):")
    print("  [OK] tickets.asset_id")
    print("  [OK] ticket_line_items.linked_asset_id")

    if total_attachment_paths:
        print(f"\n[LOG] Attachment files to delete:")
        print(f"   File list saved to: attachment_cleanup_log.txt")
        print("\n[!]  Next steps:")
        print("   1. Review attachment_cleanup_log.txt")
        print("   2. Verify files can be deleted")
        print("   3. Manually delete files from storage")

    print("="*70)
    print("[OK] Deletion complete!")
    print("="*70)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Mass deletion script for non-NVR assets',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview mode (safe, default)
  python backend/scripts/delete_non_nvr_assets.py

  # Preview with detailed information
  python backend/scripts/delete_non_nvr_assets.py --verbose

  # Execute deletion
  python backend/scripts/delete_non_nvr_assets.py --execute --confirm

  # Execute with custom batch size
  python backend/scripts/delete_non_nvr_assets.py --execute --confirm --batch-size 50
        """
    )

    parser.add_argument(
        '--execute',
        action='store_true',
        help='Execute deletion (default: preview mode)'
    )
    parser.add_argument(
        '--confirm',
        action='store_true',
        help='Required confirmation flag for execute mode'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show detailed information in preview mode'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='Number of assets to delete per transaction (default: 100)'
    )

    args = parser.parse_args()

    # Safety check: localhost only
    if not verify_database_is_localhost():
        sys.exit(1)

    # Execute mode requires --confirm flag
    if args.execute and not args.confirm:
        print("[X] ERROR: Execute mode requires --confirm flag for safety.")
        print("   Run with: --execute --confirm")
        sys.exit(1)

    # Create database session
    db = SessionLocal()

    try:
        if args.execute:
            execute_mode(db, batch_size=args.batch_size)
        else:
            preview_mode(db, verbose=args.verbose)

    except KeyboardInterrupt:
        print("\n\n[X] Operation cancelled by user (Ctrl+C)")
        db.rollback()
        sys.exit(1)

    except Exception as e:
        print(f"\n[X] Unexpected error: {e}")
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == '__main__':
    main()
