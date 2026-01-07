'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getChannels, createAndPublishToThreads } from '@/lib/api/channels'
import type { Channel } from '@/lib/api/channels'
import { Platform } from '@/database/entities/enums'

type PublishMode = 'now' | 'schedule'
type MediaKind = 'image' | 'video' | null

interface MediaPreview {
  type: MediaKind
  url: string
  file?: File
  blobUrl?: string // Track blob URL for cleanup
}

export default function CreatePostPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [content, setContent] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [hasSetDefaultSchedule, setHasSetDefaultSchedule] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null)
  const [altText, setAltText] = useState('')
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [mediaTypeSelector, setMediaTypeSelector] = useState<'image' | 'video' | null>(null)
  const [isFetchingDouyin, setIsFetchingDouyin] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Set default scheduled time to UTC+7 when switching to schedule mode
  useEffect(() => {
    if (publishMode === 'schedule' && !hasSetDefaultSchedule) {
      // Get current time in UTC+7 (Indochina Time)
      const now = new Date()
      // Add 7 hours offset and adjust for browser timezone
      const utcPlus7 = new Date(now.getTime() + (7 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000))
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      const formatted = utcPlus7.toISOString().slice(0, 16)
      setScheduledFor(formatted)
      setHasSetDefaultSchedule(true)
    } else if (publishMode === 'now') {
      // Clear scheduled time and reset flag when switching back to "now" mode
      setScheduledFor('')
      setHasSetDefaultSchedule(false)
    }
  }, [publishMode, hasSetDefaultSchedule])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (mediaPreview?.blobUrl) {
        URL.revokeObjectURL(mediaPreview.blobUrl)
      }
    }
  }, [mediaPreview?.blobUrl])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setError('Please select an image or video file')
      return
    }

    // Check file size (max 50MB for Threads)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB')
      return
    }

    setError('')

    // Revoke previous blob URL if exists to prevent memory leak
    if (mediaPreview?.blobUrl) {
      URL.revokeObjectURL(mediaPreview.blobUrl)
    }

    // Create preview URL
    const blobUrl = URL.createObjectURL(file)

    setMediaPreview({
      type: isImage ? 'image' : 'video',
      url: blobUrl,
      file,
      blobUrl,
    })

    // Clear URL input when file is selected
    setMediaUrlInput('')
  }

  const handleMediaUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setMediaUrlInput(url)
    setMediaTypeSelector(null)

    if (!url) {
      setMediaPreview(null)
      return
    }

    // Check if this is a Douyin URL
    const isDouyinUrl = /douyin\.com|iesdouyin\.com/i.test(url)

    if (isDouyinUrl) {
      // Fetch Douyin download URL
      setIsFetchingDouyin(true)
      setError('')

      try {
        const response = await fetch('/api/parse/douyin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.message || 'Failed to parse Douyin URL')
        }

        const { type, downloadUrl, imageUrl, videoDesc } = data.data

        // Set preview with download URL
        if (type === 'video' && downloadUrl) {
          setMediaPreview({ type: 'video', url: downloadUrl })
        } else if (type === 'image' && imageUrl && imageUrl.length > 0) {
          setMediaPreview({ type: 'image', url: imageUrl[0] })
        } else {
          throw new Error('No media URL found in Douyin response')
        }

        // Optionally pre-fill content with video description
        if (videoDesc && !content) {
          setContent(videoDesc)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse Douyin URL')
        setMediaPreview(null)
      } finally {
        setIsFetchingDouyin(false)
      }

      // Clear file input when URL is entered
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Regular URL handling (non-Douyin)
    // Detect type from URL extension or query params
    const isImage = /\.(jpg|jpeg|png|gif|webp|avif|bmp)$/i.test(url) ||
                    /[?&](format|ext)=jpg($|&)/i.test(url) ||
                    url.includes('/image/') ||
                    url.includes('/images/')
    const isVideo = /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v|ogv|ts)$/i.test(url) ||
                    /[?&](format|ext)=mp4($|&)/i.test(url) ||
                    url.includes('/video/') ||
                    url.includes('/videos/')

    if (isImage) {
      setMediaPreview({ type: 'image', url })
    } else if (isVideo) {
      setMediaPreview({ type: 'video', url })
    } else {
      // Unknown type - show selector for user to choose
      setMediaPreview(null)
      setMediaTypeSelector(null)
    }

    // Clear file input when URL is entered
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleMediaTypeSelect = (type: 'image' | 'video') => {
    if (!mediaUrlInput) return
    setMediaPreview({ type, url: mediaUrlInput })
    setMediaTypeSelector(type)
  }

  const clearMedia = () => {
    // Revoke blob URL to prevent memory leak
    if (mediaPreview?.blobUrl) {
      URL.revokeObjectURL(mediaPreview.blobUrl)
    }
    setMediaPreview(null)
    setAltText('')
    setMediaUrlInput('')
    setMediaTypeSelector(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!content.trim() && !mediaPreview) {
      setError('Please enter content or attach media')
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
      // Use preview URL (contains download_url for Douyin, or blob URL for file uploads)
      let finalMediaUrl: string | undefined = mediaPreview?.url

      // If a file was selected, upload it to R2 via server proxy
      if (mediaPreview?.file) {
        const formData = new FormData()
        formData.append('file', mediaPreview.file)

        const uploadResponse = await fetch('/api/upload/proxy', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.message || 'File upload failed')
        }

        const uploadData = await uploadResponse.json()

        if (!uploadData.success) {
          throw new Error(uploadData.message || 'File upload failed')
        }

        finalMediaUrl = uploadData.data.url
      }

      if (publishMode === 'now') {
        // Publish immediately
        const result = await createAndPublishToThreads(content, selectedChannel, {
          imageUrl: mediaPreview?.type === 'image' ? finalMediaUrl : undefined,
          videoUrl: mediaPreview?.type === 'video' ? finalMediaUrl : undefined,
          altText: altText || undefined,
        })
        setSuccessMessage(
          `Post published successfully! View it at: ${result.platformUrl}`
        )

        // Clear form
        setContent('')
        setSelectedChannel('')
        clearMedia()

        // Redirect after 3 seconds
        setTimeout(() => {
          router.push('/channels')
        }, 3000)
      } else {
        // Schedule post
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            scheduledFor,
            imageUrl: mediaPreview?.type === 'image' ? finalMediaUrl : undefined,
            videoUrl: mediaPreview?.type === 'video' ? finalMediaUrl : undefined,
            altText: altText || undefined,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to schedule post')
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.message || 'Failed to schedule post')
        }

        setSuccessMessage(`Post scheduled for ${new Date(scheduledFor).toLocaleString()}`)

        // Clear form
        setContent('')
        setSelectedChannel('')
        setScheduledFor('')
        setPublishMode('now')
        clearMedia()

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
                  <label htmlFor="channel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Publishing Channel
                  </label>
                  <select
                    id="channel"
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">Select channel (optional)</option>
                    {threadsChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        @{channel.username} {channel.status !== 'active' && `(${channel.status})`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    When scheduled, the post will be published to your first active Threads account if not specified
                  </p>
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
                    onChange={(e) => {
                      setScheduledFor(e.target.value)
                      setHasSetDefaultSchedule(true)
                    }}
                    min={scheduledFor || new Date().toISOString().slice(0, 16)}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    required
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Timezone: UTC+7 (Indochina Time). Select a future date and time to publish this post automatically.
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
                />
                <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
                  {content.length}/500 characters
                </p>
              </div>

              {/* Media Upload Section */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Attach Media (Optional)
                </label>

                {!mediaPreview ? (
                  <div className="space-y-4">
                    {/* File Upload */}
                    <div className="flex items-center gap-4">
                      <label className="flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <div className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-zinc-300 px-4 py-3 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
                          <svg className="mr-2 h-5 w-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Upload Image or Video
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>or</span>
                      <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                    </div>

                    {/* URL Input */}
                    <div>
                      <input
                        type="text"
                        value={mediaUrlInput}
                        onChange={handleMediaUrlChange}
                        placeholder="Paste image or video URL... (Douyin links supported)"
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        disabled={isFetchingDouyin}
                      />
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Supports: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV, AVI, Douyin links
                        </p>
                        {isFetchingDouyin && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Fetching Douyin URL...
                          </p>
                        )}
                      </div>

                      {/* Type Selector - shown when URL entered but type not detected */}
                      {mediaUrlInput && !mediaPreview && !isFetchingDouyin && (
                        <div className="mt-3 rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
                          <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                            Couldn't detect media type. Please select:
                          </p>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => handleMediaTypeSelect('image')}
                              className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
                            >
                              📷 Image
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMediaTypeSelect('video')}
                              className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
                            >
                              🎥 Video
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {mediaPreview.type === 'image' ? (
                          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {mediaPreview.type === 'image' ? 'Image' : 'Video'} selected
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearMedia}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Preview */}
                    <div className="mb-3 overflow-hidden rounded-md bg-black">
                      {mediaPreview.type === 'image' ? (
                        <img
                          src={mediaPreview.url}
                          alt="Preview"
                          className="max-h-64 w-full object-contain"
                        />
                      ) : (
                        <video
                          src={mediaPreview.url}
                          controls
                          className="max-h-64 w-full object-contain"
                        />
                      )}
                    </div>

                    {/* Alt Text Input */}
                    <div>
                      <label htmlFor="altText" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Alt Text (for accessibility)
                      </label>
                      <input
                        type="text"
                        id="altText"
                        value={altText}
                        onChange={(e) => setAltText(e.target.value)}
                        placeholder="Describe the image/video for screen readers..."
                        maxLength={500}
                        className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                )}
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
                disabled={isPublishing || (publishMode === 'now' ? !selectedChannel : !scheduledFor) || (!content.trim() && !mediaPreview)}
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
