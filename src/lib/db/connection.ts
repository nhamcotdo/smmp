import 'reflect-metadata'
import { DataSource, DataSourceOptions } from 'typeorm'

// Import entities directly
import { User } from '../../database/entities/User.entity'
import { SocialAccount } from '../../database/entities/SocialAccount.entity'
import { RefreshToken } from '../../database/entities/RefreshToken.entity'
import { Post } from '../../database/entities/Post.entity'
import { PostPublication } from '../../database/entities/PostPublication.entity'
import { Media } from '../../database/entities/Media.entity'
import { Analytics } from '../../database/entities/Analytics.entity'
import { UploadedMedia } from '../../database/entities/UploadedMedia.entity'

declare global {
  // eslint-disable-next-line no-var
  var __typeorm__: DataSource | undefined
}

async function createDataSource(): Promise<DataSource> {
  const options: DataSourceOptions = {
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
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
  }

  if (process.env.DATABASE_URL) {
    return new DataSource({
      ...options,
      url: process.env.DATABASE_URL,
    } as DataSourceOptions)
  }

  return new DataSource(options)
}

export async function getConnection(): Promise<DataSource> {
  if (global.__typeorm__) {
    return global.__typeorm__
  }

  const dataSource = await createDataSource()

  if (!dataSource.isInitialized) {
    await dataSource.initialize()
    console.log('Database connection established')
  }

  global.__typeorm__ = dataSource
  return dataSource
}

export async function closeConnection(): Promise<void> {
  if (global.__typeorm__?.isInitialized) {
    await global.__typeorm__.destroy()
    global.__typeorm__ = undefined
    console.log('Database connection closed')
  }
}
