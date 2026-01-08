import type { MediaPreview } from '@/lib/types/posts'

interface MediaPreviewCardProps {
  mediaPreview: MediaPreview
  altText: string
  onAltTextChange: (text: string) => void
  onClearMedia: () => void
  onUseCoverImage?: () => void
}

export function MediaPreviewCard({ mediaPreview, altText, onAltTextChange, onClearMedia, onUseCoverImage }: MediaPreviewCardProps) {
  return (
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
          onClick={onClearMedia}
          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Remove
        </button>
      </div>

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

      {mediaPreview.type === 'video' && mediaPreview.coverImageUrl && onUseCoverImage && (
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
              onClick={onUseCoverImage}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              Use cover instead
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="altText" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Alt Text (for accessibility)
        </label>
        <input
          type="text"
          id="altText"
          value={altText}
          onChange={(e) => onAltTextChange(e.target.value)}
          placeholder="Describe the image/video for screen readers..."
          maxLength={500}
          className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
    </div>
  )
}
