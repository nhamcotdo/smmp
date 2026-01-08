import { DataSource, DataSourceOptions } from 'typeorm'

export interface DatabaseConfigOverrides {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  migrations?: any[]
  synchronize?: boolean
  logging?: boolean | 'all' | string[]
  extra?: Record<string, unknown>
}

/**
 * Safely parse a string to a number, returning the default value if parsing fails
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Create TypeORM DataSource options with environment-based configuration
 * Centralizes database configuration to prevent duplication
 */
export function createDatabaseConfig(overrides: DatabaseConfigOverrides = {}): DataSourceOptions {
  const baseConfig = {
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseNumber(process.env.DATABASE_PORT, 5432),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'smmp_db',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    extra: {
      max: parseNumber(process.env.DATABASE_POOL_MAX, 10),
      min: parseNumber(process.env.DATABASE_POOL_MIN, 2),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...overrides.extra,
    },
    ...overrides,
  } as DataSourceOptions

  // Handle DATABASE_URL environment variable
  if (process.env.DATABASE_URL) {
    return {
      ...baseConfig,
      url: process.env.DATABASE_URL,
    } as DataSourceOptions
  }

  return baseConfig
}

/**
 * Execute database operation with proper connection handling
 */
export async function withDatabaseConnection<T>(
  dataSource: DataSource,
  operation: (dataSource: DataSource) => Promise<T>
): Promise<T> {
  try {
    await dataSource.initialize()
    const result = await operation(dataSource)
    await dataSource.destroy()
    return result
  } catch (error) {
    console.error('Database operation failed:', error)
    await dataSource.destroy().catch(() => {})
    throw error
  }
}