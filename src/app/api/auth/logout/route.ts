import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/lib/types'

/**
 * POST /api/auth/logout
 * Clear auth token and refresh token cookies
 */
export async function POST() {
  const response = NextResponse.json(
    {
      success: true,
      message: 'Logout successful',
      data: null,
    } as ApiResponse<null>,
    { status: 200 }
  )

  // Clear both cookies
  response.cookies.delete('auth_token')
  response.cookies.delete('refresh_token')

  return response
}
