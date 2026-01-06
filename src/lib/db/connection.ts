import 'reflect-metadata'
import { DataSource, DataSourceOptions } from 'typeorm'

declare global {
  // eslint-disable-next-line no-var
  var __typeorm__: DataSource | undefined
}

/**
 * Dynamically import entities to avoid circular dependency issues.
 * All entities must be listed here for TypeORM to recognize them.
 * This approach allows entities to reference each other without import cycles.
 */
async function loadEntities() {
  const [
    { User },
    { SocialAccount },
    { RefreshToken },
    { Post },
    { PostPublication },
    { Media },
    { Analytics },
    { UploadedMedia },
  ] = await Promise.all([
    import('../../database/entities/User.entity'),
    import('../../database/entities/SocialAccount.entity'),
    import('../../database/entities/RefreshToken.entity'),
    import('../../database/entities/Post.entity'),
    import('../../database/entities/PostPublication.entity'),
    import('../../database/entities/Media.entity'),
    import('../../database/entities/Analytics.entity'),
    import('../../database/entities/UploadedMedia.entity'),
  ])

  return [User, SocialAccount, RefreshToken, Post, PostPublication, Media, Analytics, UploadedMedia]
}

async function createDataSource(): Promise<DataSource> {
  const entities = await loadEntities()

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
    entities,
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
