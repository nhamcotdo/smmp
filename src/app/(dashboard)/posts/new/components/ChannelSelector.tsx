import type { PublishMode } from '@/lib/types/posts'
import type { Channel } from '@/lib/api/channels'

interface ChannelSelectorProps {
  channels: Channel[]
  selectedChannel: string
  publishMode: PublishMode
  scheduledFor: string
  onChannelChange: (channelId: string) => void
  onScheduledForChange: (datetime: string) => void
  idPrefix?: string
}

export function ChannelSelector({
  channels,
  selectedChannel,
  publishMode,
  scheduledFor,
  onChannelChange,
  onScheduledForChange,
  idPrefix = '',
}: ChannelSelectorProps) {
  const channelId = idPrefix ? `channel-${idPrefix}` : 'channel'
  const scheduledForId = idPrefix ? `scheduledFor-${idPrefix}` : 'scheduledFor'

  return (
    <>
      {publishMode === 'now' && (
        <div className="mb-4">
          <label htmlFor={channelId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Select Threads Channel
          </label>
          <select
            id={channelId}
            value={selectedChannel}
            onChange={(e) => onChannelChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            required
          >
            <option value="">Choose a channel...</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                @{channel.username} {channel.status !== 'active' && `(${channel.status})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {publishMode === 'schedule' && (
        <>
          <div className="mb-4">
            <label htmlFor={channelId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Select Threads Channel *
            </label>
            <select
              id={channelId}
              value={selectedChannel}
              onChange={(e) => onChannelChange(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              required
            >
              <option value="">Choose a channel...</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  @{channel.username} {channel.status !== 'active' && `(${channel.status})`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              The post will be published to this account at the scheduled time
            </p>
          </div>

          <div className="mb-4">
            <label htmlFor={scheduledForId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Schedule Date & Time
            </label>
            <input
              type="datetime-local"
              id={scheduledForId}
              value={scheduledFor}
              onChange={(e) => onScheduledForChange(e.target.value)}
              min={scheduledFor || new Date().toISOString().slice(0, 16)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              required
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Timezone: UTC+7 (Indochina Time). Select a future date and time to publish this post automatically.
            </p>
          </div>
        </>
      )}
    </>
  )
}
