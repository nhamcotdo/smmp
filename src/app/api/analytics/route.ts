import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
import type { ApiResponse } from '@/lib/types'
import { POST_STATUS } from '@/lib/constants'

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
  status: string
  publishedAt: string | null
  publications: {
    platform: string
    platformPostId: string | null
    platformPostUrl?: string
    status: string
    publishedAt: string | null
  }[]
}

/**
 * GET /api/analytics/overview
 * Get overall analytics for the user's posts
 */
async function getAnalyticsOverview(request: Request, user: any) {
  try {
    // Get post counts by status
    const [totalPosts, publishedPosts, scheduledPosts, failedPosts] = await Promise.all([
      prisma.post.count({ where: { userId: user.id } }),
      prisma.post.count({ where: { userId: user.id, status: POST_STATUS.PUBLISHED } }),
      prisma.post.count({ where: { userId: user.id, status: POST_STATUS.SCHEDULED } }),
      prisma.post.count({ where: { userId: user.id, status: POST_STATUS.FAILED } }),
    ])

    // Get all publications for this user through their posts
    const userPosts = await prisma.post.findMany({
      where: { userId: user.id },
      select: { id: true },
    })

    const postIds = userPosts.map(p => p.id)

    const publications = postIds.length > 0
      ? await prisma.postPublication.findMany({
          where: {
            postId: { in: postIds },
            status: POST_STATUS.PUBLISHED,
          },
        })
      : []

    // Get analytics for these publications
    const publicationIds = publications.map((p) => p.id)
    const analyticsRecords = publicationIds.length > 0
      ? await prisma.analytics.findMany({
          where: {
            postPublicationId: { in: publicationIds },
          },
        })
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
 * Get analytics for all user's posts with fresh Threads insights
 */
async function getPostsAnalytics(request: NextRequest, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // Get only published posts with publications and socialAccount relation
    const posts = await prisma.post.findMany({
      where: {
        userId: user.id,
        status: POST_STATUS.PUBLISHED,
      },
      include: {
        publications: {
          include: {
            socialAccount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const response: PostAnalytics[] = []

    for (const post of posts) {
      const publicationsWithAnalytics = await Promise.all(
        post.publications.map(async (pub) => {
          const socialAccount = pub.socialAccount

          // Get or fetch permalink (auto-saves to DB if missing)
          const platformPostUrl = socialAccount?.accessToken
            ? await getOrFetchPermalink(pub, socialAccount)
            : undefined

          // Return publication without analytics - insights are fetched on-demand via separate API
          return {
            id: pub.id,
            platform: pub.platform,
            platformPostId: pub.platformPostId,
            platformPostUrl,
            status: pub.status,
            publishedAt: pub.publishedAt?.toISOString() ?? null,
          }
        })
      )

      response.push({
        postId: post.id,
        content: post.content,
        status: post.status,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        publications: publicationsWithAnalytics,
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

/**
 * Helper to get or fetch permalink for a publication
 * Fetches from API if not in database and saves it
 */
async function getOrFetchPermalink(
  pub: { id: string; platformPostUrl?: string | null; platformPostId?: string | null },
  socialAccount: { accessToken: string | null; username: string }
): Promise<string | undefined> {
  let platformPostUrl = pub.platformPostUrl?.trim()
  if (!platformPostUrl && socialAccount.accessToken && pub.platformPostId) {
    try {
      platformPostUrl = await getOrBuildThreadsPostUrl(
        socialAccount.accessToken,
        pub.platformPostId,
        socialAccount.username
      )
      // Save to database for future use
      await prisma.postPublication.update({
        where: { id: pub.id },
        data: { platformPostUrl },
      })
    } catch (permalinkError) {
      console.error(`Failed to fetch permalink for ${pub.id}:`, permalinkError)
      // Fallback to built URL
      platformPostUrl = `https://www.threads.com/@${socialAccount.username}/post/${pub.platformPostId}`
    }
  }

  if (!platformPostUrl && socialAccount.accessToken && pub.platformPostId) {
    platformPostUrl = `https://www.threads.com/@${socialAccount.username}/post/${pub.platformPostId}`
  }

  return platformPostUrl
}

export const GET = withAuth<AnalyticsResponse>(async (request: NextRequest, user: any) => {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'overview') {
    return getAnalyticsOverview(request, user) as unknown as NextResponse<ApiResponse<AnalyticsResponse>>
  }

  return getPostsAnalytics(request, user) as unknown as NextResponse<ApiResponse<AnalyticsResponse>>
})
