'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { MediaType } from '@prisma/client'
import { UPLOADED_MEDIA_STATUS } from '@/lib/constants'

interface MediaListItem {
  id: string
  type: MediaType
  filename: string
  url: string
  mimeType: string
  fileSize: number
  status: string
  createdAt: string
  postId: string | null
}

interface MediaListResponse {
  media: MediaListItem[]
  total: number
}

export default function MediaPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [media, setMedia] = useState<MediaListItem[]>([])
  const [isLoadingMedia, setIsLoadingMedia] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'deleted' | 'all'>('active')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated) {
      loadMedia()
    }
  }, [isLoading, isAuthenticated, filter, statusFilter])

  async function loadMedia() {
    setIsLoadingMedia(true)
    setError('')
    try {
      const typeParam = filter === 'all' ? '' : `&type=${filter}`
      const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`
      const response = await fetch(`/api/media?page=1&limit=50${typeParam}${statusParam}`)

      if (!response.ok) {
        throw new Error('Failed to load media')
      }

      const data = await response.json()
      if (data.success) {
        setMedia(data.data.media)
      } else {
        throw new Error(data.message || 'Failed to load media')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media')
    } finally {
      setIsLoadingMedia(false)
    }
  }

  async function handleDelete(mediaId: string) {
    if (!confirm('Are you sure you want to delete this media? This action cannot be undone.')) {
      return
    }

    setError('')
    setSuccessMessage('')
    try {
      const response = await fetch(`/api/media/${mediaId}`, { method: 'DELETE' })

      if (!response.ok) {
        throw new Error('Failed to delete media')
      }

      const data = await response.json()
      if (data.success) {
        setSuccessMessage('Media deleted successfully')
        await loadMedia()
      } else {
        throw new Error(data.message || 'Failed to delete media')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete media')
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
  }

  function getMediaIcon(type: MediaType): string {
    return type === MediaType.IMAGE ? '🖼️' : '🎥'
  }

  if (isLoadingMedia) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading media...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              Media Library
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage your uploaded images and videos
            </p>
          </div>
          <Link
            href="/posts/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Upload Media
          </Link>
        </div>
      </div>

      {/* Content */}
      <div>
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-md bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Type:
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'image' | 'video')}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'deleted' | 'all')}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="active">Active</option>
              <option value="deleted">Deleted</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {/* Media Grid */}
        {media.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-4 text-6xl">📁</div>
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              No media found
            </h3>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              {filter === 'all' && statusFilter === 'active'
                ? 'Upload your first media file to get started'
                : 'Try changing the filters'}
            </p>
            <Link
              href="/posts/new"
              className="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Upload Media
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {/* Preview */}
                <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
                  {item.type === MediaType.IMAGE ? (
                    <img
                      src={item.url}
                      alt={item.filename}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                      controls
                    />
                  )}
                  {/* Status Badge */}
                  {item.status === 'deleted' && (
                    <div className="absolute right-2 top-2 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                      Deleted
                    </div>
                  )}
                  {/* Used in Post Badge */}
                  {item.postId && (
                    <div className="absolute left-2 top-2 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                      Used in Post
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-2xl" role="img" aria-label={item.type}>
                      {getMediaIcon(item.type)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatFileSize(item.fileSize)}
                    </span>
                  </div>
                  <p className="mb-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(item.createdAt)}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-center text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      View
                    </a>
                    {item.status === UPLOADED_MEDIA_STATUS.ACTIVE && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
