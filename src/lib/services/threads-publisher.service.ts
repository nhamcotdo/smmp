/**
 * Threads Post Publisher Service
 * Handles publishing posts to Threads API
 */

import {
  createContainer,
  publishContainer,
  getContainerStatus,
} from './threads.service'
import type {
  CreateContainerParams,
  TextEntity,
  TextAttachment,
  PollAttachment,
  GifAttachment,
  ThreadsReplyControl,
} from '@/lib/types/threads'
import { ThreadsMediaType } from '@/lib/types/threads'
import { needsProxy, proxyMediaToR2 } from './media-proxy.service'
import { THREADS_POLLING, CAROUSEL } from '@/lib/constants'

/**
 * Prepare media URL for Threads API
 * Proxies URL if needed (Douyin, TikTok, etc.)
 */
async function prepareMediaUrl(internalUserId: string, url: string): Promise<string> {
  if (needsProxy(url)) {
    console.log(`[MediaProxy] Proxying URL: ${url}`)
    const result = await proxyMediaToR2(internalUserId, url)
    console.log(`[MediaProxy] Proxied to: ${result.url}`)
    return result.url
  }
  return url
}

/**
 * Poll container status until it's ready or failed
 * Uses exponential backoff to avoid hammering the API
 */
async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  options: {
    maxWaitMs?: number
    initialPollIntervalMs?: number
    maxPollIntervalMs?: number
  } = {}
): Promise<void> {
  const {
    maxWaitMs = THREADS_POLLING.DEFAULT_MAX_WAIT_MS,
    initialPollIntervalMs = THREADS_POLLING.INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs = THREADS_POLLING.MAX_POLL_INTERVAL_MS,
  } = options

  const startTime = Date.now()
  let pollInterval = initialPollIntervalMs

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getContainerStatus(accessToken, containerId)

    if (status.status === 'FINISHED' || status.status === 'PUBLISHED') {
      console.log(`[Container ${containerId}] Ready with status: ${status.status}`)
      return
    }

    if (status.status === 'ERROR' || status.status === 'EXPIRED') {
      throw new Error(
        `Container ${containerId} failed with status: ${status.status}` +
        (status.error_message ? `. Error: ${status.error_message}` : '')
      )
    }

    console.log(`[Container ${containerId}] Status: ${status.status}, polling again in ${pollInterval}ms...`)

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    pollInterval = Math.min(pollInterval * 1.5, maxPollIntervalMs)
  }

  throw new Error(
    `Container ${containerId} not ready after ${maxWaitMs}ms. ` +
    `Consider increasing maxWaitMs or checking Threads API status.`
  )
}

/**
 * Generic publish workflow that handles all container-based posts
 * Creates container, waits for ready, then publishes
 */
async function publishWithContainer<T extends CreateContainerParams>(
  accessToken: string,
  userId: string,
  containerParams: T,
  options: {
    maxWaitMs: number
    containerType?: string
  }
): Promise<string> {
  const { maxWaitMs, containerType = 'Container' } = options

  const container = await createContainer(accessToken, userId, containerParams)
  console.log(`[${containerType}] Created container: ${container.id}`)

  await waitForContainerReady(accessToken, container.id, { maxWaitMs })

  const result = await publishContainer(accessToken, userId, {
    container_id: container.id,
  })

  return result.id
}

export interface PublishTextPostParams {
  text: string
  linkAttachment?: string
  topicTag?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
  pollAttachment?: PollAttachment
  locationId?: string
  autoPublishText?: boolean
  textEntities?: TextEntity[]
  textAttachment?: TextAttachment
  gifAttachment?: GifAttachment
  isGhostPost?: boolean
  internalUserId?: string // For proxying media URLs
}

export interface PublishImagePostParams {
  text?: string
  imageUrl: string
  altText?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
  internalUserId: string // Required for proxying media URLs from protected sources
}

export interface PublishVideoPostParams {
  text?: string
  videoUrl: string
  altText?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
  internalUserId: string // Required for proxying media URLs from protected sources
}

export interface CarouselMediaItem {
  type: 'image' | 'video'
  url: string
  altText?: string
}

export interface PublishCarouselPostParams {
  text?: string
  mediaItems: CarouselMediaItem[]
  linkAttachment?: string
  topicTag?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
  locationId?: string
  autoPublishText?: boolean
  isGhostPost?: boolean
  internalUserId: string // Required for proxying media URLs from protected sources
}

/**
 * Publish a text post to Threads
 */
export async function publishTextPost(
  accessToken: string,
  userId: string,
  params: PublishTextPostParams
): Promise<string> {
  const containerParams: CreateContainerParams = {
    text: params.text,
    media_type: ThreadsMediaType.TEXT,
    ...(params.linkAttachment && { link_attachment: params.linkAttachment }),
    ...(params.topicTag && { topic_tag: params.topicTag }),
    ...(params.replyControl && { reply_control: params.replyControl }),
    ...(params.replyToId && { reply_to_id: params.replyToId }),
    ...(params.pollAttachment && { poll_attachment: params.pollAttachment }),
    ...(params.locationId && { location_id: params.locationId }),
    ...(params.autoPublishText !== undefined && { auto_publish_text: params.autoPublishText }),
    ...(params.textEntities && { text_entities: params.textEntities }),
    ...(params.textAttachment && { text_attachment: params.textAttachment }),
    ...(params.gifAttachment && { gif_attachment: params.gifAttachment }),
    ...(params.isGhostPost !== undefined && { is_ghost_post: params.isGhostPost }),
  }

  return publishWithContainer(accessToken, userId, containerParams, {
    maxWaitMs: THREADS_POLLING.TEXT_POST_MAX_WAIT_MS,
    containerType: 'Text',
  })
}

/**
 * Publish an image post to Threads
 */
export async function publishImagePost(
  accessToken: string,
  userId: string,
  params: PublishImagePostParams
): Promise<string> {
  // Proxy URL if needed (Douyin, TikTok, etc.)
  const proxiedImageUrl = await prepareMediaUrl(params.internalUserId, params.imageUrl)

  const containerParams: CreateContainerParams = {
    text: params.text || '',
    image_url: proxiedImageUrl,
    media_type: ThreadsMediaType.IMAGE,
    ...(params.altText && { alt_text: params.altText }),
    ...(params.replyControl && { reply_control: params.replyControl }),
    ...(params.replyToId && { reply_to_id: params.replyToId }),
  }

  return publishWithContainer(accessToken, userId, containerParams, {
    maxWaitMs: THREADS_POLLING.IMAGE_POST_MAX_WAIT_MS,
    containerType: 'Image',
  })
}

/**
 * Publish a video post to Threads
 */
export async function publishVideoPost(
  accessToken: string,
  userId: string,
  params: PublishVideoPostParams
): Promise<string> {
  // Proxy URL if needed (Douyin, TikTok, etc.)
  const proxiedVideoUrl = await prepareMediaUrl(params.internalUserId, params.videoUrl)

  const containerParams: CreateContainerParams = {
    text: params.text || '',
    video_url: proxiedVideoUrl,
    media_type: ThreadsMediaType.VIDEO,
    ...(params.altText && { alt_text: params.altText }),
    ...(params.replyControl && { reply_control: params.replyControl }),
    ...(params.replyToId && { reply_to_id: params.replyToId }),
  }

  return publishWithContainer(accessToken, userId, containerParams, {
    maxWaitMs: THREADS_POLLING.VIDEO_POST_MAX_WAIT_MS,
    containerType: 'Video',
  })
}

/**
 * Publish a carousel post to Threads
 * A carousel can have 2-20 images/videos mixed
 */
export async function publishCarouselPost(
  accessToken: string,
  userId: string,
  params: PublishCarouselPostParams
): Promise<string> {
  const { mediaItems } = params

  if (mediaItems.length < CAROUSEL.MIN_ITEMS) {
    throw new Error(`Carousel must have at least ${CAROUSEL.MIN_ITEMS} media items`)
  }
  if (mediaItems.length > CAROUSEL.MAX_ITEMS) {
    throw new Error(`Carousel cannot have more than ${CAROUSEL.MAX_ITEMS} media items`)
  }

  // Step 1: Proxy URLs if needed, then create item containers for each media
  const childContainerIds: string[] = []
  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i]

    // Proxy URL if needed (Douyin, TikTok, etc.)
    const proxiedUrl = await prepareMediaUrl(params.internalUserId, item.url)

    const itemParams: CreateContainerParams = {
      media_type: item.type === 'image' ? ThreadsMediaType.IMAGE : ThreadsMediaType.VIDEO,
      is_carousel_item: true,
      ...(item.type === 'image'
        ? { image_url: proxiedUrl }
        : { video_url: proxiedUrl }
      ),
      ...(item.altText && { alt_text: item.altText }),
    }

    const itemContainer = await createContainer(accessToken, userId, itemParams)
    console.log(`[Carousel] Created item container ${i + 1}/${mediaItems.length}: ${itemContainer.id}`)

    // Wait for child container to be ready before creating next item
    const itemMaxWaitMs = item.type === 'video' ? THREADS_POLLING.VIDEO_POST_MAX_WAIT_MS : THREADS_POLLING.IMAGE_POST_MAX_WAIT_MS
    await waitForContainerReady(accessToken, itemContainer.id, {
      maxWaitMs: itemMaxWaitMs,
    })
    console.log(`[Carousel] Item container ${i + 1}/${mediaItems.length} ready`)

    childContainerIds.push(itemContainer.id)
  }

  // Step 2: Create carousel container with children
  const carouselContainerParams: CreateContainerParams = {
    text: params.text || '',
    media_type: ThreadsMediaType.CAROUSEL,
    children: childContainerIds.join(','),
    ...(params.linkAttachment && { link_attachment: params.linkAttachment }),
    ...(params.topicTag && { topic_tag: params.topicTag }),
    ...(params.replyControl && { reply_control: params.replyControl }),
    ...(params.replyToId && { reply_to_id: params.replyToId }),
    ...(params.locationId && { location_id: params.locationId }),
    ...(params.autoPublishText !== undefined && { auto_publish_text: params.autoPublishText }),
    ...(params.isGhostPost !== undefined && { is_ghost_post: params.isGhostPost }),
  }

  const carouselContainer = await createContainer(accessToken, userId, carouselContainerParams)
  console.log(`[Carousel] Created carousel container: ${carouselContainer.id}`)

  // Wait for carousel container to be ready using status polling
  // Carousels with videos may take longer due to R2 URL fetching
  const hasVideoItems = mediaItems.some((item) => item.type === 'video')
  const carouselMaxWaitMs = hasVideoItems ? THREADS_POLLING.VIDEO_POST_MAX_WAIT_MS : THREADS_POLLING.IMAGE_POST_MAX_WAIT_MS
  console.log(`[Carousel] Waiting for carousel container to be ready (max ${carouselMaxWaitMs}ms, has videos: ${hasVideoItems})`)
  await waitForContainerReady(accessToken, carouselContainer.id, {
    maxWaitMs: carouselMaxWaitMs,
  })

  // Step 3: Publish the carousel container
  const result = await publishContainer(accessToken, userId, {
    container_id: carouselContainer.id,
  })

  console.log(`[Carousel] Published carousel: ${result.id}`)
  return result.id
}
