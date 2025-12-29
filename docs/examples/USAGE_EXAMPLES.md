# TypeORM Entity Usage Examples

This document provides practical examples of using the SMMP TypeORM entities.

## Table of Contents

1. [Database Connection](#database-connection)
2. [User Operations](#user-operations)
3. [Social Account Operations](#social-account-operations)
4. [Post Operations](#post-operations)
5. [Post Publication Operations](#post-publication-operations)
6. [Media Operations](#media-operations)
7. [Analytics Operations](#analytics-operations)
8. [Advanced Queries](#advanced-queries)
9. [Transactions](#transactions)

---

## Database Connection

### Initialize Database Connection

```typescript
// src/app.ts
import dataSource from './database/config/data-source'

async function initializeDatabase() {
  try {
    await dataSource.initialize()
    console.log('Database connection established')
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}

initializeDatabase()
```

### Using Connection in Express/Next.js

```typescript
// src/lib/db.ts
import dataSource from '../database/config/data-source'

let connection: typeof dataSource | null = null

export async function getDatabase() {
  if (!connection) {
    connection = await dataSource.initialize()
  }
  return connection
}

// Usage in API routes
export async function GET(request: Request) {
  const db = await getDatabase()
  const users = await db.getRepository(User).find()
  return Response.json(users)
}
```

---

## User Operations

### Create a New User

```typescript
import { User } from '../database/entities'
import { UserRole } from '../database/entities/enums'

async function createUser(userData: {
  name: string
  email: string
  password: string // Already hashed
}) {
  const userRepo = dataSource.getRepository(User)
  
  const user = userRepo.create({
    name: userData.name,
    email: userData.email,
    password: userData.password,
    role: UserRole.USER,
    isActive: true,
    emailVerified: false,
  })
  
  await userRepo.save(user)
  return user
}

// Usage
const user = await createUser({
  name: 'John Doe',
  email: 'john@example.com',
  password: '$2b$10$hashedPasswordHere',
})
```

### Find User by Email

```typescript
async function getUserByEmail(email: string) {
  const userRepo = dataSource.getRepository(User)
  const user = await userRepo.findOne({
    where: { email },
    relations: ['socialAccounts', 'posts'],
  })
  return user
}
```

### Update User Profile

```typescript
async function updateUserProfile(
  userId: string,
  updates: {
    name?: string
    avatar?: string
    preferences?: Record<string, unknown>
  }
) {
  const userRepo = dataSource.getRepository(User)
  await userRepo.update(userId, updates)
  return userRepo.findOneBy({ id: userId })
}
```

---

## Social Account Operations

### Connect a Social Account

```typescript
import { SocialAccount } from '../database/entities'
import { Platform, AccountStatus } from '../database/entities/enums'

async function connectSocialAccount(data: {
  userId: string
  platform: Platform
  platformUserId: string
  username: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date
}) {
  const accountRepo = dataSource.getRepository(SocialAccount)
  
  const account = accountRepo.create({
    ...data,
    status: AccountStatus.ACTIVE,
    health: 'healthy' as const,
  })
  
  await accountRepo.save(account)
  return account
}

// Usage
const account = await connectSocialAccount({
  userId: 'user-uuid',
  platform: Platform.INSTAGRAM,
  platformUserId: '123456789',
  username: 'johndoe',
  accessToken: 'IGQVJ...',
  refreshToken: 'refresh_token',
  tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
})
```

### Get User's Active Accounts

```typescript
async function getUserActiveAccounts(userId: string) {
  const accountRepo = dataSource.getRepository(SocialAccount)
  
  return accountRepo.find({
    where: {
      userId,
      status: AccountStatus.ACTIVE,
    },
    order: { createdAt: 'DESC' },
  })
}
```

### Update Account Statistics

```typescript
async function updateAccountStats(
  accountId: string,
  stats: {
    followersCount: number
    followingCount: number
    postsCount: number
  }
) {
  const accountRepo = dataSource.getRepository(SocialAccount)
  
  await accountRepo.update(accountId, {
    ...stats,
    lastSyncedAt: new Date(),
  })
}
```

---

## Post Operations

### Create a Draft Post

```typescript
import { Post } from '../database/entities'
import { PostStatus, ContentType } from '../database/entities/enums'

async function createDraftPost(data: {
  userId: string
  content: string
  title?: string
  hashtags?: string[]
  mentions?: string[]
}) {
  const postRepo = dataSource.getRepository(Post)
  
  const post = postRepo.create({
    userId: data.userId,
    content: data.content,
    title: data.title,
    hashtags: data.hashtags || [],
    mentions: data.mentions || [],
    status: PostStatus.DRAFT,
    contentType: ContentType.TEXT,
    isScheduled: false,
  })
  
  await postRepo.save(post)
  return post
}
```

### Schedule a Post for Multiple Platforms

```typescript
import { Post, PostPublication, SocialAccount } from '../database/entities'
import { Platform, PostStatus } from '../database/entities/enums'

async function schedulePost(data: {
  userId: string
  content: string
  scheduledAt: Date
  platformAccountIds: string[] // Social account IDs
}) {
  const postRepo = dataSource.getRepository(Post)
  const publicationRepo = dataSource.getRepository(PostPublication)
  
  // Create the post
  const post = postRepo.create({
    userId: data.userId,
    content: data.content,
    scheduledAt: data.scheduledAt,
    status: PostStatus.SCHEDULED,
    isScheduled: true,
  })
  
  await postRepo.save(post)
  
  // Create publications for each platform
  for (const accountId of data.platformAccountIds) {
    const account = await dataSource
      .getRepository(SocialAccount)
      .findOneBy({ id: accountId })
    
    if (!account) continue
    
    const publication = publicationRepo.create({
      postId: post.id,
      socialAccountId: accountId,
      platform: account.platform,
      status: PostStatus.SCHEDULED,
      scheduledFor: data.scheduledAt,
    })
    
    await publicationRepo.save(publication)
  }
  
  return post
}
```

### Get Scheduled Posts Due for Publishing

```typescript
async function getDueScheduledPosts() {
  const postRepo = dataSource.getRepository(Post)
  
  return postRepo
    .createQueryBuilder('post')
    .leftJoinAndSelect('post.publications', 'publications')
    .leftJoinAndSelect('publications.socialAccount', 'account')
    .where('post.status = :status', { status: PostStatus.SCHEDULED })
    .andWhere('post.scheduledAt <= :now', { now: new Date() })
    .orderBy('post.scheduledAt', 'ASC')
    .getMany()
}
```

### Update Post Status After Publishing

```typescript
async function markPostAsPublished(
  postId: string,
  platformPostId: string,
  platformPostUrl: string
) {
  await dataSource
    .getRepository(Post)
    .update(postId, {
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
    })
  
  await dataSource
    .getRepository(PostPublication)
    .update(
      { postId, platformPostId },
      {
        status: PostStatus.PUBLISHED,
        platformPostId,
        platformPostUrl,
        publishedAt: new Date(),
      }
    )
}
```

---

## Post Publication Operations

### Find Publications by Platform

```typescript
async function getPublishedPostsByPlatform(
  userId: string,
  platform: Platform
) {
  const publicationRepo = dataSource.getRepository(PostPublication)
  
  return publicationRepo
    .createQueryBuilder('publication')
    .leftJoinAndSelect('publication.socialAccount', 'account')
    .leftJoinAndSelect('publication.post', 'post')
    .where('account.userId = :userId', { userId })
    .andWhere('publication.platform = :platform', { platform })
    .andWhere('publication.status = :status', { status: PostStatus.PUBLISHED })
    .orderBy('publication.publishedAt', 'DESC')
    .getMany()
}
```

### Update Publication Analytics

```typescript
async function updatePublicationAnalytics(
  publicationId: string,
  analytics: {
    likesCount: number
    commentsCount: number
    sharesCount: number
    impressionsCount: number
  }
) {
  const publicationRepo = dataSource.getRepository(PostPublication)
  
  await publicationRepo.update(publicationId, {
    ...analytics,
    lastSyncedAt: new Date(),
  })
}
```

---

## Media Operations

### Add Media to Post

```typescript
import { Media } from '../database/entities'
import { MediaType } from '../database/entities/enums'

async function attachMediaToPost(data: {
  postId: string
  url: string
  mimeType: string
  type: MediaType
  width?: number
  height?: number
  altText?: string
}) {
  const mediaRepo = dataSource.getRepository(Media)
  
  // Get current order count
  const count = await mediaRepo.count({
    where: { postId: data.postId },
  })
  
  const media = mediaRepo.create({
    ...data,
    order: count,
  })
  
  await mediaRepo.save(media)
  return media
}
```

### Get Post Media

```typescript
async function getPostMedia(postId: string) {
  const mediaRepo = dataSource.getRepository(Media)
  
  return mediaRepo.find({
    where: { postId },
    order: { order: 'ASC' },
  })
}
```

---

## Analytics Operations

### Record Daily Analytics

```typescript
import { Analytics } from '../database/entities'
import { MetricsPeriod } from '../database/entities/enums'

async function recordDailyAnalytics(data: {
  postPublicationId: string
  platform: Platform
  likesCount: number
  commentsCount: number
  sharesCount: number
  impressionsCount: number
  reachCount: number
}) {
  const analyticsRepo = dataSource.getRepository(Analytics)
  
  const analytics = analyticsRepo.create({
    ...data,
    period: MetricsPeriod.DAILY,
    recordedAt: new Date(),
  })
  
  await analyticsRepo.save(analytics)
  return analytics
}
```

### Get Analytics Trend

```typescript
async function getAnalyticsTrend(
  postPublicationId: string,
  days = 7
) {
  const analyticsRepo = dataSource.getRepository(Analytics)
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return analyticsRepo
    .createQueryBuilder('analytics')
    .where('analytics.postPublicationId = :id', { id: postPublicationId })
    .andWhere('analytics.recordedAt >= :startDate', { startDate })
    .orderBy('analytics.recordedAt', 'ASC')
    .getMany()
}
```

---

## Advanced Queries

### Search Posts by Hashtags (JSONB Query)

```typescript
async function searchByHashtags(userId: string, hashtags: string[]) {
  const postRepo = dataSource.getRepository(Post)
  
  return postRepo
    .createQueryBuilder('post')
    .where('post.userId = :userId', { userId })
    .andWhere('post.hashtags @> :hashtags', { hashtags })
    .orderBy('post.createdAt', 'DESC')
    .getMany()
}

// Usage
const posts = await searchByHashtags('user-uuid', ['javascript', 'typescript'])
```

### Get Posts with Most Engagement

```typescript
async function getTopPostsByEngagement(userId: string, limit = 10) {
  const postRepo = dataSource.getRepository(Post)
  
  return postRepo
    .createQueryBuilder('post')
    .where('post.userId = :userId', { userId })
    .andWhere('post.status = :status', { status: PostStatus.PUBLISHED })
    .orderBy('post.analytics->>"totalLikes"', 'DESC')
    .addOrderBy('post.analytics->>"totalComments"', 'DESC')
    .limit(limit)
    .getMany()
}
```

### Find Duplicate Scheduled Times

```typescript
async function findScheduleConflicts(userId: string, scheduledAt: Date) {
  const postRepo = dataSource.getRepository(Post)
  
  return postRepo
    .createQueryBuilder('post')
    .where('post.userId = :userId', { userId })
    .andWhere('post.status = :status', { status: PostStatus.SCHEDULED })
    .andWhere('ABS(EXTRACT(EPOCH FROM (post.scheduledAt - :scheduledAt))) < 300', { // 5 minutes
      scheduledAt,
    })
    .getMany()
}
```

---

## Transactions

### Create Post with Media (Transaction)

```typescript
async function createPostWithMedia(data: {
  userId: string
  content: string
  mediaFiles: Array<{
    url: string
    mimeType: string
    type: MediaType
  }>
}) {
  await dataSource.transaction(async (transactionalEntityManager) => {
    // Create post
    const post = transactionalEntityManager.create(Post, {
      userId: data.userId,
      content: data.content,
      status: PostStatus.DRAFT,
      contentType: data.mediaFiles.length > 0 ? ContentType.MEDIA : ContentType.TEXT,
    })
    
    await transactionalEntityManager.save(post)
    
    // Create media entries
    for (let i = 0; i < data.mediaFiles.length; i++) {
      const media = transactionalEntityManager.create(Media, {
        postId: post.id,
        ...data.mediaFiles[i],
        order: i,
      })
      
      await transactionalEntityManager.save(media)
    }
    
    return post
  })
}
```

### Schedule Post with Transaction

```typescript
async function schedulePostWithPlatforms(data: {
  userId: string
  content: string
  scheduledAt: Date
  accountIds: string[]
}) {
  await dataSource.transaction(async (transactionalEntityManager) => {
    // Create post
    const post = transactionalEntityManager.create(Post, {
      userId: data.userId,
      content: data.content,
      scheduledAt: data.scheduledAt,
      status: PostStatus.SCHEDULED,
      isScheduled: true,
    })
    
    await transactionalEntityManager.save(Post, post)
    
    // Create publications
    for (const accountId of data.accountIds) {
      const account = await transactionalEntityManager.findOne(SocialAccount, {
        where: { id: accountId },
      })
      
      if (!account) continue
      
      const publication = transactionalEntityManager.create(PostPublication, {
        postId: post.id,
        socialAccountId: accountId,
        platform: account.platform,
        status: PostStatus.SCHEDULED,
        scheduledFor: data.scheduledAt,
      })
      
      await transactionalEntityManager.save(PostPublication, publication)
    }
    
    return post
  })
}
```

---

## Error Handling

### Handle Unique Constraint Violations

```typescript
import { QueryFailedError } from 'typeorm'

async function safeCreateUser(userData: {
  name: string
  email: string
  password: string
}) {
  try {
    const userRepo = dataSource.getRepository(User)
    const user = userRepo.create(userData)
    await userRepo.save(user)
    return { success: true, user }
  } catch (error) {
    if (error instanceof QueryFailedError) {
      // Check for unique constraint violation
      if (error.message.includes('duplicate key')) {
        return {
          success: false,
          error: 'User with this email already exists',
        }
      }
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}
```

---

## Best Practices

1. **Always use transactions** for multi-step operations
2. **Validate data** before saving to database
3. **Use relations** selectively to avoid N+1 queries
4. **Index optimization** - create indexes for frequently queried columns
5. **Connection pooling** - configure appropriate pool size
6. **Error handling** - always handle database errors gracefully
7. **Security** - never expose sensitive fields (passwords, tokens) in API responses
8. **Pagination** - use `skip` and `take` for large result sets
9. **JSONB queries** - use appropriate operators (`@>`, `?`, `@?`) for JSONB columns
10. **Timestamps** - always use `timestamptz` for timezone-aware timestamps
