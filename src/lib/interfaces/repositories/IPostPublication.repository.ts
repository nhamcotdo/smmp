import { PostPublication } from '@/database/entities/PostPublication.entity'
import { Platform } from '@/database/entities/enums'

export interface IPostPublicationRepository {
  findById(id: string): Promise<PostPublication | null>
  findByPostId(postId: string): Promise<PostPublication[]>
  findByPlatformPostId(platformPostId: string): Promise<PostPublication | null>
  create(data: CreatePublicationData): PostPublication
  save(publication: PostPublication): Promise<PostPublication>
  delete(id: string): Promise<void>
}

export interface CreatePublicationData {
  postId: string
  socialAccountId: string
  platform: Platform
  platformPostId: string
  platformUrl: string
  publishedAt: Date
  metadata?: Record<string, unknown>
}
