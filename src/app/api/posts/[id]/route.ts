import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { Media } from '@/database/entities/Media.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { PostStatus, ContentType, MediaType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import { utcPlus7ToUtc, detectMimeTypeFromUrl, validateMediaUrl, getOwnHostname } from '@/lib/utils'
import {
  SCHEDULED_COMMENTS,
  CAROUSEL,
  TIMEZONE,
} from '@/lib/constants'
import type {
  PollAttachment,
  ThreadsReplyControl,
} from '@/lib/types/threads'

interface ChildCommentDTO {
  id: string
  content: string
  status: PostStatus
  scheduledAt: Date | null
  commentDelayMinutes: number | null
}

interface PostDetail {
  id: string
  content: string
  status: PostStatus
  contentType: ContentType
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
    type: MediaType
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
  contentType?: ContentType
  scheduledFor?: string | null
  status?: PostStatus
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

    const post = await postRepository.findOne({
      where: { id: postId, userId: user.id },
      relations: ['publications', 'childPosts', 'media'],
      order: {
        media: {
          order: 'ASC',
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
  user: User,
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

    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)
    const mediaRepository = dataSource.getRepository(Media)

    const post = await postRepository.findOne({
      where: { id: postId, userId: user.id },
      relations: ['media', 'childPosts'],
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
    if (post.status === PostStatus.PUBLISHED) {
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
      finalContentType = ContentType.CAROUSEL
    } else if (imageUrl) {
      finalContentType = ContentType.IMAGE
    } else if (videoUrl) {
      finalContentType = ContentType.VIDEO
    }

    // Validate carousel
    if (finalContentType === ContentType.CAROUSEL) {
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
    type PostUpdate = {
      content?: string
      contentType?: ContentType
      isScheduled?: boolean
      scheduledAt?: Date | null
      status?: PostStatus
      socialAccountId?: string | null
      metadata?: Record<string, unknown> | null
    }
    const updates: PostUpdate = {}

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
        updates.status = PostStatus.DRAFT
      } else {
        updates.isScheduled = true
        updates.scheduledAt = utcPlus7ToUtc(scheduledFor)
        updates.status = PostStatus.SCHEDULED
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

    // Build update set object
    const updateSet: Record<string, unknown> = {}
    if (updates.content !== undefined) updateSet.content = updates.content
    if (updates.contentType !== undefined) updateSet.contentType = updates.contentType
    if (updates.isScheduled !== undefined) updateSet.isScheduled = updates.isScheduled
    if (updates.status !== undefined) updateSet.status = updates.status
    if (updates.socialAccountId !== undefined) updateSet.socialAccountId = updates.socialAccountId
    if (updates.metadata !== undefined) updateSet.metadata = updates.metadata

    // Handle scheduledFor separately to support null
    if (scheduledFor === null) {
      updateSet.scheduledAt = null
    } else if (updates.scheduledAt !== undefined) {
      updateSet.scheduledAt = updates.scheduledAt
    }

    // Execute update using query builder
    await postRepository.createQueryBuilder()
      .update(Post)
      .set(updateSet)
      .where('id = :postId', { postId })
      .execute()

    // Update media: delete existing and create new ones
    await mediaRepository.delete({ postId })

    if (finalContentType === ContentType.CAROUSEL && carouselMediaItems) {
      for (let i = 0; i < carouselMediaItems.length; i++) {
        const item = carouselMediaItems[i]
        const detectedMimeType = detectMimeTypeFromUrl(item.url)
        const media = mediaRepository.create({
          postId,
          type: item.type === 'image' ? MediaType.IMAGE : MediaType.VIDEO,
          url: item.url,
          altText: item.altText || undefined,
          mimeType: detectedMimeType || (item.type === 'image' ? 'image/jpeg' : 'video/mp4'),
          order: i,
        })
        await mediaRepository.save(media)
      }
    } else if (imageUrl || videoUrl) {
      const mediaUrl = imageUrl || videoUrl || ''
      const detectedMimeType = detectMimeTypeFromUrl(mediaUrl)
      const media = mediaRepository.create({
        postId,
        type: finalContentType === ContentType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
        url: mediaUrl,
        altText: altText || undefined,
        mimeType: detectedMimeType || (finalContentType === ContentType.IMAGE ? 'image/jpeg' : 'video/mp4'),
        order: 0,
      })
      await mediaRepository.save(media)
    }

    // Update scheduled comments: delete existing and create new ones
    if (scheduledComments !== undefined) {
      // Delete existing child posts
      await postRepository.delete({ parentPostId: postId })

      if (scheduledComments.length > 0) {
        // Calculate base time for comments
        const baseTime = scheduledFor
          ? new Date(scheduledFor).getTime() - TIMEZONE.UTC7_OFFSET_HOURS * 60 * 60 * 1000
          : post.scheduledAt?.getTime() || Date.now()

        await dataSource.transaction(async (transactionalEntityManager) => {
          for (const comment of scheduledComments) {
            const commentScheduledAt = new Date(baseTime + comment.delayMinutes * 60 * 1000)

            let commentContentType = ContentType.TEXT
            if (comment.imageUrl) {
              commentContentType = ContentType.IMAGE
            } else if (comment.videoUrl) {
              commentContentType = ContentType.VIDEO
            }

            const childPost = postRepository.create({
              userId: user.id,
              parentPostId: postId,
              content: comment.content?.trim() || '',
              status: PostStatus.SCHEDULED,
              contentType: commentContentType,
              isScheduled: true,
              scheduledAt: commentScheduledAt,
              socialAccountId: socialAccountId ?? post.socialAccountId,
              commentDelayMinutes: comment.delayMinutes,
            })
            await transactionalEntityManager.save(childPost)

            if (comment.imageUrl || comment.videoUrl) {
              const commentMediaUrl = comment.imageUrl || comment.videoUrl || ''
              const detectedMimeType = detectMimeTypeFromUrl(commentMediaUrl)
              const media = mediaRepository.create({
                postId: childPost.id,
                type: commentContentType === ContentType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
                url: commentMediaUrl,
                altText: comment.altText || undefined,
                mimeType: detectedMimeType || (commentContentType === ContentType.IMAGE ? 'image/jpeg' : 'video/mp4'),
                order: 0,
              })
              await transactionalEntityManager.save(media)
            }
          }
        })
      }
    }

    const updatedPost = await postRepository.findOne({
      where: { id: postId },
      relations: ['publications', 'childPosts', 'media'],
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
        } as unknown as ApiResponse<{ id: string }>,
        { status: 404 }
      )
    }

    // Don't allow deleting published posts
    if (post.status === PostStatus.PUBLISHED) {
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

    await postRepository.remove(post)

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
