import type { CarouselMediaItem } from '@/lib/types/posts'

interface CarouselItemCardProps {
  item: CarouselMediaItem
  index: number
  isDragged: boolean
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (targetId: string) => void
  onRemove: (id: string) => void
  onAltTextChange: (id: string, altText: string) => void
  onSourceUrlChange: (id: string, url: string) => void
}

export function CarouselItemCard({
  item,
  index,
  isDragged,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  onAltTextChange,
  onSourceUrlChange,
}: CarouselItemCardProps) {
  return (
    <div
      key={item.id}
      draggable
      onDragStart={() => onDragStart(item.id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(item.id)}
      className={`group relative flex gap-3 rounded-lg border-2 bg-zinc-50 p-3 transition-all dark:bg-zinc-800 ${
        isDragged
          ? 'border-blue-500 opacity-50'
          : 'border-zinc-200 dark:border-zinc-700'
      }`}
    >
      <div className="flex cursor-move items-center">
        <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      <div className="flex items-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {index + 1}
        </span>
      </div>

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
        {item.sourceUrl && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={item.url}
              onChange={(e) => onSourceUrlChange(item.id, e.target.value)}
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
          onChange={(e) => onAltTextChange(item.id, e.target.value)}
          placeholder="Alt text (optional)..."
          maxLength={500}
          className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="self-start rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        title="Remove item"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
