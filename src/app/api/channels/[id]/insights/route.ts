import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import { PLATFORM } from '@/lib/constants'
import { getAccountInsights, extractAllMetrics } from '@/lib/services/threads.service'
import type { ApiResponse } from '@/lib/types'

interface AccountInsightsResponse {
  views: number
  likes: number
  shares: number
  replies: number
  quotes: number
  reposts: number
}

/**
 * GET /api/channels/:id/insights
 * Get account-level insights for a Threads channel
 */
async function getChannelInsights(
  request: Request,
  user: any,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id: channelId } = await context?.params ?? {}
    if (!channelId) {
      throw new Error('Channel ID is required')
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: channelId,
        userId: user.id,
        platform: PLATFORM.THREADS,
      },
    })

    if (!account || !account.accessToken) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Threads channel not found or access token missing',
        } as unknown as ApiResponse<AccountInsightsResponse>,
        { status: 404 }
      )
    }

    // Fetch insights from Threads API
    const insights = await getAccountInsights(
      account.accessToken,
      account.platformUserId,
      ['views', 'likes', 'shares', 'replies', 'quotes', 'reposts']
    )

    // Extract all metrics using shared utility
    const response: AccountInsightsResponse = extractAllMetrics(insights)

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Account insights retrieved successfully',
    } as unknown as ApiResponse<AccountInsightsResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch account insights',
      } as unknown as ApiResponse<AccountInsightsResponse>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(getChannelInsights)
