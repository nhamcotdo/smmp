import { EntityRepository, Repository } from 'typeorm'
import { User } from '../entities/User.entity'
import { UserRole } from '../entities/enums'

@EntityRepository(User)
export class UserRepository extends Repository<User> {
  /**
   * Find user by email with password included
   */
  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'name', 'role', 'isActive'],
    })
  }

  /**
   * Find user by email without password
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({
      where: { email },
      relations: ['socialAccounts', 'posts'],
    })
  }

  /**
   * Find active users by role
   */
  async findActiveByRole(role: UserRole): Promise<User[]> {
    return this.find({
      where: { role, isActive: true },
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.update(userId, { lastLoginAt: new Date() })
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string) {
    const user = await this.findOne({
      where: { id: userId },
      relations: ['socialAccounts', 'posts'],
    })

    if (!user) {
      return null
    }

    return {
      socialAccountsCount: user.socialAccounts.length,
      postsCount: user.posts.length,
      scheduledPostsCount: user.posts.filter(
        (post) => post.status === 'scheduled'
      ).length,
      publishedPostsCount: user.posts.filter(
        (post) => post.status === 'published'
      ).length,
    }
  }
}
