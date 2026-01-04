import { NextRequest, NextResponse } from 'next/server'
import type { User } from '../../database/entities/User.entity'
import { verifyJwtToken } from './passport'
import type { ApiResponse } from '../types'

export interface AuthenticatedRequest extends Request {
  user?: User
}

/**
 * Authenticate request using httpOnly cookie
 */
export async function authenticateRequest(request: NextRequest): Promise<{ user: User }> {
  // Get token from cookie
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    throw new Error('Unauthorized: No token provided')
  }

  try {
    const user = await verifyJwtToken(token)
    return { user }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Unauthorized: ${error.message}`)
    }
    throw new Error('Unauthorized: Invalid token')
  }
}

export function withAuth<T>(
  handler: (request: NextRequest, user: User, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse<ApiResponse<T>>>,
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse<ApiResponse<T>>> => {
    try {
      const { user } = await authenticateRequest(request)
      return handler(request, user, context)
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message,
            data: null,
          } as ApiResponse<T>,
          { status: 401 },
        ) as NextResponse<ApiResponse<T>>
      }
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication failed',
          data: null,
        } as ApiResponse<T>,
        { status: 401 },
      ) as NextResponse<ApiResponse<T>>
    }
  }
}

export function withAuthAndRoles<T>(
  allowedRoles: string[],
  handler: (request: NextRequest, user: User) => Promise<NextResponse<ApiResponse<T>>>,
) {
  return async (request: NextRequest): Promise<NextResponse<ApiResponse<T>>> => {
    try {
      const { user } = await authenticateRequest(request)

      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Forbidden: Insufficient permissions',
            data: null,
          } as ApiResponse<T>,
          { status: 403 },
        ) as NextResponse<ApiResponse<T>>
      }

      return handler(request, user)
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          {
            success: false,
            message: error.message,
            data: null,
          } as ApiResponse<T>,
          { status: 401 },
        ) as NextResponse<ApiResponse<T>>
      }
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication failed',
          data: null,
        } as ApiResponse<T>,
        { status: 401 },
      ) as NextResponse<ApiResponse<T>>
    }
  }
}
