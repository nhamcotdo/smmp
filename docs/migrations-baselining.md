# Baselining Database - Initialize Migration for Existing Databases

This guide follows the official [Prisma Baselining workflow](https://www.prisma.io/docs/orm/prisma-migrate/getting-started#adding-prisma-migrate-to-an-existing-project).

## What is Baselining?

Baselining is the process of initializing a migration history for a database that:
- **Existed before you started using Prisma Migrate**
- **Contains data that must be maintained** (like production database)
- **Cannot be reset** without losing important data

Baselining tells Prisma Migrate that one or more migrations have **already been applied**, preventing generated migrations from failing when they try to create tables and fields that already exist.

## When to Use Baselining?

- ✅ Production database already has tables and data
- ✅ Want to start using Prisma Migrate with an existing database
- ✅ Cannot reset database because of important data
- ✅ Migrating from another ORM (e.g., TypeORM) to Prisma

## Baselining Workflow

The official Prisma baselining workflow consists of these steps:

### Step 1: Introspect Database (Update Prisma Schema)

Make sure your Prisma schema is in sync with your database schema:

```bash
# Introspect the database to update Prisma schema
npx prisma db pull

# Review the generated schema
cat prisma/schema.prisma
```

This ensures your `schema.prisma` reflects the current database state.

### Step 2: Remove Old Migrations (If Any)

If you have an existing `prisma/migrations` folder:

```bash
# Backup existing migrations (optional)
cp -r prisma/migrations prisma/migrations.backup

# Remove migrations folder
rm -rf prisma/migrations
```

### Step 3: Create Baseline Migration

Create the baseline migration directory and generate SQL:

```bash
# Create migration directory with 0_ prefix (important for lexicographic order)
mkdir -p prisma/migrations/0_init

# Generate migration SQL from current schema
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

**Why `0_init`?**
- The `0_` prefix ensures this migration runs first (lexicographic order)
- You can also use a timestamp like `20250110140442_init`
- This represents the database state BEFORE you started using Prisma Migrate

### Step 4: Work Around Unsupported Features (If Needed)

If your database uses features not supported by Prisma Schema Language, you may need to modify the generated SQL:

```bash
# Open the migration file
vim prisma/migrations/0_init/migration.sql
```

Examples of unsupported features:
- Partial indexes
- Check constraints
- Custom SQL functions
- Triggers
- Database views

**Minor changes**: Append custom SQL to the generated migration

```sql
/* Generated migration SQL */

-- Custom: Add partial index
CREATE UNIQUE INDEX tests_success_constraint
ON posts (subject, target)
WHERE success;
```

**Significant changes**: Replace entire migration with database dump

```bash
# Use pg_dump to get exact database state
pg_dump $DATABASE_URL > prisma/migrations/0_init/migration.sql

# Update search_path to avoid migration table errors
sed -i '1s/^/SELECT pg_catalog.set_config('\''search_path'\'', '\'''\'', false);\n/' prisma/migrations/0_init/migration.sql
```

**Note**: When replacing with `pg_dump`, re-order tables to handle foreign key constraints, or move constraint creation to the end.

### Step 5: Review Migration SQL

```bash
# Review the generated migration
cat prisma/migrations/0_init/migration.sql

# Verify it represents your current database structure
```

### Step 6: Mark Baseline as Applied

Tell Prisma Migrate that this baseline migration has already been applied:

```bash
# Mark baseline migration as applied
npx prisma migrate resolve --applied 0_init
```

This command:
- Records the migration in the `_prisma_migrations` table
- Does NOT actually run the SQL (because tables already exist)
- Prevents future `migrate deploy` from attempting to apply it

### Step 7: Verify

```bash
# Check migration status
npx prisma migrate status

# Expected output:
# Schema is in sync with Prisma schema.
```

## After Baselining

### Development (Local Database)

```bash
# Create new migration
npx tsx scripts/create-migration.ts --name add_new_feature

# Apply to local database
npx prisma migrate dev

# Or apply manually
psql $DATABASE_URL -f prisma/migrations/*/migration.sql
npx prisma migrate resolve --applied migration_name
```

### Production Deployment

```bash
# Prisma will:
# 1. Skip 0_init (marked as applied)
# 2. Only apply new migrations after baseline

npx prisma migrate deploy
```

## Complete Example

### Scenario

Production database has:
- Tables: users, posts, comments
- Data: 1000 users, 5000 posts
- Want to start using Prisma Migrate for future changes

### Execution

```bash
# 1. Introspect database to sync schema
npx prisma db pull

# 2. Create baseline migration
mkdir -p prisma/migrations/0_init

# 3. Generate SQL from current schema
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 4. Review and edit if needed
vim prisma/migrations/0_init/migration.sql

# 5. Mark as applied
npx prisma migrate resolve --applied 0_init

# 6. Now create new migrations normally
npx tsx scripts/create-migration.ts --name add_user_theme
```

### Migration History Structure

```
prisma/migrations/
├── 0_init/                      # Baseline (marked as applied)
│   └── migration.sql            # State BEFORE Prisma Migrate
├── 20250110_add_user_theme/     # New migration 1
│   └── migration.sql
└── 20250115_add_post_index/     # New migration 2
    └── migration.sql
```

**Deployment behavior:**
- **Local/Dev**: Applies all 3 migrations (0_init, 20250110_*, 20250115_*)
- **Production**: Only applies 2 new migrations (20250110_*, 20250115_*), skips 0_init

## Comparison: With vs Without Baselining

### WITHOUT Baselining (Wrong for Production)

```
Migration: 0_init
Action: CREATE TABLE users (...)
Production: ERROR! Table already exists ❌
```

### WITH Baselining (Correct)

```
Migration: 0_init
Status: Marked as applied ✓
Production: Skips this migration ✓

Migration: 20250110_add_theme
Action: ALTER TABLE users ADD COLUMN theme
Production: Applies successfully ✓
```

## Troubleshooting

### Error: Migration failed - table already exists

**Cause**: Haven't baselined, Prisma tries to create existing tables.

**Solution**: Baselining the database.

### Error: Shadow database permission denied

**Solution**: Use custom script instead of `prisma migrate dev`:

```bash
# Create migration manually
npx tsx scripts/create-migration.ts --name my_change

# Apply manually
psql $DATABASE_URL -f prisma/migrations/*/migration.sql

# Mark as applied
npx prisma migrate resolve --applied migration_name
```

### Error: Schema drift

```bash
# Pull schema from current database
npx prisma db pull

# Check differences
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

### Error: Foreign key constraints in baseline

**Cause**: When using `pg_dump`, foreign key constraints may fail if tables aren't in correct order.

**Solution**: Either reorder tables or move constraint creation to the end:

```sql
-- Create all tables first
CREATE TABLE users (...);
CREATE TABLE posts (...);

-- Add constraints after all tables exist
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id);
```

## Best Practices

### 1. Backup Before Baselining

```bash
pg_dump $DATABASE_URL > pre_baselining_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test Baseline on Staging First

```bash
# Test on staging database
STAGING_DATABASE_URL=... npx prisma migrate resolve --applied 0_init
```

### 3. Commit Baseline Migration

```bash
git add prisma/migrations/0_init prisma/schema.prisma
git commit -m "chore: baseline database with existing schema"
```

### 4. Document Baseline Migration

Add clear comments in the migration file:

```sql
-- Migration: 0_init
-- Description: Baseline migration representing the state
--   of the database before we started using Prisma Migrate.
--
-- IMPORTANT: This migration should NOT be applied to existing
--   production databases. It is marked as applied during
--   baselining process.
--
-- Rollback: Not applicable (baseline)
--
-- Created: 2025-01-10
-- Baselined: 2025-01-10
```

### 5. Document in README

Add a note to your project README about baselining:

```markdown
## Database Migrations

This project uses Prisma Migrate. The migration history starts with
a baseline migration (0_init) representing the initial database state.

See [docs/migrations-baselining.md](docs/migrations-baselining.md) for details.
```

## Timeline

```
Past              Present              Future
─────────────────────────────────────────────────
                  │
                  ├─ Baselining (0_init)
                  │  - Snapshot current state
                  │  - Mark as applied
                  │  - Commit to git
                  │
                  ├─ Development
                  │  - Create new migrations
                  │  - Apply to local
                  │  - Test thoroughly
                  │
                  └─ Production Deploy
                     - Skip 0_init
                     - Apply new migrations only
```

## Source Control Requirements

After baselining, commit to source control:

```bash
# Add both migrations and schema
git add prisma/migrations/ prisma/schema.prisma

# Commit
git commit -m "chore: baseline database with existing schema"
```

**Important**: Team members need both `migrations/` folder AND `schema.prisma` to work with the database.

Reference: [Implementing Schema Changes in Teams](https://www.prisma.io/docs/guides/implementing-schema-changes#source-control-requirements)

## Resources

### Official Prisma Documentation

This guide is based on the official Prisma baselining workflow:

- **[Getting Started - Adding Prisma Migrate to an Existing Project](https://www.prisma.io/docs/orm/prisma-migrate/getting-started#adding-prisma-migrate-to-an-existing-project)** - Official workflow for baselining
  - Introspect database to update Prisma schema
  - Create baseline migration
  - Work around features not supported by Prisma Schema Language
  - Apply initial migrations

- **[Prisma Migrate Overview](https://www.prisma.io/docs/concepts/components/prisma-migrate)** - Core concepts

- **[Implementing Schema Changes in Teams](https://www.prisma.io/docs/guides/implementing-schema-changes)** - Managing schema changes in a team environment

### Project Documentation

- **[Migration Guide](./migrations.md)** - Complete migration documentation
- **[Manual Migration Guide](./migrations-manual-guide.md)** - Step-by-step manual migration workflow
- **[Quick Reference](./migrations-quick-reference.md)** - Common commands and patterns
