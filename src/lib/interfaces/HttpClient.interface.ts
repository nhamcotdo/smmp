/**
 * HTTP Client Error
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: string
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'HttpError'
  }
}

/**
 * HTTP Request Options
 */
export interface HttpRequestOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * HTTP Client Interface
 */
export interface HttpClient {
  get<T>(url: string, options?: HttpRequestOptions): Promise<T>
  post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<T>
  put<T>(url: string, body: unknown, options?: HttpRequestOptions): Promise<T>
  delete<T>(url: string, options?: HttpRequestOptions): Promise<T>
}

/**
 * Fetch-based HTTP Client Implementation
 */
export class FetchHttpClient implements HttpClient {
  constructor(private timeout: number = 30000) {}

  async get<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: options.signal,
    })
    return this.parseResponse<T>(response)
  }

  async post<T>(url: string, body?: unknown, options: HttpRequestOptions = {}): Promise<T> {
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options.signal,
    })
    return this.parseResponse<T>(response)
  }

  async put<T>(url: string, body: unknown, options: HttpRequestOptions = {}): Promise<T> {
    const response = await this.fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    })
    return this.parseResponse<T>(response)
  }

  async delete<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    const response = await this.fetchWithTimeout(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: options.signal,
    })
    return this.parseResponse<T>(response)
  }

  private async fetchWithTimeout(url: string, options: RequestInit & { signal?: AbortSignal }): Promise<Response> {
    // If caller provided a signal that's already aborted, pass it directly
    if (options.signal?.aborted) {
      return fetch(url, options)
    }

    // Create timeout controller that also respects caller's signal
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    // If caller provided a signal, abort on either signal or timeout
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body = await response.text().catch(() => undefined)
      throw new HttpError(response.status, response.statusText, body)
    }

    return response.json() as Promise<T>
  }
}
