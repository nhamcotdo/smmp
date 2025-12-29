import type { ApiResponse, ApiError, FetchOptions, HttpMethod } from './types'

const DEFAULT_TIMEOUT = 10000

class ApiErrorImpl extends Error implements ApiError {
  constructor(
    public message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function apiRequest<T>(
  url: string,
  method: HttpMethod = 'GET',
  data?: unknown,
  options: FetchOptions = {},
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const config: RequestInit = {
    method,
    headers,
    ...options,
  }

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data)
  }

  try {
    const response = await fetchWithTimeout(url, config)

    const responseData = await response.json()

    if (!response.ok) {
      throw new ApiErrorImpl(
        responseData.message || 'An error occurred',
        response.status,
        responseData.code,
      )
    }

    return {
      data: responseData.data ?? responseData,
      status: response.status,
      success: true,
      message: responseData.message,
    }
  } catch (error) {
    if (error instanceof ApiErrorImpl) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiErrorImpl('Request timeout', 408, 'TIMEOUT')
      }
      throw new ApiErrorImpl(error.message, 0, 'NETWORK_ERROR')
    }

    throw new ApiErrorImpl('Unknown error occurred', 0, 'UNKNOWN_ERROR')
  }
}

export const api = {
  get: <T>(url: string, options?: FetchOptions) =>
    apiRequest<T>(url, 'GET', undefined, options),

  post: <T>(url: string, data: unknown, options?: FetchOptions) =>
    apiRequest<T>(url, 'POST', data, options),

  put: <T>(url: string, data: unknown, options?: FetchOptions) =>
    apiRequest<T>(url, 'PUT', data, options),

  patch: <T>(url: string, data: unknown, options?: FetchOptions) =>
    apiRequest<T>(url, 'PATCH', data, options),

  delete: <T>(url: string, options?: FetchOptions) =>
    apiRequest<T>(url, 'DELETE', undefined, options),
}

export type { ApiError }
