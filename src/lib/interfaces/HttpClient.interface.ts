export interface HttpClient {
  get<T>(url: string, options?: RequestOptions): Promise<T>
  post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  delete<T>(url: string, options?: RequestOptions): Promise<T>
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'HttpError'
  }
}

export class FetchHttpClient implements HttpClient {
  private readonly defaultTimeout: number

  constructor(timeout: number = 30000) {
    this.defaultTimeout = timeout
  }

  async get<T>(url: string, options?: RequestOptions): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.defaultTimeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: options?.signal ?? controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const body = await response.text()
        throw new HttpError(response.status, response.statusText, body)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: ${url}`)
      }

      throw error
    }
  }

  async post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.defaultTimeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal ?? controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const responseBody = await response.text()
        throw new HttpError(response.status, response.statusText, responseBody)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: ${url}`)
      }

      throw error
    }
  }

  async put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.defaultTimeout)

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal ?? controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const responseBody = await response.text()
        throw new HttpError(response.status, response.statusText, responseBody)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: ${url}`)
      }

      throw error
    }
  }

  async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.defaultTimeout)

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: options?.signal ?? controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const responseBody = await response.text()
        throw new HttpError(response.status, response.statusText, responseBody)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout: ${url}`)
      }

      throw error
    }
  }
}
