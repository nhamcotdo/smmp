import { Post, SocialAccount, MediaType } from '@/database/entities'
import { ContentType } from '@/database/entities/enums'
import type {
  PollAttachment,
  TextEntity,
  TextAttachment,
  GifAttachment,
  ThreadsReplyControl,
} from '@/lib/types/threads'
import { VALID_REPLY_CONTROLS } from '@/lib/constants'
import {
  IPostPublishingStrategy,
  PublishContext,
  PublishResult,
  ValidationErrorMessage,
} from './IPostPublishingStrategy'
import { publishTextPost } from '@/lib/services/threads-publisher.service'
import { getOrBuildThreadsPostUrl } from '@/lib/services/threads.service'

export class TextPostPublishingStrategy implements IPostPublishingStrategy {
  readonly contentType = ContentType.TEXT

  canHandle(post: Post): boolean {
    return post.contentType === ContentType.TEXT
  }

  async validate(context: PublishContext): Promise<ValidationErrorMessage[]> {
    const errors: ValidationErrorMessage[] = []
    const { post } = context

    if (!post.content?.trim()) {
      errors.push({ field: 'content', message: 'Post content is required' })
    }

    return errors
  }

  async publish(context: PublishContext): Promise<PublishResult> {
    const { post, socialAccount, replyToId } = context

    const threadsOptions = this.extractThreadsOptions(post)

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
      text: post.content || '',
    }

    if (threadsOptions) {
      this.applyThreadsOptions(textPostParams, threadsOptions)
    }

    if (replyToId) {
      textPostParams.replyToId = replyToId
    } else if (threadsOptions && typeof threadsOptions.replyToId === 'string') {
      textPostParams.replyToId = threadsOptions.replyToId
    }

    const platformPostId = await publishTextPost(
      socialAccount.accessToken,
      socialAccount.platformUserId,
      textPostParams
    )

    const platformPostUrl = await getOrBuildThreadsPostUrl(
      socialAccount.accessToken,
      platformPostId,
      socialAccount.username
    )

    return { platformPostId, platformPostUrl }
  }

  private extractThreadsOptions(post: Post): Record<string, unknown> | undefined {
    return (post.metadata as { threads?: Record<string, unknown> })?.threads
  }

  private applyThreadsOptions(
    params: Record<string, unknown>,
    options: Record<string, unknown>
  ): void {
    if (typeof options.linkAttachment === 'string') {
      params.linkAttachment = options.linkAttachment
    }
    if (typeof options.topicTag === 'string') {
      params.topicTag = options.topicTag
    }
    if (typeof options.replyControl === 'string') {
      if (VALID_REPLY_CONTROLS.has(options.replyControl)) {
        params.replyControl = options.replyControl as ThreadsReplyControl
      }
    }
    if (options.pollAttachment && typeof options.pollAttachment === 'object') {
      params.pollAttachment = options.pollAttachment as PollAttachment
    }
    if (typeof options.locationId === 'string') {
      params.locationId = options.locationId
    }
    if (typeof options.autoPublishText === 'boolean') {
      params.autoPublishText = options.autoPublishText
    }
    if (Array.isArray(options.textEntities)) {
      params.textEntities = options.textEntities as TextEntity[]
    }
    if (options.textAttachment && typeof options.textAttachment === 'object') {
      params.textAttachment = options.textAttachment as TextAttachment
    }
    if (options.gifAttachment && typeof options.gifAttachment === 'object') {
      params.gifAttachment = options.gifAttachment as GifAttachment
    }
    if (typeof options.isGhostPost === 'boolean') {
      params.isGhostPost = options.isGhostPost
    }
  }
}
