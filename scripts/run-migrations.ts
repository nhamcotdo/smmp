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
import { DataSource, DataSourceOptions } from 'typeorm'

// Import migrations
import { IncreaseAvatarLength1704600000000 } from '../src/database/migrations/1704600000000-IncreaseAvatarLength'

async function runMigrations() {
  console.log('🚀 Starting database migrations...')
  console.log('DATABASE_HOST:', process.env.DATABASE_HOST ?? 'localhost')
  console.log('DATABASE_NAME:', process.env.DATABASE_NAME ?? 'smmp_db')

  const options: DataSourceOptions = {
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
    migrations: [
      IncreaseAvatarLength1704600000000
    ],
    logging: true,
  }

  const dataSource = new DataSource(options)

  if (process.env.DATABASE_URL) {
    dataSource.setOptions({ url: process.env.DATABASE_URL })
  }

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
