import { DataSource } from 'typeorm'
import { Post } from '@/database/entities/Post.entity'
import { PostStatus } from '@/database/entities/enums'
import { LessThan } from 'typeorm'
import {
  IPostRepository,
  FindPostOptions,
  StatusUpdateMetadata,
  CreatePostData,
} from '@/lib/interfaces/repositories/IPost.repository'

const MAX_RETRY_COUNT = 3

export class TypeORMPostRepository implements IPostRepository {
  constructor(private dataSource: DataSource) {}

  private getRepository() {
    return this.dataSource.getRepository(Post)
  }

  async findById(id: string, options?: FindPostOptions): Promise<Post | null> {
    const repo = this.getRepository()

    const findOptions: any = {
      where: { id },
    }

    if (options?.includeMedia) {
      findOptions.relations = [...(findOptions.relations || []), 'media']
    }

    if (options?.includePublications) {
      findOptions.relations = [...(findOptions.relations || []), 'publications']
    }

    if (options?.includeSocialAccount) {
      findOptions.relations = [...(findOptions.relations || []), 'socialAccount']
    }

    return await repo.findOne(findOptions)
  }

  async findByIds(ids: string[], options?: FindPostOptions): Promise<Post[]> {
    if (ids.length === 0) return []

    const repo = this.getRepository()

    const findOptions: any = {
      where: ids.map((id) => ({ id })),
    }

    if (options?.includeMedia) {
      findOptions.relations = [...(findOptions.relations || []), 'media']
    }

    if (options?.includePublications) {
      findOptions.relations = [...(findOptions.relations || []), 'publications']
    }

    if (options?.includeSocialAccount) {
      findOptions.relations = [...(findOptions.relations || []), 'socialAccount']
    }

    return await repo.find(findOptions)
  }

  async findByUserId(userId: string, options?: FindPostOptions): Promise<Post[]> {
    const repo = this.getRepository()

    const findOptions: any = {
      where: { userId },
      order: { createdAt: 'DESC' },
    }

    if (options?.includeMedia) {
      findOptions.relations = [...(findOptions.relations || []), 'media']
    }

    if (options?.includePublications) {
      findOptions.relations = [...(findOptions.relations || []), 'publications']
    }

    if (options?.includeSocialAccount) {
      findOptions.relations = [...(findOptions.relations || []), 'socialAccount']
    }

    return await repo.find(findOptions)
  }

  async findDueForPublishing(before: Date, options?: FindPostOptions): Promise<Post[]> {
    const repo = this.getRepository()

    const findOptions: any = {
      where: [
        // Scheduled posts that are due
        {
          status: PostStatus.SCHEDULED,
          scheduledAt: LessThan(before),
        },
        // Failed posts that can be retried (retryCount < MAX_RETRY_COUNT)
        {
          status: PostStatus.FAILED,
          retryCount: LessThan(MAX_RETRY_COUNT),
          scheduledAt: LessThan(before),
        },
      ],
      relations: ['media', 'socialAccount'],
      order: { scheduledAt: 'ASC' },
    }

    if (options?.includePublications) {
      findOptions.relations = [...(findOptions.relations || []), 'publications']
    }

    const posts = await repo.find(findOptions)

    // Additional filter: exclude failed posts that have exceeded retry count
    return posts.filter(post => {
      if (post.status === PostStatus.FAILED && post.retryCount >= MAX_RETRY_COUNT) {
        return false
      }
      return true
    })
  }

  async findByParentId(parentId: string, options?: FindPostOptions): Promise<Post[]> {
    const repo = this.getRepository()

    const findOptions: any = {
      where: { parentPostId: parentId },
      order: { commentDelayMinutes: 'ASC' },
    }

    if (options?.includeMedia) {
      findOptions.relations = [...(findOptions.relations || []), 'media']
    }

    if (options?.includePublications) {
      findOptions.relations = [...(findOptions.relations || []), 'publications']
    }

    if (options?.includeSocialAccount) {
      findOptions.relations = [...(findOptions.relations || []), 'socialAccount']
    }

    return await repo.find(findOptions)
  }

  create(data: CreatePostData): Post {
    const repo = this.getRepository()
    const post = new Post()
    post.userId = data.userId
    post.socialAccountId = data.socialAccountId ?? null
    post.content = data.content ?? ''
    post.contentType = data.contentType
    post.status = data.status
    post.scheduledAt = data.scheduledAt ?? new Date()
    post.parentPostId = data.parentPostId ?? null
    post.commentDelayMinutes = data.commentDelayMinutes ?? null
    return post
  }

  async save(post: Post): Promise<Post> {
    const repo = this.getRepository()
    return await repo.save(post)
  }

  async updateStatus(id: string, status: PostStatus, metadata?: StatusUpdateMetadata): Promise<void> {
    const repo = this.getRepository()

    const updateData: Record<string, unknown> = { status }

    if (metadata?.publishedAt) {
      updateData.publishedAt = metadata.publishedAt
    }

    if (metadata?.errorMessage) {
      updateData.errorMessage = metadata.errorMessage
    }

    await repo.update(id, updateData)
  }

  async delete(id: string): Promise<void> {
    const repo = this.getRepository()
    await repo.delete(id)
  }
}
