import { DataSource } from 'typeorm'
import { PostPublication } from '@/database/entities/PostPublication.entity'
import { Platform } from '@/database/entities/enums'
import {
  IPostPublicationRepository,
  CreatePublicationData,
} from '@/lib/interfaces/repositories/IPostPublication.repository'

export class TypeORMPostPublicationRepository implements IPostPublicationRepository {
  constructor(private dataSource: DataSource) {}

  private getRepository() {
    return this.dataSource.getRepository(PostPublication)
  }

  async findById(id: string): Promise<PostPublication | null> {
    const repo = this.getRepository()
    return await repo.findOne({ where: { id } })
  }

  async findByPostId(postId: string): Promise<PostPublication[]> {
    const repo = this.getRepository()
    return await repo.find({
      where: { postId },
      order: { publishedAt: 'DESC' },
    })
  }

  async findByPlatformPostId(platformPostId: string): Promise<PostPublication | null> {
    const repo = this.getRepository()
    return await repo.findOne({ where: { platformPostId } })
  }

  create(data: CreatePublicationData): PostPublication {
    const repo = this.getRepository()
    const publication = new PostPublication()
    publication.postId = data.postId
    publication.socialAccountId = data.socialAccountId
    publication.platform = data.platform
    publication.platformPostId = data.platformPostId
    publication.platformPostUrl = data.platformUrl
    publication.publishedAt = data.publishedAt
    publication.metadata = data.metadata || {}
    publication.status = 'PUBLISHED' as any
    return publication
  }

  async save(publication: PostPublication): Promise<PostPublication> {
    const repo = this.getRepository()
    return await repo.save(publication)
  }

  async delete(id: string): Promise<void> {
    const repo = this.getRepository()
    await repo.delete(id)
  }
}
