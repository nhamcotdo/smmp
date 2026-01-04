import { NextResponse, NextRequest } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { Analytics } from '@/database/entities/Analytics.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { PostStatus, Platform } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'

interface AnalyticsOverview {
  totalPosts: number
  publishedPosts: number
  scheduledPosts: number
  failedPosts: number
  totalPublications: number
  totalReach: number
  totalEngagement: number
  avgEngagementRate: number
  byPlatform: {
    platform: string
    posts: number
    reach: number
    engagement: number
  }[]
}

interface PostAnalytics {
  postId: string
  content: string
  status: PostStatus
  publishedAt: string | null
  publications: {
    platform: string
    platformPostId: string | null
    status: string
    publishedAt: string | null
    analytics?: {
      likes: number
      comments: number
      shares: number
      impressions: number
      reach: number
      engagementRate: number
    }
  }[]
}

/**
 * GET /api/analytics/overview
 * Get overall analytics for the user's posts
 */
async function getAnalyticsOverview(request: Request, user: User) {
  try {
    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)
    const postPublicationRepository = dataSource.getRepository(PostPublication)
    const analyticsRepository = dataSource.getRepository(Analytics)

    // Get post counts by status
    const [totalPosts, publishedPosts, scheduledPosts, failedPosts] = await Promise.all([
      postRepository.count({ where: { userId: user.id } }),
      postRepository.count({ where: { userId: user.id, status: PostStatus.PUBLISHED } }),
      postRepository.count({ where: { userId: user.id, status: PostStatus.SCHEDULED } }),
      postRepository.count({ where: { userId: user.id, status: PostStatus.FAILED } }),
    ])

    // Get all publications for this user
    const publications = await postPublicationRepository
      .createQueryBuilder('publication')
      .leftJoin('publication.post', 'post')
      .where('post.userId = :userId', { userId: user.id })
      .andWhere('publication.status = :status', { status: PostStatus.PUBLISHED })
      .getMany()

    // Get analytics for these publications
    const publicationIds = publications.map((p) => p.id)
    const analyticsRecords = publicationIds.length > 0
      ? await analyticsRepository
          .createQueryBuilder('analytics')
          .where('analytics.postPublicationId IN (:...publicationIds)', { publicationIds })
          .getMany()
      : []

    // Aggregate metrics
    let totalReach = 0
    let totalEngagement = 0
    const byPlatformMap = new Map<string, { posts: number; reach: number; engagement: number }>()

    for (const record of analyticsRecords) {
      const reach = record.reachCount || 0
      const engagement = (record.likesCount || 0) + (record.commentsCount || 0) + (record.sharesCount || 0)

      totalReach += reach
      totalEngagement += engagement

      const platform = record.platform
      if (!byPlatformMap.has(platform)) {
        byPlatformMap.set(platform, { posts: 0, reach: 0, engagement: 0 })
      }
      const platformStats = byPlatformMap.get(platform)!
      platformStats.posts++
      platformStats.reach += reach
      platformStats.engagement += engagement
    }

    const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0

    const byPlatform = Array.from(byPlatformMap.entries()).map(([platform, stats]) => ({
      platform,
      posts: stats.posts,
      reach: stats.reach,
      engagement: stats.engagement,
    }))

    const response: AnalyticsOverview = {
      totalPosts,
      publishedPosts,
      scheduledPosts,
      failedPosts,
      totalPublications: publications.length,
      totalReach,
      totalEngagement,
      avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      byPlatform,
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Analytics retrieved successfully',
    } as unknown as ApiResponse<AnalyticsOverview>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve analytics',
      } as unknown as ApiResponse<AnalyticsOverview>,
      { status: 500 }
    )
  }
}

/**
 * GET /api/analytics/posts
 * Get analytics for all user's posts
 */
async function getPostsAnalytics(request: Request, user: User) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)
    const analyticsRepository = dataSource.getRepository(Analytics)

    const posts = await postRepository.find({
      where: { userId: user.id },
      relations: ['publications'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    })

    // Get analytics for each publication
    const response: PostAnalytics[] = []

    for (const post of posts) {
      const publicationIds = post.publications.map((p) => p.id)
      const analyticsRecords = publicationIds.length > 0
        ? await analyticsRepository
            .createQueryBuilder('analytics')
            .where('analytics.postPublicationId IN (:...publicationIds)', { publicationIds })
            .getMany()
        : []

      const analyticsMap = new Map(
        analyticsRecords.map((a) => [a.postPublicationId, a])
      )

      response.push({
        postId: post.id,
        content: post.content,
        status: post.status,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        publications: post.publications.map((pub) => {
          const analytics = analyticsMap.get(pub.id)

          return {
            platform: pub.platform,
            platformPostId: pub.platformPostId,
            status: pub.status,
            publishedAt: pub.publishedAt?.toISOString() ?? null,
            analytics: analytics ? {
              likes: analytics.likesCount || 0,
              comments: analytics.commentsCount || 0,
              shares: analytics.sharesCount || 0,
              impressions: analytics.impressionsCount || 0,
              reach: analytics.reachCount || 0,
              engagementRate: analytics.engagementRate || 0,
            } : undefined,
          }
        }),
      })
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Posts analytics retrieved successfully',
    } as unknown as ApiResponse<PostAnalytics[]>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve posts analytics',
      } as unknown as ApiResponse<PostAnalytics[]>,
      { status: 500 }
    )
  }
}

type AnalyticsResponse = AnalyticsOverview | PostAnalytics[]

export const GET = withAuth<AnalyticsResponse>(async (request: NextRequest, user: User) => {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'overview') {
    return getAnalyticsOverview(request, user) as unknown as NextResponse<ApiResponse<AnalyticsResponse>>
  }

  return getPostsAnalytics(request, user) as unknown as NextResponse<ApiResponse<AnalyticsResponse>>
})
