import { IUnitOfWork } from '@/lib/interfaces'
import { Post, PostStatus, Platform } from '@/database/entities'
import { PublishResult } from '@/lib/strategies/IPostPublishingStrategy'

export interface PublicationRecord {
  postId: string
  socialAccountId: string
  platform: Platform
  platformPostId: string
  platformUrl: string
  publishedAt: Date
}

export class PublicationService {
  constructor(private uow: IUnitOfWork) {}

  async createPublicationRecord(data: PublicationRecord): Promise<void> {
    const publication = this.uow.publications.create({
      postId: data.postId,
      socialAccountId: data.socialAccountId,
      platform: data.platform,
      platformPostId: data.platformPostId,
      platformUrl: data.platformUrl,
      publishedAt: data.publishedAt,
      metadata: {},
    })

    await this.uow.publications.save(publication)
  }

  async markPostAsPublished(postId: string, result: PublishResult): Promise<void> {
    await this.uow.posts.updateStatus(postId, PostStatus.PUBLISHED, {
      publishedAt: result.platformPostUrl ? new Date() : undefined,
    })
  }

  async markPostAsFailed(postId: string, errorMessage: string, retryCount: number): Promise<void> {
    const post = await this.uow.posts.findById(postId)
    if (!post) return

    await this.uow.posts.updateStatus(postId, PostStatus.FAILED, {
      errorMessage,
      publishedAt: new Date(),
    })
  }

  async markPostAsPublishing(postId: string): Promise<void> {
    await this.uow.posts.updateStatus(postId, PostStatus.PUBLISHING)
  }
}
