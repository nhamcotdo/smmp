export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface AuthResponse {
  user: User
  token: string
  expiresIn: number
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  emailVerified: boolean
  avatar?: string
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T> {
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
  options?: RequestInit,
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

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await fetchAPI<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  // Token is stored in httpOnly cookie by the server
  return response.data
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await fetchAPI<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  // Token is stored in httpOnly cookie by the server
  return response.data
}

export async function getMe(): Promise<User> {
  const response = await fetchAPI<User>('/auth/me')

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  return response.data
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' })

  if (!response.ok) {
    throw new Error('Logout failed')
  }
}

export function isAuthenticated(): boolean {
  // Authentication is checked via /api/auth/me endpoint
  // This function is kept for compatibility but should not be relied upon
  return false
}
