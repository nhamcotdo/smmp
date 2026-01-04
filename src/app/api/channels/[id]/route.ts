import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { AccountStatus } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'

/**
 * DELETE /api/channels/:id
 * Disconnect (soft delete) a social account
 */
async function disconnectChannel(request: Request, user: User) {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const channelId = pathParts[pathParts.length - 1]

    const dataSource = await getConnection()
    const socialAccountRepository = dataSource.getRepository(SocialAccount)

    const account = await socialAccountRepository.findOne({
      where: {
        id: channelId,
        userId: user.id,
      },
    })

    if (!account) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Channel not found',
        } as unknown as ApiResponse<{ id: string }>,
        { status: 404 }
      )
    }

    // Soft delete by marking as revoked
    await socialAccountRepository.update(account.id, {
      status: AccountStatus.REVOKED,
    })

    return NextResponse.json({
      data: { id: account.id },
      status: 200,
      success: true,
      message: 'Channel disconnected successfully',
    } as unknown as ApiResponse<{ id: string }>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disconnect channel',
      } as unknown as ApiResponse<{ id: string }>,
      { status: 500 }
    )
  }
}

/**
 * POST /api/channels/:id/refresh
 * Refresh access token for a social account
 */
async function refreshToken(request: Request, user: User) {
  try {
    // Extract id from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const channelId = pathParts[pathParts.length - 1]

    const dataSource = await getConnection()
    const socialAccountRepository = dataSource.getRepository(SocialAccount)

    const account = await socialAccountRepository.findOne({
      where: {
        id: channelId,
        userId: user.id,
      },
    })

    if (!account) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Channel not found',
        } as unknown as ApiResponse<{ tokenExpiresAt: string }>,
        { status: 404 }
      )
    }

    // Import the refresh function based on platform
    const { refreshAccessToken } = await import('@/lib/services/threads.service')

    try {
      const newToken = await refreshAccessToken(account.refreshToken)

      const tokenExpiresAt = new Date(Date.now() + newToken.expires_in * 1000)

      // CRITICAL: Threads uses the same access_token value as refresh_token
      await socialAccountRepository.update(account.id, {
        accessToken: newToken.access_token,
        refreshToken: newToken.access_token,
        tokenExpiresAt,
      })

      return NextResponse.json({
        data: {
          tokenExpiresAt: tokenExpiresAt.toISOString(),
        },
        status: 200,
        success: true,
        message: 'Token refreshed successfully',
      } as unknown as ApiResponse<{ tokenExpiresAt: string }>)
    } catch (refreshError) {
      // Mark account as expired if refresh fails
      await socialAccountRepository.update(account.id, {
        status: AccountStatus.EXPIRED,
      })

      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Failed to refresh token. Please reconnect your account.',
        } as unknown as ApiResponse<{ tokenExpiresAt: string }>,
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to refresh token',
      } as unknown as ApiResponse<{ tokenExpiresAt: string }>,
      { status: 500 }
    )
  }
}

export const DELETE = withAuth(disconnectChannel)
export const POST = withAuth(refreshToken)
