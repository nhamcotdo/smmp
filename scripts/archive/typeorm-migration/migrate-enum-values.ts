/**
 * Migrate database enum values from lowercase to uppercase
 * Run this after migrating from TypeORM to Prisma
 *
 * This script:
 * 1. Alters the database enum types to include uppercase values
 * 2. Updates all data to use uppercase values
 * 3. Removes the old lowercase enum values
 */

import { config } from 'dotenv'
config()

import { prisma } from '../src/lib/db/connection'

async function migrateEnumValues() {
  console.log('🔄 Migrating enum values to uppercase...')

  try {
    console.log('  Step 1: Adding uppercase enum values...')

    // Alter UserRole enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'USER'
    `
    await prisma.$executeRaw`
      ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'ADMIN'
    `
    await prisma.$executeRaw`
      ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'VIEWER'
    `
    console.log('    Added uppercase UserRole values')

    // Alter AccountStatus enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'ACTIVE'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'REVOKED'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'ERROR'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_status_enum ADD VALUE IF NOT EXISTS 'PENDING'
    `
    console.log('    Added uppercase AccountStatus values')

    // Alter PostStatus enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'DRAFT'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'SCHEDULED'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'PUBLISHING'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'PUBLISHED'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'FAILED'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_status_enum ADD VALUE IF NOT EXISTS 'CANCELLED'
    `
    console.log('    Added uppercase PostStatus values')

    // Alter ContentType enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE posts_contenttype_enum ADD VALUE IF NOT EXISTS 'TEXT'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_contenttype_enum ADD VALUE IF NOT EXISTS 'IMAGE'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_contenttype_enum ADD VALUE IF NOT EXISTS 'VIDEO'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_contenttype_enum ADD VALUE IF NOT EXISTS 'CAROUSEL'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_contenttype_enum ADD VALUE IF NOT EXISTS 'STORY'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_contenttype_enum ADD VALUE IF NOT EXISTS 'REEL'
    `
    await prisma.$executeRaw`
      ALTER TYPE posts_contenttype_enum ADD VALUE IF NOT EXISTS 'MIXED'
    `
    console.log('    Added uppercase ContentType values')

    // Alter Platform enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'THREADS'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'INSTAGRAM'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'TWITTER'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'FACEBOOK'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'LINKEDIN'
    `
    await prisma.$executeRaw`
      ALTER TYPE social_accounts_platform_enum ADD VALUE IF NOT EXISTS 'TIKTOK'
    `
    console.log('    Added uppercase Platform values')

    // Alter RefreshTokenStatus enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE refresh_tokens_status_enum ADD VALUE IF NOT EXISTS 'ACTIVE'
    `
    await prisma.$executeRaw`
      ALTER TYPE refresh_tokens_status_enum ADD VALUE IF NOT EXISTS 'REVOKED'
    `
    await prisma.$executeRaw`
      ALTER TYPE refresh_tokens_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED'
    `
    console.log('    Added uppercase RefreshTokenStatus values')

    // Alter UploadedMediaStatus enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE uploaded_media_status_enum ADD VALUE IF NOT EXISTS 'ACTIVE'
    `
    await prisma.$executeRaw`
      ALTER TYPE uploaded_media_status_enum ADD VALUE IF NOT EXISTS 'DELETED'
    `
    await prisma.$executeRaw`
      ALTER TYPE uploaded_media_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED'
    `
    console.log('    Added uppercase UploadedMediaStatus values')

    // Alter MediaType enum to add uppercase values
    await prisma.$executeRaw`
      ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'IMAGE'
    `
    await prisma.$executeRaw`
      ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'VIDEO'
    `
    await prisma.$executeRaw`
      ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'GIF'
    `
    await prisma.$executeRaw`
      ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'DOCUMENT'
    `
    await prisma.$executeRaw`
      ALTER TYPE media_type_enum ADD VALUE IF NOT EXISTS 'AUDIO'
    `
    console.log('    Added uppercase MediaType values')

    console.log('  Step 2: Updating data to use uppercase values...')

    // Update UserRole enum values
    const userRoleResult = await prisma.$executeRaw`
      UPDATE users SET role = 'USER' WHERE role = 'user'
    `
    console.log(`    Updated ${userRoleResult} user role(s) to USER`)

    const adminRoleResult = await prisma.$executeRaw`
      UPDATE users SET role = 'ADMIN' WHERE role = 'admin'
    `
    console.log(`    Updated ${adminRoleResult} admin role(s) to ADMIN`)

    const viewerRoleResult = await prisma.$executeRaw`
      UPDATE users SET role = 'VIEWER' WHERE role = 'viewer'
    `
    console.log(`    Updated ${viewerRoleResult} viewer role(s) to VIEWER`)

    // Update AccountStatus enum values
    const accountStatusResult = await prisma.$executeRaw`
      UPDATE social_accounts SET status = UPPER(status)
    `
    console.log(`    Updated ${accountStatusResult} account status(es)`)

    // Update PostStatus enum values
    const postStatusResult = await prisma.$executeRaw`
      UPDATE posts SET status = UPPER(status)
    `
    console.log(`    Updated ${postStatusResult} post status(es)`)

    // Update ContentType enum values
    const contentTypeResult = await prisma.$executeRaw`
      UPDATE posts SET "contentType" = UPPER("contentType")
    `
    console.log(`    Updated ${contentTypeResult} content type(s)`)

    // Update Platform enum values
    const platformResult = await prisma.$executeRaw`
      UPDATE social_accounts SET platform = UPPER(platform)
    `
    console.log(`    Updated ${platformResult} platform(s)`)

    // Update RefreshToken status enum values
    const refreshTokenResult = await prisma.$executeRaw`
      UPDATE refresh_tokens SET status = UPPER(status)
    `
    console.log(`    Updated ${refreshTokenResult} refresh token status(es)`)

    // Update UploadedMedia status enum values
    const uploadedMediaResult = await prisma.$executeRaw`
      UPDATE uploaded_media SET status = UPPER(status)
    `
    console.log(`    Updated ${uploadedMediaResult} uploaded media status(es)`)

    // Update Media type enum values
    const mediaTypeResult = await prisma.$executeRaw`
      UPDATE media SET type = UPPER(type)
    `
    console.log(`    Updated ${mediaTypeResult} media type(s)`)

    // Update PostPublication status enum values
    const publicationStatusResult = await prisma.$executeRaw`
      UPDATE post_publications SET status = UPPER(status)
    `
    console.log(`    Updated ${publicationStatusResult} publication status(es)`)

    console.log('✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateEnumValues()
