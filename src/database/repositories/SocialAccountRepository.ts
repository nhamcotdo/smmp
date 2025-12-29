import { EntityRepository, Repository } from 'typeorm'
import { SocialAccount } from '../entities/SocialAccount.entity'
import { AccountStatus, Platform } from '../entities/enums'

@EntityRepository(SocialAccount)
export class SocialAccountRepository extends Repository<SocialAccount> {
  /**
   * Find active social accounts for a user
   */
  async findActiveAccounts(userId: string): Promise<SocialAccount[]> {
    return this.find({
      where: { userId, status: AccountStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    })
  }

  /**
   * Find account by user and platform
   */
  async findByUserAndPlatform(
    userId: string,
    platform: Platform
  ): Promise<SocialAccount | null> {
    return this.findOne({
      where: { userId, platform },
    })
  }

  /**
   * Find accounts that need token refresh
   */
  async findAccountsNeedingRefresh(): Promise<SocialAccount[]> {
    const now = new Date()
    return this.createQueryBuilder('account')
      .where('account.status = :status', { status: AccountStatus.ACTIVE })
      .andWhere('account.tokenExpiresAt IS NOT NULL')
      .andWhere('account.tokenExpiresAt <= :expireBuffer', {
        expireBuffer: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
      })
      .getMany()
  }

  /**
   * Update account status
   */
  async updateAccountStatus(
    accountId: string,
    status: AccountStatus
  ): Promise<void> {
    await this.update(accountId, { status })
  }

  /**
   * Update token information
   */
  async updateTokens(
    accountId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    await this.update(accountId, {
      accessToken,
      refreshToken,
      tokenExpiresAt: expiresAt,
      status: AccountStatus.ACTIVE,
    })
  }

  /**
   * Update account statistics
   */
  async updateStats(
    accountId: string,
    stats: {
      followersCount?: number
      followingCount?: number
      postsCount?: number
    }
  ): Promise<void> {
    await this.update(accountId, stats)
  }

  /**
   * Update last posted timestamp
   */
  async updateLastPosted(accountId: string): Promise<void> {
    await this.update(accountId, { lastPostedAt: new Date() })
  }

  /**
   * Get accounts by platform
   */
  async findByPlatform(platform: Platform): Promise<SocialAccount[]> {
    return this.find({
      where: { platform, status: AccountStatus.ACTIVE },
      relations: ['user'],
    })
  }

  /**
   * Find expired accounts
   */
  async findExpiredAccounts(): Promise<SocialAccount[]> {
    const now = new Date()
    return this.createQueryBuilder('account')
      .where('account.status = :status', { status: AccountStatus.ACTIVE })
      .andWhere('account.expiresAt IS NOT NULL')
      .andWhere('account.expiresAt <= :now', { now })
      .getMany()
  }
}
