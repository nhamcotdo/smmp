import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'
import { utcPlus7ToUtc, detectMimeTypeFromUrl, validateMediaUrl, getOwnHostname } from '@/lib/utils'
import {
  SCHEDULED_COMMENTS,
  CAROUSEL,
  TIMEZONE,
  POST_STATUS,
  CONTENT_TYPE,
  MEDIA_TYPE,
} from '@/lib/constants'
import type {
  PollAttachment,
  ThreadsReplyControl,
} from '@/lib/types/threads'

interface ChildCommentDTO {
  id: string
  content: string
  status: string
  scheduledAt: Date | null
  commentDelayMinutes: number | null
  media?: Array<{
    id: string
    type: string
    url: string
    thumbnailUrl?: string | null
    altText?: string | null
  }>
}

interface PostDetail {
  id: string
  content: string
  status: string
  contentType: string
  scheduledAt: Date | null
  publishedAt: Date | null
  createdAt: string
  updatedAt: string
  isScheduled: boolean
  errorMessage: string | null
  retryCount: number
  parentPostId?: string | null
  commentDelayMinutes?: number | null
  childComments?: ChildCommentDTO[]
  publications?: {
    id: string
    platform: string
    status: string
    platformPostId: string | null
    publishedAt: Date | null
  }[]
  media?: {
    id: string
    type: string
    url: string
    thumbnailUrl?: string | null
    altText?: string | null
  }[]
  socialAccountId?: string | null
}

interface ScheduledComment {
  content: string
  delayMinutes: number
  imageUrl?: string
  videoUrl?: string
  altText?: string
}

interface UpdatePostRequest {
  content?: string
  contentType?: string
  scheduledFor?: string | null
  status?: string
  socialAccountId?: string | null
  imageUrl?: string
  videoUrl?: string
  altText?: string
  carouselMediaItems?: Array<{
    type: 'image' | 'video'
    url: string
    altText?: string
  }>
  threadsOptions?: {
    linkAttachment?: string
    topicTag?: string
    replyControl?: ThreadsReplyControl
    replyToId?: string
    pollAttachment?: PollAttachment
    locationId?: string
    autoPublishText?: boolean
    isGhostPost?: boolean
  }
  scheduledComments?: ScheduledComment[]
}

/**
 * GET /api/posts/:id
 * Get a single post
 */
async function getPost(
  request: Request,
  user: any,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id: postId } = await context?.params ?? {}
    if (!postId) {
      throw new Error('Post ID is required')
    }

    const post = await prisma.post.findUnique({
      where: { id: postId, userId: user.id },
      include: {
        publications: true,
        childPosts: {
          include: {
            media: {
              orderBy: { order: 'asc' },
            },
          },
        },
        media: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!post) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Post not found',
        } as unknown as ApiResponse<PostDetail>,
        { status: 404 }
      )
    }

    const response: PostDetail = {
      id: post.id,
      content: post.content,
      status: post.status,
      contentType: post.contentType,
      scheduledAt: post.scheduledAt ?? null,
      publishedAt: post.publishedAt ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      isScheduled: post.isScheduled,
      errorMessage: post.errorMessage ?? null,
      retryCount: post.retryCount,
      parentPostId: post.parentPostId ?? null,
      commentDelayMinutes: post.commentDelayMinutes ?? null,
      childComments: post.childPosts?.map(child => ({
        id: child.id,
        content: child.content,
        status: child.status,
        scheduledAt: child.scheduledAt ?? null,
        commentDelayMinutes: child.commentDelayMinutes,
        media: child.media?.map((m) => ({
          id: m.id,
          type: m.type,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl,
          altText: m.altText,
        })) ?? [],
      })) ?? [],
      publications: post.publications?.map((pub) => ({
        id: pub.id,
        platform: pub.platform,
        status: pub.status,
        platformPostId: pub.platformPostId,
        publishedAt: pub.publishedAt ?? null,
      })),
      media: post.media?.map((m) => ({
        id: m.id,
        type: m.type,
        url: m.url,
        order: m.order,
        thumbnailUrl: m.thumbnailUrl,
        altText: m.altText,
      })) ?? [],
      socialAccountId: post.socialAccountId,
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Post retrieved successfully',
    } as unknown as ApiResponse<PostDetail>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve post',
      } as unknown as ApiResponse<PostDetail>,
      { status: 500 }
    )
  }
}

/**
 * PUT /api/posts/:id
 * Update a post
 */
async function updatePost(
  request: Request,
  user: any,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id: postId } = await context?.params ?? {}
    if (!postId) {
      throw new Error('Post ID is required')
    }

    const body = await request.json() as UpdatePostRequest
    const {
      content,
      contentType,
      scheduledFor,
      status,
      socialAccountId,
      imageUrl,
      videoUrl,
      altText,
      carouselMediaItems,
      threadsOptions,
      scheduledComments
    } = body

    const post = await prisma.post.findUnique({
      where: { id: postId, userId: user.id },
      include: { media: true, childPosts: true },
    })

    if (!post) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Post not found',
        } as unknown as ApiResponse<PostDetail>,
        { status: 404 }
      )
    }

    // Don't allow updating published posts
    if (post.status === POST_STATUS.PUBLISHED) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Cannot update published post',
        } as unknown as ApiResponse<PostDetail>,
        { status: 400 }
      )
    }

    const ownHostname = getOwnHostname()

    // Validate and determine content type
    let finalContentType = contentType || post.contentType
    if (carouselMediaItems && carouselMediaItems.length > 0) {
      finalContentType = CONTENT_TYPE.CAROUSEL
    } else if (imageUrl) {
      finalContentType = CONTENT_TYPE.IMAGE
    } else if (videoUrl) {
      finalContentType = CONTENT_TYPE.VIDEO
    }

    // Validate carousel
    if (finalContentType === CONTENT_TYPE.CAROUSEL) {
      if (!carouselMediaItems || carouselMediaItems.length < CAROUSEL.MIN_ITEMS) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `Carousel must have at least ${CAROUSEL.MIN_ITEMS} items`,
          } as unknown as ApiResponse<PostDetail>,
          { status: 400 }
        )
      }
      if (carouselMediaItems.length > CAROUSEL.MAX_ITEMS) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `Carousel cannot have more than ${CAROUSEL.MAX_ITEMS} items`,
          } as unknown as ApiResponse<PostDetail>,
          { status: 400 }
        )
      }
    }

    // Validate media URLs
    if (imageUrl) {
      const imageValidation = validateMediaUrl(imageUrl, {
        allowOwnHost: true,
        ownHostname,
      })
      if (!imageValidation.valid) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `Invalid image URL: ${imageValidation.error}`,
          } as unknown as ApiResponse<PostDetail>,
          { status: 400 }
        )
      }
    }

    if (videoUrl) {
      const videoValidation = validateMediaUrl(videoUrl, {
        allowOwnHost: true,
        ownHostname,
      })
      if (!videoValidation.valid) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: `Invalid video URL: ${videoValidation.error}`,
          } as unknown as ApiResponse<PostDetail>,
          { status: 400 }
        )
      }
    }

    if (carouselMediaItems) {
      for (const item of carouselMediaItems) {
        const validation = validateMediaUrl(item.url, {
          allowOwnHost: true,
          ownHostname,
        })
        if (!validation.valid) {
          return NextResponse.json(
            {
              data: null,
              status: 400,
              success: false,
              message: `Invalid ${item.type} URL in carousel: ${validation.error}`,
            } as unknown as ApiResponse<PostDetail>,
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
            message: `Maximum ${SCHEDULED_COMMENTS.MAX_ALLOWED} scheduled comments allowed per post`,
          } as unknown as ApiResponse<PostDetail>,
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
            } as unknown as ApiResponse<PostDetail>,
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
            } as unknown as ApiResponse<PostDetail>,
            { status: 400 }
          )
        }

        // Validate comment media URLs
        if (comment.imageUrl) {
          const imageValidation = validateMediaUrl(comment.imageUrl, {
            allowOwnHost: true,
            ownHostname,
          })
          if (!imageValidation.valid) {
            return NextResponse.json(
              {
                data: null,
                status: 400,
                success: false,
                message: `Comment ${i + 1} image URL: ${imageValidation.error}`,
              } as unknown as ApiResponse<PostDetail>,
              { status: 400 }
            )
          }
        }

        if (comment.videoUrl) {
          const videoValidation = validateMediaUrl(comment.videoUrl, {
            allowOwnHost: true,
            ownHostname,
          })
          if (!videoValidation.valid) {
            return NextResponse.json(
              {
                data: null,
                status: 400,
                success: false,
                message: `Comment ${i + 1} video URL: ${videoValidation.error}`,
              } as unknown as ApiResponse<PostDetail>,
              { status: 400 }
            )
          }
        }
      }
    }

    // Prepare update data
    const updates: Record<string, unknown> = {}

    if (content !== undefined) {
      updates.content = content.trim()
    }

    if (contentType !== undefined) {
      updates.contentType = finalContentType
    }

    if (scheduledFor !== undefined) {
      if (scheduledFor === null) {
        updates.isScheduled = false
        updates.scheduledAt = null
        updates.status = POST_STATUS.DRAFT
      } else {
        updates.isScheduled = true
        updates.scheduledAt = utcPlus7ToUtc(scheduledFor)
        updates.status = POST_STATUS.SCHEDULED
      }
    }

    if (status !== undefined) {
      updates.status = status
    }

    if (socialAccountId !== undefined) {
      updates.socialAccountId = socialAccountId
    }

    if (threadsOptions !== undefined) {
      updates.metadata = threadsOptions ? { threads: threadsOptions } : undefined
    }

    // Execute update
    await prisma.post.update({
      where: { id: postId },
      data: updates,
    })

    // Update media: delete existing and create new ones within transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing media
      await tx.media.deleteMany({ where: { postId } })

      // Create new media
      if (finalContentType === CONTENT_TYPE.CAROUSEL && carouselMediaItems) {
        for (let i = 0; i < carouselMediaItems.length; i++) {
          const item = carouselMediaItems[i]
          const detectedMimeType = detectMimeTypeFromUrl(item.url)
          await tx.media.create({
            data: {
              postId,
              type: item.type === 'image' ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
              url: item.url,
              altText: item.altText || undefined,
              mimeType: detectedMimeType || (item.type === 'image' ? 'image/jpeg' : 'video/mp4'),
              order: i,
            },
          })
        }
      } else if (imageUrl || videoUrl) {
        const mediaUrl = imageUrl || videoUrl || ''
        const detectedMimeType = detectMimeTypeFromUrl(mediaUrl)
        await tx.media.create({
          data: {
            postId,
            type: finalContentType === CONTENT_TYPE.IMAGE ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
            url: mediaUrl,
            altText: altText || undefined,
            mimeType: detectedMimeType || (finalContentType === CONTENT_TYPE.IMAGE ? 'image/jpeg' : 'video/mp4'),
            order: 0,
          },
        })
      }
    })

    // Update scheduled comments: delete existing and create new ones
    if (scheduledComments !== undefined) {
      // Delete existing child posts
      await prisma.post.deleteMany({ where: { parentPostId: postId } })

      if (scheduledComments.length > 0) {
        // Calculate base time for comments
        const baseTime = scheduledFor
          ? new Date(scheduledFor).getTime() - TIMEZONE.UTC7_OFFSET_HOURS * 60 * 60 * 1000
          : post.scheduledAt?.getTime() || Date.now()

        await prisma.$transaction(async (tx) => {
          for (const comment of scheduledComments) {
            const commentScheduledAt = new Date(baseTime + comment.delayMinutes * 60 * 1000)

            let commentContentType: 'TEXT' | 'IMAGE' | 'VIDEO' = CONTENT_TYPE.TEXT
            if (comment.imageUrl) {
              commentContentType = CONTENT_TYPE.IMAGE
            } else if (comment.videoUrl) {
              commentContentType = CONTENT_TYPE.VIDEO
            }

            const childPost = await tx.post.create({
              data: {
                userId: user.id,
                parentPostId: postId,
                content: comment.content?.trim() || '',
                status: POST_STATUS.SCHEDULED,
                contentType: commentContentType,
                isScheduled: true,
                scheduledAt: commentScheduledAt,
                socialAccountId: socialAccountId ?? post.socialAccountId,
                commentDelayMinutes: comment.delayMinutes,
              },
            })

            if (comment.imageUrl || comment.videoUrl) {
              const commentMediaUrl = comment.imageUrl || comment.videoUrl || ''
              const detectedMimeType = detectMimeTypeFromUrl(commentMediaUrl)
              await tx.media.create({
                data: {
                  postId: childPost.id,
                  type: commentContentType === CONTENT_TYPE.IMAGE ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
                  url: commentMediaUrl,
                  altText: comment.altText || undefined,
                  mimeType: detectedMimeType || (commentContentType === CONTENT_TYPE.IMAGE ? 'image/jpeg' : 'video/mp4'),
                  order: 0,
                },
              })
            }
          }
        })
      }
    }

    const updatedPost = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        publications: true,
        childPosts: true,
        media: {
          orderBy: { order: 'asc' },
        },
      },
    })

    const response: PostDetail = {
      id: updatedPost!.id,
      content: updatedPost!.content,
      status: updatedPost!.status,
      contentType: updatedPost!.contentType,
      scheduledAt: updatedPost!.scheduledAt ?? null,
      publishedAt: updatedPost!.publishedAt ?? null,
      createdAt: updatedPost!.createdAt.toISOString(),
      updatedAt: updatedPost!.updatedAt.toISOString(),
      isScheduled: updatedPost!.isScheduled,
      errorMessage: updatedPost!.errorMessage ?? null,
      retryCount: updatedPost!.retryCount,
      parentPostId: updatedPost!.parentPostId ?? null,
      commentDelayMinutes: updatedPost!.commentDelayMinutes ?? null,
      childComments: updatedPost!.childPosts?.map(child => ({
        id: child.id,
        content: child.content,
        status: child.status,
        scheduledAt: child.scheduledAt ?? null,
        commentDelayMinutes: child.commentDelayMinutes,
      })) ?? [],
      publications: updatedPost!.publications?.map((pub) => ({
        id: pub.id,
        platform: pub.platform,
        status: pub.status,
        platformPostId: pub.platformPostId,
        publishedAt: pub.publishedAt ?? null,
      })),
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Post updated successfully',
    } as unknown as ApiResponse<PostDetail>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update post',
      } as unknown as ApiResponse<PostDetail>,
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/posts/:id
 * Delete a post
 */
async function deletePost(
  _request: Request,
  user: any,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id: postId } = await context?.params ?? {}
    if (!postId) {
      throw new Error('Post ID is required')
    }

    const post = await prisma.post.findUnique({
      where: { id: postId, userId: user.id },
    })

    if (!post) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Post not found',
        } as unknown as ApiResponse<{ id: string }>,
        { status: 404 }
      )
    }

    // Don't allow deleting published posts
    if (post.status === POST_STATUS.PUBLISHED) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Cannot delete published post',
        } as unknown as ApiResponse<{ id: string }>,
        { status: 400 }
      )
    }

    await prisma.post.delete({ where: { id: postId } })

    return NextResponse.json({
      data: { id: postId },
      status: 200,
      success: true,
      message: 'Post deleted successfully',
    } as unknown as ApiResponse<{ id: string }>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete post',
      } as unknown as ApiResponse<{ id: string }>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(getPost)
export const PUT = withAuth(updatePost)
export const DELETE = withAuth(deletePost)
