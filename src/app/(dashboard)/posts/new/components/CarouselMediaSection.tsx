import { CarouselUploadArea } from '@/components/posts/media/CarouselUploadArea'
import { MediaUrlInput } from '@/components/posts/media/MediaUrlInput'
import { MediaTypeSelector } from '@/components/posts/media/MediaTypeSelector'
import { CarouselItemCard } from '@/components/posts/media/CarouselItemCard'
import { CarouselEmptyState } from '@/components/posts/media/CarouselEmptyState'
import type { CarouselMediaItem } from '@/lib/types/posts'

interface CarouselMediaSectionProps {
  carouselMediaItems: CarouselMediaItem[]
  draggedItem: string | null
  carouselUrlInput: string
  isFetchingDouyin: boolean
  pendingCarouselUrlType: 'image' | 'video' | null
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUrlChange: (url: string) => void
  onAddUrlByType: (type: 'image' | 'video') => void
  onRemoveItem: (id: string) => void
  onUpdateAltText: (id: string, altText: string) => void
  onUpdateSourceUrl: (id: string, url: string) => void
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (targetId: string) => void
}

export function CarouselMediaSection({
  carouselMediaItems,
  draggedItem,
  carouselUrlInput,
  isFetchingDouyin,
  pendingCarouselUrlType,
  onFileSelect,
  onUrlChange,
  onAddUrlByType,
  onRemoveItem,
  onUpdateAltText,
  onUpdateSourceUrl,
  onDragStart,
  onDragOver,
  onDrop,
}: CarouselMediaSectionProps) {
  return (
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

      <div className="mb-4 space-y-4">
        <CarouselUploadArea onFileSelect={onFileSelect} />

        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>or</span>
          <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
        </div>

        <div>
          <MediaUrlInput
            value={carouselUrlInput}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isFetchingDouyin}
            isFetching={isFetchingDouyin}
            placeholder="Paste image or video URL... (Douyin links supported)"
          />

          {carouselUrlInput && pendingCarouselUrlType && !isFetchingDouyin && (
            <MediaTypeSelector
              onImageSelect={() => onAddUrlByType('image')}
              onVideoSelect={() => onAddUrlByType('video')}
            />
          )}
        </div>
      </div>

      {carouselMediaItems.length > 0 && (
        <div className="space-y-3">
          {carouselMediaItems.map((item, index) => (
            <CarouselItemCard
              key={item.id}
              item={item}
              index={index}
              isDragged={draggedItem === item.id}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onRemove={onRemoveItem}
              onAltTextChange={onUpdateAltText}
              onSourceUrlChange={onUpdateSourceUrl}
            />
          ))}
        </div>
      )}

      {carouselMediaItems.length === 0 && <CarouselEmptyState />}

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Drag items to reorder them. The first item will be the cover of your carousel.
      </p>
    </div>
  )
}
