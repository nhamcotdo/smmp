# Database Installation and Setup

This guide will help you set up the PostgreSQL database and Prisma for the SMMP project.

## Prerequisites

1. **PostgreSQL** (version 14 or higher recommended)
2. **Node.js** and **npm** package manager
3. **Database credentials** (connection string)

## Step 1: Install Dependencies

Install the required Prisma packages:

```bash
npm install @prisma/client
npm install -D prisma
```

## Step 2: Environment Configuration

Update your `.env` file with the database connection string:

```env
# Database Connection String
DATABASE_URL="postgresql://username:password@localhost:5432/smmp?schema=public"

# Environment
NODE_ENV=development
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

## Step 4: Generate Prisma Client

After modifying the schema, generate the Prisma Client:

```bash
npm run db:push
```

This will:
1. Create the database tables if they don't exist
2. Generate the Prisma Client TypeScript types
3. Sync the schema with the database

## Step 5: Verify Installation

Create a simple script to test the database connection:

```typescript
// scripts/test-prisma.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testConnection() {
  try {
    await prisma.$connect()
    console.log('Database connection established successfully')

    // Test a simple query
    const result = await prisma.$queryRaw`SELECT NOW()`
    console.log('Database time:', result)

    await prisma.$disconnect()
  } catch (error) {
    console.error('Error connecting to database:', error)
    process.exit(1)
  }
}

testConnection()
```

Run the test:

```bash
npx tsx scripts/test-prisma.ts
```

## Step 6: Open Prisma Studio (Optional)

Prisma Studio is a visual database browser:

```bash
npm run db:studio
```

This will open a GUI at `http://localhost:5555` where you can view and edit data.

## Migration Workflow

### Development: Quick Schema Sync

For rapid development, push schema changes directly:

```bash
npm run db:push
```

**Note:** This resets the database in development mode. Use migrations for production-ready changes.

### Development: Create Migration

Create a migration file and apply it:

```bash
npm run db:migrate:dev --name migration_name
```

This creates a migration in `prisma/migrations/` and applies it.

### Production: Deploy Migrations

Apply pending migrations in production:

```bash
npm run db:migrate:deploy
```

### Production: Reset Database (⚠️ Destructive)

Reset the database and reseed:

```bash
npx prisma migrate reset
```

**Warning:** This deletes all data in the database.

## Schema Management

### View Current Schema

```bash
cat prisma/schema.prisma
```

### Format Schema

```bash
npx prisma format
```

### Validate Schema

```bash
npx prisma validate
```

## Production Considerations

### 1. Connection Pooling

Prisma manages connection pooling automatically. Configure pool settings in the connection string:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public&connection_limit=10&pool_timeout=20"
```

### 2. Use SSL

Configure SSL for production database connections:

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&sslmode=require"
```

### 3. Direct Database URL (Recommended for Production)

For serverless environments (Vercel, AWS Lambda), use the direct database URL to bypass connection limits:

```env
# Direct connection URL (from your database provider)
DIRECT_URL="postgresql://user:pass@host:5432/db?pgbouncer=true"

# Connection URL with connection pooling
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&pgbouncer=true"
```

### 4. Monitoring

Set up monitoring for:
- Query performance with `prisma.$on('query')`
- Connection pool usage
- Slow query logs

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

2. Verify `DATABASE_URL` in `.env`

3. Test connection with psql:
   ```bash
   psql $DATABASE_URL
   ```

### Migration Errors

If migrations fail:

1. Check migration status:
   ```bash
   npx prisma migrate status
   ```

2. Resolve migration by creating a new one:
   ```bash
   npm run db:migrate:dev --name fix_issue
   ```

3. Or reset in development (⚠️ deletes data):
   ```bash
   npx prisma migrate reset
   ```

### Performance Issues

If queries are slow:

1. Enable query logging:
   ```typescript
   const prisma = new PrismaClient({
     log: ['query', 'error', 'warn'],
   })
   ```

2. Check for missing indexes in `prisma/schema.prisma`

3. Use `prisma.$executeRawUnsafe` for complex queries

4. Monitor PostgreSQL performance:
   ```sql
   SELECT * FROM pg_stat_user_tables;
   ```

## Next Steps

1. Review the [Database Schema Documentation](./DATABASE_SCHEMA.md)
2. Set up automated backups
3. Configure monitoring and alerting
4. Implement row-level security if needed

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
