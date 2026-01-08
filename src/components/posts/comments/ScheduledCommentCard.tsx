import type { ScheduledComment } from '@/lib/types/posts'

interface ScheduledCommentCardProps {
  comment: ScheduledComment
  index: number
  onUpdateComment: (id: string, field: 'content' | 'delayMinutes', value: string | number) => void
  onRemove: () => void
  onMediaSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveMedia: () => void
}

export function ScheduledCommentCard({
  comment,
  index,
  onUpdateComment,
  onRemove,
  onMediaSelect,
  onRemoveMedia,
}: ScheduledCommentCardProps) {
  return (
    <div className="mb-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {index + 1}
        </span>

        <div className="flex flex-1 gap-3">
          <textarea
            value={comment.content}
            onChange={(e) => onUpdateComment(comment.id, 'content', e.target.value)}
            placeholder="Comment content..."
            rows={2}
            maxLength={500}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />

          <select
            value={comment.delayMinutes}
            onChange={(e) => onUpdateComment(comment.id, 'delayMinutes', parseInt(e.target.value, 10))}
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
            onClick={onRemove}
            className="h-10 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Remove
          </button>
        </div>
      </div>

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
              onChange={onMediaSelect}
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
              onClick={onRemoveMedia}
              className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Remove Media
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
