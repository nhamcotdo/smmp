import { Post, PostStatus, Platform, AccountStatus } from '@/database/entities'
import { IUnitOfWork } from '@/lib/interfaces'
import { ValidationErrorMessage } from '@/lib/strategies/IPostPublishingStrategy'

export class PostValidatorService {
  constructor(private uow: IUnitOfWork) {}

  async validateParentPost(post: Post): Promise<ValidationErrorMessage[]> {
    const errors: ValidationErrorMessage[] = []

    if (!post.parentPostId) {
      return errors
    }

    const parentPost = await this.uow.posts.findById(post.parentPostId, {
      includePublications: true,
    })

    if (!parentPost) {
      errors.push({
        field: 'parentPostId',
        message: `Parent post ${post.parentPostId} not found`,
      })
      return errors
    }

    if (parentPost.status === PostStatus.PUBLISHING) {
      errors.push({
        field: 'parentPostId',
        message: 'Parent post is currently being published, will retry later',
      })
      return errors
    }

    if (parentPost.status !== PostStatus.PUBLISHED) {
      if (parentPost.status === PostStatus.FAILED) {
        errors.push({
          field: 'parentPostId',
          message: `Parent post failed: ${parentPost.errorMessage || 'Unknown error'}`,
        })
      } else {
        errors.push({
          field: 'parentPostId',
          message: `Parent post not published (status: ${parentPost.status})`,
        })
      }
    }

    const parentPublication = parentPost.publications?.[0]
    if (!parentPublication?.platformPostId) {
      errors.push({
        field: 'parentPostId',
        message: 'Parent post has no platform ID',
      })
    }

    return errors
  }

  validateContent(post: Post): ValidationErrorMessage[] {
    const errors: ValidationErrorMessage[] = []

    if (!post.content?.trim()) {
      errors.push({
        field: 'content',
        message: 'Post content is empty',
      })
    }

    return errors
  }

  async validateSocialAccount(post: Post): Promise<{ valid: boolean; account?: any; replyToId?: string }> {
    let socialAccount = post.socialAccount || null

    if (socialAccount && socialAccount.status !== AccountStatus.ACTIVE) {
      socialAccount = null
    }

    if (!socialAccount) {
      const accounts = await this.uow.socialAccounts.findByUserIdAndPlatform(
        post.userId,
        Platform.THREADS
      )

      if (accounts.length === 0) {
        return { valid: false }
      }

      socialAccount = accounts[0]
    }

    let replyToId: string | undefined

    if (post.parentPostId) {
      const parentPost = await this.uow.posts.findById(post.parentPostId, {
        includePublications: true,
      })

      if (parentPost?.publications?.[0]?.platformPostId) {
        replyToId = parentPost.publications[0].platformPostId
      }
    }

    return { valid: true, account: socialAccount, replyToId }
  }
}
