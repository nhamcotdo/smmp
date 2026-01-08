/**
 * Scheduled Post Publisher Service
 * Background job to publish scheduled posts when their time comes
 *
 * Run this as a cron job (e.g., every 5 minutes):
 * node -r tsx/register src/lib/jobs/publish-scheduled-posts.ts
 */

import { getConnection } from '@/lib/db/connection'
import { Post } from '@/database/entities/Post.entity'
import { PostStatus } from '@/database/entities/enums'
import { LessThan } from 'typeorm'
import { TypeORMUnitOfWorkFactory } from '@/lib/repositories'
import { ScheduledPostPublisherOrchestrator } from '@/lib/services/ScheduledPostPublisherOrchestrator'
import { createDefaultStrategyRegistry } from '@/lib/strategies'

interface PublishResult {
  postId: string
  success: boolean
  error?: string
  platformPostId?: string
  platformUrl?: string
}

let orchestratorInstance: ScheduledPostPublisherOrchestrator | null = null

async function getOrchestrator(): Promise<ScheduledPostPublisherOrchestrator> {
  if (!orchestratorInstance) {
    const dataSource = await getConnection()
    const uowFactory = new TypeORMUnitOfWorkFactory(dataSource)
    const strategyRegistry = createDefaultStrategyRegistry()
    orchestratorInstance = new ScheduledPostPublisherOrchestrator(
      () => uowFactory.create(),
      strategyRegistry
    )
  }
  return orchestratorInstance
}

/**
 * Find and publish posts that are due to be published
 * @deprecated Use ScheduledPostPublisherOrchestrator directly for better testability
 */
export async function publishScheduledPosts(): Promise<PublishResult[]> {
  const orchestrator = await getOrchestrator()
  return await orchestrator.publishScheduledPosts()
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
