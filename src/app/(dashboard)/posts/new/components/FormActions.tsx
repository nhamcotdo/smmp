import Link from 'next/link'
import type { PublishMode } from '@/lib/types/posts'

interface FormActionsProps {
  publishMode: PublishMode
  isPublishing: boolean
  isDisabled: boolean
  selectedChannel: string
}

export function FormActions({ publishMode, isPublishing, isDisabled, selectedChannel }: FormActionsProps) {
  return (
    <>
      <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {publishMode === 'now' ? (
            <>
              <strong>Tip:</strong> Your post will be published immediately to your Threads
              account. Make sure your content follows Threads community guidelines.
            </>
          ) : (
            <>
              <strong>Scheduled:</strong> Your post will be automatically published at the
              scheduled time. A background job will handle the publishing.
            </>
          )}
        </p>
      </div>

      <div className="flex justify-end gap-4">
        <Link
          href="/channels"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isDisabled || isPublishing || !selectedChannel}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPublishing
            ? (publishMode === 'now' ? 'Publishing...' : 'Scheduling...')
            : (publishMode === 'now' ? 'Publish to Threads' : 'Schedule Post')
          }
        </button>
      </div>
    </>
  )
}
