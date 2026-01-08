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
  publishCarouselPost,
  type CarouselMediaItem,
} from '@/lib/services/threads-publisher.service'
import { ThreadsReplyControl } from '@/lib/types/threads'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
import { Platform, PostStatus, ContentType, MediaType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import { validateMediaUrlForPublishing } from '@/lib/utils/content-parser'

interface ScheduledComment {
  content: string
  delayMinutes: number
  imageUrl?: string
  videoUrl?: string
  altText?: string
}

interface PublishRequest {
  content: string
  channelId: string
  imageUrl?: string
  videoUrl?: string
  altText?: string
  carouselMediaItems?: CarouselMediaItem[]
  threadsOptions?: {
    linkAttachment?: string
    topicTag?: string
    replyControl?: ThreadsReplyControl
    replyToId?: string
    pollAttachment?: {
      option_a: string
      option_b: string
      option_c?: string
      option_d?: string
    }
    locationId?: string
    autoPublishText?: boolean
    textEntities?: Array<{
      entity_type: string
      offset: number
      length: number
    }>
    gifAttachment?: {
      gif_id: string
      provider: string
    }
    isGhostPost?: boolean
  }
  scheduledComments?: ScheduledComment[]
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
    const { content, channelId, imageUrl, videoUrl, altText, carouselMediaItems, threadsOptions, scheduledComments } = body

    if (!content?.trim() && !imageUrl && !videoUrl && !carouselMediaItems?.length) {
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

    // Validate carousel media items
    if (carouselMediaItems && carouselMediaItems.length > 0) {
      if (carouselMediaItems.length < 2 || carouselMediaItems.length > 20) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'Carousel must have between 2 and 20 media items',
          } as unknown as ApiResponse<PublishResponse>,
          { status: 400 }
        )
      }

      for (let i = 0; i < carouselMediaItems.length; i++) {
        const item = carouselMediaItems[i]
        const contentType = item.type === 'image' ? ContentType.IMAGE : ContentType.VIDEO
        const validation = validateMediaUrlForPublishing(item.url, contentType)

        if (!validation.valid) {
          return NextResponse.json(
            {
              data: null,
              status: 400,
              success: false,
              message: `Invalid ${item.type} URL at position ${i + 1}: ${validation.error}. Use a publicly accessible URL or upload via the form.`,
            } as unknown as ApiResponse<PublishResponse>,
            { status: 400 }
          )
        }
      }
    }

    // Validate scheduled comments
    if (scheduledComments && scheduledComments.length > 0) {
      if (scheduledComments.length > 10) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'Maximum 10 scheduled comments allowed per post',
          } as unknown as ApiResponse<PublishResponse>,
          { status: 400 }
        )
      }

      for (let i = 0; i < scheduledComments.length; i++) {
        const comment = scheduledComments[i]

        if (!comment.content?.trim() && !comment.imageUrl && !comment.videoUrl) {
          return NextResponse.json(
            {
              data: null,
              status: 400,
              success: false,
              message: `Comment ${i + 1} must have content or media`,
            } as unknown as ApiResponse<PublishResponse>,
            { status: 400 }
          )
        }

        if (comment.delayMinutes < 0) {
          return NextResponse.json(
            {
              data: null,
              status: 400,
              success: false,
              message: `Comment ${i + 1} delay must be 0 or greater`,
            } as unknown as ApiResponse<PublishResponse>,
            { status: 400 }
          )
        }

        // Validate comment media URLs
        if (comment.imageUrl) {
          const validation = validateMediaUrlForPublishing(comment.imageUrl, ContentType.IMAGE)
          if (!validation.valid) {
            return NextResponse.json(
              {
                data: null,
                status: 400,
                success: false,
                message: `Comment ${i + 1} image URL: ${validation.error}. Use a publicly accessible URL or upload via the form.`,
              } as unknown as ApiResponse<PublishResponse>,
              { status: 400 }
            )
          }
        }

        if (comment.videoUrl) {
          const validation = validateMediaUrlForPublishing(comment.videoUrl, ContentType.VIDEO)
          if (!validation.valid) {
            return NextResponse.json(
              {
                data: null,
                status: 400,
                success: false,
                message: `Comment ${i + 1} video URL: ${validation.error}. Use a publicly accessible URL or upload via the form.`,
              } as unknown as ApiResponse<PublishResponse>,
              { status: 400 }
            )
          }
        }
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
    if (carouselMediaItems && carouselMediaItems.length > 0) {
      finalContentType = ContentType.CAROUSEL
    } else if (imageUrl) {
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

    // Create media record(s) based on content type
    const mediaRepository = dataSource.getRepository(Media)

    if (finalContentType === ContentType.CAROUSEL && carouselMediaItems) {
      // Create media records for each carousel item
      for (let i = 0; i < carouselMediaItems.length; i++) {
        const item = carouselMediaItems[i]
        const media = mediaRepository.create({
          postId: post.id,
          type: item.type === 'image' ? MediaType.IMAGE : MediaType.VIDEO,
          url: item.url,
          altText: item.altText || undefined,
          mimeType: item.type === 'image' ? 'image/jpeg' : 'video/mp4',
          order: i,
        })
        await mediaRepository.save(media)
      }
    } else if (imageUrl || videoUrl) {
      // Create single media record for image or video posts
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

    // Valid reply control values - direct validation without fragile enum conversion
    const validReplyControls = new Set(['EVERYONE', 'ACCOUNTS_YOU_FOLLOW', 'MENTIONED_ONLY', 'PARENT_POST_AUTHOR_ONLY', 'FOLLOWERS_ONLY'])

    // Build threads options with safe type conversion
    const builtThreadsOptions = threadsOptions ? {
      ...(threadsOptions.linkAttachment && { linkAttachment: threadsOptions.linkAttachment }),
      ...(threadsOptions.topicTag && { topicTag: threadsOptions.topicTag }),
      ...(threadsOptions.replyControl && validReplyControls.has(threadsOptions.replyControl) && {
        replyControl: threadsOptions.replyControl as ThreadsReplyControl
      }),
      ...(threadsOptions.replyToId && { replyToId: threadsOptions.replyToId }),
      ...(threadsOptions.locationId && { locationId: threadsOptions.locationId }),
      ...(threadsOptions.autoPublishText !== undefined && { autoPublishText: threadsOptions.autoPublishText }),
      ...(threadsOptions.textEntities && { textEntities: threadsOptions.textEntities }),
      ...(threadsOptions.gifAttachment && { gifAttachment: threadsOptions.gifAttachment }),
      ...(threadsOptions.isGhostPost !== undefined && { isGhostPost: threadsOptions.isGhostPost }),
      ...(threadsOptions.pollAttachment && { pollAttachment: threadsOptions.pollAttachment }),
    } : {}

    try {
      // Publish to Threads based on content type
      switch (finalContentType) {
        case ContentType.CAROUSEL:
          if (!carouselMediaItems || carouselMediaItems.length < 2) {
            throw new Error('At least 2 media items are required for carousel posts')
          }
          platformPostId = await publishCarouselPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: trimmedContent || undefined,
              mediaItems: carouselMediaItems.map((item) => ({
                type: item.type,
                url: item.url,
                altText: item.altText,
              })),
              ...builtThreadsOptions,
              internalUserId: user.id,
            }
          )
          break

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
              ...builtThreadsOptions,
              internalUserId: user.id,
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
              ...builtThreadsOptions,
              internalUserId: user.id,
            }
          )
          break

        case ContentType.TEXT:
        default:
          platformPostId = await publishTextPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: trimmedContent,
              ...builtThreadsOptions,
            }
          )
          break
      }

      // Validate platformPostId was returned
      if (!platformPostId) {
        throw new Error(
          finalContentType === ContentType.CAROUSEL
            ? 'Failed to create carousel containers. One or more media URLs may be invalid or inaccessible.'
            : finalContentType === ContentType.IMAGE
            ? 'Failed to create image container. The image URL may be invalid or inaccessible.'
            : finalContentType === ContentType.VIDEO
            ? 'Failed to create video container. The video URL may be invalid, inaccessible, or in an unsupported format.'
            : 'Failed to create post container. Please try again.'
        )
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
      })
      await postPublicationRepository.save(publication)
      publicationId = publication.id

      // Create scheduled comments if provided
      if (scheduledComments && scheduledComments.length > 0) {
        try {
          await dataSource.transaction(async (transactionalEntityManager) => {
            for (const comment of scheduledComments) {
              // For immediate publish: use current time as base
              const commentScheduledAt = new Date(Date.now() + comment.delayMinutes * 60 * 1000)

              // Determine content type for comment
              let commentContentType = ContentType.TEXT
              if (comment.imageUrl) {
                commentContentType = ContentType.IMAGE
              } else if (comment.videoUrl) {
                commentContentType = ContentType.VIDEO
              }

              const childPost = postRepository.create({
                userId: user.id,
                parentPostId: post.id,
                content: comment.content?.trim() || '',
                status: PostStatus.SCHEDULED,
                contentType: commentContentType,
                isScheduled: true,
                scheduledAt: commentScheduledAt,
                socialAccountId: channelId,
                commentDelayMinutes: comment.delayMinutes,
                metadata: {
                  threads: {
                    replyToId: platformPostId,
                  },
                },
              })
              await transactionalEntityManager.save(childPost)

              // Create media record if comment has media
              if (comment.imageUrl || comment.videoUrl) {
                const media = mediaRepository.create({
                  postId: childPost.id,
                  type: commentContentType === ContentType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
                  url: comment.imageUrl || comment.videoUrl || '',
                  altText: comment.altText || undefined,
                  mimeType: commentContentType === ContentType.IMAGE ? 'image/jpeg' : 'video/mp4',
                  order: 0,
                })
                await transactionalEntityManager.save(media)
              }

              console.log(`Created scheduled comment ${childPost.id} for post ${post.id} with delay ${comment.delayMinutes} minutes`)
            }
          })
        } catch (transactionError) {
          console.error('Failed to create scheduled comments:', transactionError)
          // Don't fail the main post publish, just log the error
        }
      }

      // Update existing child comments with parent's platform_post_id for reply
      const childComments = await postRepository.find({
        where: { parentPostId: post.id },
      })

      for (const child of childComments) {
        const currentMetadata = (child.metadata as { threads?: Record<string, unknown> }) || {}
        await postRepository.update(child.id, {
          metadata: {
            ...currentMetadata,
            threads: {
              ...(currentMetadata.threads || {}),
              replyToId: platformPostId,
            },
          },
        })
        console.log(`Updated child comment ${child.id} with replyToId: ${platformPostId}`)
      }

      // Link uploaded media to post for reference
      const uploadedMediaRepository = dataSource.getRepository(UploadedMedia)

      if (finalContentType === ContentType.CAROUSEL && carouselMediaItems) {
        // Link all carousel media items to post
        for (const item of carouselMediaItems) {
          const uploadedMedia = await uploadedMediaRepository.findOne({
            where: {
              userId: user.id,
              url: item.url,
              status: 'active',
            },
          })

          if (uploadedMedia) {
            // Link to post (media remains in R2 for reuse)
            uploadedMedia.postId = post.id
            await uploadedMediaRepository.save(uploadedMedia)
          }
        }
      } else {
        // Link single media to post
        const mediaUrl = imageUrl || videoUrl
        if (mediaUrl) {
          const uploadedMedia = await uploadedMediaRepository.findOne({
            where: {
              userId: user.id,
              url: mediaUrl,
              status: 'active',
            },
          })

          if (uploadedMedia) {
            // Link to post (media remains in R2 for reuse)
            uploadedMedia.postId = post.id
            await uploadedMediaRepository.save(uploadedMedia)
          }
        }
      }

      return NextResponse.json({
        data: {
          publicationId,
          platformPostId,
          platformUrl: platformPostUrl,
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
