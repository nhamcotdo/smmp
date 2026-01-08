import { Post, SocialAccount } from '@/database/entities'
import { ContentType } from '@/database/entities/enums'
import { IPostPublishingStrategy, PublishContext, PublishResult, ValidationErrorMessage } from './IPostPublishingStrategy'
import { publishImagePost } from '@/lib/services/threads-publisher.service'
import { getOrBuildThreadsPostUrl } from '@/lib/services/threads.service'
import { validateMediaUrl } from '@/lib/utils/content-parser'

export class ImagePostPublishingStrategy implements IPostPublishingStrategy {
  readonly contentType = ContentType.IMAGE

  canHandle(post: Post): boolean {
    return post.contentType === ContentType.IMAGE
  }

  async validate(context: PublishContext): Promise<ValidationErrorMessage[]> {
    const errors: ValidationErrorMessage[] = []
    const { post, ownHostname } = context

    if (!post.content?.trim()) {
      errors.push({ field: 'content', message: 'Post content is required' })
    }

    const mediaItem = post.media?.[0]
    if (!mediaItem?.url) {
      errors.push({ field: 'media', message: 'Image URL is required' })
    } else {
      const validation = validateMediaUrl(mediaItem.url, {
        allowOwnHost: true,
        ownHostname,
      })
      if (!validation.valid) {
        errors.push({ field: 'media.url', message: validation.error || 'Invalid media URL' })
      }
    }

    return errors
  }

  async publish(context: PublishContext): Promise<PublishResult> {
    const { post, socialAccount, replyToId } = context

    const mediaItem = post.media![0]

    const platformPostId = await publishImagePost(
      socialAccount.accessToken,
      socialAccount.platformUserId,
      {
        text: post.content || undefined,
        imageUrl: mediaItem.url,
        altText: mediaItem.altText || undefined,
        replyToId,
        internalUserId: post.userId,
      }
    )

    const platformPostUrl = await getOrBuildThreadsPostUrl(
      socialAccount.accessToken,
      platformPostId,
      socialAccount.username
    )

    return { platformPostId, platformPostUrl }
  }
}
