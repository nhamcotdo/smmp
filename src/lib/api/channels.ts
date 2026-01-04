/**
 * API client for channel management
 */

export interface Channel {
  id: string
  platform: string
  username: string
  displayName?: string
  avatar?: string
  status: string
  health: string
  followersCount?: number
  followingCount?: number
  postsCount?: number
  lastSyncedAt?: string
  tokenExpiresAt?: string
  createdAt: string
}

export interface ThreadsConnectResponse {
  url: string
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
}

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing) {
    return refreshPromise ?? false
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' })
      return response.ok
    } catch {
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  let response = await fetch(`/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  // If 401, try to refresh token and retry
  if (response.status === 401 && !endpoint.startsWith('/auth/refresh')) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      // Retry original request with new token
      response = await fetch(`/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      })
    }
  }

  const data = await response.json()
  return data as ApiResponse<T>
}

/**
 * Get all connected channels
 */
export async function getChannels(): Promise<Channel[]> {
  const response = await fetchAPI<Channel[]>('/channels')

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  return response.data
}

/**
 * Get Threads OAuth authorization URL
 */
export async function getThreadsConnectUrl(): Promise<string> {
  const response = await fetchAPI<ThreadsConnectResponse>('/channels/threads/connect')

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  return response.data.url
}

/**
 * Disconnect a channel
 */
export async function disconnectChannel(channelId: string): Promise<void> {
  const response = await fetchAPI<{ id: string }>(`/channels/${channelId}`, {
    method: 'DELETE',
  })

  if (!response.success) {
    throw new Error(response.message)
  }
}

/**
 * Refresh channel access token
 */
export async function refreshChannelToken(channelId: string): Promise<{ tokenExpiresAt: string }> {
  const response = await fetchAPI<{ tokenExpiresAt: string }>(`/channels/${channelId}`, {
    method: 'POST',
  })

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  return response.data
}

/**
 * Publish post to Threads channel
 */
export async function publishToThreads(postId: string, channelId: string): Promise<{
  publicationId: string
  platformPostId: string
  platformUrl: string
}> {
  const response = await fetchAPI<{
    publicationId: string
    platformPostId: string
    platformUrl: string
  }>(`/posts/${postId}/publish/threads`, {
    method: 'POST',
    body: JSON.stringify({ channelId }),
  })

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  return response.data
}
