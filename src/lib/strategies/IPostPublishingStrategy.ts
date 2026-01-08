import { Post, SocialAccount } from '@/database/entities'
import { ContentType } from '@/database/entities/enums'
import type { ThreadsReplyControl } from '@/lib/types/threads'

export interface PublishContext {
  post: Post
  socialAccount: SocialAccount
  replyToId?: string
  ownHostname: string
}

export interface PublishResult {
  platformPostId: string
  platformPostUrl?: string
}

export interface IPostPublishingStrategy {
  readonly contentType: ContentType
  canHandle(post: Post): boolean
  validate(context: PublishContext): Promise<ValidationErrorMessage[]>
  publish(context: PublishContext): Promise<PublishResult>
}

export interface ValidationErrorMessage {
  field: string
  message: string
}

export class ValidationError extends Error {
  constructor(public errors: ValidationErrorMessage[]) {
    super(`Validation failed with ${errors.length} error(s)`)
    this.name = 'ValidationError'
  }
}
