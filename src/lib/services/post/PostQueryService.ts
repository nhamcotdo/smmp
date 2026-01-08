import { IUnitOfWork } from '@/lib/interfaces'
import { Post, PostStatus, Platform, AccountStatus } from '@/database/entities'
import { FindPostOptions } from '@/lib/interfaces/repositories/IPost.repository'

export class PostQueryService {
  constructor(private uow: IUnitOfWork) {}

  async findDueForPublishing(before: Date): Promise<Post[]> {
    return await this.uow.posts.findDueForPublishing(before, {
      includeMedia: true,
      includePublications: true,
      includeSocialAccount: true,
    })
  }

  async batchLoadParentPosts(parentIds: string[]): Promise<Map<string, Post>> {
    if (parentIds.length === 0) {
      return new Map()
    }

    const parents = await this.uow.posts.findByIds(parentIds, {
      includePublications: true,
    })

    const map = new Map<string, Post>()
    for (const parent of parents) {
      map.set(parent.id, parent)
    }
    return map
  }

  async getSocialAccountForPost(post: Post): Promise<{ account: any; replyToId?: string } | null> {
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
        return null
      }

      socialAccount = accounts[0]
    }

    let replyToId: string | undefined

    if (post.parentPostId) {
      const parentPost = await this.uow.posts.findById(post.parentPostId, {
        includePublications: true,
      })

      if (!parentPost) {
        return null
      }

      if (parentPost.status === PostStatus.PUBLISHING) {
        return null
      }

      if (parentPost.status !== PostStatus.PUBLISHED) {
        return null
      }

      const parentPublication = parentPost.publications?.[0]
      if (!parentPublication?.platformPostId) {
        return null
      }

      replyToId = parentPublication.platformPostId
    }

    return { account: socialAccount, replyToId }
  }
}
