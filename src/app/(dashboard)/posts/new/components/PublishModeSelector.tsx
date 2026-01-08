import type { PublishMode } from '@/lib/types/posts'

interface PublishModeSelectorProps {
  publishMode: PublishMode
  onChange: (mode: PublishMode) => void
  name?: string
}

export function PublishModeSelector({ publishMode, onChange, name = 'publishMode' }: PublishModeSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
        Publish Mode
      </label>
      <div className="flex gap-4">
        <label className="flex items-center">
          <input
            type="radio"
            name={name}
            value="now"
            checked={publishMode === 'now'}
            onChange={(e) => onChange(e.target.value as PublishMode)}
            className="mr-2"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Publish Now</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name={name}
            value="schedule"
            checked={publishMode === 'schedule'}
            onChange={(e) => onChange(e.target.value as PublishMode)}
            className="mr-2"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Schedule for Later</span>
        </label>
      </div>
    </div>
  )
}
