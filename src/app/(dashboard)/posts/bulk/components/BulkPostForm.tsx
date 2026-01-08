import React, { useState, useEffect, FormEvent, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createAndPublishToThreads } from '@/lib/api/channels'
import { uploadMediaFile, uploadCarouselMediaItems } from '@/lib/utils/media-upload'
import { buildThreadsOptionsFromForm } from '@/lib/utils/threads-options'
import { ContentTypeSelector } from '../../new/components/ContentTypeSelector'
import { ContentTextarea } from '../../new/components/ContentTextarea'
import { SingleMediaSection } from '../../new/components/SingleMediaSection'
import { CarouselMediaSection } from '../../new/components/CarouselMediaSection'
import { AdvancedOptionsSection } from '../../new/components/AdvancedOptionsSection'
import { ScheduledCommentsSection } from '../../new/components/ScheduledCommentsSection'
import { PublishModeSelector } from '../../new/components/PublishModeSelector'
import { ChannelSelector } from '../../new/components/ChannelSelector'

import type { Channel } from '@/lib/api/channels'
import type { PublishMode, PostContentType, MediaPreview, CarouselMediaItem, ScheduledComment, ThreadsOptions, PollOptions, BulkPostFormData } from '@/lib/types/posts'

interface BulkPostItem {
  id: string
  douyinUrl: string
  parsedData: {
    type: 'video' | 'image'
    downloadUrl: string
    imageUrl: string[]
    videoDesc: string
  } | null
  isParsing: boolean
  parseError: string
}

interface PostFormData {
  content: string
  contentType: PostContentType
  mediaPreview: MediaPreview | null
  altText: string
  carouselMediaItems: CarouselMediaItem[]
  threadsOptions: ThreadsOptions
  pollOptions: PollOptions
  scheduledComments: ScheduledComment[]
  publishMode: PublishMode
  selectedChannel: string
  scheduledFor: string
}

interface BulkPostFormProps {
  items: BulkPostItem[]
  publishMode: PublishMode
  selectedChannel: string
  scheduledFor: string
  channels: Channel[]
  _onPublishModeChange: (mode: PublishMode) => void
  _onChannelChange: (channel: string) => void
  _onScheduledForChange: (date: string) => void
  onRemoveItem: (id: string) => void
  onAddManualPost: () => void
  onAddMoreUrls: () => void
  onCancel: () => void
  onSubmit: (formData: BulkPostFormData[]) => Promise<{ created: number; failed: number; errors: Array<{ index: number; error: string }> }>
  onSuccess: (message: string) => void
  onError: (error: string) => void
}

const DEFAULT_POLL_OPTIONS: PollOptions = {
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
}

const DEFAULT_THREADS_OPTIONS: ThreadsOptions = {}

export function BulkPostForm({
  items,
  publishMode,
  selectedChannel,
  scheduledFor,
  channels,
  _onPublishModeChange,
  _onChannelChange,
  _onScheduledForChange,
  onRemoveItem,
  onAddManualPost,
  onAddMoreUrls,
  onCancel,
  onSubmit,
  onSuccess,
  onError,
}: BulkPostFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const [formsData, setFormsData] = useState<Record<string, PostFormData>>({})

  // Memoize updateFormData to prevent infinite loops
  const updateFormData = useCallback((id: string, updates: Partial<PostFormData>) => {
    setFormsData(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }))
  }, [])

  // Initialize form data when parsed data is available or for manual posts
  // Only run when items, publishMode, selectedChannel, or scheduledFor change
  // NOT when formsData changes (prevents infinite loop)
  useEffect(() => {
    items.forEach(item => {
      // Only initialize if this specific item doesn't have data yet
      if (!formsData[item.id]) {
        // Manual post (no parsed data)
        if (!item.parsedData) {
          updateFormData(item.id, {
            content: '',
            contentType: 'carousel' as PostContentType,
            mediaPreview: null,
            altText: '',
            carouselMediaItems: [],
            threadsOptions: { ...DEFAULT_THREADS_OPTIONS },
            pollOptions: { ...DEFAULT_POLL_OPTIONS },
            scheduledComments: [],
            publishMode,
            selectedChannel,
            scheduledFor,
          })
        } else {
          // Post from parsed Douyin data
          const { parsedData } = item
          const desc = parsedData.videoDesc || ''

          // Default to carousel for all posts
          const carouselItems: CarouselMediaItem[] = []

          if (parsedData.type === 'video' && parsedData.downloadUrl) {
            // Add video as first carousel item
            carouselItems.push({
              id: `video-0`,
              type: 'video',
              url: parsedData.downloadUrl,
              altText: desc,
              sourceUrl: item.douyinUrl,
            })
          }

          // Add all images to carousel
          if (parsedData.imageUrl.length > 0) {
            parsedData.imageUrl.forEach((url, index) => {
              carouselItems.push({
                id: `img-${index}`,
                type: 'image',
                url,
                altText: desc,
                sourceUrl: item.douyinUrl,
              })
            })
          }

          // Initialize as carousel
          updateFormData(item.id, {
            content: desc,
            contentType: 'carousel' as PostContentType,
            mediaPreview: null,
            altText: '',
            carouselMediaItems: carouselItems,
            threadsOptions: { ...DEFAULT_THREADS_OPTIONS },
            pollOptions: { ...DEFAULT_POLL_OPTIONS },
            scheduledComments: [],
            publishMode,
            selectedChannel,
            scheduledFor,
          })
        }
      }
    })
  }, [items, publishMode, selectedChannel, scheduledFor, updateFormData]) // formsData removed

  const handleSubmitAll = async (e: FormEvent) => {
    e.preventDefault()

    // Validate at least one post is ready
    const validPosts = items.filter(item => {
      const data = formsData[item.id]
      if (!data) return false

      // Validate content or media exists
      if (!data.content?.trim() && !data.mediaPreview && data.carouselMediaItems.length === 0) {
        return false
      }

      // Validate carousel has minimum items
      if (data.contentType === 'carousel' && data.carouselMediaItems.length < 2) {
        return false
      }

      if (data.publishMode === 'now' && !data.selectedChannel) return false
      if (data.publishMode === 'schedule' && !data.scheduledFor) return false

      return true
    })

    if (validPosts.length === 0) {
      onError('Please add content or media to at least one post before submitting')
      return
    }

    setIsSubmitting(true)

    try {
      const formData: BulkPostFormData[] = []
      let successCount = 0
      let failCount = 0

      for (const item of items) {
        const data = formsData[item.id]
        if (!data) continue

        // Skip if this post doesn't have required settings
        if (data.publishMode === 'now' && !data.selectedChannel) continue
        if (data.publishMode === 'schedule' && !data.scheduledFor) continue

        try {
          if (data.publishMode === 'now') {
            // Publish immediately
            let finalMediaUrl: string | undefined = data.mediaPreview?.url

            if (data.mediaPreview?.file) {
              finalMediaUrl = await uploadMediaFile(data.mediaPreview.file)
            }

            const builtThreadsOptions = buildThreadsOptionsFromForm(data.threadsOptions, data.pollOptions)

            if (data.contentType === 'carousel') {
              const finalCarouselMedia = await uploadCarouselMediaItems(data.carouselMediaItems)
              await createAndPublishToThreads(data.content, data.selectedChannel, {
                carouselMediaItems: finalCarouselMedia,
                threadsOptions: Object.keys(builtThreadsOptions).length > 0 ? builtThreadsOptions : undefined,
                scheduledComments: data.scheduledComments.length > 0 ? data.scheduledComments : undefined,
              })
            } else {
              await createAndPublishToThreads(data.content, data.selectedChannel, {
                imageUrl: data.mediaPreview?.type === 'image' ? finalMediaUrl : undefined,
                videoUrl: data.mediaPreview?.type === 'video' ? finalMediaUrl : undefined,
                altText: data.altText || undefined,
                threadsOptions: Object.keys(builtThreadsOptions).length > 0 ? builtThreadsOptions : undefined,
                scheduledComments: data.scheduledComments.length > 0 ? data.scheduledComments : undefined,
              })
            }
          } else {
            // Schedule post - collect data for bulk API
            let finalCarouselMedia: Array<{ type: 'image' | 'video'; url: string; altText?: string }> | undefined = undefined

            if (data.contentType === 'carousel') {
              finalCarouselMedia = await uploadCarouselMediaItems(data.carouselMediaItems)
            }

            let finalMediaUrl: string | undefined = data.mediaPreview?.url
            if (data.mediaPreview?.file) {
              finalMediaUrl = await uploadMediaFile(data.mediaPreview.file)
            }

            const builtThreadsOptions = buildThreadsOptionsFromForm(data.threadsOptions, data.pollOptions)

            formData.push({
              content: data.content,
              contentType: data.contentType,
              publishMode: data.publishMode,
              socialAccountId: data.selectedChannel,
              scheduledFor: data.publishMode === 'schedule' ? data.scheduledFor : undefined,
              imageUrl: data.contentType !== 'carousel' && data.mediaPreview?.type === 'image' ? finalMediaUrl : undefined,
              videoUrl: data.contentType !== 'carousel' && data.mediaPreview?.type === 'video' ? finalMediaUrl : undefined,
              altText: data.altText || undefined,
              carouselMediaItems: finalCarouselMedia,
              threadsOptions: Object.keys(builtThreadsOptions).length > 0 ? builtThreadsOptions : undefined,
              scheduledComments: data.scheduledComments.length > 0 ? data.scheduledComments : undefined,
            })
          }
          successCount++
        } catch (postError) {
          failCount++
          onError(`Failed to process post #${items.indexOf(item) + 1}: ${postError instanceof Error ? postError.message : 'Unknown error'}`)
        }
      }

      // For schedule mode, call bulk API
      if (formData.length > 0) {
        const result = await onSubmit(formData)
        onSuccess(`Successfully scheduled ${result.created} posts!${result.failed > 0 ? ` Failed: ${result.failed}` : ''}`)
      } else if (successCount > 0) {
        onSuccess(`Successfully published ${successCount} posts!${failCount > 0 ? ` Failed: ${failCount}` : ''}`)
        setTimeout(() => {
          router.push('/channels')
        }, 2000)
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create posts')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmitAll} className="space-y-6">
      {/* Header with post count and action buttons */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Bulk Posts ({items.length})
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAddManualPost}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 dark:bg-green-500 dark:hover:bg-green-400"
            >
              + Manual Post
            </button>
            <button
              type="button"
              onClick={onAddMoreUrls}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              + Add URLs
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Each post has its own settings below. Use the buttons above to add more posts.
        </div>
      </div>

      {/* Individual post forms */}
      {items.map((item, index) => {
        const formData = formsData[item.id]
        if (!formData) return null

        return (
          <BulkPostItemForm
            key={item.id}
            index={index}
            item={item}
            formData={formData}
            channels={channels}
            updateFormData={(updates) => updateFormData(item.id, updates)}
            onRemove={() => onRemoveItem(item.id)}
            onError={onError}
          />
        )
      })}

      {/* Submit button */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:bg-zinc-400 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-zinc-600"
        >
          {isSubmitting ? 'Processing...' : `Create ${items.length} Posts`}
        </button>
      </div>
    </form>
  )
}

interface BulkPostItemFormProps {
  index: number
  item: BulkPostItem
  formData: PostFormData
  channels: Channel[]
  updateFormData: (updates: Partial<PostFormData>) => void
  onRemove: () => void
  onError: (error: string) => void
}

function BulkPostItemForm({ index, item, formData, channels, updateFormData, onRemove, onError }: BulkPostItemFormProps) {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [carouselUrlInput, setCarouselUrlInput] = useState('')
  const [isFetchingDouyin, setIsFetchingDouyin] = useState(false)
  const [isFetchingCarouselDouyin, setIsFetchingCarouselDouyin] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Blob cleanup on unmount
  useEffect(() => {
    return () => {
      if (formData.mediaPreview?.blobUrl) {
        URL.revokeObjectURL(formData.mediaPreview.blobUrl)
      }
      formData.carouselMediaItems?.forEach(item => {
        if (item.blobUrl) {
          URL.revokeObjectURL(item.blobUrl)
        }
      })
      formData.scheduledComments?.forEach(comment => {
        if (comment.mediaPreview) {
          URL.revokeObjectURL(comment.mediaPreview)
        }
      })
    }
  }, [])

  // Media handlers using parent state directly
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      onError('Please select an image or video file')
      return
    }

    const blobUrl = URL.createObjectURL(file)

    updateFormData({
      mediaPreview: {
        type: isImage ? 'image' : 'video',
        url: blobUrl,
        file,
        blobUrl,
      }
    })
  }

  const handleMediaUrlChange = async (url: string) => {
    setMediaUrlInput(url)
    if (!url.trim()) return

    try {
      setIsFetchingDouyin(true)
      const response = await fetch('/api/parse/douyin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) throw new Error('Failed to parse URL')

      const data = await response.json()
      if (!data.success) throw new Error(data.message)

      const parsedData = data.data
      if (parsedData.type === 'video' && parsedData.downloadUrl) {
        updateFormData({
          mediaPreview: {
            type: 'video',
            url: parsedData.downloadUrl,
            ...(parsedData.imageUrl.length > 0 && { coverImageUrl: parsedData.imageUrl[0] })
          }
        })
      } else if (parsedData.type === 'image' && parsedData.imageUrl.length > 0) {
        updateFormData({
          mediaPreview: {
            type: 'image',
            url: parsedData.imageUrl[0]
          }
        })
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to fetch media')
    } finally {
      setIsFetchingDouyin(false)
    }
  }

  const handleMediaTypeSelect = (type: 'image' | 'video') => {
    // Type selection is handled through the form state
    if (type === 'image' && formData.mediaPreview?.type === 'video') {
      if (formData.mediaPreview.coverImageUrl) {
        updateFormData({
          mediaPreview: {
            type: 'image',
            url: formData.mediaPreview.coverImageUrl,
            coverImageUrl: formData.mediaPreview.coverImageUrl,
          }
        })
      }
    }
  }

  const clearMedia = () => {
    if (formData.mediaPreview?.blobUrl) {
      URL.revokeObjectURL(formData.mediaPreview.blobUrl)
    }
    updateFormData({ mediaPreview: null })
  }

  const handleUseCoverImage = () => {
    if (formData.mediaPreview?.type === 'video' && formData.mediaPreview.coverImageUrl) {
      if (formData.mediaPreview.blobUrl) {
        URL.revokeObjectURL(formData.mediaPreview.blobUrl)
      }
      updateFormData({
        mediaPreview: {
          type: 'image',
          url: formData.mediaPreview.coverImageUrl,
          coverImageUrl: formData.mediaPreview.coverImageUrl,
        }
      })
    }
  }

  // Carousel handlers
  const handleCarouselFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newItems: CarouselMediaItem[] = files.map((file, i) => {
      const isImage = file.type.startsWith('image/')
      const blobUrl = URL.createObjectURL(file)

      return {
        id: `upload-${Date.now()}-${i}`,
        type: isImage ? 'image' : 'video',
        url: blobUrl,
        blobUrl,
        file,
      }
    })

    updateFormData({ carouselMediaItems: [...formData.carouselMediaItems, ...newItems] })
  }

  const handleCarouselUrlChange = (url: string) => {
    setCarouselUrlInput(url)
  }

  const handleAddCarouselUrlByType = async (type: 'image' | 'video') => {
    const url = carouselUrlInput.trim()
    if (!url) return

    try {
      if (type === 'image') {
        setIsFetchingCarouselDouyin(true)
        const response = await fetch('/api/parse/douyin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })

        if (!response.ok) throw new Error('Failed to parse URL')

        const data = await response.json()
        if (!data.success) throw new Error(data.message)

        const parsedData = data.data
        if (parsedData.type === 'image' && parsedData.imageUrl.length > 0) {
          const newItems: CarouselMediaItem[] = parsedData.imageUrl.map((imgUrl: string, i: number) => ({
            id: `douyin-${Date.now()}-${i}`,
            type: 'image' as const,
            url: imgUrl,
            sourceUrl: url,
          }))
          updateFormData({ carouselMediaItems: [...formData.carouselMediaItems, ...newItems] })
          setCarouselUrlInput('')
        }
      } else {
        updateFormData({
          carouselMediaItems: [...formData.carouselMediaItems, {
            id: `url-${Date.now()}`,
            type: 'video',
            url,
            sourceUrl: url,
          }]
        })
        setCarouselUrlInput('')
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add media')
    } finally {
      setIsFetchingCarouselDouyin(false)
    }
  }

  const removeCarouselMediaItem = (id: string) => {
    const item = formData.carouselMediaItems.find(i => i.id === id)
    if (item?.blobUrl) {
      URL.revokeObjectURL(item.blobUrl)
    }
    updateFormData({
      carouselMediaItems: formData.carouselMediaItems.filter(i => i.id !== id)
    })
  }

  const updateCarouselItemAltText = (id: string, altText: string) => {
    updateFormData({
      carouselMediaItems: formData.carouselMediaItems.map(item =>
        item.id === id ? { ...item, altText } : item
      )
    })
  }

  const updateCarouselItemSourceUrl = (id: string, sourceUrl: string) => {
    updateFormData({
      carouselMediaItems: formData.carouselMediaItems.map(item =>
        item.id === id ? { ...item, sourceUrl } : item
      )
    })
  }

  const handleDragStart = (id: string) => {
    setDraggedItem(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetId) return

    const items = [...formData.carouselMediaItems]
    const draggedIndex = items.findIndex(i => i.id === draggedItem)
    const targetIndex = items.findIndex(i => i.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const [removed] = items.splice(draggedIndex, 1)
    items.splice(targetIndex, 0, removed)

    updateFormData({ carouselMediaItems: items })
    setDraggedItem(null)
  }

  const handleClearCarousel = () => {
    formData.carouselMediaItems.forEach(item => {
      if (item.blobUrl) {
        URL.revokeObjectURL(item.blobUrl)
      }
    })
    updateFormData({ carouselMediaItems: [] })
  }

  // Scheduled comments handlers
  const addScheduledComment = () => {
    updateFormData({
      scheduledComments: [
        ...formData.scheduledComments,
        {
          id: `comment-${Date.now()}`,
          content: '',
          delayMinutes: formData.scheduledComments.length > 0
            ? formData.scheduledComments[formData.scheduledComments.length - 1].delayMinutes + 5
            : 5,
        }
      ]
    })
  }

  const removeScheduledComment = (id: string) => {
    const comment = formData.scheduledComments.find(c => c.id === id)
    if (comment?.mediaPreview) {
      URL.revokeObjectURL(comment.mediaPreview)
    }
    updateFormData({
      scheduledComments: formData.scheduledComments.filter(c => c.id !== id)
    })
  }

  const updateScheduledComment = (id: string, updates: Partial<ScheduledComment>) => {
    updateFormData({
      scheduledComments: formData.scheduledComments.map(c =>
        c.id === id ? { ...c, ...updates } : c
      )
    })
  }

  const handleCommentMediaSelect = (commentId: string, file: File) => {
    const blobUrl = URL.createObjectURL(file)
    const isImage = file.type.startsWith('image/')

    updateFormData({
      scheduledComments: formData.scheduledComments.map(c =>
        c.id === commentId
          ? {
              ...c,
              mediaPreview: blobUrl,
              mediaType: isImage ? 'image' : 'video',
            }
          : c
      )
    })
  }

  const removeCommentMedia = (commentId: string) => {
    const comment = formData.scheduledComments.find(c => c.id === commentId)
    if (comment?.mediaPreview) {
      URL.revokeObjectURL(comment.mediaPreview)
    }
    updateFormData({
      scheduledComments: formData.scheduledComments.map(c =>
        c.id === commentId
          ? { ...c, mediaPreview: undefined, mediaType: undefined }
          : c
      )
    })
  }

  const isSubmitDisabled =
    (formData.publishMode === 'now' && !formData.selectedChannel) ||
    (formData.publishMode === 'schedule' && !formData.scheduledFor)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Post #{index + 1}
        </h3>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Remove
        </button>
      </div>

      <div className="mb-4 text-xs text-zinc-600 dark:text-zinc-400">
        Source: {item.douyinUrl}
      </div>

      {item.parseError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{item.parseError}</p>
        </div>
      )}

      {isSubmitDisabled && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {formData.publishMode === 'now' ? 'Please select a channel' : 'Please select a schedule date'}
          </p>
        </div>
      )}

      {/* Publish Mode Selector */}
      <div className="mb-4">
        <PublishModeSelector
          publishMode={formData.publishMode}
          onChange={(mode) => updateFormData({ publishMode: mode })}
          name={`publishMode-${item.id}`}
        />
      </div>

      {/* Channel Selector */}
      <div className="mb-4">
        <ChannelSelector
          channels={channels}
          selectedChannel={formData.selectedChannel}
          publishMode={formData.publishMode}
          scheduledFor={formData.scheduledFor}
          onChannelChange={(channel) => updateFormData({ selectedChannel: channel })}
          onScheduledForChange={(date) => updateFormData({ scheduledFor: date })}
          idPrefix={item.id}
        />
      </div>

      {/* Content Type Selector */}
      <ContentTypeSelector
        contentType={formData.contentType}
        onChange={(type) => updateFormData({ contentType: type })}
        onClearMedia={clearMedia}
        onClearCarousel={handleClearCarousel}
      />

      {/* Content Textarea */}
      <ContentTextarea
        content={formData.content}
        onChange={(content) => updateFormData({ content })}
        isOptional={formData.contentType === 'carousel'}
      />

      {/* Single Media Section */}
      {formData.contentType !== 'carousel' && (
        <SingleMediaSection
          mediaPreview={formData.mediaPreview}
          altText={formData.altText}
          mediaUrlInput={mediaUrlInput}
          isFetchingDouyin={isFetchingDouyin}
          fileInputRef={fileInputRef}
          onAltTextChange={(text) => updateFormData({ altText: text })}
          onFileSelect={handleFileSelect}
          onUrlChange={(e) => handleMediaUrlChange(e.target.value)}
          onMediaTypeSelect={handleMediaTypeSelect}
          onClearMedia={clearMedia}
          onUseCoverImage={handleUseCoverImage}
        />
      )}

      {/* Carousel Media Section */}
      {formData.contentType === 'carousel' && (
        <CarouselMediaSection
          carouselMediaItems={formData.carouselMediaItems}
          draggedItem={draggedItem}
          carouselUrlInput={carouselUrlInput}
          isFetchingDouyin={isFetchingCarouselDouyin}
          pendingCarouselUrlType={null}
          onFileSelect={handleCarouselFileSelect}
          onUrlChange={handleCarouselUrlChange}
          onAddUrlByType={handleAddCarouselUrlByType}
          onRemoveItem={removeCarouselMediaItem}
          onUpdateAltText={updateCarouselItemAltText}
          onUpdateSourceUrl={updateCarouselItemSourceUrl}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={(targetId) => handleDrop({} as React.DragEvent, targetId)}
        />
      )}

      {/* Advanced Options Section */}
      <AdvancedOptionsSection
        showAdvancedOptions={showAdvancedOptions}
        onToggle={() => setShowAdvancedOptions(!showAdvancedOptions)}
        threadsOptions={formData.threadsOptions}
        pollOptions={formData.pollOptions}
        onThreadsOptionsChange={(options) => updateFormData({ threadsOptions: options })}
        onPollOptionsChange={(options) => updateFormData({ pollOptions: options })}
      />

      {/* Scheduled Comments Section */}
      <ScheduledCommentsSection
        scheduledComments={formData.scheduledComments}
        onAddComment={addScheduledComment}
        onRemoveComment={removeScheduledComment}
        onUpdateComment={(id, field, value) => updateScheduledComment(id, { [field]: value })}
        onMediaSelect={(commentId, e) => {
          const file = e.target.files?.[0]
          if (file) handleCommentMediaSelect(commentId, file)
        }}
        onRemoveMedia={removeCommentMedia}
      />
    </div>
  )
}

