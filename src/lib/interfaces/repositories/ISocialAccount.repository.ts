import { SocialAccount } from '@/database/entities/SocialAccount.entity'
import { Platform, AccountStatus } from '@/database/entities/enums'

export interface ISocialAccountRepository {
  findById(id: string): Promise<SocialAccount | null>
  findByIds(ids: string[]): Promise<SocialAccount[]>
  findByUserId(userId: string): Promise<SocialAccount[]>
  findByUserIdAndPlatform(userId: string, platform: Platform): Promise<SocialAccount[]>
  findByUserIdAndPlatformAndPlatformUserId(
    userId: string,
    platform: Platform,
    platformUserId: string
  ): Promise<SocialAccount | null>
  findActiveByPlatform(platform: Platform): Promise<SocialAccount[]>
  findExpiredTokens(before: Date): Promise<SocialAccount[]>
  create(data: CreateSocialAccountData): SocialAccount
  save(account: SocialAccount): Promise<SocialAccount>
  update(id: string, data: Partial<SocialAccount>): Promise<void>
  delete(id: string): Promise<void>
}

export interface CreateSocialAccountData {
  userId: string
  platform: Platform
  platformUserId: string
  username: string
  displayName?: string
  avatar?: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date
  status?: AccountStatus
}
