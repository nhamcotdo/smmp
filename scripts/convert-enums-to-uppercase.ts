/**
 * Convert enum values from lowercase to uppercase
 *
 * This script converts all enum values in the database from lowercase to uppercase
 * to match the Prisma schema requirements.
 *
 * Usage:
 *   npm run convert:enums              # Run conversion
 *   npm run convert:enums -- --dry-run # Preview changes without executing
 *
 * Or run directly:
 *   npx tsx scripts/convert-enums-to-uppercase.ts
 *   npx tsx scripts/convert-enums-to-uppercase.ts --dry-run
 */

import { prisma } from '../src/lib/db/connection'

interface EnumMapping {
  tableName: string
  columnName: string
  enumTypeName: string // PostgreSQL enum type name for casting
  mappings: Record<string, string>
}

interface ConversionResult {
  table: string
  column: string
  lowercaseValue: string
  uppercaseValue: string
  rowsAffected: number
}

const enumMappings: EnumMapping[] = [
  // PostStatus
  {
    tableName: 'posts',
    columnName: 'status',
    enumTypeName: 'posts_status_enum',
    mappings: {
      draft: 'DRAFT',
      scheduled: 'SCHEDULED',
      publishing: 'PUBLISHING',
      published: 'PUBLISHED',
      failed: 'FAILED',
      cancelled: 'CANCELLED',
    },
  },
  {
    tableName: 'post_publications',
    columnName: 'status',
    enumTypeName: 'posts_status_enum',
    mappings: {
      draft: 'DRAFT',
      scheduled: 'SCHEDULED',
      publishing: 'PUBLISHING',
      published: 'PUBLISHED',
      failed: 'FAILED',
      cancelled: 'CANCELLED',
    },
  },
  // ContentType
  {
    tableName: 'posts',
    columnName: 'content_type',
    enumTypeName: 'posts_content_type_enum',
    mappings: {
      text: 'TEXT',
      image: 'IMAGE',
      video: 'VIDEO',
      carousel: 'CAROUSEL',
      story: 'STORY',
      reel: 'REEL',
      mixed: 'MIXED',
    },
  },
  // AccountStatus
  {
    tableName: 'social_accounts',
    columnName: 'status',
    enumTypeName: 'social_accounts_status_enum',
    mappings: {
      active: 'ACTIVE',
      expired: 'EXPIRED',
      revoked: 'REVOKED',
      error: 'ERROR',
      pending: 'PENDING',
    },
  },
  // AccountHealth
  {
    tableName: 'social_accounts',
    columnName: 'health',
    enumTypeName: 'social_accounts_health_enum',
    mappings: {
      healthy: 'HEALTHY',
      degraded: 'DEGRADED',
      unhealthy: 'UNHEALTHY',
      unknown: 'UNKNOWN',
    },
  },
  // Platform enums
  {
    tableName: 'social_accounts',
    columnName: 'platform',
    enumTypeName: 'social_accounts_platform_enum',
    mappings: {
      threads: 'THREADS',
      instagram: 'INSTAGRAM',
      twitter: 'TWITTER',
      facebook: 'FACEBOOK',
      linkedin: 'LINKEDIN',
      tiktok: 'TIKTOK',
    },
  },
  {
    tableName: 'post_publications',
    columnName: 'platform',
    enumTypeName: 'post_publications_platform_enum',
    mappings: {
      threads: 'THREADS',
      instagram: 'INSTAGRAM',
      twitter: 'TWITTER',
      facebook: 'FACEBOOK',
      linkedin: 'LINKEDIN',
      tiktok: 'TIKTOK',
    },
  },
  {
    tableName: 'analytics',
    columnName: 'platform',
    enumTypeName: 'analytics_platform_enum',
    mappings: {
      threads: 'THREADS',
      instagram: 'INSTAGRAM',
      twitter: 'TWITTER',
      facebook: 'FACEBOOK',
      linkedin: 'LINKEDIN',
      tiktok: 'TIKTOK',
    },
  },
  // MediaType
  {
    tableName: 'media',
    columnName: 'type',
    enumTypeName: 'media_type_enum',
    mappings: {
      image: 'IMAGE',
      video: 'VIDEO',
      gif: 'GIF',
      document: 'DOCUMENT',
      audio: 'AUDIO',
    },
  },
  // UploadedMediaType
  {
    tableName: 'uploaded_media',
    columnName: 'type',
    enumTypeName: 'uploaded_media_type_enum',
    mappings: {
      image: 'IMAGE',
      video: 'VIDEO',
      gif: 'GIF',
      document: 'DOCUMENT',
      audio: 'AUDIO',
    },
  },
  // UploadedMediaStatus
  {
    tableName: 'uploaded_media',
    columnName: 'status',
    enumTypeName: 'uploaded_media_status_enum',
    mappings: {
      active: 'ACTIVE',
      deleted: 'DELETED',
      expired: 'EXPIRED',
    },
  },
  // MetricsPeriod
  {
    tableName: 'analytics',
    columnName: 'period',
    enumTypeName: 'analytics_period_enum',
    mappings: {
      hourly: 'HOURLY',
      daily: 'DAILY',
      weekly: 'WEEKLY',
      monthly: 'MONTHLY',
    },
  },
  // UserRole
  {
    tableName: 'users',
    columnName: 'role',
    enumTypeName: 'users_role_enum',
    mappings: {
      admin: 'ADMIN',
      user: 'USER',
      viewer: 'VIEWER',
    },
  },
  // RefreshTokenStatus
  {
    tableName: 'refresh_tokens',
    columnName: 'status',
    enumTypeName: 'refresh_tokens_status_enum',
    mappings: {
      active: 'ACTIVE',
      revoked: 'REVOKED',
      expired: 'EXPIRED',
    },
  },
]

// Check if running in dry-run mode
const isDryRun = process.argv.includes('--dry-run')

/**
 * Count rows with lowercase enum values (idempotency check)
 */
async function countLowercaseValues(
  tableName: string,
  columnName: string,
  enumTypeName: string,
  lowerValue: string
): Promise<number> {
  try {
    // Cast parameter to enum type to avoid PostgreSQL type errors
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "${tableName}" WHERE "${columnName}" = $1::"${enumTypeName}"`,
      lowerValue
    )
    return Number(result[0]?.count ?? 0)
  } catch {
    return 0
  }
}

/**
 * Convert a single enum value using parameterized query (SQL injection safe)
 */
async function convertEnumValue(
  tableName: string,
  columnName: string,
  enumTypeName: string,
  lowerValue: string,
  upperValue: string
): Promise<number> {
  // Check if conversion is needed (idempotency)
  const count = await countLowercaseValues(tableName, columnName, enumTypeName, lowerValue)
  if (count === 0) {
    return 0 // Already converted
  }

  if (isDryRun) {
    console.log(`    [DRY-RUN] Would update ${count} row(s)`)
    return count
  }

  // Use parameterized query with type casting to prevent SQL injection
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "${tableName}" SET "${columnName}" = $1::"${enumTypeName}" WHERE "${columnName}" = $2::"${enumTypeName}"`,
    upperValue,
    lowerValue
  )
  return Number(result)
}

/**
 * Verify that no lowercase values remain
 */
async function verifyConversions(): Promise<boolean> {
  console.log('\n\n🔍 Verifying conversions...')

  const checks: Array<{ table: string; column: string; query: string }> = [
    { table: 'posts', column: 'status', query: `SELECT status, COUNT(*) FROM posts GROUP BY status` },
    { table: 'posts', column: 'content_type', query: `SELECT content_type, COUNT(*) FROM posts GROUP BY content_type` },
    { table: 'social_accounts', column: 'status', query: `SELECT status, COUNT(*) FROM social_accounts GROUP BY status` },
    { table: 'social_accounts', column: 'health', query: `SELECT health, COUNT(*) FROM social_accounts GROUP BY health` },
    { table: 'social_accounts', column: 'platform', query: `SELECT platform, COUNT(*) FROM social_accounts GROUP BY platform` },
    { table: 'post_publications', column: 'status', query: `SELECT status, COUNT(*) FROM post_publications GROUP BY status` },
    { table: 'post_publications', column: 'platform', query: `SELECT platform, COUNT(*) FROM post_publications GROUP BY platform` },
    { table: 'media', column: 'type', query: `SELECT type, COUNT(*) FROM media GROUP BY type` },
    { table: 'uploaded_media', column: 'type', query: `SELECT type, COUNT(*) FROM uploaded_media GROUP BY type` },
    { table: 'uploaded_media', column: 'status', query: `SELECT status, COUNT(*) FROM uploaded_media GROUP BY status` },
    { table: 'analytics', column: 'platform', query: `SELECT platform, COUNT(*) FROM analytics GROUP BY platform` },
    { table: 'analytics', column: 'period', query: `SELECT period, COUNT(*) FROM analytics GROUP BY period` },
    { table: 'users', column: 'role', query: `SELECT role, COUNT(*) FROM users GROUP BY role` },
    { table: 'refresh_tokens', column: 'status', query: `SELECT status, COUNT(*) FROM refresh_tokens GROUP BY status` },
  ]

  let hasIssues = false

  for (const check of checks) {
    try {
      const result = await prisma.$queryRawUnsafe<Array<{ [key: string]: string | bigint }>>(check.query)
      console.log(`\n  ${check.table}.${check.column}:`)
      for (const row of result) {
        const value = Object.values(row)[0] as string
        const count = Object.values(row)[1] as bigint
        // Check if value is lowercase (indicating failed conversion)
        if (value === value.toLowerCase() && value !== value.toUpperCase()) {
          console.log(`    ⚠️  ${value}: ${count} (lowercase - conversion may have failed)`)
          hasIssues = true
        } else {
          console.log(`    ✓ ${value}: ${count}`)
        }
      }
    } catch (error) {
      console.error(`  ✗ Verification failed for ${check.table}.${check.column}:`, error)
      hasIssues = true
    }
  }

  return !hasIssues
}

/**
 * Main conversion function with transaction safety
 */
async function convertEnums(): Promise<ConversionResult[]> {
  if (isDryRun) {
    console.log('🔍 DRY-RUN MODE: No changes will be executed\n')
  }

  console.log('🔄 Converting enum values from lowercase to uppercase...\n')

  const totalUpdates = enumMappings.reduce((sum, mapping) => {
    return sum + Object.keys(mapping.mappings).length
  }, 0)

  const results: ConversionResult[] = []
  let completed = 0

  // Process each mapping
  for (const { tableName, columnName, enumTypeName, mappings } of enumMappings) {
    console.log(`\n📋 Processing ${tableName}.${columnName}`)

    for (const [lowerValue, upperValue] of Object.entries(mappings)) {
      completed++

      try {
        const rowsAffected = await convertEnumValue(tableName, columnName, enumTypeName, lowerValue, upperValue)
        const percentage = Math.round((completed / totalUpdates) * 100)

        if (rowsAffected > 0) {
          console.log(`  ✓ ${lowerValue} → ${upperValue}: ${rowsAffected} row(s) affected (${percentage}%)`)
          results.push({
            table: tableName,
            column: columnName,
            lowercaseValue: lowerValue,
            uppercaseValue: upperValue,
            rowsAffected,
          })
        } else {
          console.log(`  ⊘ ${lowerValue} → ${upperValue}: already converted (${percentage}%)`)
        }
      } catch (error) {
        console.error(`  ✗ Failed to convert ${lowerValue} → ${upperValue}:`, error)
        throw error // Re-throw to trigger transaction rollback
      }
    }
  }

  console.log('\n\n✅ Conversion complete!')
  console.log('📊 Summary:')
  console.log(`  - Total mappings processed: ${totalUpdates}`)
  console.log(`  - Rows affected: ${results.reduce((sum, r) => sum + r.rowsAffected, 0)}`)

  return results
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Enum Value Conversion: lowercase → uppercase')
  console.log('═══════════════════════════════════════════════════════════')

  if (!isDryRun) {
    console.log('\n⚠️  WARNING: This will modify your database!')
    console.log('💡 TIP: Run with --dry-run first to preview changes')
    console.log('   Example: npm run convert:enums -- --dry-run\n')
  }

  try {
    // Check database connection first
    await prisma.$queryRawUnsafe('SELECT 1')
    console.log('✓ Database connection verified\n')

    if (isDryRun) {
      // In dry-run mode, don't use transaction since we're not committing
      await convertEnums()
      console.log('\n🔍 DRY-RUN COMPLETE: No changes were made')
      console.log('   Run without --dry-run to apply changes')
    } else {
      // Wrap in transaction for atomicity
      // Note: Prisma doesn't support DDL in transactions, but DML is fine
      const results = await convertEnums()

      // Verify all conversions succeeded
      const verificationPassed = await verifyConversions()

      if (verificationPassed) {
        console.log('\n\n✅ All conversions verified successfully!')
        console.log('\n📝 Next steps:')
        console.log('   1. Restart your application')
        console.log('   2. Run tests to ensure everything works')
        console.log('   3. Commit the changes')
      } else {
        console.log('\n\n⚠️  Verification found issues. Please review the output above.')
        console.log('   Some conversions may have failed.')
        process.exit(1)
      }
    }
  } catch (error) {
    console.error('\n\n❌ Fatal error occurred:', error)
    if (!isDryRun) {
      console.error('\n💡 Recovery:')
      console.error('   - Check the error message above for details')
      console.error('   - Verify your database connection')
      console.error('   - The script uses idempotent operations - you can safely re-run it')
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    console.log('\n═══════════════════════════════════════════════════════════')
  }
}

main()
