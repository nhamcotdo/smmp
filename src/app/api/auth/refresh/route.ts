import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { generateToken } from '@/lib/auth/jwt'
import { parseExpiresIn } from '@/lib/utils/jwt'
import type { ApiResponse } from '@/lib/types'
import { REFRESH_TOKEN_STATUS } from '@/lib/constants'

/**
 * POST /api/auth/refresh
 * Exchange refresh token for new access token
 */
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          message: 'No refresh token provided',
          data: null,
        } as ApiResponse<null>,
        { status: 401 },
      )
    }

    // Find refresh token in database
    const refreshTokenEntity = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    })

    if (!refreshTokenEntity) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid refresh token',
          data: null,
        } as ApiResponse<null>,
        { status: 401 },
      )
    }

    // Check if refresh token is expired
    if (refreshTokenEntity.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: refreshTokenEntity.id },
        data: { status: REFRESH_TOKEN_STATUS.EXPIRED },
      })
      return NextResponse.json(
        {
          success: false,
          message: 'Refresh token expired',
          data: null,
        } as ApiResponse<null>,
        { status: 401 },
      )
    }

    // Check if refresh token is revoked
    if (refreshTokenEntity.status !== REFRESH_TOKEN_STATUS.ACTIVE) {
      return NextResponse.json(
        {
          success: false,
          message: 'Refresh token revoked',
          data: null,
        } as ApiResponse<null>,
        { status: 401 },
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: refreshTokenEntity.userId },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: 'User not found or inactive',
          data: null,
        } as ApiResponse<null>,
        { status: 401 },
      )
    }

    // Generate new access token
    const newAccessToken = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    // Calculate access token expiry
    const accessExpiresIn = parseExpiresIn(process.env.JWT_EXPIRES_IN, 15 * 60 * 1000)

    const response = NextResponse.json(
      {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          expiresIn: accessExpiresIn,
        },
      } as ApiResponse<{ expiresIn: number }>,
      { status: 200 },
    )

    // Set new access token cookie
    response.cookies.set('auth_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessExpiresIn / 1000,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        data: null,
      } as ApiResponse<null>,
      { status: 500 },
    )
  }
}
