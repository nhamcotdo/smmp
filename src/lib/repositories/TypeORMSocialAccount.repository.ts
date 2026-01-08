import { DataSource } from 'typeorm'
import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { Platform, AccountStatus } from '@/database/entities/enums'
import { LessThan } from 'typeorm'
import {
  ISocialAccountRepository,
  CreateSocialAccountData,
} from '@/lib/interfaces/repositories/ISocialAccount.repository'

export class TypeORMSocialAccountRepository implements ISocialAccountRepository {
  constructor(private dataSource: DataSource) {}

  private getRepository() {
    return this.dataSource.getRepository(SocialAccount)
  }

  async findById(id: string): Promise<SocialAccount | null> {
    const repo = this.getRepository()
    return await repo.findOne({ where: { id } })
  }

  async findByIds(ids: string[]): Promise<SocialAccount[]> {
    if (ids.length === 0) return []

    const repo = this.getRepository()
    return await repo.findByIds(ids)
  }

  async findByUserId(userId: string): Promise<SocialAccount[]> {
    const repo = this.getRepository()
    return await repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    })
  }

  async findByUserIdAndPlatform(userId: string, platform: Platform): Promise<SocialAccount[]> {
    const repo = this.getRepository()
    return await repo.find({
      where: { userId, platform },
      order: { createdAt: 'DESC' },
    })
  }

  async findByUserIdAndPlatformAndPlatformUserId(
    userId: string,
    platform: Platform,
    platformUserId: string
  ): Promise<SocialAccount | null> {
    const repo = this.getRepository()
    return await repo.findOne({
      where: { userId, platform, platformUserId },
    })
  }

  async findActiveByPlatform(platform: Platform): Promise<SocialAccount[]> {
    const repo = this.getRepository()
    return await repo.find({
      where: { platform, status: AccountStatus.ACTIVE },
    })
  }

  async findExpiredTokens(before: Date): Promise<SocialAccount[]> {
    const repo = this.getRepository()
    return await repo.find({
      where: [{ tokenExpiresAt: LessThan(before) } as any],
    })
  }

  create(data: CreateSocialAccountData): SocialAccount {
    const repo = this.getRepository()
    return repo.create({
      userId: data.userId,
      platform: data.platform,
      platformUserId: data.platformUserId,
      username: data.username,
      displayName: data.displayName || data.username,
      avatar: data.avatar,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
      status: data.status || AccountStatus.PENDING,
    })
  }

  async save(account: SocialAccount): Promise<SocialAccount> {
    const repo = this.getRepository()
    return await repo.save(account)
  }

  async update(id: string, data: Partial<SocialAccount>): Promise<void> {
    const repo = this.getRepository()
    // Exclude relations when updating
    const { user, publications, posts, ...updateData } = data as any
    await repo.update(id, updateData)
  }

  async delete(id: string): Promise<void> {
    const repo = this.getRepository()
    await repo.delete(id)
  }
}
