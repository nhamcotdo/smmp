/**
 * Create a new database migration
 *
 * Usage:
 *   npm run db:migrate:create --name describe_your_change
 *
 * Or run directly:
 *   npx tsx scripts/create-migration.ts --name add_user_preferences
 *
 * The script will:
 * 1. Create a migration directory with timestamp
 * 2. Generate migration.sql from schema changes
 * 3. Open the file for review/editing
 * 4. Mark as ready to apply
 */

import { execSync } from 'child_process'
import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'

function getArgs() {
  const args = process.argv.slice(2)
  const nameIndex = args.indexOf('--name')
  if (nameIndex === -1 || nameIndex === args.length - 1) {
    console.error('❌ Error: --name argument is required')
    console.error('\nUsage: npx tsx scripts/create-migration.ts --name describe_your_change')
    console.error('\nExample: npx tsx scripts/create-migration.ts --name add_user_preferences_column')
    process.exit(1)
  }
  return args[nameIndex + 1]
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function createMigrationDir(name: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const sanitizedName = sanitizeName(name)
  const dirName = `${date}_${sanitizedName}`
  const dirPath = join(process.cwd(), 'prisma', 'migrations', dirName)

  if (existsSync(dirPath)) {
    console.error(`❌ Error: Migration directory "${dirName}" already exists`)
    console.error('\nUse a different name or remove the existing directory.')
    process.exit(1)
  }

  execSync(`mkdir -p "${dirPath}"`, { stdio: 'inherit' })
  console.log(`✓ Created migration directory: prisma/migrations/${dirName}`)

  return dirPath
}

function generateMigrationSQL(dirPath: string, name: string): void {
  const sqlPath = join(dirPath, 'migration.sql')

  // Create migration template with comments
  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
--
-- Description: Add your migration description here
--
-- Rollback: Document how to rollback this migration
--
-- Example:
--   -- Add column
--   ALTER TABLE users ADD COLUMN "theme" VARCHAR(50) DEFAULT 'light';
--
--   -- Create index
--   CREATE INDEX idx_users_theme ON users("theme");
--
--   -- Add enum value
--   ALTER TYPE "posts_status_enum" ADD VALUE IF NOT EXISTS 'ARCHIVED';
--

-- Write your migration SQL below this line

`

  writeFileSync(sqlPath, template, 'utf-8')
  console.log(`✓ Created migration.sql file`)
  console.log(`\n📝 File location: ${sqlPath}`)
}

function showNextSteps(name: string, dirPath: string): void {
  console.log('\n' + '='.repeat(60))
  console.log('Next steps:')
  console.log('='.repeat(60))
  console.log('\n1. Edit the migration file:')
  console.log(`   ${join('prisma/migrations', dirPath.split('/').pop()!, 'migration.sql')}`)
  console.log('\n2. Review your changes:')
  console.log('   cat prisma/migrations/*/migration.sql | less')
  console.log('\n3. Apply to local database:')
  console.log('   npm run db:migrate:dev')
  console.log('\n4. Or mark as applied if manually tested:')
  console.log(`   npx prisma migrate resolve --applied ${dirPath.split('/').pop()}`)
  console.log('\n5. Commit the migration:')
  console.log(`   git add prisma/migrations && git commit -m "feat: ${name}"`)
  console.log('\n' + '='.repeat(60))
}

function main() {
  console.log('📦 Creating new database migration...\n')

  const name = getArgs()
  const dirPath = createMigrationDir(name)
  generateMigrationSQL(dirPath, name)
  showNextSteps(name, dirPath)
}

main()
