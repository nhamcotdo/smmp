/**
 * Run TypeORM Migrations on Production
 *
 * Usage:
 *   npm run db:migrate
 *
 * This script runs all pending migrations on the database.
 */

import { config } from 'dotenv'
config()

import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { createDatabaseConfig } from '@/lib/utils'

// Import migrations
import { IncreaseAvatarLength1704600000000 } from '../src/database/migrations/1704600000000-IncreaseAvatarLength'
import { AddSocialAccountIdToPosts1704600000001 } from '../src/database/migrations/1704600000001-AddSocialAccountIdToPosts'
import { AddPostParentRelation1704600000002 } from '../src/database/migrations/1704600000002-AddPostParentRelation'
import { RemoveUniqueConstraintUserPlatform1704600000003 } from '../src/database/migrations/1704600000003-RemoveUniqueConstraintUserPlatform'

async function runMigrations() {
  console.log('🚀 Starting database migrations...')
  console.log('DATABASE_HOST:', process.env.DATABASE_HOST ?? 'localhost')
  console.log('DATABASE_NAME:', process.env.DATABASE_NAME ?? 'smmp_db')

  const dataSource = new DataSource(
    createDatabaseConfig({
      migrations: [
        IncreaseAvatarLength1704600000000,
        AddSocialAccountIdToPosts1704600000001,
        AddPostParentRelation1704600000002,
        RemoveUniqueConstraintUserPlatform1704600000003,
      ],
      logging: true,
    })
  )

  try {
    console.log('📡 Connecting to database...')
    await dataSource.initialize()
    console.log('✅ Database connected successfully')

    console.log('🔄 Running migrations...')
    await dataSource.runMigrations()
    console.log('✅ Migrations completed successfully')

    await dataSource.destroy()
    console.log('✅ Database connection closed')

    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    await dataSource.destroy().catch(() => {})
    process.exit(1)
  }
}

runMigrations()
