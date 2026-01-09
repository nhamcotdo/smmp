import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'
import { ACCOUNT_STATUS } from '@/lib/constants'

interface ChannelResponse {
  id: string
  platform: string
  username: string
  displayName?: string
  avatar?: string
  status: string
  health: string
  followersCount?: number
  followingCount?: number
  postsCount?: number
  lastSyncedAt?: string
  tokenExpiresAt?: string
  createdAt: string
}

/**
 * GET /api/channels
 * Get all connected social accounts for the authenticated user
 */
async function getChannels(_request: Request, user: any) {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: {
        userId: user.id,
        status: { not: ACCOUNT_STATUS.REVOKED },
      },
      orderBy: { createdAt: 'desc' },
    })

    const channels: ChannelResponse[] = accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      username: account.username,
      displayName: account.displayName ?? undefined,
      avatar: account.avatar ?? undefined,
      status: account.status,
      health: account.health,
      followersCount: account.followersCount,
      followingCount: account.followingCount,
      postsCount: account.postsCount,
      lastSyncedAt: account.lastSyncedAt?.toISOString(),
      tokenExpiresAt: account.tokenExpiresAt?.toISOString(),
      createdAt: account.createdAt.toISOString(),
    }))

    return NextResponse.json({
      data: channels,
      status: 200,
      success: true,
      message: 'Channels retrieved successfully',
    } as unknown as ApiResponse<ChannelResponse[]>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve channels',
      } as unknown as ApiResponse<ChannelResponse[]>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(getChannels)
