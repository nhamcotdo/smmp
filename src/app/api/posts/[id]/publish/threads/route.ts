import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { publishTextPost } from '@/lib/services/threads-publisher.service'
import { Platform, PostStatus } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'

interface PublishRequest {
  channelId: string
}

interface PublishResponse {
  publicationId: string
  platformPostId: string
  platformUrl: string
}

/**
 * POST /api/posts/:id/publish/threads
 * Publish a post to a specific Threads channel
 */
async function publishToThreads(request: Request, user: User) {
  try {
    // Extract post id from URL
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const postId = pathParts[pathParts.length - 3] // /api/posts/:id/publish/threads

    const body = await request.json() as PublishRequest
    const { channelId } = body

    if (!channelId) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Channel ID is required',
        } as unknown as ApiResponse<PublishResponse>,
        { status: 400 }
      )
    }

    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)
    const socialAccountRepository = dataSource.getRepository(SocialAccount)
    const postPublicationRepository = dataSource.getRepository(PostPublication)

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
        } as unknown as ApiResponse<PublishResponse>,
        { status: 404 }
      )
    }

    // Get the social account
    const socialAccount = await socialAccountRepository.findOne({
      where: { id: channelId, userId: user.id, platform: Platform.THREADS },
    })

    if (!socialAccount) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Threads channel not found',
        } as unknown as ApiResponse<PublishResponse>,
        { status: 404 }
      )
    }

    // Check if already published to this channel
    const existingPublication = await postPublicationRepository.findOne({
      where: {
        postId: post.id,
        socialAccountId: channelId,
      },
    })

    if (existingPublication) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Post already published to this channel',
        } as unknown as ApiResponse<PublishResponse>,
        { status: 400 }
      )
    }

    let platformPostId: string

    try {
      // Publish to Threads based on content type
      platformPostId = await publishTextPost(socialAccount.accessToken, socialAccount.platformUserId, {
        text: post.content,
      })

      // Create publication record
      const publication = postPublicationRepository.create({
        postId: post.id,
        socialAccountId: channelId,
        platform: Platform.THREADS,
        status: PostStatus.PUBLISHED,
        platformPostId,
        publishedAt: new Date(),
      })
      await postPublicationRepository.save(publication)

      return NextResponse.json({
        data: {
          publicationId: publication.id,
          platformPostId,
          platformUrl: `https://threads.net/${socialAccount.username}/post/${platformPostId}`,
        },
        status: 200,
        success: true,
        message: 'Post published to Threads successfully',
      } as unknown as ApiResponse<PublishResponse>)
    } catch (publishError) {
      // Create failed publication record
      const publication = postPublicationRepository.create({
        postId: post.id,
        socialAccountId: channelId,
        platform: Platform.THREADS,
        status: PostStatus.FAILED,
        errorMessage: publishError instanceof Error ? publishError.message : 'Unknown error',
        failedAt: new Date(),
      })
      await postPublicationRepository.save(publication)

      throw publishError
    }
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to publish post',
      } as unknown as ApiResponse<PublishResponse>,
      { status: 500 }
    )
  }
}

export const POST = withAuth(publishToThreads)
