import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import { PLATFORM, CONTENT_TYPE, POST_STATUS } from '@/lib/constants'
import {
  publishTextPost,
  publishImagePost,
  publishVideoPost,
} from '@/lib/services/threads-publisher.service'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
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
  user: any,
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

    // Get the post with media relation
    const post = await prisma.post.findFirst({
      where: { id: postId, userId: user.id },
      include: { media: true },
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
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { id: channelId, userId: user.id, platform: PLATFORM.THREADS },
    })

    if (!socialAccount || !socialAccount.accessToken) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Threads channel not found or access token missing',
        } as unknown as ApiResponse<PublishResponse>,
        { status: 404 }
      )
    }

    // Check if already published to this channel
    const existingPublication = await prisma.postPublication.findFirst({
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
      if (post.contentType === CONTENT_TYPE.IMAGE && mediaItem?.url) {
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

      if (post.contentType === CONTENT_TYPE.VIDEO && mediaItem?.url) {
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
        case CONTENT_TYPE.IMAGE:
          if (!mediaItem?.url) {
            throw new Error('Image URL is required for image posts')
          }
          platformPostId = await publishImagePost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: post.content || undefined,
              imageUrl: mediaItem.url,
              altText: mediaItem.altText || undefined,
              internalUserId: user.id,
            }
          )
          break

        case CONTENT_TYPE.VIDEO:
          if (!mediaItem?.url) {
            throw new Error('Video URL is required for video posts')
          }
          platformPostId = await publishVideoPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: post.content || undefined,
              videoUrl: mediaItem.url,
              altText: mediaItem.altText || undefined,
              internalUserId: user.id,
            }
          )
          break

        case CONTENT_TYPE.TEXT:
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
      const publication = await prisma.postPublication.create({
        data: {
          postId: post.id,
          socialAccountId: channelId,
          platform: PLATFORM.THREADS,
          status: POST_STATUS.PUBLISHED,
          platformPostId,
          platformPostUrl,
          publishedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      })

      // Update post status
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: POST_STATUS.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      return NextResponse.json({
        data: {
          publicationId: publication.id,
          platformPostId,
          platformUrl: platformPostUrl,
        },
        status: 200,
        success: true,
        message: `Post published to Threads successfully (${post.contentType})`, // post.contentType is already the ContentType enum
      } as unknown as ApiResponse<PublishResponse>)
    } catch (publishError) {
      // Create failed publication record
      await prisma.postPublication.create({
        data: {
          postId: post.id,
          socialAccountId: channelId,
          platform: PLATFORM.THREADS,
          status: POST_STATUS.FAILED,
          errorMessage: publishError instanceof Error ? publishError.message : 'Unknown error',
          failedAt: new Date(),
        },
      })

      // Update post status to failed
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: POST_STATUS.FAILED,
          failedAt: new Date(),
          errorMessage: publishError instanceof Error ? publishError.message : 'Unknown error',
        },
      })

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
