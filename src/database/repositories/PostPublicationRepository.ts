import { Repository } from 'typeorm'
import { PostPublication } from '../entities/PostPublication.entity'
import { Platform, PostStatus } from '../entities/enums'

export class PostPublicationRepository extends Repository<PostPublication> {
  /**
   * Find publications by post ID
   */
  async findByPostId(postId: string): Promise<PostPublication[]> {
    return this.find({
      where: { postId },
      relations: ['socialAccount'],
    })
  }

  /**
   * Find publications by social account
   */
  async findBySocialAccountId(socialAccountId: string): Promise<PostPublication[]> {
    return this.find({
      where: { socialAccountId },
      relations: ['post'],
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * Find published posts by platform
   */
  async findPublishedByPlatform(
    userId: string,
    platform: Platform,
    limit = 20
  ): Promise<PostPublication[]> {
    return this.createQueryBuilder('publication')
      .leftJoinAndSelect('publication.socialAccount', 'account')
      .leftJoinAndSelect('publication.post', 'post')
      .where('account.userId = :userId', { userId })
      .andWhere('publication.platform = :platform', { platform })
      .andWhere('publication.status = :status', { status: PostStatus.PUBLISHED })
      .orderBy('publication.publishedAt', 'DESC')
      .take(limit)
      .getMany()
  }

  /**
   * Update analytics data
   */
  async updateAnalytics(
    publicationId: string,
    analytics: {
      likesCount?: number
      commentsCount?: number
      sharesCount?: number
      impressionsCount?: number
      reachCount?: number
    }
  ): Promise<void> {
    await this.update(publicationId, {
      ...analytics,
      lastSyncedAt: new Date(),
    })
  }

  /**
   * Find publications needing analytics sync
   */
  async findPublicationsNeedingSync(olderThanHours = 1): Promise<PostPublication[]> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)

    return this.createQueryBuilder('publication')
      .where('publication.status = :status', { status: PostStatus.PUBLISHED })
      .andWhere(
        '(publication.lastSyncedAt IS NULL OR publication.lastSyncedAt < :cutoff)',
        { cutoff }
      )
      .orderBy('publication.publishedAt', 'DESC')
      .take(50)
      .getMany()
  }

  /**
   * Get platform-specific statistics
   */
  async getPlatformStats(userId: string) {
    const stats = await this.createQueryBuilder('publication')
      .select('publication.platform', 'platform')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(publication.likesCount)', 'totalLikes')
      .addSelect('SUM(publication.commentsCount)', 'totalComments')
      .addSelect('SUM(publication.sharesCount)', 'totalShares')
      .leftJoin('publication.socialAccount', 'account')
      .where('account.userId = :userId', { userId })
      .andWhere('publication.status = :status', { status: PostStatus.PUBLISHED })
      .groupBy('publication.platform')
      .getRawMany()

    return stats.map((stat) => ({
      platform: stat.platform,
      totalPosts: parseInt(stat.total, 10),
      totalLikes: parseInt(stat.totalLikes || '0', 10),
      totalComments: parseInt(stat.totalComments || '0', 10),
      totalShares: parseInt(stat.totalShares || '0', 10),
    }))
  }

  /**
   * Update publication status with error tracking
   */
  async updateStatusWithError(
    publicationId: string,
    status: PostStatus,
    errorMessage?: string
  ): Promise<void> {
    const queryBuilder = this.createQueryBuilder()
      .update(PostPublication)
      .set({ status })
      .where('id = :id', { id: publicationId })

    if (status === PostStatus.FAILED) {
      queryBuilder
        .set({ failedAt: new Date() })
        .set({ errorMessage: errorMessage ?? '' })
        .set({ lastRetryAt: new Date() })
        .set({ retryCount: () => 'retryCount + 1' })
    } else if (status === PostStatus.PUBLISHED) {
      queryBuilder.set({ publishedAt: new Date() })
    }

    await queryBuilder.execute()
  }
}
