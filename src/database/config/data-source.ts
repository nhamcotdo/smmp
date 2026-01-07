import { DataSource, DataSourceOptions } from 'typeorm'
import { User } from '../entities/User.entity'
import { SocialAccount } from '../entities/SocialAccount.entity'
import { RefreshToken } from '../entities/RefreshToken.entity'
import { Post } from '../entities/Post.entity'
import { PostPublication } from '../entities/PostPublication.entity'
import { Media } from '../entities/Media.entity'
import { Analytics } from '../entities/Analytics.entity'
import { UploadedMedia } from '../entities/UploadedMedia.entity'
import { Platform } from '../entities/enums'

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'smmp_db',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  extra: {
    max: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
    min: parseInt(process.env.DATABASE_POOL_MIN ?? '2', 10),
  },
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
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false, // Always false when using migrations
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
} as DataSourceOptions)

// For DATABASE_URL support
if (process.env.DATABASE_URL) {
  AppDataSource.setOptions({
    url: process.env.DATABASE_URL,
  } as DataSourceOptions)
}
