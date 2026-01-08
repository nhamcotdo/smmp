interface MediaUrlInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  isFetching?: boolean
  placeholder?: string
}

export function MediaUrlInput({
  value,
  onChange,
  disabled = false,
  isFetching = false,
  placeholder = 'Paste image or video URL... (Douyin links supported)'
}: MediaUrlInputProps) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        disabled={disabled}
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Supports: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV, AVI, Douyin links
        </p>
        {isFetching && (
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Fetching Douyin URL...
          </p>
        )}
      </div>
    </div>
  )
}
