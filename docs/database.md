# Database Operations Guide

This guide covers database initialization, migrations, and common operations for the SMMP platform.

## Table of Contents

- [Environment Setup](#environment-setup)
- [Database Initialization](#database-initialization)
- [Migrations](#migrations)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Environment Setup

Ensure your `.env` file contains the following database configuration:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=smmp_db
DATABASE_SSL=false
DATABASE_POOL_MAX=10
DATABASE_POOL_MIN=2
```

For production, you can also use `DATABASE_URL` instead:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

## Database Initialization

### First-time Setup

Run the initialization script to create all tables:

```bash
npm run db:init
```

This will:
- Connect to the database
- Synchronize the schema (create all tables)
- Display the created tables
- Close the connection

### What Gets Created

The following tables are created:

| Table | Description |
|-------|-------------|
| `users` | User accounts and authentication |
| `social_accounts` | Connected social media accounts |
| `refresh_tokens` | JWT refresh tokens |
| `posts` | Content posts |
| `post_publications` | Published posts per platform |
| `media` | Media attachments |
| `analytics` | Performance analytics |
| `uploaded_media` | Uploaded media files |

## Migrations

### Creating a New Migration

When you make schema changes to entities:

1. **Create a new migration file** in `src/database/migrations/`:

```typescript
// Format: {timestamp}-{Description}.ts
// Example: 1704600000000-IncreaseAvatarLength.ts

import { MigrationInterface, QueryRunner } from 'typeorm'

export class YourMigration1704600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Your migration logic here
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "new_field" varchar(255)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback logic here
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "new_field"`)
  }
}
```

2. **Import the migration** in `scripts/run-migrations.ts`:

```typescript
import { YourMigration1704600000000 } from '../src/database/migrations/1704600000000-YourMigration'

// Add to migrations array:
migrations: [
  YourMigration1704600000000,
  // ... other migrations
]
```

### Running Migrations

**Locally:**
```bash
npm run db:migrate
```

**On Production:**
```bash
# Pull latest code
git pull

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Rebuild if needed
npm run build

# Restart the application
pm2 restart smmp
# or
systemctl restart smmp
```

### Checking Migration Status

```bash
# View migrations table
psql -U $USER -d smmp_db -c "SELECT * FROM migrations ORDER BY id DESC LIMIT 5;"
```

## Production Deployment

### Pre-deployment Checklist

1. **Backup database** before running migrations:
```bash
pg_dump -U $USER -d smmp_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Test migrations** on staging environment first

3. **Review migration files** for potential data loss

### Production Migration Workflow

```bash
# 1. SSH into production server
ssh user@production-server

# 2. Navigate to project directory
cd /path/to/smmp

# 3. Pull latest code
git pull origin main

# 4. Install dependencies
npm install

# 5. Run migrations
npm run db:migrate

# 6. Build the application
npm run build

# 7. Restart the service
pm2 restart smmp
```

## Troubleshooting

### Circular Dependency Issues

If you encounter "Entity metadata not found" errors:

1. Ensure `reflect-metadata` is imported first in connection files
2. Check that entities are imported in the correct order
3. Verify the entities registry exports all entities

### Migration Conflicts

If a migration fails:

1. Check the error message for specific issues
2. Manually verify the database state:
```bash
psql -U $USER -d smmp_db -c "\d table_name"
```
3. Fix the issue and re-run the migration
4. If needed, manually rollback:
```bash
psql -U $USER -d smmp_db -c "-- SQL to undo changes"
```

### Connection Issues

If you can't connect to the database:

1. Verify PostgreSQL is running:
```bash
brew services list  # macOS
systemctl status postgresql  # Linux
```

2. Check connection settings in `.env`

3. Test connection directly:
```bash
psql -U $USER -d smmp_db
```

## Common Schema Changes

### Add a new column:

```typescript
await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "bio" text`)
```

### Change column type:

```typescript
await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar" TYPE varchar(2048)`)
```

### Add an index:

```typescript
await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users" ("email")`)
```

### Drop a column:

```typescript
await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "old_column"`)
```

## Best Practices

1. **Always create migrations** for schema changes - don't rely on `synchronize: true` in production
2. **Test migrations** on development/staging first
3. **Backup before migrating** in production
4. **Use descriptive migration names** with timestamps
5. **Write rollback logic** in the `down()` method
6. **Keep migrations immutable** - never modify committed migrations
7. **Document breaking changes** in migration comments
