-- Convert enum values from lowercase to uppercase
-- This script converts all enum values to match Prisma schema requirements

-- ============================================
-- 1. PostStatus enum conversions
-- ============================================

-- Update posts.status
UPDATE posts SET status = 'DRAFT' WHERE status = 'draft';
UPDATE posts SET status = 'SCHEDULED' WHERE status = 'scheduled';
UPDATE posts SET status = 'PUBLISHING' WHERE status = 'publishing';
UPDATE posts SET status = 'PUBLISHED' WHERE status = 'published';
UPDATE posts SET status = 'FAILED' WHERE status = 'failed';
UPDATE posts SET status = 'CANCELLED' WHERE status = 'cancelled';

-- Update post_publications.status
UPDATE post_publications SET status = 'DRAFT' WHERE status = 'draft';
UPDATE post_publications SET status = 'SCHEDULED' WHERE status = 'scheduled';
UPDATE post_publications SET status = 'PUBLISHING' WHERE status = 'publishing';
UPDATE post_publications SET status = 'PUBLISHED' WHERE status = 'published';
UPDATE post_publications SET status = 'FAILED' WHERE status = 'failed';
UPDATE post_publications SET status = 'CANCELLED' WHERE status = 'cancelled';

-- ============================================
-- 2. ContentType enum conversions
-- ============================================

UPDATE posts SET content_type = 'TEXT' WHERE content_type = 'text';
UPDATE posts SET content_type = 'IMAGE' WHERE content_type = 'image';
UPDATE posts SET content_type = 'VIDEO' WHERE content_type = 'video';
UPDATE posts SET content_type = 'CAROUSEL' WHERE content_type = 'carousel';
UPDATE posts SET content_type = 'STORY' WHERE content_type = 'story';
UPDATE posts SET content_type = 'REEL' WHERE content_type = 'reel';
UPDATE posts SET content_type = 'MIXED' WHERE content_type = 'mixed';

-- ============================================
-- 3. AccountStatus enum conversions
-- ============================================

UPDATE social_accounts SET status = 'ACTIVE' WHERE status = 'active';
UPDATE social_accounts SET status = 'EXPIRED' WHERE status = 'expired';
UPDATE social_accounts SET status = 'REVOKED' WHERE status = 'revoked';
UPDATE social_accounts SET status = 'ERROR' WHERE status = 'error';
UPDATE social_accounts SET status = 'PENDING' WHERE status = 'pending';

-- ============================================
-- 4. AccountHealth enum conversions
-- ============================================

UPDATE social_accounts SET health = 'HEALTHY' WHERE health = 'healthy';
UPDATE social_accounts SET health = 'DEGRADED' WHERE health = 'degraded';
UPDATE social_accounts SET health = 'UNHEALTHY' WHERE health = 'unhealthy';
UPDATE social_accounts SET health = 'UNKNOWN' WHERE health = 'unknown';

-- ============================================
-- 5. SocialAccountPlatform enum conversions
-- ============================================

UPDATE social_accounts SET platform = 'THREADS' WHERE platform = 'threads';
UPDATE social_accounts SET platform = 'INSTAGRAM' WHERE platform = 'instagram';
UPDATE social_accounts SET platform = 'TWITTER' WHERE platform = 'twitter';
UPDATE social_accounts SET platform = 'FACEBOOK' WHERE platform = 'facebook';
UPDATE social_accounts SET platform = 'LINKEDIN' WHERE platform = 'linkedin';
UPDATE social_accounts SET platform = 'TIKTOK' WHERE platform = 'tiktok';

-- ============================================
-- 6. PostPublicationPlatform enum conversions
-- ============================================

UPDATE post_publications SET platform = 'THREADS' WHERE platform = 'threads';
UPDATE post_publications SET platform = 'INSTAGRAM' WHERE platform = 'instagram';
UPDATE post_publications SET platform = 'TWITTER' WHERE platform = 'twitter';
UPDATE post_publications SET platform = 'FACEBOOK' WHERE platform = 'facebook';
UPDATE post_publications SET platform = 'LINKEDIN' WHERE platform = 'linkedin';
UPDATE post_publications SET platform = 'TIKTOK' WHERE platform = 'tiktok';

-- ============================================
-- 7. MediaType enum conversions
-- ============================================

UPDATE media SET type = 'IMAGE' WHERE type = 'image';
UPDATE media SET type = 'VIDEO' WHERE type = 'video';
UPDATE media SET type = 'GIF' WHERE type = 'gif';
UPDATE media SET type = 'DOCUMENT' WHERE type = 'document';
UPDATE media SET type = 'AUDIO' WHERE type = 'audio';

-- ============================================
-- 8. UploadedMediaType enum conversions
-- ============================================

UPDATE uploaded_media SET type = 'IMAGE' WHERE type = 'image';
UPDATE uploaded_media SET type = 'VIDEO' WHERE type = 'video';
UPDATE uploaded_media SET type = 'GIF' WHERE type = 'gif';
UPDATE uploaded_media SET type = 'DOCUMENT' WHERE type = 'document';
UPDATE uploaded_media SET type = 'AUDIO' WHERE type = 'audio';

-- ============================================
-- 9. UploadedMediaStatus enum conversions
-- ============================================

UPDATE uploaded_media SET status = 'ACTIVE' WHERE status = 'active';
UPDATE uploaded_media SET status = 'DELETED' WHERE status = 'deleted';
UPDATE uploaded_media SET status = 'EXPIRED' WHERE status = 'expired';

-- ============================================
-- 10. AnalyticsPlatform enum conversions
-- ============================================

UPDATE analytics SET platform = 'THREADS' WHERE platform = 'threads';
UPDATE analytics SET platform = 'INSTAGRAM' WHERE platform = 'instagram';
UPDATE analytics SET platform = 'TWITTER' WHERE platform = 'twitter';
UPDATE analytics SET platform = 'FACEBOOK' WHERE platform = 'facebook';
UPDATE analytics SET platform = 'LINKEDIN' WHERE platform = 'linkedin';
UPDATE analytics SET platform = 'TIKTOK' WHERE platform = 'tiktok';

-- ============================================
-- 11. MetricsPeriod enum conversions
-- ============================================

UPDATE analytics SET period = 'HOURLY' WHERE period = 'hourly';
UPDATE analytics SET period = 'DAILY' WHERE period = 'daily';
UPDATE analytics SET period = 'WEEKLY' WHERE period = 'weekly';
UPDATE analytics SET period = 'MONTHLY' WHERE period = 'monthly';

-- ============================================
-- 12. UserRole enum conversions
-- ============================================

UPDATE users SET role = 'ADMIN' WHERE role = 'admin';
UPDATE users SET role = 'USER' WHERE role = 'user';
UPDATE users SET role = 'VIEWER' WHERE role = 'viewer';

-- ============================================
-- 13. RefreshTokenStatus enum conversions
-- ============================================

UPDATE refresh_tokens SET status = 'ACTIVE' WHERE status = 'active';
UPDATE refresh_tokens SET status = 'REVOKED' WHERE status = 'revoked';
UPDATE refresh_tokens SET status = 'EXPIRED' WHERE status = 'expired';

-- ============================================
-- Verification Queries
-- ============================================

-- Check for any remaining lowercase values (should return 0 rows)
SELECT 'posts' as table_name, status, COUNT(*) FROM posts GROUP BY status;
SELECT 'social_accounts' as table_name, status, COUNT(*) FROM social_accounts GROUP BY status;
SELECT 'social_accounts' as table_name, health, COUNT(*) FROM social_accounts GROUP BY health;
SELECT 'post_publications' as table_name, status, COUNT(*) FROM post_publications GROUP BY status;
SELECT 'post_publications' as table_name, platform, COUNT(*) FROM post_publications GROUP BY platform;
SELECT 'analytics' as table_name, platform, COUNT(*) FROM analytics GROUP BY platform;
SELECT 'analytics' as table_name, period, COUNT(*) FROM analytics GROUP BY period;
