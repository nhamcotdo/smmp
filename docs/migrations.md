# Database Migrations Guide

This project uses **Prisma Migrate** for file-based database migrations, following the official [Prisma Migrate workflows](https://www.prisma.io/docs/orm/prisma-migrate/getting-started).

## Overview

Migrations are SQL files that describe changes to the database schema. They are:
- **Version controlled** - All changes tracked in git
- **Reviewable** - SQL can be reviewed before applying
- **Safe** - Can be tested on staging before production
- **Team-friendly** - Supports concurrent development

## Migration Files Structure

```
prisma/migrations/
├── 20250110140442_init/           # Migration folder (YYYYMMDDHHMMSS_description)
│   └── migration.sql              # SQL to apply this migration
├── 20250115150815_add_users_table/
│   └── migration.sql
└── migration_lock.toml            # Lock file (commit to source control)
```

**Migration Naming Convention**: Migrations use `YYYYMMDDHHMMSS_description` format. Migrations are applied in **lexicographic order** (alphabetical/numerical), so timestamps ensure correct execution order.

## Source Control Requirements

**IMPORTANT**: Commit both of these to source control:

1. **The `prisma/migrations` folder** (including `migration_lock.toml`)
2. **The `prisma/schema.prisma` file**

Why both?
- Customized migrations contain information not representable in Prisma schema
- `prisma migrate deploy` only runs migration files
- Team members need both to sync schema changes

Reference: [Implementing Schema Changes in Teams](https://www.prisma.io/docs/guides/implementing-schema-changes#source-control-requirements)

## Development Workflow

### Getting Started from Scratch

For new projects or after database reset:

```bash
# 1. Create initial migration
npx prisma migrate dev --name init

# This creates:
# - Migration file in prisma/migrations/
# - Applies migration to database
# - Generates Prisma Client
```

### Adding Schema Changes (Development)

**Step 1: Pull latest team changes**

```bash
# Always pull first to get latest migrations
git pull

# Verify migrations are in sync
npx prisma migrate status
```

**Step 2: Make schema changes**

```bash
# Edit prisma/schema.prisma
# Example: Add new field to model
```

**Step 3: Create migration**

```bash
# Method A: Using custom script (recommended - no shadow DB needed)
npx tsx scripts/create-migration.ts --name add_user_preferences

# Method B: Using Prisma CLI (requires shadow database)
npx prisma migrate dev --create-only --name add_user_preferences
```

**Step 4: Review and edit SQL**

```bash
# Review generated SQL
cat prisma/migrations/*/migration.sql

# Edit if needed:
# - Add indexes
# - Add constraints
# - Modify for production safety
```

**Step 5: Apply migration locally**

```bash
# Apply to local database
psql $DATABASE_URL -f prisma/migrations/*/migration.sql

# Or use Prisma (if shadow DB available)
npx prisma migrate dev
```

**Step 6: Mark as applied**

```bash
# Tell Prisma migration was applied
npx prisma migrate resolve --applied 20250110_add_user_preferences
```

**Step 7: Test your changes**

```bash
# Generate Prisma Client
npx prisma generate

# Run application
npm run dev
```

**Step 8: Commit changes**

```bash
# Commit BOTH migrations and schema
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat: add user preferences column"
```

### Resetting Local Database

```bash
# Drop and recreate database with all migrations
npx prisma migrate reset

# Or use db push for quick reset (development only)
npx prisma db push --force-reset
```

## Team Collaboration Workflow

When multiple developers work on schema changes:

### Scenario: Two Developers, Different Changes

**Developer A** adds a field to `User` model:
```bash
# Make schema changes
npx tsx scripts/create-migration.ts --name add_favorite_color
# Edit SQL, apply locally, commit
```

**Developer B** adds a new `Tag` model:
```bash
# Make schema changes
npx tsx scripts/create-migration.ts --name add_tag_model
# Edit SQL, apply locally, commit
```

### Integrating Team Changes

**When pulling changes from teammates:**

```bash
# 1. Pull latest changes (new migrations + schema)
git pull

# 2. Apply team's migrations to local database
npx prisma migrate dev

# 3. Now create your own migration
npx tsx scripts/create-migration.ts --name your_feature
```

The migration history will have both migrations applied in lexicographic order.

Reference: [Implementing Schema Changes in Teams](https://www.prisma.io/docs/guides/implementing-schema-changes)

## Production Workflow

### Before Deploying

```bash
# 1. Review pending migrations
npx prisma migrate status

# 2. Test migrations on staging database first
DATABASE_URL=$STAGING_DB_URL npx prisma migrate deploy

# 3. Backup production database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Run production migration
npx prisma migrate deploy
```

### Deployment Steps

```bash
# 1. Pull latest code with new migrations
git pull

# 2. Install dependencies
npm install

# 3. Generate Prisma Client
npx prisma generate

# 4. Apply migrations (only runs pending migrations)
npx prisma migrate deploy

# 5. Start application
npm run build && npm start
```

**Note**: `prisma migrate deploy`:
- Only applies migrations that haven't been applied yet
- Is production-safe (no shadow database needed)
- Used in CI/CD pipelines

## Baselining for Existing Projects

If you have an existing database with data and want to start using Prisma Migrate:

See: [`docs/migrations-baselining.md`](./migrations-baselining.md)

Baselining tells Prisma Migrate that initial migrations have already been applied, preventing errors when trying to create existing tables.

## Migration Best Practices

### DO ✅

- **Write descriptive migration names**: `add_user_index` not `migration_001`
- **Add indexes**: When adding columns that will be queried
- **Test on staging**: Always test before production
- **Backup first**: Before production migrations
- **Make migrations reversible**: Include rollback logic in comments
- **Add comments**: Explain complex changes
- **Commit both schema and migrations**: Required for team collaboration
- **Pull before creating migrations**: Avoid conflicts

### DON'T ❌

- **Don't edit applied migrations**: Only edit pending migrations
- **Don't use db push in production**: Use migrations instead
- **Don't change enum types carelessly**: Requires special handling
- **Don't forget indexes**: Add indexes for new query patterns
- **Don't mix schema and data**: Separate data migrations
- **Don't commit without testing**: Test migrations locally first
- **Don't ignore migration status**: Check `npx prisma migrate status` before deploying

## SQL Examples

### Add Column

```sql
-- Add column with default
ALTER TABLE users ADD COLUMN "theme" VARCHAR(50) DEFAULT 'light';

-- Add column without default (nullable)
ALTER TABLE users ADD COLUMN "bio" TEXT;

-- Add column with constraint
ALTER TABLE posts ADD COLUMN "views" INT DEFAULT 0 CHECK ("views" >= 0);
```

### Add Index

```sql
-- Single column index
CREATE INDEX idx_posts_user_id ON posts("user_id");

-- Composite index
CREATE INDEX idx_posts_user_status ON posts("user_id", "status");

-- Unique index
CREATE UNIQUE INDEX idx_users_email ON users("email");

-- Partial index (only certain rows)
CREATE INDEX idx_posts_published ON posts("published_at") WHERE "status" = 'PUBLISHED';

-- GIN index for JSON/JSONB
CREATE INDEX idx_users_preferences ON users USING GIN ("preferences");
```

### Create Table

```sql
CREATE TABLE "notifications" (
  "id" VARCHAR(36) PRIMARY KEY,
  "user_id" VARCHAR(36) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "data" JSONB,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications("user_id");
CREATE INDEX idx_notifications_created_at ON notifications("created_at");
```

### Add Enum Value

```sql
-- Add new enum value (only if not exists)
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'ARCHIVED';
```

### Modify Column

```sql
-- Make column NOT NULL (only if table is empty or has defaults)
ALTER TABLE users ALTER COLUMN "name" SET NOT NULL;

-- Change column type
ALTER TABLE users ALTER COLUMN "age" TYPE INTEGER USING "age"::INTEGER;

-- Rename column
ALTER TABLE users RENAME COLUMN "name" TO "full_name";
```

## Troubleshooting

### Migration Failed

```bash
# Check migration status
npx prisma migrate status

# Resolve failed migration
npx prisma migrate resolve --rolled-back migration_name

# Or mark as applied if manually fixed
npx prisma migrate resolve --applied migration_name
```

### Schema Drift

```bash
# Detect schema drift
npx prisma migrate diff --from-empty --to-schema-datasource prisma/schema.prisma

# Fix by pulling schema from database
npx prisma db pull

# Or push schema to database (development only)
npx prisma db push
```

### Conflicting Migrations

```bash
# Reset migration history (development only)
DROP TABLE _prisma_migrations;

# Re-create from scratch
npx prisma migrate reset
```

## Rollback Strategy

### Manual Rollback

Each migration file should include rollback comments:

```sql
-- Migration: 20250115_add_user_preferences
-- Rollback:
--   ALTER TABLE users DROP COLUMN preferences;

ALTER TABLE users ADD COLUMN preferences JSONB;
```

### Automated Rollback

For complex migrations, create separate rollback files:

```
prisma/migrations/
├── 20250115_add_user_preferences/
│   ├── migration.sql      # Apply changes
│   └── rollback.sql       # Reverse changes
```

## Environment Variables

```bash
# Database connection
DATABASE_URL="postgresql://user:password@localhost:5432/smmp?schema=public"

# Shadow database for migrations (development)
SHADOW_DATABASE_URL="postgresql://user:password@localhost:5432/smmp_shadow"

# Direct connection (bypasses connection pooling)
DIRECT_URL="postgresql://user:password@localhost:5432/smmp?schema=public"
```

## NPM Scripts

```json
{
  "scripts": {
    "db:migrate": "npx tsx scripts/create-migration.ts",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:migrate:reset": "prisma migrate reset",
    "db:migrate:status": "prisma migrate status",
    "db:push": "prisma db push",
    "db:pull": "prisma db pull",
    "db:studio": "prisma studio",
    "db:seed": "npx tsx scripts/seed.ts"
  }
}
```

## Checklist

Before committing migrations:
- [ ] Migration has descriptive name
- [ ] SQL is tested locally
- [ ] Includes indexes for new columns
- [ ] Rollback strategy documented
- [ ] No hardcoded environment values
- [ ] Transaction boundaries correct
- [ ] Comments explain complex logic
- [ ] Both `schema.prisma` and `migrations/` committed

## Resources

### Official Prisma Documentation

This guide follows the official Prisma Migrate workflows:

- **[Getting Started with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started)** - Learn how to migrate your schema in a development environment
  - From scratch - Setting up Prisma Migrate for new projects
  - Adding to existing projects - Baselining workflow for databases with existing data

- **[Implementing Schema Changes in Teams](https://www.prisma.io/docs/guides/implementing-schema-changes)** - Team collaboration guide
  - Migration order and source control requirements
  - Handling concurrent schema changes
  - Integrating team changes

- **[Baselining Guide](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)** - Initialize migration history for existing databases
  - When to use baselining
  - Baseline migration creation workflow

### Project Documentation

- **[Baselining Guide](./migrations-baselining.md)** - Project-specific baselining documentation
- **[Manual Migration Guide](./migrations-manual-guide.md)** - Step-by-step manual migration workflow
- **[Quick Reference](./migrations-quick-reference.md)** - Common commands and patterns

### PostgreSQL Resources

- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Database Indexing Guide](https://www.postgresql.org/docs/current/indexes.html)
