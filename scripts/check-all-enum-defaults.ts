/**
 * Check all columns with enum types and defaults
 */

import { prisma } from '../src/lib/db/connection'

async function checkAllEnumDefaults() {
  console.log('Checking ALL enum columns with defaults...\n')

  const result = await prisma.$queryRawUnsafe<Array<{
    table_name: string
    column_name: string
    column_default: string
    udt_name: string
  }>>(
    `SELECT c.table_name, c.column_name, c.column_default, c.udt_name
    FROM information_schema.columns c
    JOIN pg_type t ON t.typname = c.udt_name
    WHERE c.table_schema = 'public'
      AND t.typtype = 'e'
      AND c.column_default IS NOT NULL
    ORDER BY c.table_name, c.column_name`
  )

  if (result.length === 0) {
    console.log('✓ No enum columns with defaults found')
  } else {
    console.log('Found enum columns with defaults:')
    for (const row of result) {
      console.log(`  ${row.table_name}.${row.column_name} (${row.udt_name}):`)
      console.log(`    default: ${row.column_default}`)
    }
  }
}

checkAllEnumDefaults()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
