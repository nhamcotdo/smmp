import { Post, SocialAccount, MediaType } from '@/database/entities'
import { ContentType } from '@/database/entities/enums'
import type { ThreadsReplyControl } from '@/lib/types/threads'
import { IPostPublishingStrategy, PublishContext, PublishResult, ValidationErrorMessage } from './IPostPublishingStrategy'
import { publishCarouselPost } from '@/lib/services/threads-publisher.service'
import { getOrBuildThreadsPostUrl } from '@/lib/services/threads.service'
import { validateMediaUrl } from '@/lib/utils/content-parser'
import { VALID_REPLY_CONTROLS } from '@/lib/constants'

export class CarouselPostPublishingStrategy implements IPostPublishingStrategy {
  readonly contentType = ContentType.CAROUSEL

  canHandle(post: Post): boolean {
    return post.contentType === ContentType.CAROUSEL
  }

  async validate(context: PublishContext): Promise<ValidationErrorMessage[]> {
    const errors: ValidationErrorMessage[] = []
    const { post, ownHostname } = context

    if (!post.content?.trim()) {
      errors.push({ field: 'content', message: 'Post content is required' })
    }

    if (!post.media || post.media.length < 2) {
      errors.push({ field: 'media', message: 'Carousel must have at least 2 media items' })
    }

    for (let i = 0; i < (post.media?.length || 0); i++) {
      const item = post.media![i]
      const validation = validateMediaUrl(item.url, {
        allowOwnHost: true,
        ownHostname,
      })
      if (!validation.valid) {
        errors.push({ field: `media[${i}].url`, message: validation.error || 'Invalid media URL' })
      }
    }

    return errors
  }

  async publish(context: PublishContext): Promise<PublishResult> {
    const { post, socialAccount, replyToId } = context

    const threadsOptions = this.extractThreadsOptions(post)

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
      mediaItems: post.media!.map((item) => ({
        type: item.type === MediaType.IMAGE ? 'image' : 'video',
        url: item.url,
        altText: item.altText || undefined,
      })),
    }

    if (threadsOptions) {
      this.applyThreadsOptions(carouselPostParams, threadsOptions)
    }

    if (replyToId) {
      carouselPostParams.replyToId = replyToId
    } else if (threadsOptions && typeof threadsOptions.replyToId === 'string') {
      carouselPostParams.replyToId = threadsOptions.replyToId
    }

    const platformPostId = await publishCarouselPost(
      socialAccount.accessToken,
      socialAccount.platformUserId,
      carouselPostParams
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
    if (typeof options.locationId === 'string') {
      params.locationId = options.locationId
    }
    if (typeof options.autoPublishText === 'boolean') {
      params.autoPublishText = options.autoPublishText
    }
    if (typeof options.isGhostPost === 'boolean') {
      params.isGhostPost = options.isGhostPost
    }
  }
}
