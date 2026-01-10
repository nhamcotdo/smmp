import type { UserRole } from '@prisma/client'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  avatar: string | null
  isActive: boolean
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}
