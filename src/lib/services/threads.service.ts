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
  TextEntity,
  TextAttachment,
  PollAttachment,
  GifAttachment,
  TextStyleInfo,
  TextEntityType,
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
 * Serialize complex parameters to JSON strings for Threads API
 */
function serializeContainerParams(params: CreateContainerParams): Record<string, string> {
  const serialized: Record<string, string> = {
    media_type: params.media_type,
  }

  for (const [key, value] of Object.entries(params)) {
    if (key === 'media_type') continue

    if (value === undefined || value === null) {
      continue
    }

    // Handle complex objects that need JSON serialization
    if (key === 'poll_attachment') {
      if (typeof value === 'string') {
        serialized[key] = value
      } else {
        serialized[key] = JSON.stringify(value)
      }
    } else if (key === 'text_entities') {
      serialized[key] = JSON.stringify(value)
    } else if (key === 'text_attachment') {
      serialized[key] = JSON.stringify(value)
    } else if (key === 'gif_attachment') {
      serialized[key] = JSON.stringify(value)
    } else if (key === 'auto_publish_text' || key === 'is_ghost_post') {
      serialized[key] = String(value)
    } else {
      serialized[key] = String(value)
    }
  }

  return serialized
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
  const serializedParams = serializeContainerParams(params)
  const queryParams = new URLSearchParams(serializedParams)

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
  metrics: string[] = ['views', 'likes', 'shares', 'quotes', 'replies', 'reposts']
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
  metrics: string[] = ['views', 'likes', 'shares', 'quotes', 'replies', 'reposts']
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
  return `https://www.threads.com/@${username}/post/${postId}`
}

/**
 * Get Threads post details (including permalink) from API
 * @param accessToken - Threads access token
 * @param postId - Platform post ID (Threads media ID)
 * @returns Post details including permalink
 */
export async function getThreadsPostDetails(
  accessToken: string,
  postId: string
): Promise<{
  id: string
  permalink: string
  mediaType: string
  mediaUrl?: string
  text?: string
  timestamp?: string
  shortcode?: string
  thumbnailUrl?: string
}> {
  const fields = [
    'id',
    'media_product_type',
    'media_type',
    'media_url',
    'permalink',
    'text',
    'timestamp',
    'shortcode',
    'thumbnail_url',
  ].join(',')

  const url = `${THREADS_API_HOST}/${postId}?fields=${encodeURIComponent(fields)}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch post details: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return {
    id: data.id,
    permalink: data.permalink,
    mediaType: data.media_type,
    mediaUrl: data.media_url,
    text: data.text,
    timestamp: data.timestamp,
    shortcode: data.shortcode,
    thumbnailUrl: data.thumbnail_url,
  }
}

/**
 * Get Threads post insights (analytics) from API
 * @param accessToken - Threads access token
 * @param postId - Platform post ID (Threads media ID)
 * @returns Post analytics metrics
 */
export async function getThreadsPostInsights(
  accessToken: string,
  postId: string
): Promise<{
  views: number
  likes: number
  replies: number
  reposts: number
  quotes: number
  shares: number
}> {
  const metrics = ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'].join(',')

  const url = `${THREADS_API_HOST}/${postId}/insights?metric=${encodeURIComponent(metrics)}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch post insights: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return {
    views: data.metrics?.find((m: { name: string }) => m.name === 'views')?.value ?? 0,
    likes: data.metrics?.find((m: { name: string }) => m.name === 'likes')?.value ?? 0,
    replies: data.metrics?.find((m: { name: string }) => m.name === 'replies')?.value ?? 0,
    reposts: data.metrics?.find((m: { name: string }) => m.name === 'reposts')?.value ?? 0,
    quotes: data.metrics?.find((m: { name: string }) => m.name === 'quotes')?.value ?? 0,
    shares: data.metrics?.find((m: { name: string }) => m.name === 'shares')?.value ?? 0,
  }
}

/**
 * Get or build Threads post URL with automatic fallback
 * Tries to fetch the permalink from Threads API, falls back to built URL
 * @param accessToken - Threads access token
 * @param postId - Platform post ID (Threads media ID)
 * @param username - Threads username for fallback URL
 * @returns The permalink from API or built URL as fallback
 */
export async function getOrBuildThreadsPostUrl(
  accessToken: string,
  postId: string,
  username: string
): Promise<string> {
  try {
    const postDetails = await getThreadsPostDetails(accessToken, postId)
    return postDetails.permalink
  } catch {
    // Fallback to built URL if permalink fetch fails
    return buildThreadsPostUrl(username, postId)
  }
}

/**
 * Extract metric value from Threads insights response
 * @param insights - Threads API insights response
 * @param metricName - Name of the metric to extract
 * @returns Metric value or 0 if not found
 */
export function extractMetricValue(
  insights: ThreadsInsights | ThreadsAccountInsights,
  metricName: string
): number {
  return insights.metrics?.find((m) => m.name === metricName)?.value ?? 0
}

/**
 * Extract all standard metrics from Threads insights response
 * @param insights - Threads API insights response
 * @returns Object with all standard metrics
 */
export function extractAllMetrics(
  insights: ThreadsInsights | ThreadsAccountInsights
): {
  views: number
  likes: number
  shares: number
  replies: number
  quotes: number
  reposts: number
} {
  return {
    views: extractMetricValue(insights, 'views'),
    likes: extractMetricValue(insights, 'likes'),
    shares: extractMetricValue(insights, 'shares'),
    replies: extractMetricValue(insights, 'replies'),
    quotes: extractMetricValue(insights, 'quotes'),
    reposts: extractMetricValue(insights, 'reposts'),
  }
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
