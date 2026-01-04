import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { publishTextPost } from '@/lib/services/threads-publisher.service'
import { buildThreadsPostUrl } from '@/lib/services/threads.service'
import { Platform, PostStatus, ContentType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'

interface PublishRequest {
  content: string
  channelId: string
}

interface PublishResponse {
  publicationId: string
  platformPostId: string
  platformUrl: string
}

/**
 * POST /api/publish/threads
 * Create and publish a post to Threads in one request
 */
async function publishToThreads(request: Request, user: User) {
  try {
    const body = await request.json() as PublishRequest
    const { content, channelId } = body

    if (!content?.trim()) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Content is required',
        } as unknown as ApiResponse<PublishResponse>,
        { status: 400 }
      )
    }

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

    // Check for duplicate content to this channel
    const trimmedContent = content.trim()
    const existingPublication = await postPublicationRepository.findOne({
      where: {
        socialAccountId: channelId,
        platform: Platform.THREADS,
      },
      relations: ['post'],
    })

    if (existingPublication && existingPublication.post?.content === trimmedContent) {
      return NextResponse.json(
        {
          data: null,
          status: 409,
          success: false,
          message: 'This content has already been published to this channel',
        } as unknown as ApiResponse<PublishResponse>,
        { status: 409 }
      )
    }

    // Create the post first
    const post = postRepository.create({
      userId: user.id,
      content: trimmedContent,
      status: PostStatus.PUBLISHED,
      contentType: ContentType.TEXT,
    })
    await postRepository.save(post)

    let platformPostId: string
    let publicationId: string

    try {
      // Publish to Threads
      platformPostId = await publishTextPost(socialAccount.accessToken, socialAccount.platformUserId, {
        text: trimmedContent,
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
      publicationId = publication.id

      return NextResponse.json({
        data: {
          publicationId,
          platformPostId,
          platformUrl: buildThreadsPostUrl(socialAccount.username, platformPostId),
        },
        status: 200,
        success: true,
        message: 'Post published to Threads successfully',
      } as unknown as ApiResponse<PublishResponse>)
    } catch (publishError) {
      // Update post status to failed
      await postRepository.update(post.id, { status: PostStatus.FAILED })

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
