# SMMP Database Schema Summary

## Overview

This document provides a complete summary of the PostgreSQL database schema for the Social Media Management Platform (SMMP) using TypeORM entities.

## Files Created

### Entity Files (`src/database/entities/`)

1. **base.entity.ts** - Base entity class with common columns
2. **enums.ts** - All enum definitions
3. **User.entity.ts** - User account entity
4. **SocialAccount.entity.ts** - Connected social media accounts
5. **Post.entity.ts** - Social media posts/scheduled content
6. **PostPublication.entity.ts** - Junction table for post-platform relationships
7. **Media.entity.ts** - Media attachments for posts
8. **Analytics.entity.ts** - Time-series analytics data
9. **index.ts** - Barrel file for easy imports

### Configuration Files (`src/database/config/`)

1. **data-source.ts** - TypeORM data source configuration

### Repository Files (`src/database/repositories/`)

1. **UserRepository.ts** - User-specific queries and operations
2. **SocialAccountRepository.ts** - Social account management queries
3. **PostRepository.ts** - Post scheduling and management queries
4. **PostPublicationRepository.ts** - Publication tracking and analytics queries

### Documentation Files (`docs/`)

1. **DATABASE_SCHEMA.md** - Complete schema documentation
2. **INSTALLATION.md** - Installation and setup guide
3. **examples/USAGE_EXAMPLES.md** - Practical code examples

## Entity Relationships

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐   ┌─────────────┐
│SocialAccount │   │    Post     │
└──────┬───────┘   └──────┬──────┘
       │                  │
       │                  │
       ▼                  ▼
┌────────────────────────────┐
│     PostPublication        │
└─────────────┬──────────────┘
              │
              ▼
     ┌────────────────┐
     │   Analytics    │
     └────────────────┘

┌─────┐
│Post │
└──┬──┘
   │
   ▼
┌─────────┐
│  Media  │
└─────────┘
```

## Key Features

### PostgreSQL-Specific Features

1. **JSONB Columns** - Flexible data storage for:
   - User preferences
   - Platform metadata
   - Hashtags and mentions
   - Analytics data

2. **Timestamptz** - Timezone-aware timestamps for:
   - Created/updated timestamps
   - Scheduled/published dates
   - Token expiration tracking

3. **GIN Indexes** - For JSONB operations:
   - Hashtag search
   - Metadata queries
   - Preferences filtering

4. **B-tree Indexes** - For:
   - Foreign key lookups
   - Status filtering
   - Date range queries
   - Composite queries

### Design Patterns

1. **Base Entity** - Common columns (id, timestamps)
2. **Enums** - Type-safe status and platform fields
3. **Soft Delete Ready** - Can add `deletedAt` column
4. **Audit Trail** - Created/updated timestamps
5. **Multi-Platform** - Support for multiple social platforms
6. **Time-Series Analytics** - Historical tracking of metrics

## Index Strategy

### User Table
- `idx_users_email` - Email lookups (authentication)
- `idx_users_role` - Role-based queries
- `idx_users_created_at` - Date-based sorting

### SocialAccount Table
- `idx_social_accounts_user_id` - User lookups
- `idx_social_accounts_platform` - Platform filtering
- `idx_social_accounts_status` - Status filtering
- `idx_social_accounts_health` - Health monitoring
- `idx_social_accounts_user_platform` (UNIQUE) - Prevent duplicates
- `idx_social_accounts_expires_at` - Token expiration

### Post Table
- `idx_posts_user_id` - User posts
- `idx_posts_status` - Status filtering
- `idx_posts_scheduled_at` - Scheduled posts query
- `idx_posts_published_at` - Date sorting
- `idx_posts_content_type` - Content type filtering
- `idx_posts_user_status` - Composite user+status
- `idx_posts_scheduled_status` - Scheduled posts

### PostPublication Table
- `idx_post_publications_post_id` - Post lookups
- `idx_post_publications_social_account_id` - Account lookups
- `idx_post_publications_platform` - Platform filtering
- `idx_post_publications_status` - Status filtering
- `idx_post_publications_post_status` - Composite queries
- `idx_post_publications_published_at` - Date sorting
- `idx_post_publications_post_platform` (UNIQUE) - Prevent duplicates

### Media Table
- `idx_media_post_id` - Post lookups
- `idx_media_type` - Type filtering
- `idx_media_mimetype` - MIME type queries
- `idx_media_post_order` - Ordered retrieval

### Analytics Table
- `idx_analytics_post_publication_id` - Publication lookups
- `idx_analytics_platform` - Platform filtering
- `idx_analytics_period` - Period filtering
- `idx_analytics_recorded_at` - Time-series queries
- `idx_analytics_publication_recorded` - Composite queries

## Migration Strategy

### Initial Setup

1. Install dependencies:
   ```bash
   pnpm add typeorm pg
   pnpm add -D @types/pg
   ```

2. Configure environment variables in `.env`

3. Generate migration:
   ```bash
   npx typeorm migration:generate -d src/database/config/data-source.ts src/database/migrations/InitialSchema
   ```

4. Run migration:
   ```bash
   npx typeorm migration:run -d src/database/config/data-source.ts
   ```

### Manual Indexes (Optional)

After migration, create GIN indexes for JSONB:

```sql
CREATE INDEX idx_posts_hashtags_gin ON posts USING GIN (hashtags);
CREATE INDEX idx_posts_mentions_gin ON posts USING GIN (mentions);
CREATE INDEX idx_users_preferences_gin ON users USING GIN (preferences);
CREATE INDEX idx_social_accounts_metadata_gin ON social_accounts USING GIN (metadata);
```

## Common Query Patterns

### Get User's Scheduled Posts
```typescript
const posts = await postRepository.find({
  where: {
    userId: userId,
    status: PostStatus.SCHEDULED,
    scheduledAt: MoreThan(new Date()),
  },
  order: { scheduledAt: 'ASC' },
})
```

### Get Active Social Accounts
```typescript
const accounts = await socialAccountRepository.find({
  where: {
    userId: userId,
    status: AccountStatus.ACTIVE,
  },
})
```

### Search Posts by Hashtags
```typescript
const posts = await postRepository
  .createQueryBuilder('post')
  .where('post.hashtags @> :hashtag', { hashtag: ['example'] })
  .getMany()
```

## Security Considerations

1. **Password Storage** - Use bcrypt/argon2 (never plain text)
2. **Token Storage** - Encrypt access/refresh tokens
3. **SQL Injection** - TypeORM prevents this automatically
4. **Row-Level Security** - Consider implementing RLS
5. **Input Validation** - Always validate before database operations

## Performance Optimization

### Connection Pooling
```typescript
extra: {
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

### Query Optimization
1. Use `EXPLAIN ANALYZE` for slow queries
2. Create composite indexes for multi-column queries
3. Use partial indexes for filtered subsets
4. Implement caching for frequently accessed data

### Autovacuum Tuning
```sql
ALTER TABLE post_publications SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
```

## Next Steps

1. **Install Dependencies**
   ```bash
   pnpm add typeorm pg reflect-metadata
   pnpm add -D @types/pg ts-node
   ```

2. **Setup Database**
   - Create PostgreSQL database
   - Configure environment variables
   - Run migrations

3. **Implement Services**
   - User authentication service
   - Social account connection service
   - Post scheduling service
   - Analytics tracking service

4. **Setup Monitoring**
   - Query performance monitoring
   - Connection pool monitoring
   - Table bloat monitoring
   - Index usage tracking

5. **Implement Caching**
   - Redis for frequently accessed data
   - Cache user sessions
   - Cache social account profiles
   - Cache analytics aggregations

## Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)

## Support

For issues or questions:
1. Check the [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for detailed documentation
2. Review [USAGE_EXAMPLES.md](./examples/USAGE_EXAMPLES.md) for code examples
3. Consult [INSTALLATION.md](./INSTALLATION.md) for setup help
