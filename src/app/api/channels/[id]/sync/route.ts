import { NextResponse } from 'next/server'
import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { User } from '@/database/entities/User.entity'
import { Platform, PostStatus, ContentType } from '@/database/entities/enums'
import { withAuth } from '@/lib/auth/middleware'
import { getUserThreads } from '@/lib/services/threads.service'
import { extractHashtags, extractMentions } from '@/lib/utils/content-parser'
import type { ApiResponse } from '@/lib/types'
import type { ThreadsPost } from '@/lib/types/threads'

interface SyncPostsResponse {
  synced: number
  skipped: number
  posts: Array<{
    postId: string
    content: string
    publishedAt: string
    platformPostId: string
  }>
}

const MAX_SYNC_LIMIT = 100
const DEFAULT_SYNC_LIMIT = 25

/**
 * Map Threads media type to ContentType enum
 */
function mapThreadsMediaType(mediaType: string | undefined): ContentType {
  switch (mediaType) {
    case 'IMAGE':
      return ContentType.IMAGE
    case 'VIDEO':
      return ContentType.VIDEO
    case 'CAROUSEL':
      return ContentType.IMAGE
    default:
      return ContentType.TEXT
  }
}

/**
 * POST /api/channels/:id/sync
 * Sync historical posts from Threads API to database
 */
async function syncChannelPosts(
  request: Request,
  user: User,
  context?: { params: Promise<Record<string, string>> },
) {
  try {
    const { id: channelId } = await context?.params ?? {}
    if (!channelId) {
      throw new Error('Channel ID is required')
    }

    const { searchParams } = new URL(request.url)

    // Parse and validate limit parameter
    const rawLimit = searchParams.get('limit')
    const limit = rawLimit
      ? Math.min(parseInt(rawLimit, 10), MAX_SYNC_LIMIT)
      : DEFAULT_SYNC_LIMIT

    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json(
        {
          data: null,
          status: 400,
          success: false,
          message: 'Invalid limit parameter. Must be a positive integer.',
        } as unknown as ApiResponse<SyncPostsResponse>,
        { status: 400 }
      )
    }

    // Validate since parameter if provided
    const since = searchParams.get('since')
    if (since) {
      const sinceDate = new Date(since)
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          {
            data: null,
            status: 400,
            success: false,
            message: 'Invalid date format for "since" parameter. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z).',
          } as unknown as ApiResponse<SyncPostsResponse>,
          { status: 400 }
        )
      }
    }

    const dataSource = await getConnection()
    const socialAccountRepository = dataSource.getRepository(SocialAccount)
    const postRepository = dataSource.getRepository(Post)
    const postPublicationRepository = dataSource.getRepository(PostPublication)

    const account = await socialAccountRepository.findOne({
      where: {
        id: channelId,
        userId: user.id,
        platform: Platform.THREADS,
      },
    })

    if (!account) {
      return NextResponse.json(
        {
          data: null,
          status: 404,
          success: false,
          message: 'Threads channel not found',
        } as unknown as ApiResponse<SyncPostsResponse>,
        { status: 404 }
      )
    }

    // Fetch threads from Threads API
    const threadsResponse = await getUserThreads(
      account.accessToken,
      account.platformUserId,
      ['id', 'text', 'media_type', 'media', 'permalink', 'timestamp', 'owner'],
      limit
    )

    const threads = threadsResponse.data || []

    // Get existing platform post IDs to avoid duplicates
    const existingPublications = await postPublicationRepository
      .createQueryBuilder('publication')
      .where('publication.socialAccountId = :accountId', { accountId: account.id })
      .andWhere('publication.platformPostId IS NOT NULL')
      .getMany()

    const existingPlatformPostIds = new Set(
      existingPublications.map((p) => p.platformPostId).filter(Boolean)
    )

    const syncedPosts: SyncPostsResponse['posts'] = []
    let syncedCount = 0
    let skippedCount = 0

    // Process each thread
    for (const thread of threads) {
      // Skip if already exists
      if (existingPlatformPostIds.has(thread.id)) {
        skippedCount++
        continue
      }

      // Parse timestamp
      const publishedAt = new Date(thread.timestamp)

      // Apply date filter if provided
      if (since && publishedAt < new Date(since)) {
        skippedCount++
        continue
      }

      // Create Post
      const post = postRepository.create({
        userId: user.id,
        content: thread.text || '',
        status: PostStatus.PUBLISHED,
        contentType: mapThreadsMediaType(thread.media_type),
        publishedAt,
        isScheduled: false,
        hashtags: extractHashtags(thread.text || ''),
        mentions: extractMentions(thread.text || ''),
      })

      const savedPost = await postRepository.save(post)

      // Create PostPublication
      const publication = postPublicationRepository.create({
        postId: savedPost.id,
        socialAccountId: account.id,
        platform: Platform.THREADS,
        status: PostStatus.PUBLISHED,
        platformPostId: thread.id,
        platformPostUrl: thread.permalink || undefined,
        publishedAt,
        lastSyncedAt: new Date(),
      })

      await postPublicationRepository.save(publication)

      syncedPosts.push({
        postId: savedPost.id,
        content: savedPost.content,
        publishedAt: publishedAt.toISOString(),
        platformPostId: thread.id,
      })

      syncedCount++
    }

    const response: SyncPostsResponse = {
      synced: syncedCount,
      skipped: skippedCount,
      posts: syncedPosts,
    }

    return NextResponse.json({
      data: response,
      status: 200,
      success: true,
      message: `Synced ${syncedCount} posts, skipped ${skippedCount} existing posts`,
    } as unknown as ApiResponse<SyncPostsResponse>)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log detailed error for debugging
    console.error('[Sync Error] Failed to sync posts:', errorMessage)
    if (error instanceof Error) {
      console.error('[Sync Error] Stack:', error.stack)
    }

    // Return user-friendly message
    return NextResponse.json(
      {
        data: null,
        status: 500,
        success: false,
        message: 'Failed to sync posts from Threads. Please try again later.',
      } as unknown as ApiResponse<SyncPostsResponse>,
      { status: 500 }
    )
  }
}

export const POST = withAuth(syncChannelPosts)
