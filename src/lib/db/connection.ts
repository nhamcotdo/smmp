import 'reflect-metadata'
import { DataSource } from 'typeorm'

// Import entities in the correct order to resolve relations
// Entities with fewer dependencies should be imported first
import { RefreshToken } from '../../database/entities/RefreshToken.entity'
import { SocialAccount } from '../../database/entities/SocialAccount.entity'
import { UploadedMedia } from '../../database/entities/UploadedMedia.entity'
import { PostPublication } from '../../database/entities/PostPublication.entity'
import { Media } from '../../database/entities/Media.entity'
import { Analytics } from '../../database/entities/Analytics.entity'
import { Post } from '../../database/entities/Post.entity'
import { User } from '../../database/entities/User.entity'
import { createDatabaseConfig } from '../utils'

declare global {
  // eslint-disable-next-line no-var
  var __typeorm__: DataSource | undefined
}

async function createDataSource(): Promise<DataSource> {
  const config = createDatabaseConfig({
    entities: [
      // Import in dependency order - entities with fewer dependencies first
      RefreshToken,
      SocialAccount,
      UploadedMedia,
      PostPublication,
      Media,
      Analytics,
      Post,
      User,
    ],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  })

  return new DataSource(config)
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
