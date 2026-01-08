import { useState, useCallback, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createAndPublishToThreads } from '@/lib/api/channels'
import { uploadMediaFile, uploadCarouselMediaItems, uploadScheduledCommentMedia } from '@/lib/utils/media-upload'
import { buildThreadsOptionsFromForm } from '@/lib/utils/threads-options'
import type { PublishMode, PostContentType, MediaPreview, CarouselMediaItem, ScheduledComment, ThreadsOptions, PollOptions } from '@/lib/types/posts'

interface UsePostSubmissionProps {
  publishMode: PublishMode
  contentType: PostContentType
  content: string
  selectedChannel: string
  scheduledFor: string
  mediaPreview: MediaPreview | null
  altText: string
  carouselMediaItems: CarouselMediaItem[]
  threadsOptions: ThreadsOptions
  pollOptions: PollOptions
  scheduledComments: ScheduledComment[]
  onSuccess: (message: string) => void
  onError: (error: string) => void
  onComplete: () => void
  onClearForm: () => void
}

interface UsePostSubmissionReturn {
  isPublishing: boolean
  handleSubmit: (e: FormEvent) => Promise<void>
}

export function usePostSubmission({
  publishMode,
  contentType,
  content,
  selectedChannel,
  scheduledFor,
  mediaPreview,
  altText,
  carouselMediaItems,
  threadsOptions,
  pollOptions,
  scheduledComments,
  onSuccess,
  onError,
  onComplete,
  onClearForm,
}: UsePostSubmissionProps): UsePostSubmissionReturn {
  const [isPublishing, setIsPublishing] = useState(false)
  const router = useRouter()

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()

    if (contentType === 'carousel' && carouselMediaItems.length < 2) {
      onError('Carousel must have at least 2 media items')
      return
    }

    if (contentType === 'carousel' && carouselMediaItems.length > 20) {
      onError('Carousel cannot have more than 20 media items')
      return
    }

    if (!content.trim() && !mediaPreview && carouselMediaItems.length === 0) {
      onError('Please enter content or attach media')
      return
    }

    if (publishMode === 'now' && !selectedChannel) {
      onError('Please select a Threads channel to publish to')
      return
    }

    if (publishMode === 'schedule' && !scheduledFor) {
      onError('Please select a date and time to schedule')
      return
    }

    if (publishMode === 'schedule' && new Date(scheduledFor) <= new Date()) {
      onError('Schedule time must be in the future')
      return
    }

    setIsPublishing(true)

    try {
      let finalMediaUrl: string | undefined = mediaPreview?.url

      if (mediaPreview?.file) {
        finalMediaUrl = await uploadMediaFile(mediaPreview.file)
      }

      const builtThreadsOptions = buildThreadsOptionsFromForm(threadsOptions, pollOptions)

      const finalScheduledComments = scheduledComments.length > 0
        ? await uploadScheduledCommentMedia(scheduledComments)
        : []

      if (publishMode === 'now') {
        if (contentType === 'carousel') {
          const finalCarouselMedia = await uploadCarouselMediaItems(carouselMediaItems)

          const result = await createAndPublishToThreads(content, selectedChannel, {
            carouselMediaItems: finalCarouselMedia,
            threadsOptions: Object.keys(builtThreadsOptions).length > 0 ? builtThreadsOptions : undefined,
            scheduledComments: finalScheduledComments.length > 0 ? finalScheduledComments : undefined,
          })

          onSuccess(`Post published successfully! View it at: ${result.platformUrl}`)
        } else {
          const result = await createAndPublishToThreads(content, selectedChannel, {
            imageUrl: mediaPreview?.type === 'image' ? finalMediaUrl : undefined,
            videoUrl: mediaPreview?.type === 'video' ? finalMediaUrl : undefined,
            altText: altText || undefined,
            threadsOptions: Object.keys(builtThreadsOptions).length > 0 ? builtThreadsOptions : undefined,
            scheduledComments: finalScheduledComments.length > 0 ? finalScheduledComments : undefined,
          })
          onSuccess(`Post published successfully! View it at: ${result.platformUrl}`)
        }

        onClearForm()

        setTimeout(() => {
          router.push('/channels')
        }, 3000)
      } else {
        let finalCarouselMedia: Array<{ type: 'image' | 'video'; url: string; altText?: string }> | undefined = undefined
        if (contentType === 'carousel') {
          finalCarouselMedia = await uploadCarouselMediaItems(carouselMediaItems)
        }

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

        onSuccess(`Post scheduled for ${new Date(scheduledFor).toLocaleString()}`)
        onClearForm()

        setTimeout(() => {
          router.push('/posts/scheduled')
        }, 2000)
      }

      onComplete()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to publish post')
    } finally {
      setIsPublishing(false)
    }
  }, [
    contentType,
    carouselMediaItems,
    content,
    mediaPreview,
    publishMode,
    selectedChannel,
    scheduledFor,
    threadsOptions,
    pollOptions,
    scheduledComments,
    altText,
    onSuccess,
    onError,
    onComplete,
    onClearForm,
    router,
  ])

  return {
    isPublishing,
    handleSubmit,
  }
}
