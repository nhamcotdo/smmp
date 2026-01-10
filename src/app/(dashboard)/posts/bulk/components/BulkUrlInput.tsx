import { useState } from 'react'

interface BulkUrlInputProps {
  urlInput: string
  onUrlChange: (url: string) => void
  onParse: () => void
}

export function BulkUrlInput({ urlInput, onUrlChange, onParse }: BulkUrlInputProps) {
  const [isParsing, setIsParsing] = useState(false)

  const handleParse = () => {
    setIsParsing(true)
    try {
      onParse()
    } finally {
      setIsParsing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleParse()
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Paste Bulk Post Data
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Enter one post per line in the format: text share | Post Content | Video description | Image description | hh:mm DD/MM/YYYY | channel-username
        <br />
        <span className="text-xs">
          Only text share is required. Other fields are optional. If scheduled time is provided, publish mode will be set to &quot;schedule later&quot;.
        </span>
      </p>

      <textarea
        value={urlInput}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="5.33 hbA:/ 11/24 w@F.HI description text https://v.douyin.com/p_-FFYmr_hc/ | Custom post content | Video description | Image description | 15:30 25/12/2024 | mychannel"
        className="mb-4 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        rows={4}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {urlInput.trim() ? (
            <>
              Found {urlInput.split('\n').filter(line => line.trim()).length} post(s) in input
            </>
          ) : (
            'Press Cmd+Enter to parse and create posts'
          )}
        </div>
        <button
          onClick={handleParse}
          disabled={isParsing || !urlInput.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:bg-zinc-400 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-zinc-600"
        >
          {isParsing ? 'Parsing...' : 'Extract & Parse URLs'}
        </button>
      </div>
    </div>
  )
}
