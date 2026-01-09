/**
 * Run Prisma Migrations on Production
 *
 * Usage:
 *   npm run db:migrate
 *
 * This script runs all pending Prisma migrations on the database.
 *
 * For development, use: npx prisma migrate dev
 * For production, use: npx prisma migrate deploy
 */

import { execSync } from 'child_process'
import { config } from 'dotenv'
config()

async function runMigrations() {
  console.log('🚀 Starting database migrations...')
  console.log('DATABASE_HOST:', process.env.DATABASE_HOST ?? 'localhost')
  console.log('DATABASE_NAME:', process.env.DATABASE_NAME ?? 'smmp_db')

  try {
    console.log('📡 Running Prisma migrations...')
    console.log('\nExecuting: npx prisma migrate deploy')

    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: process.env,
    })

    console.log('\n✅ Migrations completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    console.error('\n💡 Hint: If this is a fresh database, run: npx prisma db push')
    process.exit(1)
  }
}

runMigrations()
