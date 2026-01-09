import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { Platform, AccountStatus } from '@/database/entities/enums'
import { Not } from 'typeorm'
import type { ApiResponse } from '@/lib/types'

interface ChannelResponse {
  id: string
  platform: Platform
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
async function getChannels(_request: Request, user: User) {
  try {
    const dataSource = await getConnection()
    const socialAccountRepository = dataSource.getRepository(SocialAccount)

    const accounts = await socialAccountRepository.find({
      where: {
        userId: user.id,
        status: Not(AccountStatus.REVOKED),
      },
      order: { createdAt: 'DESC' },
    })

    const channels: ChannelResponse[] = accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      username: account.username,
      displayName: account.displayName,
      avatar: account.avatar,
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
