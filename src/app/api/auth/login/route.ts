import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { loginSchema } from '@/lib/validators/auth.validator'
import { verifyPassword } from '@/lib/auth/password'
import { generateToken } from '@/lib/auth/jwt'
import { randomBytes } from 'crypto'
import type { ApiResponse } from '@/lib/types'
import type { AuthResponse } from '@/lib/types/auth'
import { parseExpiresIn } from '@/lib/utils/jwt'
import { REFRESH_TOKEN_STATUS } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validationResult = loginSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: validationResult.error.issues[0]?.message ?? 'Validation failed',
          data: null,
        } as ApiResponse<null>,
        { status: 400 },
      )
    }

    const { email, password, rememberMe = false } = validationResult.data

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
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
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid credentials',
          data: null,
        } as ApiResponse<null>,
        { status: 401 },
      )
    }

    const isPasswordValid = await verifyPassword(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid credentials',
          data: null,
        } as ApiResponse<null>,
        { status: 401 },
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: 'Account is inactive',
          data: null,
        } as ApiResponse<null>,
        { status: 403 },
      )
    }

    // Generate access token (short-lived)
    const accessToken = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    // Calculate expiry times
    const accessExpiresIn = parseExpiresIn(process.env.JWT_EXPIRES_IN ?? '15m')
    const refreshExpiresIn = parseExpiresIn(
      rememberMe
        ? (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d')
        : '1d' // Shorter expiry if not remember me
    )

    // Generate refresh token (random string for database lookup)
    const refreshTokenValue = randomBytes(32).toString('hex')
    const refreshTokenExpiresAt = new Date(Date.now() + refreshExpiresIn)

    // Store refresh token in database
    const refreshTokenEntity = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: refreshTokenExpiresAt,
        status: REFRESH_TOKEN_STATUS.ACTIVE,
        isRememberMe: rememberMe,
      },
    })

    // Revoke old refresh tokens for this user (if not remember me, keep only one)
    if (!rememberMe) {
      await prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          id: { not: refreshTokenEntity.id },
        },
        data: { status: REFRESH_TOKEN_STATUS.REVOKED },
      })
    }

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        avatar: user.avatar ?? undefined,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      token: '', // Token stored in httpOnly cookie
      expiresIn: accessExpiresIn,
    }

    const jsonResponse = NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        data: response,
      } as ApiResponse<AuthResponse>,
      { status: 200 },
    )

    // Set access token cookie (short-lived)
    jsonResponse.cookies.set('auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessExpiresIn / 1000,
      path: '/',
    })

    // Set refresh token cookie (longer-lived)
    jsonResponse.cookies.set('refresh_token', refreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshExpiresIn / 1000,
      path: '/',
    })

    return jsonResponse
  } catch (error) {
    console.error('Login error:', error)
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
