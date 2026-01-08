import { ScheduledCommentCard } from '@/components/posts/comments/ScheduledCommentCard'
import type { ScheduledComment } from '@/lib/types/posts'

interface ScheduledCommentsSectionProps {
  scheduledComments: ScheduledComment[]
  onAddComment: () => void
  onRemoveComment: (id: string) => void
  onUpdateComment: (id: string, field: 'content' | 'delayMinutes', value: string | number) => void
  onMediaSelect: (commentId: string, e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveMedia: (commentId: string) => void
}

export function ScheduledCommentsSection({
  scheduledComments,
  onAddComment,
  onRemoveComment,
  onUpdateComment,
  onMediaSelect,
  onRemoveMedia,
}: ScheduledCommentsSectionProps) {
  return (
    <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Scheduled Comments
        </label>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Add comments that will be automatically posted as replies after the main post is published.
        </p>
      </div>

      {scheduledComments.map((comment, index) => (
        <ScheduledCommentCard
          key={comment.id}
          comment={comment}
          index={index}
          onUpdateComment={onUpdateComment}
          onRemove={() => onRemoveComment(comment.id)}
          onMediaSelect={(e) => onMediaSelect(comment.id, e)}
          onRemoveMedia={() => onRemoveMedia(comment.id)}
        />
      ))}

      {scheduledComments.length < 10 && (
        <button
          type="button"
          onClick={onAddComment}
          className="mt-2 flex items-center gap-2 rounded-md border-2 border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Scheduled Comment
        </button>
      )}

      {scheduledComments.length >= 10 && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Maximum 10 scheduled comments allowed.
        </p>
      )}
    </div>
  )
}
