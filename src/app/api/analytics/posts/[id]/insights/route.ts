import { NextResponse, NextRequest } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { User } from '@/database/entities/User.entity'
import { Analytics } from '@/database/entities/Analytics.entity'
import { withAuth } from '@/lib/auth/middleware'
import { getThreadsPostInsights } from '@/lib/services/threads.service'
import { Platform, MetricsPeriod } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import type { PostInsights } from '@/lib/types/analytics'

/**
 * GET /api/analytics/posts/:id/insights
 * Fetch insights for a specific post publication on-demand
 */
async function getPostInsights(
  request: NextRequest,
  user: User,
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

    const dataSource = await getConnection()
    const postPublicationRepository = dataSource.getRepository(PostPublication)
    const analyticsRepository = dataSource.getRepository(Analytics)

    // Use INNER JOIN to ensure post exists and belongs to user (security)
    const publication = await postPublicationRepository
      .createQueryBuilder('publication')
      .innerJoin('publication.post', 'post')
      .leftJoinAndSelect('publication.socialAccount', 'socialAccount')
      .where('publication.id = :id', { id })
      .andWhere('post.userId = :userId', { userId: user.id })
      .getOne()

    if (!publication) {
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

    const socialAccount = publication.socialAccount as SocialAccount | null
    if (!socialAccount) {
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

    if (publication.platform !== Platform.THREADS) {
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
      socialAccount.accessToken,
      publication.platformPostId
    )

    // Persist insights to database for future use
    const existingAnalytics = await analyticsRepository.findOne({
      where: { postPublicationId: publication.id },
    })

    if (existingAnalytics) {
      // Update existing analytics record
      existingAnalytics.impressionsCount = metrics.views
      existingAnalytics.likesCount = metrics.likes
      existingAnalytics.commentsCount = metrics.replies
      existingAnalytics.sharesCount = metrics.shares
      existingAnalytics.reachCount = metrics.views
      existingAnalytics.recordedAt = new Date()
      // Store raw metrics data for future reference
      existingAnalytics.rawData = {
        views: metrics.views,
        likes: metrics.likes,
        shares: metrics.shares,
        replies: metrics.replies,
        quotes: metrics.quotes,
        reposts: metrics.reposts,
      }
      await analyticsRepository.save(existingAnalytics)
    } else {
      // Create new analytics record
      const analyticsRecord = analyticsRepository.create({
        postPublicationId: publication.id,
        platform: publication.platform,
        period: MetricsPeriod.DAILY,
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
      })
      await analyticsRepository.save(analyticsRecord)
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
