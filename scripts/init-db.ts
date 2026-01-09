/**
 * Database Initialization Script for Production
 *
 * Usage:
 *   npm run db:init
 *
 * This script pushes the Prisma schema to the database.
 * Run this ONCE on production to create all tables.
 */

// Load environment variables
import { config } from 'dotenv'
config()

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function initDatabase() {
  console.log('🚀 Starting database initialization...')
  console.log('DATABASE_HOST:', process.env.DATABASE_HOST ?? 'localhost')
  console.log('DATABASE_NAME:', process.env.DATABASE_NAME ?? 'smmp_db')
  console.log('NODE_ENV:', process.env.NODE_ENV ?? 'development')

  try {
    // Test connection first
    console.log('📡 Connecting to database...')
    await prisma.$connect()
    console.log('✅ Database connected successfully')

    // List all tables to verify schema
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `
    console.log('📊 Available tables:', tables.map((t) => t.tablename).join(', '))

    // Close connection
    await prisma.$disconnect()
    console.log('✅ Database connection closed')
    console.log('\n🎉 Database initialization completed successfully!')
    console.log('\n💡 Note: If tables are missing, run: npx prisma db push')

    process.exit(0)
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)

    if (error instanceof Error) {
      console.error('\nError details:')
      console.error('Message:', error.message)
      console.error('Stack:', error.stack)
    }

    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

// Run initialization
initDatabase()
