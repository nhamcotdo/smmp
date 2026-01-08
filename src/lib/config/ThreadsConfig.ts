export interface ThreadsConfig {
  appId: string
  appSecret: string
  redirectUri: string
  apiHost: string
}

export interface DatabaseConfig {
  host: string
  port: number
  username: string
  password: string
  database: string
  ssl: boolean
}

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicDomain?: string
}

export interface AppConfig {
  port: number
  host: string
  nodeEnv: string
  isProduction: boolean
  isDevelopment: boolean
}

export interface Config {
  database: DatabaseConfig
  threads: ThreadsConfig
  r2: R2Config
  app: AppConfig
}

export class ConfigLoader {
  load(): Config {
    return {
      database: this.loadDatabaseConfig(),
      threads: this.loadThreadsConfig(),
      r2: this.loadR2Config(),
      app: this.loadAppConfig(),
    }
  }

  private loadDatabaseConfig(): DatabaseConfig {
    return {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'smmp',
      ssl: process.env.NODE_ENV === 'production',
    }
  }

  private loadThreadsConfig(): ThreadsConfig {
    const appId = process.env.THREADS_APP_ID
    const appSecret = process.env.THREADS_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error('THREADS_APP_ID and THREADS_APP_SECRET are required')
    }

    return {
      appId,
      appSecret,
      redirectUri: process.env.THREADS_REDIRECT_URI || 'http://localhost:3000/api/channels/threads/callback',
      apiHost: 'https://graph.threads.net',
    }
  }

  private loadR2Config(): R2Config {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucketName = process.env.R2_BUCKET_NAME

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are required')
    }

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicDomain: process.env.R2_PUBLIC_DOMAIN,
    }
  }

  private loadAppConfig(): AppConfig {
    const nodeEnv = process.env.NODE_ENV || 'development'
    return {
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST || 'localhost',
      nodeEnv,
      isProduction: nodeEnv === 'production',
      isDevelopment: nodeEnv === 'development',
    }
  }
}

export class ConfigProvider {
  private config: Config

  constructor(config?: Config) {
    this.config = config || new ConfigLoader().load()
  }

  get threads(): ThreadsConfig {
    return this.config.threads
  }

  get database(): DatabaseConfig {
    return this.config.database
  }

  get r2(): R2Config {
    return this.config.r2
  }

  get app(): AppConfig {
    return this.config.app
  }

  static forTest(overrideConfig: Partial<Config>): ConfigProvider {
    const defaults = new ConfigLoader().load()
    return new ConfigProvider({
      ...defaults,
      ...overrideConfig,
    })
  }
}
