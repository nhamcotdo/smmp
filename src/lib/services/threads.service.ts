/**
 * Threads API Client Service
 * Handles all interactions with the Threads (Instagram) API
 */

import type {
  ThreadsConfig,
  ThreadsTokenResponse,
  ThreadsLongLivedTokenResponse,
  ThreadsRefreshTokenResponse,
  ThreadsContainerResponse,
  ThreadsPublishResponse,
  CreateContainerParams,
  PublishContainerParams,
  ThreadsPost,
  ThreadsInsights,
  ThreadsAccountInsights,
  ThreadsUser,
} from '@/lib/types/threads'

const THREADS_API_HOST = 'https://graph.threads.net'

function getConfig(): ThreadsConfig {
  const appId = process.env.THREADS_APP_ID
  const appSecret = process.env.THREADS_APP_SECRET
  const redirectUri = process.env.THREADS_REDIRECT_URI || 'http://localhost:3000/api/channels/threads/callback'

  if (!appId || !appSecret) {
    throw new Error('THREADS_APP_ID and THREADS_APP_SECRET environment variables are required')
  }

  return {
    apiHost: THREADS_API_HOST,
    appId,
    appSecret,
    redirectUri,
  }
}

/**
 * Exchange authorization code for short-lived access token
 */
export async function exchangeCodeForToken(code: string): Promise<ThreadsTokenResponse> {
  const config = getConfig()
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    code,
  })

  const response = await fetch(`${config.apiHost}/oauth/access_token?${params}`, {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for token: ${error}`)
  }

  return response.json()
}

/**
 * Get long-lived access token (valid for 60 days)
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<ThreadsLongLivedTokenResponse> {
  const config = getConfig()
  const params = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: config.appSecret,
    access_token: shortLivedToken,
  })

  const response = await fetch(`${config.apiHost}/access_token?${params}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get long-lived token: ${error}`)
  }

  return response.json()
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<ThreadsRefreshTokenResponse> {
  const config = getConfig()
  const params = new URLSearchParams({
    grant_type: 'th_refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(`${config.apiHost}/refresh_access_token?${params}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  return response.json()
}

/**
 * Get app access token (for server-to-server requests)
 */
export async function getAppAccessToken(): Promise<ThreadsTokenResponse> {
  const config = getConfig()
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.appId,
    client_secret: config.appSecret,
  })

  const response = await fetch(`${config.apiHost}/oauth/access_token?${params}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get app access token: ${error}`)
  }

  return response.json()
}

/**
 * Create a container for a Thread post
 */
export async function createContainer(
  accessToken: string,
  userId: string,
  params: CreateContainerParams
): Promise<ThreadsContainerResponse> {
  const config = getConfig()
  const queryParams = new URLSearchParams({
    ...params,
    media_type: params.media_type,
  } as Record<string, string>)

  const response = await fetch(`${config.apiHost}/${userId}/threads?${queryParams}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create container: ${error}`)
  }

  return response.json()
}

/**
 * Publish a container to create a Thread
 * Note: Threads API uses 'creation_id' parameter, not 'container_id'
 */
export async function publishContainer(
  accessToken: string,
  userId: string,
  params: PublishContainerParams
): Promise<ThreadsPublishResponse> {
  const config = getConfig()
  const queryParams = new URLSearchParams({
    creation_id: params.container_id,
  })

  const response = await fetch(`${config.apiHost}/${userId}/threads_publish?${queryParams}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to publish container: ${error}`)
  }

  return response.json()
}

/**
 * Get user's Threads posts
 */
export async function getUserThreads(
  accessToken: string,
  userId: string,
  fields: string[] = ['id', 'text', 'media_type', 'media', 'permalink', 'timestamp', 'owner'],
  limit?: number
): Promise<{ data: ThreadsPost[]; paging?: { next?: string } }> {
  const config = getConfig()
  const params = new URLSearchParams({
    fields: fields.join(','),
    ...(limit && { limit: limit.toString() }),
  })

  const response = await fetch(`${config.apiHost}/${userId}/threads?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get user threads: ${error}`)
  }

  return response.json()
}

/**
 * Get insights for a specific Thread
 */
export async function getThreadInsights(
  accessToken: string,
  threadId: string,
  metrics: string[] = ['views', 'likes', 'comments', 'replies', 'quotes', 'reposts']
): Promise<ThreadsInsights> {
  const config = getConfig()
  const params = new URLSearchParams({
    metric: metrics.join(','),
  })

  const response = await fetch(`${config.apiHost}/${threadId}/insights?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get thread insights: ${error}`)
  }

  return response.json()
}

/**
 * Get account-level insights
 */
export async function getAccountInsights(
  accessToken: string,
  userId: string,
  metrics: string[] = ['views', 'likes', 'comments', 'replies', 'quotes', 'reposts']
): Promise<ThreadsAccountInsights> {
  const config = getConfig()
  const params = new URLSearchParams({
    metric: metrics.join(','),
  })

  const response = await fetch(`${config.apiHost}/${userId}/threads_insights?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get account insights: ${error}`)
  }

  return response.json()
}

/**
 * Get user profile information
 */
export async function getUserProfile(
  accessToken: string,
  userId: string,
  fields: string[] = ['id', 'username', 'threads_profile_picture_url', 'threads_biography']
): Promise<ThreadsUser> {
  const config = getConfig()
  const params = new URLSearchParams({
    fields: fields.join(','),
  })

  const response = await fetch(`${config.apiHost}/${userId}?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get user profile: ${error}`)
  }

  const data = await response.json()
  return data as ThreadsUser
}

/**
 * Build a Threads post URL
 */
export function buildThreadsPostUrl(username: string, postId: string): string {
  return `https://threads.net/${username}/post/${postId}`
}

/**
 * Get the authorization URL for OAuth flow
 * @param scopes - OAuth scopes to request
 * @param state - State parameter for CSRF protection
 */
export function getAuthorizationUrl(
  scopes: string[] = ['threads_basic', 'threads_content_publish'],
  state?: string
): string {
  const config = getConfig()
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    scope: scopes.join(','),
    response_type: 'code',
    ...(state && { state }),
  })

  return `https://threads.net/oauth/authorize?${params}`
}
