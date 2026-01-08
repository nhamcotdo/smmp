import type { ThreadsOptions, PollOptions } from '@/lib/types/posts'
import type { ThreadsReplyControl } from '@/lib/types/threads'

interface AdvancedOptionsSectionProps {
  showAdvancedOptions: boolean
  onToggle: () => void
  threadsOptions: ThreadsOptions
  pollOptions: PollOptions
  onThreadsOptionsChange: (options: ThreadsOptions) => void
  onPollOptionsChange: (options: PollOptions) => void
}

export function AdvancedOptionsSection({
  showAdvancedOptions,
  onToggle,
  threadsOptions,
  pollOptions,
  onThreadsOptionsChange,
  onPollOptionsChange,
}: AdvancedOptionsSectionProps) {
  return (
    <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
      <button
        type="button"
        onClick={onToggle}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <svg
          className={`h-4 w-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Advanced Options (Threads API)
      </button>

      {showAdvancedOptions && (
        <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
          <div>
            <label htmlFor="topicTag" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Topic Tag
            </label>
            <input
              type="text"
              id="topicTag"
              value={threadsOptions.topicTag || ''}
              onChange={(e) => onThreadsOptionsChange({ ...threadsOptions, topicTag: e.target.value })}
              placeholder="e.g., ThreadsAPI"
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label htmlFor="replyControl" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Who Can Reply
            </label>
            <select
              id="replyControl"
              value={threadsOptions.replyControl || ''}
              onChange={(e) => onThreadsOptionsChange({ ...threadsOptions, replyControl: e.target.value as ThreadsReplyControl })}
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Everyone (default)</option>
              <option value="EVERYONE">Everyone</option>
              <option value="ACCOUNTS_YOU_FOLLOW">Accounts You Follow</option>
              <option value="MENTIONED_ONLY">Mentioned Only</option>
              <option value="PARENT_POST_AUTHOR_ONLY">Parent Post Author Only</option>
              <option value="FOLLOWERS_ONLY">Followers Only</option>
            </select>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Poll Attachment (Optional)</p>
            <div className="space-y-2">
              <input
                type="text"
                value={pollOptions.optionA}
                onChange={(e) => onPollOptionsChange({ ...pollOptions, optionA: e.target.value })}
                placeholder="Option A (required)"
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                type="text"
                value={pollOptions.optionB}
                onChange={(e) => onPollOptionsChange({ ...pollOptions, optionB: e.target.value })}
                placeholder="Option B (required)"
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                type="text"
                value={pollOptions.optionC}
                onChange={(e) => onPollOptionsChange({ ...pollOptions, optionC: e.target.value })}
                placeholder="Option C (optional)"
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                type="text"
                value={pollOptions.optionD}
                onChange={(e) => onPollOptionsChange({ ...pollOptions, optionD: e.target.value })}
                placeholder="Option D (optional)"
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
