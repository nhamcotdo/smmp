import { Post } from '@/database/entities/Post.entity'
import { PostStatus, ContentType } from '@/database/entities/enums'

export interface FindPostOptions {
  includeMedia?: boolean
  includePublications?: boolean
  includeSocialAccount?: boolean
}

export interface StatusUpdateMetadata {
  publishedAt?: Date
  errorMessage?: string
}

export interface IPostRepository {
  findById(id: string, options?: FindPostOptions): Promise<Post | null>
  findByIds(ids: string[], options?: FindPostOptions): Promise<Post[]>
  findByUserId(userId: string, options?: FindPostOptions): Promise<Post[]>
  findDueForPublishing(before: Date, options?: FindPostOptions): Promise<Post[]>
  findByParentId(parentId: string, options?: FindPostOptions): Promise<Post[]>
  create(data: CreatePostData): Post
  save(post: Post): Promise<Post>
  updateStatus(id: string, status: PostStatus, metadata?: StatusUpdateMetadata): Promise<void>
  delete(id: string): Promise<void>
}

export interface CreatePostData {
  userId: string
  socialAccountId?: string | null
  content?: string
  contentType: ContentType
  status: PostStatus
  scheduledAt?: Date | null
  parentPostId?: string | null
  commentDelayMinutes?: number | null
}
