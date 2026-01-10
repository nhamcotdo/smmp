# Manual Migration Guide

This guide provides step-by-step instructions for manually creating and applying database migrations, following the official [Prisma Migrate workflows](https://www.prisma.io/docs/orm/prisma-migrate/getting-started).

## ⚠️ IMPORTANT

- **NEVER AUTO-COMMIT MIGRATION CODE**
- **Read documentation carefully before running**
- **BACKUP DATABASE before running migrations**
- **Always test on local/staging first**

## Workflow Overview

The manual migration workflow:

1. Create migration file
2. Write SQL migration
3. Review migration
4. Test on LOCAL database first
5. Backup PRODUCTION database
6. Apply to PRODUCTION (only after testing)
7. Mark as applied
8. Commit (only after successful application)

## Step 1: Create Migration File

### Using Custom Script (Recommended)

```bash
# Create migration with descriptive name
npx tsx scripts/create-migration.ts --name add_user_preferences_column

# Example outputs:
# prisma/migrations/20250110_add_user_preferences_column/
# └── migration.sql
```

### Manual Creation

```bash
# Create migration directory manually
mkdir -p prisma/migrations/20250110_add_user_preferences_column

# Create migration SQL file
touch prisma/migrations/20250110_add_user_preferences_column/migration.sql
```

**Migration naming convention**: `YYYYMMDD_description` or `0_init` for baseline

## Step 2: Write SQL Migration

Edit the migration file:

```bash
vim prisma/migrations/20250110_add_user_preferences_column/migration.sql
```

### Migration Template

```sql
-- Migration: add_user_preferences_column
-- Created: 2025-01-10
--
-- Description: Add preferences column to users table for storing user settings
--
-- Rollback:
--   ALTER TABLE users DROP COLUMN preferences;
--
-- Changes:
--   - Add preferences JSONB column to users table
--   - Create index for common preference queries

-- Add column (nullable for existing rows)
ALTER TABLE users ADD COLUMN preferences JSONB;

-- Create GIN index for JSONB queries
CREATE INDEX idx_users_preferences ON users USING GIN (preferences);

-- Add comment for documentation
COMMENT ON COLUMN users.preferences IS 'User preferences stored as JSONB';
```

### Common SQL Patterns

#### Add Column

```sql
-- Add nullable column
ALTER TABLE users ADD COLUMN "theme" VARCHAR(50);

-- Add column with default value
ALTER TABLE users ADD COLUMN "is_verified" BOOLEAN DEFAULT false;

-- Add NOT NULL column (only if table is empty or has default)
ALTER TABLE users ADD COLUMN "created_at" TIMESTAMPTZ(3) DEFAULT NOW() NOT NULL;
```

#### Add Index

```sql
-- Single column index
CREATE INDEX idx_posts_user_id ON posts("user_id");

-- Unique index
CREATE UNIQUE INDEX idx_users_email ON users("email");

-- Composite index
CREATE INDEX idx_posts_user_status ON posts("user_id", "status");

-- Partial index (only certain rows)
CREATE INDEX idx_posts_published ON posts("published_at")
WHERE "status" = 'PUBLISHED';

-- GIN index for JSON/JSONB
CREATE INDEX idx_users_preferences ON users USING GIN ("preferences");
```

#### Modify Column Type

```sql
-- String -> Integer
ALTER TABLE posts ALTER COLUMN "views" TYPE INTEGER
USING "views"::INTEGER;

-- Text -> Text with limit
ALTER TABLE users ALTER COLUMN "bio" TYPE VARCHAR(500);

-- String -> Enum (values already exist)
ALTER TABLE users ALTER COLUMN "role" TYPE "users_role_enum"
USING "role"::text::users_role_enum;
```

#### Rename Column

```sql
ALTER TABLE users RENAME COLUMN "name" TO "full_name";
```

#### Add Foreign Key

```sql
-- Add foreign key with CASCADE
ALTER TABLE posts
ADD CONSTRAINT "posts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE;

-- Add foreign key with SET NULL
ALTER TABLE posts
ADD CONSTRAINT "posts_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE SET NULL;
```

#### Drop Column (USE WITH CAUTION)

```sql
-- Drop column directly (WILL LOSE DATA)
ALTER TABLE users DROP COLUMN "old_column";

-- Drop column only if exists (SAFER)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'old_column'
  ) THEN
    ALTER TABLE users DROP COLUMN "old_column";
  END IF;
END $$;
```

#### Add Enum Value

```sql
-- Add new enum value (only if not exists)
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'ARCHIVED';
```

#### Create Table

```sql
CREATE TABLE "notifications" (
  "id" VARCHAR(36) PRIMARY KEY,
  "user_id" VARCHAR(36) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "data" JSONB,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications("user_id");
CREATE INDEX idx_notifications_created_at ON notifications("created_at");
```

## Step 3: Review Migration

```bash
# View migration content
cat prisma/migrations/20250110_add_user_preferences_column/migration.sql

# Check migration status
npx prisma migrate status

# Validate SQL syntax (optional)
psql $DATABASE_URL -f prisma/migrations/20250110_add_user_preferences_column/migration.sql --dry-run
```

## Step 4: TEST ON LOCAL DATABASE FIRST

```bash
# Apply migration to local database
psql $DATABASE_URL -f prisma/migrations/20250110_add_user_preferences_column/migration.sql

# Or use Prisma (if shadow DB available)
npx prisma migrate dev
```

### Verify Migration

```bash
# Check table structure
psql $DATABASE_URL -c "\d users"

# Check indexes
psql $DATABASE_URL -c "\di"

# Check specific data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Run application tests
npm run dev
npm run test
```

### Rollback if Failed

If migration has issues:

```sql
-- Rollback: Drop column
ALTER TABLE users DROP COLUMN preferences;

-- Rollback: Drop index
DROP INDEX IF EXISTS idx_users_preferences;
```

Then:
```bash
# Mark as rolled back
npx prisma migrate resolve --rolled-back 20250110_add_user_preferences_column
```

## Step 5: Apply to PRODUCTION (AFTER TESTING)

⚠️ **ONLY RUN AFTER SUCCESSFUL LOCAL TESTING**

```bash
# 1. BACKUP PRODUCTION DATABASE
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration
psql $DATABASE_URL -f prisma/migrations/20250110_add_user_preferences_column/migration.sql

# 3. Verify production
psql $DATABASE_URL -c "\d users"
psql $DATABASE_URL -c "\di"
```

## Step 6: Mark Migration as Applied

```bash
# Tell Prisma migration was applied
npx prisma migrate resolve --applied 20250110_add_user_preferences_column
```

## Step 7: Commit (ONLY AFTER SUCCESSFUL APPLICATION)

```bash
# Commit migration files
git add prisma/migrations/20250110_add_user_preferences_column/
git add prisma/schema.prisma

# Commit with descriptive message
git commit -m "feat: add user preferences column

- Add preferences JSONB column to users table
- Create GIN index for efficient queries
- Add documentation comment"
```

**Important**: Commit BOTH `migrations/` AND `schema.prisma` as required by [Prisma team workflow](https://www.prisma.io/docs/guides/implementing-schema-changes#source-control-requirements).

## Team Workflow

When working with a team, follow this workflow to avoid conflicts:

### Before Creating Migrations

```bash
# 1. Pull latest changes from teammates
git pull

# 2. Apply team's migrations to local database
npx prisma migrate dev

# 3. Verify local database is up to date
npx prisma migrate status
```

### Creating Migrations in Team

```bash
# 4. Make your schema changes
# Edit prisma/schema.prisma

# 5. Create your migration
npx tsx scripts/create-migration.ts --name your_feature

# 6. Apply locally and test
psql $DATABASE_URL -f prisma/migrations/*/migration.sql
npx prisma migrate resolve --applied migration_name

# 7. Commit your changes
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat: your feature"
```

### Handling Conflicts

If multiple developers create migrations with similar timestamps:

1. **Rename migrations** to have unique timestamps
2. **Apply in lexicographic order** (alphabetical by folder name)
3. **Test thoroughly** after merging

## Rollback Strategies

### Documented Rollback

Include rollback SQL in migration comments:

```sql
-- Migration: 20250115_add_user_theme
--
-- Rollback:
--   ALTER TABLE users DROP COLUMN theme;
--   DROP INDEX IF EXISTS idx_users_theme;

ALTER TABLE users ADD COLUMN "theme" VARCHAR(50) DEFAULT 'light';
CREATE INDEX idx_users_theme ON users("theme");
```

### Separate Rollback Files

For complex migrations:

```
prisma/migrations/
├── 20250115_add_user_theme/
│   ├── migration.sql      # Apply changes
│   └── rollback.sql       # Reverse changes
```

## Troubleshooting

### Migration Failed

```bash
# Check error details
psql $DATABASE_URL -f prisma/migrations/20250110_ten_migration/migration.sql

# View specific error
psql $DATABASE_URL -c "SELECT * FROM information_schema.columns WHERE table_name = 'users';"
```

### Schema Drift

```bash
# Compare Prisma schema vs Database
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma

# Pull schema from database
npx prisma db pull

# Push schema to database (development only)
npx prisma db push
```

### Mark Migration as Rolled Back

```bash
npx prisma migrate resolve --rolled-back 20250110_ten_migration
```

### Fix Failed Migration

```bash
# 1. Manually fix the issue in database
psql $DATABASE_URL -c "ALTER TABLE users DROP COLUMN broken_column;"

# 2. Mark migration as rolled back
npx prisma migrate resolve --rolled-back 20250110_failed_migration

# 3. Create new migration with fix
npx tsx scripts/create-migration.ts --name fix_broken_column
```

## Checklist

Before applying to PRODUCTION:

- [ ] Tested on LOCAL database
- [ ] BACKUP production database created
- [ ] SQL migration reviewed thoroughly
- [ ] Rollback plan documented
- [ ] Data integrity verified after migration
- [ ] Application tested after migration

Before committing:

- [ ] Migration applied successfully
- [ ] Both `schema.prisma` and `migrations/` staged
- [ ] Commit message is descriptive
- [ ] No sensitive data in migration files

## Useful Commands

### Database Connection

```bash
# Connect to database
psql $DATABASE_URL

# List all tables
\dt

# Describe table structure
\d table_name

# List all indexes
\di

# Exit psql
\q
```

### Database Information

```bash
# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('smmp'));"

# Check table size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_total_relation_size('users'));"

# Check table row count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Migration Commands

```bash
# Check migration status
npx prisma migrate status

# Generate Prisma Client
npx prisma generate

# Apply pending migrations
npx prisma migrate deploy

# Mark migration as applied
npx prisma migrate resolve --applied migration_name

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back migration_name
```

## What to Avoid

❌ **DON'T**:
- Create migration without testing
- Apply migration without backup
- Commit migration before applying
- Drop table/column without checking foreign keys
- Change enum type on production (complex operation)
- Migrate large data in single transaction (timeout)
- Use `db push` in production
- Edit applied migrations
- Commit without testing

## What to Do

✅ **DO**:
- Test migration on local/staging first
- Backup before migration
- Write rollback SQL in comments
- Use transactions for multiple changes
- Add indexes after adding columns
- Monitor logs when running production migration
- Pull latest changes before creating migrations
- Commit both schema and migrations
- Review SQL before applying

## Resources

### Official Prisma Documentation

- **[Getting Started with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started)** - Official getting started guide
  - From scratch - New project setup
  - Adding to existing projects - Baselining workflow

- **[Implementing Schema Changes in Teams](https://www.prisma.io/docs/guides/implementing-schema-changes)** - Team collaboration guide
  - Source control requirements
  - Handling concurrent changes
  - Integrating team changes

### Project Documentation

- **[Baselining Guide](./migrations-baselining.md)** - Initialize migration history for existing databases
- **[Full Migration Guide](./migrations.md)** - Comprehensive migration documentation
- **[Quick Reference](./migrations-quick-reference.md)** - Common commands and patterns
