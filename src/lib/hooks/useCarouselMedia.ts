import { useState, useCallback } from 'react'
import { fetchDouyinMedia, detectMediaTypeFromUrl, isDouyinUrl } from '@/lib/utils/douyin-handler'
import type { CarouselMediaItem } from '@/lib/types/posts'
import { useBlobCleanup } from './useBlobCleanup'

interface UseCarouselMediaReturn {
  carouselMediaItems: CarouselMediaItem[]
  setCarouselMediaItems: (items: CarouselMediaItem[]) => void
  draggedItem: string | null
  setDraggedItem: (id: string | null) => void
  carouselUrlInput: string
  setCarouselUrlInput: (url: string) => void
  isFetchingDouyin: boolean
  pendingCarouselUrlType: 'image' | 'video' | null
  addCarouselMediaItem: (item: Omit<CarouselMediaItem, 'id'>) => void
  removeCarouselMediaItem: (id: string) => void
  updateCarouselItemAltText: (id: string, altText: string) => void
  updateCarouselItemSourceUrl: (id: string, newUrl: string) => void
  handleDragStart: (id: string) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (dropTargetId: string) => void
  handleCarouselFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleCarouselUrlChange: (url: string) => void
  handleAddCarouselUrlByType: (type: 'image' | 'video') => void
}

export function useCarouselMedia(onError?: (error: string) => void): UseCarouselMediaReturn {
  const [carouselMediaItems, setCarouselMediaItems] = useState<CarouselMediaItem[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [carouselUrlInput, setCarouselUrlInput] = useState('')
  const [isFetchingDouyin, setIsFetchingDouyin] = useState(false)
  const [pendingCarouselUrlType, setPendingCarouselUrlType] = useState<'image' | 'video' | null>(null)
  const { trackBlobUrl, revokeBlobUrl } = useBlobCleanup()

  const addCarouselMediaItem = useCallback((item: Omit<CarouselMediaItem, 'id'>) => {
    const newItem: CarouselMediaItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
    }
    if (newItem.blobUrl) {
      trackBlobUrl(newItem.blobUrl)
    }
    setCarouselMediaItems(prevItems => [...prevItems, newItem])
  }, [trackBlobUrl])

  const removeCarouselMediaItem = useCallback((id: string) => {
    setCarouselMediaItems(prevItems => {
      const item = prevItems.find(i => i.id === id)
      if (item?.blobUrl) {
        revokeBlobUrl(item.blobUrl)
      }
      return prevItems.filter(i => i.id !== id)
    })
  }, [revokeBlobUrl])

  const updateCarouselItemAltText = useCallback((id: string, altText: string) => {
    setCarouselMediaItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, altText } : item
      )
    )
  }, [])

  const updateCarouselItemSourceUrl = useCallback((id: string, newUrl: string) => {
    setCarouselMediaItems(prevItems => {
      const item = prevItems.find(i => i.id === id)

      if (item?.blobUrl && newUrl !== item.url) {
        revokeBlobUrl(item.blobUrl)
      }

      return prevItems.map(item =>
        item.id === id ? {
          ...item,
          url: newUrl,
          isUrlModified: newUrl.trim() !== (item.sourceUrl?.trim() ?? ''),
          ...(newUrl.startsWith('blob:') ? {} : { blobUrl: undefined })
        } : item
      )
    })
  }, [revokeBlobUrl])

  const handleDragStart = useCallback((id: string) => {
    setDraggedItem(id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((dropTargetId: string) => {
    if (!draggedItem) return

    const draggedIndex = carouselMediaItems.findIndex(i => i.id === draggedItem)
    const dropIndex = carouselMediaItems.findIndex(i => i.id === dropTargetId)

    if (draggedIndex === -1 || dropIndex === -1) return

    const items = [...carouselMediaItems]
    const [removed] = items.splice(draggedIndex, 1)
    items.splice(dropIndex, 0, removed)

    setCarouselMediaItems(items)
    setDraggedItem(null)
  }, [carouselMediaItems, draggedItem])

  const handleCarouselFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (e.target) {
      e.target.value = ''
    }
  }, [addCarouselMediaItem])

  const handleCarouselUrlChange = useCallback(async (url: string) => {
    setCarouselUrlInput(url)
    setPendingCarouselUrlType(null)

    if (!url) {
      return
    }

    if (isDouyinUrl(url)) {
      setIsFetchingDouyin(true)
      onError?.('')

      try {
        const media = await fetchDouyinMedia(url, { onError: (msg) => onError?.(msg) })

        if (!media) {
          throw new Error('No media found in Douyin response')
        }

        const hasVideo = media.type === 'video' && media.downloadUrl
        const hasImages = media.imageUrls.length > 0

        if (!hasVideo && !hasImages) {
          throw new Error('No media found in Douyin response. The video may be private or deleted.')
        }

        if (hasVideo) {
          addCarouselMediaItem({
            type: 'video',
            url: media.downloadUrl!,
            altText: media.videoDesc || '',
            sourceUrl: url,
          })
        }

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
        onError?.(err instanceof Error ? err.message : 'Failed to parse Douyin URL')
      } finally {
        setIsFetchingDouyin(false)
      }
      return
    }

    const mediaType = detectMediaTypeFromUrl(url)

    if (mediaType === 'image') {
      addCarouselMediaItem({ type: 'image', url, altText: '', sourceUrl: url })
      setCarouselUrlInput('')
    } else if (mediaType === 'video') {
      addCarouselMediaItem({ type: 'video', url, altText: '', sourceUrl: url })
      setCarouselUrlInput('')
    } else {
      setPendingCarouselUrlType('image')
    }
  }, [addCarouselMediaItem, onError])

  const handleAddCarouselUrlByType = useCallback((type: 'image' | 'video') => {
    if (!carouselUrlInput) return
    addCarouselMediaItem({ type, url: carouselUrlInput, altText: '', sourceUrl: carouselUrlInput })
    setCarouselUrlInput('')
    setPendingCarouselUrlType(null)
  }, [addCarouselMediaItem, carouselUrlInput])

  return {
    carouselMediaItems,
    setCarouselMediaItems,
    draggedItem,
    setDraggedItem,
    carouselUrlInput,
    setCarouselUrlInput,
    isFetchingDouyin,
    pendingCarouselUrlType,
    addCarouselMediaItem,
    removeCarouselMediaItem,
    updateCarouselItemAltText,
    updateCarouselItemSourceUrl,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleCarouselFileSelect,
    handleCarouselUrlChange,
    handleAddCarouselUrlByType,
  }
}
