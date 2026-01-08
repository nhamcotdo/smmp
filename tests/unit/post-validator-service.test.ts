import { describe, it, expect, vi } from 'vitest'
import { PostValidatorService } from '@/lib/services/post/PostValidatorService'
import { Post, PostStatus, Platform, AccountStatus } from '@/database/entities'
import type { IUnitOfWork } from '@/lib/interfaces'

describe('PostValidatorService', () => {
  describe('validateContent', () => {
    it('should return no errors for valid content', () => {
      const mockUow = {} as IUnitOfWork
      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.content = 'Valid post content'

      const errors = service.validateContent(post)

      expect(errors).toHaveLength(0)
    })

    it('should return error for empty content', () => {
      const mockUow = {} as IUnitOfWork
      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.content = ''

      const errors = service.validateContent(post)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('content')
      expect(errors[0].message).toBe('Post content is empty')
    })

    it('should return error for whitespace-only content', () => {
      const mockUow = {} as IUnitOfWork
      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.content = '   '

      const errors = service.validateContent(post)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('content')
      expect(errors[0].message).toBe('Post content is empty')
    })

    it('should return error for undefined content', () => {
      const mockUow = {} as IUnitOfWork
      const service = new PostValidatorService(mockUow)

      const post = new Post()
      ;(post as any).content = undefined

      const errors = service.validateContent(post)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('content')
      expect(errors[0].message).toBe('Post content is empty')
    })
  })

  describe('validateParentPost', () => {
    it('should return no errors when post has no parent', async () => {
      const mockUow = {} as IUnitOfWork
      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.parentPostId = null

      const errors = await service.validateParentPost(post)

      expect(errors).toHaveLength(0)
    })

    it('should return error when parent post not found', async () => {
      const mockUow = {
        posts: {
          findById: vi.fn().mockResolvedValue(null),
        },
      } as unknown as IUnitOfWork

      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.parentPostId = 'non-existent-id'

      const errors = await service.validateParentPost(post)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('parentPostId')
      expect(errors[0].message).toContain('not found')
    })

    it('should return error when parent post is publishing', async () => {
      const parentPost = new Post()
      parentPost.id = 'parent-id'
      parentPost.status = PostStatus.PUBLISHING
      parentPost.publications = []

      const mockUow = {
        posts: {
          findById: vi.fn().mockResolvedValue(parentPost),
        },
      } as unknown as IUnitOfWork

      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.parentPostId = 'parent-id'

      const errors = await service.validateParentPost(post)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('parentPostId')
      expect(errors[0].message).toContain('currently being published')
    })

    it('should return error when parent post failed', async () => {
      const parentPost = new Post()
      parentPost.id = 'parent-id'
      parentPost.status = PostStatus.FAILED
      parentPost.errorMessage = 'API error'
      parentPost.publications = []

      const mockUow = {
        posts: {
          findById: vi.fn().mockResolvedValue(parentPost),
        },
      } as unknown as IUnitOfWork

      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.parentPostId = 'parent-id'

      const errors = await service.validateParentPost(post)

      // Two errors: one for failed status, one for no platform post ID
      expect(errors).toHaveLength(2)
      expect(errors[0].field).toBe('parentPostId')
      expect(errors[0].message).toContain('failed')
      expect(errors[0].message).toContain('API error')
      expect(errors[1].field).toBe('parentPostId')
      expect(errors[1].message).toContain('no platform ID')
    })

    it('should return no errors when parent post is published', async () => {
      const parentPost = new Post()
      parentPost.id = 'parent-id'
      parentPost.status = PostStatus.PUBLISHED
      parentPost.publications = [
        {
          platformPostId: 'platform-id-123',
        } as any,
      ]

      const mockUow = {
        posts: {
          findById: vi.fn().mockResolvedValue(parentPost),
        },
      } as unknown as IUnitOfWork

      const service = new PostValidatorService(mockUow)

      const post = new Post()
      post.parentPostId = 'parent-id'

      const errors = await service.validateParentPost(post)

      expect(errors).toHaveLength(0)
    })
  })

  describe('validateSocialAccount', () => {
    it('should return valid when post has active social account', async () => {
      const socialAccount = {
        id: 'account-id',
        platformUserId: 'threads-user-123',
        status: AccountStatus.ACTIVE,
      }

      const post = new Post()
      post.socialAccount = socialAccount as any
      post.parentPostId = null

      const mockUow = {} as IUnitOfWork
      const service = new PostValidatorService(mockUow)

      const result = await service.validateSocialAccount(post)

      expect(result.valid).toBe(true)
      expect(result.account).toEqual(socialAccount)
    })

    it('should return invalid when no active accounts found', async () => {
      const post = new Post()
      post.userId = 'user-id'
      post.socialAccount = null
      post.parentPostId = null

      const mockUow = {
        socialAccounts: {
          findByUserIdAndPlatform: vi.fn().mockResolvedValue([]),
        },
      } as unknown as IUnitOfWork

      const service = new PostValidatorService(mockUow)

      const result = await service.validateSocialAccount(post)

      expect(result.valid).toBe(false)
      expect(result.account).toBeUndefined()
    })

    it('should return first active account when post has no account', async () => {
      const account1 = {
        id: 'account-1',
        platformUserId: 'threads-user-1',
        status: AccountStatus.ACTIVE,
      }

      const post = new Post()
      post.userId = 'user-id'
      post.socialAccount = null
      post.parentPostId = null

      const mockUow = {
        socialAccounts: {
          findByUserIdAndPlatform: vi.fn().mockResolvedValue([account1]),
        },
      } as unknown as IUnitOfWork

      const service = new PostValidatorService(mockUow)

      const result = await service.validateSocialAccount(post)

      expect(result.valid).toBe(true)
      expect(result.account).toEqual(account1)
    })

    it('should include replyToId when parent has platform post ID', async () => {
      const parentPost = new Post()
      parentPost.id = 'parent-id'
      parentPost.publications = [
        {
          platformPostId: 'platform-post-id-123',
        } as any,
      ]

      const account1 = {
        id: 'account-1',
        platformUserId: 'threads-user-1',
        status: AccountStatus.ACTIVE,
      }

      const post = new Post()
      post.userId = 'user-id'
      post.socialAccount = null
      post.parentPostId = 'parent-id'

      const mockUow = {
        socialAccounts: {
          findByUserIdAndPlatform: vi.fn().mockResolvedValue([account1]),
        },
        posts: {
          findById: vi.fn().mockResolvedValue(parentPost),
        },
      } as unknown as IUnitOfWork

      const service = new PostValidatorService(mockUow)

      const result = await service.validateSocialAccount(post)

      expect(result.replyToId).toBe('platform-post-id-123')
    })
  })
})
