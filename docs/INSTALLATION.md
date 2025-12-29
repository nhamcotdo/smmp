# Database Installation and Setup

This guide will help you set up the PostgreSQL database and TypeORM for the SMMP project.

## Prerequisites

1. **PostgreSQL** (version 14 or higher recommended)
2. **Node.js** and **pnpm** package manager
3. **Database credentials** (host, port, username, password, database name)

## Step 1: Install Dependencies

Install the required TypeORM and PostgreSQL packages:

```bash
pnpm add typeorm pg
pnpm add -D @types/pg
```

## Step 2: Environment Configuration

Update your `.env` file with the following database configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=smmp

# Environment
NODE_ENV=development

# SSL (for production)
# DB_CA_CERT=path_to_cert
```

## Step 3: Create Database

Create the PostgreSQL database:

```bash
# Using psql
psql -U postgres
CREATE DATABASE smmp;
\q

# Or using createdb
createdb -U postgres smmp
```

## Step 4: Generate Initial Migration

Generate the initial migration from your entities:

```bash
# Install typeorm-cli globally or use npx
npx typeorm migration:generate -d src/database/config/data-source.ts src/database/migrations/InitialSchema
```

## Step 5: Run Migrations

Execute the migrations to create database tables:

```bash
npx typeorm migration:run -d src/database/config/data-source.ts
```

## Step 6: Verify Installation

Create a simple script to test the database connection:

```typescript
// src/database/test-connection.ts
import dataSource from './config/data-source'

async function testConnection() {
  try {
    await dataSource.initialize()
    console.log('Database connection established successfully')
    console.log('Database:', dataSource.options.database)
    console.log('Host:', dataSource.options.host)
    
    // Test a simple query
    const result = await dataSource.query('SELECT NOW()')
    console.log('Database time:', result[0].now)
    
    await dataSource.destroy()
  } catch (error) {
    console.error('Error connecting to database:', error)
    process.exit(1)
  }
}

testConnection()
```

Run the test:

```bash
ts-node src/database/test-connection.ts
```

## Step 7: Create Custom Indexes (Optional)

For optimal JSONB query performance, create additional indexes:

```sql
-- Connect to your database
psql -U postgres -d smmp

-- Create GIN indexes for JSONB operations
CREATE INDEX idx_posts_hashtags_gin ON posts USING GIN (hashtags);
CREATE INDEX idx_posts_mentions_gin ON posts USING GIN (mentions);
CREATE INDEX idx_users_preferences_gin ON users USING GIN (preferences);
CREATE INDEX idx_social_accounts_metadata_gin ON social_accounts USING GIN (metadata);

-- Verify indexes
\di
```

## Migration Workflow

### Create a New Migration

After modifying entities, generate a new migration:

```bash
npx typeorm migration:generate -d src/database/config/data-source.ts src/database/migrations/MigrationName
```

### Revert Last Migration

```bash
npx typeorm migration:revert -d src/database/config/data-source.ts
```

### Show Migration Status

```bash
npx typeorm migration:show -d src/database/config/data-source.ts
```

### Synchronize Schema (Development Only)

For quick development, you can enable auto-synchronization:

```typescript
// In data-source.ts
synchronize: true,  // WARNING: Only use in development!
```

## Production Considerations

### 1. Disable Synchronization

In production, never use schema synchronization:

```typescript
synchronize: false,  // Always false in production
```

### 2. Use SSL

Configure SSL for database connections:

```typescript
ssl: {
  rejectUnauthorized: false,
  ca: process.env.DB_CA_CERT,
}
```

### 3. Connection Pooling

Optimize connection pool settings:

```typescript
extra: {
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Connection timeout
}
```

### 4. Monitoring

Set up monitoring for:
- Connection pool usage
- Query performance
- Table bloat
- Index usage
- Replication lag (if using replicas)

## Troubleshooting

### Connection Issues

If you can't connect to the database:

1. Check PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   brew services start postgresql
   
   # Linux
   sudo systemctl status postgresql
   sudo systemctl start postgresql
   ```

2. Verify credentials in `.env`

3. Check PostgreSQL logs:
   ```bash
   tail -f /usr/local/var/log/postgres.log
   ```

### Migration Errors

If migrations fail:

1. Check current migration status:
   ```bash
   npx typeorm migration:show -d src/database/config/data-source.ts
   ```

2. Revert problematic migration:
   ```bash
   npx typeorm migration:revert -d src/database/config/data-source.ts
   ```

3. Fix the issue and regenerate migration

### Performance Issues

If queries are slow:

1. Check query execution plan:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM posts WHERE status = 'scheduled';
   ```

2. Update table statistics:
   ```sql
   ANALYZE posts;
   ```

3. Check for missing indexes

4. Monitor PostgreSQL performance:
   ```sql
   SELECT * FROM pg_stat_user_tables;
   ```

## Next Steps

1. Review the [Database Schema Documentation](./DATABASE_SCHEMA.md)
2. Set up automated backups
3. Configure monitoring and alerting
4. Implement row-level security if needed
5. Set up read replicas for analytics queries

## Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeORM Migration Guide](https://typeorm.io/#/migrations)
