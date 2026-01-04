import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { PostStatus, ContentType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'

interface PostsQuery {
  status?: PostStatus
  scheduled?: boolean
  limit?: number
  offset?: number
}

interface PostListItem {
  id: string
  content: string
  status: PostStatus
  contentType: ContentType
  scheduledAt: Date | null
  publishedAt: Date | null
  createdAt: string
  isScheduled: boolean
  publications?: {
    id: string
    platform: string
    status: string
    platformPostId: string | null
  }[]
}

interface PostsResponse {
  posts: PostListItem[]
  total: number
}

/**
 * GET /api/posts
 * List posts with optional filtering
 */
async function getPosts(request: Request, user: User) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PostStatus | null
    const scheduled = searchParams.get('scheduled') === 'true'
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)

    const where: { userId: string; status?: PostStatus; isScheduled?: boolean } = {
      userId: user.id,
    }

    if (status) {
      where.status = status
    }

    if (scheduled) {
      where.isScheduled = true
    }

    const [posts, total] = await postRepository.findAndCount({
      where,
      relations: ['publications'],
      order: {
        createdAt: 'DESC',
      },
      take: limit,
      skip: offset,
    })

    const response: PostsResponse = {
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        status: post.status,
        contentType: post.contentType,
        scheduledAt: post.scheduledAt ?? null,
        publishedAt: post.publishedAt ?? null,
        createdAt: post.createdAt.toISOString(),
        isScheduled: post.isScheduled,
        publications: post.publications?.map((pub) => ({
          id: pub.id,
          platform: pub.platform,
          status: pub.status,
          platformPostId: pub.platformPostId,
        })),
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
 * Create a new post
 */
async function createPost(request: Request, user: User) {
  try {
    const body = await request.json()
    const { content, scheduledFor } = body

    if (!content?.trim()) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Content is required',
        } as unknown as ApiResponse<PostListItem>,
        { status: 400 }
      )
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

    const dataSource = await getConnection()
    const postRepository = dataSource.getRepository(Post)

    const post = postRepository.create({
      userId: user.id,
      content: content.trim(),
      status: PostStatus.DRAFT,
      contentType: ContentType.TEXT,
      isScheduled: !!scheduledFor,
      scheduledAt: scheduledFor ? new Date(scheduledFor) : undefined,
    })

    await postRepository.save(post)

    const response: PostListItem = {
      id: post.id,
      content: post.content,
      status: post.status,
      contentType: post.contentType,
      scheduledAt: post.scheduledAt ?? null,
      publishedAt: post.publishedAt ?? null,
      createdAt: post.createdAt.toISOString(),
      isScheduled: post.isScheduled,
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
