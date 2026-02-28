# Mass Deletion Script for Non-NVR Assets

## Overview

This script (`delete_non_nvr_assets.py`) safely deletes all assets that are NOT of type 'NVR' from the database, along with all their related data.

**Location:** `backend/scripts/delete_non_nvr_assets.py`

## What Gets Deleted

### Primary Deletion
- All assets where `asset_type.code != 'NVR'`
- Examples: ROUTER, SWITCH, ACCESS_POINT, PC, PRINTER, SERVER, ALARM, DVR, etc.

### Automatically Deleted (CASCADE)
- `asset_property_values` - Dynamic properties
- `asset_events` - Audit trail and history
- `nvr_disks` - Disk records (if any)
- `nvr_channels` - Channel configurations (if any)
- `ticket_asset_links` - M2M links to tickets
- `project_asset_links` - M2M links to projects

### Automatically Updated (SET NULL)
- `tickets.asset_id` → NULL
- `ticket_line_items.linked_asset_id` → NULL

### Manual Cleanup Required
- **Attachments**: File records are deleted from DB, but physical files must be manually deleted
  - File paths are saved to `attachment_cleanup_log.txt` for review

## Safety Features

1. **Localhost-Only**: Script refuses to run if database is not on localhost
2. **Preview Mode**: Default mode shows what will be deleted without making changes
3. **Explicit Confirmation**: Execute mode requires both `--confirm` flag and typing 'yes'
4. **Batch Processing**: Deletes in batches with individual transactions
5. **Error Recovery**: Failed batches are rolled back; script continues with next batch

## Usage

### 1. Preview Mode (Recommended First Step)

```bash
# Basic preview
python backend/scripts/delete_non_nvr_assets.py

# Detailed preview with sample assets
python backend/scripts/delete_non_nvr_assets.py --verbose
```

**Output Example:**
```
======================================================================
PREVIEW: Assets to be Deleted (Non-NVR Equipment)
======================================================================

Total assets to delete: 291

Breakdown by asset type:
  OTHER               :    128 assets
  ACCESS_POINT        :     45 assets
  PC                  :     34 assets
  SWITCH              :     31 assets
  ...
```

### 2. Execute Deletion

```bash
# Execute with default batch size (100)
python backend/scripts/delete_non_nvr_assets.py --execute --confirm

# Execute with custom batch size
python backend/scripts/delete_non_nvr_assets.py --execute --confirm --batch-size 50
```

**Process:**
1. Shows preview summary
2. Asks for final confirmation (type 'yes')
3. Deletes assets in batches
4. Shows progress for each batch
5. Saves attachment file paths to log
6. Shows final summary

### 3. Cleanup Attachments (After Execution)

```bash
# Review attachment file paths
cat backend/scripts/attachment_cleanup_log.txt

# Manually verify and delete files
# (Script does NOT auto-delete files for safety)
```

## Command-Line Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--execute` | flag | False | Execute deletion (default: preview mode) |
| `--confirm` | flag | False | Required confirmation for execute mode |
| `--verbose` | flag | False | Show detailed info in preview mode |
| `--batch-size` | int | 100 | Assets per transaction (1-1000) |

## Examples

```bash
# Step 1: Preview what will be deleted
python backend/scripts/delete_non_nvr_assets.py

# Step 2: See sample assets
python backend/scripts/delete_non_nvr_assets.py --verbose

# Step 3: Execute deletion
python backend/scripts/delete_non_nvr_assets.py --execute --confirm

# Step 4: Review and cleanup files
cat backend/scripts/attachment_cleanup_log.txt
```

## Output Files

- `attachment_cleanup_log.txt` - List of file paths to manually delete (created only if attachments exist)

## Verification After Deletion

Run these SQL queries to verify success:

```sql
-- Check only NVR assets remain
SELECT asset_types.code, COUNT(assets.id)
FROM assets
JOIN asset_types ON assets.asset_type_id = asset_types.id
GROUP BY asset_types.code;
-- Expected: Only 'NVR' should appear

-- Check no orphaned property values
SELECT COUNT(*)
FROM asset_property_values apv
LEFT JOIN assets a ON apv.asset_id = a.id
WHERE a.id IS NULL;
-- Expected: 0

-- Check no orphaned events
SELECT COUNT(*)
FROM asset_events ae
LEFT JOIN assets a ON ae.asset_id = a.id
WHERE a.id IS NULL;
-- Expected: 0

-- Check no broken FK references
SELECT COUNT(*)
FROM tickets t
WHERE t.asset_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM assets WHERE id = t.asset_id);
-- Expected: 0
```

## Important Notes

### Irreversible Operation
- **There is NO undo** - Make a database backup before execution
- Preview mode is safe and makes no changes
- Execute mode permanently deletes data

### Batch Processing
- Default batch size: 100 assets per transaction
- Each batch is a separate transaction (BEGIN...COMMIT)
- Failed batches are rolled back automatically
- Successful batches cannot be rolled back

### Performance
- Recommended batch size: 50-200 assets
- Smaller batches: Safer, slower
- Larger batches: Faster, more memory usage

### Database Requirements
- PostgreSQL with CASCADE constraints configured
- Tables: assets, asset_types, asset_property_values, asset_events, nvr_disks, nvr_channels, ticket_asset_links, project_asset_links, attachments
- Localhost database only (production safety)

## Troubleshooting

### Error: "Can only run on localhost"
**Solution:** Script is designed for localhost only. To run on remote DB, you must modify the safety check (NOT recommended).

### Error: "Execute mode requires --confirm flag"
**Solution:** Add `--confirm` flag: `python ... --execute --confirm`

### Error: Database table does not exist
**Solution:** Script handles missing optional tables (nvr_disks, nvr_channels) gracefully. Other missing tables indicate incomplete migration.

### Batch errors during execution
**Behavior:** Script rolls back failed batch and continues with next batch. Check error message in output.

## Exit Codes

- `0` - Success
- `1` - Error (localhost check failed, missing --confirm, unexpected error, or Ctrl+C)

## Author Notes

- Script tested on demo database with 291 non-NVR assets
- All CASCADE and SET NULL constraints verified
- Attachment cleanup logged for manual review
- Compatible with Windows and Unix systems
