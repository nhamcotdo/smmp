/**
 * Content parsing utilities for social media posts
 */

import type { ContentType } from '@prisma/client'
import { CONTENT_TYPE } from '@/lib/constants'

/**
 * Validate media URL with hostname-aware public accessibility check
 * Consolidates duplicated validation logic across endpoints
 * @param url - The URL to validate
 * @param contentType - The content type being validated
 * @returns Validation result with valid flag and optional error message
 */
export function validateMediaUrlForPublishing(
  url: string | undefined,
  contentType: ContentType
): { valid: boolean; error?: string } {
  if (!url) {
    // Text posts don't need URLs
    if (contentType === CONTENT_TYPE.TEXT) {
      return { valid: true }
    }
    return { valid: false, error: 'Media URL is required' }
  }

  const ownHostname = getOwnHostname()
  return validateMediaUrl(url, {
    allowOwnHost: true,
    ownHostname,
  })
}

/**
 * Validate that a URL is publicly accessible (not localhost, blob, or private IP)
 * @param url - URL to validate
 * @param options - Optional settings for validation
 * @returns Object with valid flag and optional error message
 */
export function validateMediaUrl(
  url: string,
  options?: { allowOwnHost?: boolean; ownHostname?: string }
): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url)

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' }
    }

    const hostname = parsedUrl.hostname.toLowerCase()

    // If configured, allow the application's own hostname (for /api/upload endpoint)
    if (options?.allowOwnHost && options?.ownHostname) {
      if (hostname === options.ownHostname || hostname.endsWith(`.${options.ownHostname}`)) {
        return { valid: true }
      }
    }

    // Reject localhost, private IPs, and local file URLs
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
      hostname === '[::1]'

    if (isLocalhost) {
      return { valid: false, error: 'URL must be publicly accessible, not localhost' }
    }

    // Reject blob: URLs
    if (url.startsWith('blob:')) {
      return { valid: false, error: 'Blob URLs are not supported by Threads API' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Extract own hostname from NEXT_PUBLIC_BASE_URL for validation
 * @returns Own hostname or undefined
 */
export function getOwnHostname(): string | undefined {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) return undefined
  try {
    return new URL(baseUrl).hostname
  } catch {
    return undefined
  }
}

/**
 * Common MIME types for images and videos
 */
const MIME_TYPES = {
  // Image formats
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
  // Video formats
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  m4v: 'video/x-m4v',
  ogv: 'video/ogg',
  ts: 'video/mp2t',
} as const

type MimeExtension = keyof typeof MIME_TYPES

/**
 * Detect MIME type from URL based on file extension
 * @param url - URL to parse
 * @returns MIME type or null if unknown
 */
export function detectMimeTypeFromUrl(url: string): string | null {
  try {
    // Remove query parameters and hash
    const cleanUrl = url.split(/[?#]/)[0]
    const extension = cleanUrl.split('.').pop()?.toLowerCase()

    if (extension && extension in MIME_TYPES) {
      return MIME_TYPES[extension as MimeExtension]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check if URL is an image based on extension
 * @param url - URL to check
 * @returns true if URL appears to be an image
 */
export function isImageUrl(url: string): boolean {
  const mimeType = detectMimeTypeFromUrl(url)
  return mimeType?.startsWith('image/') ?? false
}

/**
 * Check if URL is a video based on extension
 * @param url - URL to check
 * @returns true if URL appears to be a video
 */
export function isVideoUrl(url: string): boolean {
  const mimeType = detectMimeTypeFromUrl(url)
  return mimeType?.startsWith('video/') ?? false
}

/**
 * Extract hashtags from text content
 * @param text - Content to parse
 * @returns Array of hashtags without the # symbol
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) || []
  return matches.map((tag) => tag.substring(1))
}

/**
 * Extract mentions from text content
 * @param text - Content to parse
 * @returns Array of mentions without the @ symbol
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w.]+/g) || []
  return matches.map((mention) => mention.substring(1))
}

/**
 * Extract all social metadata from text
 * @param text - Content to parse
 * @returns Object with hashtags and mentions
 */
export function extractSocialMetadata(text: string): {
  hashtags: string[]
  mentions: string[]
} {
  return {
    hashtags: extractHashtags(text),
    mentions: extractMentions(text),
  }
}
