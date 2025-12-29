'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ApiResponse, ApiError } from '@/lib/types'
import { api } from '@/lib/api-client'

interface UseFetchResult<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
  refetch: () => Promise<void>
}

export function useFetch<T>(
  url: string,
  options?: RequestInit,
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.get<T>(url, options)
      setData(response.data)
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setLoading(false)
    }
  }, [url, options])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, error, loading, refetch: fetchData }
}
