'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getChannels } from '@/lib/api/channels'
import type { Channel } from '@/lib/api/channels'
import { PLATFORM, ACCOUNT_STATUS } from '@/lib/constants'
import { getNowUtcPlus7Input } from '@/lib/utils/timezone'

import { PublishModeSelector } from './components/PublishModeSelector'
import { ChannelSelector } from './components/ChannelSelector'
import { ContentTypeSelector } from './components/ContentTypeSelector'
import { ContentTextarea } from './components/ContentTextarea'
import { SingleMediaSection } from './components/SingleMediaSection'
import { CarouselMediaSection } from './components/CarouselMediaSection'
import { ScheduledCommentsSection } from './components/ScheduledCommentsSection'
import { AdvancedOptionsSection } from './components/AdvancedOptionsSection'
import { FormActions } from './components/FormActions'

import { useMediaUpload } from '@/lib/hooks/useMediaUpload'
import { useCarouselMedia } from '@/lib/hooks/useCarouselMedia'
import { useScheduledComments } from '@/lib/hooks/useScheduledComments'
import { usePostSubmission } from '@/lib/hooks/usePostSubmission'

import type { PublishMode, PostContentType, ThreadsOptions, PollOptions } from '@/lib/types/posts'

export default function CreatePostPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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
  } = useScheduledComments()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated) {
      getChannels()
        .then((data) => {
          setChannels(data.filter((ch) => ch.platform === PLATFORM.THREADS && ch.status === ACCOUNT_STATUS.ACTIVE))
          setIsLoadingChannels(false)
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load channels')
          setIsLoadingChannels(false)
        })
    }
  }, [isLoading, isAuthenticated, router])

  const { isPublishing, handleSubmit } = usePostSubmission({
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
    onSuccess: setSuccessMessage,
    onError: setError,
    onComplete: () => {},
    onClearForm: () => {
      setContent('')
      setSelectedChannel('')
      clearMedia()
      setCarouselMediaItems([])
      setContentType('single')
    },
  })

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

  const threadsChannels = channels.filter((ch) => ch.platform === PLATFORM.THREADS)

  const isSubmitDisabled =
    !selectedChannel ||
    (publishMode === 'schedule' ? !scheduledFor : false) ||
    (contentType === 'carousel'
      ? carouselMediaItems.length < 2 || carouselMediaItems.length > 20
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Create Post
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create and schedule content for your social media accounts
          </p>
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
              <PublishModeSelector
                publishMode={publishMode}
                onChange={(mode) => {
                  setPublishMode(mode)
                  if (mode === 'schedule' && !scheduledFor) {
                    setScheduledFor(getNowUtcPlus7Input())
                  } else if (mode === 'now') {
                    setScheduledFor('')
                  }
                }}
              />

              <ChannelSelector
                channels={threadsChannels}
                selectedChannel={selectedChannel}
                publishMode={publishMode}
                scheduledFor={scheduledFor}
                onChannelChange={setSelectedChannel}
                onScheduledForChange={setScheduledFor}
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

            <FormActions
              publishMode={publishMode}
              isPublishing={isPublishing}
              isDisabled={isSubmitDisabled}
              selectedChannel={selectedChannel}
            />
          </form>
        )}
      </div>
    </div>
  )
}
