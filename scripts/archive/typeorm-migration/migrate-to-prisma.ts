/**
 * Comprehensive migration script from TypeORM to Prisma
 *
 * This script:
 * 1. Adds missing updatedAt columns
 * 2. Migrates enum values to uppercase
 * 3. Aligns schema with Prisma expectations
 */

import { config } from 'dotenv'
config()

import { prisma } from '../src/lib/db/connection'

async function migrateToPrisma() {
  console.log('🔄 Starting TypeORM to Prisma migration...')

  try {
    console.log('  Step 1: Adding missing updatedAt columns...')

    // Add missing updatedAt columns with default values
    await prisma.$executeRaw`
      ALTER TABLE media ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
    console.log('    Added media.updatedAt')

    await prisma.$executeRaw`
      ALTER TABLE post_publications ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
    console.log('    Added post_publications.updatedAt')

    await prisma.$executeRaw`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
    console.log('    Added posts.updatedAt')

    await prisma.$executeRaw`
      ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
    console.log('    Added social_accounts.updatedAt')

    await prisma.$executeRaw`
      ALTER TABLE uploaded_media ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `
    console.log('    Added uploaded_media.updatedAt')

    console.log('  Step 2: Adding uppercase enum values...')

    // Add uppercase enum values to existing enums
    // UserRole
    await prisma.$executeRaw`ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'USER'`
    await prisma.$executeRaw`ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'ADMIN'`
    await prisma.$executeRaw`ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'VIEWER'`
    console.log('    Added uppercase UserRole values')

    // AccountStatus
    await prisma.$executeRaw`ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'ACTIVE'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'REVOKED'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'ERROR'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'PENDING'`
    console.log('    Added uppercase AccountStatus values')

    // PostStatus
    await prisma.$executeRaw`ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'DRAFT'`
    await prisma.$executeRaw`ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'SCHEDULED'`
    await prisma.$executeRaw`ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'PUBLISHING'`
    await prisma.$executeRaw`ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'PUBLISHED'`
    await prisma.$executeRaw`ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'FAILED'`
    await prisma.$executeRaw`ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'CANCELLED'`
    console.log('    Added uppercase PostStatus values')

    // Platform
    await prisma.$executeRaw`ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'THREADS'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'INSTAGRAM'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'TWITTER'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'FACEBOOK'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'LINKEDIN'`
    await prisma.$executeRaw`ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'TIKTOK'`
    console.log('    Added uppercase Platform values')

    // RefreshTokenStatus
    await prisma.$executeRaw`ALTER TYPE refresh_tokens_status_enum ADD VALUE IF NOT EXISTS 'ACTIVE'`
    await prisma.$executeRaw`ALTER TYPE refresh_tokens_status_enum ADD VALUE IF NOT EXISTS 'REVOKED'`
    await prisma.$executeRaw`ALTER TYPE refresh_tokens_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED'`
    console.log('    Added uppercase RefreshTokenStatus values')

    // UploadedMediaStatus
    await prisma.$executeRaw`ALTER TYPE uploaded_media_status_enum ADD VALUE IF NOT EXISTS 'ACTIVE'`
    await prisma.$executeRaw`ALTER TYPE uploaded_media_status_enum ADD VALUE IF NOT EXISTS 'DELETED'`
    await prisma.$executeRaw`ALTER TYPE uploaded_media_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED'`
    console.log('    Added uppercase UploadedMediaStatus values')

    // MediaType
    await prisma.$executeRaw`ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'IMAGE'`
    await prisma.$executeRaw`ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'VIDEO'`
    await prisma.$executeRaw`ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'GIF'`
    await prisma.$executeRaw`ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'DOCUMENT'`
    await prisma.$executeRaw`ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'AUDIO'`
    console.log('    Added uppercase MediaType values')

    // PostPublicationStatus
    await prisma.$executeRaw`ALTER TYPE post_publications_status_enum ADD VALUE IF NOT EXISTS 'PUBLISHED'`
    await prisma.$executeRaw`ALTER TYPE post_publications_status_enum ADD VALUE IF NOT EXISTS 'FAILED'`
    console.log('    Added uppercase PostPublicationStatus values')

    console.log('  Step 3: Updating data to use uppercase values...')

    // Update UserRole
    const userRoleResult = await prisma.$executeRaw`UPDATE users SET role = 'USER' WHERE role = 'user'`
    const adminRoleResult = await prisma.$executeRaw`UPDATE users SET role = 'ADMIN' WHERE role = 'admin'`
    const viewerRoleResult = await prisma.$executeRaw`UPDATE users SET role = 'VIEWER' WHERE role = 'viewer'`
    console.log(`    Updated ${userRoleResult + adminRoleResult + viewerRoleResult} user role(s)`)

    // Update AccountStatus (individual updates instead of UPPER)
    const activeAccountResult = await prisma.$executeRaw`UPDATE social_accounts SET status = 'ACTIVE' WHERE status = 'active'`
    const expiredAccountResult = await prisma.$executeRaw`UPDATE social_accounts SET status = 'EXPIRED' WHERE status = 'expired'`
    const revokedAccountResult = await prisma.$executeRaw`UPDATE social_accounts SET status = 'REVOKED' WHERE status = 'revoked'`
    const errorAccountResult = await prisma.$executeRaw`UPDATE social_accounts SET status = 'ERROR' WHERE status = 'error'`
    const pendingAccountResult = await prisma.$executeRaw`UPDATE social_accounts SET status = 'PENDING' WHERE status = 'pending'`
    console.log(`    Updated ${activeAccountResult + expiredAccountResult + revokedAccountResult + errorAccountResult + pendingAccountResult} account status(es)`)

    // Update PostStatus (individual updates)
    const draftResult = await prisma.$executeRaw`UPDATE posts SET status = 'DRAFT' WHERE status = 'draft'`
    const scheduledResult = await prisma.$executeRaw`UPDATE posts SET status = 'SCHEDULED' WHERE status = 'scheduled'`
    const publishingResult = await prisma.$executeRaw`UPDATE posts SET status = 'PUBLISHING' WHERE status = 'publishing'`
    const publishedResult = await prisma.$executeRaw`UPDATE posts SET status = 'PUBLISHED' WHERE status = 'published'`
    const failedResult = await prisma.$executeRaw`UPDATE posts SET status = 'FAILED' WHERE status = 'failed'`
    const cancelledResult = await prisma.$executeRaw`UPDATE posts SET status = 'CANCELLED' WHERE status = 'cancelled'`
    console.log(`    Updated ${draftResult + scheduledResult + publishingResult + publishedResult + failedResult + cancelledResult} post status(es)`)

    // Update Platform (individual updates)
    const threadsPlatformResult = await prisma.$executeRaw`UPDATE social_accounts SET platform = 'THREADS' WHERE platform = 'threads'`
    const instagramPlatformResult = await prisma.$executeRaw`UPDATE social_accounts SET platform = 'INSTAGRAM' WHERE platform = 'instagram'`
    const twitterPlatformResult = await prisma.$executeRaw`UPDATE social_accounts SET platform = 'TWITTER' WHERE platform = 'twitter'`
    const facebookPlatformResult = await prisma.$executeRaw`UPDATE social_accounts SET platform = 'FACEBOOK' WHERE platform = 'facebook'`
    const linkedinPlatformResult = await prisma.$executeRaw`UPDATE social_accounts SET platform = 'LINKEDIN' WHERE platform = 'linkedin'`
    const tiktokPlatformResult = await prisma.$executeRaw`UPDATE social_accounts SET platform = 'TIKTOK' WHERE platform = 'tiktok'`
    console.log(`    Updated ${threadsPlatformResult + instagramPlatformResult + twitterPlatformResult + facebookPlatformResult + linkedinPlatformResult + tiktokPlatformResult} platform(s)`)

    // Update RefreshToken status (individual updates with cast)
    const activeRefreshResult = await prisma.$executeRaw`UPDATE refresh_tokens SET status = 'ACTIVE' WHERE status::text = 'active'`
    const revokedRefreshResult = await prisma.$executeRaw`UPDATE refresh_tokens SET status = 'REVOKED' WHERE status::text = 'revoked'`
    const expiredRefreshResult = await prisma.$executeRaw`UPDATE refresh_tokens SET status = 'EXPIRED' WHERE status::text = 'expired'`
    console.log(`    Updated ${activeRefreshResult + revokedRefreshResult + expiredRefreshResult} refresh token status(es)`)

    // Update UploadedMedia status (individual updates with cast)
    const activeMediaResult = await prisma.$executeRaw`UPDATE uploaded_media SET status = 'ACTIVE' WHERE status::text = 'active'`
    const deletedMediaResult = await prisma.$executeRaw`UPDATE uploaded_media SET status = 'DELETED' WHERE status::text = 'deleted'`
    const expiredMediaResult = await prisma.$executeRaw`UPDATE uploaded_media SET status = 'EXPIRED' WHERE status::text = 'expired'`
    console.log(`    Updated ${activeMediaResult + deletedMediaResult + expiredMediaResult} uploaded media status(es)`)

    // Update Media type (individual updates with cast)
    const imageMediaTypeResult = await prisma.$executeRaw`UPDATE media SET type = 'IMAGE' WHERE type::text = 'image'`
    const videoMediaTypeResult = await prisma.$executeRaw`UPDATE media SET type = 'VIDEO' WHERE type::text = 'video'`
    const gifMediaTypeResult = await prisma.$executeRaw`UPDATE media SET type = 'GIF' WHERE type::text = 'gif'`
    const documentMediaTypeResult = await prisma.$executeRaw`UPDATE media SET type = 'DOCUMENT' WHERE type::text = 'document'`
    const audioMediaTypeResult = await prisma.$executeRaw`UPDATE media SET type = 'AUDIO' WHERE type::text = 'audio'`
    console.log(`    Updated ${imageMediaTypeResult + videoMediaTypeResult + gifMediaTypeResult + documentMediaTypeResult + audioMediaTypeResult} media type(s)`)

    // Update PostPublication status (individual updates with cast)
    const publishedPubResult = await prisma.$executeRaw`UPDATE post_publications SET status = 'PUBLISHED' WHERE status::text = 'published'`
    const failedPubResult = await prisma.$executeRaw`UPDATE post_publications SET status = 'FAILED' WHERE status::text = 'failed'`
    console.log(`    Updated ${publishedPubResult + failedPubResult} publication status(es)`)

    console.log('  Step 4: Creating missing contentType column...')
    try {
      await prisma.$executeRaw`
        ALTER TABLE posts ADD COLUMN IF NOT EXISTS "contentType" VARCHAR(50) DEFAULT 'TEXT'
      `
      console.log('    Added posts.contentType column')

      // Update contentType based on media relationships
      await prisma.$executeRaw`
        UPDATE posts
        SET "contentType" = CASE
          WHEN EXISTS (SELECT 1 FROM media WHERE media."postId" = posts.id AND media.type = 'VIDEO') THEN 'VIDEO'
          WHEN EXISTS (SELECT 1 FROM media WHERE media."postId" = posts.id AND media.type = 'IMAGE') THEN 'IMAGE'
          WHEN (SELECT COUNT(*) FROM media WHERE media."postId" = posts.id) > 1 THEN 'CAROUSEL'
          ELSE 'TEXT'
        END
      `
      console.log('    Updated contentType based on media relationships')
    } catch (e) {
      console.log('    contentType column already exists or error:', e instanceof Error ? e.message : e)
    }

    console.log('✅ Migration completed successfully!')
    console.log('  Next step: Run `npx prisma db push --skip-generate` to sync the schema')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateToPrisma()
