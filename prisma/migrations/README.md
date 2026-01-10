# Enum Migration Guide

This directory contains migrations to convert enum values from lowercase to uppercase.

## Migration Workflow

### Step 1: Add Uppercase Enum Values
```bash
npm run migrate:add:uppercase
```
**What it does:** Adds uppercase enum values to all enum types while keeping lowercase values.
**Safe:** Yes - no data loss, no breaking changes.

### Step 2: Convert Data
```bash
npm run convert:enums
```
**What it does:** Converts all data from lowercase to uppercase.
**Safe:** Yes - idempotent, can be re-run.

### Step 3: Remove Lowercase Enum Values (OPTIONAL)
```bash
npm run migrate:remove:lowercase
```
**What it does:** Removes lowercase enum values from enum types.
**Safe:** Only if Step 2 completed successfully - will fail if any lowercase values remain.

## Detailed Steps

### 1. Backup Database (Recommended)
```bash
pg_dump $DATABASE_URL > backup_before_enum_migration.sql
```

### 2. Add Uppercase Values
```bash
npm run migrate:add:uppercase
```
Or manually:
```bash
psql $DATABASE_URL -f prisma/migrations/20250110_add_uppercase_enum_values/migration.sql
```

### 3. Verify Uppercase Values Added
```sql
-- Check enum type
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'posts_status_enum'::regtype ORDER BY enumsortorder;
-- Should show both lowercase and uppercase values
```

### 4. Convert Data (Dry-run First)
```bash
npm run convert:enums -- --dry-run
```

### 5. Convert Data (For Real)
```bash
npm run convert:enums
```

### 6. Verify Data Conversion
```sql
-- Check for any remaining lowercase values (should return 0)
SELECT COUNT(*) FROM posts WHERE status = 'draft';
SELECT COUNT(*) FROM social_accounts WHERE status = 'active';
SELECT COUNT(*) FROM users WHERE role = 'admin';
```

### 7. Remove Lowercase Values (OPTIONAL)
```bash
npm run migrate:remove:lowercase
```
Or manually:
```bash
psql $DATABASE_URL -f prisma/migrations/20250110_remove_lowercase_enum_values/migration.sql
```

### 8. Restart Application
```bash
npm run dev
# or for production
npm run build && npm run start
```

## Rollback

If you need to rollback:

### Before Step 3 (Remove Lowercase)
No rollback needed - lowercase values still exist.

### After Step 3 (Remove Lowercase)
You'll need to:
1. Stop the application
2. Re-add lowercase values (reverse of Step 1)
3. Convert data back to lowercase
4. Remove uppercase values

## Troubleshooting

**Error: "enum value already exists"**
- Safe to ignore - the migration uses `IF NOT EXISTS`

**Error: "column cannot be cast automatically"**
- Some data still has lowercase values - run conversion script again

**Error: "permission denied"**
- Check database user permissions for ALTER TYPE

## What Each Migration Does

### 20250110_add_uppercase_enum_values
Adds uppercase enum values to all 14 enum types:
- posts_status_enum
- post_publications_status_enum
- posts_content_type_enum
- social_accounts_status_enum
- social_accounts_health_enum
- social_accounts_platform_enum
- post_publications_platform_enum
- analytics_platform_enum
- media_type_enum
- uploaded_media_type_enum
- uploaded_media_status_enum
- analytics_period_enum
- users_role_enum
- refresh_tokens_status_enum

### 20250110_remove_lowercase_enum_values
Removes lowercase enum values from all 14 enum types.
Uses a helper function `remove_enum_value()` that:
1. Creates a new enum type without the lowercase value
2. Converts all columns using the old type to the new type
3. Handles default values
4. Drops the old type and renames the new one

**WARNING:** Only run this after data conversion is complete!
