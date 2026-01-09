'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getChannels } from '@/lib/api/channels'
import type { Channel } from '@/lib/api/channels'
import { Platform, PostStatus, ContentType } from '@/database/entities/enums'
import { utcToUtcPlus7Input } from '@/lib/utils/timezone'

import { PublishModeSelector } from '../../new/components/PublishModeSelector'
import { ChannelSelector } from '../../new/components/ChannelSelector'
import { ContentTypeSelector } from '../../new/components/ContentTypeSelector'
import { ContentTextarea } from '../../new/components/ContentTextarea'
import { SingleMediaSection } from '../../new/components/SingleMediaSection'
import { CarouselMediaSection } from '../../new/components/CarouselMediaSection'
import { ScheduledCommentsSection } from '../../new/components/ScheduledCommentsSection'
import { AdvancedOptionsSection } from '../../new/components/AdvancedOptionsSection'

import { useMediaUpload } from '@/lib/hooks/useMediaUpload'
import { useCarouselMedia } from '@/lib/hooks/useCarouselMedia'
import { useScheduledComments } from '@/lib/hooks/useScheduledComments'

import type { PublishMode, PostContentType, ThreadsOptions, PollOptions, CarouselMediaItem } from '@/lib/types/posts'
import { CAROUSEL } from '@/lib/constants'

interface PostDetail {
  id: string
  content: string
  status: PostStatus
  contentType: ContentType
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  isScheduled: boolean
  errorMessage: string | null
  retryCount: number
  parentPostId?: string | null
  commentDelayMinutes?: number | null
  childComments?: Array<{
    id: string
    content: string
    status: PostStatus
    scheduledAt: string | null
    commentDelayMinutes: number | null
    media?: Array<{
      id: string
      type: string
      url: string
      thumbnailUrl?: string
      altText?: string
    }>
  }>
  publications?: Array<{
    id: string
    platform: string
    status: string
    platformPostId: string | null
    publishedAt: string | null
  }>
  media?: Array<{
    id: string
    type: string
    url: string
    order: number
    thumbnailUrl?: string
    altText?: string
  }>
  socialAccountId?: string | null
}

function contentTypeToPostContentType(contentType: ContentType): PostContentType {
  if (contentType === ContentType.CAROUSEL) return 'carousel'
  return 'single'
}

function postContentTypeToContentType(contentType: PostContentType): ContentType {
  if (contentType === 'carousel') return ContentType.CAROUSEL
  if (contentType === 'single') return ContentType.IMAGE
  return ContentType.TEXT
}

export default function EditPostPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useParams()
  const id = router.id as string
  const navigator = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [isLoadingPost, setIsLoadingPost] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [post, setPost] = useState<PostDetail | null>(null)

  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [contentType, setContentType] = useState<PostContentType>('single')
  const [content, setContent] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [threadsOptions, setThreadsOptions] = useState<ThreadsOptions>({})
  const [pollOptions, setPollOptions] = useState<PollOptions>({
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
  })

  const {
    mediaPreview,
    setMediaPreview,
    altText,
    setAltText,
    mediaUrlInput,
    isFetchingDouyin: isFetchingSingleDouyin,
    fileInputRef,
    handleFileSelect,
    handleMediaUrlChange,
    handleMediaTypeSelect,
    clearMedia,
  } = useMediaUpload({
    onError: setError,
  })

  const {
    carouselMediaItems,
    setCarouselMediaItems,
    draggedItem,
    carouselUrlInput,
    isFetchingDouyin: isFetchingCarouselDouyin,
    pendingCarouselUrlType,
    removeCarouselMediaItem,
    updateCarouselItemAltText,
    updateCarouselItemSourceUrl,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleCarouselFileSelect,
    handleCarouselUrlChange,
    handleAddCarouselUrlByType,
  } = useCarouselMedia(setError)

  const {
    scheduledComments,
    addScheduledComment,
    removeScheduledComment,
    updateScheduledComment,
    handleCommentMediaSelect,
    removeCommentMedia,
    setScheduledComments,
  } = useScheduledComments()

  // Load post data
  useEffect(() => {
    const loadPost = async () => {
      if (!id) return

      setIsLoadingPost(true)
      try {
        const response = await fetch(`/api/posts/${id}`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.message || 'Failed to load post')
        }

        const postData = data.data as PostDetail

        // Don't allow editing published posts
        if (postData.status === PostStatus.PUBLISHED) {
          setError('Cannot edit published posts')
          return
        }

        setPost(postData)

        // Initialize form fields
        setContent(postData.content)
        setContentType(contentTypeToPostContentType(postData.contentType))

        // Set publish mode and scheduled time
        if (postData.isScheduled && postData.scheduledAt) {
          setPublishMode('schedule')
          setScheduledFor(utcToUtcPlus7Input(postData.scheduledAt))
        } else {
          setPublishMode('now')
        }

        // Load media if exists
        if (postData.media && postData.media.length > 0) {
          if (postData.contentType === ContentType.CAROUSEL) {
            // Sort by the order field from the database
            const items: CarouselMediaItem[] = postData.media
              .sort((a, b) => a.order - b.order)
              .map((m) => ({
                id: Math.random().toString(36).substring(7),
                type: m.type === 'IMAGE' ? 'image' : 'video',
                url: m.url,
                altText: m.altText || '',
              }))
            setCarouselMediaItems(items)
          } else {
            const media = postData.media[0]
            setMediaPreview({
              type: media.type === 'IMAGE' ? 'image' : 'video',
              url: media.url,
              altText: media.altText || '',
            })
            setAltText(media.altText || '')
          }
        }

        // Load scheduled comments
        if (postData.childComments && postData.childComments.length > 0) {
          const commentsWithMedia = postData.childComments.map(c => {
            const commentData = {
              id: Math.random().toString(36).substring(7),
              content: c.content,
              delayMinutes: c.commentDelayMinutes || 0,
            }

            // Load media if exists
            if (c.media && c.media.length > 0) {
              const media = c.media[0]
              return {
                ...commentData,
                mediaType: media.type === 'IMAGE' ? 'image' as const : 'video' as const,
                mediaPreview: media.url,
                altText: media.altText || '',
              }
            }

            return commentData
          })
          setScheduledComments(commentsWithMedia)
        }

        setSelectedChannel(postData.socialAccountId || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setIsLoadingPost(false)
      }
    }

    if (isAuthenticated) {
      loadPost()
    }
  }, [id, isAuthenticated])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigator.push('/login')
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
  }, [isLoading, isAuthenticated, navigator])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!id) {
      setError('Post ID is missing')
      return
    }

    setIsSubmitting(true)

    try {
      const requestBody: Record<string, unknown> = {
        content,
        contentType: postContentTypeToContentType(contentType),
        socialAccountId: selectedChannel || null,
      }

      if (publishMode === 'schedule' && scheduledFor) {
        requestBody.scheduledFor = scheduledFor
      } else {
        requestBody.scheduledFor = null
      }

      // Add media data
      if (contentType === 'carousel') {
        requestBody.carouselMediaItems = carouselMediaItems.map((item) => ({
          type: item.type,
          url: item.url,
          altText: item.altText,
        }))
      } else if (mediaPreview) {
        if (mediaPreview.type === 'image') {
          requestBody.imageUrl = mediaPreview.url
          requestBody.altText = altText
        } else if (mediaPreview.type === 'video') {
          requestBody.videoUrl = mediaPreview.url
          requestBody.altText = altText
        }
      }

      // Add threads options
      if (Object.keys(threadsOptions).length > 0) {
        requestBody.threadsOptions = threadsOptions
      }

      // Add scheduled comments
      if (scheduledComments.length > 0) {
        requestBody.scheduledComments = scheduledComments.map((c) => ({
          content: c.content,
          delayMinutes: c.delayMinutes,
          imageUrl: c.mediaType === 'image' ? c.mediaPreview : undefined,
          videoUrl: c.mediaType === 'video' ? c.mediaPreview : undefined,
          altText: c.altText,
        }))
      }

      const response = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to update post')
      }

      setSuccessMessage('Post updated successfully!')

      setTimeout(() => {
        navigator.push('/posts/scheduled')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingPost || isLoadingChannels) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {isLoadingPost ? 'Loading post...' : 'Loading channels...'}
          </p>
        </div>
      </div>
    )
  }

  const threadsChannels = channels.filter((ch) => ch.platform === Platform.THREADS)

  const isSubmitDisabled =
    (publishMode === 'schedule' ? !scheduledFor : false) ||
    (contentType === 'carousel'
      ? carouselMediaItems.length < CAROUSEL.MIN_ITEMS || carouselMediaItems.length > CAROUSEL.MAX_ITEMS
      : !content.trim() && !mediaPreview)

  const handleUseCoverImage = () => {
    if (mediaPreview?.type === 'video' && mediaPreview.coverImageUrl) {
      setMediaPreview({
        type: 'image',
        url: mediaPreview.coverImageUrl,
        coverImageUrl: mediaPreview.coverImageUrl,
      })
    }
  }

  const handleClearCarousel = () => {
    setCarouselMediaItems([])
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              Edit Post
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Update your scheduled post content
            </p>
          </div>
          <Link
            href="/posts/scheduled"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Scheduled
          </Link>
        </div>
      </div>

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

        {post && post.status === PostStatus.PUBLISHED ? (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-4 text-6xl">🔒</div>
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Cannot Edit Published Post
            </h3>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              This post has already been published and cannot be modified.
            </p>
            <Link
              href="/posts/scheduled"
              className="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Back to Scheduled Posts
            </Link>
          </div>
        ) : threadsChannels.length === 0 ? (
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
              <PublishModeSelector
                publishMode={publishMode}
                onChange={setPublishMode}
                name="editPublishMode"
              />

              <ChannelSelector
                channels={threadsChannels}
                selectedChannel={selectedChannel}
                publishMode={publishMode}
                scheduledFor={scheduledFor}
                onChannelChange={setSelectedChannel}
                onScheduledForChange={setScheduledFor}
                idPrefix="edit"
              />

              <ContentTypeSelector
                contentType={contentType}
                onChange={setContentType}
                onClearMedia={clearMedia}
                onClearCarousel={handleClearCarousel}
              />

              <ContentTextarea
                content={content}
                onChange={setContent}
                isOptional={contentType === 'carousel'}
              />

              {contentType !== 'carousel' && (
                <SingleMediaSection
                  mediaPreview={mediaPreview}
                  altText={altText}
                  mediaUrlInput={mediaUrlInput}
                  isFetchingDouyin={isFetchingSingleDouyin}
                  fileInputRef={fileInputRef}
                  onAltTextChange={setAltText}
                  onFileSelect={handleFileSelect}
                  onUrlChange={handleMediaUrlChange}
                  onMediaTypeSelect={handleMediaTypeSelect}
                  onClearMedia={clearMedia}
                  onUseCoverImage={handleUseCoverImage}
                />
              )}

              {contentType === 'carousel' && (
                <CarouselMediaSection
                  carouselMediaItems={carouselMediaItems}
                  draggedItem={draggedItem}
                  carouselUrlInput={carouselUrlInput}
                  isFetchingDouyin={isFetchingCarouselDouyin}
                  pendingCarouselUrlType={pendingCarouselUrlType}
                  onFileSelect={handleCarouselFileSelect}
                  onUrlChange={handleCarouselUrlChange}
                  onAddUrlByType={handleAddCarouselUrlByType}
                  onRemoveItem={removeCarouselMediaItem}
                  onUpdateAltText={updateCarouselItemAltText}
                  onUpdateSourceUrl={updateCarouselItemSourceUrl}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              )}

              <AdvancedOptionsSection
                showAdvancedOptions={showAdvancedOptions}
                onToggle={() => setShowAdvancedOptions(!showAdvancedOptions)}
                threadsOptions={threadsOptions}
                pollOptions={pollOptions}
                onThreadsOptionsChange={setThreadsOptions}
                onPollOptionsChange={setPollOptions}
              />

              <ScheduledCommentsSection
                scheduledComments={scheduledComments}
                onAddComment={addScheduledComment}
                onRemoveComment={removeScheduledComment}
                onUpdateComment={updateScheduledComment}
                onMediaSelect={handleCommentMediaSelect}
                onRemoveMedia={removeCommentMedia}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link
                href="/posts/scheduled"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitDisabled || isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
