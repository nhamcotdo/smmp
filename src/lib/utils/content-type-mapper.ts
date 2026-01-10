import { CONTENT_TYPE } from '@/lib/constants'

export type PostContentTypeUI = 'single' | 'carousel'

const CONTENT_TYPE_MAP: Record<PostContentTypeUI, string> = {
  single: CONTENT_TYPE.IMAGE, // Default to IMAGE for single posts
  carousel: CONTENT_TYPE.CAROUSEL,
}

const REVERSE_CONTENT_TYPE_MAP: Record<string, PostContentTypeUI> = {
  [CONTENT_TYPE.IMAGE]: 'single',
  [CONTENT_TYPE.VIDEO]: 'single',
  [CONTENT_TYPE.CAROUSEL]: 'carousel',
  [CONTENT_TYPE.TEXT]: 'single',
  [CONTENT_TYPE.STORY]: 'single',
  [CONTENT_TYPE.REEL]: 'single',
  [CONTENT_TYPE.MIXED]: 'single',
}

/**
 * Convert database ContentType to UI PostContentType
 */
export function toUIContentType(contentType: string): PostContentTypeUI {
  return REVERSE_CONTENT_TYPE_MAP[contentType] || 'single'
}

/**
 * Convert UI PostContentType to database ContentType
 */
export function toDBContentType(contentType: PostContentTypeUI): string {
  return CONTENT_TYPE_MAP[contentType] || CONTENT_TYPE.IMAGE
}