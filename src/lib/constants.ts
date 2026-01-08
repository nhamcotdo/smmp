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
  INITIAL_POLL_INTERVAL_MS: 1000,
  MAX_POLL_INTERVAL_MS: 5000,
  TEXT_POST_MAX_WAIT_MS: 30000,
  IMAGE_POST_MAX_WAIT_MS: 30000,
  VIDEO_POST_MAX_WAIT_MS: 60000,
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
 * Valid Threads reply control values
 */
export const VALID_REPLY_CONTROLS = new Set<string>([
  'EVERYONE',
  'ACCOUNTS_YOU_FOLLOW',
  'MENTIONED_ONLY',
  'PARENT_POST_AUTHOR_ONLY',
  'FOLLOWERS_ONLY',
]) as Set<string>
