export interface ApiResponse<T = unknown> {
  data: T
  status: number
  success: boolean
  message?: string
}

export interface ApiError {
  message: string
  status: number
  code?: string
}

export interface FetchOptions extends RequestInit {
  timeout?: number
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
