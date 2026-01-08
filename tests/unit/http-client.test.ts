import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FetchHttpClient, HttpError } from '@/lib/interfaces/HttpClient.interface'

global.fetch = vi.fn()

describe('FetchHttpClient', () => {
  let httpClient: FetchHttpClient
  let clearTimeoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    httpClient = new FetchHttpClient(1000)
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    vi.clearAllMocks()
  })

  afterEach(() => {
    clearTimeoutSpy.mockRestore()
  })

  describe('get', () => {
    it('should fetch and parse JSON response', async () => {
      const mockData = { result: 'success' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await httpClient.get('https://api.example.com/test')

      expect(result).toEqual(mockData)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('should include custom headers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      await httpClient.get('https://api.example.com/test', {
        headers: { Authorization: 'Bearer token' },
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
        })
      )
    })

    it('should throw HttpError on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Resource not found',
      } as Response)

      await expect(httpClient.get('https://api.example.com/test')).rejects.toThrow(HttpError)
    })

    it('should handle abort signal', async () => {
      const controller = new AbortController()
      controller.abort()

      vi.mocked(fetch).mockImplementationOnce((_url, options) => {
        if (options?.signal?.aborted) {
          return Promise.reject(new DOMException('Aborted', 'AbortError'))
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        } as Response)
      })

      await expect(
        httpClient.get('https://api.example.com/test', { signal: controller.signal })
      ).rejects.toThrow()
    })
  })

  describe('post', () => {
    it('should post data as JSON', async () => {
      const mockData = { id: 1 }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await httpClient.post('https://api.example.com/create', { name: 'test' })

      expect(result).toEqual(mockData)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      )
    })

    it('should handle undefined body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      await httpClient.post('https://api.example.com/create')

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          body: undefined,
        })
      )
    })
  })

  describe('put', () => {
    it('should put data as JSON', async () => {
      const mockData = { id: 1, name: 'updated' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await httpClient.put('https://api.example.com/update/1', { name: 'updated' })

      expect(result).toEqual(mockData)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/update/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'updated' }),
        })
      )
    })
  })

  describe('delete', () => {
    it('should delete resource', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      const result = await httpClient.delete('https://api.example.com/delete/1')

      expect(result).toEqual({ success: true })
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/delete/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('HttpError', () => {
    it('should create error with status details', () => {
      const error = new HttpError(500, 'Internal Server Error', 'Database failed')

      expect(error.status).toBe(500)
      expect(error.statusText).toBe('Internal Server Error')
      expect(error.body).toBe('Database failed')
      expect(error.message).toBe('HTTP 500: Internal Server Error')
      expect(error.name).toBe('HttpError')
    })
  })
})
