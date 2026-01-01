export interface LoginRequest {
  email: string
  password: string
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

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

  // Store token in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', response.data.token)
    localStorage.setItem('auth_user', JSON.stringify(response.data.user))
  }

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

  // Store token in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', response.data.token)
    localStorage.setItem('auth_user', JSON.stringify(response.data.user))
  }

  return response.data
}

export async function getMe(token: string): Promise<User> {
  const response = await fetchAPI<User>('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.success || !response.data) {
    throw new Error(response.message)
  }

  return response.data
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }
}

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token')
  }
  return null
}

export function getStoredUser(): User | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('auth_user')
    if (userStr) {
      try {
        return JSON.parse(userStr) as User
      } catch {
        return null
      }
    }
  }
  return null
}

export function isAuthenticated(): boolean {
  return getStoredToken() !== null
}
