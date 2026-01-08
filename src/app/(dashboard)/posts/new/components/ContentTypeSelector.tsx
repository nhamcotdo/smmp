import type { PostContentType } from '@/lib/types/posts'

interface ContentTypeSelectorProps {
  contentType: PostContentType
  onChange: (type: PostContentType) => void
  onClearMedia: () => void
  onClearCarousel: () => void
}

export function ContentTypeSelector({ contentType, onChange, onClearMedia, onClearCarousel }: ContentTypeSelectorProps) {
  return (
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
            onChange={() => {
              onChange('single')
              onClearCarousel()
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
            onChange={() => {
              onChange('carousel')
              onClearMedia()
            }}
            className="sr-only"
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">🎠 Carousel (2-20 items)</span>
        </label>
      </div>
    </div>
  )
}
