# Database Schema Documentation

## Overview
This document describes the PostgreSQL database schema for the Social Media Management Platform (SMMP) using Prisma ORM.

## Entity Relationship Diagram

```
User (1) ----< (N) SocialAccount
  |
  | (1)
  |
  ----< (N) Post
         |
         | (1)
         |
         ----< (N) PostPublication
                      |
                      | (1)
                      |
                      ----< (N) Analytics

Post (1) ----< (N) Media
```

## Entities

### 1. User
**Table:** `users`

**Description:** User accounts for the platform

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `name` (VARCHAR(255)) - User's full name
- `email` (VARCHAR(255), UNIQUE) - User's email address
- `password` (VARCHAR(255)) - Hashed password
- `role` (ENUM) - User role (admin, user, viewer)
- `avatar` (VARCHAR(500)) - Profile picture URL
- `isActive` (BOOLEAN) - Account active status
- `emailVerified` (BOOLEAN) - Email verification status
- `lastLoginAt` (TIMESTAMPTZ) - Last login timestamp
- `preferences` (JSONB) - User preferences/settings
- `createdAt` (TIMESTAMPTZ) - Creation timestamp
- `updatedAt` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- `idx_users_email` - For email lookups
- `idx_users_role` - For role-based queries
- `idx_users_created_at` - For date-based sorting

**Relationships:**
- One-to-Many with SocialAccount
- One-to-Many with Post

---

### 2. SocialAccount
**Table:** `social_accounts`

**Description:** Connected social media accounts (Threads, Instagram, etc.)

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `userId` (UUID, FK) - Reference to User
- `platform` (ENUM) - Platform type (threads, instagram, etc.)
- `platformUserId` (VARCHAR(255)) - Platform's user ID
- `username` (VARCHAR(255)) - Platform username
- `displayName` (VARCHAR(500)) - Display name
- `avatar` (VARCHAR(255)) - Profile picture URL
- `status` (ENUM) - Connection status (active, expired, revoked, error, pending)
- `health` (ENUM) - Account health (healthy, degraded, unhealthy, unknown)
- `accessToken` (TEXT) - OAuth access token (encrypted)
- `refreshToken` (TEXT) - OAuth refresh token (encrypted)
- `tokenExpiresAt` (TIMESTAMPTZ) - Token expiration
- `expiresAt` (TIMESTAMPTZ) - Account expiration
- `metadata` (JSONB) - Platform-specific metadata
- `followersCount` (INTEGER) - Follower count
- `followingCount` (INTEGER) - Following count
- `postsCount` (INTEGER) - Total posts count
- `lastSyncedAt` (TIMESTAMPTZ) - Last sync timestamp
- `lastPostedAt` (TIMESTAMPTZ) - Last post timestamp
- `createdAt` (TIMESTAMPTZ) - Creation timestamp
- `updatedAt` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- `idx_social_accounts_user_id` - For user lookups
- `idx_social_accounts_platform` - For platform filtering
- `idx_social_accounts_status` - For status filtering
- `idx_social_accounts_health` - For health monitoring
- `idx_social_accounts_user_platform` (UNIQUE) - Prevent duplicate platform connections
- `idx_social_accounts_expires_at` - For token expiration queries

**Relationships:**
- Many-to-One with User
- One-to-Many with PostPublication

---

### 3. Post
**Table:** `posts`

**Description:** Social media posts/scheduled content

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `userId` (UUID, FK) - Reference to User
- `content` (TEXT) - Post content/text
- `status` (ENUM) - Post status (draft, scheduled, publishing, published, failed, cancelled)
- `contentType` (ENUM) - Content type (text, image, video, carousel, story, reel, mixed)
- `scheduledAt` (TIMESTAMPTZ) - Scheduled publish time
- `publishedAt` (TIMESTAMPTZ) - Actual publish time
- `title` (VARCHAR(255)) - Post title
- `slug` (VARCHAR(255)) - URL-friendly identifier
- `metadata` (JSONB) - Additional metadata
- `hashtags` (JSONB) - Array of hashtags
- `mentions` (JSONB) - Array of mentioned users
- `analytics` (JSONB) - Aggregated analytics data
- `isScheduled` (BOOLEAN) - Whether post is scheduled
- `failedAt` (TIMESTAMPTZ) - Failure timestamp
- `errorMessage` (TEXT) - Error details
- `retryCount` (INTEGER) - Number of retry attempts
- `lastRetryAt` (TIMESTAMPTZ) - Last retry timestamp
- `createdAt` (TIMESTAMPTZ) - Creation timestamp
- `updatedAt` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- `idx_posts_user_id` - For user lookups
- `idx_posts_status` - For status filtering
- `idx_posts_scheduled_at` - For scheduled post queries
- `idx_posts_published_at` - For date-based sorting
- `idx_posts_content_type` - For content type filtering
- `idx_posts_user_status` - Composite index for user posts
- `idx_posts_scheduled_status` - For scheduled posts queries

**Relationships:**
- Many-to-One with User
- One-to-Many with PostPublication
- One-to-Many with Media

---

### 4. PostPublication
**Table:** `post_publications`

**Description:** Junction table for post-platform relationships

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `postId` (UUID, FK) - Reference to Post
- `socialAccountId` (UUID, FK) - Reference to SocialAccount
- `platform` (ENUM) - Platform type
- `status` (ENUM) - Publication status
- `platformPostId` (VARCHAR(255)) - Platform's post ID
- `platformPostUrl` (VARCHAR(500)) - Platform post URL
- `scheduledFor` (TIMESTAMPTZ) - Scheduled publish time
- `publishedAt` (TIMESTAMPTZ) - Actual publish time
- `likesCount` (INTEGER) - Likes count
- `commentsCount` (INTEGER) - Comments count
- `sharesCount` (INTEGER) - Shares count
- `impressionsCount` (INTEGER) - Impressions count
- `reachCount` (INTEGER) - Reach count
- `analytics` (JSONB) - Platform-specific analytics
- `lastSyncedAt` (TIMESTAMPTZ) - Last analytics sync
- `errorMessage` (TEXT) - Error details
- `failedAt` (TIMESTAMPTZ) - Failure timestamp
- `retryCount` (INTEGER) - Number of retry attempts
- `lastRetryAt` (TIMESTAMPTZ) - Last retry timestamp
- `metadata` (JSONB) - Additional metadata
- `createdAt` (TIMESTAMPTZ) - Creation timestamp
- `updatedAt` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- `idx_post_publications_post_id` - For post lookups
- `idx_post_publications_social_account_id` - For account lookups
- `idx_post_publications_platform` - For platform filtering
- `idx_post_publications_status` - For status filtering
- `idx_post_publications_post_status` - Composite for post status queries
- `idx_post_publications_published_at` - For date-based sorting
- `idx_post_publications_post_platform` (UNIQUE) - Prevent duplicate publications

**Relationships:**
- Many-to-One with Post
- Many-to-One with SocialAccount
- One-to-Many with Analytics

---

### 5. Media
**Table:** `media`

**Description:** Media attachments for posts

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `postId` (UUID, FK) - Reference to Post
- `type` (ENUM) - Media type (image, video, gif, document, audio)
- `url` (VARCHAR(2083)) - Media URL
- `thumbnailUrl` (VARCHAR(2083)) - Thumbnail URL
- `mimeType` (VARCHAR(100)) - MIME type
- `fileSize` (BIGINT) - File size in bytes
- `width` (INTEGER) - Image/video width
- `height` (INTEGER) - Image/video height
- `duration` (INTEGER) - Video/audio duration in seconds
- `altText` (VARCHAR(255)) - Alt text for accessibility
- `title` (VARCHAR(255)) - Media title
- `description` (TEXT) - Media description
- `order` (INTEGER) - Display order
- `metadata` (JSONB) - Additional metadata
- `provider` (VARCHAR(255)) - Storage provider (s3, cloudinary, etc.)
- `providerKey` (VARCHAR(500)) - Provider-specific key
- `createdAt` (TIMESTAMPTZ) - Creation timestamp
- `updatedAt` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- `idx_media_post_id` - For post lookups
- `idx_media_type` - For type filtering
- `idx_media_mimetype` - For MIME type queries
- `idx_media_post_order` - Composite for ordered retrieval

**Relationships:**
- Many-to-One with Post

---

### 6. Analytics
**Table:** `analytics`

**Description:** Time-series analytics for post publications

**Columns:**
- `id` (UUID, PK) - Unique identifier
- `postPublicationId` (UUID, FK) - Reference to PostPublication
- `platform` (ENUM) - Platform type
- `period` (ENUM) - Aggregation period (hourly, daily, weekly, monthly)
- `recordedAt` (TIMESTAMPTZ) - Recording timestamp
- `likesCount` (INTEGER) - Likes count
- `commentsCount` (INTEGER) - Comments count
- `sharesCount` (INTEGER) - Shares count
- `impressionsCount` (INTEGER) - Impressions count
- `reachCount` (INTEGER) - Reach count
- `clicksCount` (INTEGER) - Clicks count
- `savesCount` (INTEGER) - Saves count
- `engagementRate` (DECIMAL(5,2)) - Engagement rate percentage
- `demographics` (JSONB) - Demographic data
- `metricsByTime` (JSONB) - Time-series metrics
- `rawData` (JSONB) - Raw platform data
- `createdAt` (TIMESTAMPTZ) - Creation timestamp
- `updatedAt` (TIMESTAMPTZ) - Last update timestamp

**Indexes:**
- `idx_analytics_post_publication_id` - For publication lookups
- `idx_analytics_platform` - For platform filtering
- `idx_analytics_period` - For period filtering
- `idx_analytics_recorded_at` - For time-series queries
- `idx_analytics_publication_recorded` - Composite for analytics retrieval

**Relationships:**
- Many-to-One with PostPublication

---

## Enums

### Platform
```typescript
enum Platform {
  THREADS = 'threads',
  INSTAGRAM = 'instagram',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
  TIKTOK = 'tiktok',
}
```

### AccountStatus
```typescript
enum AccountStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error',
  PENDING = 'pending',
}
```

### PostStatus
```typescript
enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
```

### ContentType
```typescript
enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  CAROUSEL = 'carousel',
  STORY = 'story',
  REEL = 'reel',
  MIXED = 'mixed',
}
```

### UserRole
```typescript
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
}
```

---

## PostgreSQL-Specific Features

### JSONB Columns
The schema extensively uses PostgreSQL's JSONB type for flexible data storage:
- `User.preferences` - User settings
- `SocialAccount.metadata` - Platform-specific data
- `Post.hashtags` - Array of hashtags (queryable with GIN index)
- `Post.mentions` - Array of mentions
- `Post.analytics` - Aggregated analytics
- `PostPublication.analytics` - Platform analytics
- `Media.metadata` - Media metadata
- `Analytics.demographics` - Demographic data
- `Analytics.metricsByTime` - Time-series data
- `Analytics.rawData` - Raw platform response

### Timestamptz Columns
All timestamp columns use `timestamp with time zone` for proper timezone handling.

### Indexes
The schema includes:
- **B-tree indexes** for equality and range queries
- **Composite indexes** for multi-column queries
- **Unique constraints** for data integrity
- **Foreign key indexes** for join performance

---

## Migration Considerations

### Initial Migration
When creating the initial migration, consider:

1. **Order of operations:**
   - Create tables with foreign keys last
   - Create indexes after data load for bulk imports
   - Create constraints after indexes

2. **Indexes to create manually:**
   ```sql
   -- GIN index for JSONB array operations
   CREATE INDEX idx_posts_hashtags_gin ON posts USING GIN (hashtags);
   CREATE INDEX idx_posts_mentions_gin ON posts USING GIN (mentions);
   
   -- GIN index for JSONB containment queries
   CREATE INDEX idx_users_preferences_gin ON users USING GIN (preferences);
   CREATE INDEX idx_social_accounts_metadata_gin ON social_accounts USING GIN (metadata);
   ```

3. **Partitioning strategy (future):**
   - Consider partitioning `analytics` table by `recordedAt`
   - Consider partitioning `post_publications` by `publishedAt`

4. **Performance optimizations:**
   ```sql
   -- Increase statistics target for better query plans
   ALTER TABLE posts ALTER COLUMN scheduled_at SET STATISTICS 1000;
   ALTER TABLE post_publications ALTER COLUMN published_at SET STATISTICS 1000;
   
   -- Create partial indexes for common queries
   CREATE INDEX idx_posts_scheduled_active 
     ON posts (scheduled_at) 
     WHERE status = 'scheduled' AND scheduled_at > NOW();
   ```

---

## Common Query Patterns

### Get user's scheduled posts
```typescript
const posts = await postRepository.find({
  where: {
    userId: userId,
    status: PostStatus.SCHEDULED,
    scheduledAt: MoreThan(new Date()),
  },
  order: {
    scheduledAt: 'ASC',
  },
})
```

### Get active social accounts
```typescript
const accounts = await socialAccountRepository.find({
  where: {
    userId: userId,
    status: AccountStatus.ACTIVE,
  },
})
```

### Get post analytics across platforms
```typescript
const publications = await postPublicationRepository.find({
  where: {
    postId: postId,
  },
  relations: ['socialAccount'],
  order: {
    publishedAt: 'DESC',
  },
})
```

### Search posts by hashtags
```typescript
const posts = await postRepository
  .createQueryBuilder('post')
  .where('post.hashtags @> :hashtag', { hashtag: ['example'] })
  .getMany()
```

---

## Security Considerations

1. **Token Storage:** Access and refresh tokens should be encrypted at rest
2. **Password Hashing:** Use bcrypt or argon2 for password hashing
3. **SQL Injection:** Prisma parameterized queries prevent SQL injection
4. **Row-Level Security:** Consider implementing RLS for multi-tenant scenarios
5. **Audit Logging:** Add triggers to track sensitive data changes

---

## Performance Tuning

### Connection Pooling
```typescript
extra: {
  max: 20,                          // Max connections
  idleTimeoutMillis: 30000,         // Close idle connections
  connectionTimeoutMillis: 2000,    // Connection timeout
}
```

### Query Optimization Tips
1. Use `EXPLAIN ANALYZE` to analyze query performance
2. Create composite indexes for frequently joined columns
3. Use partial indexes for filtered subsets
4. Consider materialized views for complex analytics queries
5. Monitor and tune `work_mem`, `maintenance_work_mem`, and `shared_buffers`

### Autovacuum Tuning
For high-traffic tables, consider:
```sql
ALTER TABLE post_publications SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
```

---

## Backup Strategy

1. **Regular backups:** Use `pg_dump` for logical backups
2. **Continuous archiving:** Configure WAL archiving for point-in-time recovery
3. **Monitoring:** Set up alerts for backup failures
4. **Testing:** Regularly test backup restoration procedures

---

## Future Enhancements

1. **Partitioning:** Implement table partitioning for analytics
2. **Full-text search:** Add PostgreSQL full-text search for post content
3. **Caching:** Implement Redis caching for frequently accessed data
4. **Read replicas:** Use read replicas for analytics queries
5. **Archiving:** Archive old analytics data to cold storage
