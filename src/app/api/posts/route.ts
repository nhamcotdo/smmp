import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { Media } from '@/database/entities/Media.entity'
import { User } from '@/database/entities/User.entity'
import { withAuth } from '@/lib/auth/middleware'
import { PostStatus, ContentType, MediaType } from '@/database/entities/enums'
import type { ApiResponse } from '@/lib/types'
import { detectMimeTypeFromUrl, validateMediaUrl, getOwnHostname } from '@/lib/utils/content-parser'
import type {
  PollAttachment,
  TextEntity,
  TextAttachment,
  GifAttachment,
  ThreadsReplyControl,
} from '@/lib/types/threads'

interface PostListItem {
  id: string
  content: string
  status: PostStatus
  contentType: ContentType
  scheduledAt: Date | null
  publishedAt: Date | null
  createdAt: string
  isScheduled: boolean
  socialAccountId?: string | null
  media?: Array<{
    id: string
    type: MediaType
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
}

interface PostsResponse {
  posts: PostListItem[]
  total: number
}

interface CreatePostRequest {
  content: string
  contentType?: ContentType
  imageUrl?: string
  videoUrl?: string
  altText?: string
  scheduledFor?: string
  socialAccountId?: string
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
      relations: ['publications', 'media'],
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
async function createPost(request: Request, user: User) {
  try {
    const body = await request.json() as CreatePostRequest
    const { content, contentType, imageUrl, videoUrl, altText, scheduledFor, socialAccountId, carouselMediaItems, threadsOptions } = body

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
    let finalContentType = contentType || ContentType.TEXT
    if (carouselMediaItems && carouselMediaItems.length > 0) {
      finalContentType = ContentType.CAROUSEL
    } else if (imageUrl) {
      finalContentType = ContentType.IMAGE
    } else if (videoUrl) {
      finalContentType = ContentType.VIDEO
    }

    // Validate media URL matches content type
    if (finalContentType === ContentType.IMAGE && !imageUrl) {
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

    if (finalContentType === ContentType.VIDEO && !videoUrl) {
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

    if (finalContentType === ContentType.CAROUSEL && (!carouselMediaItems || carouselMediaItems.length < 2)) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Carousel must have at least 2 media items',
        } as unknown as ApiResponse<PostListItem>,
        { status: 400 }
      )
    }

    if (finalContentType === ContentType.CAROUSEL && carouselMediaItems && carouselMediaItems.length > 20) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Carousel cannot have more than 20 media items',
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
    const mediaRepository = dataSource.getRepository(Media)

    // Convert UTC+7 to UTC for storage
    // datetime-local input returns time without timezone, user enters in UTC+7
    // We need to subtract 7 hours to get UTC time
    let scheduledAtUTC: Date | undefined = undefined
    if (scheduledFor) {
      const scheduledDateUTC7 = new Date(scheduledFor)
      // Subtract 7 hours to convert from UTC+7 to UTC
      scheduledAtUTC = new Date(scheduledDateUTC7.getTime() - 7 * 60 * 60 * 1000)
    }

    // Create post
    const post = postRepository.create({
      userId: user.id,
      content: content?.trim() || '',
      status: scheduledFor ? PostStatus.SCHEDULED : PostStatus.DRAFT,
      contentType: finalContentType,
      isScheduled: !!scheduledFor,
      scheduledAt: scheduledAtUTC,
      socialAccountId: socialAccountId || null,
      metadata: threadsOptions ? { threads: threadsOptions } : undefined,
    })

    const savedPost = await postRepository.save(post)

    // Create media record(s) if image/video URL(s) provided
    let mediaItems: PostListItem['media'] = []

    if (finalContentType === ContentType.CAROUSEL && carouselMediaItems) {
      // Save all carousel media items
      for (let i = 0; i < carouselMediaItems.length; i++) {
        const item = carouselMediaItems[i]
        const detectedMimeType = detectMimeTypeFromUrl(item.url)

        const media = mediaRepository.create({
          postId: savedPost.id,
          type: item.type === 'image' ? MediaType.IMAGE : MediaType.VIDEO,
          url: item.url,
          altText: item.altText || undefined,
          mimeType: detectedMimeType || (item.type === 'image' ? 'image/jpeg' : 'video/mp4'),
          order: i,
        })
        await mediaRepository.save(media)

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

      const media = mediaRepository.create({
        postId: savedPost.id,
        type: finalContentType === ContentType.IMAGE ? MediaType.IMAGE : MediaType.VIDEO,
        url: mediaUrl,
        altText: altText || undefined,
        mimeType: detectedMimeType || (finalContentType === ContentType.IMAGE ? 'image/jpeg' : 'video/mp4'),
        order: 0,
      })
      await mediaRepository.save(media)

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
