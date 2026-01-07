/**
 * Database Initialization Script for Production
 *
 * Usage:
 *   npm run db:init
 *
 * This script synchronizes the database schema using TypeORM.
 * Run this ONCE on production to create all tables.
 */

// Load environment variables first
import { config } from 'dotenv'
config()

import 'reflect-metadata'
import { DataSource } from 'typeorm'

// Import entities
import { User } from '../src/database/entities/User.entity'
import { SocialAccount } from '../src/database/entities/SocialAccount.entity'
import { RefreshToken } from '../src/database/entities/RefreshToken.entity'
import { Post } from '../src/database/entities/Post.entity'
import { PostPublication } from '../src/database/entities/PostPublication.entity'
import { Media } from '../src/database/entities/Media.entity'
import { Analytics } from '../src/database/entities/Analytics.entity'
import { UploadedMedia } from '../src/database/entities/UploadedMedia.entity'

async function initDatabase() {
  console.log('🚀 Starting database initialization...')
  console.log('DATABASE_HOST:', process.env.DATABASE_HOST ?? 'localhost')
  console.log('DATABASE_NAME:', process.env.DATABASE_NAME ?? 'smmp_db')
  console.log('NODE_ENV:', process.env.NODE_ENV ?? 'development')

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'smmp_db',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    extra: {
      max: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
      min: parseInt(process.env.DATABASE_POOL_MIN ?? '2', 10),
    },
    entities: [
      User,
      SocialAccount,
      RefreshToken,
      Post,
      PostPublication,
      Media,
      Analytics,
      UploadedMedia,
    ],
    synchronize: true, // Enable sync for init only
    logging: true,
  } as any)

  if (process.env.DATABASE_URL) {
    dataSource.setOptions({ url: process.env.DATABASE_URL } as any)
  }

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
    console.log('📊 Created tables:', tables.map((t: any) => t.tablename).join(', '))

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
