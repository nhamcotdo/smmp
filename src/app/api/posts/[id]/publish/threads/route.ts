import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { Media } from '@/database/entities/Media.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import {
  publishTextPost,
  publishImagePost,
  publishVideoPost,
} from '@/lib/services/threads-publisher.service'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
import { Platform, PostStatus, ContentType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import { validateMediaUrl, getOwnHostname } from '@/lib/utils/content-parser'

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
 * Publish a post (text, image, or video) to a specific Threads channel
 */
async function publishToThreads(
  request: Request,
  user: User,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id: postId } = await context?.params ?? {}
    if (!postId) {
      throw new Error('Post ID is required')
    }

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
    const mediaRepository = dataSource.getRepository(Media)
    const socialAccountRepository = dataSource.getRepository(SocialAccount)
    const postPublicationRepository = dataSource.getRepository(PostPublication)

    // Get the post with media relation
    const post = await postRepository.findOne({
      where: { id: postId, userId: user.id },
      relations: ['media'],
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
      // Get first media item if exists
      const mediaItem = post.media?.[0]

      // Get own hostname for validation (allows uploads from /api/upload to work in production)
      const ownHostname = getOwnHostname()

      // Validate media URLs before publishing to Threads
      if (post.contentType === ContentType.IMAGE && mediaItem?.url) {
        const validation = validateMediaUrl(mediaItem.url, {
          allowOwnHost: true,
          ownHostname,
        })
        if (!validation.valid) {
          return NextResponse.json(
            {
              data: null,
              status: 400,
              success: false,
              message: `Cannot publish post: ${validation.error}. Please update the media URL to a publicly accessible URL.`,
            } as unknown as ApiResponse<PublishResponse>,
            { status: 400 }
          )
        }
      }

      if (post.contentType === ContentType.VIDEO && mediaItem?.url) {
        const validation = validateMediaUrl(mediaItem.url, {
          allowOwnHost: true,
          ownHostname,
        })
        if (!validation.valid) {
          return NextResponse.json(
            {
              data: null,
              status: 400,
              success: false,
              message: `Cannot publish post: ${validation.error}. Please update the media URL to a publicly accessible URL.`,
            } as unknown as ApiResponse<PublishResponse>,
            { status: 400 }
          )
        }
      }

      // Publish to Threads based on content type
      switch (post.contentType) {
        case ContentType.IMAGE:
          if (!mediaItem?.url) {
            throw new Error('Image URL is required for image posts')
          }
          platformPostId = await publishImagePost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: post.content || undefined,
              imageUrl: mediaItem.url,
              altText: mediaItem.altText,
            }
          )
          break

        case ContentType.VIDEO:
          if (!mediaItem?.url) {
            throw new Error('Video URL is required for video posts')
          }
          platformPostId = await publishVideoPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: post.content || undefined,
              videoUrl: mediaItem.url,
              altText: mediaItem.altText,
            }
          )
          break

        case ContentType.TEXT:
        default:
          platformPostId = await publishTextPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: post.content,
            }
          )
          break
      }

      // Fetch post details (including permalink) from Threads API
      const platformPostUrl = await getOrBuildThreadsPostUrl(
        socialAccount.accessToken,
        platformPostId,
        socialAccount.username
      )

      // Create publication record
      const publication = postPublicationRepository.create({
        postId: post.id,
        socialAccountId: channelId,
        platform: Platform.THREADS,
        status: PostStatus.PUBLISHED,
        platformPostId,
        platformPostUrl,
        publishedAt: new Date(),
        lastSyncedAt: new Date(),
      })
      await postPublicationRepository.save(publication)

      // Update post status
      post.status = PostStatus.PUBLISHED
      post.publishedAt = new Date()
      await postRepository.save(post)

      return NextResponse.json({
        data: {
          publicationId: publication.id,
          platformPostId,
          platformUrl: platformPostUrl,
        },
        status: 200,
        success: true,
        message: `Post published to Threads successfully (${post.contentType})`,
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

      // Update post status to failed
      post.status = PostStatus.FAILED
      post.failedAt = new Date()
      post.errorMessage = publishError instanceof Error ? publishError.message : 'Unknown error'
      await postRepository.save(post)

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
