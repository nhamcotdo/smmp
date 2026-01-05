import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { User } from '@/database/entities/User.entity'
import { Platform } from '@/database/entities/enums'
import { withAuth } from '@/lib/auth/middleware'
import { getThreadInsights, extractAllMetrics } from '@/lib/services/threads.service'
import type { ApiResponse } from '@/lib/types'

interface PostInsightsResponse {
  postId: string
  publicationId: string
  platformPostId: string
  views: number
  likes: number
  shares: number
  replies: number
  quotes: number
  reposts: number
}

/**
 * GET /api/posts/:id/insights
 * Get insights for a published post on Threads
 */
async function getPostInsights(
  request: Request,
  user: User,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id: postId } = await context?.params ?? {}
    if (!postId) {
      throw new Error('Post ID is required')
    }

    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)
    const postPublicationRepository = dataSource.getRepository(PostPublication)
    const socialAccountRepository = dataSource.getRepository(SocialAccount)

    // Get the post
    const post = await postRepository.findOne({
      where: { id: postId, userId: user.id },
    })

    if (!post) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Post not found',
        } as unknown as ApiResponse<PostInsightsResponse>,
        { status: 404 }
      )
    }

    // Get Threads publications for this post
    const publications = await postPublicationRepository.find({
      where: {
        postId: post.id,
        platform: Platform.THREADS,
      },
    })

    if (publications.length === 0) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'No Threads publication found for this post',
        } as unknown as ApiResponse<PostInsightsResponse>,
        { status: 404 }
      )
    }

    // Get insights for the first publication (can be extended for multiple)
    const publication = publications[0]
    const socialAccount = await socialAccountRepository.findOne({
      where: { id: publication.socialAccountId },
    })

    if (!socialAccount || !publication.platformPostId) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Invalid publication or social account',
        } as unknown as ApiResponse<PostInsightsResponse>,
        { status: 400 }
      )
    }

    // Fetch insights from Threads API
    const insights = await getThreadInsights(
      socialAccount.accessToken,
      publication.platformPostId,
      ['views', 'likes', 'shares', 'replies', 'quotes', 'reposts']
    )

    // Extract all metrics using shared utility
    const metrics = extractAllMetrics(insights)
    const response: PostInsightsResponse = {
      postId: post.id,
      publicationId: publication.id,
      platformPostId: publication.platformPostId,
      ...metrics,
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Post insights retrieved successfully',
    } as unknown as ApiResponse<PostInsightsResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch post insights',
      } as unknown as ApiResponse<PostInsightsResponse>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(getPostInsights)
