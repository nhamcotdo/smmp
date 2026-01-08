import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { PostStatus, ContentType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import { utcPlus7ToUtc } from '@/lib/utils/timezone'

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
}

interface UpdatePostRequest {
  content?: string
  scheduledFor?: string | null
  status?: PostStatus
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
      relations: ['publications', 'childPosts'],
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
    const { content, scheduledFor, status } = body

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

    type PostUpdate = {
      content?: string
      isScheduled?: boolean
      scheduledAt?: Date
      status?: PostStatus
    }
    const updates: PostUpdate = {}

    if (content !== undefined) {
      updates.content = content.trim()
    }

    if (scheduledFor !== undefined) {
      if (scheduledFor === null) {
        updates.isScheduled = false
        updates.status = PostStatus.DRAFT
      } else {
        // Convert UTC+7 datetime-local input to UTC for storage
        updates.isScheduled = true
        updates.scheduledAt = utcPlus7ToUtc(scheduledFor)
        updates.status = PostStatus.SCHEDULED
      }
    }

    if (status !== undefined) {
      updates.status = status
    }

    if (scheduledFor === null) {
      await postRepository.update(postId, updates)
      await postRepository.createQueryBuilder()
        .update(Post)
        .set({ scheduledAt: null as unknown as undefined })
        .where('id = :postId', { postId })
        .execute()
    } else {
      await postRepository.update(postId, updates)
    }

    const updatedPost = await postRepository.findOne({
      where: { id: postId },
      relations: ['publications', 'childPosts'],
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
