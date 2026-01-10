/**
 * Check columns with enum default values
 */

import { prisma } from '../src/lib/db/connection'

async function checkEnumDefaults() {
  console.log('Checking enum default values...\n')

  const result = await prisma.$queryRawUnsafe<Array<{
    table_name: string
    column_name: string
    column_default: string
  }>>(
    `SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default IS NOT NULL
      AND (
        column_default LIKE '%draft%'
        OR column_default LIKE '%active%'
        OR column_default LIKE '%scheduled%'
        OR column_default LIKE '%pending%'
        OR column_default LIKE '%unknown%'
      )
    ORDER BY table_name, column_name`
  )

  if (result.length === 0) {
    console.log('✓ No lowercase enum defaults found')
  } else {
    console.log('Found lowercase enum defaults:')
    for (const row of result) {
      console.log(`  ${row.table_name}.${row.column_name}: ${row.column_default}`)
    }
  }
}

checkEnumDefaults()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
