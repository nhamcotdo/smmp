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
import { PostStatus, Platform, AccountStatus, MediaType } from '@/database/entities/enums'
import {
  publishTextPost,
  publishImagePost,
  publishVideoPost,
  publishCarouselPost,
} from '@/lib/services/threads-publisher.service'
import type {
  PollAttachment,
  TextEntity,
  TextAttachment,
  GifAttachment,
  ThreadsReplyControl,
} from '@/lib/types/threads'
import {
  getOrBuildThreadsPostUrl,
} from '@/lib/services/threads.service'
import { LessThan, Not, IsNull } from 'typeorm'
import { ContentType } from '@/database/entities/enums'
import { validateMediaUrl, getOwnHostname } from '@/lib/utils/content-parser'
import { VALID_REPLY_CONTROLS } from '@/lib/constants'

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
    relations: ['publications', 'media', 'socialAccount'],
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
  const ownHostname = getOwnHostname()

  for (const post of duePosts) {
    try {
      // Mark as publishing
      await postRepository.update(post.id, {
        status: PostStatus.PUBLISHING,
      })

      // Use the stored social account if available, otherwise get first active Threads account
      let socialAccount: SocialAccount | null = post.socialAccount || null

      // Verify the stored account is still active and belongs to the user
      if (socialAccount && socialAccount.status !== AccountStatus.ACTIVE) {
        console.warn(`Stored social account ${socialAccount.id} is not active, falling back to first active account`)
        socialAccount = null
      }

      // Fallback: get user's first active Threads account
      if (!socialAccount) {
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

        socialAccount = socialAccounts[0]
      }

      // Get first media item if exists
      const mediaItem = post.media?.[0]

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
              internalUserId: post.userId,
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
              internalUserId: post.userId,
            }
          )
          break
        }

        case ContentType.CAROUSEL: {
          if (!post.media || post.media.length < 2) {
            throw new Error('Carousel must have at least 2 media items')
          }

          // Validate all media URLs
          for (const item of post.media) {
            const validation = validateMediaUrl(item.url, {
              allowOwnHost: true,
              ownHostname,
            })
            if (!validation.valid) {
              throw new Error(`Invalid media URL: ${validation.error}`)
            }
          }

          // Get Threads options from metadata if available
          const threadsOptions = (post.metadata as { threads?: Record<string, unknown> })?.threads
          const carouselPostParams: {
            text?: string
            mediaItems: Array<{ type: 'image' | 'video'; url: string; altText?: string }>
            linkAttachment?: string
            topicTag?: string
            replyControl?: ThreadsReplyControl
            replyToId?: string
            locationId?: string
            autoPublishText?: boolean
            isGhostPost?: boolean
            internalUserId: string
          } = {
            text: post.content || undefined,
            internalUserId: post.userId,
            mediaItems: post.media.map((item) => ({
              type: item.type === MediaType.IMAGE ? 'image' : 'video',
              url: item.url,
              altText: item.altText || undefined,
            })),
          }

          if (threadsOptions) {
            if (typeof threadsOptions.linkAttachment === 'string') {
              carouselPostParams.linkAttachment = threadsOptions.linkAttachment
            }
            if (typeof threadsOptions.topicTag === 'string') {
              carouselPostParams.topicTag = threadsOptions.topicTag
            }
            if (typeof threadsOptions.replyControl === 'string') {
              // Validate reply control value before casting
              if (VALID_REPLY_CONTROLS.has(threadsOptions.replyControl)) {
                carouselPostParams.replyControl = threadsOptions.replyControl as ThreadsReplyControl
              } else {
                console.warn(`[Post ${post.id}] Invalid replyControl in metadata: "${threadsOptions.replyControl}". Skipping.`)
              }
            }
            if (typeof threadsOptions.replyToId === 'string') {
              carouselPostParams.replyToId = threadsOptions.replyToId
            }
            if (typeof threadsOptions.locationId === 'string') {
              carouselPostParams.locationId = threadsOptions.locationId
            }
            if (typeof threadsOptions.autoPublishText === 'boolean') {
              carouselPostParams.autoPublishText = threadsOptions.autoPublishText
            }
            if (typeof threadsOptions.isGhostPost === 'boolean') {
              carouselPostParams.isGhostPost = threadsOptions.isGhostPost
            }
          }

          platformPostId = await publishCarouselPost(
            socialAccount.accessToken,
            socialAccount.platformUserId,
            carouselPostParams
          )
          break
        }

        case ContentType.TEXT:
        default: {
          // Get Threads options from metadata if available
          const threadsOptions = (post.metadata as { threads?: Record<string, unknown> })?.threads
          const textPostParams: {
            text: string
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
          } = {
            text: post.content,
          }

          if (threadsOptions) {
            if (typeof threadsOptions.linkAttachment === 'string') {
              textPostParams.linkAttachment = threadsOptions.linkAttachment
            }
            if (typeof threadsOptions.topicTag === 'string') {
              textPostParams.topicTag = threadsOptions.topicTag
            }
            if (typeof threadsOptions.replyControl === 'string') {
              // Validate reply control value before casting
              if (VALID_REPLY_CONTROLS.has(threadsOptions.replyControl)) {
                textPostParams.replyControl = threadsOptions.replyControl as ThreadsReplyControl
              } else {
                console.warn(`[Post ${post.id}] Invalid replyControl in metadata: "${threadsOptions.replyControl}". Skipping.`)
              }
            }
            if (typeof threadsOptions.replyToId === 'string') {
              textPostParams.replyToId = threadsOptions.replyToId
            }
            if (threadsOptions.pollAttachment && typeof threadsOptions.pollAttachment === 'object') {
              textPostParams.pollAttachment = threadsOptions.pollAttachment as PollAttachment
            }
            if (typeof threadsOptions.locationId === 'string') {
              textPostParams.locationId = threadsOptions.locationId
            }
            if (typeof threadsOptions.autoPublishText === 'boolean') {
              textPostParams.autoPublishText = threadsOptions.autoPublishText
            }
            if (Array.isArray(threadsOptions.textEntities)) {
              textPostParams.textEntities = threadsOptions.textEntities as TextEntity[]
            }
            if (threadsOptions.textAttachment && typeof threadsOptions.textAttachment === 'object') {
              textPostParams.textAttachment = threadsOptions.textAttachment as TextAttachment
            }
            if (threadsOptions.gifAttachment && typeof threadsOptions.gifAttachment === 'object') {
              textPostParams.gifAttachment = threadsOptions.gifAttachment as GifAttachment
            }
            if (typeof threadsOptions.isGhostPost === 'boolean') {
              textPostParams.isGhostPost = threadsOptions.isGhostPost
            }
          }

          platformPostId = await publishTextPost(socialAccount.accessToken, socialAccount.platformUserId, textPostParams)
          break
        }
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

      // Update child comments with parent's platform_post_id for reply
      const childComments = await postRepository.find({
        where: { parentPostId: post.id },
      })

      for (const child of childComments) {
        const currentMetadata = (child.metadata as { threads?: Record<string, unknown> }) || {}
        await postRepository.update(child.id, {
          metadata: {
            ...currentMetadata,
            threads: {
              ...(currentMetadata.threads || {}),
              replyToId: platformPostId,
            },
          },
        })
        console.log(`Updated child comment ${child.id} with replyToId: ${platformPostId}`)
      }

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

  // Process due child comments (scheduled replies to published posts)
  const dueChildComments = await postRepository.find({
    where: {
      status: PostStatus.SCHEDULED,
      isScheduled: true,
      scheduledAt: LessThan(now),
      parentPostId: Not(IsNull()),
    },
    relations: ['parentPost', 'parentPost.publications', 'socialAccount', 'media'],
    order: {
      scheduledAt: 'ASC',
    },
  })

  if (dueChildComments.length > 0) {
    console.log(`Processing ${dueChildComments.length} scheduled child comments...`)
  }

  for (const childComment of dueChildComments) {
    try {
      // Verify parent exists and is published
      if (!childComment.parentPost) {
        console.warn(`Child comment ${childComment.id} has no parent post, skipping`)
        continue
      }

      const parentPublication = childComment.parentPost.publications?.[0]
      if (!parentPublication?.platformPostId) {
        console.warn(`Parent post has no platform ID for child comment ${childComment.id}, skipping`)
        continue
      }

      if (childComment.parentPost.status !== PostStatus.PUBLISHED) {
        console.warn(`Parent post not published (status: ${childComment.parentPost.status}) for child comment ${childComment.id}, skipping`)
        continue
      }

      // Validate comment content is not empty
      if (!childComment.content?.trim()) {
        console.warn(`Child comment ${childComment.id} has empty content, marking as failed`)
        await postRepository.update(childComment.id, {
          status: PostStatus.FAILED,
          failedAt: new Date(),
          errorMessage: 'Comment content is empty',
          retryCount: childComment.retryCount + 1,
          lastRetryAt: new Date(),
        })
        continue
      }

      // Mark as publishing
      await postRepository.update(childComment.id, {
        status: PostStatus.PUBLISHING,
      })

      // Use stored social account or fallback to parent's account
      let socialAccount = childComment.socialAccount
      if (!socialAccount) {
        const socialAccounts = await socialAccountRepository.find({
          where: {
            userId: childComment.userId,
            platform: Platform.THREADS,
            status: AccountStatus.ACTIVE,
          },
        })

        if (socialAccounts.length === 0) {
          throw new Error('No active Threads account found')
        }

        socialAccount = socialAccounts[0]
      }

      // Get first media item if exists
      const mediaItem = childComment.media?.[0]

      // Publish comment as reply based on content type
      const commentMetadata = (childComment.metadata as { threads?: Record<string, unknown> })?.threads || {}

      let platformPostId: string

      if (childComment.contentType === ContentType.IMAGE && mediaItem?.url) {
        // Validate image URL
        const validation = validateMediaUrl(mediaItem.url, {
          allowOwnHost: true,
          ownHostname,
        })
        if (!validation.valid) {
          throw new Error(`Invalid image URL: ${validation.error}`)
        }

        platformPostId = await publishImagePost(
          socialAccount.accessToken,
          socialAccount.platformUserId,
          {
            text: childComment.content || undefined,
            imageUrl: mediaItem.url,
            altText: mediaItem.altText || undefined,
            replyToId: parentPublication.platformPostId,
            internalUserId: childComment.userId,
          }
        )
      } else if (childComment.contentType === ContentType.VIDEO && mediaItem?.url) {
        // Validate video URL
        const validation = validateMediaUrl(mediaItem.url, {
          allowOwnHost: true,
          ownHostname,
        })
        if (!validation.valid) {
          throw new Error(`Invalid video URL: ${validation.error}`)
        }

        platformPostId = await publishVideoPost(
          socialAccount.accessToken,
          socialAccount.platformUserId,
          {
            text: childComment.content || undefined,
            videoUrl: mediaItem.url,
            altText: mediaItem.altText || undefined,
            replyToId: parentPublication.platformPostId,
            internalUserId: childComment.userId,
          }
        )
      } else {
        // Text comment
        const commentParams: {
          text: string
          replyToId: string
          linkAttachment?: string
          topicTag?: string
        } = {
          text: childComment.content,
          replyToId: parentPublication.platformPostId,
        }

        if (typeof commentMetadata.linkAttachment === 'string') {
          commentParams.linkAttachment = commentMetadata.linkAttachment
        }
        if (typeof commentMetadata.topicTag === 'string') {
          commentParams.topicTag = commentMetadata.topicTag
        }

        platformPostId = await publishTextPost(
          socialAccount.accessToken,
          socialAccount.platformUserId,
          commentParams
        )
      }

      // Get post URL
      const platformPostUrl = await getOrBuildThreadsPostUrl(
        socialAccount.accessToken,
        platformPostId,
        socialAccount.username
      )

      // Create publication record for the comment
      const commentPublication = postPublicationRepository.create({
        postId: childComment.id,
        socialAccountId: socialAccount.id,
        platform: Platform.THREADS,
        status: PostStatus.PUBLISHED,
        platformPostId,
        platformPostUrl,
        publishedAt: new Date(),
      })
      await postPublicationRepository.save(commentPublication)

      // Update comment as published
      await postRepository.update(childComment.id, {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
      })

      results.push({
        postId: childComment.id,
        success: true,
        platformPostId,
        platformUrl: platformPostUrl,
      })

      console.log(`✅ Published child comment ${childComment.id} as reply to ${parentPublication.platformPostId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Mark as failed
      await postRepository.update(childComment.id, {
        status: PostStatus.FAILED,
        failedAt: new Date(),
        errorMessage,
        retryCount: childComment.retryCount + 1,
        lastRetryAt: new Date(),
      })

      results.push({
        postId: childComment.id,
        success: false,
        error: errorMessage,
      })

      console.error(`❌ Failed to publish child comment ${childComment.id}:`, errorMessage)
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
 * @returns Array of missed scheduled posts
 */
export async function findMissedScheduledPosts(): Promise<Post[]> {
  const dataSource = await getConnection()
  const postRepository = dataSource.getRepository(Post)

  const now = new Date()
  const FIVE_MINUTES_MS = 5 * 60 * 1000 // Local constant for this function
  const fiveMinutesAgo = new Date(now.getTime() - FIVE_MINUTES_MS)

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
