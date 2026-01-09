import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export function getPrismaClient(): PrismaClient {
  if (global.__prisma__) {
    return global.__prisma__
  }

  const prisma = createPrismaClient()
  global.__prisma__ = prisma
  return prisma
}

export async function closeConnection(): Promise<void> {
  if (global.__prisma__) {
    await global.__prisma__.$disconnect()
    global.__prisma__ = undefined
    console.log('Database connection closed')
  }
}

// Export a singleton instance
export const prisma = getPrismaClient()
