import 'reflect-metadata'
import { DataSource, DataSourceOptions } from 'typeorm'
import path from 'path'

declare global {
  // eslint-disable-next-line no-var
  var __typeorm__: DataSource | undefined
}

/**
 * Dynamically import entities using absolute paths to avoid circular dependencies
 * and ensure consistent resolution across different environments (local, prod, Docker).
 */
async function loadEntities() {
  // Get the project root directory - works in all environments
  const projectRoot = process.env.PWD || process.cwd()

  // Build absolute path to entities directory
  const entitiesDir = path.join(projectRoot, 'src', 'database', 'entities')

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
    import(path.join(entitiesDir, 'User.entity.ts')),
    import(path.join(entitiesDir, 'SocialAccount.entity.ts')),
    import(path.join(entitiesDir, 'RefreshToken.entity.ts')),
    import(path.join(entitiesDir, 'Post.entity.ts')),
    import(path.join(entitiesDir, 'PostPublication.entity.ts')),
    import(path.join(entitiesDir, 'Media.entity.ts')),
    import(path.join(entitiesDir, 'Analytics.entity.ts')),
    import(path.join(entitiesDir, 'UploadedMedia.entity.ts')),
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
