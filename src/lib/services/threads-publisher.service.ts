/**
 * Threads Post Publisher Service
 * Handles publishing posts to Threads API
 */

import {
  createContainer,
  publishContainer,
} from './threads.service'
import type { CreateContainerParams } from '@/lib/types/threads'
import { ThreadsMediaType } from '@/lib/types/threads'

export interface PublishTextPostParams {
  text: string
  linkAttachment?: string
  topicTag?: string
}

export interface PublishImagePostParams {
  text?: string
  imageUrl: string
  altText?: string
}

export interface PublishVideoPostParams {
  text?: string
  videoUrl: string
  altText?: string
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
