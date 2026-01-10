# Database Migration Scripts

This directory contains utility scripts for database maintenance and migrations.

## Enum Conversion Script

### Overview
Converts enum values from lowercase to uppercase to match Prisma schema requirements.

### What It Does
Converts all enum values in the database:
- `draft` → `DRAFT`
- `active` → `ACTIVE`
- `threads` → `THREADS`
- And all other enum values...

### Features

- **Idempotent**: Safe to run multiple times - skips already converted values
- **Dry-run mode**: Preview changes without executing
- **SQL Injection Safe**: Uses parameterized queries
- **Complete Verification**: Verifies all conversions succeeded
- **Detailed Output**: Shows progress and affected rows

### ⚠️ Important Notes

**BEFORE RUNNING:**
1. **BACKUP YOUR DATABASE** - This script modifies data directly
2. **Stop the application** - Ensure no writes are happening during conversion
3. **Run dry-run first** - Preview changes before executing
4. **Run in development first** - Test on a development database before production

**AFTER RUNNING:**
1. **Verify data integrity** - Check that all conversions were successful
2. **Restart the application** - The app will expect uppercase enum values
3. **Run tests** - Ensure everything works with new enum values

### Usage

**Step 1: Dry-run (Recommended)**
```bash
npm run convert:enums -- --dry-run
```

**Step 2: Apply changes**
```bash
npm run convert:enums
```

**Or run TypeScript script directly**
```bash
npx tsx scripts/convert-enums-to-uppercase.ts
npx tsx scripts/convert-enums-to-uppercase.ts --dry-run
```

### Tables Modified

The script modifies the following tables:
- `posts` - status, content_type
- `post_publications` - status, platform
- `social_accounts` - status, health, platform
- `media` - type
- `uploaded_media` - type, status
- `analytics` - platform, period
- `users` - role
- `refresh_tokens` - status

### Verification

The script automatically verifies conversions after completion. It checks all enum columns and reports:
- ✓ Successful conversions (uppercase values)
- ⚠️ Failed conversions (lowercase values still present)

### Troubleshooting

**Error: "column does not exist"**
- Ensure your database schema is up to date: `npm run db:push`

**Error: "relation does not exist"**
- Run the TypeORM to Prisma migration first

**Some values not converted**
- The script is idempotent - you can safely re-run it
- Check the verification output for details

**Connection errors**
- Verify DATABASE_URL is set correctly
- Ensure PostgreSQL is running
- Check database credentials

## Other Scripts

### Seed Database
```bash
npm run db:seed
```

### Publish Scheduled Posts
```bash
npm run cron:publish
```
