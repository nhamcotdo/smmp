/**
 * Threads Post Publisher Service
 * Handles publishing posts to Threads API
 */

import {
  createContainer,
  publishContainer,
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
}

export interface PublishImagePostParams {
  text?: string
  imageUrl: string
  altText?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
}

export interface PublishVideoPostParams {
  text?: string
  videoUrl: string
  altText?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
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

  const container = await createContainer(accessToken, userId, containerParams)

  // Wait a moment for container to be ready (Threads API requirement)
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const result = await publishContainer(accessToken, userId, {
    container_id: container.id,
  })

  return result.id
}

/**
 * Publish an image post to Threads
 */
export async function publishImagePost(
  accessToken: string,
  userId: string,
  params: PublishImagePostParams
): Promise<string> {
  const containerParams: CreateContainerParams = {
    text: params.text || '',
    image_url: params.imageUrl,
    media_type: ThreadsMediaType.IMAGE,
    ...(params.altText && { alt_text: params.altText }),
    ...(params.replyControl && { reply_control: params.replyControl }),
    ...(params.replyToId && { reply_to_id: params.replyToId }),
  }

  const container = await createContainer(accessToken, userId, containerParams)

  // Wait a moment for container to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const result = await publishContainer(accessToken, userId, {
    container_id: container.id,
  })

  return result.id
}

/**
 * Publish a video post to Threads
 */
export async function publishVideoPost(
  accessToken: string,
  userId: string,
  params: PublishVideoPostParams
): Promise<string> {
  const containerParams: CreateContainerParams = {
    text: params.text || '',
    video_url: params.videoUrl,
    media_type: ThreadsMediaType.VIDEO,
    ...(params.altText && { alt_text: params.altText }),
    ...(params.replyControl && { reply_control: params.replyControl }),
    ...(params.replyToId && { reply_to_id: params.replyToId }),
  }

  const container = await createContainer(accessToken, userId, containerParams)

  // Wait for Threads API to fetch and process the video
  // R2 URLs may take longer to be accessible by Threads servers
  await new Promise((resolve) => setTimeout(resolve, 30000))

  const result = await publishContainer(accessToken, userId, {
    container_id: container.id,
  })

  return result.id
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

  if (mediaItems.length < 2) {
    throw new Error('Carousel must have at least 2 media items')
  }
  if (mediaItems.length > 20) {
    throw new Error('Carousel cannot have more than 20 media items')
  }

  // Step 1: Create item containers for each media
  const childContainerIds: string[] = []
  for (const item of mediaItems) {
    const itemParams: CreateContainerParams = {
      media_type: item.type === 'image' ? ThreadsMediaType.IMAGE : ThreadsMediaType.VIDEO,
      is_carousel_item: true,
      ...(item.type === 'image'
        ? { image_url: item.url }
        : { video_url: item.url }
      ),
      ...(item.altText && { alt_text: item.altText }),
    }

    const itemContainer = await createContainer(accessToken, userId, itemParams)
    childContainerIds.push(itemContainer.id)

    // Small delay between item creations to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 3000))
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

  // Wait for carousel container to be ready
  await new Promise((resolve) => setTimeout(resolve, 10000))

  // Step 3: Publish the carousel container
  const result = await publishContainer(accessToken, userId, {
    container_id: carouselContainer.id,
  })

  return result.id
}
