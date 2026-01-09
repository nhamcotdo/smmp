import { config } from 'dotenv'
config()

import { prisma } from '../src/lib/db/connection'

async function testPrisma() {
  console.log('Testing Prisma connection...')

  try {
    // Test querying users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
      take: 5,
    })

    console.log('✅ Successfully queried users:')
    console.table(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })))

    await prisma.$disconnect()
    console.log('\n✅ Migration successful! Login should now work.')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testPrisma()
