// Threads API Types

export interface ThreadsConfig {
  apiHost: string
  appId: string
  appSecret: string
  redirectUri: string
}

export interface ThreadsTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user_id?: string
}

/**
 * Response from Threads th_exchange_token endpoint
 *
 * THREADS API QUIRK: Threads does NOT return a separate refresh_token.
 * The returned access_token (long-lived, ~60 days) is used as the
 * refresh_token parameter when calling the th_refresh_token endpoint.
 *
 * Flow:
 * 1. exchangeCodeForToken() → short-lived access_token
 * 2. getLongLivedToken() → long-lived access_token (stored in BOTH accessToken and refreshToken fields)
 * 3. refreshAccessToken() → new access_token (requires long-lived token as refresh_token parameter)
 */
export interface ThreadsLongLivedTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface ThreadsRefreshTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface ThreadsContainerResponse {
  id: string
}

export interface ThreadsPublishResponse {
  id: string
}

export enum ThreadsMediaType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  CAROUSEL = 'CAROUSEL',
}

export enum ThreadsReplyControl {
  EVERYONE = 'everyone',
  MENTIONED = 'mentioned',
  FOLLOWERS = 'followers',
  NONE = 'none',
}

export enum TextEntityType {
  SPOILER = 'SPOILER',
  HASHTAG = 'HASHTAG',
  MENTION = 'MENTION',
  URL = 'URL',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  BOLD = 'BOLD',
  ITALIC = 'ITALIC',
}

export interface TextEntity {
  entity_type: TextEntityType | string
  offset: number
  length: number
}

export interface TextStyleInfo {
  offset: number
  length: number
  styling_info: string[]
}

export interface TextAttachment {
  plaintext?: string
  link_attachment_url?: string
  text_with_styling_info?: TextStyleInfo[]
}

export interface PollAttachment {
  option_a: string
  option_b: string
  option_c?: string
  option_d?: string
}

// cspell:ignore GIPHY
export interface GifAttachment {
  gif_id: string
  provider: 'TENOR' | 'GIPHY' | string
}

export interface CreateTextContainerParams {
  text: string
  media_type: ThreadsMediaType.TEXT
  reply_control?: ThreadsReplyControl
  reply_to_id?: string
  link_attachment?: string
  poll_attachment?: PollAttachment | string
  topic_tag?: string
  location_id?: string
  auto_publish_text?: boolean
  text_entities?: TextEntity[]
  text_attachment?: TextAttachment
  gif_attachment?: GifAttachment
  is_ghost_post?: boolean
}

export interface CreateImageContainerParams {
  text?: string
  image_url: string
  media_type: ThreadsMediaType.IMAGE
  reply_control?: ThreadsReplyControl
  reply_to_id?: string
  alt_text?: string
}

export interface CreateVideoContainerParams {
  text?: string
  video_url: string
  media_type: ThreadsMediaType.VIDEO
  reply_control?: ThreadsReplyControl
  reply_to_id?: string
  alt_text?: string
}

export type CreateContainerParams =
  | CreateTextContainerParams
  | CreateImageContainerParams
  | CreateVideoContainerParams

export interface PublishContainerParams {
  container_id: string
}

export interface ThreadsUser {
  id: string
  username: string
  threads_profile_picture_url?: string
  threads_biography?: string
}

export interface ThreadsPost {
  id: string
  text?: string
  media_type?: string
  media?: {
    image_url?: string
    video_url?: string
  }
  permalink?: string
  timestamp: string
  owner: ThreadsUser
}

export interface ThreadsInsights {
  id: string
  metrics: {
    name: string
    value: number
  }[]
}

export interface ThreadsAccountInsights {
  id: string
  metrics: {
    name: string
    value: number
  }[]
}
