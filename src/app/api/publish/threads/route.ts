import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import { VALID_REPLY_CONTROLS, PLATFORM, CONTENT_TYPE, POST_STATUS, ACCOUNT_STATUS, MEDIA_TYPE, UPLOADED_MEDIA_STATUS, SCHEDULED_COMMENTS, CAROUSEL } from '@/lib/constants'
import {
  publishTextPost,
  publishImagePost,
  publishVideoPost,
  publishCarouselPost,
  type CarouselMediaItem,
} from '@/lib/services/threads-publisher.service'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
import type { ApiResponse } from '@/lib/types'
import { validateMediaUrlForPublishing, getOwnHostname } from '@/lib/utils/content-parser'
import { UploadedMediaStatus } from '@prisma/client'
import { ThreadsReplyControl } from '@/lib/types/threads'
import type { ContentType } from '@prisma/client'

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
async function publishToThreads(request: Request, user: any) {
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
      const validation = validateMediaUrlForPublishing(imageUrl, CONTENT_TYPE.IMAGE)
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
      const validation = validateMediaUrlForPublishing(videoUrl, CONTENT_TYPE.VIDEO)
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
        const contentType = item.type === 'image' ? CONTENT_TYPE.IMAGE : CONTENT_TYPE.VIDEO
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
      if (scheduledComments.length > SCHEDULED_COMMENTS.MAX_ALLOWED) {
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
          const validation = validateMediaUrlForPublishing(comment.imageUrl, CONTENT_TYPE.IMAGE)
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
          const validation = validateMediaUrlForPublishing(comment.videoUrl, CONTENT_TYPE.VIDEO)
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

    // Check for duplicate content to this channel
    const trimmedContent = content.trim()
    const existingPublication = await prisma.postPublication.findFirst({
      where: {
        socialAccountId: channelId,
        platform: PLATFORM.THREADS,
      },
      include: {
        post: true,
      },
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
    let finalContentType: ContentType = CONTENT_TYPE.TEXT
    if (carouselMediaItems && carouselMediaItems.length > 0) {
      finalContentType = CONTENT_TYPE.CAROUSEL
    } else if (imageUrl) {
      finalContentType = CONTENT_TYPE.IMAGE
    } else if (videoUrl) {
      finalContentType = CONTENT_TYPE.VIDEO
    }

    // Create the post first
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        content: trimmedContent,
        status: POST_STATUS.PUBLISHED,
        contentType: finalContentType,
      },
    })

    // Create media record(s) based on content type
    if (finalContentType === CONTENT_TYPE.CAROUSEL && carouselMediaItems) {
      // Create media records for each carousel item
      for (let i = 0; i < carouselMediaItems.length; i++) {
        const item = carouselMediaItems[i]
        await prisma.media.create({
          data: {
            postId: post.id,
            type: item.type === 'image' ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
            url: item.url,
            altText: item.altText || undefined,
            mimeType: item.type === 'image' ? 'image/jpeg' : 'video/mp4',
            order: i,
          },
        })
      }
    } else if (imageUrl || videoUrl) {
      // Create single media record for image or video posts
      await prisma.media.create({
        data: {
          postId: post.id,
          type: finalContentType === CONTENT_TYPE.IMAGE ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
          url: imageUrl || videoUrl || '',
          altText: altText || undefined,
          mimeType: finalContentType === CONTENT_TYPE.IMAGE ? 'image/jpeg' : 'video/mp4',
          order: 0,
        },
      })
    }

    let platformPostId: string
    let publicationId: string

    // Build threads options with safe type conversion
    const builtThreadsOptions = threadsOptions ? {
      ...(threadsOptions.linkAttachment && { linkAttachment: threadsOptions.linkAttachment }),
      ...(threadsOptions.topicTag && { topicTag: threadsOptions.topicTag }),
      ...(threadsOptions.replyControl && VALID_REPLY_CONTROLS.has(threadsOptions.replyControl) && {
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
        case CONTENT_TYPE.CAROUSEL:
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

        case CONTENT_TYPE.IMAGE:
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

        case CONTENT_TYPE.VIDEO:
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

        case CONTENT_TYPE.TEXT:
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
          finalContentType === 'CAROUSEL'
            ? 'Failed to create carousel containers. One or more media URLs may be invalid or inaccessible.'
            : finalContentType === 'IMAGE'
            ? 'Failed to create image container. The image URL may be invalid or inaccessible.'
            : finalContentType === 'VIDEO'
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
      const publication = await prisma.postPublication.create({
        data: {
          postId: post.id,
          socialAccountId: channelId,
          platform: PLATFORM.THREADS,
          status: POST_STATUS.PUBLISHED,
          platformPostId,
          platformPostUrl,
          publishedAt: new Date(),
        },
      })
      publicationId = publication.id

      // Create scheduled comments if provided
      if (scheduledComments && scheduledComments.length > 0) {
        try {
          await prisma.$transaction(async (tx) => {
            for (const comment of scheduledComments) {
              // For immediate publish: use current time as base
              const commentScheduledAt = new Date(Date.now() + comment.delayMinutes * 60 * 1000)

              // Determine content type for comment
              let commentContentType: ContentType = CONTENT_TYPE.TEXT
              if (comment.imageUrl) {
                commentContentType = CONTENT_TYPE.IMAGE
              } else if (comment.videoUrl) {
                commentContentType = CONTENT_TYPE.VIDEO
              }

              const childPost = await tx.post.create({
                data: {
                  userId: user.id,
                  parentPostId: post.id,
                  content: comment.content?.trim() || '',
                  status: POST_STATUS.SCHEDULED,
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
                },
              })

              // Create media record if comment has media
              if (comment.imageUrl || comment.videoUrl) {
                await tx.media.create({
                  data: {
                    postId: childPost.id,
                    type: commentContentType === CONTENT_TYPE.IMAGE ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
                    url: comment.imageUrl || comment.videoUrl || '',
                    altText: comment.altText || undefined,
                    mimeType: commentContentType === CONTENT_TYPE.IMAGE ? 'image/jpeg' : 'video/mp4',
                    order: 0,
                  },
                })
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
      const childComments = await prisma.post.findMany({
        where: { parentPostId: post.id },
      })

      for (const child of childComments) {
        const currentMetadata = (child.metadata as { threads?: Record<string, unknown> }) || {}
        await prisma.post.update({
          where: { id: child.id },
          data: {
            metadata: {
              ...currentMetadata,
              threads: {
                ...(currentMetadata.threads || {}),
                replyToId: platformPostId,
              },
            },
          },
        })
        console.log(`Updated child comment ${child.id} with replyToId: ${platformPostId}`)
      }

      // Link uploaded media to post for reference
      if (finalContentType === CONTENT_TYPE.CAROUSEL && carouselMediaItems) {
        // Link all carousel media items to post
        for (const item of carouselMediaItems) {
          const uploadedMedia = await prisma.uploadedMedia.findFirst({
            where: {
              userId: user.id,
              url: item.url,
              status: UPLOADED_MEDIA_STATUS.ACTIVE,
            },
          })

          if (uploadedMedia) {
            // Link to post (media remains in R2 for reuse)
            await prisma.uploadedMedia.update({
              where: { id: uploadedMedia.id },
              data: { postId: post.id },
            })
          }
        }
      } else {
        // Link single media to post
        const mediaUrl = imageUrl || videoUrl
        if (mediaUrl) {
          const uploadedMedia = await prisma.uploadedMedia.findFirst({
            where: {
              userId: user.id,
              url: mediaUrl,
              status: UPLOADED_MEDIA_STATUS.ACTIVE,
            },
          })

          if (uploadedMedia) {
            // Link to post (media remains in R2 for reuse)
            await prisma.uploadedMedia.update({
              where: { id: uploadedMedia.id },
              data: { postId: post.id },
            })
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
      await prisma.post.update({
        where: { id: post.id },
        data: { status: POST_STATUS.FAILED },
      })

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
