# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SMMP (Social Media Management Platform) is a Next.js 16 application for managing social media content with Threads integration, scheduled publishing, and analytics tracking.

## Development Commands

### Running the Application
- `npm run dev` - HTTP dev server (port 3000)
- `npm run dev:https` - HTTPS dev server (required for OAuth - uses mkcert)
- `npm run build` - Production build
- `npm run start` - Production server

### Code Quality
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint
- `npm run test` - Run Vitest tests
- `npm run test:ui` - Vitest with UI
- `npm run test:coverage` - Test coverage report (note: script may not exist)

### Background Jobs
- `npm run cron:publish` - Manually trigger scheduled post publisher
- Production: Use external cron services or systemd (see README.md)

### Database (Prisma)
- `npm run db:push` - Push schema changes to database (development)
- `npm run db:migrate:dev` - Create and apply migration (development)
- `npm run db:migrate:deploy` - Apply migrations (production)
- `npm run db:studio` - Open Prisma Studio GUI
- `npm run db:seed` - Seed database with sample data

### Database Schema Changes Workflow

**When to use `db push` vs `migrate dev`:**

| Scenario | Command | Use Case |
|----------|---------|----------|
| Development | `npm run db:push` | Rapid prototyping, experimental changes |
| Team Development | `npm run db:migrate:dev --name description` | Tracked schema changes with migration history |
| Production | `npm run db:migrate:deploy` | Apply tested migrations to production |
| Sync Existing DB | `npx prisma db pull` | Sync Prisma schema with existing database |

**Best Practices:**
1. **Always use `migrate dev` for schema changes that will be deployed** - This creates migration history
2. **Only use `db push` for local development experiments** - Avoids migration conflicts
3. **Never use `--accept-data-loss` in production** - Can destroy data without warning
4. **Always review generated migration SQL** - Verify before committing
5. **Test migrations on staging first** - Production deployments should be predictable

**Typical Workflow:**
```bash
# 1. Make schema changes in prisma/schema.prisma
# 2. Create migration (development)
npm run db:migrate:dev --name add_updated_at_columns

# 3. Review the generated migration in prisma/migrations/
# 4. Commit both schema.prisma and migration folder
# 5. In production, deploy:
npm run db:migrate:deploy
```

**Timestamp Behavior:**
- All tables use `@updatedAt` directive for automatic timestamp updates
- Prisma automatically updates `updated_at` on any `update()` operation
- Raw SQL queries (`$executeRaw`) do NOT trigger automatic updates
- Timezone-aware: stored as `TIMESTAMPTZ(3)` with millisecond precision

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5 (strict mode, decorators enabled)
- **Database**: PostgreSQL with Prisma ORM 6.19.1
- **Authentication**: JWT with Passport + httpOnly cookies
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest + Testing Library + jsdom
- **Package Manager**: npm (not pnpm - package.json shows npm scripts)

### Clean Architecture Layers

1. **API Layer** (`src/app/api/`)
   - RESTful endpoints organized by domain (auth, channels, posts, analytics, jobs)
   - No middleware folder - auth logic in route handlers and AuthContext
   - 25+ endpoints across 6 domains

2. **Business Logic** (`src/lib/`)
   - `services/` - External API integrations (Threads, Douyin, R2, media proxy)
   - `jobs/` - Background job logic (scheduled post publisher)
   - `api/` - Internal API client functions (auth, channels)
   - `types/` - TypeScript definitions (auth, analytics, threads)
   - `validators/` - Zod validation schemas
   - `utils/` - Shared utilities (database config, content parsing, timezone)

3. **Data Layer** (`prisma/`)
   - `schema.prisma` - Database schema definitions (8 models, 8 enums)
   - `migrations/` - Database migration history
   - `lib/db/connection.ts` - Prisma Client singleton with global caching

4. **Presentation** (`src/`)
   - `app/` - Next.js pages and layouts
   - `components/` - React components
   - `contexts/` - React contexts (AuthContext)

### Database Entity Relationships

**Core Entities:**
- `User` - Base user entity with cascade delete to social data
- `SocialAccount` - Connected social media accounts (Threads, etc.)
- `RefreshToken` - JWT refresh tokens with device tracking
- `Post` - Content posts with parent-child comment support
- `PostPublication` - Published post instances per platform
- `Media` - Media attachments (images, videos) linked to posts
- `UploadedMedia` - Uploaded file metadata
- `Analytics` - Platform analytics data

**Key Relationships:**
- User → SocialAccount (one-to-many, CASCADE)
- User → Post (one-to-many, CASCADE)
- SocialAccount → Post (many-to-one, SET NULL)
- Post → Post (self-reference for parent-child comments via `parentPostId`)
- Post → PostPublication (one-to-many)
- Post → Media (one-to-many)

**Important Indexes:**
- `idx_posts_parent_status_scheduled` - Optimizes scheduled comment queries
- `idx_posts_user_status` - User's posts by status filtering
- `idx_social_accounts_expires_at` - Token expiration queries

### Threads API Integration Patterns

**OAuth 2.0 Flow (threads.service.ts):**
1. Generate OAuth URL with state parameter validation
2. Exchange code for short-lived token
3. Convert to long-lived token (60 days)
4. Store same value in both `accessToken` and `refreshToken` fields
5. Refresh using the access token as the refresh token parameter

**Publishing Flow (threads-publisher.service.ts):**
1. Create container with post content/media
2. Poll for container readiness (with backoff and timeout)
3. Publish container using `creation_id` parameter (NOT `container_id`)
4. Handle text (30s), image (30s), video (10min) with different timeouts

**Scheduled Comments Feature:**
- Parent-child relationship via `parentPostId` field
- Maximum 10 scheduled comments per parent post
- Comments scheduled with `scheduledAt` timestamp
- Publisher processes parent and child posts in batches

### Global Database Connection Pattern

The app uses a Prisma Client singleton pattern (`src/lib/db/connection.ts`):
```typescript
// Global connection caching in development
declare global {
  var __prisma__: PrismaClient | undefined
}

export const prisma = getPrismaClient()
```

Use `prisma` from `@/lib/db/connection` everywhere - never create new PrismaClient instances directly. The connection is cached globally and reused across hot reloads in development.

### Authentication Architecture

- JWT with short-lived access tokens (15min) + long-lived refresh tokens (30d)
- Passport JWT strategy extracts from httpOnly cookies
- AuthContext provides auth state to React components
- Role-based access: Admin, User, Viewer (via enum)
- "Remember Me" functionality extends refresh token expiry

### Development Constraints

**Code Style:**
- No Vietnamese in code or comments (use English only)
- No `any` or `unknown` types (TypeScript strict mode)
- No deprecated APIs (e.g., `.substr()` → `.slice()`)
- No magic numbers - use `src/lib/constants.ts`
- Modular, reusable code with proper error handling

**TypeScript Configuration:**
- `strict: true` enabled
- Path aliases: `@/*` maps to `./src/*`

### Constants Reference (`src/lib/constants.ts`)

- `SCHEDULED_COMMENTS.MAX_ALLOWED` - Maximum scheduled comments per post
- `CAROUSEL.MIN/MAX_ITEMS` - Carousel media limits (2-20)
- `THREADS_POLLING.*` - API polling timeouts and intervals
- `MEDIA_PROXY.*` - Media size limits and presigned URL expiry
- `VALID_REPLY_CONTROLS` - Set of valid Threads reply control values

### Threads HTTPS Setup

**Required for OAuth:**
1. Install mkcert: `brew install mkcert && mkcert -install`
2. Generate certs: `mkcert threads-sample.meta localhost 127.0.0.1` (in `cert/` dir)
3. Add to `/etc/hosts`: `127.0.0.1 threads-sample.meta`
4. Run: `npm run dev:https` (uses custom dev-server-https.ts)

**Environment Variables Needed:**
```
HOSTNAME=threads-sample.meta
PORT=8000
THREADS_REDIRECT_URI=https://threads-sample.meta:8000/api/channels/threads/callback
ALLOWED_DEV_ORIGINS=threads-sample.meta,localhost,127.0.0.1
```

### Scheduled Posts Publisher

**Entry Point:** `scripts/publish-scheduled-posts.ts` → `src/lib/jobs/publish-scheduled-posts.ts`

**Algorithm:**
1. Query posts with `status=SCHEDULED` AND `scheduledAt < NOW`
2. Batch load parent posts for child comments
3. Group by social account to minimize account queries
4. For each post: validate media, call publisher, create PostPublication record
5. Update post status to PUBLISHED or FAILED
6. Return summary with processed/succeeded/failed/missed counts

**Cron Setup (see README.md for full options):**
- crontab: `*/5 * * * * cd /path/to/smmp && npm run cron:publish >> logs/cron.log 2>&1`
- systemd: Use timer unit for 5-minute intervals
- External: POST to `/api/jobs/publish-scheduled` with `Authorization: Bearer CRON_SECRET`

### Important Architectural Notes

**Media Handling:**
- R2 presigned URLs for uploads (via r2-presigned.service.ts)
- Media proxy for external image handling (media-proxy.service.ts)
- Maximum sizes: 10MB images, 50MB videos

**Douyin Integration:**
- Separate service for Douyin (Chinese TikTok) content parsing
- Endpoint: `/api/parse/douyin`

**Testing:**
- Tests in `tests/` directory (not `__tests__`)
- Mock external APIs (Threads, Douyin, etc.)
- Use Vitest with jsdom environment