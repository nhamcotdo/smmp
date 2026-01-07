/**
 * Shared Douyin URL handling utilities
 */

export interface DouyinMedia {
  type: 'video' | 'image'
  downloadUrl?: string
  imageUrls: string[]
  videoDesc?: string
}

export interface FetchDouyinMediaOptions {
  onError?: (message: string) => void
}

/**
 * Fetch and parse Douyin media from URL
 */
export async function fetchDouyinMedia(
  url: string,
  options?: FetchDouyinMediaOptions
): Promise<DouyinMedia | null> {
  try {
    const response = await fetch('/api/parse/douyin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data = await response.json()

    if (!data.success) {
      const errorMsg = data.message || 'Failed to parse Douyin URL'
      options?.onError?.(errorMsg)
      throw new Error(errorMsg)
    }

    return {
      type: data.data.type,
      downloadUrl: data.data.downloadUrl,
      imageUrls: data.data.imageUrl || [],
      videoDesc: data.data.videoDesc,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to parse Douyin URL'
    options?.onError?.(errorMsg)
    throw error
  }
}

/**
 * Detect media type from URL extension or path
 */
export function detectMediaTypeFromUrl(url: string): 'image' | 'video' | null {
  // Check extension FIRST (takes priority over path)
  // Extension can be followed by query params or fragments
  const isImageByExt = /\.(jpg|jpeg|png|gif|webp|avif|bmp)/i.test(url)
  const isVideoByExt = /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v|ogv|ts)/i.test(url)

  if (isImageByExt) return 'image'
  if (isVideoByExt) return 'video'

  // If there's a file extension (anything before a ? or #) but it's not recognized,
  // return null instead of checking path
  // This ensures extension takes priority over path
  const hasFileExtension = /\/[^/?#]+\.[a-z0-9]+(?:[?#]|$)/i.test(url)
  if (hasFileExtension) {
    // Has an unknown file extension - return null
    return null
  }

  // Check query params for format hints
  try {
    const urlObj = new URL(url, 'http://dummy.com')
    const formatParam = urlObj.searchParams.get('format')
    const extParam = urlObj.searchParams.get('ext')
    const formatOrExt = formatParam || extParam

    if (formatOrExt === 'jpg' || formatOrExt === 'jpeg' || formatOrExt === 'png' || formatOrExt === 'gif' || formatOrExt === 'webp') {
      return 'image'
    }
    if (formatOrExt === 'mp4' || formatOrExt === 'webm' || formatOrExt === 'mov') {
      return 'video'
    }
  } catch {
    // Invalid URL, continue to path check
  }

  // Only check path if NO extension found
  const isImageByPath = url.includes('/image/') || url.includes('/images/')
  const isVideoByPath = url.includes('/video/') || url.includes('/videos/')

  if (isImageByPath) return 'image'
  if (isVideoByPath) return 'video'

  return null
}

/**
 * Check if URL is a Douyin URL
 */
export function isDouyinUrl(url: string): boolean {
  return /douyin\.com|iesdouyin\.com/i.test(url)
}
