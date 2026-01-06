import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { Media } from '@/database/entities/Media.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { UploadedMedia } from '@/database/entities/UploadedMedia.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import {
  publishTextPost,
  publishImagePost,
  publishVideoPost,
} from '@/lib/services/threads-publisher.service'
import { buildThreadsPostUrl } from '@/lib/services/threads.service'
import { Platform, PostStatus, ContentType, MediaType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import { validateMediaUrlForPublishing } from '@/lib/utils/content-parser'
import { deleteFromR2 } from '@/lib/services/r2-presigned.service'

interface PublishRequest {
  content: string
  channelId: string
  imageUrl?: string
  videoUrl?: string
  altText?: string
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
    const { content, channelId, imageUrl, videoUrl, altText } = body

    if (!content?.trim() && !imageUrl && !videoUrl) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Content or media is required',
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

    // Validate media URLs are publicly accessible
    if (imageUrl) {
      const validation = validateMediaUrlForPublishing(imageUrl, ContentType.IMAGE)
      if (!validation.valid) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `Invalid image URL: ${validation.error}. Use a publicly accessible URL or upload via the form.`,
          } as unknown as ApiResponse<PublishResponse>,
          { status: 400 }
        )
      }
    }

    if (videoUrl) {
      const validation = validateMediaUrlForPublishing(videoUrl, ContentType.VIDEO)
      if (!validation.valid) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `Invalid video URL: ${validation.error}. Use a publicly accessible URL or upload via the form.`,
          } as unknown as ApiResponse<PublishResponse>,
          { status: 400 }
        )
      }
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

    // Determine content type
    let finalContentType = ContentType.TEXT
    if (imageUrl) {
      finalContentType = ContentType.IMAGE
    } else if (videoUrl) {
      finalContentType = ContentType.VIDEO
    }

    // Create the post first
    const post = postRepository.create({
      userId: user.id,
      content: trimmedContent,
      status: PostStatus.PUBLISHED,
      contentType: finalContentType,
    })
    await postRepository.save(post)

    // Create media record if image or video URL provided
    if (imageUrl || videoUrl) {
      const mediaRepository = dataSource.getRepository(Media)
      const media = mediaRepository.create({
        postId: post.id,
        type: finalContentType === ContentType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
        url: imageUrl || videoUrl || '',
        altText: altText || undefined,
        mimeType: finalContentType === ContentType.IMAGE ? 'image/jpeg' : 'video/mp4',
        order: 0,
      })
      await mediaRepository.save(media)
    }

    let platformPostId: string
    let publicationId: string

    try {
      // Publish to Threads based on content type
      switch (finalContentType) {
        case ContentType.IMAGE:
          if (!imageUrl) {
            throw new Error('Image URL is required for image posts')
          }
          platformPostId = await publishImagePost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: trimmedContent || undefined,
              imageUrl,
              altText,
            }
          )
          break

        case ContentType.VIDEO:
          if (!videoUrl) {
            throw new Error('Video URL is required for video posts')
          }
          platformPostId = await publishVideoPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: trimmedContent || undefined,
              videoUrl,
              altText,
            }
          )
          break

        case ContentType.TEXT:
        default:
          platformPostId = await publishTextPost(socialAccount.accessToken, socialAccount.platformUserId, {
            text: trimmedContent,
          })
          break
      }

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

      // Link uploaded media to post and delete from R2 after successful publish
      const mediaUrl = imageUrl || videoUrl
      if (mediaUrl) {
        // Use transaction to prevent race conditions
        await dataSource.transaction(async (transactionalEntityManager) => {
          const uploadedMedia = await transactionalEntityManager.findOne(UploadedMedia, {
            where: {
              userId: user.id,
              url: mediaUrl,
              status: 'active',
            },
            lock: { mode: 'pessimistic_write' }, // SELECT FOR UPDATE to prevent concurrent processing
          })

          if (uploadedMedia) {
            // Double-check status inside transaction
            if (uploadedMedia.status !== 'active') {
              console.warn(`Media ${uploadedMedia.id} already processed, skipping`)
              return
            }

            // Link to post
            uploadedMedia.postId = post.id
            await transactionalEntityManager.save(UploadedMedia, uploadedMedia)

            // Delete from R2 after database update
            if (uploadedMedia.r2Key) {
              try {
                await deleteFromR2(uploadedMedia.r2Key)
                // Mark as deleted
                uploadedMedia.status = 'deleted'
                uploadedMedia.deletedAt = new Date()
                await transactionalEntityManager.save(UploadedMedia, uploadedMedia)
              } catch (deleteError) {
                console.error('Failed to delete from R2 after publish:', deleteError)
                // Mark for cleanup instead of deleted
                uploadedMedia.status = 'expired'
                uploadedMedia.metadata = {
                  ...uploadedMedia.metadata,
                  cleanupError: deleteError instanceof Error ? deleteError.message : 'Unknown error',
                  cleanupFailedAt: new Date().toISOString(),
                }
                await transactionalEntityManager.save(UploadedMedia, uploadedMedia)
              }
            }
          }
        })
      }

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
