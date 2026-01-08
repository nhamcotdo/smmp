'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getChannels, createAndPublishToThreads } from '@/lib/api/channels'
import type { Channel } from '@/lib/api/channels'
import { Platform } from '@/database/entities/enums'
import { getNowUtcPlus7Input } from '@/lib/utils/timezone'
import { fetchDouyinMedia, detectMediaTypeFromUrl, isDouyinUrl } from '@/lib/utils/douyin-handler'
import { ThreadsReplyControl } from '@/lib/types/threads'

type PublishMode = 'now' | 'schedule'
type MediaKind = 'image' | 'video' | null
type PostContentType = 'single' | 'carousel'

interface ThreadsOptions {
  linkAttachment?: string
  topicTag?: string
  replyControl?: ThreadsReplyControl
  replyToId?: string
  pollAttachment?: {
    option_a: string
    option_b: string
    option_c?: string
    option_d?: string
  }
  locationId?: string
  autoPublishText?: boolean
  textEntities?: Array<{
    entity_type: string
    offset: number
    length: number
  }>
  gifAttachment?: {
    gif_id: string
    provider: string
  }
  isGhostPost?: boolean
}

interface MediaPreview {
  type: MediaKind
  url: string
  file?: File
  blobUrl?: string // Track blob URL for cleanup
  altText?: string
  coverImageUrl?: string // Cover image for Douyin videos
}

interface CarouselMediaItem {
  id: string
  type: 'image' | 'video'
  url: string
  file?: File
  blobUrl?: string
  altText?: string
  sourceUrl?: string // Original URL for reference
  isUrlModified?: boolean // Track if user manually edited the URL
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
  const [isFetchingDouyin, setIsFetchingDouyin] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carousel state
  const [contentType, setContentType] = useState<PostContentType>('single')
  const [carouselMediaItems, setCarouselMediaItems] = useState<CarouselMediaItem[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [carouselUrlInput, setCarouselUrlInput] = useState('')
  const [isFetchingCarouselDouyin, setIsFetchingCarouselDouyin] = useState(false)
  const [pendingCarouselUrlType, setPendingCarouselUrlType] = useState<'image' | 'video' | null>(null)

  // Track blob URLs for cleanup on unmount
  const blobUrlsRef = useRef<Set<string>>(new Set())

  // Threads advanced options
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [threadsOptions, setThreadsOptions] = useState<ThreadsOptions>({})
  const [pollOptionA, setPollOptionA] = useState('')
  const [pollOptionB, setPollOptionB] = useState('')
  const [pollOptionC, setPollOptionC] = useState('')
  const [pollOptionD, setPollOptionD] = useState('')

  // Scheduled comments
  interface ScheduledComment {
    id: string
    content: string
    delayMinutes: number
    mediaFile?: File
    mediaPreview?: string
    mediaType?: 'image' | 'video'
  }
  const [scheduledComments, setScheduledComments] = useState<ScheduledComment[]>([])

  const addScheduledComment = () => {
    setScheduledComments(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      content: '',
      delayMinutes: 0,
    }])
  }

  const removeScheduledComment = (id: string) => {
    setScheduledComments(prev => {
      const comment = prev.find(c => c.id === id)
      if (comment?.mediaPreview) {
        URL.revokeObjectURL(comment.mediaPreview)
      }
      return prev.filter(c => c.id !== id)
    })
  }

  const handleCommentMediaSelect = (commentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setError('Please select an image or video file')
      return
    }

    const preview = URL.createObjectURL(file)

    setScheduledComments(prev => prev.map(c => {
      if (c.id === commentId) {
        if (c.mediaPreview) {
          URL.revokeObjectURL(c.mediaPreview)
        }
        return {
          ...c,
          mediaFile: file,
          mediaPreview: preview,
          mediaType: isImage ? 'image' : 'video',
        }
      }
      return c
    }))
  }

  const removeCommentMedia = (commentId: string) => {
    setScheduledComments(prev => prev.map(c => {
      if (c.id === commentId) {
        if (c.mediaPreview) {
          URL.revokeObjectURL(c.mediaPreview)
        }
        return {
          ...c,
          mediaFile: undefined,
          mediaPreview: undefined,
          mediaType: undefined,
        }
      }
      return c
    }))
  }

  const updateScheduledComment = (id: string, field: 'content' | 'delayMinutes', value: string | number) => {
    if (field === 'delayMinutes') {
      const numValue = typeof value === 'string' ? parseInt(value, 10) : value
      if (isNaN(numValue) || numValue < 0) {
        console.warn(`Invalid delayMinutes: ${value}, defaulting to 0`)
        value = 0
      }
    }

    setScheduledComments(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }


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
      setScheduledFor(getNowUtcPlus7Input())
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
      // Cleanup media preview blob URL
      if (mediaPreview?.blobUrl) {
        URL.revokeObjectURL(mediaPreview.blobUrl)
      }
      // Cleanup all tracked carousel blob URLs
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      blobUrlsRef.current.clear()
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
    blobUrlsRef.current.add(blobUrl)

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

    if (!url) {
      setMediaPreview(null)
      return
    }

    // Check if this is a Douyin URL
    if (isDouyinUrl(url)) {
      setIsFetchingDouyin(true)
      setError('')

      try {
        const media = await fetchDouyinMedia(url, { onError: (msg) => setError(msg) })

        if (!media) {
          throw new Error('No media URL found in Douyin response')
        }

        // Set preview with download URL
        if (media.type === 'video' && media.downloadUrl) {
          setMediaPreview({
            type: 'video',
            url: media.downloadUrl,
            // Store cover image if available
            ...(media.imageUrls.length > 0 && { coverImageUrl: media.imageUrls[0] })
          })
        } else if (media.type === 'image' && media.imageUrls.length > 0) {
          setMediaPreview({ type: 'image', url: media.imageUrls[0] })
        } else {
          throw new Error('No media URL found in Douyin response')
        }

        // Optionally pre-fill content with video description
        if (media.videoDesc && !content) {
          setContent(media.videoDesc)
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
    const mediaType = detectMediaTypeFromUrl(url)

    if (mediaType === 'image') {
      setMediaPreview({ type: 'image', url })
    } else if (mediaType === 'video') {
      setMediaPreview({ type: 'video', url })
    } else {
      // Unknown type - show selector for user to choose
      setMediaPreview(null)
    }

    // Clear file input when URL is entered
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleMediaTypeSelect = (type: 'image' | 'video') => {
    if (!mediaUrlInput) return
    setMediaPreview({ type, url: mediaUrlInput })
  }

  const clearMedia = () => {
    // Revoke blob URL to prevent memory leak
    if (mediaPreview?.blobUrl) {
      URL.revokeObjectURL(mediaPreview.blobUrl)
      blobUrlsRef.current.delete(mediaPreview.blobUrl)
    }
    setMediaPreview(null)
    setAltText('')
    setMediaUrlInput('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Carousel media functions
  const addCarouselMediaItem = (item: Omit<CarouselMediaItem, 'id'>) => {
    const newItem: CarouselMediaItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
    }
    // Track blob URL for cleanup
    if (newItem.blobUrl) {
      blobUrlsRef.current.add(newItem.blobUrl)
    }
    // Use functional form of setState to avoid batching issues when adding multiple items
    setCarouselMediaItems(prevItems => [...prevItems, newItem])
  }

  const removeCarouselMediaItem = (id: string) => {
    setCarouselMediaItems(prevItems => {
      const item = prevItems.find(i => i.id === id)
      if (item?.blobUrl) {
        URL.revokeObjectURL(item.blobUrl)
        blobUrlsRef.current.delete(item.blobUrl)
      }
      return prevItems.filter(i => i.id !== id)
    })
  }

  const updateCarouselItemAltText = (id: string, altText: string) => {
    setCarouselMediaItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, altText } : item
      )
    )
  }

  const updateCarouselItemSourceUrl = (id: string, newUrl: string) => {
    setCarouselMediaItems(prevItems => {
      const item = prevItems.find(i => i.id === id)

      // Revoke old blob URL if exists and switching to a different URL
      if (item?.blobUrl && newUrl !== item.url) {
        URL.revokeObjectURL(item.blobUrl)
        blobUrlsRef.current.delete(item.blobUrl)
      }

      return prevItems.map(item =>
        item.id === id ? {
          ...item,
          url: newUrl,
          // Trim and compare for robustness
          isUrlModified: newUrl.trim() !== (item.sourceUrl?.trim() ?? ''),
          // Clear blob reference if switching to non-blob URL
          ...(newUrl.startsWith('blob:') ? {} : { blobUrl: undefined })
        } : item
      )
    })
  }

  const handleDragStart = (id: string) => {
    setDraggedItem(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (dropTargetId: string) => {
    if (!draggedItem) return

    const draggedIndex = carouselMediaItems.findIndex(i => i.id === draggedItem)
    const dropIndex = carouselMediaItems.findIndex(i => i.id === dropTargetId)

    if (draggedIndex === -1 || dropIndex === -1) return

    const items = [...carouselMediaItems]
    const [removed] = items.splice(draggedIndex, 1)
    items.splice(dropIndex, 0, removed)

    setCarouselMediaItems(items)
    setDraggedItem(null)
  }

  const handleCarouselFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      const fileType = file.type.startsWith('image/') ? 'image' : 'video'
      const blobUrl = URL.createObjectURL(file)

      addCarouselMediaItem({
        type: fileType as 'image' | 'video',
        url: blobUrl,
        file,
        blobUrl,
        altText: '',
      })
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCarouselUrlChange = async (url: string) => {
    setCarouselUrlInput(url)
    setPendingCarouselUrlType(null)

    if (!url) {
      return
    }

    // Check if this is a Douyin URL
    if (isDouyinUrl(url)) {
      setIsFetchingCarouselDouyin(true)
      setError('')

      try {
        const media = await fetchDouyinMedia(url, { onError: (msg) => setError(msg) })

        if (!media) {
          throw new Error('No media found in Douyin response')
        }

        // Validate response has media
        const hasVideo = media.type === 'video' && media.downloadUrl
        const hasImages = media.imageUrls.length > 0

        if (!hasVideo && !hasImages) {
          throw new Error('No media found in Douyin response. The video may be private or deleted.')
        }

        // For carousel, add both video AND all images if available
        if (hasVideo) {
          addCarouselMediaItem({
            type: 'video',
            url: media.downloadUrl!,
            altText: media.videoDesc || '',
            sourceUrl: url,
          })
        }

        // Add all images if available
        if (hasImages) {
          for (const imgUrl of media.imageUrls) {
            addCarouselMediaItem({
              type: 'image',
              url: imgUrl,
              altText: media.videoDesc || '',
              sourceUrl: url,
            })
          }
        }

        setCarouselUrlInput('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse Douyin URL')
      } finally {
        setIsFetchingCarouselDouyin(false)
      }
      return
    }

    // Regular URL handling (non-Douyin)
    const mediaType = detectMediaTypeFromUrl(url)

    if (mediaType === 'image') {
      addCarouselMediaItem({ type: 'image', url, altText: '', sourceUrl: url })
      setCarouselUrlInput('')
    } else if (mediaType === 'video') {
      addCarouselMediaItem({ type: 'video', url, altText: '', sourceUrl: url })
      setCarouselUrlInput('')
    } else {
      // Unknown type - show selector for user to choose
      setPendingCarouselUrlType('image')
    }
  }

  const handleAddCarouselUrlByType = (type: 'image' | 'video') => {
    if (!carouselUrlInput) return
    addCarouselMediaItem({ type, url: carouselUrlInput, altText: '', sourceUrl: carouselUrlInput })
    setCarouselUrlInput('')
    setPendingCarouselUrlType(null)
  }

  /**
   * Upload carousel media items and return final URLs
   * Extracted to avoid duplication between publish now and schedule flows
   */
  async function uploadCarouselMediaItems(
    items: CarouselMediaItem[]
  ): Promise<Array<{ type: 'image' | 'video'; url: string; altText?: string }>> {
    const finalCarouselMedia: Array<{ type: 'image' | 'video'; url: string; altText?: string }> = []

    for (const item of items) {
      let finalUrl = item.url

      // If a file was selected, upload it to R2 via server proxy
      if (item.file) {
        const formData = new FormData()
        formData.append('file', item.file)

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

        finalUrl = uploadData.data.url
      }

      finalCarouselMedia.push({
        type: item.type,
        url: finalUrl,
        altText: item.altText || undefined,
      })
    }

    return finalCarouselMedia
  }

  /**
   * Upload scheduled comment media files and return final URLs
   */
  async function uploadScheduledCommentMedia(
    comments: ScheduledComment[]
  ): Promise<Array<{ content: string; delayMinutes: number; imageUrl?: string; videoUrl?: string }>> {
    const finalComments: Array<{ content: string; delayMinutes: number; imageUrl?: string; videoUrl?: string }> = []

    for (const comment of comments) {
      let mediaUrl: string | undefined = undefined

      if (comment.mediaFile) {
        const formData = new FormData()
        formData.append('file', comment.mediaFile)

        const uploadResponse = await fetch('/api/upload/proxy', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(`Failed to upload comment media: ${errorData.message || 'File upload failed'}`)
        }

        const uploadData = await uploadResponse.json()

        if (!uploadData.success) {
          throw new Error(`Failed to upload comment media: ${uploadData.message || 'File upload failed'}`)
        }

        mediaUrl = uploadData.data.url
      }

      finalComments.push({
        content: comment.content.trim(),
        delayMinutes: comment.delayMinutes,
        ...(comment.mediaType === 'image' && mediaUrl ? { imageUrl: mediaUrl } : {}),
        ...(comment.mediaType === 'video' && mediaUrl ? { videoUrl: mediaUrl } : {}),
      })
    }

    return finalComments
  }

  /**
   * Build threads options from form state
   * Extracted to avoid duplication between publish now and schedule flows
   */
  function buildThreadsOptionsFromForm(): ThreadsOptions {
    const built: ThreadsOptions = {}

    // Only include defined fields
    if (threadsOptions.linkAttachment) built.linkAttachment = threadsOptions.linkAttachment
    if (threadsOptions.topicTag) built.topicTag = threadsOptions.topicTag
    if (threadsOptions.replyControl) built.replyControl = threadsOptions.replyControl
    if (threadsOptions.replyToId) built.replyToId = threadsOptions.replyToId
    if (threadsOptions.locationId) built.locationId = threadsOptions.locationId
    if (threadsOptions.autoPublishText !== undefined) built.autoPublishText = threadsOptions.autoPublishText
    if (threadsOptions.textEntities) built.textEntities = threadsOptions.textEntities
    if (threadsOptions.gifAttachment) built.gifAttachment = threadsOptions.gifAttachment
    if (threadsOptions.isGhostPost !== undefined) built.isGhostPost = threadsOptions.isGhostPost

    // Build poll attachment if at least option A and B are provided
    if (pollOptionA && pollOptionB) {
      built.pollAttachment = {
        option_a: pollOptionA,
        option_b: pollOptionB,
        ...(pollOptionC && { option_c: pollOptionC }),
        ...(pollOptionD && { option_d: pollOptionD }),
      }
    }

    return built
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (contentType === 'carousel' && carouselMediaItems.length < 2) {
      setError('Carousel must have at least 2 media items')
      return
    }

    if (contentType === 'carousel' && carouselMediaItems.length > 20) {
      setError('Carousel cannot have more than 20 media items')
      return
    }

    if (!content.trim() && !mediaPreview && carouselMediaItems.length === 0) {
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
        // Build threads options from form state
        const builtThreadsOptions = buildThreadsOptionsFromForm()

        // Upload scheduled comment media files
        const finalScheduledComments = scheduledComments.length > 0
          ? await uploadScheduledCommentMedia(scheduledComments)
          : []

        // Publish immediately
        if (contentType === 'carousel') {
          // Upload carousel files and prepare media items
          const finalCarouselMedia = await uploadCarouselMediaItems(carouselMediaItems)

          const result = await createAndPublishToThreads(content, selectedChannel, {
            carouselMediaItems: finalCarouselMedia,
            threadsOptions: Object.keys(builtThreadsOptions).length > 0 ? builtThreadsOptions : undefined,
            scheduledComments: finalScheduledComments.length > 0 ? finalScheduledComments : undefined,
          })

          setSuccessMessage(
            `Post published successfully! View it at: ${result.platformUrl}`
          )
        } else {
          // Single media post
          const result = await createAndPublishToThreads(content, selectedChannel, {
            imageUrl: mediaPreview?.type === 'image' ? finalMediaUrl : undefined,
            videoUrl: mediaPreview?.type === 'video' ? finalMediaUrl : undefined,
            altText: altText || undefined,
            threadsOptions: Object.keys(builtThreadsOptions).length > 0 ? builtThreadsOptions : undefined,
            scheduledComments: finalScheduledComments.length > 0 ? finalScheduledComments : undefined,
          })
          setSuccessMessage(
            `Post published successfully! View it at: ${result.platformUrl}`
          )
        }

        // Clear form
        setContent('')
        setSelectedChannel('')
        clearMedia()
        setCarouselMediaItems([])
        setContentType('single')

        // Redirect after 3 seconds
        setTimeout(() => {
          router.push('/channels')
        }, 3000)
      } else {
        // Build threads options from form state
        const builtThreadsOptions = buildThreadsOptionsFromForm()

        // Upload files and prepare carousel media items
        let finalCarouselMedia: Array<{ type: 'image' | 'video'; url: string; altText?: string }> | undefined = undefined
        if (contentType === 'carousel') {
          finalCarouselMedia = await uploadCarouselMediaItems(carouselMediaItems)
        }

        // Upload scheduled comment media files
        const finalScheduledComments = scheduledComments.length > 0
          ? await uploadScheduledCommentMedia(scheduledComments)
          : []

        // Schedule post
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            scheduledFor,
            socialAccountId: selectedChannel || undefined,
            imageUrl: contentType !== 'carousel' && mediaPreview?.type === 'image' ? finalMediaUrl : undefined,
            videoUrl: contentType !== 'carousel' && mediaPreview?.type === 'video' ? finalMediaUrl : undefined,
            altText: contentType !== 'carousel' ? (altText || undefined) : undefined,
            carouselMediaItems: finalCarouselMedia,
            ...(Object.keys(builtThreadsOptions).length > 0 && { threadsOptions: builtThreadsOptions }),
            ...(finalScheduledComments.length > 0 && { scheduledComments: finalScheduledComments }),
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
        setCarouselMediaItems([])
        setContentType('single')
        setScheduledComments([])

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

  if (isLoadingChannels) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading channels...</p>
        </div>
      </div>
    )
  }

  const threadsChannels = channels.filter((ch) => ch.platform === Platform.THREADS)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Create Post
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create and schedule content for your social media accounts
          </p>
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
                    Select Threads Channel *
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
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    The post will be published to this account at the scheduled time
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

              {/* Content Type Selector */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Post Type
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className={`flex items-center rounded-md border px-4 py-2 cursor-pointer transition-colors ${
                    contentType === 'single'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
                  }`}>
                    <input
                      type="radio"
                      name="contentType"
                      value="single"
                      checked={contentType === 'single'}
                      onChange={(e) => {
                        setContentType(e.target.value as PostContentType)
                        setMediaPreview(null)
                        setCarouselMediaItems([])
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">📎 Single (Text, Image, or Video)</span>
                  </label>
                  <label className={`flex items-center rounded-md border px-4 py-2 cursor-pointer transition-colors ${
                    contentType === 'carousel'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
                  }`}>
                    <input
                      type="radio"
                      name="contentType"
                      value="carousel"
                      checked={contentType === 'carousel'}
                      onChange={(e) => {
                        setContentType(e.target.value as PostContentType)
                        setMediaPreview(null)
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">🎠 Carousel (2-20 items)</span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="content" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Post Content {contentType === 'carousel' && '(Optional)'}
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

              {/* Media Upload Section - Only show for single post type */}
              {contentType !== 'carousel' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Media (Optional for Single Post)
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
                            Couldn&apos;t detect media type. Please select:
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

                    {/* Cover Image Toggle for Videos */}
                    {mediaPreview.type === 'video' && mediaPreview.coverImageUrl && (
                      <div className="mb-3 rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                              Cover image available
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMediaPreview({
                              type: 'image',
                              url: mediaPreview.coverImageUrl!,
                              coverImageUrl: mediaPreview.coverImageUrl
                            })}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
                          >
                            Use cover instead
                          </button>
                        </div>
                      </div>
                    )}

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
              )}

              {/* Carousel Media Section - Only show for carousel type */}
              {contentType === 'carousel' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Carousel Media <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-sm font-medium ${
                    carouselMediaItems.length < 2
                      ? 'text-red-600 dark:text-red-400'
                      : carouselMediaItems.length > 20
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {carouselMediaItems.length}/20 items
                    {carouselMediaItems.length < 2 && ' (minimum 2)'}
                    {carouselMediaItems.length > 20 && ' (maximum 20)'}
                  </span>
                </div>

                {/* Add Media Options */}
                <div className="mb-4 space-y-4">
                  {/* File Upload */}
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-zinc-300 px-4 py-3 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleCarouselFileSelect}
                      className="hidden"
                    />
                    <svg className="mr-2 h-5 w-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Upload Files
                    </span>
                  </label>

                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>or</span>
                    <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
                  </div>

                  {/* URL Input */}
                  <div>
                    <input
                      type="text"
                      value={carouselUrlInput}
                      onChange={(e) => handleCarouselUrlChange(e.target.value)}
                      placeholder="Paste image or video URL... (Douyin links supported)"
                      className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      disabled={isFetchingCarouselDouyin}
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Supports: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV, Douyin links
                      </p>
                      {isFetchingCarouselDouyin && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Fetching Douyin URL...
                        </p>
                      )}
                    </div>

                    {/* Type Selector - shown when URL entered but type not detected */}
                    {carouselUrlInput && pendingCarouselUrlType && !isFetchingCarouselDouyin && (
                      <div className="mt-3 rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
                        <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                          Couldn&apos;t detect media type. Please select:
                        </p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleAddCarouselUrlByType('image')}
                            className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
                          >
                            📷 Image
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddCarouselUrlByType('video')}
                            className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
                          >
                            🎥 Video
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Carousel Items Grid */}
                {carouselMediaItems.length > 0 && (
                  <div className="space-y-3">
                    {carouselMediaItems.map((item, index) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(item.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(item.id)}
                        className={`group relative flex gap-3 rounded-lg border-2 bg-zinc-50 p-3 transition-all dark:bg-zinc-800 ${
                          draggedItem === item.id
                            ? 'border-blue-500 opacity-50'
                            : 'border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {/* Drag Handle */}
                        <div className="flex cursor-move items-center">
                          <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>

                        {/* Item Number Badge */}
                        <div className="flex items-center">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {index + 1}
                          </span>
                        </div>

                        {/* Thumbnail */}
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-black">
                          {item.type === 'image' ? (
                            <img
                              src={item.url}
                              alt={`Item ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video
                              src={item.url}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>

                        {/* Type Badge, Alt Text & Source URL */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.type === 'image'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                            }`}>
                              {item.type === 'image' ? '📷 Image' : '🎬 Video'}
                            </span>
                            {item.file && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {item.file.name}
                              </span>
                            )}
                          </div>
                          {/* Source URL - editable */}
                          {item.sourceUrl && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.url}
                                onChange={(e) => updateCarouselItemSourceUrl(item.id, e.target.value)}
                                placeholder="Source URL..."
                                className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                              />
                              {item.isUrlModified && (
                                <span className="text-xs text-amber-600 dark:text-amber-400" title="URL differs from original source">
                                  ⚠️ Modified
                                </span>
                              )}
                            </div>
                          )}
                          <input
                            type="text"
                            value={item.altText || ''}
                            onChange={(e) => updateCarouselItemAltText(item.id, e.target.value)}
                            placeholder="Alt text (optional)..."
                            maxLength={500}
                            className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => removeCarouselMediaItem(item.id)}
                          className="self-start rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Remove item"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {carouselMediaItems.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800">
                    <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      No media items yet. Add at least 2 images or videos to create a carousel.
                    </p>
                  </div>
                )}

                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  💡 Drag items to reorder them. The first item will be the cover of your carousel.
                </p>
              </div>
              )}

              {/* Advanced Options Section */}
              <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <svg
                    className={`h-4 w-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced Options (Threads API)
                </button>

                {showAdvancedOptions && (
                  <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    {/* Link Attachment */}
                    <div>
                      <label htmlFor="linkAttachment" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Link Attachment URL
                      </label>
                      <input
                        type="url"
                        id="linkAttachment"
                        value={threadsOptions.linkAttachment || ''}
                        onChange={(e) => setThreadsOptions({ ...threadsOptions, linkAttachment: e.target.value })}
                        placeholder="https://example.com"
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Topic Tag */}
                    <div>
                      <label htmlFor="topicTag" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Topic Tag
                      </label>
                      <input
                        type="text"
                        id="topicTag"
                        value={threadsOptions.topicTag || ''}
                        onChange={(e) => setThreadsOptions({ ...threadsOptions, topicTag: e.target.value })}
                        placeholder="e.g., ThreadsAPI"
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Reply Control */}
                    <div>
                      <label htmlFor="replyControl" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Who Can Reply
                      </label>
                      <select
                        id="replyControl"
                        value={threadsOptions.replyControl || ''}
                        onChange={(e) => setThreadsOptions({ ...threadsOptions, replyControl: e.target.value as ThreadsReplyControl })}
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">Everyone (default)</option>
                        <option value="EVERYONE">Everyone</option>
                        <option value="ACCOUNTS_YOU_FOLLOW">Accounts You Follow</option>
                        <option value="MENTIONED_ONLY">Mentioned Only</option>
                        <option value="PARENT_POST_AUTHOR_ONLY">Parent Post Author Only</option>
                        <option value="FOLLOWERS_ONLY">Followers Only</option>
                      </select>
                    </div>

                    {/* Reply To ID */}
                    <div>
                      <label htmlFor="replyToId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Reply To Post ID
                      </label>
                      <input
                        type="text"
                        id="replyToId"
                        value={threadsOptions.replyToId || ''}
                        onChange={(e) => setThreadsOptions({ ...threadsOptions, replyToId: e.target.value })}
                        placeholder="Threads post ID to reply to"
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Location ID */}
                    <div>
                      <label htmlFor="locationId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Location ID
                      </label>
                      <input
                        type="text"
                        id="locationId"
                        value={threadsOptions.locationId || ''}
                        onChange={(e) => setThreadsOptions({ ...threadsOptions, locationId: e.target.value })}
                        placeholder="Facebook Location ID"
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    {/* Auto Publish Text */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoPublishText"
                        checked={threadsOptions.autoPublishText || false}
                        onChange={(e) => setThreadsOptions({ ...threadsOptions, autoPublishText: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <label htmlFor="autoPublishText" className="text-sm text-zinc-700 dark:text-zinc-300">
                        Auto Publish Text
                      </label>
                    </div>

                    {/* Ghost Post */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isGhostPost"
                        checked={threadsOptions.isGhostPost || false}
                        onChange={(e) => setThreadsOptions({ ...threadsOptions, isGhostPost: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <label htmlFor="isGhostPost" className="text-sm text-zinc-700 dark:text-zinc-300">
                        Ghost Post (unlisted)
                      </label>
                    </div>

                    {/* Poll Attachment */}
                    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Poll Attachment</p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={pollOptionA}
                          onChange={(e) => setPollOptionA(e.target.value)}
                          placeholder="Option A (required)"
                          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="text"
                          value={pollOptionB}
                          onChange={(e) => setPollOptionB(e.target.value)}
                          placeholder="Option B (required)"
                          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="text"
                          value={pollOptionC}
                          onChange={(e) => setPollOptionC(e.target.value)}
                          placeholder="Option C (optional)"
                          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <input
                          type="text"
                          value={pollOptionD}
                          onChange={(e) => setPollOptionD(e.target.value)}
                          placeholder="Option D (optional)"
                          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    {/* GIF Attachment */}
                    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">GIF Attachment</p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={threadsOptions.gifAttachment?.gif_id || ''}
                          onChange={(e) => setThreadsOptions({
                            ...threadsOptions,
                            gifAttachment: {
                              ...threadsOptions.gifAttachment,
                              gif_id: e.target.value,
                              provider: threadsOptions.gifAttachment?.provider || 'TENOR'
                            }
                          })}
                          placeholder="GIF ID (e.g., from Tenor)"
                          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                        <select
                          value={threadsOptions.gifAttachment?.provider || 'TENOR'}
                          onChange={(e) => setThreadsOptions({
                            ...threadsOptions,
                            gifAttachment: {
                              gif_id: threadsOptions.gifAttachment?.gif_id || '',
                              provider: e.target.value
                            }
                          })}
                          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          <option value="TENOR">Tenor</option>
                          {/* cspell:ignore GIPHY */}
                          <option value="GIPHY">GIPHY</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scheduled Comments Section - show for both publish modes */}
              {true && (
                <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Scheduled Comments
                    </label>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Add comments that will be automatically posted as replies after the main post is published.
                    </p>
                  </div>

                  {/* Comments list */}
                  {scheduledComments.map((comment, index) => (
                    <div key={comment.id} className="mb-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="mb-3 flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {index + 1}
                        </span>

                        <div className="flex flex-1 gap-3">
                          <textarea
                            value={comment.content}
                            onChange={(e) => updateScheduledComment(comment.id, 'content', e.target.value)}
                            placeholder="Comment content..."
                            rows={2}
                            maxLength={500}
                            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />

                          <select
                            value={comment.delayMinutes}
                            onChange={(e) => updateScheduledComment(comment.id, 'delayMinutes', parseInt(e.target.value, 10))}
                            className="h-10 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            <option value="0">Immediately</option>
                            <option value="1">After 1 minute</option>
                            <option value="5">After 5 minutes</option>
                            <option value="10">After 10 minutes</option>
                            <option value="15">After 15 minutes</option>
                            <option value="30">After 30 minutes</option>
                            <option value="60">After 1 hour</option>
                            <option value="120">After 2 hours</option>
                            <option value="180">After 3 hours</option>
                            <option value="360">After 6 hours</option>
                            <option value="720">After 12 hours</option>
                            <option value="1440">After 24 hours</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => removeScheduledComment(comment.id)}
                            className="h-10 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Media attachment for comment */}
                      <div className="ml-11 flex items-center gap-3">
                        {!comment.mediaPreview ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Add Media
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => handleCommentMediaSelect(comment.id, e)}
                            />
                          </label>
                        ) : (
                          <div className="flex items-center gap-3">
                            {comment.mediaType === 'image' ? (
                              <div className="relative h-16 w-16 overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
                                <img src={comment.mediaPreview} alt="" className="h-full w-full object-cover" />
                              </div>
                            ) : (
                              <div className="relative h-16 w-16 overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
                                <video src={comment.mediaPreview} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                  <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeCommentMedia(comment.id)}
                              className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              Remove Media
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {scheduledComments.length < 10 && (
                    <button
                      type="button"
                      onClick={addScheduledComment}
                      className="mt-2 flex items-center gap-2 rounded-md border-2 border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Scheduled Comment
                    </button>
                  )}

                  {scheduledComments.length >= 10 && (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Maximum 10 scheduled comments allowed.
                    </p>
                  )}
                </div>
              )}

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
                disabled={
                  isPublishing ||
                  !selectedChannel ||
                  (publishMode === 'schedule' ? !scheduledFor : false) ||
                  (contentType === 'carousel' ? carouselMediaItems.length < 2 || carouselMediaItems.length > 20 : !content.trim() && !mediaPreview)
                }
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
      </div>
    </div>
  )
}
