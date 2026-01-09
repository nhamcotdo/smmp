import { IUnitOfWork } from '@/lib/interfaces'
import { Post, Platform, PostStatus } from '@/database/entities'
import { PostPublishingStrategyRegistry } from '@/lib/strategies'
import { PublishContext } from '@/lib/strategies/IPostPublishingStrategy'
import { PostQueryService } from './post/PostQueryService'
import { PostValidatorService } from './post/PostValidatorService'
import { PublicationService } from './post/PublicationService'

const MAX_RETRY_COUNT = 3

export interface PublishTaskResult {
  postId: string
  success: boolean
  error?: string
  platformPostId?: string
  platformUrl?: string
  skipped?: boolean
}

export class ScheduledPostPublisherOrchestrator {
  constructor(
    private uowFactory: () => Promise<IUnitOfWork>,
    private strategyRegistry: PostPublishingStrategyRegistry
  ) {}

  async publishScheduledPosts(): Promise<PublishTaskResult[]> {
    console.log(`[${new Date().toISOString()}] Starting scheduled post publisher...`)

    const uow = await this.uowFactory()
    const queryService = new PostQueryService(uow)
    const validatorService = new PostValidatorService(uow)
    const publicationService = new PublicationService(uow)

    const now = new Date()
    const duePosts = await queryService.findDueForPublishing(now)

    if (duePosts.length === 0) {
      console.log('No scheduled posts due for publishing')
      return []
    }

    console.log(`Found ${duePosts.length} scheduled posts due for publishing`)

    const results: PublishTaskResult[] = []
    const ownHostname = process.env.HOST || 'localhost'

    const parentIds = [...new Set(duePosts.filter((p) => p.parentPostId).map((p) => p.parentPostId))] as string[]
    const parentPostsMap = await queryService.batchLoadParentPosts(parentIds)
    console.log(`Batch loaded ${parentPostsMap.size} parent posts`)

    for (const post of duePosts) {
      const result = await this.publishPost(
        post,
        uow,
        queryService,
        validatorService,
        publicationService,
        this.strategyRegistry,
        ownHostname,
        parentPostsMap
      )

      if (result) {
        results.push(result)
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    console.log(`Publishing complete: ${successCount} succeeded, ${failureCount} failed`)

    return results
  }

  private async publishPost(
    post: Post,
    uow: IUnitOfWork,
    queryService: PostQueryService,
    validatorService: PostValidatorService,
    publicationService: PublicationService,
    strategyRegistry: PostPublishingStrategyRegistry,
    ownHostname: string,
    parentPostsMap: Map<string, Post>
  ): Promise<PublishTaskResult | null> {
    // Check if post has exceeded maximum retry count
    if (post.retryCount >= MAX_RETRY_COUNT) {
      console.warn(`⚠️  Post ${post.id} has exceeded maximum retry count (${MAX_RETRY_COUNT}), marking as permanently failed`)

      await publicationService.markPostAsFailed(
        post.id,
        `Maximum retry count (${MAX_RETRY_COUNT}) exceeded`,
        post.retryCount
      )

      return {
        postId: post.id,
        success: false,
        error: `Maximum retry count (${MAX_RETRY_COUNT}) exceeded`,
        skipped: true,
      }
    }

    try {
      if (post.parentPostId) {
        const parentPost = parentPostsMap.get(post.parentPostId)

        if (!parentPost) {
          console.warn(`Parent post ${post.parentPostId} not found for child comment ${post.id}, skipping`)
          return null
        }

        if (parentPost.status === PostStatus.PUBLISHING) {
          console.warn(`Parent post is currently being published for child comment ${post.id}, will retry next run`)
          return null
        }

        if (parentPost.status !== PostStatus.PUBLISHED) {
          console.warn(`Parent post not published (status: ${parentPost.status}) for child comment ${post.id}, skipping`)

          if (parentPost.status === PostStatus.FAILED) {
            await publicationService.markPostAsFailed(
              post.id,
              `Parent post failed: ${parentPost.errorMessage || 'Unknown error'}`,
              post.retryCount + 1
            )

            console.error(`❌ Child comment ${post.id} failed due to parent failure`)

            return {
              postId: post.id,
              success: false,
              error: `Parent post failed: ${parentPost.errorMessage || 'Unknown error'}`,
            }
          }

          return null
        }
      }

      const contentErrors = validatorService.validateContent(post)
      if (contentErrors.length > 0) {
        console.warn(`Post ${post.id} has validation errors:`, contentErrors)

        await publicationService.markPostAsFailed(
          post.id,
          contentErrors.map((e) => e.message).join(', '),
          post.retryCount + 1
        )

        return {
          postId: post.id,
          success: false,
          error: contentErrors.map((e) => e.message).join(', '),
        }
      }

      await publicationService.markPostAsPublishing(post.id)

      const accountValidation = await validatorService.validateSocialAccount(post)
      if (!accountValidation.valid || !accountValidation.account) {
        throw new Error('No active Threads account found')
      }

      const socialAccount = accountValidation.account
      const replyToId = accountValidation.replyToId

      const strategy = strategyRegistry.getStrategy(post)

      const context: PublishContext = {
        post,
        socialAccount,
        replyToId,
        ownHostname,
      }

      const validationErrors = await strategy.validate(context)
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.map((e) => `${e.field}: ${e.message}`).join(', '))
      }

      const publishResult = await strategy.publish(context)

      await uow.withTransaction(async (txUow) => {
        const txPublicationService = new PublicationService(txUow)

        await txPublicationService.createPublicationRecord({
          postId: post.id,
          socialAccountId: socialAccount.id,
          platform: Platform.THREADS,
          platformPostId: publishResult.platformPostId,
          platformUrl: publishResult.platformPostUrl || '',
          publishedAt: new Date(),
        })

        await txPublicationService.markPostAsPublished(post.id, publishResult)
      })

      console.log(`✅ Published post ${post.id} to Threads`)

      return {
        postId: post.id,
        success: true,
        platformPostId: publishResult.platformPostId,
        platformUrl: publishResult.platformPostUrl,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await publicationService.markPostAsFailed(post.id, errorMessage, post.retryCount + 1)

      console.error(`❌ Failed to publish post ${post.id}:`, errorMessage)

      return {
        postId: post.id,
        success: false,
        error: errorMessage,
      }
    }
  }
}
