import type { ThreadsReplyControl } from '@/lib/types/threads'

export type PublishMode = 'now' | 'schedule'
export type PostContentType = 'single' | 'carousel'
export type MediaKind = 'image' | 'video' | null

export interface MediaPreview {
  type: MediaKind
  url: string
  file?: File
  blobUrl?: string
  altText?: string
  coverImageUrl?: string
}

export interface CarouselMediaItem {
  id: string
  type: 'image' | 'video'
  url: string
  file?: File
  blobUrl?: string
  altText?: string
  sourceUrl?: string
  isUrlModified?: boolean
}

export interface ScheduledComment {
  id: string
  content: string
  delayMinutes: number
  mediaFile?: File
  mediaPreview?: string
  mediaType?: 'image' | 'video'
  altText?: string
}

export interface ThreadsOptions {
  linkAttachment?: string
  topicTag?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
  pollAttachment?: {
    option_a: string
    option_b: string
    option_c?: string
    option_d?: string
  }
  locationId?: string
  autoPublishText?: boolean
  textEntities?: Array<{
    entity_type: string
    offset: number
    length: number
  }>
  gifAttachment?: {
    gif_id: string
    provider: string
  }
  isGhostPost?: boolean
}

export interface PollOptions {
  optionA: string
  optionB: string
  optionC: string
  optionD: string
}

export interface BulkPostFormData {
  content: string
  contentType: PostContentType
  publishMode: 'now' | 'schedule'
  socialAccountId?: string
  scheduledFor?: string
  imageUrl?: string
  videoUrl?: string
  altText?: string
  carouselMediaItems?: Array<{
    type: 'image' | 'video'
    url: string
    altText?: string
  }>
  threadsOptions?: ThreadsOptions
  pollOptions?: PollOptions
  scheduledComments?: Array<{
    content: string
    delayMinutes: number
    imageUrl?: string
    videoUrl?: string
    altText?: string
  }>
}
