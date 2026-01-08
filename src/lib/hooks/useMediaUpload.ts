import { useState, useRef, useCallback } from 'react'
import { fetchDouyinMedia, detectMediaTypeFromUrl, isDouyinUrl } from '@/lib/utils/douyin-handler'
import type { MediaPreview } from '@/lib/types/posts'
import { useBlobCleanup } from './useBlobCleanup'

interface UseMediaUploadProps {
  onError: (error: string) => void
}

interface UseMediaUploadReturn {
  mediaPreview: MediaPreview | null
  setMediaPreview: (media: MediaPreview | null) => void
  altText: string
  setAltText: (text: string) => void
  mediaUrlInput: string
  setMediaUrlInput: (url: string) => void
  isFetchingDouyin: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleMediaUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleMediaTypeSelect: (type: 'image' | 'video') => void
  clearMedia: () => void
}

export function useMediaUpload({ onError }: UseMediaUploadProps): UseMediaUploadReturn {
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null)
  const [altText, setAltText] = useState('')
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [isFetchingDouyin, setIsFetchingDouyin] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { trackBlobUrl, revokeBlobUrl } = useBlobCleanup()

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      onError('Please select an image or video file')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      onError('File size must be less than 50MB')
      return
    }

    onError('')

    if (mediaPreview?.blobUrl) {
      revokeBlobUrl(mediaPreview.blobUrl)
    }

    const blobUrl = URL.createObjectURL(file)
    trackBlobUrl(blobUrl)

    const newPreview: MediaPreview = {
      type: isImage ? 'image' : 'video',
      url: blobUrl,
      file,
      blobUrl,
    }

    setMediaPreview(newPreview)
    setMediaUrlInput('')
  }, [mediaPreview, onError, revokeBlobUrl, trackBlobUrl])

  const handleMediaUrlChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setMediaUrlInput(url)

    if (!url) {
      setMediaPreview(null)
      return
    }

    if (isDouyinUrl(url)) {
      setIsFetchingDouyin(true)
      onError('')

      try {
        const media = await fetchDouyinMedia(url, { onError: (msg) => onError(msg) })

        if (!media) {
          throw new Error('No media URL found in Douyin response')
        }

        let newPreview: MediaPreview | null = null

        if (media.type === 'video' && media.downloadUrl) {
          newPreview = {
            type: 'video',
            url: media.downloadUrl,
            ...(media.imageUrls.length > 0 && { coverImageUrl: media.imageUrls[0] })
          }
        } else if (media.type === 'image' && media.imageUrls.length > 0) {
          newPreview = { type: 'image', url: media.imageUrls[0] }
        } else {
          throw new Error('No media URL found in Douyin response')
        }

        setMediaPreview(newPreview)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to parse Douyin URL')
        setMediaPreview(null)
      } finally {
        setIsFetchingDouyin(false)
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    const mediaType = detectMediaTypeFromUrl(url)

    if (mediaType === 'image') {
      setMediaPreview({ type: 'image' as const, url })
    } else if (mediaType === 'video') {
      setMediaPreview({ type: 'video' as const, url })
    } else {
      setMediaPreview(null)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [onError])

  const handleMediaTypeSelect = useCallback((type: 'image' | 'video') => {
    if (!mediaUrlInput) return
    setMediaPreview({ type, url: mediaUrlInput })
  }, [mediaUrlInput])

  const clearMedia = useCallback(() => {
    if (mediaPreview?.blobUrl) {
      revokeBlobUrl(mediaPreview.blobUrl)
    }
    setMediaPreview(null)
    setAltText('')
    setMediaUrlInput('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [mediaPreview, revokeBlobUrl])

  return {
    mediaPreview,
    setMediaPreview,
    altText,
    setAltText,
    mediaUrlInput,
    setMediaUrlInput,
    isFetchingDouyin,
    fileInputRef,
    handleFileSelect,
    handleMediaUrlChange,
    handleMediaTypeSelect,
    clearMedia,
  }
}
