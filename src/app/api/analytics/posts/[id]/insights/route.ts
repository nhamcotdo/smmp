import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import { getThreadsPostInsights } from '@/lib/services/threads.service'
import { PLATFORM, METRICS_PERIOD } from '@/lib/constants'
import type { ApiResponse } from '@/lib/types'
import type { PostInsights } from '@/lib/types/analytics'

/**
 * GET /api/analytics/posts/:id/insights
 * Fetch insights for a specific post publication on-demand
 */
async function getPostInsights(
  request: NextRequest,
  user: any,
  context?: { params: Promise<Record<string, string>> },
): Promise<NextResponse<ApiResponse<PostInsights | null>>> {
  try {
    const params = await context?.params
    const id = params?.id

    if (!id) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Publication ID is required',
        } satisfies ApiResponse<null>,
        { status: 400 }
      )
    }

    // First, find the publication and verify ownership
    const publication = await prisma.postPublication.findFirst({
      where: { id },
      include: {
        post: true,
        socialAccount: true,
      },
    })

    if (!publication || !publication.post) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Publication not found',
        } satisfies ApiResponse<null>,
        { status: 404 }
      )
    }

    // Verify user owns the post
    if (publication.post.userId !== user.id) {
      return NextResponse.json(
        {
          data: null,
          status: 403,
          success: false,
          message: 'You do not have permission to access this publication',
        } satisfies ApiResponse<null>,
        { status: 403 }
      )
    }

    if (!publication.socialAccount || !publication.socialAccount.accessToken) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Social account not found for this publication',
        } satisfies ApiResponse<null>,
        { status: 404 }
      )
    }

    if (publication.platform !== PLATFORM.THREADS) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Insights are only available for Threads posts',
        } satisfies ApiResponse<null>,
        { status: 400 }
      )
    }

    if (!publication.platformPostId) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Platform post ID not found for this publication',
        } satisfies ApiResponse<null>,
        { status: 400 }
      )
    }

    // Fetch insights from Threads API
    const metrics = await getThreadsPostInsights(
      publication.socialAccount.accessToken,
      publication.platformPostId
    )

    // Persist insights to database for future use
    const existingAnalytics = await prisma.analytics.findFirst({
      where: { postPublicationId: publication.id },
    })

    const analyticsData = {
      impressionsCount: metrics.views,
      likesCount: metrics.likes,
      commentsCount: metrics.replies,
      sharesCount: metrics.shares,
      reachCount: metrics.views,
      recordedAt: new Date(),
      rawData: {
        views: metrics.views,
        likes: metrics.likes,
        shares: metrics.shares,
        replies: metrics.replies,
        quotes: metrics.quotes,
        reposts: metrics.reposts,
      },
    }

    if (existingAnalytics) {
      // Update existing analytics record
      await prisma.analytics.update({
        where: { id: existingAnalytics.id },
        data: analyticsData,
      })
    } else {
      // Create new analytics record
      await prisma.analytics.create({
        data: {
          postPublicationId: publication.id,
          platform: publication.platform,
          period: METRICS_PERIOD.DAILY,
          ...analyticsData,
        },
      })
    }

    return NextResponse.json({
      data: metrics,
      status: 200,
      success: true,
      message: 'Insights retrieved successfully',
    } satisfies ApiResponse<PostInsights>)
  } catch (error) {
    console.error('Failed to retrieve insights:', {
      error: error instanceof Error ? error.message : String(error),
      userId: user.id,
      publicationId: (await context?.params)?.id,
    })

    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve insights. Please try again later.',
      } satisfies ApiResponse<null>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(getPostInsights)
