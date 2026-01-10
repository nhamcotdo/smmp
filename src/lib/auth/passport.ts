import { prisma } from '../db/connection'

export async function verifyJwtToken(token: string) {
  const { verifyToken } = await import('./jwt')

  // Verify JWT signature and expiry first
  const payload = verifyToken(token)

  // Query database for user with the ID from token
  const user = await prisma.user.findUnique({
    where: { id: payload.sub, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      emailVerified: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (!user.isActive) {
    throw new Error('User account is inactive')
  }

  return user
}
