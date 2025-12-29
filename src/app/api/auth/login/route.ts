import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '../../../../lib/db/connection'
import { User } from '../../../../database/entities/User.entity'
import { loginSchema } from '../../../../lib/validators/auth.validator'
import { verifyPassword } from '../../../../lib/auth/password'
import { generateToken } from '../../../../lib/auth/jwt'
import type { ApiResponse } from '../../../../lib/types'
import type { AuthResponse } from '../../../../lib/types/auth'

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

    const { email, password } = validationResult.data

    const dataSource = await getConnection()
    const userRepository = dataSource.getRepository(User)

    const user = await userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'name', 'role', 'isActive', 'emailVerified', 'avatar', 'createdAt', 'updatedAt'],
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

    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN?.replace(/\D/g, '') ?? '15', 10) * 60 * 1000

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
      token,
      expiresIn,
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        data: response,
      } as ApiResponse<AuthResponse>,
      { status: 200 },
    )
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
