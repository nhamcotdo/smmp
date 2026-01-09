/**
 * Scheduled Post Publisher Service
 * Background job to publish scheduled posts when their time comes
 *
 * Run this as a cron job (e.g., every 5 minutes):
 * node -r tsx/register src/lib/jobs/publish-scheduled-posts.ts
 */

import { prisma } from '@/lib/db/connection'
import { SCHEDULED_POST_PUBLISHER, VALID_REPLY_CONTROLS, PLATFORM, POST_STATUS, ACCOUNT_STATUS, CONTENT_TYPE, MEDIA_TYPE, ERROR_MESSAGES, TIME_MULTIPLIERS } from '@/lib/constants'
import {
  publishTextPost,
  publishImagePost,
  publishVideoPost,
  publishCarouselPost,
} from '@/lib/services/threads-publisher.service'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
import { needsProxy } from '@/lib/services/media-proxy.service'
import type { ThreadsReplyControl } from '@/lib/types/threads'
import { Media } from '@prisma/client'

interface PublishResult {
  postId: string
  success: boolean
  error?: string
  platformPostId?: string
  platformUrl?: string
}

const MAX_RETRY_COUNT = SCHEDULED_POST_PUBLISHER.MAX_RETRY_COUNT
const PUBLISHING_TIMEOUT_MS = SCHEDULED_POST_PUBLISHER.PUBLISHING_TIMEOUT_MS

/**
 * Find posts that should have been published but weren't
 * (e.g., due to server downtime)
 */
export async function findMissedScheduledPosts(): Promise<any[]> {
  const now = new Date()
  const MISSED_POST_THRESHOLD_MS = 5 * TIME_MULTIPLIERS.MINUTES_TO_MS
  const fiveMinutesAgo = new Date(now.getTime() - MISSED_POST_THRESHOLD_MS)

  const missedPosts = await prisma.post.findMany({
    where: {
      status: POST_STATUS.SCHEDULED,
      isScheduled: true,
      scheduledAt: {
        lt: fiveMinutesAgo,
      },
    },
  })

  return missedPosts
}

/**
 * Publish a single post to Threads
 */
async function publishPost(
  post: any,
  ownHostname: string,
  parentPostsMap?: Map<string, any>
): Promise<PublishResult | null> {
  // Check if post has exceeded maximum retry count
  if (post.retryCount >= MAX_RETRY_COUNT) {
    console.warn(`⚠️  Post ${post.id} has exceeded maximum retry count (${MAX_RETRY_COUNT}), marking as permanently failed`)

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: POST_STATUS.FAILED,
        errorMessage: ERROR_MESSAGES.MAX_RETRY_EXCEEDED,
        retryCount: post.retryCount + 1,
      },
    })

    return {
      postId: post.id,
      success: false,
      error: `Maximum retry count (${MAX_RETRY_COUNT}) exceeded`,
    }
  }

  try {
    // Handle child comments - check parent post status
    if (post.parentPostId) {
      const parentPost = parentPostsMap?.get(post.parentPostId)

      if (!parentPost) {
        console.warn(`Parent post ${post.parentPostId} not found for child comment ${post.id}, skipping`)
        return null
      }

      if (parentPost.status === POST_STATUS.PUBLISHING) {
        console.warn(`Parent post is currently being published for child comment ${post.id}, will retry next run`)
        return null
      }

      if (parentPost.status !== POST_STATUS.PUBLISHED) {
        console.warn(`Parent post not published (status: ${parentPost.status}) for child comment ${post.id}, skipping`)

        if (parentPost.status === POST_STATUS.FAILED) {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              status: POST_STATUS.FAILED,
              errorMessage: `Parent post failed: ${parentPost.errorMessage || 'Unknown error'}`,
              retryCount: post.retryCount + 1,
            },
          })

          return {
            postId: post.id,
            success: false,
            error: `Parent post failed: ${parentPost.errorMessage || 'Unknown error'}`,
          }
        }

        return null
      }
    }

    // Load media for validation and publishing
    const media = await prisma.media.findMany({
      where: { postId: post.id },
      orderBy: { order: 'asc' },
    })

    // Validate content
    if (!post.content?.trim() && media.length === 0) {
      throw new Error(ERROR_MESSAGES.POST_EMPTY)
    }

    // Get social account
    let socialAccount = post.socialAccountId
      ? await prisma.socialAccount.findFirst({
          where: {
            id: post.socialAccountId,
            status: ACCOUNT_STATUS.ACTIVE,
          },
        })
      : null

    if (!socialAccount) {
      // Use user's first active Threads account
      const accounts = await prisma.socialAccount.findMany({
        where: {
          userId: post.userId,
          platform: PLATFORM.THREADS,
          status: ACCOUNT_STATUS.ACTIVE,
        },
        take: 1,
      })

      if (accounts.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_ACTIVE_THREADS_ACCOUNT)
      }

      socialAccount = accounts[0]
    }

    if (!socialAccount.accessToken) {
      throw new Error(ERROR_MESSAGES.MISSING_ACCESS_TOKEN)
    }

    // Get replyToId for child comments
    let replyToId: string | undefined
    if (post.parentPostId) {
      const parentPublications = await prisma.postPublication.findMany({
        where: { postId: post.parentPostId },
      })

      if (parentPublications.length > 0 && parentPublications[0].platformPostId) {
        replyToId = parentPublications[0].platformPostId
      }
    }

    // Determine content type
    const contentType = post.contentType || CONTENT_TYPE.TEXT

    // Build threads options from metadata
    const metadata = post.metadata as any || {}
    const threadsMetadata = metadata.threads || {}

    const threadsOptions: {
      replyControl?: ThreadsReplyControl
      replyToId?: string
      linkAttachment?: string
      topicTag?: string
      isGhostPost?: boolean
    } = {}

    if (threadsMetadata.replyControl && VALID_REPLY_CONTROLS.has(threadsMetadata.replyControl)) {
      threadsOptions.replyControl = threadsMetadata.replyControl as ThreadsReplyControl
    }
    if (replyToId) {
      threadsOptions.replyToId = replyToId
    }
    if (threadsMetadata.linkAttachment) {
      threadsOptions.linkAttachment = threadsMetadata.linkAttachment
    }
    if (threadsMetadata.topicTag) {
      threadsOptions.topicTag = threadsMetadata.topicTag
    }
    if (threadsMetadata.isGhostPost !== undefined) {
      threadsOptions.isGhostPost = threadsMetadata.isGhostPost
    }

    let platformPostId: string

    // Publish based on content type
    switch (contentType) {
      case CONTENT_TYPE.CAROUSEL: {
        if (media.length < 2) {
          throw new Error(ERROR_MESSAGES.CAROUSEL_MIN_ITEMS)
        }

        const mediaItems = media.map((m: Media) => ({
          type: (m.type === MEDIA_TYPE.IMAGE ? 'image' : 'video') as 'image' | 'video',
          url: m.url,
          altText: m.altText || undefined,
        }))

        platformPostId = await publishCarouselPost(
          socialAccount.accessToken,
          socialAccount.platformUserId,
          {
            text: post.content || undefined,
            mediaItems,
            ...threadsOptions,
            internalUserId: post.userId,
          }
        )
        break
      }

      case CONTENT_TYPE.IMAGE: {
        const imageMedia = media.find((m: Media) => m.type === MEDIA_TYPE.IMAGE)
        if (!imageMedia) {
          throw new Error(ERROR_MESSAGES.MEDIA_MISSING_IMAGE)
        }

        platformPostId = await publishImagePost(
          socialAccount.accessToken,
          socialAccount.platformUserId,
          {
            text: post.content || undefined,
            imageUrl: imageMedia.url,
            altText: imageMedia.altText || undefined,
            ...threadsOptions,
            internalUserId: post.userId,
          }
        )
        break
      }

      case CONTENT_TYPE.VIDEO: {
        const videoMedia = media.find((m: Media) => m.type === MEDIA_TYPE.VIDEO)
        if (!videoMedia) {
          throw new Error(ERROR_MESSAGES.MEDIA_MISSING_VIDEO)
        }

        platformPostId = await publishVideoPost(
          socialAccount.accessToken,
          socialAccount.platformUserId,
          {
            text: post.content || undefined,
            videoUrl: videoMedia.url,
            altText: videoMedia.altText || undefined,
            ...threadsOptions,
            internalUserId: post.userId,
          }
        )
        break
      }

      case CONTENT_TYPE.TEXT:
      default: {
        platformPostId = await publishTextPost(
          socialAccount.accessToken,
          socialAccount.platformUserId,
          {
            text: post.content,
            ...threadsOptions,
            internalUserId: post.userId,
          }
        )
        break
      }
    }

    if (!platformPostId) {
      throw new Error(ERROR_MESSAGES.PUBLISHING_FAILED)
    }

    // Get platform URL
    const platformUrl = await getOrBuildThreadsPostUrl(
      socialAccount.accessToken,
      platformPostId,
      socialAccount.username
    )

    // Mark as publishing and create publication record in a transaction
    await prisma.$transaction(async (tx: any) => {
      // First, mark as publishing to prevent other processes from picking it up
      await tx.post.update({
        where: { id: post.id },
        data: {
          status: POST_STATUS.PUBLISHING,
          updatedAt: new Date() // Ensure proper timestamping
        },
      })

      // Create publication record
      await tx.postPublication.create({
        data: {
          postId: post.id,
          socialAccountId: socialAccount!.id,
          platform: PLATFORM.THREADS,
          status: POST_STATUS.PUBLISHED,
          platformPostId,
          platformPostUrl: platformUrl,
          publishedAt: new Date(),
        },
      })

      // Finally, mark as published
      await tx.post.update({
        where: { id: post.id },
        data: {
          status: POST_STATUS.PUBLISHED,
          publishedAt: new Date(),
        },
      })
    })

    console.log(`✅ Published post ${post.id} to Threads`)

    return {
      postId: post.id,
      success: true,
      platformPostId,
      platformUrl,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: POST_STATUS.FAILED,
        errorMessage,
        retryCount: post.retryCount + 1,
      },
    })

    console.error(`❌ Failed to publish post ${post.id}:`, errorMessage)

    return {
      postId: post.id,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Find and publish posts that are due to be published
 */
export async function publishScheduledPosts(): Promise<PublishResult[]> {
  console.log(`[${new Date().toISOString()}] Starting scheduled post publisher...`)

  // Recover stuck PUBLISHING posts before processing new ones
  const publishingTimeout = new Date(Date.now() - PUBLISHING_TIMEOUT_MS)
  const stuckPosts = await prisma.post.findMany({
    where: {
      status: POST_STATUS.PUBLISHING,
      updatedAt: {
        lt: publishingTimeout,
      },
    },
  })

  if (stuckPosts.length > 0) {
    console.warn(`⚠️  Found ${stuckPosts.length} stuck posts in PUBLISHING status, recovering...`)
    for (const stuckPost of stuckPosts) {
      await prisma.post.update({
        where: { id: stuckPost.id },
        data: {
          status: POST_STATUS.FAILED,
          errorMessage: 'Post was stuck in PUBLISHING status (process may have crashed)',
          retryCount: stuckPost.retryCount + 1,
        },
      })
      console.warn(`Recovered stuck post ${stuckPost.id}`)
    }
  }

  // Find due scheduled posts
  const now = new Date()
  const duePosts = await prisma.post.findMany({
    where: {
      status: POST_STATUS.SCHEDULED,
      scheduledAt: {
        lte: now,
      },
    },
    include: {
      publications: true,
    },
    orderBy: {
      scheduledAt: 'asc',
    },
  })

  if (duePosts.length === 0) {
    console.log('No scheduled posts due for publishing')
    return []
  }

  console.log(`Found ${duePosts.length} scheduled posts due for publishing`)

  // Load parent posts for child comments
  const parentIds = [...new Set(duePosts.filter((p: any) => p.parentPostId).map((p: any) => p.parentPostId))] as string[]
  const parentPosts = await prisma.post.findMany({
    where: {
      id: { in: parentIds },
    },
    include: {
      publications: true,
    },
  })

  const parentPostsMap = new Map<string, any>(parentPosts.map((p: any) => [p.id, p]))
  console.log(`Loaded ${parentPostsMap.size} parent posts`)

  const results: PublishResult[] = []
  const ownHostname = process.env.HOST || 'localhost'

  for (const post of duePosts) {
    const result = await publishPost(post, ownHostname, parentPostsMap)
    if (result) {
      results.push(result)
    }
  }

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.filter((r) => !r.success).length

  console.log(`Publishing complete: ${successCount} succeeded, ${failureCount} failed`)

  return results
}

/**
 * Run the scheduled post publisher (can be called from a cron job)
 */
export async function runScheduledPostPublisher() {
  try {
    const results = await publishScheduledPosts()

    // Check for missed posts
    const missedPosts = await findMissedScheduledPosts()
    if (missedPosts.length > 0) {
      console.warn(`⚠️  Found ${missedPosts.length} missed scheduled posts`)
    }

    return {
      success: true,
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      missed: missedPosts.length,
      results,
    }
  } catch (error) {
    console.error('Fatal error in scheduled post publisher:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processed: 0,
      succeeded: 0,
      failed: 0,
      missed: 0,
      results: [],
    }
  }
}

// Run if called directly
if (require.main === module) {
  runScheduledPostPublisher()
    .then((result) => {
      console.log('Scheduled post publisher completed:', result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((error) => {
      console.error('Scheduled post publisher failed:', error)
      process.exit(1)
    })
}
