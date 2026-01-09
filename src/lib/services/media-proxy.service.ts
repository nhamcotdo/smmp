/**
 * Media Proxy Service
 * Downloads media from third-party URLs (Douyin, TikTok, etc.) and uploads to R2
 * This is needed because Threads API cannot directly fetch from these protected URLs
 */

import { prisma } from '@/lib/db/connection'
import { generatePresignedUrl, getPublicUrlForKey } from '@/lib/services/r2-presigned.service'
import { MEDIA_PROXY, UPLOADED_MEDIA_STATUS, MEDIA_TYPE } from '@/lib/constants'
import { UploadedMediaStatus, UploadedMediaType } from '@prisma/client'

export interface ProxyResult {
  url: string
  r2Key: string
}

// Type for proxy media metadata
interface ProxyMediaMetadata extends Record<string, unknown> {
  originalUrl?: string
  proxiedAt?: string
  presignedUrlExpiresAt?: string
  lastRegeneratedAt?: string
  publicUrl?: string
}

const VALID_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

/**
 * Download media from URL and return as buffer with content type
 * Includes size validation, timeout, and MIME type detection
 */
async function downloadMedia(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MEDIA_PROXY.DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8,video/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.douyin.com/',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`)
    }

    // Check content-length header before downloading full body
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      const contentType = response.headers.get('content-type') || ''

      const maxSize = contentType.startsWith('video/') ? MEDIA_PROXY.MAX_VIDEO_SIZE : MEDIA_PROXY.MAX_IMAGE_SIZE

      if (size > maxSize) {
        throw new Error(
          `Media file too large: ${Math.round(size / 1024 / 1024)}MB exceeds maximum ${Math.round(maxSize / 1024 / 1024)}MB`
        )
      }
    }

    const buffer = await response.arrayBuffer()

    // Double-check actual buffer size
    const actualSize = buffer.byteLength
    const rawContentType = response.headers.get('content-type') || ''
    const maxSize = rawContentType.startsWith('video/') ? MEDIA_PROXY.MAX_VIDEO_SIZE : MEDIA_PROXY.MAX_IMAGE_SIZE

    if (actualSize > maxSize) {
      throw new Error(`Media file too large: ${Math.round(actualSize / 1024 / 1024)}MB`)
    }

    // Validate and normalize MIME type
    const mimeType = normalizeMimeType(rawContentType, buffer)

    // Validate against allowed types
    if (!VALID_MIME_TYPES.has(mimeType)) {
      throw new Error(
        `Invalid MIME type: ${mimeType}. Only ${Array.from(VALID_MIME_TYPES).join(', ')} are supported.`
      )
    }

    return { buffer, mimeType }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Download timeout after ${MEDIA_PROXY.DOWNLOAD_TIMEOUT_MS / 1000}s for URL: ${url}`)
    }
    throw error
  }
}

/**
 * Normalize and validate MIME type from header or buffer magic bytes
 */
function normalizeMimeType(mimeType: string | null, buffer: ArrayBuffer): string {
  // Use provided MIME type if valid
  if (mimeType && VALID_MIME_TYPES.has(mimeType.toLowerCase())) {
    return mimeType.toLowerCase()
  }

  // Fallback: detect from buffer (magic bytes)
  const bytes = new Uint8Array(buffer.slice(0, Math.min(12, buffer.byteLength)))

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png'
  }

  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif'
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }

  // MP4: Check for ftyp box
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'video/mp4'
  }

  // Default fallback
  console.warn(`[MediaProxy] Unable to detect MIME type, defaulting to jpeg`)
  return 'image/jpeg'
}

/**
 * Generate R2 key for proxied media
 */
function generateR2Key(userId: string, originalUrl: string, mimeType: string): string {
  const urlHash = Buffer.from(originalUrl).toString('base64').substring(0, MEDIA_PROXY.URL_HASH_LENGTH)
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 15)

  let ext = 'jpg'
  if (mimeType.includes('webp')) ext = 'webp'
  else if (mimeType.includes('png')) ext = 'png'
  else if (mimeType.includes('gif')) ext = 'gif'
  else if (mimeType.includes('mp4')) ext = 'mp4'
  else if (mimeType.includes('webm')) ext = 'webm'
  else if (originalUrl.includes('.webp')) ext = 'webp'
  else if (originalUrl.includes('.mp4')) ext = 'mp4'

  return `proxy/${userId}-${timestamp}-${randomStr}-${urlHash}.${ext}`
}

/**
 * Delete object from R2 (for cleanup of failed uploads)
 * Uses the R2 service's dedicated DELETE function with proper signature
 */
async function deleteFromR2(r2Key: string): Promise<void> {
  try {
    // Use the R2 service's dedicated delete function with proper auth headers
    const { deleteFromR2: deleteFromR2Service } = await import('@/lib/services/r2-presigned.service')
    await deleteFromR2Service(r2Key)
    console.log(`[MediaProxy] Deleted R2 object: ${r2Key}`)
  } catch (error) {
    console.error(`[MediaProxy] Failed to delete R2 object ${r2Key}:`, error)
    throw error
  }
}

/**
 * Find cached proxy by original URL
 * Returns cached result with automatic presigned URL regeneration when expired
 */
async function findCachedProxy(
  userId: string,
  originalUrl: string
): Promise<{ url: string; r2Key: string; regenerated?: boolean } | null> {
  // Find recent active media for this user
  const existingList = await prisma.uploadedMedia.findMany({
    where: {
      userId,
      status: UPLOADED_MEDIA_STATUS.ACTIVE,
    },
    take: 100,
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Find match by metadata
  const cached = existingList.find(m => {
    const metadata = m.metadata as ProxyMediaMetadata | null
    return metadata?.originalUrl === originalUrl
  })

  if (!cached) {
    return null
  }

  const metadata = (cached.metadata || {}) as ProxyMediaMetadata
  const expiresAt = metadata?.presignedUrlExpiresAt

  // Handle legacy records without presigned URL expiration
  if (!expiresAt) {
    console.log(`[MediaProxy] Legacy record without presigned URL expiration for ${originalUrl}, regenerating`)

    if (!cached.r2Key) {
      return null
    }

    const presignedResult = await generatePresignedUrl(
      cached.r2Key,
      MEDIA_PROXY.PRESIGNED_GET_URL_EXPIRY_SECONDS,
      'GET'
    )

    const updated = await prisma.uploadedMedia.update({
      where: { id: cached.id },
      data: {
        url: presignedResult.url,
        metadata: {
          ...metadata,
          presignedUrlExpiresAt: presignedResult.expiresAt.toISOString(),
        },
      },
    })

    return { url: updated.url, r2Key: updated.r2Key || '', regenerated: true }
  }

  const expirationDate = new Date(expiresAt)

  // Validate date is valid
  if (isNaN(expirationDate.getTime())) {
    console.warn(`[MediaProxy] Invalid expiration date in metadata: ${expiresAt}, regenerating`)

    if (!cached.r2Key) {
      return null
    }

    const presignedResult = await generatePresignedUrl(
      cached.r2Key,
      MEDIA_PROXY.PRESIGNED_GET_URL_EXPIRY_SECONDS,
      'GET'
    )

    const updated = await prisma.uploadedMedia.update({
      where: { id: cached.id },
      data: {
        url: presignedResult.url,
        metadata: {
          ...metadata,
          presignedUrlExpiresAt: presignedResult.expiresAt.toISOString(),
        },
      },
    })

    return { url: updated.url, r2Key: updated.r2Key || '', regenerated: true }
  }

  const now = new Date()

  // Check if URL was recently regenerated (avoid race conditions)
  const lastRegeneratedAt = metadata?.lastRegeneratedAt
    ? new Date(metadata.lastRegeneratedAt)
    : new Date(0)
  const timeSinceLastRegeneration = now.getTime() - lastRegeneratedAt.getTime()

  if (timeSinceLastRegeneration < MEDIA_PROXY.URL_REGENERATION_COOLDOWN_MS) {
    // Recently regenerated, return existing URL even if expired
    // (another request is handling regeneration)
    console.log(`[MediaProxy] Using recently regenerated URL for ${originalUrl}`)
    return { url: cached.url, r2Key: cached.r2Key || '' }
  }

  // Check if presigned URL has expired (regenerate if needed)
  if (expirationDate.getTime() - now.getTime() < MEDIA_PROXY.URL_REGENERATION_BUFFER_MS) {
    console.log(`[MediaProxy] Regenerating expired presigned URL for ${originalUrl}`)

    if (!cached.r2Key) {
      console.error(`[MediaProxy] No R2 key found for ${originalUrl}, cannot regenerate`)
      return { url: cached.url, r2Key: '', regenerated: false }
    }

    const presignedResult = await generatePresignedUrl(
      cached.r2Key,
      MEDIA_PROXY.PRESIGNED_GET_URL_EXPIRY_SECONDS,
      'GET'
    )

    const updated = await prisma.uploadedMedia.update({
      where: { id: cached.id },
      data: {
        url: presignedResult.url,
        metadata: {
          ...metadata,
          presignedUrlExpiresAt: presignedResult.expiresAt.toISOString(),
          lastRegeneratedAt: now.toISOString(),
        },
      },
    })

    console.log(`[MediaProxy] Regenerated presigned URL for ${originalUrl}, valid until ${presignedResult.expiresAt.toISOString()}`)
    return { url: updated.url, r2Key: updated.r2Key || '', regenerated: true }
  }

  return { url: cached.url, r2Key: cached.r2Key || '' }
}

/**
 * Proxy media from external URL to R2
 * Downloads the media and uploads to R2, returns the R2 URL
 */
export async function proxyMediaToR2(
  userId: string,
  originalUrl: string
): Promise<ProxyResult> {
  // Check for existing cached proxy first
  const cached = await findCachedProxy(userId, originalUrl)
  if (cached) {
    console.log(`[MediaProxy] Found cached proxy for ${originalUrl}${cached.regenerated ? ' (regenerated)' : ''}`)
    return { url: cached.url, r2Key: cached.r2Key || '' }
  }

  console.log(`[MediaProxy] Downloading from ${originalUrl}`)

  // Track R2 key for cleanup if database save fails
  let uploadedR2Key: string | null = null

  try {
    // Download media from original URL
    const { buffer, mimeType } = await downloadMedia(originalUrl)

    // Determine media type
    const isImage = mimeType.startsWith('image/')
    const mediaType = isImage ? UploadedMediaType.IMAGE : UploadedMediaType.VIDEO

    // Generate R2 key
    const r2Key = generateR2Key(userId, originalUrl, mimeType)
    uploadedR2Key = r2Key

    // Generate presigned URL for upload (short-lived, PUT method)
    const uploadPresignedResult = await generatePresignedUrl(
      r2Key,
      MEDIA_PROXY.PRESIGNED_PUT_URL_EXPIRY_SECONDS,
      'PUT'
    )

    // Upload to R2 from server
    const uploadResponse = await fetch(uploadPresignedResult.url, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': mimeType,
      },
    })

    if (!uploadResponse.ok) {
      throw new Error(`R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
    }

    console.log(`[MediaProxy] Uploaded to R2: ${r2Key} (${buffer.byteLength} bytes)`)

    // Generate presigned GET URL for Threads API to fetch (long-lived: 7 days)
    // Threads API may take time to fetch the media, so we need a longer expiration
    const getPresignedResult = await generatePresignedUrl(
      r2Key,
      MEDIA_PROXY.PRESIGNED_GET_URL_EXPIRY_SECONDS,
      'GET'
    )
    const threadsUrl = getPresignedResult.url

    // Get public URL (for reference in database, but not used by Threads API)
    const publicUrl = getPublicUrlForKey(r2Key)

    // Generate filename for record
    const urlObj = new URL(originalUrl)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || `proxied-media.${mimeType.split('/')[1]}`

    // Save to database - store presigned URL that Threads API can access
    const metadata: ProxyMediaMetadata = {
      originalUrl,
      proxiedAt: new Date().toISOString(),
      presignedUrlExpiresAt: getPresignedResult.expiresAt.toISOString(),
      publicUrl, // Keep public URL for reference
    }

    const uploadedMedia = await prisma.uploadedMedia.create({
      data: {
        userId,
        type: mediaType,
        filename,
        url: threadsUrl, // Store presigned GET URL for Threads API
        r2Key,
        mimeType,
        fileSize: buffer.byteLength,
        status: UPLOADED_MEDIA_STATUS.ACTIVE,
        metadata: metadata as any,
      },
    })

    console.log(`[MediaProxy] Proxy complete: ${originalUrl} -> ${threadsUrl}`)
    // Return presigned URL for Threads API to fetch (valid for 7 days)
    return { url: threadsUrl, r2Key }
  } catch (error) {
    // Cleanup orphaned R2 object if database save failed
    if (uploadedR2Key) {
      try {
        console.log(`[MediaProxy] Cleaning up orphaned R2 object: ${uploadedR2Key}`)
        await deleteFromR2(uploadedR2Key)
      } catch (cleanupError) {
        console.error('[MediaProxy] Failed to cleanup orphaned R2 object:', cleanupError)
        // Don't throw - we want to report original error
      }
    }

    console.error('[MediaProxy] Failed to proxy media to R2:', error)
    throw new Error(
      `Failed to proxy media from ${originalUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Check if a URL needs proxying (can't be accessed directly by Threads API)
 * Uses domain matching that covers all subdomains
 */
export function needsProxy(url: string): boolean {
  // Check for base domains (covers all subdomains)
  const baseDomains = [
    'douyinpic.com',
    'douyinvod.com',
    'douyin.com',
    'tiktokcdn.com',
    'tiktok.com',
    'byteimg.com',
    'bytegoofy.com', // TikTok's CDN
    'pstatp.com', // ByteDance CDN
  ]

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Check if hostname ends with any base domain (covers subdomains)
    return baseDomains.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}
