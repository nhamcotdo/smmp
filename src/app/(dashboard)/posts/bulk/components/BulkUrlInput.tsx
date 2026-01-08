import { useState } from 'react'
import { DOUYIN_URL_PATTERN } from '@/lib/constants'

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
        Paste Douyin Share Content
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Paste raw Douyin share text (one share per line). URLs will be automatically extracted.
        <br />
        <span className="text-xs">
          Format example: &quot;5.33 hbA:/ 11/24 w@F.HI description text https://v.douyin.com/xxx/ ...&quot;
        </span>
      </p>

      <textarea
        value={urlInput}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="5.33 hbA:/ 11/24 w@F.HI 2026年不许再倒霉了 姨姨们 # 金三柜  https://v.douyin.com/p_-FFYmr_hc/ 复制此链接，打开Dou音搜索，直接观看视频！&#10;9.28 goD:/ 01/25 u@s.rE 这么多年了！孩子终于说话了 # 豆包ai  https://v.douyin.com/lj4ve2XeaMA/ 复制此链接，打开Dou音搜索，直接观看视频！&#10;..."
        className="mb-4 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
        rows={12}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {urlInput.trim() ? (
            <>
              Found {urlInput.match(DOUYIN_URL_PATTERN)?.length || 0} URL(s) in text
            </>
          ) : (
            'Press Cmd+Enter to extract URLs and parse'
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
