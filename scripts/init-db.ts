/**
 * Database Initialization Script for Production
 *
 * Usage:
 *   npm run db:init
 *
 * This script synchronizes the database schema using TypeORM.
 * Run this ONCE on production to create all tables.
 */

// CRITICAL: reflect-metadata must be imported FIRST, before any TypeORM entities
import 'reflect-metadata'

// Load environment variables
import { config } from 'dotenv'
config()

import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { createDatabaseConfig } from '@/lib/utils'

/**
 * Dynamically import entities to avoid circular dependency issues.
 * This matches the pattern used in connection.ts
 */
async function loadEntities() {
  const [
    { User },
    { SocialAccount },
    { RefreshToken },
    { Post },
    { PostPublication },
    { Media },
    { Analytics },
    { UploadedMedia },
  ] = await Promise.all([
    import('../src/database/entities/User.entity'),
    import('../src/database/entities/SocialAccount.entity'),
    import('../src/database/entities/RefreshToken.entity'),
    import('../src/database/entities/Post.entity'),
    import('../src/database/entities/PostPublication.entity'),
    import('../src/database/entities/Media.entity'),
    import('../src/database/entities/Analytics.entity'),
    import('../src/database/entities/UploadedMedia.entity'),
  ])

  return [User, SocialAccount, RefreshToken, Post, PostPublication, Media, Analytics, UploadedMedia]
}

async function initDatabase() {
  console.log('🚀 Starting database initialization...')
  console.log('DATABASE_HOST:', process.env.DATABASE_HOST ?? 'localhost')
  console.log('DATABASE_NAME:', process.env.DATABASE_NAME ?? 'smmp_db')
  console.log('NODE_ENV:', process.env.NODE_ENV ?? 'development')

  // Load entities dynamically to avoid circular dependencies
  const entities = await loadEntities()

  // Create data source with synchronize enabled for init
  const dataSource = new DataSource(
    createDatabaseConfig({
      entities,
      synchronize: true, // Enable sync for init only
      logging: true,
    })
  )

  try {
    // Test connection first
    console.log('📡 Connecting to database...')
    await dataSource.initialize()
    console.log('✅ Database connected successfully')

    // Synchronize schema
    console.log('🔄 Synchronizing schema...')
    await dataSource.synchronize()
    console.log('✅ Schema synchronized successfully')

    // List all tables
    const tables = await dataSource.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `)
    console.log('📊 Created tables:', tables.map((t: { tablename: string }) => t.tablename).join(', '))

    // Close connection
    await dataSource.destroy()
    console.log('✅ Database connection closed')
    console.log('\n🎉 Database initialization completed successfully!')

    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)

    if (error instanceof Error) {
      console.error('\nError details:')
      console.error('Message:', error.message)
      console.error('Stack:', error.stack)
    }

    await dataSource.destroy().catch(() => {})
    process.exit(1)
  }
}

// Run initialization
initDatabase()
