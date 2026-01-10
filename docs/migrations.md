# Database Migrations Guide

This project uses file-based database migrations with Prisma.

## Overview

Migrations are SQL files that describe changes to the database schema. They are:
- **Version controlled** - All changes tracked in git
- **Reviewable** - SQL can be reviewed before applying
- **Safe** - Can be tested on staging before production
- **Reversible** - Rollback capability

## Migration Files Structure

```
prisma/migrations/
├── README.md                    # This file
├── 20250110_init_schema/        # Migration folder (timestamp_description)
│   └── migration.sql           # SQL to apply this migration
├── 20250115_add_users_table/
│   └── migration.sql
└── ...
```

## Creating a New Migration

### Method 1: Automatic (Recommended)

Let Prisma generate migration from schema changes:

```bash
# 1. Make changes to prisma/schema.prisma
# 2. Create migration file (does not apply)
npx prisma migrate dev --create-only --name add_user_preferences

# 3. Review the generated SQL
cat prisma/migrations/*/migration.sql

# 4. Edit the SQL if needed (add indexes, constraints, etc.)

# 5. Apply the migration
npx prisma migrate dev
```

### Method 2: Manual

Create SQL file manually for full control:

```bash
# 1. Create migration directory
mkdir -p prisma/migrations/$(date +%Y%m%d)_my_change

# 2. Create migration SQL
cat > prisma/migrations/$(date +%Y%m%d)_my_change/migration.sql << 'EOF'
-- Add user preferences column
ALTER TABLE users ADD COLUMN preferences JSONB;

-- Create index
CREATE INDEX idx_users_preferences ON users((preferences->>'theme'));
EOF

# 3. Mark migration as applied (after manual review)
npx prisma migrate resolve --applied $(date +%Y%m%d)_my_change
```

## Development Workflow

### Local Development

```bash
# 1. Create a new migration
npx prisma migrate dev --create-only --name my_feature

# 2. Review and edit the SQL
cat prisma/migrations/*/migration.sql

# 3. Apply migration to local database
npx prisma migrate dev

# 4. Generate Prisma Client
npx prisma generate

# 5. Test your changes
npm run dev
```

### Resetting Local Database

```bash
# Drop and recreate database with all migrations
npx prisma migrate reset

# Or use db push for quick reset (development only)
npx prisma db push --force-reset
```

## Production Workflow

### Before Deploying

```bash
# 1. Review pending migrations
npx prisma migrate status

# 2. Test migrations on staging database first
DATABASE_URL=$STAGING_DB_URL npx prisma migrate deploy

# 3. Backup production database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

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

# 4. Apply migrations
npx prisma migrate deploy

# 5. Start application
npm run build && npm start
```

## Migration Best Practices

### DO ✅

- **Write descriptive migration names**: `add_user_index` not `migration_001`
- **Add indexes**: When adding columns that will be queried
- **Use transactions**: Wrap related changes in BEGIN/COMMIT
- **Test on staging**: Always test before production
- **Backup first**: Before production migrations
- **Make migrations reversible**: Include rollback logic in comments
- **Add comments**: Explain complex changes

### DON'T ❌

- **Don't edit applied migrations**: Only edit pending migrations
- **Don't use db push in production**: Use migrations instead
- **Don't change enum types carelessly**: Requires special handling
- **Don't forget indexes**: Add indexes for new query patterns
- **Don't mix schema and data**: Separate data migrations

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
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:create": "prisma migrate dev --create-only",
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

## Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Database Indexing Guide](https://www.postgresql.org/docs/current/indexes.html)
