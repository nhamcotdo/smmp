'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getChannels, createAndPublishToThreads } from '@/lib/api/channels'
import type { Channel } from '@/lib/api/channels'
import { Platform } from '@/database/entities/enums'

type PublishMode = 'now' | 'schedule'

export default function CreatePostPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [content, setContent] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Load channels on mount
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated) {
      getChannels()
        .then((data) => {
          setChannels(data.filter((ch) => ch.platform === Platform.THREADS && ch.status === 'active'))
          setIsLoadingChannels(false)
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load channels')
          setIsLoadingChannels(false)
        })
    }
  }, [isLoading, isAuthenticated])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!content.trim()) {
      setError('Please enter some content for your post')
      return
    }

    if (publishMode === 'now' && !selectedChannel) {
      setError('Please select a Threads channel to publish to')
      return
    }

    if (publishMode === 'schedule' && !scheduledFor) {
      setError('Please select a date and time to schedule')
      return
    }

    if (publishMode === 'schedule' && new Date(scheduledFor) <= new Date()) {
      setError('Schedule time must be in the future')
      return
    }

    setIsPublishing(true)

    try {
      if (publishMode === 'now') {
        // Publish immediately
        const result = await createAndPublishToThreads(content, selectedChannel)
        setSuccessMessage(
          `Post published successfully! View it at: ${result.platformUrl}`
        )

        // Clear form
        setContent('')
        setSelectedChannel('')

        // Redirect after 3 seconds
        setTimeout(() => {
          router.push('/channels')
        }, 3000)
      } else {
        // Schedule post
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, scheduledFor }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.message)
        }

        setSuccessMessage('Post scheduled successfully!')

        // Clear form
        setContent('')
        setSelectedChannel('')
        setScheduledFor('')
        setPublishMode('now')

        // Redirect after 2 seconds
        setTimeout(() => {
          router.push('/posts/scheduled')
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post')
    } finally {
      setIsPublishing(false)
    }
  }

  if (isLoading || isLoadingChannels) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const threadsChannels = channels.filter((ch) => ch.platform === Platform.THREADS)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="bg-white dark:bg-zinc-900 shadow-sm">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Create Post
            </h1>
            <Link
              href="/channels"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back to Channels
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
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

        {threadsChannels.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-4 text-6xl">🧵</div>
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              No Threads channels connected
            </h3>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Connect your Threads account first to publish posts
            </p>
            <Link
              href="/channels"
              className="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Go to Channels
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              {/* Publish Mode Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Publish Mode
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="publishMode"
                      value="now"
                      checked={publishMode === 'now'}
                      onChange={(e) => setPublishMode(e.target.value as PublishMode)}
                      className="mr-2"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Publish Now</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="publishMode"
                      value="schedule"
                      checked={publishMode === 'schedule'}
                      onChange={(e) => setPublishMode(e.target.value as PublishMode)}
                      className="mr-2"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Schedule for Later</span>
                  </label>
                </div>
              </div>

              {publishMode === 'now' && (
                <div className="mb-4">
                  <label htmlFor="channel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Select Threads Channel
                  </label>
                  <select
                    id="channel"
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    required
                  >
                    <option value="">Choose a channel...</option>
                    {threadsChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        @{channel.username} {channel.status !== 'active' && `(${channel.status})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {publishMode === 'schedule' && (
                <div className="mb-4">
                  <label htmlFor="scheduledFor" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Schedule Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    id="scheduledFor"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    required
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Select a future date and time to publish this post automatically
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Post Content
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  maxLength={500}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="What's on your mind?"
                  required
                />
                <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
                  {content.length}/500 characters
                </p>
              </div>

              <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {publishMode === 'now' ? (
                    <>
                      <strong>Tip:</strong> Your post will be published immediately to your Threads
                      account. Make sure your content follows Threads community guidelines.
                    </>
                  ) : (
                    <>
                      <strong>Scheduled:</strong> Your post will be automatically published at the
                      scheduled time. A background job will handle the publishing.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Link
                href="/channels"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isPublishing || (publishMode === 'now' ? !selectedChannel : !scheduledFor) || !content.trim()}
                className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing
                  ? (publishMode === 'now' ? 'Publishing...' : 'Scheduling...')
                  : (publishMode === 'now' ? 'Publish to Threads' : 'Schedule Post')
                }
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
