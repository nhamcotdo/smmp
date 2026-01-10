/**
 * Check actual enum types in the database
 */

import { prisma } from '../src/lib/db/connection'

async function checkEnumTypes() {
  console.log('Checking enum types in database...\n')

  const result = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(
    "SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname"
  )

  console.log('Found enum types:')
  for (const row of result) {
    // Get enum values
    const values = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT enumlabel FROM pg_enum WHERE enumtypid = '${row.typname}'::regtype ORDER BY enumsortorder`
    )
    console.log(`\n${row.typname}:`)
    console.log(`  ${values.map((v) => v.enumlabel).join(', ')}`)
  }
}

checkEnumTypes()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
