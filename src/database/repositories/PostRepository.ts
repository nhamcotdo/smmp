import { Repository, MoreThan } from 'typeorm'
import { Post } from '../entities/Post.entity'
import { PostStatus } from '../entities/enums'

export class PostRepository extends Repository<Post> {
  /**
   * Find scheduled posts that are due for publishing
   */
  async findDueScheduledPosts(): Promise<Post[]> {
    return this.createQueryBuilder('post')
      .leftJoinAndSelect('post.publications', 'publications')
      .leftJoinAndSelect('publications.socialAccount', 'socialAccount')
      .where('post.status = :status', { status: PostStatus.SCHEDULED })
      .andWhere('post.scheduledAt <= :now', { now: new Date() })
      .orderBy('post.scheduledAt', 'ASC')
      .getMany()
  }

  /**
   * Find upcoming scheduled posts for a user
   */
  async findUpcomingPosts(userId: string, limit = 10): Promise<Post[]> {
    return this.find({
      where: {
        userId,
        status: PostStatus.SCHEDULED,
        scheduledAt: MoreThan(new Date()),
      },
      relations: ['publications', 'publications.socialAccount'],
      order: { scheduledAt: 'ASC' },
      take: limit,
    })
  }

  /**
   * Find posts by status with pagination
   */
  async findByStatusWithPagination(
    userId: string,
    status: PostStatus,
    page = 1,
    limit = 20
  ): Promise<{ posts: Post[]; total: number }> {
    const [posts, total] = await this.findAndCount({
      where: { userId, status },
      relations: ['publications', 'media'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return { posts, total }
  }

  /**
   * Search posts by hashtags
   */
  async searchByHashtags(userId: string, hashtags: string[]): Promise<Post[]> {
    return this.createQueryBuilder('post')
      .where('post.userId = :userId', { userId })
      .andWhere('post.hashtags @> :hashtags', { hashtags })
      .orderBy('post.createdAt', 'DESC')
      .getMany()
  }

  /**
   * Get posts analytics summary
   */
  async getAnalyticsSummary(userId: string) {
    const posts = await this.find({
      where: { userId },
      select: ['analytics', 'status'],
    })

    const summary = {
      totalPosts: posts.length,
      publishedPosts: posts.filter((p) => p.status === PostStatus.PUBLISHED).length,
      draftPosts: posts.filter((p) => p.status === PostStatus.DRAFT).length,
      scheduledPosts: posts.filter((p) => p.status === PostStatus.SCHEDULED).length,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
    }

    posts.forEach((post) => {
      if (post.analytics) {
        summary.totalLikes += post.analytics.totalLikes || 0
        summary.totalComments += post.analytics.totalComments || 0
        summary.totalShares += post.analytics.totalShares || 0
      }
    })

    return summary
  }

  /**
   * Update post status with error tracking
   */
  async updateStatusWithError(
    postId: string,
    status: PostStatus,
    errorMessage?: string
  ): Promise<void> {
    const queryBuilder = this.createQueryBuilder()
      .update(Post)
      .set({ status })
      .where('id = :id', { id: postId })

    if (status === PostStatus.FAILED) {
      queryBuilder
        .set({ failedAt: new Date() })
        .set({ errorMessage: errorMessage ?? '' })
    } else if (status === PostStatus.PUBLISHED) {
      queryBuilder.set({ publishedAt: new Date() })
    }

    await queryBuilder.execute()
  }
}
