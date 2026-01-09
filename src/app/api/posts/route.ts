import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/connection'
import { withAuth } from '@/lib/auth/middleware'
import type { ApiResponse } from '@/lib/types'
import { detectMimeTypeFromUrl, validateMediaUrl, getOwnHostname } from '@/lib/utils/content-parser'
import type {
  PollAttachment,
  TextEntity,
  TextAttachment,
  GifAttachment,
  ThreadsReplyControl,
} from '@/lib/types/threads'
import type { ContentType } from '@prisma/client'
import {
  SCHEDULED_COMMENTS,
  CAROUSEL,
  PAGINATION,
  TIMEZONE,
  POST_STATUS,
  CONTENT_TYPE,
  MEDIA_TYPE,
} from '@/lib/constants'

interface PostListItem {
  id: string
  content: string
  status: string
  contentType: string
  scheduledAt: Date | null
  publishedAt: Date | null
  createdAt: string
  updatedAt: string
  isScheduled: boolean
  socialAccountId?: string | null
  media?: Array<{
    id: string
    type: string
    url: string
    thumbnailUrl?: string
    altText?: string
  }>
  publications?: Array<{
    id: string
    platform: string
    status: string
    platformPostId: string | null
  }>
  parentPostId?: string | null
  commentDelayMinutes?: number | null
  childComments?: Array<{
    id: string
    content: string
    status: string
    scheduledAt: Date | null
    commentDelayMinutes: number | null
  }>
}

interface PostsResponse {
  posts: PostListItem[]
  total: number
}

interface ScheduledComment {
  content: string
  delayMinutes: number
  imageUrl?: string
  videoUrl?: string
  altText?: string
}

interface CreatePostRequest {
  content: string
  contentType?: string
  imageUrl?: string
  videoUrl?: string
  altText?: string
  scheduledFor?: string
  socialAccountId?: string
  parentPostId?: string
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
    textEntities?: TextEntity[]
    textAttachment?: TextAttachment
    gifAttachment?: GifAttachment
    isGhostPost?: boolean
  }
  scheduledComments?: ScheduledComment[]
}

/**
 * GET /api/posts
 * List posts with optional filtering
 */
async function getPosts(request: Request, user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const scheduled = searchParams.get('scheduled') === 'true'
    const limit = parseInt(searchParams.get('limit') ?? String(PAGINATION.DEFAULT_LIMIT), 10)
    const offset = parseInt(searchParams.get('offset') ?? String(PAGINATION.DEFAULT_OFFSET), 10)

    const where: Record<string, unknown> = {
      userId: user.id,
    }

    if (status) {
      where.status = status
    }

    if (scheduled) {
      where.isScheduled = true
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          publications: true,
          media: true,
          childPosts: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.post.count({ where }),
    ])

    const response: PostsResponse = {
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        status: post.status,
        contentType: post.contentType,
        scheduledAt: post.scheduledAt ?? null,
        publishedAt: post.publishedAt ?? null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        isScheduled: post.isScheduled,
        socialAccountId: post.socialAccountId,
        media: post.media?.map((m) => ({
          id: m.id,
          type: m.type,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl ?? undefined,
          altText: m.altText ?? undefined,
        })),
        publications: post.publications?.map((pub) => ({
          id: pub.id,
          platform: pub.platform,
          status: pub.status,
          platformPostId: pub.platformPostId,
        })),
        parentPostId: post.parentPostId ?? null,
        commentDelayMinutes: post.commentDelayMinutes ?? null,
        childComments: post.childPosts?.map(child => ({
          id: child.id,
          content: child.content,
          status: child.status,
          scheduledAt: child.scheduledAt ?? null,
          commentDelayMinutes: child.commentDelayMinutes,
        })) ?? [],
      })),
      total,
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: 'Posts retrieved successfully',
    } as unknown as ApiResponse<PostsResponse>)
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve posts',
      } as unknown as ApiResponse<PostsResponse>,
      { status: 500 }
    )
  }
}

/**
 * POST /api/posts
 * Create a new post with optional media attachment
 */
async function createPost(request: Request, user: any) {
  try {
    const body = await request.json() as CreatePostRequest
    const { content, contentType, imageUrl, videoUrl, altText, scheduledFor, socialAccountId, parentPostId, carouselMediaItems, threadsOptions, scheduledComments } = body

    if (!content?.trim() && !imageUrl && !videoUrl && !carouselMediaItems) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Content or media is required',
        } as unknown as ApiResponse<PostListItem>,
        { status: 400 }
      )
    }

    // Determine content type
    let finalContentType: ContentType = (contentType || CONTENT_TYPE.TEXT) as ContentType
    if (carouselMediaItems && carouselMediaItems.length > 0) {
      finalContentType = CONTENT_TYPE.CAROUSEL as ContentType
    } else if (imageUrl) {
      finalContentType = CONTENT_TYPE.IMAGE as ContentType
    } else if (videoUrl) {
      finalContentType = CONTENT_TYPE.VIDEO as ContentType
    }

    // Validate media URL matches content type
    if (finalContentType === CONTENT_TYPE.IMAGE && !imageUrl) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Image URL is required for IMAGE content type',
        } as unknown as ApiResponse<PostListItem>,
        { status: 400 }
      )
    }

    if (finalContentType === CONTENT_TYPE.VIDEO && !videoUrl) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Video URL is required for VIDEO content type',
        } as unknown as ApiResponse<PostListItem>,
        { status: 400 }
      )
    }

    if (finalContentType === CONTENT_TYPE.CAROUSEL && (!carouselMediaItems || carouselMediaItems.length < CAROUSEL.MIN_ITEMS)) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: `Carousel must have at least ${CAROUSEL.MIN_ITEMS} media items`,
        } as unknown as ApiResponse<PostListItem>,
        { status: 400 }
      )
    }

    if (finalContentType === CONTENT_TYPE.CAROUSEL && carouselMediaItems && carouselMediaItems.length > CAROUSEL.MAX_ITEMS) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: `Carousel cannot have more than ${CAROUSEL.MAX_ITEMS} media items`,
        } as unknown as ApiResponse<PostListItem>,
        { status: 400 }
      )
    }

    // Get own hostname for validation (allows uploads from /api/upload to work in production)
    const ownHostname = getOwnHostname()

    // Validate media URLs are publicly accessible (Threads API requirement)
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
            message: `Invalid image URL: ${imageValidation.error}. Use a publicly accessible URL or upload via the form.`,
          } as unknown as ApiResponse<PostListItem>,
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
            message: `Invalid video URL: ${videoValidation.error}. Use a publicly accessible URL or upload via the form.`,
          } as unknown as ApiResponse<PostListItem>,
          { status: 400 }
        )
      }
    }

    // Validate carousel media URLs
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
              message: `Invalid ${item.type} URL in carousel: ${validation.error}. Use a publicly accessible URL or upload via the form.`,
            } as unknown as ApiResponse<PostListItem>,
            { status: 400 }
          )
        }
      }
    }

    // Validate parent post ID if provided
    if (parentPostId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentPostId)) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'Invalid parent post ID format',
          } as unknown as ApiResponse<PostListItem>,
          { status: 400 }
        )
      }
    }

    // Validate scheduled date is in the future
    if (scheduledFor) {
      const scheduledDate = new Date(scheduledFor)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'Invalid date format',
          } as unknown as ApiResponse<PostListItem>,
          { status: 400 }
        )
      }
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'Scheduled date must be in the future',
          } as unknown as ApiResponse<PostListItem>,
          { status: 400 }
        )
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
          } as unknown as ApiResponse<PostListItem>,
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
            } as unknown as ApiResponse<PostListItem>,
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
            } as unknown as ApiResponse<PostListItem>,
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
                message: `Comment ${i + 1} image URL: ${imageValidation.error}. Use a publicly accessible URL or upload via the form.`,
              } as unknown as ApiResponse<PostListItem>,
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
                message: `Comment ${i + 1} video URL: ${videoValidation.error}. Use a publicly accessible URL or upload via the form.`,
              } as unknown as ApiResponse<PostListItem>,
              { status: 400 }
            )
          }
        }
      }
    }

    // Convert UTC+7 to UTC for storage
    // datetime-local input returns time without timezone, user enters in UTC+7
    // We need to subtract TIMEZONE.UTC7_OFFSET_HOURS hours to get UTC time
    let scheduledAtUTC: Date | undefined = undefined
    if (scheduledFor) {
      const scheduledDateUTC7 = new Date(scheduledFor)
      // Subtract TIMEZONE.UTC7_OFFSET_HOURS hours to convert from UTC+7 to UTC
      scheduledAtUTC = new Date(scheduledDateUTC7.getTime() - TIMEZONE.UTC7_OFFSET_HOURS * 60 * 60 * 1000)
    }

    // Create post
    const savedPost = await prisma.post.create({
      data: {
        userId: user.id,
        content: content?.trim() || '',
        status: scheduledFor ? POST_STATUS.SCHEDULED : POST_STATUS.DRAFT,
        contentType: finalContentType,
        isScheduled: !!scheduledFor,
        scheduledAt: scheduledAtUTC,
        socialAccountId: socialAccountId || null,
        parentPostId: parentPostId || null,
        metadata: threadsOptions ? { threads: threadsOptions } as any : undefined,
      },
    })

    // Create child posts for scheduled comments in a transaction
    if (scheduledComments && scheduledComments.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const comment of scheduledComments) {
            // For scheduled posts: use parent's scheduled time as base
            // For immediate posts: use current time as base
            const baseTime = scheduledAtUTC ? scheduledAtUTC.getTime() : Date.now()
            const commentScheduledAt = new Date(baseTime + comment.delayMinutes * 60 * 1000)

            // Determine content type for comment
            let commentContentType: ContentType = CONTENT_TYPE.TEXT as ContentType
            if (comment.imageUrl) {
              commentContentType = CONTENT_TYPE.IMAGE as ContentType
            } else if (comment.videoUrl) {
              commentContentType = CONTENT_TYPE.VIDEO as ContentType
            }

            const childPost = await tx.post.create({
              data: {
                userId: user.id,
                parentPostId: savedPost.id,
                content: comment.content?.trim() || '',
                status: POST_STATUS.SCHEDULED,
                contentType: commentContentType,
                isScheduled: true,
                scheduledAt: commentScheduledAt,
                socialAccountId: socialAccountId || null,
                commentDelayMinutes: comment.delayMinutes,
                metadata: {
                  threads: {},
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

            console.log(`Created scheduled comment ${childPost.id} for post ${savedPost.id} with delay ${comment.delayMinutes} minutes`)
          }
        })
      } catch (transactionError) {
        // Cleanup: Delete the parent post if transaction fails
        await prisma.post.delete({ where: { id: savedPost.id } })
        console.error(`Failed to create scheduled comments for post ${savedPost.id}, cleaned up parent post`)

        return NextResponse.json(
          {
            data: null,
            status: 500,
            success: false,
            message: transactionError instanceof Error
              ? `Failed to create scheduled comments: ${transactionError.message}`
              : 'Failed to create scheduled comments',
          } as unknown as ApiResponse<PostListItem>,
          { status: 500 }
        )
      }
    }

    // Create media record(s) if image/video URL(s) provided
    let mediaItems: PostListItem['media'] = []

    if (finalContentType === CONTENT_TYPE.CAROUSEL && carouselMediaItems) {
      // Save all carousel media items
      for (let i = 0; i < carouselMediaItems.length; i++) {
        const item = carouselMediaItems[i]
        const detectedMimeType = detectMimeTypeFromUrl(item.url)

        const media = await prisma.media.create({
          data: {
            postId: savedPost.id,
            type: item.type === 'image' ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
            url: item.url,
            altText: item.altText || undefined,
            mimeType: detectedMimeType || (item.type === 'image' ? 'image/jpeg' : 'video/mp4'),
            order: i,
          },
        })

        mediaItems.push({
          id: media.id,
          type: media.type,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl ?? undefined,
          altText: media.altText ?? undefined,
        })
      }
    } else if (imageUrl || videoUrl) {
      // Save single media item
      const mediaUrl = imageUrl || videoUrl || ''
      const detectedMimeType = detectMimeTypeFromUrl(mediaUrl)

      const media = await prisma.media.create({
        data: {
          postId: savedPost.id,
          type: finalContentType === CONTENT_TYPE.IMAGE ? MEDIA_TYPE.IMAGE : MEDIA_TYPE.VIDEO,
          url: mediaUrl,
          altText: altText || undefined,
          mimeType: detectedMimeType || (finalContentType === CONTENT_TYPE.IMAGE ? 'image/jpeg' : 'video/mp4'),
          order: 0,
        },
      })

      mediaItems = [{
        id: media.id,
        type: media.type,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl ?? undefined,
        altText: media.altText ?? undefined,
      }]
    }

    const response: PostListItem = {
      id: savedPost.id,
      content: savedPost.content,
      status: savedPost.status,
      contentType: savedPost.contentType,
      scheduledAt: savedPost.scheduledAt ?? null,
      publishedAt: savedPost.publishedAt ?? null,
      createdAt: savedPost.createdAt.toISOString(),
      updatedAt: savedPost.updatedAt.toISOString(),
      isScheduled: savedPost.isScheduled,
      socialAccountId: savedPost.socialAccountId,
      media: mediaItems,
    }

    return NextResponse.json(
      {
        data: response,
        status: 201,
        success: true,
        message: 'Post created successfully',
      } as unknown as ApiResponse<PostListItem>,
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create post',
      } as unknown as ApiResponse<PostListItem>,
      { status: 500 }
    )
  }
}

export const GET = withAuth(getPosts)
export const POST = withAuth(createPost)
