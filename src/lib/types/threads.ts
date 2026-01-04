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

export interface ThreadsLongLivedTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
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

export interface CreateTextContainerParams {
  text: string
  media_type: ThreadsMediaType.TEXT
  reply_control?: ThreadsReplyControl
  reply_to_id?: string
  link_attachment?: string
  poll_attachment?: string
  topic_tag?: string
  location_id?: string
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
