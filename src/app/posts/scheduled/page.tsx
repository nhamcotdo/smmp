'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { PostStatus } from '@/database/entities/enums'

interface ScheduledPost {
  id: string
  content: string
  status: PostStatus
  scheduledAt: string | null
  createdAt: string
  isScheduled: boolean
  publications?: {
    platform: string
    status: string
  }[]
}

export default function ScheduledPostsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editScheduleTime, setEditScheduleTime] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated) {
      loadScheduledPosts()
    }
  }, [isLoading, isAuthenticated])

  async function loadScheduledPosts() {
    setIsLoadingPosts(true)
    setError('')
    try {
      const response = await fetch('/api/posts?scheduled=true&limit=50')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message)
      }

      setPosts(data.data.posts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled posts')
    } finally {
      setIsLoadingPosts(false)
    }
  }

  async function handleUpdateSchedule(postId: string, scheduledFor: string) {
    setError('')
    setSuccessMessage('')

    if (!scheduledFor) {
      setError('Schedule time is required')
      return
    }

    const scheduleDate = new Date(scheduledFor)
    if (scheduleDate <= new Date()) {
      setError('Schedule time must be in the future')
      return
    }

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message)
      }

      setSuccessMessage('Schedule updated successfully')
      setEditingPost(null)
      setEditScheduleTime('')
      await loadScheduledPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule')
    }
  }

  async function handleUnschedule(postId: string) {
    if (!confirm('Are you sure you want to unschedule this post? It will be saved as a draft.')) {
      return
    }

    setError('')
    setSuccessMessage('')

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: null }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message)
      }

      setSuccessMessage('Post unscheduled successfully')
      await loadScheduledPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unschedule post')
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Are you sure you want to delete this post?')) {
      return
    }

    setError('')
    setSuccessMessage('')

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message)
      }

      setSuccessMessage('Post deleted successfully')
      await loadScheduledPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
    }
  }

  function formatScheduleTime(dateStr: string | null) {
    if (!dateStr) return 'Not scheduled'
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  function getTimeUntilSchedule(dateStr: string | null) {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()

    if (diffMs < 0) return 'Past due'

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (diffDays === 0) {
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      if (diffHours === 0) {
        return `In ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`
      }
      return `In ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
    }
    return `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`
  }

  function getStatusBadge(status: PostStatus) {
    const styles: Record<PostStatus, string> = {
      [PostStatus.DRAFT]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200',
      [PostStatus.SCHEDULED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
      [PostStatus.PUBLISHING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
      [PostStatus.PUBLISHED]: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200',
      [PostStatus.FAILED]: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200',
      [PostStatus.CANCELLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200',
    }

    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[status] || styles[PostStatus.DRAFT]}`}>
        {status.toLowerCase()}
      </span>
    )
  }

  if (isLoading || isLoadingPosts) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="bg-white dark:bg-zinc-900 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Scheduled Posts
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Manage your scheduled content
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/posts/new"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                + New Post
              </Link>
              <Link
                href="/channels"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Channels
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

        {posts.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-4 text-6xl">📅</div>
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              No scheduled posts
            </h3>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Schedule posts to be published automatically at a future date
            </p>
            <Link
              href="/posts/new"
              className="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Schedule Your First Post
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      {getStatusBadge(post.status)}
                      {post.scheduledAt && (
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {getTimeUntilSchedule(post.scheduledAt)}
                        </span>
                      )}
                    </div>
                    <p className="mb-3 text-sm text-zinc-900 dark:text-zinc-100 line-clamp-3">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <span>
                        Scheduled for: <strong>{formatScheduleTime(post.scheduledAt)}</strong>
                      </span>
                      {post.publications && post.publications.length > 0 && (
                        <span>
                          Platforms: {post.publications.map((p) => p.platform).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    {editingPost === post.id ? (
                      <>
                        <input
                          type="datetime-local"
                          value={editScheduleTime}
                          onChange={(e) => setEditScheduleTime(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateSchedule(post.id, editScheduleTime)}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingPost(null)
                              setEditScheduleTime('')
                            }}
                            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingPost(post.id)
                            setEditScheduleTime(post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '')
                          }}
                          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleUnschedule(post.id)}
                          className="rounded-md border border-yellow-300 px-3 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-900/20"
                        >
                          Unschedule
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
