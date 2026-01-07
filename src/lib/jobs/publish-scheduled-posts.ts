/**
 * Scheduled Post Publisher Service
 * Background job to publish scheduled posts when their time comes
 *
 * Run this as a cron job (e.g., every 5 minutes):
 * node -r tsx/register src/lib/jobs/publish-scheduled-posts.ts
 */

import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { PostStatus, Platform, AccountStatus } from '@/database/entities/enums'
import {
  publishTextPost,
  publishImagePost,
  publishVideoPost,
} from '@/lib/services/threads-publisher.service'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
import { LessThan } from 'typeorm'
import { ContentType } from '@/database/entities/enums'
import { validateMediaUrl, getOwnHostname } from '@/lib/utils/content-parser'

interface PublishResult {
  postId: string
  success: boolean
  error?: string
  platformPostId?: string
  platformUrl?: string
}

/**
 * Find and publish posts that are due to be published
 */
export async function publishScheduledPosts(): Promise<PublishResult[]> {
  console.log(`[${new Date().toISOString()}] Starting scheduled post publisher...`)

  const dataSource = await getConnection()
  const postRepository = dataSource.getRepository(Post)
  const socialAccountRepository = dataSource.getRepository(SocialAccount)
  const postPublicationRepository = dataSource.getRepository(PostPublication)

  // Find posts that are scheduled and due (database-level filtering)
  const now = new Date()
  const duePosts = await postRepository.find({
    where: {
      status: PostStatus.SCHEDULED,
      isScheduled: true,
      scheduledAt: LessThan(now),
    },
    relations: ['publications', 'media'],
    order: {
      scheduledAt: 'ASC',
    },
  })

  if (duePosts.length === 0) {
    console.log('No scheduled posts due for publishing')
    return []
  }

  console.log(`Found ${duePosts.length} scheduled posts due for publishing`)

  const results: PublishResult[] = []

  for (const post of duePosts) {
    try {
      // Mark as publishing
      await postRepository.update(post.id, {
        status: PostStatus.PUBLISHING,
      })

      // Get user's social accounts for publishing
      const socialAccounts = await socialAccountRepository.find({
        where: {
          userId: post.userId,
          platform: Platform.THREADS,
          status: AccountStatus.ACTIVE,
        },
      })

      if (socialAccounts.length === 0) {
        throw new Error('No active Threads account found')
      }

      // Publish to the first active account
      // TODO: Support publishing to multiple accounts
      const socialAccount = socialAccounts[0]

      // Get first media item if exists
      const mediaItem = post.media?.[0]

      // Get own hostname for validation (allows uploads from /api/upload to work in production)
      const ownHostname = getOwnHostname()

      // Validate media URLs before attempting to publish
      if (post.contentType === ContentType.IMAGE && mediaItem?.url) {
        const validation = validateMediaUrl(mediaItem.url, {
          allowOwnHost: true,
          ownHostname,
        })
        if (!validation.valid) {
          throw new Error(`Invalid image URL: ${validation.error}`)
        }
      }

      if (post.contentType === ContentType.VIDEO && mediaItem?.url) {
        const validation = validateMediaUrl(mediaItem.url, {
          allowOwnHost: true,
          ownHostname,
        })
        if (!validation.valid) {
          throw new Error(`Invalid video URL: ${validation.error}`)
        }
      }

      // Publish based on content type
      let platformPostId: string
      switch (post.contentType) {
        case ContentType.IMAGE: {
          if (!mediaItem?.url) {
            throw new Error('Image URL is required for image posts')
          }
          platformPostId = await publishImagePost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: post.content || undefined,
              imageUrl: mediaItem.url,
              altText: mediaItem.altText || undefined,
            }
          )
          break
        }

        case ContentType.VIDEO: {
          if (!mediaItem?.url) {
            throw new Error('Video URL is required for video posts')
          }
          platformPostId = await publishVideoPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            {
              text: post.content || undefined,
              videoUrl: mediaItem.url,
              altText: mediaItem.altText || undefined,
            }
          )
          break
        }

        case ContentType.TEXT:
        default:
          platformPostId = await publishTextPost(socialAccount.accessToken, socialAccount.platformUserId, {
            text: post.content,
          })
          break
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
        socialAccountId: socialAccount.id,
        platform: Platform.THREADS,
        status: PostStatus.PUBLISHED,
        platformPostId,
        platformPostUrl,
        publishedAt: new Date(),
      })
      await postPublicationRepository.save(publication)

      // Update post as published
      await postRepository.update(post.id, {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
      })

      results.push({
        postId: post.id,
        success: true,
        platformPostId,
        platformUrl: platformPostUrl,
      })

      console.log(`✅ Published post ${post.id} to Threads`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Mark as failed
      await postRepository.update(post.id, {
        status: PostStatus.FAILED,
        failedAt: new Date(),
        errorMessage,
        retryCount: post.retryCount + 1,
        lastRetryAt: new Date(),
      })

      results.push({
        postId: post.id,
        success: false,
        error: errorMessage,
      })

      console.error(`❌ Failed to publish post ${post.id}:`, errorMessage)
    }
  }

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.filter((r) => !r.success).length

  console.log(`Publishing complete: ${successCount} succeeded, ${failureCount} failed`)

  return results
}

/**
 * Check for posts that should have been published but weren't
 * (e.g., due to server downtime)
 */
export async function findMissedScheduledPosts(): Promise<Post[]> {
  const dataSource = await getConnection()
  const postRepository = dataSource.getRepository(Post)

  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

  const missedPosts = await postRepository.find({
    where: {
      status: PostStatus.SCHEDULED,
      isScheduled: true,
      scheduledAt: LessThan(fiveMinutesAgo),
    },
  })

  return missedPosts
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
