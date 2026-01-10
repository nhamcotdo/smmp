-- Migration 1: Add uppercase enum values (keep lowercase)
-- This is SAFE and won't lose any data
--
-- Run this first with: psql $DATABASE_URL -f prisma/migrations/20250110_add_uppercase_enum_values/migration.sql
-- Or use: npm run migrate:add:uppercase

-- ============================================
-- 1. PostStatus enums
-- ============================================

-- posts.status enum
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'PUBLISHING';
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- post_publications.status enum (separate type)
ALTER TYPE "post_publications_status_enum" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "post_publications_status_enum" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "post_publications_status_enum" ADD VALUE IF NOT EXISTS 'PUBLISHING';
ALTER TYPE "post_publications_status_enum" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "post_publications_status_enum" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "post_publications_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- ============================================
-- 2. ContentType enum
-- ============================================

ALTER TYPE "posts_content_type_enum" ADD VALUE IF NOT EXISTS 'TEXT';
ALTER TYPE "posts_content_type_enum" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "posts_content_type_enum" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "posts_content_type_enum" ADD VALUE IF NOT EXISTS 'CAROUSEL';
ALTER TYPE "posts_content_type_enum" ADD VALUE IF NOT EXISTS 'STORY';
ALTER TYPE "posts_content_type_enum" ADD VALUE IF NOT EXISTS 'REEL';
ALTER TYPE "posts_content_type_enum" ADD VALUE IF NOT EXISTS 'MIXED';

-- ============================================
-- 3. AccountStatus enum
-- ============================================

ALTER TYPE "social_accounts_status_enum" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "social_accounts_status_enum" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "social_accounts_status_enum" ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "social_accounts_status_enum" ADD VALUE IF NOT EXISTS 'ERROR';
ALTER TYPE "social_accounts_status_enum" ADD VALUE IF NOT EXISTS 'PENDING';

-- ============================================
-- 4. AccountHealth enum
-- ============================================

ALTER TYPE "social_accounts_health_enum" ADD VALUE IF NOT EXISTS 'HEALTHY';
ALTER TYPE "social_accounts_health_enum" ADD VALUE IF NOT EXISTS 'DEGRADED';
ALTER TYPE "social_accounts_health_enum" ADD VALUE IF NOT EXISTS 'UNHEALTHY';
ALTER TYPE "social_accounts_health_enum" ADD VALUE IF NOT EXISTS 'UNKNOWN';

-- ============================================
-- 5. Platform enums
-- ============================================

-- SocialAccountPlatform
ALTER TYPE "social_accounts_platform_enum" ADD VALUE IF NOT EXISTS 'THREADS';
ALTER TYPE "social_accounts_platform_enum" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "social_accounts_platform_enum" ADD VALUE IF NOT EXISTS 'TWITTER';
ALTER TYPE "social_accounts_platform_enum" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "social_accounts_platform_enum" ADD VALUE IF NOT EXISTS 'LINKEDIN';
ALTER TYPE "social_accounts_platform_enum" ADD VALUE IF NOT EXISTS 'TIKTOK';

-- PostPublicationPlatform
ALTER TYPE "post_publications_platform_enum" ADD VALUE IF NOT EXISTS 'THREADS';
ALTER TYPE "post_publications_platform_enum" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "post_publications_platform_enum" ADD VALUE IF NOT EXISTS 'TWITTER';
ALTER TYPE "post_publications_platform_enum" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "post_publications_platform_enum" ADD VALUE IF NOT EXISTS 'LINKEDIN';
ALTER TYPE "post_publications_platform_enum" ADD VALUE IF NOT EXISTS 'TIKTOK';

-- AnalyticsPlatform
ALTER TYPE "analytics_platform_enum" ADD VALUE IF NOT EXISTS 'THREADS';
ALTER TYPE "analytics_platform_enum" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "analytics_platform_enum" ADD VALUE IF NOT EXISTS 'TWITTER';
ALTER TYPE "analytics_platform_enum" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "analytics_platform_enum" ADD VALUE IF NOT EXISTS 'LINKEDIN';
ALTER TYPE "analytics_platform_enum" ADD VALUE IF NOT EXISTS 'TIKTOK';

-- ============================================
-- 6. MediaType enum
-- ============================================

ALTER TYPE "media_type_enum" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "media_type_enum" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "media_type_enum" ADD VALUE IF NOT EXISTS 'GIF';
ALTER TYPE "media_type_enum" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "media_type_enum" ADD VALUE IF NOT EXISTS 'AUDIO';

-- ============================================
-- 7. UploadedMediaType enum
-- ============================================

ALTER TYPE "uploaded_media_type_enum" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "uploaded_media_type_enum" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "uploaded_media_type_enum" ADD VALUE IF NOT EXISTS 'GIF';
ALTER TYPE "uploaded_media_type_enum" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "uploaded_media_type_enum" ADD VALUE IF NOT EXISTS 'AUDIO';

-- ============================================
-- 8. UploadedMediaStatus enum
-- ============================================

ALTER TYPE "uploaded_media_status_enum" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "uploaded_media_status_enum" ADD VALUE IF NOT EXISTS 'DELETED';
ALTER TYPE "uploaded_media_status_enum" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- ============================================
-- 9. MetricsPeriod enum
-- ============================================

ALTER TYPE "analytics_period_enum" ADD VALUE IF NOT EXISTS 'HOURLY';
ALTER TYPE "analytics_period_enum" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "analytics_period_enum" ADD VALUE IF NOT EXISTS 'WEEKLY';
ALTER TYPE "analytics_period_enum" ADD VALUE IF NOT EXISTS 'MONTHLY';

-- ============================================
-- 10. UserRole enum
-- ============================================

ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'USER';
ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'VIEWER';

-- ============================================
-- 11. RefreshTokenStatus enum
-- ============================================

ALTER TYPE "refresh_tokens_status_enum" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "refresh_tokens_status_enum" ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "refresh_tokens_status_enum" ADD VALUE IF NOT EXISTS 'EXPIRED';
