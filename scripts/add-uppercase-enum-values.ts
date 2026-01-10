/**
 * Add uppercase enum values to PostgreSQL enum types
 *
 * This script adds uppercase values to existing enum types while keeping
 * lowercase values. This is safe and won't lose any data.
 *
 * Run this BEFORE convert-enums-to-uppercase.ts
 *
 * Usage:
 *   npx tsx scripts/add-uppercase-enum-values.ts
 */

import { prisma } from '../src/lib/db/connection'

interface EnumValue {
  enumType: string
  valuesToAdd: string[]
}

const enumValuesToAdd: EnumValue[] = [
  // PostStatus - posts and post_publications use different enum types
  {
    enumType: 'posts_status_enum',
    valuesToAdd: ['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'],
  },
  {
    enumType: 'post_publications_status_enum',
    valuesToAdd: ['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'],
  },
  // ContentType
  {
    enumType: 'posts_content_type_enum',
    valuesToAdd: ['TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL', 'STORY', 'REEL', 'MIXED'],
  },
  // AccountStatus
  {
    enumType: 'social_accounts_status_enum',
    valuesToAdd: ['ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR', 'PENDING'],
  },
  // AccountHealth
  {
    enumType: 'social_accounts_health_enum',
    valuesToAdd: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'],
  },
  // Platform enums
  {
    enumType: 'social_accounts_platform_enum',
    valuesToAdd: ['THREADS', 'INSTAGRAM', 'TWITTER', 'FACEBOOK', 'LINKEDIN', 'TIKTOK'],
  },
  {
    enumType: 'post_publications_platform_enum',
    valuesToAdd: ['THREADS', 'INSTAGRAM', 'TWITTER', 'FACEBOOK', 'LINKEDIN', 'TIKTOK'],
  },
  {
    enumType: 'analytics_platform_enum',
    valuesToAdd: ['THREADS', 'INSTAGRAM', 'TWITTER', 'FACEBOOK', 'LINKEDIN', 'TIKTOK'],
  },
  // MediaType
  {
    enumType: 'media_type_enum',
    valuesToAdd: ['IMAGE', 'VIDEO', 'GIF', 'DOCUMENT', 'AUDIO'],
  },
  // UploadedMediaType
  {
    enumType: 'uploaded_media_type_enum',
    valuesToAdd: ['IMAGE', 'VIDEO', 'GIF', 'DOCUMENT', 'AUDIO'],
  },
  // UploadedMediaStatus
  {
    enumType: 'uploaded_media_status_enum',
    valuesToAdd: ['ACTIVE', 'DELETED', 'EXPIRED'],
  },
  // MetricsPeriod
  {
    enumType: 'analytics_period_enum',
    valuesToAdd: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'],
  },
  // UserRole
  {
    enumType: 'users_role_enum',
    valuesToAdd: ['ADMIN', 'USER', 'VIEWER'],
  },
  // RefreshTokenStatus
  {
    enumType: 'refresh_tokens_status_enum',
    valuesToAdd: ['ACTIVE', 'REVOKED', 'EXPIRED'],
  },
]

async function addEnumValue(enumType: string, value: string): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "${enumType}" ADD VALUE IF NOT EXISTS '${value}'`
    )
    return true
  } catch (error: any) {
    // Ignore error if value already exists
    if (error?.code === '42710' || error?.message?.includes('already exists')) {
      return true
    }
    console.error(`  ✗ Failed to add ${value}:`, error?.message || error)
    return false
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Add Uppercase Values to Enum Types')
  console.log('═══════════════════════════════════════════════════════════\n')

  // Verify database connection
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    console.log('✓ Database connection verified\n')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
  }

  let totalAdded = 0
  let totalFailed = 0

  for (const { enumType, valuesToAdd } of enumValuesToAdd) {
    console.log(`📋 Processing ${enumType}`)

    for (const value of valuesToAdd) {
      const success = await addEnumValue(enumType, value)
      if (success) {
        console.log(`  ✓ Added ${value}`)
        totalAdded++
      } else {
        console.log(`  ✗ Failed to add ${value}`)
        totalFailed++
      }
    }
    console.log()
  }

  console.log('═══════════════════════════════════════════════════════════')
  console.log('✅ Summary:')
  console.log(`   - Values added: ${totalAdded}`)
  console.log(`   - Failed: ${totalFailed}`)
  console.log('\n📝 Next steps:')
  console.log('   1. Run conversion: npm run convert:enums')
  console.log('   2. Verify: npm run convert:enums -- --dry-run')
  console.log('═══════════════════════════════════════════════════════════\n')
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
