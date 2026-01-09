/**
 * Remove lowercase enum values from database
 * This should be run after migrate-to-prisma.ts
 */

import { config } from 'dotenv'
config()

import { prisma } from '../src/lib/db/connection'

async function removeLowercaseEnums() {
  console.log('🔄 Removing lowercase enum values...')

  try {
    // For each enum type, we need to:
    // 1. Create a new enum type with only uppercase values
    // 2. Alter the column to use the new enum type
    // 3. Drop the old enum type

    // Helper function to recreate enum
    const recreateEnum = async (enumName: string, values: string[]) => {
      const tempEnumName = `${enumName}_new`

      // Check if the original enum exists
      const enumExists = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
        `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumName}') AS exists`
      )

      if (!enumExists[0]?.exists) {
        console.log(`    ${enumName} already migrated, skipping...`)
        return
      }

      // Drop temp enum if it exists from a previous failed run
      try {
        await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS ${tempEnumName} CASCADE`)
      } catch {
        // Ignore error if it doesn't exist
      }

      // Create new enum with only uppercase values
      await prisma.$executeRawUnsafe(`CREATE TYPE ${tempEnumName} AS ENUM (${values.map(v => `'${v}'`).join(', ')})`)

      // Get all tables and columns that use this enum
      const columnsResult = await prisma.$queryRawUnsafe<Array<{table_name: string, column_name: string, column_default: string | null}>>(
        `SELECT table_name, column_name, column_default FROM information_schema.columns WHERE data_type = 'USER-DEFINED' AND udt_schema = 'public' AND udt_name = '${enumName}'`
      )

      // For each column, alter to use the new enum
      for (const row of columnsResult) {
        // Drop default if exists
        if (row.column_default) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "${row.table_name}" ALTER COLUMN "${row.column_name}" DROP DEFAULT`
          )
        }

        // Change type
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${row.table_name}" ALTER COLUMN "${row.column_name}" TYPE ${tempEnumName} USING "${row.column_name}"::text::${tempEnumName}`
        )

        // Set default back to the uppercase value if it had one
        if (row.column_default) {
          // Extract default value from the raw default string (e.g., "'user'::users_role_enum" -> "USER")
          const defaultValueMatch = row.column_default.match(/'([^']+)'/)
          if (defaultValueMatch) {
            const defaultVal = defaultValueMatch[1].toUpperCase()
            // Only set default if the value is in the new enum
            if (values.includes(defaultVal)) {
              await prisma.$executeRawUnsafe(
                `ALTER TABLE "${row.table_name}" ALTER COLUMN "${row.column_name}" SET DEFAULT '${defaultVal}'::${tempEnumName}`
              )
            }
          }
        }
      }

      // Drop old enum
      await prisma.$executeRawUnsafe(`DROP TYPE ${enumName}`)

      // Rename new enum to original name
      await prisma.$executeRawUnsafe(`ALTER TYPE ${tempEnumName} RENAME TO ${enumName}`)

      console.log(`    Recreated ${enumName} with only uppercase values`)
    }

    // UserRole
    await recreateEnum('users_role_enum', ['ADMIN', 'USER', 'VIEWER'])

    // AccountStatus
    await recreateEnum('social_accounts_status_enum', ['ACTIVE', 'ERROR', 'EXPIRED', 'PENDING', 'REVOKED'])

    // PostStatus
    await recreateEnum('posts_status_enum', ['CANCELLED', 'DRAFT', 'FAILED', 'PUBLISHED', 'PUBLISHING', 'SCHEDULED'])

    // Platform
    await recreateEnum('social_accounts_platform_enum', ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'THREADS', 'TIKTOK', 'TWITTER'])

    // RefreshTokenStatus
    await recreateEnum('refresh_tokens_status_enum', ['ACTIVE', 'EXPIRED', 'REVOKED'])

    // UploadedMediaStatus
    await recreateEnum('uploaded_media_status_enum', ['ACTIVE', 'DELETED', 'EXPIRED'])

    // MediaType
    await recreateEnum('media_type_enum', ['AUDIO', 'DOCUMENT', 'GIF', 'IMAGE', 'VIDEO'])

    // PostPublicationStatus
    await recreateEnum('post_publications_status_enum', ['FAILED', 'PUBLISHED'])

    console.log('✅ Enum cleanup completed successfully!')
  } catch (error) {
    console.error('❌ Enum cleanup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

removeLowercaseEnums()
