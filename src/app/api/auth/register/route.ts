import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db/connection'
import { registerSchema } from '../../../../lib/validators/auth.validator'
import { hashPassword, isPasswordStrong } from '../../../../lib/auth/password'
import { generateToken } from '../../../../lib/auth/jwt'
import { parseExpiresIn } from '../../../../lib/utils/jwt'
import type { ApiResponse } from '../../../../lib/types'
import type { AuthResponse } from '../../../../lib/types/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validationResult = registerSchema.safeParse(body)
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

    const { email, password, name, role } = validationResult.data

    if (!isPasswordStrong(password)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Password must contain uppercase, lowercase, and number',
          data: null,
        } as ApiResponse<null>,
        { status: 400 },
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email already registered',
          data: null,
        } as ApiResponse<null>,
        { status: 409 },
      )
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        isActive: true,
        emailVerified: false,
      },
    })

    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    // Parse JWT_EXPIRES_IN to get cookie maxAge
    const expiresIn = parseExpiresIn(process.env.JWT_EXPIRES_IN, 15 * 60 * 1000)

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
      token: '', // Token stored in httpOnly cookie, not exposed to client
      expiresIn,
    }

    const jsonResponse = NextResponse.json(
      {
        success: true,
        message: 'Registration successful',
        data: response,
      } as ApiResponse<AuthResponse>,
      { status: 201 },
    )

    // Set httpOnly cookie
    jsonResponse.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000, // Convert to seconds
      path: '/',
    })

    return jsonResponse
  } catch (error) {
    console.error('Registration error:', error)
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
