import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'
import type { UserResponse } from '@/lib/types/auth'
import type { User } from '@prisma/client'

async function getMeHandler(request: Request, user: User) {
  const response: UserResponse = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    avatar: user.avatar ?? undefined,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }

  return NextResponse.json(
    {
      success: true,
      message: 'User retrieved successfully',
      data: response,
    } as ApiResponse<UserResponse>,
    { status: 200 },
  )
}

export const GET = withAuth(getMeHandler)
