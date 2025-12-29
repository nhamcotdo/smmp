/**
 * Platform enumeration for supported social media platforms
 * Extensible for future platform additions
 */
export enum Platform {
  THREADS = 'threads',
  INSTAGRAM = 'instagram',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
  TIKTOK = 'tiktok',
}

/**
 * Social account connection status
 * Tracks the authentication state of connected accounts
 */
export enum AccountStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error',
  PENDING = 'pending',
}

/**
 * Post publication status
 * Tracks the lifecycle of a social media post
 */
export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Content type enumeration
 * Defines the format of social media content
 */
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  CAROUSEL = 'carousel',
  STORY = 'story',
  REEL = 'reel',
  MIXED = 'mixed',
}

/**
 * User role enumeration
 * Defines user permissions within the platform
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
}

/**
 * Account health status
 * Monitors the overall health of connected accounts
 */
export enum AccountHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * Media type enumeration
 * Defines types of media attachments
 */
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  GIF = 'gif',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

/**
 * Post engagement metrics aggregation period
 */
export enum MetricsPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}
