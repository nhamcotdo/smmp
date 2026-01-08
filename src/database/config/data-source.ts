import { DataSource } from 'typeorm'
import { User } from '../entities/User.entity'
import { SocialAccount } from '../entities/SocialAccount.entity'
import { RefreshToken } from '../entities/RefreshToken.entity'
import { Post } from '../entities/Post.entity'
import { PostPublication } from '../entities/PostPublication.entity'
import { Media } from '../entities/Media.entity'
import { Analytics } from '../entities/Analytics.entity'
import { UploadedMedia } from '../entities/UploadedMedia.entity'
import { createDatabaseConfig } from '@/lib/utils'
import { IncreaseAvatarLength1704600000000 } from '../migrations/1704600000000-IncreaseAvatarLength'
import { AddSocialAccountIdToPosts1704600000001 } from '../migrations/1704600000001-AddSocialAccountIdToPosts'
import { AddPostParentRelation1704600000002 } from '../migrations/1704600000002-AddPostParentRelation'

export const AppDataSource = new DataSource(
  createDatabaseConfig({
    entities: [
      User,
      SocialAccount,
      RefreshToken,
      Post,
      PostPublication,
      Media,
      Analytics,
      UploadedMedia,
    ],
    migrations: [
      IncreaseAvatarLength1704600000000,
      AddSocialAccountIdToPosts1704600000001,
      AddPostParentRelation1704600000002,
    ],
    synchronize: false, // Always false when using migrations
    logging: process.env.NODE_ENV === 'development',
  })
)

// For DATABASE_URL support
if (process.env.DATABASE_URL) {
  AppDataSource.setOptions({
    url: process.env.DATABASE_URL,
  } as Partial<import('typeorm').DataSourceOptions>)
}
