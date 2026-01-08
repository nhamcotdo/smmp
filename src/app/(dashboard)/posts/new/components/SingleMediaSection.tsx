import { MediaUploadArea } from '@/components/posts/media/MediaUploadArea'
import { MediaUrlInput } from '@/components/posts/media/MediaUrlInput'
import { MediaTypeSelector } from '@/components/posts/media/MediaTypeSelector'
import { MediaPreviewCard } from '@/components/posts/media/MediaPreviewCard'
import type { MediaPreview } from '@/lib/types/posts'

interface SingleMediaSectionProps {
  mediaPreview: MediaPreview | null
  altText: string
  mediaUrlInput: string
  isFetchingDouyin: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onAltTextChange: (text: string) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onMediaTypeSelect: (type: 'image' | 'video') => void
  onClearMedia: () => void
  onUseCoverImage: () => void
}

export function SingleMediaSection({
  mediaPreview,
  altText,
  mediaUrlInput,
  isFetchingDouyin,
  fileInputRef,
  onAltTextChange,
  onFileSelect,
  onUrlChange,
  onMediaTypeSelect,
  onClearMedia,
  onUseCoverImage,
}: SingleMediaSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
        Media (Optional for Single Post)
      </label>

      {!mediaPreview ? (
        <div className="space-y-4">
          <MediaUploadArea
            fileInputRef={fileInputRef}
            onFileSelect={onFileSelect}
          />

          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>or</span>
            <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
          </div>

          <div>
            <MediaUrlInput
              value={mediaUrlInput}
              onChange={onUrlChange}
              disabled={isFetchingDouyin}
              isFetching={isFetchingDouyin}
            />

            {mediaUrlInput && !mediaPreview && !isFetchingDouyin && (
              <MediaTypeSelector
                onImageSelect={() => onMediaTypeSelect('image')}
                onVideoSelect={() => onMediaTypeSelect('video')}
              />
            )}
          </div>
        </div>
      ) : (
        <MediaPreviewCard
          mediaPreview={mediaPreview}
          altText={altText}
          onAltTextChange={onAltTextChange}
          onClearMedia={onClearMedia}
          onUseCoverImage={onUseCoverImage}
        />
      )}
    </div>
  )
}
