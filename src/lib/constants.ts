/**
 * Application-wide constants
 * Centralized magic numbers and configuration values
 */

/**
 * Scheduled comments configuration
 */
export const SCHEDULED_COMMENTS = {
  MAX_ALLOWED: 10,
} as const

/**
 * Carousel media configuration
 */
export const CAROUSEL = {
  MIN_ITEMS: 2,
  MAX_ITEMS: 20,
} as const

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  DEFAULT_OFFSET: 0,
} as const

/**
 * Timezone configuration
 */
export const TIMEZONE = {
  UTC7_OFFSET_HOURS: 7,
} as const

/**
 * Threads API polling configuration
 */
export const THREADS_POLLING = {
  DEFAULT_MAX_WAIT_MS: 60000,
  INITIAL_POLL_INTERVAL_MS: 5000,
  MAX_POLL_INTERVAL_MS: 10000,
  BACKOFF_MULTIPLIER: 1.5,
  TEXT_POST_MAX_WAIT_MS: 30000,
  IMAGE_POST_MAX_WAIT_MS: 30000,
  VIDEO_POST_MAX_WAIT_MS: 1200000,
  MAX_CONSECUTIVE_FAILURES: 10,
} as const

/**
 * Time conversion multipliers
 */
export const TIME_MULTIPLIERS = {
  MINUTES_TO_MS: 60 * 1000,
  HOURS_TO_MS: 60 * 60 * 1000,
  DAYS_TO_MS: 24 * 60 * 60 * 1000,
} as const

/**
 * Scheduled post publisher configuration
 */
export const SCHEDULED_POST_PUBLISHER = {
  MAX_RETRY_COUNT: 2,
  PUBLISHING_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes - reset stuck PUBLISHING posts
} as const

/**
 * Media proxy configuration
 */
export const MEDIA_PROXY = {
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE: 50 * 1024 * 1024, // 50MB
  DOWNLOAD_TIMEOUT_MS: 30000, // 30s
  URL_HASH_LENGTH: 16,
  PRESIGNED_GET_URL_EXPIRY_SECONDS: 7 * 24 * 3600, // 7 days
  PRESIGNED_PUT_URL_EXPIRY_SECONDS: 3600, // 1 hour
  URL_REGENERATION_BUFFER_MS: 60 * 60 * 1000, // 1 hour buffer
  URL_REGENERATION_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
} as const

/**
 * Default MIME types for media fallbacks
 */
export const MIME_TYPE = {
  IMAGE_JPEG: 'image/jpeg',
  VIDEO_MP4: 'video/mp4',
} as const

/**
 * Valid Threads reply control values
 */
export const VALID_REPLY_CONTROLS = new Set<string>([
  'EVERYONE',
  'ACCOUNTS_YOU_FOLLOW',
  'MENTIONED_ONLY',
  'PARENT_POST_AUTHOR_ONLY',
  'FOLLOWERS_ONLY',
]) as Set<string>

/**
 * Platform constants
 */
export const PLATFORM = {
  THREADS: 'THREADS',
  INSTAGRAM: 'INSTAGRAM',
  TWITTER: 'TWITTER',
  FACEBOOK: 'FACEBOOK',
  LINKEDIN: 'LINKEDIN',
  TIKTOK: 'TIKTOK',
} as const

export type PlatformValue = typeof PLATFORM[keyof typeof PLATFORM]

/**
 * Account status constants (matches Prisma AccountStatus enum)
 */
export const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  ERROR: 'ERROR',
  PENDING: 'PENDING',
} as const

export type AccountStatusValue = typeof ACCOUNT_STATUS[keyof typeof ACCOUNT_STATUS]

/**
 * Account health constants (matches Prisma AccountHealth enum)
 */
export const ACCOUNT_HEALTH = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNHEALTHY: 'UNHEALTHY',
  UNKNOWN: 'UNKNOWN',
} as const

export type AccountHealthValue = typeof ACCOUNT_HEALTH[keyof typeof ACCOUNT_HEALTH]

/**
 * Post status constants (matches Prisma PostStatus enum)
 */
export const POST_STATUS = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  PUBLISHING: 'PUBLISHING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const

export type PostStatusValue = typeof POST_STATUS[keyof typeof POST_STATUS]

/**
 * JWT token expiry defaults (in milliseconds)
 */
export const JWT_EXPIRY = {
  DEFAULT_ACCESS: 15 * 60 * 1000,  // 15 minutes
  DEFAULT_REFRESH: 7 * 24 * 60 * 60 * 1000,  // 7 days
} as const

/**
 * UploadedMedia status constants (matches Prisma UploadedMediaStatus enum)
 * Note: Database stores these as lowercase strings
 */
export const UPLOADED_MEDIA_STATUS = {
  ACTIVE: 'ACTIVE',
  DELETED: 'DELETED',
  EXPIRED: 'EXPIRED',
} as const

export type UploadedMediaStatusValue = typeof UPLOADED_MEDIA_STATUS[keyof typeof UPLOADED_MEDIA_STATUS]

/**
 * RefreshToken status constants (matches Prisma RefreshTokenStatus enum)
 */
export const REFRESH_TOKEN_STATUS = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const

export type RefreshTokenStatusValue = typeof REFRESH_TOKEN_STATUS[keyof typeof REFRESH_TOKEN_STATUS]

/**
 * ContentType constants (matches Prisma ContentType enum)
 */
export const CONTENT_TYPE = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  CAROUSEL: 'CAROUSEL',
} as const

export type ContentTypeValue = typeof CONTENT_TYPE[keyof typeof CONTENT_TYPE]

/**
 * MediaType constants (matches Prisma MediaType enum)
 */
export const MEDIA_TYPE = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
} as const

export type MediaTypeValue = typeof MEDIA_TYPE[keyof typeof MEDIA_TYPE]

/**
 * Cookie configuration constants
 */
export const COOKIE_NAMES = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
} as const

export const COOKIE_SAME_SITE = {
  STRICT: 'strict',
  LAX: 'lax',
  NONE: 'none',
} as const

/**
 * OAuth grant type constants
 */
export const OAUTH_GRANT_TYPE = {
  AUTHORIZATION_CODE: 'authorization_code',
  TH_EXCHANGE_TOKEN: 'th_exchange_token',
  TH_REFRESH_TOKEN: 'th_refresh_token',
  CLIENT_CREDENTIALS: 'client_credentials',
} as const

/**
 * HTTP status code constants
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const

/**
 * Threads API container status constants
 */
export const THREADS_CONTAINER_STATUS = {
  FINISHED: 'FINISHED',
  IN_PROGRESS: 'IN_PROGRESS',
  ERROR: 'ERROR',
  EXPIRED: 'EXPIRED',
  PUBLISHED: 'PUBLISHED',
} as const

export type ThreadsContainerStatusValue = typeof THREADS_CONTAINER_STATUS[keyof typeof THREADS_CONTAINER_STATUS]

/**
 * Analytics metrics period constants (matches Prisma MetricsPeriod enum)
 */
export const METRICS_PERIOD = {
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const

export type MetricsPeriodValue = typeof METRICS_PERIOD[keyof typeof METRICS_PERIOD]

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  POST_EMPTY: 'Post must have content or media',
  MEDIA_MISSING_IMAGE: 'Image media not found for IMAGE post',
  MEDIA_MISSING_VIDEO: 'Video media not found for VIDEO post',
  CAROUSEL_MIN_ITEMS: 'Carousel must have at least 2 items',
  NO_ACTIVE_THREADS_ACCOUNT: 'No active Threads account found',
  MISSING_ACCESS_TOKEN: 'Social account access token is missing',
  PUBLISHING_FAILED: 'Failed to publish post - no platform post ID returned',
  MAX_RETRY_EXCEEDED: 'Maximum retry count exceeded',
  PARENT_POST_NOT_FOUND: 'Parent post not found',
  PARENT_POST_NOT_PUBLISHED: 'Parent post not published',
  PARENT_PUBLISHING: 'Parent post is currently being published',
} as const

/**
 * Douyin URL patterns
 */
export const DOUYIN_URL_PATTERN = /https?:\/\/v\.douyin\.com\/[a-zA-Z0-9_\-\/]+/gi
