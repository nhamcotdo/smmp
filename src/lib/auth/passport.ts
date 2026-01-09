import { prisma } from '../db/connection'

export async function verifyJwtToken(token: string) {
  const { verifyToken } = await import('./jwt')
  const payload = verifyToken(token)

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

  if (!user || !user.isActive) {
    throw new Error('User not found or inactive')
  }

  return user
}
